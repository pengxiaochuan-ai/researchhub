import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';import {setTimeout as delay} from 'node:timers/promises';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {StudyOperationsService}=require('./src/study-operations/study-operations.service.ts'),{lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function waiting(tx,pid){for(let n=0;n<100;n++){const row=(await tx.$queryRaw`SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=${pid} AND datname=current_database()`)[0];if(row?.wait_event_type==='Lock'&&row.wait_event==='advisory')return;await delay(10);}assert.fail('Expected real competing connection to wait on advisory lock');}
async function fixture(tx,prefix,method){
 const s={tenantId:prefix,studyGroupId:prefix+'_g',researchProjectId:prefix+'_p'},user={...s,accountId:prefix+'_a',role:'tenant_admin',isTenantAdmin:true,authVersion:0};
 await tx.tenant.create({data:{id:s.tenantId,slug:prefix,name:'Synthetic T15 lock fixture'}});await tx.studyGroup.create({data:{id:s.studyGroupId,tenantId:s.tenantId,slug:'synthetic',name:'Synthetic'}});await tx.researchProject.create({data:{id:s.researchProjectId,tenantId:s.tenantId,studyGroupId:s.studyGroupId,code:'SYNTHETIC',name:'Synthetic'}});await tx.account.create({data:{id:user.accountId,tenantId:s.tenantId,username:'synthetic',displayName:'Synthetic',passwordHash:'synthetic-test-only',role:'tenant_admin',isTenantAdmin:true}});
 let target;
 if(method==='closeQuery')target=await tx.dataQuery.create({data:{...s,ruleCode:'synthetic',targetRecord:{},createdBy:user.accountId}});
 if(method==='closeDeviation')target=await tx.protocolDeviation.create({data:{...s,category:'synthetic',severity:'minor',occurredAt:new Date(),createdBy:user.accountId}});
 const service=new StudyOperationsService({withTenantTransaction:async(_t,_g,_p,fn)=>fn(tx),forTenant:()=>tx});
 const args=method==='createQuery'?[{ruleCode:'synthetic',targetRecord:{}}]:method==='createDeviation'?[{category:'synthetic',severity:'minor'}]:method==='closeQuery'?[target.id,'Synthetic resolved']:[target.id,{closeRationale:'Synthetic resolved'}];
 return {user,perform:()=>service[method](user,...args)};
}
// The competing read lane is the exact authorization lock used before T15 reads.
// Fixtures remain uncommitted, so this proves lock ordering, not cross-transaction data visibility;
// the companion AnalysisBasis PG test verifies actual quality release/publish invalidation.
for(const method of ['createQuery','closeQuery','createDeviation','closeDeviation'])for(const first of ['analysis','writer'])test(`${method}: ${first} first blocks competing real connection and all fixture changes roll back`,async()=>{
 await assertFixtureTarget(env);const prefix=validateFixtureConfig(env).runId+'__t15lock_'+randomUUID().slice(0,8),ready=deferred(),locked=deferred(),pid=deferred(),release=deferred();let writeFinished=false,readFinished=false;
 const writer=withFixtureTransaction(env,'direct',async tx=>{
  const f=await fixture(tx,prefix,method);ready.resolve();
  if(first==='analysis'){await locked.promise;pid.resolve((await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid);await f.perform();writeFinished=true;}
  else{await f.perform();writeFinished=true;locked.resolve();await waiting(tx,await pid.promise);assert.equal(readFinished,false);release.resolve();}
  assert.equal(await tx.auditLog.count({where:{tenantId:prefix}}),1);throw Error('T15_LOCK_ROLLBACK');
 }).catch(e=>{if(e.message!=='T15_LOCK_ROLLBACK')throw e;});
 const reader=withFixtureTransaction(env,'direct',async tx=>{
  await ready.promise;
  if(first==='analysis'){await lockAuthorizationMutation(tx,prefix);locked.resolve();await waiting(tx,await pid.promise);assert.equal(writeFinished,false);}
  else{await locked.promise;pid.resolve((await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid);await lockAuthorizationMutation(tx,prefix);readFinished=true;await release.promise;}
 });
 await Promise.all([writer,reader]);assert.equal(writeFinished,true);
});
