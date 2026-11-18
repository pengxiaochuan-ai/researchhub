import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
const api=await import('./controller.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const origin='http://127.0.0.1:19501';
test('Hub controller sets no-store, delegates current principal and refuses cross-origin or injected identity',async()=>{
 assert.equal(typeof api.createHubBillingController,'function');let called=0;
 const service={resolve:async(user,id,input)=>{called++;assert.equal(user.accountId,'owner');assert.equal(id,'reservation');return{status:'settled'};},me:async()=>({effectiveRemainingTokens:'0'})};
 const C=api.createHubBillingController({require,origin,service}),c=new C(),headers={};
 const res={setHeader:(k,v)=>headers[k]=v},req={user:{accountId:'owner'},headers:{origin,host:'127.0.0.1:19501','content-type':'application/json'}};
 assert.deepEqual(await c.resolve(req,res,{}, {id:'reservation'},{}),{status:'settled'});assert.equal(headers['Cache-Control'],'no-store');
 await assert.rejects(()=>c.resolve({...req,headers:{...req.headers,origin:'https://evil.example'}},res,{}, {id:'reservation'},{}),e=>e.getStatus()===403);assert.equal(called,1);
 await assert.rejects(()=>c.resolve(req,res,{notes:'x'.repeat(5000)}, {id:'reservation'},{}),e=>e.getStatus()===413);
 const broken=api.createHubBillingController({require,origin,service:{me:()=>{throw Error('secret database path');}}});
 await assert.rejects(()=>new broken().me(req,res,null,{},{}),e=>e.getStatus()===503&&!JSON.stringify(e.getResponse()).includes('secret'));
});
