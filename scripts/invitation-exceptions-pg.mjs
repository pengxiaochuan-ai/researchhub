import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createMemberInvitations} from '../server/wp02/invitation-service.mjs';
import {loadInvitationExceptions} from '../src/invitation-exceptions.js';
assert.deepEqual(process.argv.slice(2),['--rollback-only']);
const root=new URL('../../',import.meta.url).pathname,rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-p2/fixture.json')),old=JSON.parse(readFileSync(root+'.tmp/researchhub-wp02/invitation-fixture.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal(fixture.tenantId,rt.ids.tenant);assert.match(rt.ids.tenant,/^rh-kb-local-/);
const prefix='invite-aggregate-rollback-'+randomUUID(),rollback=Error('ROLLBACK_ONLY'),out=root+'researchhub/docs/testing/evidence/invitation-exceptions-2026-11-13/';mkdirSync(out,{recursive:true});let result;
try{
 try{await withFixtureTransaction(env,'direct',async tx=>{
  const[db]=await tx.$queryRaw`SELECT current_database() AS name`;assert.equal(db.name,'wp01_test_full_baseline');
  const a=await tx.account.findFirst({where:{id:rt.ids.admin,tenantId:rt.ids.tenant},select:{authVersion:true,role:true}}),now=new Date(),ids=[];
  for(const state of ['failed','unknown','expired','captured']){
   const id=randomUUID();ids.push(id);const created=new Date(now-120000),expires=new Date(now.getTime()+(state==='expired'?-60000:7200000)),hash=createHash('sha256').update(id).digest('hex');
   // Explicit rollback-only receipts are synthetic, not evidence of a mail delivery.
   await tx.$executeRaw`INSERT INTO research_member_invitation(id,"tenantId","studyGroupId","researchProjectId",email,"issuedBy","issuerAuthVersion","targetRoleId","targetProjectRoleKey","tokenHash","requestKey","requestHash","createdAt","updatedAt","expiresAt","deliveryStatus","messageId","messageDigest") VALUES (${id},${rt.ids.tenant},${fixture.groupId},${fixture.projectId},${prefix+'-'+state+'@example.test'},${rt.ids.admin},${a.authVersion},${old.readerRoleId},'researcher',${hash},${prefix+'-'+state},${hash},${created},${created},${expires},${state==='expired'?'captured':state},${'synthetic-rollback-'+id},${hash})`;
  }
  const service=createMemberInvitations({db:{tenantId:rt.ids.tenant,transaction:cb=>cb(tx)},mailer:{send(){throw Error('NO_MAIL_IN_ROLLBACK');}},secret:rt.secret,target:{groupId:fixture.groupId,projectId:fixture.projectId,readerRoleId:old.readerRoleId},config:{baseUrl:'http://127.0.0.1:19501'},allowTenantAdmin:true});
  const principal={accountId:rt.ids.admin,tenantId:rt.ids.tenant,authVersion:a.authVersion,role:a.role},ctx={user:principal,groupId:fixture.groupId,projectId:fixture.projectId};
  const projected=await loadInvitationExceptions({studies:async()=>({items:[{studyGroupId:fixture.groupId,researchProjectId:fixture.projectId,name:'P2合成研究'}]}),list:(scope,q)=>service.list({...ctx,groupId:scope.groupId,projectId:scope.projectId},q)});
  const ours=projected.filter(x=>ids.some(id=>x.id.endsWith(':'+id)));assert.deepEqual(ours.map(x=>x.status).sort(),['expired','failed','unknown']);
  await assert.rejects(()=>service.list({...ctx,projectId:'different-study'},{limit:'50'}),{status:403});
  await assert.rejects(()=>service.list({...ctx,user:{...principal,authVersion:a.authVersion+1}},{limit:'50'}),{status:401});
  result={passed:true,database:db.name,states:ours.map(x=>x.status),normalExcluded:true,currentScopeAndVersionDenied:true,rollback:true,persistentWrites:0,mailCalls:0,modelCalls:0};throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 const count=await withFixtureTransaction(env,'direct',async tx=>{const[r]=await tx.$queryRaw`SELECT count(*)::int AS n FROM research_member_invitation WHERE "tenantId"=${rt.ids.tenant} AND "requestKey" LIKE ${prefix+'%'}`;return r.n;},{readOnly:true});assert.equal(count,0);result.leftover=0;
 writeFileSync(out+'rollback-pg.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){console.error(JSON.stringify({passed:false,code:e.code,dbCode:e.meta?.code,message:e.code?'Rollback validation failed; no commit performed.':e.message}));process.exitCode=1;}
