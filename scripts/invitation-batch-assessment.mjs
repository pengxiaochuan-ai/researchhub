// Read-only measurement harness, not imported/mounted by the product.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fixtureEnvironment,workspaceRoot as root} from './research-creation-fixture.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createWp02Repository} from '../server/wp02/repository.mjs';
import {createMemberInvitations} from '../server/wp02/invitation-service.mjs';
import {createInvitationRouter} from '../server/wp02/invitation-router.mjs';
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(rt.ids.tenant,/^rh-kb-local-/);
const targets=['researchhub-wp02','researchhub-real-entry'].map(d=>JSON.parse(readFileSync(root+'.tmp/'+d+'/invitation-fixture.json')));assert(targets.every(t=>t.tenantId===rt.ids.tenant));
process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;
const {load}=runtimeDependencies(),prisma=new(load('prisma/prisma.service','PrismaService'))(),lock=load('common/worker-publication','lockAuthorizationMutation');
const out=root+'researchhub/docs/testing/evidence/invitation-batch-assessment-2026-11-16/'+Date.now()+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=await(pw.request??pw.default.request).newContext({baseURL:'http://127.0.0.1:19501'});
const result={syntheticOnly:true,pid:rt.pid,asOf:new Date().toISOString(),accounts:[],businessWrites:0,modelCalls:0,prototypeOnly:true},asOf=new Date(result.asOf);
const digest=items=>createHash('sha256').update(JSON.stringify(items)).digest('hex');
const normalize=items=>items.map(x=>({scope:x.scope,id:x.id,status:x.status,version:x.version})).sort((a,b)=>(a.scope+':'+a.id).localeCompare(b.scope+':'+b.id));
async function probe(user,scopes,batched){
 const stats={batched,transactions:0,tenantLocks:0,dbMethods:0,scopeChecks:0},lane=new AsyncLocalStorage();
 function track(tx){return new Proxy(tx,{get(t,k){const value=t[k];if(typeof value==='function')return(...args)=>{stats.dbMethods++;return value.apply(t,args);};if(value&&typeof value==='object')return new Proxy(value,{get(m,n){return typeof m[n]==='function'?(...args)=>{stats.dbMethods++;return m[n](...args);}:m[n];}});return value;}});}
 const repo=createWp02Repository({tenantId:rt.ids.tenant,lockAuthorization:async(tx,t)=>{stats.tenantLocks++;return lock(tx,t);},transact:fn=>{stats.transactions++;return prisma.elevated.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');return fn(track(tx));},{maxWait:5000,timeout:15000});}});
 const db={tenantId:rt.ids.tenant,transaction:fn=>lane.getStore()?fn(lane.getStore()):repo.transaction(fn)};
 const router=createInvitationRouter({tenantId:rt.ids.tenant,db,targets,makeService:target=>createMemberInvitations({db,target,secret:'READ_ONLY_NO_MAIL',config:{baseUrl:'http://127.0.0.1:19501'},mailer:{send:()=>{throw Error('NO_MAIL');}},now:()=>asOf,allowTenantAdmin:true}),resolveTarget:async(groupId,projectId)=>{
  const valid=await db.transaction(async tx=>{const g=await tx.studyGroup.findFirst({where:{id:groupId,tenantId:rt.ids.tenant,status:'active'},select:{id:true}}),p=await tx.researchProject.findFirst({where:{id:projectId,tenantId:rt.ids.tenant,studyGroupId:groupId,status:'active'},select:{id:true}});return Boolean(g&&p);});
  return valid?{tenantId:rt.ids.tenant,groupId,projectId,readerRoleId:'wp02-invite-3a7f7604-reader'}:null;
 }});
 async function readScope(s){stats.scopeChecks++;let cursor;const items=[];do{const page=await router.list({user,groupId:s.studyGroupId,projectId:s.researchProjectId},{limit:'50',...(cursor?{cursor}:{})});items.push(...page.items.map(x=>({...x,scope:s.studyGroupId+':'+s.researchProjectId})));cursor=page.nextCursor;}while(cursor);return items;}
 const start=performance.now();let rows=[];
 if(batched){for(let i=0;i<scopes.length;i+=10)rows.push(...await repo.transaction(tx=>lane.run(tx,async()=>{const chunk=[];for(const s of scopes.slice(i,i+10))chunk.push(...await readScope(s));return chunk;})));}
 else{const values=new Array(scopes.length);let next=0;await Promise.all(Array.from({length:Math.min(3,scopes.length)},async()=>{for(;;){const i=next++;if(i>=scopes.length)return;values[i]=await readScope(scopes[i]);}}));rows=values.flat();}
 stats.elapsedMs=Math.round(performance.now()-start);stats.rows=rows.length;stats.exceptions=rows.filter(x=>['failed','unknown','expired'].includes(x.status)).length;stats.digest=digest(normalize(rows));return stats;
}
try{
 await prisma.elevated.$queryRaw`SELECT 1`;
 for(const username of ['admin@example.org','owner@example.org']){
  assert.equal((await request.post('/api/auth/login',{headers:{Origin:'http://127.0.0.1:19501'},data:{tenantSlug:rt.ids.tenant,username,password:rt.password}})).status(),201);
  const response=await request.get('/api/governance-users/studies');assert.equal(response.status(),200);const scopes=(await response.json()).items;assert(Array.isArray(scopes));
  const a=await prisma.elevated.account.findFirst({where:{tenantId:rt.ids.tenant,username},select:{id:true,tenantId:true,authVersion:true}});assert(a);const user={accountId:a.id,tenantId:a.tenantId,authVersion:a.authVersion},samples=[];
  for(let i=0;i<3;i++){
   const pair=[];for(const batched of i%2?[true,false]:[false,true])pair.push(await probe(user,scopes,batched));assert.equal(pair[0].digest,pair[1].digest);samples.push(...pair);
  }
  const median=(batched,key)=>samples.filter(s=>s.batched===batched).map(s=>s[key]).sort((a,b)=>a-b)[1];
  result.accounts.push({username,scopes:scopes.length,samples,currentMedianMs:median(false,'elapsedMs'),prototypeMedianMs:median(true,'elapsedMs'),equivalent:true,actualHttpAfterNotMeasured:true});
 }
 result.table=await prisma.elevated.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');return tx.$queryRaw`SELECT c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,has_table_privilege('aisci_app',c.oid,'SELECT') AS "appCanSelect",(SELECT jsonb_agg(indexname) FROM pg_indexes WHERE schemaname='public' AND tablename='research_member_invitation') AS indexes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='research_member_invitation'`;});
 result.passed=true;
}catch(error){result.passed=false;result.error=error.message;process.exitCode=1;}
finally{await request.dispose();await prisma.onModuleDestroy();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,out}));}
