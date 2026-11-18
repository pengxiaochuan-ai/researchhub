import test from 'node:test';import assert from 'node:assert/strict';
import {createTaskCommands} from './commands.mjs';
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'study'},principal={accountId:'owner'};
const command={action:'create',requestKey:'task-create-1',input:{taskType:'custom',name:'任务',assigneeAccountId:'owner',dueAt:'2026-11-13T15:59:59.999Z'}};
function fixture(){
 const receipts=[];let creates=0;
 const tx={auditLog:{create:async()=>({})},$queryRaw:async(strings,...values)=>strings.join('').includes('count(*)')?[{n:2n}]:receipts.filter(r=>r.request_key===values.at(-1)),
  $executeRaw:async(strings,...values)=>{if(strings.join('').includes('INSERT INTO'))receipts.push({receipt:JSON.parse(values.at(-1)),request_hash:values[6],request_key:values[5],task_id:values[8]});return 1;},
  studyTask:{findFirst:async()=>({id:'new-task',...scope,assigneeAccountId:'owner',collaborators:[]})}};
 const execute=createTaskCommands({transact:async(_scope,fn)=>fn(tx),authorize:async()=>({...scope,actorAccountId:'owner',canConfigure:true}),
  studyOperations:{executeHubTaskCommandInTransaction:async(db,user,target,cmd)=>{assert.equal(db,tx);assert.equal(user,principal);creates++;return{id:'new-task',version:0};}},boundary:{scope,ids:{owner:'owner',admin:'admin'},project:{id:'aux'},maxTasks:8}});
 return{execute,receipts,creates:()=>creates,tx};
}
test('create_same_key_returns_one_task_and_current_auth_checked_before_receipt',async()=>{
 const f=fixture();const first=await f.execute(principal,scope,command),second=await f.execute(principal,scope,command);
 assert.deepEqual(second,first);assert.equal(f.creates(),1);assert.equal(f.receipts.length,1);
 await assert.rejects(()=>f.execute(principal,scope,{...command,input:{...command.input,name:'不同请求'}}),{code:'STUDY_TASK_IDEMPOTENCY_CONFLICT'});
});
test('create_budget_blocks_ninth_task_before_old_core',async()=>{
 const f=fixture();f.tx.$queryRaw=async strings=>strings.join('').includes('count(*)')?[{n:8n}]:[];
 await assert.rejects(()=>f.execute(principal,scope,command),{code:'STUDY_TASK_LOCAL_TASK_LIMIT'});assert.equal(f.creates(),0);
});
test('local_synthetic_target_accounts_cannot_expand_beyond_original_two',async()=>{
 const f=fixture();await assert.rejects(()=>f.execute(principal,scope,{...command,input:{...command.input,assigneeAccountId:'third-account'}}),{code:'STUDY_TASK_LOCAL_ACCOUNT_LIMIT'});assert.equal(f.creates(),0);
});
