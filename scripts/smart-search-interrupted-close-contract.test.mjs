import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./smart-search-interrupted-close-contract.mjs').catch(()=>({}));
const valid=()=>({job:{id:'cmwcw7u280005luyi1na8t4wf',tenantId:'t',accountId:'owner',studyGroupId:'g',researchProjectId:'p',sessionId:'s',requestKey:'q',status:'processing',assistantMessageId:null,executionToken:'token',workerOwner:'worker',leaseExpiresAt:new Date('2026-11-12T01:54:47Z')},reservation:{id:'cmwcw7utc0008luyicjlle5f9',tenantId:'t',accountId:'owner',requestKey:'chat:s:q',status:'active',reservedTokens:12288n,actualTokens:null,reconciliationUsageRecordId:null},ids:{tenant:'t',owner:'owner',group:'g',project:'p'},now:new Date('2026-11-12T03:00:00Z'),usage:{promptTokens:1803,completionTokens:470,totalTokens:2273,callCount:1,model:'deepseek-v4-pro'},trace:{jobId:'cmwcw7u280005luyi1na8t4wf',httpStatus:200,request:{model:'deepseek-v4-pro'},usage:{prompt_tokens:1803,completion_tokens:470,total_tokens:2273}}});
const check=value=>{assert.equal(typeof api.verifyInterruptedClose,'function');return api.verifyInterruptedClose(value);};
test('only the approved interrupted object and matching actual known usage can settle, never a release',()=>{assert.deepEqual(check(valid()),{actualTokens:2273,releasedTokens:10015});});
test('a live, completed, unclaimed, delivered, foreign or already settled object must not be mutated',()=>{
 for(const change of [{status:'completed'},{leaseExpiresAt:new Date('2027-01-01')},{executionToken:null},{workerOwner:null},{assistantMessageId:'delivered'},{id:'other'},{accountId:'admin'},{tenantId:'other'},{studyGroupId:'other'},{researchProjectId:'other'}]){const f=valid();Object.assign(f.job,change);assert.throws(()=>check(f));}
 for(const change of [{id:'other'},{status:'settled'},{reservedTokens:13000n},{accountId:'admin'},{requestKey:'old'},{reconciliationUsageRecordId:'existing'}]){const f=valid();Object.assign(f.reservation,change);assert.throws(()=>check(f));}
});
test('unknown, duplicated or mismatched Provider or durable usage never becomes zero-use cleanup',()=>{
 for(const change of [{totalTokens:0},{callCount:2},{promptTokens:1804},{model:'other'}]){const f=valid();Object.assign(f.usage,change);assert.throws(()=>check(f));}
 for(const change of [{jobId:'other'},{httpStatus:500},{usage:null}]){const f=valid();Object.assign(f.trace,change);assert.throws(()=>check(f));}
});
