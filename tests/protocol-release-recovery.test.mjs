import test from 'node:test';import assert from 'node:assert/strict';
import {readReleaseReceipt} from '../src/protocol-release-recovery.js';
test('checking an unknown approval is GET only, missing result does not resubmit',async()=>{
 const root='/research-studies/s/protocols/p',pending={path:root+'/approve',method:'POST',body:{requestKey:'original-key',expectedRevision:'a'.repeat(64),policyVersionId:'policy',expectedPolicyHash:'b'.repeat(64)}},calls=[];
 assert.deepEqual(await readReleaseReceipt(async(path,options)=>{calls.push([path,options]);return{found:false};},root,pending),{found:false});
 assert.deepEqual(calls,[[root+'/release-receipts/original-key?action=approve',undefined]]);
 const success={found:true,result:{receipt:{requestKey:'original-key',action:'protocol.approve',targetId:'p'}}};
 assert.deepEqual(await readReleaseReceipt(async()=>success,root,pending),success);
 await assert.rejects(readReleaseReceipt(()=>{throw Error('must not run');},root,{...pending,path:'/foreign/approve'}));
 await assert.rejects(readReleaseReceipt(async()=>({found:true,result:{receipt:{requestKey:'wrong'}}}),root,pending));
});
