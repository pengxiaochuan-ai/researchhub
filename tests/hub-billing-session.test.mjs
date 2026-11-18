import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/hub-billing-session.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('billing client sends same-origin JSON and never retries an uncertain write',async()=>{
 assert.equal(typeof api.createHubBillingClient,'function');const calls=[];
 const client=api.createHubBillingClient({fetchImpl:async(url,init)=>{calls.push({url,init});throw Error('lost response');}});
 const input={requestKey:'request-key',fingerprint:'a'.repeat(64),action:'settle'};
 await assert.rejects(()=>client.resolve('reservation',input),e=>e.uncertain===true&&e.status===503);
 assert.equal(calls.length,1);assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.headers['X-ResearchHub-Request'],'session-v1');assert.deepEqual(JSON.parse(calls[0].init.body),input);
});
test('identity invalidation discards a late 200 and business403 does not invoke logout',async()=>{
 let respond;const c=api.createHubBillingClient({fetchImpl:()=>new Promise(r=>respond=r)}),r=c.list({page:1,status:'pending'});
 c.invalidate();respond(new Response(JSON.stringify({items:[],page:1,total:0,pageSize:20})));
 await assert.rejects(()=>r,e=>e.name==='AbortError');
 const denied=api.createHubBillingClient({fetchImpl:async()=>new Response(JSON.stringify({code:'HUB_TOKEN_FORBIDDEN',message:'当前账号无权处理用量对账。'}),{status:403})});
 await assert.rejects(()=>denied.list({page:1,status:'pending'}),e=>e.status===403&&e.message.includes('无权'));
});
