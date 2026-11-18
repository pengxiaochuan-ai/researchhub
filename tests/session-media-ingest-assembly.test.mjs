import test from'node:test';import assert from'node:assert/strict';
const api=await import('../scripts/ai-session-media-ingest-assembly.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
test('registration assembly failure keeps the original archive service and reports a safe unavailable state',async()=>{
 assert(api,'registration-only assembly isolation missing');
 const archive={service:{upload:()=>true},Controllers:[class Archive{}]},original=archive.service,logs=[];
 const result=await api.assembleMediaRegistration({create:async()=>{throw Error('/private/secret-config.json password=sensitive');},options:{},log:line=>logs.push(line)});
 archive.ingests=result.service;archive.registrationState=result.status;
 assert.equal(archive.service,original);assert.equal(archive.service.upload(),true);assert.equal(archive.Controllers.length,1);
 assert.equal(result.status,'unavailable');assert.equal(result.service,null);assert.deepEqual(result.Controllers,[]);assert.equal(result.limitedReadInTx,undefined);
 assert.equal(logs.length,1);assert.equal(logs[0].includes('sensitive'),false);assert.equal(logs[0].includes('/private'),false);
});
test('successful assembly retains real registration controllers and scoped read bridge',async()=>{
 assert(api,'registration assembly missing');const service={},Controllers=[class Registration{}],limitedReadInTx=()=>{};
 const result=await api.assembleMediaRegistration({create:async()=>({service,Controllers,limitedReadInTx}),options:{},log:()=>assert.fail('unexpected warning')});
 assert.equal(result.status,'available');assert.equal(result.service,service);assert.equal(result.Controllers,Controllers);assert.equal(result.limitedReadInTx,limitedReadInTx);
});
