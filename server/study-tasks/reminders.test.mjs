import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTaskCommand} from './contract.mjs';
import {createTaskCommands} from './commands.mjs';
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'study'};
const principal={accountId:'owner',tenantId:'tenant'};
const input={requestKey:'reminder-0001',expectedVersion:2};

test('reminder_input_never_accepts_client_recipients_or_delivery_claims',()=>{
 assert.deepEqual(parseTaskCommand('remind',input,'task'),{action:'remind',taskId:'task',requestKey:'reminder-0001',input:{expectedVersion:2}});
 for(const extra of [{recipientAccountIds:['admin']},{sent:true},{notice:'forged'},{expectedVersion:undefined}])assert.throws(()=>parseTaskCommand('remind',{...input,...extra},'task'));
});

function fixture(){
 const state={version:2,receipts:[],notifications:[],audits:[],active:true};
 const task=()=>({id:'task',...scope,version:state.version,status:'open',assigneeAccountId:'admin',collaborators:[{accountId:'owner'},{accountId:'admin'}]});
 const db={
  studyTask:{findFirst:async()=>task()},
  account:{findMany:async()=>state.active?['admin','owner'].map(id=>({id,role:'researcher',authVersion:1})):[]},
  auditLog:{create:async({data})=>{state.audits.push(data);}},
  studyNotification:{create:async({data})=>{const n={id:'notification-1',...data};state.notifications.push(n);return n;}},
  $queryRaw:async(strings,...values)=>{
   const sql=strings.join('');
   if(sql.includes('request_hash'))return state.receipts.filter(r=>r.request_key===values.at(-1));
   if(sql.includes('created_at'))return [];
   return [{id:'create-receipt'}];
  },
  $executeRaw:async(strings,...values)=>{
   if(strings.join('').includes('INSERT INTO')){const receiptIndex=values.findIndex(v=>typeof v==='string'&&v.startsWith('{"operationId"'));
    state.receipts.push({receipt:JSON.parse(values[receiptIndex]),request_hash:values[6],request_key:values[5],task_id:values[8],values});}
   return 1;
  },
 };
 const execute=createTaskCommands({transact:async(_scope,fn)=>fn(db),boundary:{ids:{owner:'owner',admin:'admin'}},
  authorize:async(_db,actor,_scope,action)=>{if(!['owner','admin'].includes(actor.accountId))throw new Error('denied');return {...scope,actorAccountId:actor.accountId,canExecute:true,readAll:true};},
  studyOperations:{executeHubTaskCommandInTransaction:async(_db,_actor,_scope,command)=>{assert.equal(command.action,'remind');assert.equal(command.input.expectedVersion,state.version);state.version++;return task();}}});
 return {state,execute};
}
test('reminder_freezes_recipients_and_deduplicates_without_claiming_delivery',async()=>{
 const f=fixture(),command={action:'remind',taskId:'task',requestKey:'reminder-0001',input:{expectedVersion:2}};
 const result=await f.execute(principal,scope,command);
 assert.equal(result.version,3);assert.equal(f.state.notifications.length,1);
 assert.equal(f.state.notifications[0].status,'recorded');assert.equal(f.state.notifications[0].sentAt,undefined);
 assert.deepEqual(f.state.receipts[0].values.find(Array.isArray),['admin','owner']);
 assert.deepEqual(await f.execute(principal,scope,command),result);
 assert.equal(f.state.version,3);assert.equal(f.state.notifications.length,1);assert.equal(f.state.audits.length,1);
});
test('no_current_recipient_is_not_a_success_and_does_not_touch_task',async()=>{
 const f=fixture();f.state.active=false;
 await assert.rejects(()=>f.execute(principal,scope,{action:'remind',taskId:'task',requestKey:'reminder-0001',input:{expectedVersion:2}}),{code:'STUDY_TASK_NO_RECIPIENT'});
 assert.equal(f.state.version,2);assert.equal(f.state.receipts.length,0);assert.equal(f.state.notifications.length,0);
});
