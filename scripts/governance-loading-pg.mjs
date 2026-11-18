// Synthetic-only read verification; no schema, fixture or business writes.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fixtureEnvironment,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createProtocolReviewQueue} from '../server/research-execution/review-queue.mjs';
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const rt=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(rt.ids.tenant,/^rh-kb-local-/);
process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;
const {load}=runtimeDependencies(),prisma=new(load('prisma/prisma.service','PrismaService'))();
const out=workspaceRoot+'researchhub/docs/testing/evidence/governance-loading-2026-11-16/pg-'+Date.now()+'/';mkdirSync(out,{recursive:true});
const result={syntheticOnly:true,checks:[],businessWrites:0,modelCalls:0};
async function collect(queue,user){const items=[],cursors=new Set();let cursor;do{const page=await queue.list(user,{limit:'2',...(cursor?{cursor}:{})});items.push(...page.items);cursor=page.nextCursor;if(cursor){assert(!cursors.has(cursor));cursors.add(cursor);}}while(cursor);return items;}
try{
 const service=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[rt.ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('READ_ONLY');}});
 for(const username of ['admin@example.org','owner@example.org']){
  const user=await prisma.withTenantTransaction(rt.ids.tenant,undefined,undefined,async tx=>{const a=await tx.account.findFirst({where:{tenantId:rt.ids.tenant,username},select:{id:true,tenantId:true,authVersion:true}});assert(a);return{accountId:a.id,tenantId:a.tenantId,authVersion:a.authVersion};});
  const oldQueue=createProtocolReviewQueue({studies:{...service,reviewDirectory:undefined}}),newQueue=createProtocolReviewQueue({studies:service});
  const start=Date.now(),oldItems=await collect(oldQueue,user),oldMs=Date.now()-start,newStart=Date.now(),newItems=await collect(newQueue,user),newMs=Date.now()-newStart;
  assert.deepEqual(newItems,oldItems);assert.equal(new Set(newItems.map(x=>x.protocol.id)).size,newItems.length);
  const regular=await service.directory(user,{limit:'25'}),internal=await service.reviewDirectory(user,{limit:'25'});
  assert.deepEqual(internal.items.map(({reviewCursor,...item})=>item),regular.items);assert(regular.items.every(x=>!Object.hasOwn(x,'reviewCursor')));
  if(internal.items.length>1){const resumed=await service.directory(user,{limit:'1',cursor:internal.items[0].reviewCursor});assert.equal(resumed.items[0].key,internal.items[1].key);}
  await assert.rejects(newQueue.list({...user,authVersion:user.authVersion+1}),e=>e.status===401);
  result.checks.push({username,items:newItems.length,oldMs,newMs,publicDtoUnchanged:true,cursorResume:true,staleIdentityRejected:true});
 }
 result.passed=true;
}catch(error){result.passed=false;result.error=error.message;process.exitCode=1;}
finally{await prisma.onModuleDestroy();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,out}));}
