import test from 'node:test';import assert from 'node:assert/strict';
import {recoverOperation,isCurrentRecovery} from '../src/governance-users-recovery.js';
test('404 is a read-only unsubmitted result; explicit retry keeps original key and payload',async()=>{
 const operation={kind:'account',id:'a',input:{requestKey:'original-key',status:'disabled',expectedVersion:'v1'}};let reads=0,writes=[];
 const api={receipt:async()=>{reads++;throw Object.assign(Error('not-found'),{status:404});},status:async(id,input)=>{writes.push({id,input});return{status:'disabled'};}};
 assert.deepEqual(await recoverOperation(api,operation),{unsubmitted:true});assert.equal(reads,1);assert.equal(writes.length,0);
 assert.deepEqual(await recoverOperation(api,operation,{retry:true}),{result:{status:'disabled'}});assert.deepEqual(writes,[{id:'a',input:operation.input}]);
});
test('unknown/network receipt failures never cause automatic mutation',async()=>{
 let writes=0;const api={receipt:async()=>{throw Object.assign(Error('unavailable'),{status:503});},status:async()=>writes++};await assert.rejects(recoverOperation(api,{kind:'account',input:{requestKey:'key'}}),{status:503});assert.equal(writes,0);
});
test('late recovery belongs to the same generation, actor and request key only',()=>{
 const first={generation:1,actor:'old',requestKey:'key'};assert(isCurrentRecovery(first,{...first}));
 for(const change of [{generation:2},{actor:'new'},{requestKey:'other'}])assert.equal(isCurrentRecovery(first,{...first,...change}),false);
});
