import test from 'node:test';
import assert from 'node:assert/strict';
import {abortFaultTransaction} from './synthetic-edc-fault-guard.mjs';
test('fault fixture normal return always aborts inside transaction, never commits',async()=>{
 let committed=false,performed=false;const transaction=async callback=>{const value=await callback();committed=true;return value;};await assert.rejects(transaction(()=>abortFaultTransaction(async()=>{performed=true;return {actualWrite:true};})),/FAULT_INJECTION_NOT_TRIGGERED_ABORT_TRANSACTION/);assert(performed);assert.equal(committed,false);
});
test('injected error propagates unchanged and cannot be masked as missed injection',async()=>{
 const original=Error('WP06_INJECTED_AUDIT_FAILURE');await assert.rejects(abortFaultTransaction(async()=>{throw original;}),e=>e===original);
});
