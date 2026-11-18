import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createTokenFixture} from '../../scripts/hub-token-fixtures.mjs';
import {createHubBilling} from './service.mjs';
import {createRequire} from 'node:module';
import {protectAttempt} from './attempt-protection.mjs';
const root=new URL('../../../',import.meta.url).pathname,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const transaction=cb=>withFixtureTransaction(env,'direct',cb),fixture=await createTokenFixture(transaction);
const service=createHubBilling({scope:{allowedTenantIds:[fixture.tenantId]},transaction,billing:{}});
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const {BillingService}=require('./src/billing/billing.service.ts');
test('committed real PG two different request keys cannot debit one reservation twice',async()=>{
 const id=fixture.records.concurrent.id,d=await service.detail(fixture.admin,id);
 const results=await Promise.allSettled([1,2].map(()=>service.resolve(fixture.admin,id,{requestKey:randomUUID(),fingerprint:d.fingerprint,action:'settle'})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.status,409);
 await transaction(async tx=>{
  assert.equal(await tx.usageRecord.count({where:{tenantId:fixture.tenantId}}),1);
  assert.equal(await tx.auditLog.count({where:{tenantId:fixture.tenantId,target:id,action:'hub.token.reconciled'}}),1);
  const row=await tx.tokenQuotaReservation.findUnique({where:{id}});assert.equal(row.status,'settled');assert.equal(row.actualTokens,120n);
 });
});
test('real current administrator flag, role, authVersion and tenant all fail closed',async()=>{
 const id=fixture.records.unknown.id;
 const initial=await service.detail(fixture.admin,id);
 for(const data of [{isTenantAdmin:false},{role:'researcher'},{authVersion:1},{status:'disabled'}]){
  await transaction(tx=>tx.account.update({where:{id:fixture.admin.accountId},data}));
  await assert.rejects(()=>service.detail(fixture.admin,id),e=>[401,403].includes(e.status));
  await assert.rejects(()=>service.resolve(fixture.admin,id,{requestKey:randomUUID(),fingerprint:initial.fingerprint,action:'settle'}),e=>[401,403].includes(e.status));
  await transaction(tx=>tx.account.update({where:{id:fixture.admin.accountId},data:{isTenantAdmin:true,role:'tenant_admin',authVersion:0,status:'active'}}));
 }
 const crossTenant=createHubBilling({scope:{allowedTenantIds:['not-this-fixture']},transaction,billing:{}});
 await assert.rejects(()=>crossTenant.detail(fixture.admin,id),e=>e.status===401);
 await assert.rejects(()=>service.detail(fixture.user,id),e=>e.status===403);
 await assert.rejects(()=>service.detail(fixture.admin,'cmvn90m6x001elu7zahvpnrqd'),e=>e.status===404);
 await assert.rejects(()=>service.resolve(fixture.admin,id,{requestKey:randomUUID(),fingerprint:initial.fingerprint,action:'settle',tenantId:'other'}),e=>e.status===422);
 const d=await service.detail(fixture.admin,id);assert.equal(d.canSettle,false);assert.equal(d.canRelease,false);
 await assert.rejects(()=>service.resolve(fixture.admin,id,{requestKey:randomUUID(),fingerprint:d.fingerprint,action:'release'}),e=>e.status===422);
 const out=root+'researchhub/docs/testing/evidence/hub-token-accounting-2026-11-11/';mkdirSync(out,{recursive:true});writeFileSync(out+'committed-pg-'+fixture.tenantId+'.json',JSON.stringify({passed:true,syntheticOnly:true,fixture,checks:['two-connections-different-keys-one-usage','current-role-flag-version-status','cross-tenant-and-owner-denied','unknown-no-release'],paidCalls:0},null,2));
});
test('committed pre-dispatch protection beats old-expiry capacity race against original reserve',async()=>{
 const user=fixture.user,sessionId=fixture.tenantId+'-expiry-race';
 const binding=await transaction(async tx=>{
  await tx.session.create({data:{id:sessionId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,agentId:fixture.tenantId+'-agent'}});
  const message=await tx.message.create({data:{tenantId:user.tenantId,sessionId,role:'user',content:'[合成验收] 到期竞争，无模型调用'}});
  const job=await tx.knowledgeChatJob.create({data:{tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,sessionId,accountId:user.accountId,roleSnapshot:'researcher',requestKey:randomUUID(),text:'[合成验收] 到期竞争',payload:{},userMessageId:message.id,status:'processing',executionToken:randomUUID(),workerOwner:'fixture:expiry-race',leaseExpiresAt:new Date(Date.now()+120000)}});
  const row=await tx.tokenQuotaReservation.create({data:{tenantId:user.tenantId,accountId:user.accountId,requestKey:`chat:${sessionId}:${job.requestKey}`,reservedTokens:12288n,expiresAt:new Date(Date.now()+2000)}});
  return{user,reservationId:row.id,attemptId:randomUUID(),jobId:job.id,sessionId,claim:{executionToken:job.executionToken,workerOwner:job.workerOwner},model:'deepseek-v4-pro'};
 });
 const remaining=await transaction(async tx=>(await new BillingService({elevated:tx},{}).myTokenQuota(user)).effectiveRemainingTokens),requested=Math.floor((Number(remaining)+6000)/8);
 let started;const protectionStarted=new Promise(ok=>started=ok);
 const protection=transaction(async tx=>{await protectAttempt(tx,binding);started();await new Promise(ok=>setTimeout(ok,2300));});
 await protectionStarted;
 const native=new BillingService({elevated:{$transaction:transaction}},{});
 const second=native.reserveTokenQuota(user,requested,'capacity-race-'+randomUUID());
 await assert.rejects(()=>second,e=>e.getStatus?.()===429);await protection;
 await transaction(async tx=>{
  const row=await tx.tokenQuotaReservation.findUnique({where:{id:binding.reservationId}});assert.equal(row.status,'active');assert.equal(row.expiresAt.toISOString(),'9999-12-31T00:00:00.000Z');
  assert.equal((await new BillingService({elevated:tx},{}).myTokenQuota(user)).effectiveRemainingTokens,remaining);
 });
});
