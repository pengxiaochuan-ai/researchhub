import test from 'node:test';
import assert from 'node:assert/strict';
import * as session from '../src/source-review-queue.js';

test('same current account and authorization version share a review editing session, not display labels',()=>{
 assert.equal(typeof session.sourceReviewIdentityKey,'function');
 const actor={id:'account-a',authVersion:3,mode:'real',status:'authenticated',authenticated:true};
 assert.equal(session.sourceReviewIdentityKey(actor),session.sourceReviewIdentityKey({...actor,displayName:'改名',roleName:'更新显示',sessionHealth:'unavailable'}));
 for(const changed of [{id:'account-b'},{authVersion:4},{mode:'demo'}])assert.notEqual(session.sourceReviewIdentityKey(actor),session.sourceReviewIdentityKey({...actor,...changed}));
});

test('checking, logged out and unusable identities cannot retain a source editing session',()=>{
 assert.equal(typeof session.sourceReviewIdentityKey,'function');
 for(const actor of [null,{}, {id:'a',authenticated:false,status:'anonymous'}, {id:'a',authenticated:true,status:'checking'}, {id:'a',authenticated:true,status:'unavailable'}])assert.equal(session.sourceReviewIdentityKey(actor),null);
});
