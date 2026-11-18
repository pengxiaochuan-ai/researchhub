import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationRunAction} from './real-invitation-resume.mjs';

const email='fresh@example.test';
const issuedAt='2026-10-28T15:00:00.000Z';
const item={email,createdAt:'2026-10-28T15:00:01.000Z',deliveryStatus:'captured',expiresAt:'2026-10-31T15:00:01.000Z'};

test('fresh named Study with no request or invitation permits exactly one send',()=>{
  assert.equal(invitationRunAction({state:{invited:false},items:[],email}), 'issue');
});
test('submitted invitation with lost UI acknowledgement resumes without another send',()=>{
  assert.equal(invitationRunAction({state:{invited:false,issuedAt},items:[item],email}), 'reuse');
  assert.equal(invitationRunAction({state:{invited:true,issuedAt},items:[{...item,status:'accepted'}],email}), 'reuse');
});
test('unknown, duplicate, stale, or unconfirmed delivery never auto-retries',()=>{
  for(const [state,items] of [
    [{invited:false,issuedAt},[]],
    [{invited:false},[item]],
    [{invited:false},[{...item,email:'unexpected@example.test'}]],
    [{invited:false,issuedAt},[item,item]],
    [{invited:false,issuedAt},[{...item,createdAt:'2026-10-28T14:59:59.000Z'}]],
    [{invited:false,issuedAt},[{...item,deliveryStatus:'unknown'}]],
    [{invited:true,issuedAt},[]],
  ])assert.throws(()=>invitationRunAction({state,items,email}));
});
