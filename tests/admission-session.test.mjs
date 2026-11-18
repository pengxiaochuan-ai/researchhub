import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAdmissionClient} from '../src/admission-session.js';
import {safeAuthenticatedReturnTo} from '../src/route-context.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';
test('admission return is exact and strips credential or duplicated parameter variants',()=>{
 for(const sanitize of [safeAuthenticatedReturnTo,safeSessionReturn]){
  assert.equal(sanitize('/pages/p006/?section=admission'),'/pages/p006/?section=admission');
  for(const bad of ['/pages/p006/?section=admission&token=secret','/pages/p006/?section=admission&section=research-identity','https://other.example/pages/p006/?section=admission'])assert.equal(sanitize(bad),'/pages/p01/');
 }
});
test('private status is no-store, bound to fixed Hub and never renews or submits',async()=>{
 const calls=[],client=createAdmissionClient({fetchImpl:async(url,init)=>{calls.push({url,init});return{ok:true,json:async()=>({accountId:'actor',id:'application',status:'pending',revision:1,material:{registration:{displayName:'合成申请人'}}})};}});
 assert.equal((await client.self()).status,'pending');assert.equal(calls[0].url,'/api/hubs/lingshu-xinyu/admission');assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.method,'GET');
});
test('proof reads contain no original text and canonical hash pins original body',async()=>{
 const {requestHash}=await import('../server/admission/policy.mjs');let target;
 const client=createAdmissionClient({fetchImpl:async url=>{target=url;const p=Object.fromEntries(new URL(url,'https://example.test').searchParams);return{ok:true,json:async()=>({...p,baseRevision:Number(p.baseRevision),revision:Number(p.baseRevision),requestKey:'original-key',state:'unsubmitted'})};}});
 const op={id:'application',body:{action:'needs_information',reason:'具体缺项',baseRevision:1,requestKey:'original-key'}};
 await client.operation(op);const q=new URL(target,'https://example.test').searchParams;
 assert.equal(target.includes(encodeURIComponent('具体缺项')),false);assert.equal(q.get('requestHash'),requestHash({id:op.id,...op.body,allowResubmit:false}));
});
test('a different committed receipt cannot clear the current unknown input',async()=>{
 const client=createAdmissionClient({fetchImpl:async()=>({ok:true,json:async()=>({state:'committed',requestKey:'another-key',applicationId:'application',action:'approve',baseRevision:1,requestHash:'0'.repeat(64),result:{status:'approved'}})})});
 await assert.rejects(client.operation({id:'application',body:{action:'approve',baseRevision:1,requestKey:'original-key'}}),/无法匹配/);
});
test('lost mutations stay unknown and reads never retry writes',async()=>{
 let n=0;const client=createAdmissionClient({fetchImpl:async()=>{n++;throw Error('offline');}});
 await assert.rejects(client.decide('application-1',{action:'approve',baseRevision:1,requestKey:'key-0000001'}),e=>e.unknown===true);
 await assert.rejects(client.operation('key-0000001'));assert.equal(n,2);
});
test('invalid status and server denial are not interpreted as approval or logout',async()=>{
 const client=createAdmissionClient({fetchImpl:async()=>({ok:true,json:async()=>({status:'yes'})})});await assert.rejects(client.self());
 const denied=createAdmissionClient({fetchImpl:async()=>({ok:false,status:403,json:async()=>({code:'HUB_ADMISSION_REQUIRED',message:'待审核'})})});
 await assert.rejects(denied.self(),e=>e.status===403&&e.code==='HUB_ADMISSION_REQUIRED');
});
test('malformed success cannot discard a pending mutation or unknown draft',async()=>{
 const client=createAdmissionClient({fetchImpl:async()=>({ok:true,json:async()=>({})})});
 await assert.rejects(client.decide('application',{action:'approve',baseRevision:1,requestKey:'original-key'}),e=>e.unknown===true);
 await assert.rejects(client.submit({action:'supplement',baseRevision:1,requestKey:'original-key',text:'材料'}),e=>e.unknown===true);
 const {requestHash}=await import('../server/admission/policy.mjs');
 const op={id:'application',body:{action:'approve',baseRevision:1,requestKey:'original-key'}};
 const receipt=createAdmissionClient({fetchImpl:async()=>({ok:true,json:async()=>({state:'committed',applicationId:op.id,action:'approve',baseRevision:1,requestKey:'original-key',requestHash:requestHash({id:op.id,...op.body,reason:'',allowResubmit:false}),result:{id:op.id,status:'approved',revision:999}})})});
 await assert.rejects(receipt.operation(op),/无法匹配/);
 await assert.rejects(client.list({status:'pending'}));await assert.rejects(client.detail('application'));
});
