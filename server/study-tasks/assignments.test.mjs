import test from 'node:test';import assert from 'node:assert/strict';
import {parseTaskCommand} from './contract.mjs';
import {createTaskCommands} from './commands.mjs';
const input={requestKey:'assign-test-1',expectedVersion:0,assigneeAccountId:'admin',collaboratorAccountIds:['owner'],dependencyTaskIds:['dependency']};
test('assignments_accept_exact_sets_but_reject_duplicate_or_uncontrolled_fields',()=>{
 const command=parseTaskCommand('assign',input,'task');assert.deepEqual(command.input.dependencyTaskIds,['dependency']);
 for(const extra of [{status:'completed'},{expectedVersion:undefined},{collaboratorAccountIds:['owner','owner']},{dependencyTaskIds:['../foreign']}])assert.throws(()=>parseTaskCommand('assign',{...input,...extra},'task'));
});
test('executor_cannot_assign_even_when_currently_assigned_and_knows_task_id',async()=>{
 let coreCalls=0;
 const execute=createTaskCommands({boundary:{ids:{owner:'owner',admin:'admin'}},transact:async(_scope,fn)=>fn({$queryRaw:async()=>[],studyTask:{findFirst:async()=>({id:'task',assigneeAccountId:'owner',collaborators:[]})}}),
  authorize:async(_db,_principal,_scope,action)=>{if(action==='assign')throw Object.assign(new Error('denied'),{code:'STUDY_TASK_AUTH_REQUIRED'});return{actorAccountId:'owner'};},
  studyOperations:{executeHubTaskCommandInTransaction:()=>{coreCalls++;}}});
 await assert.rejects(()=>execute({accountId:'owner'},{},parseTaskCommand('assign',input,'task')),{code:'STUDY_TASK_AUTH_REQUIRED'});assert.equal(coreCalls,0);
});
