import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createBusinessAiQuota} from './business-ai-quota.mjs';
import {runBusinessProvider,assertBusinessProviderOutcome} from './business-ai-provider.mjs';

const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {BillingService}=require('./src/billing/billing.service.ts');
const {estimateRunTokenBudget}=require('./src/billing/token-quota-policy.ts');
const {UsageAccumulator}=require('./src/orchestrator/usage-accumulator.ts');
const {ModelOutcomeUnknownError}=require('./src/orchestrator/deepseek.provider.ts');
const {requiresProviderReconciliation}=require('./src/sessions/sessions.service.ts');
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const marker='rh-token-policy-'+randomUUID();
test('real original BillingService enforces shared tenant reservation, account allocation, settlement and unknown usage; all new rows roll back',async()=>{
  assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
  await assert.rejects(withFixtureTransaction(env,'direct',async db=>{
    const tenantId=marker,ownerId=marker+'-owner',adminId=marker+'-admin';
    await db.tenant.create({data:{id:tenantId,slug:tenantId,name:'Disposable synthetic Token policy test'}});
    for(const [id,role]of [[ownerId,'researcher'],[adminId,'tenant_admin']])await db.account.create({data:{id,tenantId,username:id+'@example.invalid',displayName:'Synthetic quota test',passwordHash:'not-a-login-credential',role}});
    await db.tokenQuotaGrant.create({data:{tenantId,scopeKey:'*',deltaTokens:30000n,idempotencyKey:marker}});
    const elevated=new Proxy(db,{get(target,key){if(key==='$transaction')return fn=>fn(db);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
    const billing=new BillingService({elevated,forTenant:()=>db},{}),quota=createBusinessAiQuota({billing,estimateRunTokenBudget});
    const owner={tenantId,accountId:ownerId,role:'researcher'},admin={tenantId,accountId:adminId,role:'tenant_admin'};
    assert.equal((await quota.status(owner)).canStart,true);
    const first=await billing.reserveTokenQuota(owner,1536,marker+'-one');
    assert.equal(first.reservedTokens,'12288');
    await billing.reserveTokenQuota(admin,1536,marker+'-two');
    assert.equal((await quota.status(owner)).effectiveRemainingTokens,'5424');
    assert.equal((await quota.status(admin)).canStart,false);
    await assert.rejects(billing.reserveTokenQuota(owner,1536,marker+'-three'),e=>e.getResponse?.()?.code==='TOKEN_QUOTA_EXCEEDED');
    await assert.rejects(billing.reserveTokenQuota(owner,1536,marker+'-one'),e=>e.getResponse?.()?.code==='REQUEST_IN_PROGRESS');
    // Synthetic usage exists only in this rollback transaction, never a Provider request.
    await db.usageRecord.create({data:{tenantId,accountId:ownerId,model:'FREE_BILLING_TEST_NOT_PROVIDER',promptTokens:900,completionTokens:300,totalTokens:1200,usedMock:false}});
    await billing.settleTokenQuotaInTransaction(db,owner,first.id,1200,false);
    const settled=await db.tokenQuotaReservation.findUnique({where:{id:first.id}});
    assert.equal(settled.status,'settled');assert.equal(settled.actualTokens,1200n);
    assert.equal((await quota.status(owner)).effectiveRemainingTokens,'16512');
    await db.tokenQuotaGrant.create({data:{tenantId,accountId:ownerId,scopeKey:ownerId,deltaTokens:2000n,idempotencyKey:marker+'-account'}});
    assert.equal((await quota.status(owner)).effectiveRemainingTokens,'800');
    assert.equal((await quota.status(owner)).canStart,false);
    const second=await db.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId,requestKey:marker+'-two'}}});
    await billing.holdTokenQuotaForReconciliation(admin,second.id,{reason:'Synthetic unknown-usage test',source:'free-business-quota-test',requestKey:marker+'-two'});
    assert.equal((await db.tokenQuotaReservation.findUnique({where:{id:second.id}})).status,'reconciliation_required');
    assert.equal((await billing.myTokenQuota(admin)).tenant.reservedTokens,'12288');
    // Real native failure accounting with FREE Provider doubles. No caller quota
    // is modified: this tenant and all reservations are rolled back below.
    await db.tokenQuotaGrant.create({data:{tenantId,scopeKey:'*',deltaTokens:100000n,idempotencyKey:marker+'-failure-branches'}});
    for(const scenario of ['unknown','invalid-json','source-revoked','truncated']){
      const held=await billing.reserveTokenQuota(admin,1536,marker+'-'+scenario),partial=[],turn={};
      const cause=scenario==='unknown'?new ModelOutcomeUnknownError('free-negative',{model:'deepseek-v4-pro',fallbackIndex:0}):Error(scenario);
      try{await runBusinessProvider(turn,async()=>{if(scenario==='unknown')throw cause;return{text:'free synthetic output',usedMock:false,usage:{model:'deepseek-v4-pro',promptTokens:900,completionTokens:300,totalTokens:1200}};},{validate:()=>{throw cause;},recordRejectedUsage:r=>new UsageAccumulator(s=>partial.push(s)).addDeepseek(r.usage)});}catch{}
      let actual;try{assertBusinessProviderOutcome(turn);}catch(e){actual=e;}
      assert.equal(actual,cause);assert.equal(requiresProviderReconciliation(actual,partial),true);
      await billing.holdTokenQuotaForReconciliation(admin,held.id,{reason:actual.message,source:'free-business-quota-negative',requestKey:marker+'-'+scenario,partialUsage:partial});
      const row=await db.tokenQuotaReservation.findUnique({where:{id:held.id}});
      assert.equal(row.status,'reconciliation_required');assert.equal(row.reservedTokens,12288n);
      assert.equal(partial.reduce((n,s)=>n+s.totalTokens,0),scenario==='unknown'?0:1200);
    }
    throw Error('BUSINESS_QUOTA_EXPECTED_ROLLBACK');
  }),/BUSINESS_QUOTA_EXPECTED_ROLLBACK/);
  await withFixtureTransaction(env,'direct',async db=>{
    assert.equal(await db.tenant.count({where:{id:marker}}),0);
    assert.equal(await db.usageRecord.count({where:{tenantId:marker}}),0);
    assert.equal(await db.tokenQuotaReservation.count({where:{tenantId:marker}}),0);
  },{readOnly:true});
});
