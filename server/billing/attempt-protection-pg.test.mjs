import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';

const api=await import('./attempt-protection.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const {finishAttempt,sealExecution}=await import('./attempts.mjs');
const {blockExecution}=await import('./attempts.mjs');
const serviceApi=await import('./service.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {BillingService}=require('./src/billing/billing.service.ts');
const {env}=loadFixtureInput(new URL('../../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);

async function rollback(run){
 const sentinel=Error('HUB_BILLING_TEST_ROLLBACK'),tenantId='rh-token-'+randomUUID();
 await assert.rejects(()=>withFixtureTransaction(env,'direct',async tx=>{
  await tx.tenant.create({data:{id:tenantId,slug:tenantId,name:'具名合成Token回滚验收'}});
  const accountId=tenantId+'-owner',group=tenantId+'-group',project=tenantId+'-study',agent=tenantId+'-agent',sessionId=tenantId+'-session';
  await tx.account.create({data:{id:accountId,tenantId,username:'synthetic@example.test',displayName:'合成科研人员',passwordHash:'synthetic-unusable',role:'researcher'}});
  await tx.studyGroup.create({data:{id:group,tenantId,name:'合成组',slug:group}});
  await tx.researchProject.create({data:{id:project,tenantId,studyGroupId:group,code:project,name:'合成研究'}});
  await tx.agent.create({data:{id:agent,tenantId,key:'hub-billing-test',type:'research',name:'合成Agent',opencodeRoot:'synthetic-no-network'}});
  await tx.session.create({data:{id:sessionId,tenantId,studyGroupId:group,researchProjectId:project,accountId,agentId:agent}});
  const message=await tx.message.create({data:{tenantId,sessionId,role:'user',content:'仅合成计费测试，无真实模型请求'}});
  const job=await tx.knowledgeChatJob.create({data:{tenantId,studyGroupId:group,researchProjectId:project,sessionId,accountId,roleSnapshot:'researcher',requestKey:randomUUID(),text:'合成测试',payload:{},userMessageId:message.id,status:'processing',executionToken:randomUUID(),workerOwner:'hub-billing-b01',leaseExpiresAt:new Date(Date.now()+120000)}});
  const user={tenantId,accountId,authVersion:0,studyGroupId:group,researchProjectId:project};
  const reservation=await tx.tokenQuotaReservation.create({data:{tenantId,accountId,requestKey:'chat:'+sessionId+':'+job.requestKey,reservedTokens:12288n,expiresAt:new Date(Date.now()+60000)}});
  for(const account of [null,accountId])await tx.tokenQuotaGrant.create({data:{tenantId,accountId:account,scopeKey:account??'*',deltaTokens:20000n,reason:'具名合成事务测试，不进入体验账号'}});
  const binding={user,reservationId:reservation.id,attemptId:randomUUID(),jobId:job.id,sessionId,claim:{executionToken:job.executionToken,workerOwner:job.workerOwner},model:'deepseek-v4-pro'};
  await run({tx,binding,job,reservation,billing:new BillingService({elevated:tx},{})});throw sentinel;
 }),e=>e===sentinel);
 await withFixtureTransaction(env,'direct',async tx=>assert.equal(await tx.tenant.count({where:{id:tenantId}}),0),{readOnly:true});
}

test('B01 durable pre-dispatch protection remains counted by original quota and preserves original success CAS',async()=>{
 assert.equal(typeof api.protectAttempt,'function','missing durable pre-dispatch protection');
 await rollback(async({tx,binding,billing})=>{
  const event=await api.protectAttempt(tx,binding);
  assert.equal(event.meta.attemptId,binding.attemptId);
  const r=await tx.tokenQuotaReservation.findUnique({where:{id:binding.reservationId}});
  assert.equal(r.status,'active');assert.equal(r.expiresAt.toISOString(),'9999-12-31T00:00:00.000Z');
  assert.equal((await billing.myTokenQuota(binding.user)).effectiveRemainingTokens,'7712');
  await billing.settleTokenQuotaInTransaction(tx,binding.user,r.id,1200,false);
  assert.equal((await tx.tokenQuotaReservation.findUnique({where:{id:r.id}})).actualTokens,1200n);
 });
});

test('B01 current auth, real claim and expiry are checked before any durable dispatch begins',async()=>{
 assert.equal(typeof api.protectAttempt,'function','missing durable pre-dispatch protection');
 await rollback(async({tx,binding})=>{
  await assert.rejects(()=>api.protectAttempt(tx,{...binding,user:{...binding.user,authVersion:1}}),/HUB_TOKEN_ACCESS_DENIED/);
  await assert.rejects(()=>api.protectAttempt(tx,{...binding,claim:{...binding.claim,executionToken:'other'}}),/HUB_TOKEN_EXECUTION_CHANGED/);
  await tx.tokenQuotaReservation.update({where:{id:binding.reservationId},data:{expiresAt:new Date(0)}});
  await assert.rejects(()=>api.protectAttempt(tx,binding),/HUB_TOKEN_RESERVATION_EXPIRED/);
  assert.equal(await tx.auditLog.count({where:{tenantId:binding.user.tenantId,action:'hub.token.attempt.started'}}),0);
 });
});

test('real JSONB receipt replay and execution seal preserve one usage sample and reject a late dispatch',async()=>rollback(async({tx,binding})=>{
 const b={...binding,tenantId:binding.user.tenantId,accountId:binding.user.accountId,...binding.claim};
 const start=await api.protectAttempt(tx,binding);
 assert.equal((await api.protectAttempt(tx,binding)).id,start.id);
 const first=await finishAttempt(tx,b,{httpStatus:200,usage:{promptTokens:90,completionTokens:30,totalTokens:120}});
 const second=await finishAttempt(tx,b,{httpStatus:200,usage:{totalTokens:120,completionTokens:30,promptTokens:90}});
 assert.equal(second.id,first.id);
 const result=await sealExecution(tx,b);assert.equal(result.usage.totalTokens,120);assert.equal(result.usage.callCount,1);
 await assert.rejects(()=>api.protectAttempt(tx,{...binding,attemptId:randomUUID()}),/HUB_TOKEN_EXECUTION_SEALED/);
}));

test('original reserve cannot read an expired MVCC value while pre-dispatch protection has not committed',async()=>rollback(async({tx,binding})=>{
 await tx.tokenQuotaReservation.update({where:{id:binding.reservationId},data:{expiresAt:new Date(Date.now()+1000)}});
 await api.protectAttempt(tx,binding);
 await new Promise(resolve=>setTimeout(resolve,1100));
 const billing=new BillingService({elevated:{$transaction:cb=>withFixtureTransaction(env,'direct',async second=>{
  await second.$executeRawUnsafe("SET LOCAL lock_timeout = '150ms'");return cb(second);
 })}},{});
 await assert.rejects(()=>billing.reserveTokenQuota(binding.user,1536,'must-wait-'+randomUUID()),e=>e.meta?.code==='55P03');
}));

test('execution seal is visible and insertable under the actual project audit RLS',async()=>rollback(async({tx,binding,job})=>{
 await api.protectAttempt(tx,binding);
 const b={...binding,tenantId:binding.user.tenantId,accountId:binding.user.accountId,...binding.claim};
 await finishAttempt(tx,b,{httpStatus:200,usage:{promptTokens:90,completionTokens:30,totalTokens:120}});
 await tx.$executeRaw`SELECT set_config('app.tenant_id',${b.tenantId},true),set_config('app.research_project_id',${job.researchProjectId},true)`;
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
 const sealed=await sealExecution(tx,b);assert.equal(sealed.usage.totalTokens,120);
 assert.equal(await tx.auditLog.count({where:{tenantId:b.tenantId,target:b.reservationId,action:'hub.token.execution.sealed'}}),1);
 await tx.$executeRawUnsafe('RESET ROLE');
}));

test('tenant administrator settles verified failed consumption atomically and replay never debits twice',async()=>{
 assert.equal(typeof serviceApi.createHubBilling,'function','Hub tenant reconciliation missing');
 await rollback(async({tx,binding,billing,job})=>{
  const adminId=binding.user.tenantId+'-admin';
  await tx.account.create({data:{id:adminId,tenantId:binding.user.tenantId,username:'admin@example.test',displayName:'合成管理员',passwordHash:'synthetic-unusable',role:'tenant_admin',isTenantAdmin:true}});
  const admin={...binding.user,accountId:adminId};
  const service=serviceApi.createHubBilling({scope:{allowedTenantIds:[admin.tenantId]},transaction:cb=>cb(tx),billing});
  await api.protectAttempt(tx,binding);
  const b={...binding,tenantId:binding.user.tenantId,accountId:binding.user.accountId,...binding.claim};
  await finishAttempt(tx,b,{httpStatus:200,usage:{promptTokens:90,completionTokens:30,totalTokens:120}});await sealExecution(tx,b);
  await tx.knowledgeChatJob.update({where:{id:job.id},data:{status:'failed'}});
  const detail=await service.detail(admin,b.reservationId);assert.equal(detail.canSettle,true);
  assert.equal(detail.taskLabel,'合成测试');assert.equal(detail.attempts.length,1);assert.equal(detail.attempts[0].totalTokens,120);
  const request={requestKey:randomUUID(),fingerprint:detail.fingerprint,action:'settle'};
  const result=await service.resolve(admin,b.reservationId,request);assert.equal(result.actualTokens,120);
  const processed=await service.detail(admin,b.reservationId);assert.equal(processed.resolution.operatorName,'合成管理员');assert.equal(processed.resolution.actualTokens,'120');
  assert.equal((await service.resolve(admin,b.reservationId,request)).usageRecordId,result.usageRecordId);
  assert.equal(await tx.usageRecord.count({where:{tenantId:admin.tenantId}}),1);
  assert.equal((await billing.myTokenQuota(binding.user)).effectiveRemainingTokens,'19880');
  await assert.rejects(()=>service.detail(binding.user,b.reservationId),e=>e.status===403);
  await assert.rejects(()=>service.resolve(admin,b.reservationId,{...request,action:'release'}),e=>e.status===409);
 });
});

test('manual reconciliation refuses unknown, live, replaced executions and changed session requests',async()=>rollback(async({tx,binding,billing,job})=>{
 const adminId=binding.user.tenantId+'-admin';
 await tx.account.create({data:{id:adminId,tenantId:binding.user.tenantId,username:'admin@example.test',displayName:'合成管理员',passwordHash:'synthetic-unusable',role:'tenant_admin',isTenantAdmin:true}});
 const admin={...binding.user,accountId:adminId};
 const service=serviceApi.createHubBilling({scope:{allowedTenantIds:[admin.tenantId]},transaction:cb=>cb(tx),billing});
 await api.protectAttempt(tx,binding);
 const b={...binding,tenantId:binding.user.tenantId,accountId:binding.user.accountId,...binding.claim};
 assert.equal((await service.detail(admin,b.reservationId)).canSettle,false);
 await finishAttempt(tx,b,{httpStatus:200,usage:{promptTokens:90,completionTokens:30,totalTokens:120}});await sealExecution(tx,b);
 assert.equal((await service.detail(admin,b.reservationId)).canSettle,false,'live execution cannot be settled manually');
 await tx.knowledgeChatJob.update({where:{id:job.id},data:{status:'failed',executionToken:'replacement'}});
 assert.equal((await service.detail(admin,b.reservationId)).canSettle,false,'replaced claim must not accept old receipts');
 assert.equal(await service.settleFailure(binding.user,b.reservationId),null);
 await tx.knowledgeChatJob.update({where:{id:job.id},data:{executionToken:b.executionToken,requestKey:'changed-request'}});
 assert.equal((await service.detail(admin,b.reservationId)).canSettle,false,'real reservation request must still match');
}));

test('failed settlement rolls back usage and reservation if final audit fails',async()=>rollback(async({tx,binding,billing,job})=>{
 await api.protectAttempt(tx,binding);
 const b={...binding,tenantId:binding.user.tenantId,accountId:binding.user.accountId,...binding.claim};
 await finishAttempt(tx,b,{httpStatus:200,usage:{promptTokens:90,completionTokens:30,totalTokens:120}});await sealExecution(tx,b);
 await tx.knowledgeChatJob.update({where:{id:job.id},data:{status:'failed'}});
 const transaction=async cb=>{
  await tx.$executeRawUnsafe('SAVEPOINT hub_token_atomicity');
  const broken=new Proxy(tx,{get(target,key){if(key==='auditLog')return new Proxy(target.auditLog,{get(a,k){return k==='create'?()=>{throw Error('synthetic-audit-failure');}:a[k];}});return target[key];}});
  try{return await cb(broken);}catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT hub_token_atomicity');throw e;}
 };
 const service=serviceApi.createHubBilling({scope:{allowedTenantIds:[b.tenantId]},transaction,billing});
 await assert.rejects(()=>service.settleFailure(binding.user,b.reservationId),/synthetic-audit-failure/);
 assert.equal(await tx.usageRecord.count({where:{tenantId:b.tenantId}}),0);
 assert.equal((await tx.tokenQuotaReservation.findUnique({where:{id:b.reservationId}})).status,'active');
}));
test('durable usage inconsistency prevents both automatic and later manual settlement',async()=>rollback(async({tx,binding,billing,job})=>{
 assert.equal(typeof blockExecution,'function');await api.protectAttempt(tx,binding);
 const b={...binding,tenantId:binding.user.tenantId,accountId:binding.user.accountId,...binding.claim};
 await finishAttempt(tx,b,{httpStatus:200,usage:{promptTokens:90,completionTokens:30,totalTokens:120}});
 await blockExecution(tx,b);assert.equal((await sealExecution(tx,b)).usage,null);
 await tx.knowledgeChatJob.update({where:{id:job.id},data:{status:'failed'}});
 const adminId=b.tenantId+'-admin';await tx.account.create({data:{id:adminId,tenantId:b.tenantId,username:'admin@example.test',displayName:'合成管理员',passwordHash:'synthetic-unusable',role:'tenant_admin',isTenantAdmin:true}});
 const service=serviceApi.createHubBilling({scope:{allowedTenantIds:[b.tenantId]},transaction:cb=>cb(tx),billing});
 assert.equal(await service.settleFailure(binding.user,b.reservationId),null);
 assert.equal((await service.detail({...binding.user,accountId:adminId},b.reservationId)).canSettle,false);
 assert.equal(await tx.usageRecord.count({where:{tenantId:b.tenantId}}),0);
}));
test('known consumption after revocation settles actual amount even above reservation, never delivers an answer',async()=>rollback(async({tx,binding,billing,job})=>{
 await api.protectAttempt(tx,binding);const b={...binding,tenantId:binding.user.tenantId,accountId:binding.user.accountId,...binding.claim};
 await finishAttempt(tx,b,{httpStatus:200,usage:{promptTokens:20000,completionTokens:2000,totalTokens:22000}});await sealExecution(tx,b);
 await tx.account.update({where:{id:b.accountId},data:{status:'disabled',authVersion:1}});
 await tx.knowledgeChatJob.update({where:{id:job.id},data:{status:'failed'}});
 const service=serviceApi.createHubBilling({scope:{allowedTenantIds:[b.tenantId]},transaction:cb=>cb(tx),billing});
 const settled=await service.settleFailure(binding.user,b.reservationId);assert.equal(settled.actualTokens,22000);
 assert.equal((await billing.myTokenQuota(binding.user)).effectiveRemainingTokens,'0');
 assert.equal(await tx.message.count({where:{tenantId:b.tenantId,role:'assistant'}}),0);
 assert.equal((await tx.knowledgeChatJob.findUnique({where:{id:job.id}})).status,'failed');
}));
