import test from 'node:test';import assert from 'node:assert/strict';
import{createAccountAccessClient}from'../src/account-session.js';
test('scoped invitation reads honor parent cancellation, never outlive the governance generation',async()=>{
 const c=new AbortController();c.abort();let aborted;
 const client=createAccountAccessClient({enabled:true,fetchImpl:async(_path,init)=>{aborted=init.signal.aborted;if(aborted)throw new DOMException('cancelled','AbortError');return{ok:true,json:async()=>({items:[],nextCursor:null})};}});
 await assert.rejects(()=>client.listInvitations({groupId:'g',projectId:'p'},{},{signal:c.signal}),{name:'AbortError'});assert.equal(aborted,true);
});
