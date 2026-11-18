import test from 'node:test';import assert from 'node:assert/strict';
import {realModeRouteState} from '../src/real-mode-route.js';
const api=await import('../src/governance-system-session.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('real G05 is live and canonicalizes only a safe optional record; demo is untouched',()=>{
 assert.equal(realModeRouteState('g05','',{configured:true}),'live');assert.equal(typeof api.systemConfigTarget,'function');
 assert.equal(api.systemConfigTarget('g05','?record=abc-1&tenantId=other',{configured:true}),'/pages/g02/?view=token-reconciliation&record=abc-1');
 assert.equal(api.systemConfigTarget('g05','?record=../../bad',{configured:true}),'/pages/g02/?view=token-reconciliation');
 assert.equal(api.systemConfigTarget('g05','',{configured:true,explicitDemo:true}),null);assert.equal(api.systemConfigTarget('g02','',{configured:true}),null);
});
test('status client is read-only no-store and invalidation drops a late success',async()=>{
 assert.equal(typeof api.createGovernanceSystemClient,'function');let resolve;const client=api.createGovernanceSystemClient({fetchImpl:async(path,init)=>{assert.equal(path,'/api/governance-system/status');assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'same-origin');return new Promise(ok=>resolve=ok);}});
 const p=client.status();client.invalidate();resolve({ok:true,json:async()=>({schema:'hub-system-status.v1',services:[]})});await assert.rejects(()=>p,{name:'AbortError'});
});
test('network failure is not signout and arbitrary server diagnostics are suppressed',async()=>{
 assert.equal(typeof api.createGovernanceSystemClient,'function');
 for(const fetchImpl of [async()=>{throw Error('secret');},async()=>({ok:false,status:500,json:async()=>({message:'SECRET',stack:'secret'})})])await assert.rejects(()=>api.createGovernanceSystemClient({fetchImpl}).status(),e=>e.status===503&&!e.message.includes('SECRET')&&!e.message.includes('secret'));
});
test('malformed status response cannot become a misleading empty or broken service table',async()=>{
 for(const services of [[],[null],Array(5).fill({key:'ai',configuration:'configured',check:{status:'unknown',checkedAt:null}})]){
  const client=api.createGovernanceSystemClient({fetchImpl:async()=>({ok:true,json:async()=>({schema:'hub-system-status.v1',observedAt:new Date().toISOString(),services})})});await assert.rejects(()=>client.status(),{status:503});
 }
});
test('HTTP401 and403 retain their meaning even with an empty or nonJSON body',async()=>{
 for(const status of [401,403]){let parsed=false;const client=api.createGovernanceSystemClient({fetchImpl:async()=>({ok:false,status,json:async()=>{parsed=true;throw new SyntaxError('empty');}})});await assert.rejects(()=>client.status(),{status});assert.equal(parsed,false);}
});
