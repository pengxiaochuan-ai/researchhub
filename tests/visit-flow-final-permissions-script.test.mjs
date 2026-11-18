import test from 'node:test';
import assert from 'node:assert/strict';
import {
 requirePermissionsWindow,rollbackOnly,assertUnchangedSnapshots,
} from '../scripts/visit-flow-final-permissions-pg.mjs';

test('permission probe rejects execution without the exact explicit local window',()=>{
 assert.throws(()=>requirePermissionsWindow(['--local-synthetic','--rollback-only'],{}),/EXPLICIT_FINAL_VISIT_WINDOW_REQUIRED/);
 assert.throws(()=>requirePermissionsWindow(['--local-synthetic','--browser'],{VISIT_FLOW_FINAL_QA_WINDOW:'explicit'}));
 assert.throws(()=>requirePermissionsWindow(['--local-synthetic','--rollback-only','--resume'],{VISIT_FLOW_FINAL_QA_WINDOW:'explicit'}));
 assert.doesNotThrow(()=>requirePermissionsWindow(['--local-synthetic','--rollback-only'],{VISIT_FLOW_FINAL_QA_WINDOW:'explicit'}));
});

test('successful probe work always aborts its transaction instead of returning a committable result',async()=>{
 const ledger=[];
 const transact=async callback=>{try{await callback({});ledger.push('commit');}catch(error){ledger.push('rollback');throw error;}};
 const value=await rollbackOnly(transact,async()=>({permissionDenied:true}));
 assert.deepEqual(value,{permissionDenied:true});
 assert.deepEqual(ledger,['rollback']);
});

test('a failed probe rolls back and preserves its actual failure instead of reporting success',async()=>{
 const failure=Error('permission assertion failed');
 const transact=async callback=>callback({});
 await assert.rejects(rollbackOnly(transact,async()=>{throw failure;}),error=>error===failure);
});

test('a transaction wrapper swallowing the abort is a failure, never a successful rollback',async()=>{
 await assert.rejects(rollbackOnly(async callback=>{try{await callback({});}catch{}},async()=>({done:true})),/ROLLBACK_NOT_OBSERVED/);
});

test('rollback proof rejects any changed project row, original account or role hash',()=>{
 const before={projectTables:[{table:'form_response',rows:['original']}],authority:{accounts:['account-hash'],roles:['role-hash']}};
 assert.doesNotThrow(()=>assertUnchangedSnapshots(before,structuredClone(before)));
 for(const after of [
  {...before,projectTables:[{table:'form_response',rows:['new-row']}]},
  {...before,authority:{...before.authority,accounts:['changed-account']}},
  {...before,authority:{...before.authority,roles:['changed-role']}},
 ])assert.throws(()=>assertUnchangedSnapshots(before,after),/ROLLBACK_STATE_CHANGED/);
});
