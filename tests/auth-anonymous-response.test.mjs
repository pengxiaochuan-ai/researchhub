import test from'node:test';import assert from'node:assert/strict';import{createAuthClient}from'../src/auth-session.js';
test('anonymous identity closes the unread 401 response instead of leaving it until the request timeout',async()=>{
 let cancelled=0;const client=createAuthClient({tenantSlug:'test',fetchImpl:async()=>({status:401,body:{cancel:async()=>{cancelled++;}}})});assert.equal(await client.me(),null);assert.equal(cancelled,1);
});
test('already closed anonymous response still means signed out, never an authentication network error',async()=>{
 const client=createAuthClient({tenantSlug:'test',fetchImpl:async()=>({status:401,body:{cancel:async()=>{throw Error('already closed');}}})});assert.equal(await client.me(),null);
});
