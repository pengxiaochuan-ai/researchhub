import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./runtime.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(options={}){
 const calls=[],turn={user:{tenantId:'tenant',accountId:'owner'},sessionId:'session',jobId:'job',execution:{claim:{executionToken:'claim',workerOwner:'host:1'}}};
 const reservations=[];const native={reserveTokenQuota:async(_user,...args)=>{reservations.push(args);return{id:'reservation'};},releaseTokenQuota:async()=>calls.push('release'),holdTokenQuotaForReconciliation:async()=>calls.push('hold'),settleTokenQuotaInTransaction:async()=>calls.push('native-success')};
 let usage={promptTokens:90,completionTokens:30,totalTokens:120,callCount:1,model:'deepseek-v4-pro',byModel:{'deepseek-v4-pro':{prompt:90,completion:30,total:120,calls:1}}};
 const ledger={protect:async()=>{calls.push('start');if(options.protectError)throw Error(options.protectError);},finish:async(_tx,_b,r)=>calls.push(r.httpStatus===200?'receipt':'unknown'),seal:async()=>{calls.push('seal');return{usage};},block:async()=>{calls.push('blocked');usage=null;}};
 const service={settleFailure:async()=>{calls.push('failed-settle');return usage?{}:null;}};
 const runtime=api.createAccountedRuntime({native,service,context:{getStore:()=>turn},transaction:async cb=>{const result=await cb({});if(options.loseProtectionCommit&&calls.at(-1)==='start')throw Error('lost commit ack');return result;},authorize:async()=>calls.push('authorize'),ledger,reservationMaxTokens:options.reservationMaxTokens});
 return{runtime,turn,calls,reservations,unknown:()=>{usage=null;}};
}
test('an evidence adapter can enlarge only its native reservation input, leaving other turns and settlement unchanged',async()=>{
 const f=fixture({reservationMaxTokens:({turn,requestedMaxTokens})=>turn.privateMaterials?5000:requestedMaxTokens});
 await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'normal');assert.deepEqual(f.reservations[0],[1536,'normal']);
 f.turn.privateMaterials={packHash:'synthetic'};await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'private');assert.deepEqual(f.reservations[1],[5000,'private']);
 const invalid=fixture({reservationMaxTokens:()=>100});await assert.rejects(invalid.runtime.billing.reserveTokenQuota(invalid.turn.user,1536,'invalid'),/HUB_TOKEN_RESERVATION_INPUT/);assert.equal(invalid.reservations.length,0);
});
test('dispatch commits protection before HTTP and stores every HTTP attempt before returning',async()=>{
 assert.equal(typeof api.createAccountedRuntime,'function');const f=fixture();
 await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'request');
 f.turn.tokenExecution.resultUsage={promptTokens:90,completionTokens:30,totalTokens:120,callCount:1,primaryModel:'deepseek-v4-pro',byModel:{'deepseek-v4-pro':{prompt:90,completion:30,total:120,calls:1,cost:123}}};
 await f.runtime.dispatch(async()=>{f.calls.push('http');return new Response(JSON.stringify({usage:{prompt_tokens:90,completion_tokens:30,total_tokens:120}}));});
 assert.deepEqual(f.calls,['authorize','start','http','receipt']);
 await f.runtime.billing.settleTokenQuotaInTransaction({},f.turn.user,'reservation',120,false);
 assert.deepEqual(f.calls.slice(-2),['seal','native-success']);
});
test('known failed delivery settles once through catch; unknown never releases; pre-dispatch still uses native release',async()=>{
 const f=fixture();await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'request');
 await f.runtime.billing.releaseTokenQuota(f.turn.user,'reservation');assert.deepEqual(f.calls,['release']);f.calls.length=0;
 await f.runtime.dispatch(async()=>new Response(JSON.stringify({usage:{prompt_tokens:90,completion_tokens:30,total_tokens:120}})));
 await f.runtime.billing.holdTokenQuotaForReconciliation(f.turn.user,'reservation',{});
 assert.deepEqual(f.calls.slice(-2),['seal','failed-settle']);assert.ok(!f.calls.includes('release'));
 const g=fixture();await g.runtime.billing.reserveTokenQuota(g.turn.user,1536,'request');g.unknown();
 await assert.rejects(()=>g.runtime.dispatch(async()=>{throw Error('network');}),/network/);
 await g.runtime.billing.releaseTokenQuota(g.turn.user,'reservation');
 assert.deepEqual(g.calls.slice(-3),['seal','failed-settle','hold']);assert.ok(!g.calls.includes('release'));
});
test('unknown or mismatched receipts forbid native success; missing binding forbids HTTP',async()=>{
 const f=fixture();await assert.rejects(()=>f.runtime.dispatch(async()=>{throw Error('MUST_NOT_SEND');}),/HUB_TOKEN_CONTEXT_REQUIRED/);
 await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'request');
 await f.runtime.dispatch(async()=>new Response(JSON.stringify({usage:{prompt_tokens:90,completion_tokens:30,total_tokens:120}})));
 await assert.rejects(()=>f.runtime.billing.settleTokenQuotaInTransaction({},f.turn.user,'reservation',119,false),/HUB_TOKEN_USAGE_MISMATCH/);
 f.unknown();await assert.rejects(()=>f.runtime.billing.settleTokenQuotaInTransaction({},f.turn.user,'reservation',120,false),/HUB_TOKEN_USAGE_MISMATCH/);
 assert.ok(!f.calls.includes('native-success'));
});
test('lost protection commit response cannot turn a possibly dispatched reservation into free release',async()=>{
 const f=fixture({loseProtectionCommit:true});await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'request');
 await assert.rejects(()=>f.runtime.dispatch(async()=>{throw Error('MUST_NOT_SEND');}),/lost commit ack/);
 await f.runtime.billing.releaseTokenQuota(f.turn.user,'reservation');
 assert.ok(!f.calls.includes('release'));
});
test('matching totals do not hide a different native call count or usage breakdown',async()=>{
 const f=fixture();await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'request');
 await f.runtime.dispatch(async()=>new Response(JSON.stringify({usage:{prompt_tokens:90,completion_tokens:30,total_tokens:120}})));
 f.turn.tokenExecution.resultUsage={promptTokens:89,completionTokens:31,totalTokens:120,callCount:2};
 await assert.rejects(()=>f.runtime.billing.settleTokenQuotaInTransaction({},f.turn.user,'reservation',120,false),/HUB_TOKEN_USAGE_MISMATCH/);
 assert.ok(!f.calls.includes('native-success'));
 await f.runtime.billing.holdTokenQuotaForReconciliation(f.turn.user,'reservation',{});
 assert.ok(f.calls.includes('blocked'));assert.ok(!f.calls.includes('failed-settle'),'inconsistency cannot be auto-settled');assert.equal(f.calls.at(-1),'hold');
});
test('success compares per-model counters and primary model without changing native cost estimate',async()=>{
 const f=fixture();await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'request');
 await f.runtime.dispatch(async()=>new Response(JSON.stringify({usage:{prompt_tokens:90,completion_tokens:30,total_tokens:120}})));
 f.turn.tokenExecution.resultUsage={promptTokens:90,completionTokens:30,totalTokens:120,callCount:1,primaryModel:'other-model',byModel:{'other-model':{prompt:90,completion:30,total:120,calls:1}}};
 await assert.rejects(()=>f.runtime.billing.settleTokenQuotaInTransaction({},f.turn.user,'reservation',120,false),/HUB_TOKEN_USAGE_MISMATCH/);
});
test('deterministic first protection refusal before HTTP uses native zero-consumption release',async()=>{
 const f=fixture({protectError:'HUB_TOKEN_RESERVATION_EXPIRED'});await f.runtime.billing.reserveTokenQuota(f.turn.user,1536,'request');
 await assert.rejects(()=>f.runtime.dispatch(async()=>{throw Error('MUST_NOT_SEND');}),/HUB_TOKEN_RESERVATION_EXPIRED/);
 await f.runtime.billing.releaseTokenQuota(f.turn.user,'reservation');assert.equal(f.calls.at(-1),'release');assert.ok(!f.calls.includes('hold'));
});
