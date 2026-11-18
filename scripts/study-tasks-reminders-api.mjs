import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createTaskCommands} from '../server/study-tasks/commands.mjs';
import {createTaskAuthorization} from '../server/study-tasks/authorization.mjs';

export async function runRemindersApi({root,env,plan,owner,admin,write,call}){
 const key=plan.runId+'-api-remind-1',checks=[];
 const [created]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT receipt FROM rh_study_tasks.operation
  WHERE tenant_id=${plan.scope.tenantId} AND research_project_id=${plan.scope.researchProjectId} AND request_key=${plan.runId+'-api-create-edit'}`,{readOnly:true});assert(created);
 const taskId=created.receipt.taskId,current=(await call('/'+taskId,owner,plan.scope.researchProjectId)).item;
 const [existing]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT expected_version FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId} AND request_key=${key}`,{readOnly:true});
 if(!existing){
  const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
  const {StudyOperationsService}=require(root+'app/server/src/study-operations/study-operations.service.ts');
  const {assertStudyTaskAuthority}=require(root+'app/server/src/study-operations/study-task-authority.ts');
  const account=await withFixtureTransaction(env,'direct',db=>db.account.findFirst({where:{id:plan.ids.owner,tenantId:plan.scope.tenantId},select:{id:true,role:true,authVersion:true}}),{readOnly:true});
  const snapshot=()=>withFixtureTransaction(env,'direct',async db=>({version:(await db.studyTask.findFirst({where:{id:taskId,...plan.scope},select:{version:true}})).version,
   notifications:await db.studyNotification.count({where:{studyTaskId:taskId,...plan.scope}}),audits:await db.auditLog.count({where:{target:taskId,...plan.scope}}),operations:Number((await db.$queryRaw`SELECT count(*) n FROM rh_study_tasks.operation WHERE task_id=${taskId}`)[0].n)}),{readOnly:true});
  const before=await snapshot(),fault=new Error('S08_REMINDER_RECEIPT_FAULT');
  const execute=createTaskCommands({boundary:plan,authorize:createTaskAuthorization({boundary:plan,assertAuthority:assertStudyTaskAuthority}),
   studyOperations:new StudyOperationsService({withTenantTransaction(){throw new Error('S08_NESTED_TX');}}),
   transact:(scope,fn)=>withFixtureTransaction(env,'app',async db=>{
    await db.$executeRaw`SELECT set_config('app.tenant_id',${scope.tenantId},true),set_config('app.study_group_id',${scope.studyGroupId},true),set_config('app.research_project_id',${scope.researchProjectId},true)`;
    return fn(new Proxy(db,{get(target,name){if(name==='$executeRaw')return(strings,...args)=>{if(strings.join('').includes('INSERT INTO rh_study_tasks.operation'))throw fault;return target.$executeRaw(strings,...args);};return target[name];}}));
   })});
  await assert.rejects(()=>execute({...account,accountId:account.id,tenantId:plan.scope.tenantId},plan.scope,{action:'remind',requestKey:key+'-rollback',taskId,input:{expectedVersion:current.version}}),e=>e===fault);
  assert.deepEqual(await snapshot(),before);checks.push('real_app_transaction_rolls_back_version_notification_audit_and_receipt');
 }
 const body={requestKey:key,expectedVersion:existing?.expected_version??current.version};
 const receipt=await write('/'+taskId+'/reminders',owner,body,'POST');
 assert.deepEqual(await write('/'+taskId+'/reminders',owner,body,'POST'),receipt);
 const after=(await call('/'+taskId,admin,plan.scope.researchProjectId)).item;
 const event=after.history.find(h=>h.id===receipt.operationId);assert(event&&event.action==='remind'&&event.notice);
 assert.equal(receipt.version,body.expectedVersion+1);checks.push('real_http_single_receipt_and_recipient_can_read_notice');
 await write('/'+taskId+'/reminders',owner,{...body,requestKey:key+'-forged',recipientAccountIds:[plan.ids.admin]},'POST',400);
 await write('/'+taskId+'/reminders',owner,{...body,requestKey:key+'-rate',expectedVersion:receipt.version},'POST',429);
 const rows=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT o.recipient_account_ids,o.result_version,n.status,n."sentAt" FROM rh_study_tasks.operation o
  JOIN public.study_notification n ON n.id=o.notification_id WHERE o.id=${receipt.operationId} AND o.tenant_id=${plan.scope.tenantId}`,{readOnly:true});
 assert.equal(rows.length,1);assert.deepEqual(rows[0].recipient_account_ids.sort(),[plan.ids.admin,plan.ids.owner].sort());assert.equal(rows[0].status,'recorded');assert.equal(rows[0].sentAt,null);
 checks.push('real_recipients_frozen_no_fake_sent_and_rate_limit');
 const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/';mkdirSync(out,{recursive:true});
 const evidence=out+'reminders-api-'+randomUUID()+'.json';writeFileSync(evidence,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,checks,taskId,receipt,newTasks:0,modelCalls:0,externalMessages:0},null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({passed:true,checks,newTasks:0,modelCalls:0,evidence}));
}
