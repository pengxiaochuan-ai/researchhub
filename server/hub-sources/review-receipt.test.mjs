import test from 'node:test';
import assert from 'node:assert/strict';
import * as receipt from './review-receipt.mjs';

const principal={accountId:'admin-synthetic',tenantId:'tenant-synthetic',authVersion:1};
const input={kind:'external',documentId:'document-synthetic',visibility:'tenant',expectedFingerprint:'a'.repeat(64),operationId:'00000000-0000-4000-8000-000000000001'};
function database(){const rows=new Map();const bindings=[];return{rows,bindings,account:{findFirst:async()=>({id:principal.accountId})},$executeRaw:async(strings,...values)=>{if(strings.join('?').includes("set_config('app.account_id'")){bindings.push(values);return 1;}assert(strings.join('?').includes('INSERT INTO public.audit_log'));const[id,tenantId,accountId,action,target,meta]=values;assert(!rows.has(id));rows.set(id,{id,tenantId,accountId,action,target,meta:JSON.parse(meta)});return 1;},$queryRaw:async(strings,...values)=>{const sql=strings.join('?');if(sql.includes('review_grant_event'))return[{decision:'grant'}];if(sql.includes('read_review_receipt')){const row=rows.get(values[4]);return row&&row.tenantId===values[0]&&row.accountId===values[2]?[{meta:row.meta}]:[];}return[];}};}
const args=db=>({db,principal,tenantId:principal.tenantId,hubKey:'lingshu-xinyu',reviewerAccountId:principal.accountId});

test('original request receipt replays one real service result and rejects changed content on the same key',async()=>{
 const db=database();let calls=0;
 const submit=()=>{calls++;return{visibility:'tenant',documentId:input.documentId,confirmedCount:1};};
 const a=await receipt.submitWithReviewReceipt({...args(db),kind:'external',input},submit);
 const b=await receipt.submitWithReviewReceipt({...args(db),kind:'external',input:{...input}},submit);
 assert.deepEqual(b,a);assert.equal(calls,1);assert.equal(db.rows.size,1);assert.deepEqual(db.bindings[0],[principal.accountId,String(principal.authVersion)]);
 await assert.rejects(()=>receipt.submitWithReviewReceipt({...args(db),kind:'external',input:{...input,visibility:'public'}},submit),/HUB_SOURCE_REQUEST_KEY_CONFLICT/);
 assert.equal(calls,1);
 assert.deepEqual(await receipt.readReviewReceipt({...args(db),operationId:input.operationId}),{kind:'external',input,review:a});
});

test('receipt recovery checks current reviewer, never grants access from a request identifier',async()=>{
 const db=database();await receipt.submitWithReviewReceipt({...args(db),kind:'external',input},async()=>({visibility:'tenant'}));
 db.account.findFirst=async()=>null;
 await assert.rejects(()=>receipt.readReviewReceipt({...args(db),operationId:input.operationId}),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
 await assert.rejects(()=>receipt.submitWithReviewReceipt({...args(db),kind:'external',input},async()=>assert.fail('must not submit')),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
});

test('missing, foreign and malformed receipts never become successful review results',async()=>{
 const db=database();
 await assert.rejects(()=>receipt.readReviewReceipt({...args(db),operationId:input.operationId}),/HUB_SOURCE_RECEIPT_NOT_FOUND/);
 await assert.rejects(()=>receipt.readReviewReceipt({...args(db),operationId:'arbitrary'}),/HUB_SOURCE_REVIEW_INPUT_REJECTED/);
 await receipt.submitWithReviewReceipt({...args(db),kind:'external',input},async()=>({visibility:'tenant'}));
 const other={...principal,accountId:'other-admin'};
 await assert.rejects(()=>receipt.readReviewReceipt({...args(db),principal:other,reviewerAccountId:other.accountId,operationId:input.operationId}),/HUB_SOURCE_RECEIPT_NOT_FOUND/);
});

test('review receipts never record unrecognized request fields or content bodies',async()=>{
 const db=database();
 for(const extra of [{password:'must-not-log'},{body:'private text'},{unexpected:{nested:'text'}}])await assert.rejects(()=>receipt.submitWithReviewReceipt({...args(db),kind:'external',input:{...input,...extra}},async()=>assert.fail('reject before service')),/HUB_SOURCE_REVIEW_INPUT_REJECTED/);
 assert.equal(db.rows.size,0);
});
