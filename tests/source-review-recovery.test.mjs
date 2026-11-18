import test from 'node:test';
import assert from 'node:assert/strict';
import * as recovery from '../src/source-review-recovery.js';
const pending={kind:'external',sourceKey:'external:synthetic',savedLabel:'本轮合成来源',input:{kind:'external',documentId:'synthetic-document',visibility:'tenant',expectedFingerprint:'a'.repeat(64),operationId:'00000000-0000-4000-8000-000000000001'}};
function storage(){const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('original submission metadata is retained only for the authenticated editing session',()=>{
 const s=storage();recovery.savePendingReview(s,'admin-v1',pending);
 assert.deepEqual(recovery.readPendingReview(s,'admin-v1'),pending);
 assert.equal(recovery.readPendingReview(s,'owner-v1'),null);
 assert.equal(recovery.readPendingReview(s,'admin-v2'),null);
 recovery.clearPendingReview(s,'admin-v1');assert.equal(recovery.readPendingReview(s,'admin-v1'),null);
});
test('receipt must match every original request field; current queue is never proof',()=>{
 assert.equal(recovery.matchesReviewReceipt(pending,{kind:pending.kind,input:{...pending.input},review:{visibility:'tenant'}}),true);
 assert.equal(recovery.matchesReviewReceipt(pending,{kind:pending.kind,input:{...pending.input,visibility:'public'},review:{visibility:'public'}}),false);
 assert.equal(recovery.matchesReviewReceipt(pending,{kind:pending.kind,input:{...pending.input},review:{visibility:'public'}}),false);
 assert.equal(recovery.matchesReviewReceipt(pending,{items:[]}),false);
});
test('pending metadata rejects content, credentials, malformed keys and silently corrupted storage',()=>{
 const s=storage();for(const input of [{...pending.input,password:'secret'},{...pending.input,operationId:'bad'}])assert.throws(()=>recovery.savePendingReview(s,'admin-v1',{...pending,input}));
 assert.throws(()=>recovery.savePendingReview(s,null,pending));
 const broken={getItem:()=>'{broken'};assert.equal(recovery.readPendingReview(broken,'admin-v1'),null);
});
