import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOwnedRehearsal,validateRehearsalState} from './rehearsal.mjs';
const state={schemaVersion:1,runId:'rh-deploy-20261118-abcdef12',container:'rh-deploy-20261118-abcdef12-pg',volume:'rh-deploy-20261118-abcdef12-pgdata',database:'rh_deploy_abcdef12',port:19651,syntheticOnly:true};
test('rehearsal ownership is bound to its exact Docker label, never a running legacy service',()=>{
 assert.equal(validateRehearsalState(state),state);
 assert.doesNotThrow(()=>assertOwnedRehearsal(state,{Name:'/'+state.container,Config:{Labels:{'researchhub.rehearsal':state.runId}}}));
 for(const changed of [{...state,syntheticOnly:false},{...state,container:'old-postgres'},{...state,database:'aisci'},{...state,port:5434}])assert.throws(()=>validateRehearsalState(changed));
 assert.throws(()=>assertOwnedRehearsal(state,{Name:'/'+state.container,Config:{Labels:{'researchhub.rehearsal':'another-run'}}}));
});
