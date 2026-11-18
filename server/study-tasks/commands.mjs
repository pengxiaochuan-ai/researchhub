import {createHash,randomUUID} from 'node:crypto';
import {taskError} from './authorization.mjs';
import {findReadableTask} from './repository.mjs';
import {verifyTaskEvidence} from './evidence.mjs';
import {verifyTaskContext} from './links.mjs';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

export function createTaskCommands({transact,authorize,studyOperations,boundary,contextDeps}) {
 return (principal,scope,command)=>transact(scope,async db=>{
  const authority=await authorize(db,principal,scope,command.action==='create'?'create':'read');
  const {action,requestKey,taskId,input}=command;
  const authorityAction=action==='transition'&&input.status==='cancelled'?'cancel':action;
  if(['create','assign'].includes(action)&&[input.assigneeAccountId,...(input.collaboratorAccountIds??[])].some(id=>![boundary.ids.owner,boundary.ids.admin].includes(id)))
   throw taskError('STUDY_TASK_LOCAL_ACCOUNT_LIMIT',403,'本轮合成任务仅限原两个获准账号');
  const hash=digest({action,taskId:taskId??null,input,reason:command.reason??null});
  let beforeTask=null;
  const [previous]=await db.$queryRaw`SELECT receipt,request_hash,task_id FROM rh_study_tasks.operation
   WHERE tenant_id=${scope.tenantId} AND study_group_id=${scope.studyGroupId} AND research_project_id=${scope.researchProjectId}
   AND actor_account_id=${authority.actorAccountId} AND request_key=${requestKey}`;
  if(previous){
   const task=await findReadableTask(db,authority,previous.task_id);
   await authorize(db,principal,scope,authorityAction,task);
   if(previous.request_hash!==hash)throw taskError('STUDY_TASK_IDEMPOTENCY_CONFLICT',409,'该提交编号对应不同内容，请核对原提交');
   return previous.receipt;
  }
  if(action==='create'){
   let created=0;
   // Same locked transaction; count each approved project under its own RLS scope.
   for(const projectId of [boundary.scope.researchProjectId,boundary.project.id]){
    await db.$executeRaw`SELECT set_config('app.research_project_id',${projectId},true)`;
    const [row]=await db.$queryRaw`SELECT count(*) n FROM rh_study_tasks.operation WHERE tenant_id=${scope.tenantId}
     AND study_group_id=${scope.studyGroupId} AND research_project_id=${projectId} AND action='create'`;
    created+=Number(row.n);
   }
   await db.$executeRaw`SELECT set_config('app.research_project_id',${scope.researchProjectId},true)`;
   if(created>=boundary.maxTasks)throw taskError('STUDY_TASK_LOCAL_TASK_LIMIT',429,'本轮8条新合成任务已用完；不自动扩大测试范围');
  }else{
   const task=await findReadableTask(db,authority,taskId);
   beforeTask=task;
   await authorize(db,principal,scope,authorityAction,task);
   const [owned]=await db.$queryRaw`SELECT id FROM rh_study_tasks.operation WHERE tenant_id=${scope.tenantId}
    AND study_group_id=${scope.studyGroupId} AND research_project_id=${scope.researchProjectId} AND task_id=${taskId} AND action='create' LIMIT 1`;
   if(!owned)throw taskError('STUDY_TASK_FIXTURE_READ_ONLY',403,'历史任务在本轮仅供只读核对');
  }
  let recipientIds=[],notification=null;
  const notice=action==='remind'?'任务提醒：请核对当前任务及待办状态。':null;
  if(action==='remind'){
   const [recent]=await db.$queryRaw`SELECT id FROM rh_study_tasks.operation WHERE tenant_id=${scope.tenantId}
    AND study_group_id=${scope.studyGroupId} AND research_project_id=${scope.researchProjectId} AND task_id=${taskId}
    AND action='remind' AND created_at>clock_timestamp()-interval '60 seconds' LIMIT 1`;
   if(recent)throw taskError('STUDY_TASK_REMINDER_RATE_LIMIT',429,'同一任务一分钟内只能提醒一次，请稍后重试');
   const ids=[...new Set([beforeTask.assigneeAccountId,...(beforeTask.collaborators??[]).map(c=>c.accountId)].filter(Boolean))].sort();
   const accounts=ids.length?await db.account.findMany({where:{tenantId:scope.tenantId,id:{in:ids},status:'active'},select:{id:true,role:true,authVersion:true}}):[];
   for(const account of accounts){
    try{await authorize(db,{accountId:account.id,tenantId:scope.tenantId,role:account.role,authVersion:account.authVersion},scope,'read',beforeTask);recipientIds.push(account.id);}
    catch(error){const code=error.code??error.getResponse?.()?.code;if(!['STUDY_TASK_AUTH_REQUIRED','STUDY_TASK_AUTH_STALE','STUDY_TASK_SCOPE_REJECTED'].includes(code))throw error;}
   }
   recipientIds.sort();
   if(!recipientIds.length)throw taskError('STUDY_TASK_NO_RECIPIENT',409,'没有当前可读取任务的有效收件人，未创建提醒');
  }
  if(action==='transition'&&input.status==='completed')await verifyTaskEvidence(db,authority,input.evidenceRefs);
  if(action==='link'||action==='create'&&input.context)await verifyTaskContext(db,authority,input.context,contextDeps);
  const result=await studyOperations.executeHubTaskCommandInTransaction(db,principal,scope,{action,...(taskId?{taskId}:{}),input,...(command.reason?{reason:command.reason}:{})});
  if(action==='link'||action==='create'&&input.context){
   const c=input.context;
   await db.$executeRaw`INSERT INTO rh_study_tasks.context(task_id,tenant_id,study_group_id,research_project_id,kind,source_id,parent_id,root_id,source_version,source_hash,created_by,actor_account_id)
    VALUES(${result.id},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},${c.kind},${c.sourceId??null},${c.parentId??null},${c.rootId??null},${c.sourceVersion??null},${c.sourceHash??null},${authority.actorAccountId},${authority.actorAccountId})
    ON CONFLICT(task_id) DO UPDATE SET kind=EXCLUDED.kind,source_id=EXCLUDED.source_id,parent_id=EXCLUDED.parent_id,root_id=EXCLUDED.root_id,source_version=EXCLUDED.source_version,source_hash=EXCLUDED.source_hash,actor_account_id=EXCLUDED.actor_account_id,updated_at=clock_timestamp()`;
  }
  if(action==='remind')notification=await db.studyNotification.create({data:{...scope,kind:'task_reminder',studyTaskId:result.id,status:'recorded',createdBy:authority.actorAccountId}});
  const operationId=randomUUID(),receipt={operationId,taskId:result.id,version:result.version};
  await db.auditLog.create({data:{...scope,accountId:authority.actorAccountId,action:'researchhub_study_task_'+action,target:result.id,
   meta:{operationId,expectedVersion:action==='create'?null:input.expectedVersion,version:result.version,
    fromStatus:beforeTask?.status??null,toStatus:result.status??null,reason:command.reason??null,
    reviewDecision:action==='review'?input.decision:null,reviewNote:action==='review'?input.note??null:null,
    ...(action==='remind'?{recipientAccountIds:recipientIds,notificationId:notification.id}:{}),
    ...(input.context?{contextKind:input.context.kind,contextSourceVersion:input.context.sourceVersion??null,contextSourceHash:input.context.sourceHash??null}:{}),
    ...(action==='transition'&&input.status==='completed'?{submittedEvidence:input.evidenceRefs??[],completionNoteHash:createHash('sha256').update(input.completionNote??'').digest('hex')}:{})}}});
  if(action==='remind')await db.$executeRaw`INSERT INTO rh_study_tasks.operation(id,tenant_id,study_group_id,research_project_id,actor_account_id,request_key,request_hash,action,task_id,expected_version,result_version,reason,recipient_account_ids,notice,notification_id,receipt)
   VALUES(${operationId},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},${authority.actorAccountId},${requestKey},${hash},${action},${result.id},${input.expectedVersion},${result.version},${null},${recipientIds}::text[],${notice},${notification.id},${JSON.stringify(receipt)}::jsonb)`;
  else await db.$executeRaw`INSERT INTO rh_study_tasks.operation(id,tenant_id,study_group_id,research_project_id,actor_account_id,request_key,request_hash,action,task_id,expected_version,result_version,reason,receipt)
   VALUES(${operationId},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},${authority.actorAccountId},${requestKey},${hash},${action},${result.id},${action==='create'?null:input.expectedVersion},${result.version},${command.reason??null},${JSON.stringify(receipt)}::jsonb)`;
  return receipt;
 });
}
