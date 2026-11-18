import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {assertResponseMutation,formalResponseHash}=require('./src/study-operations/formal-response-policy.ts');
const state={status:'draft',version:2,currentRevisionId:null,lockedRevisionId:null};
test('draft CAS rejects stale versions and submitted responses',()=>{
 assert.doesNotThrow(()=>assertResponseMutation(state,{kind:'draft',expectedVersion:2}));
 assert.throws(()=>assertResponseMutation(state,{kind:'draft',expectedVersion:1}),/FORM_VERSION_CONFLICT/);
 assert.throws(()=>assertResponseMutation({...state,status:'submitted'},{kind:'draft',expectedVersion:2}),/FORM_ALREADY_SUBMITTED/);
});
test('correction requires explicit reason, current ref and unlocked revision',()=>{
 const current={status:'submitted',version:4,currentRevisionId:'revision-1',lockedRevisionId:null};
 assert.doesNotThrow(()=>assertResponseMutation(current,{kind:'correct',expectedVersion:4,expectedRevisionId:'revision-1',reason:'change'}));
 assert.throws(()=>assertResponseMutation(current,{kind:'correct',expectedVersion:4,expectedRevisionId:'revision-1',reason:' '}),/FORM_CORRECTION_REASON_REQUIRED/);
 assert.throws(()=>assertResponseMutation(current,{kind:'correct',expectedVersion:4,expectedRevisionId:'other',reason:'change'}),/FORM_VERSION_CONFLICT/);
 assert.throws(()=>assertResponseMutation({...current,lockedRevisionId:'revision-1'},{kind:'correct',expectedVersion:4,expectedRevisionId:'revision-1',reason:'change'}),/FORM_RESPONSE_LOCKED/);
});
test('canonical content hash preserves zeros and false and ignores object key order',()=>{
 const a={version:'formal-response-v1',answers:{n:0,b:false}},b={answers:{b:false,n:0},version:'formal-response-v1'};
 assert.equal(formalResponseHash(a),formalResponseHash(b));
 assert.notEqual(formalResponseHash(a),formalResponseHash({version:'formal-response-v1',answers:{b:false}}));
});

test('hash rejects undefined, sparse arrays and non-finite numbers',()=>{
 for(const value of [{x:undefined},[NaN],Array(1)])assert.throws(()=>formalResponseHash(value),/FORM_CANONICAL_VALUE_INVALID/);
});
test('reviews and locking require the exact current revision and approved review',()=>{
 const {assertReviewAction}=require('./src/study-operations/formal-response-policy.ts');
 const state={status:'submitted',version:3,currentRevisionId:'rev',lockedRevisionId:null};
 assert.doesNotThrow(()=>assertReviewAction(state,{kind:'review_approved',expectedVersion:3,expectedRevisionId:'rev'},false));
 assert.throws(()=>assertReviewAction(state,{kind:'lock',expectedVersion:3,expectedRevisionId:'rev'},false),/FORM_REVIEW_REQUIRED/);
 assert.doesNotThrow(()=>assertReviewAction(state,{kind:'lock',expectedVersion:3,expectedRevisionId:'rev'},true));
 assert.throws(()=>assertReviewAction({...state,lockedRevisionId:'rev'},{kind:'unlock',expectedVersion:3,expectedRevisionId:'rev',reason:' '} ,true),/FORM_UNLOCK_REASON_REQUIRED/);
 assert.throws(()=>assertReviewAction(state,{kind:'review_approved',expectedVersion:3,expectedRevisionId:'old'},false),/FORM_VERSION_CONFLICT/);
});
