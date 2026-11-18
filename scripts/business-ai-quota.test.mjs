import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './business-ai-quota.mjs';

const user={tenantId:'synthetic-tenant',accountId:'synthetic-owner'};
const snapshot=remaining=>({tenant:{allocatedTokens:'100000',usedTokens:'1000',reservedTokens:'2000',remainingTokens:'97000'},account:{allocatedTokens:'30000',usedTokens:'1000',reservedTokens:'2000',remainingTokens:String(remaining)},effectiveRemainingTokens:String(remaining)});
function fixture(remaining=20000){
  const calls=[],billing={myTokenQuota:async u=>{calls.push(['read',u]);return snapshot(remaining);},assertTokenQuota:async(u,n)=>{calls.push(['assert',u,n]);if(remaining<n)throw Object.assign(new Error('当前 Token 额度不足'),{status:429});}};
  return{calls,billing,quota:api.createBusinessAiQuota({billing,estimateRunTokenBudget:n=>BigInt(n)*8n})};
}
test('business quota uses existing tenant/account snapshot and original full-run estimate without development budgets',async()=>{
  const f=fixture(),s=await f.quota.status(user);
  assert.equal(s.canStart,true);assert.equal(s.blocked,false);assert.equal(s.requiredTokens,'12288');assert.equal(s.effectiveRemainingTokens,'20000');
  for(const key of ['limitMicroCny','priceValidUntil','requestLimit','approvalHash'])assert.equal(Object.hasOwn(s,key),false);
  assert.deepEqual(f.calls,[['read',user]]);
});
test('quota boundary is inclusive and later business reservation remains authoritative',async()=>{
  assert.equal((await fixture(12288).quota.status(user)).canStart,true);
  const f=fixture(12287),s=await f.quota.status(user);assert.equal(s.canStart,false);assert.equal(s.code,'TOKEN_QUOTA_EXCEEDED');
  await assert.rejects(f.quota.assert(user),/Token/);assert.deepEqual(f.calls.at(-1),['assert',user,12288]);
});
test('status failure and malformed quota fail closed without preventing history reads or inventing zero balance',async()=>{
  for(const result of [null,{effectiveRemainingTokens:null},{effectiveRemainingTokens:'-1'},{effectiveRemainingTokens:'invalid'}]){
    const f=fixture();f.billing.myTokenQuota=async()=>result;const s=await f.quota.status(user);
    assert.equal(s.canStart,false);assert.equal(s.code,'TOKEN_QUOTA_UNAVAILABLE');assert.equal(s.effectiveRemainingTokens,undefined);
  }
  const f=fixture();f.billing.myTokenQuota=async()=>{throw Error('database private detail');};const s=await f.quota.status(user);
  assert.equal(s.blocked,true);assert(!s.message.includes('private detail'));
});
test('each status is actor-specific and fresh, never shared across accounts',async()=>{
  const f=fixture();f.billing.myTokenQuota=async u=>snapshot(u.accountId===user.accountId?20000:0);
  assert.equal((await f.quota.status(user)).canStart,true);
  assert.equal((await f.quota.status({...user,accountId:'other-account'})).canStart,false);
});
