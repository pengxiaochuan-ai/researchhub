import {createHash,randomUUID} from 'node:crypto';
import {taskError} from './authorization.mjs';
import {parseTaskCommand,parseTaskContext} from './contract.mjs';
import {parseFormalRef} from './formal-task-source.mjs';
import {findReadableTask,readTaskPage,readTaskDetail,createTaskCursor,parseTaskQuery} from './repository.mjs';
import {verifyTaskEvidence} from './evidence.mjs';
import {cursorCodec,cursorBinding,pageLimit} from '../research-capture/capture-cursor.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const inputError=()=>{throw taskError('STUDY_TASK_INPUT_INVALID',400,'任务内容无效，请核对后再提交');};
const scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
function formalContext(value){
 if(value?.kind!=='formal_response_ref')return parseTaskContext(value);
 const keys=['kind','sourceId','parentId','rootId','sourceVersion','sourceHash'];if(!value||Object.keys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(value,k))||!id(value.sourceId)||!id(value.parentId)||!id(value.rootId)||!Number.isSafeInteger(value.sourceVersion)||value.sourceVersion<1||value.sourceVersion>2147483647||!/^[a-f0-9]{64}$/.test(value.sourceHash??''))inputError();return Object.fromEntries(keys.map(k=>[k,value[k]]));
}
export function parseFormalTaskCommand(action,body,taskId){
 if(!body||typeof body!=='object'||Array.isArray(body))inputError();let rewritten={...body},context;
 if((action==='link'||action==='create')&&body.context?.kind==='formal_response_ref'){context=formalContext(body.context);rewritten.context={kind:'none'};}
 let evidence;
 if(action==='transition'&&body.status==='completed'&&Array.isArray(body.evidenceRefs)){
  const formal=body.evidenceRefs.filter(r=>r?.kind==='formal_response_ref');if(formal.length>1||formal.length&&body.evidenceRefs.length!==1)inputError();
  if(formal.length){evidence=[parseFormalRef(formal[0])];rewritten.evidenceRefs=[];if(!rewritten.completionNote)rewritten.completionNote='validation-placeholder';}
 }
 const parsed=parseTaskCommand(action,rewritten,taskId);if(context)parsed.input.context=context;
 if(evidence){parsed.input.evidenceRefs=evidence;if(!body.completionNote)parsed.input.completionNote='';}
 return parsed;
}
const presentReceipt=(saved,requestKey,action,studyId)=>({...saved,receipt:{requestKey,action:'task.'+action,targetId:saved.taskId,studyId}});
const refFromContext=c=>({kind:'formal_response_ref',responseId:c.sourceId,assignmentId:c.parentId,revisionNo:c.sourceVersion,contentHash:c.sourceHash});
const nav=(studyId,source)=>'/pages/s09/?'+new URLSearchParams({formalCapture:'1',studyId,visitId:source.visitId,...(source.assignmentId?{assignmentId:source.assignmentId,responseId:source.context.sourceId,revisionNo:String(source.context.sourceVersion),contentHash:source.context.sourceHash}:{})});
export function createFormalTaskService({studies,core,cursorSecret}){
 const cursor=createTaskCursor(cursorSecret),sourceCursor=cursorCodec(cursorSecret),run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',(db,ctx)=>fn(db,scope(ctx)));
 const auth=(db,user,s,action,task)=>core.authorize(db,user,s,action,task);
 async function source(db,user,s,studyId,input,current=true){
  let result;if(input.kind==='formal_visit')result=await core.source.visit(db,user,s,input.sourceId);else result=await core.source.response(db,user,s,input.kind==='formal_response_ref'&&input.responseId?input:refFromContext(input),current);
  if(input.sourceVersion!==undefined&&hash(input)!==hash(result.context))throw taskError('STUDY_TASK_CONTEXT_CHANGED',409,'关联记录版本已变化，请重新核对');
  return {...result,navigation:{href:nav(studyId,result)}};
 }
 async function checkSource(db,user,s,studyId,cmd,task){
  const c=cmd.input.context,ev=cmd.input.evidenceRefs?.find(x=>x.kind==='formal_response_ref');if(!c&&!ev)return null;
  if(c?.kind==='none')return null;
  if(c&&!['formal_visit','formal_response_ref'].includes(c.kind))throw taskError('STUDY_TASK_SOURCE_RESTRICTED',403,'此研究不支持该来源');
  const value=await source(db,user,s,studyId,c??ev,true);
  if(task){let parent=task.subjectId;if(task.subjectVisitId){const visit=await db.subjectVisit.findFirst({where:{...s,id:task.subjectVisitId,acceptanceFixture:false},select:{subjectId:true}});if(!visit)throw taskError('STUDY_TASK_SOURCE_CHANGED',409);parent=parent??visit.subjectId;}if(task.enrollmentId){const enrollment=await db.studyEnrollment.findFirst({where:{...s,id:task.enrollmentId,acceptanceFixture:false},select:{subjectId:true}});if(!enrollment||parent&&parent!==enrollment.subjectId)throw taskError('STUDY_TASK_SOURCE_CHANGED',409);parent=parent??enrollment.subjectId;}if(parent&&parent!==value.subjectId)throw taskError('STUDY_TASK_SOURCE_CHANGED',409,'任务和来源被试不一致');}
  return value;
 }
 return {
  context:(user,studyId)=>run(user,studyId,async(db,s)=>{
   const a=await auth(db,user,s,'read');const [actor,project]=await Promise.all([db.account.findFirst({where:{id:a.actorAccountId,tenantId:s.tenantId,status:'active'},select:{id:true,displayName:true,tenant:{select:{name:true}}}}),db.researchProject.findFirst({where:{tenantId:s.tenantId,studyGroupId:s.studyGroupId,id:s.researchProjectId,status:'active'},select:{id:true,name:true,status:true}})]);
   if(!actor||!project)throw taskError('STUDY_TASK_SCOPE_REJECTED');return {studyId,study:{id:studyId,name:project.name,status:project.status},actor:{id:actor.id,displayName:actor.displayName||'未设置姓名',tenantName:actor.tenant.name,roleLabel:a.isTenantAdmin?'租户管理员':a.canConfigure?'Study任务管理者':'科研人员'},capabilities:{canCreate:a.canConfigure,canConfigure:a.canConfigure,canExecute:a.canExecute,canReview:a.canReview,readAll:a.readAll}};
  }),
  participants:(user,studyId,query={})=>run(user,studyId,async(db,s)=>{
   const a=await auth(db,user,s,'read'),parsed=parseTaskQuery(new URLSearchParams(query),['q','limit','cursor']);parsed.__study=studyId;parsed.__authVersion=user.authVersion;parsed.__kind='participants';
   const last=parsed.cursor?cursor.decode(a,parsed,parsed.cursor):null;
   const accounts=await db.account.findMany({where:{tenantId:s.tenantId,status:'active',AND:[{OR:[{role:'tenant_admin',isTenantAdmin:true},{role:{notIn:['platform_admin','tenant_admin']},isTenantAdmin:false,researchProjectMemberships:{some:{...s,status:'active'}}}]},...(parsed.q?[{displayName:{contains:parsed.q,mode:'insensitive'}}]:[]),...(last?[{OR:[{createdAt:{lt:last.createdAt}},{createdAt:last.createdAt,id:{lt:last.id}}]}]:[])]},select:{id:true,displayName:true,createdAt:true,role:true,isTenantAdmin:true,authVersion:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:parsed.limit+1});
   const items=[];for(const account of accounts.slice(0,parsed.limit)){try{const candidate=await auth(db,{tenantId:s.tenantId,accountId:account.id,role:account.role,isTenantAdmin:account.isTenantAdmin,authVersion:account.authVersion},s,'read');if(candidate.canExecute||candidate.canConfigure||candidate.canReview)items.push({id:account.id,displayName:account.displayName||'未设置姓名'});}catch(error){const code=error.code??error.getResponse?.()?.code;if(!['STUDY_TASK_AUTH_REQUIRED','STUDY_TASK_AUTH_STALE','STUDY_TASK_SCOPE_REJECTED'].includes(code))throw error;}}
   return {studyId,items,nextCursor:accounts.length>parsed.limit?cursor.encode(a,parsed,accounts[parsed.limit-1]):null};
  }),
  list:(user,studyId,query)=>run(user,studyId,async(db,s)=>{const a=await auth(db,user,s,'read'),parsed=parseTaskQuery(new URLSearchParams(query));parsed.__study=studyId;parsed.__authVersion=user.authVersion;return {studyId,...await readTaskPage(db,a,parsed,cursor)};}),
  receipt:(user,studyId,key)=>{if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(key))inputError();return run(user,studyId,async(db,s)=>{
   const a=await auth(db,user,s,'read');const [op]=await db.$queryRaw`SELECT id,task_id,action,receipt FROM rh_study_tasks.operation WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND actor_account_id=${a.actorAccountId} AND request_key=${key}`;
   if(!op)throw taskError('STUDY_TASK_RECEIPT_NOT_FOUND',404,'尚未查到提交回执，不代表提交必未发生');const task=await findReadableTask(db,a,op.task_id);
   const audit=await db.auditLog.findFirst({where:{...s,accountId:a.actorAccountId,action:'researchhub_study_task_'+op.action,target:op.task_id,meta:{path:['operationId'],equals:op.id}},select:{meta:true}});
   if(!audit)throw taskError('STUDY_TASK_RECEIPT_NOT_FOUND',404,'尚未查到可核验的提交回执');const operation=op.action==='transition'&&audit.meta?.toStatus==='cancelled'?'cancel':op.action;await auth(db,user,s,operation,task);
   if(audit?.meta?.sourceContext)await source(db,user,s,studyId,audit.meta.sourceContext,true);
   return presentReceipt(op.receipt,key,op.action,studyId);
  });},
  detail:(user,studyId,taskId)=>run(user,studyId,async(db,s)=>{
   const a=await auth(db,user,s,'read'),result=await readTaskDetail(db,a,taskId,{});
   const [record]=await db.$queryRaw`SELECT kind,source_id,parent_id,root_id,source_version,source_hash FROM rh_study_tasks.context WHERE task_id=${taskId} AND tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId}`;
   const row=await db.studyTask.findFirst({where:{...s,id:taskId,acceptanceFixture:false},select:{evidenceRefs:true}});
   const safe=async input=>{try{const value=await source(db,user,s,studyId,input,false);return {kind:input.kind,status:value.current===false?'changed':'current',label:value.label,navigation:value.navigation,subjectCode:value.subjectCode,visitName:value.visitName,...(value.formTitle!==undefined?{formTitle:value.formTitle,revisionNo:value.revisionNo}:{}),...(value.context?{context:value.context}:{})};}catch(error){const code=error.code??error.getResponse?.()?.code;if(error.status===403||error.status===404||error.status===409||['RESEARCH_FORBIDDEN','PARTICIPATION_CAPTURE_BLOCKED','FORM_REVISION_NOT_FOUND','FORM_REVISION_INTEGRITY_INVALID','PROTOCOL_BINDING_CHANGED'].includes(code))return {kind:input.kind,status:'restricted'};throw error;}};
   if(['formal_visit','formal_response_ref'].includes(record?.kind))result.item.context=await safe({kind:record.kind,sourceId:record.source_id,parentId:record.parent_id,rootId:record.root_id,sourceVersion:record.source_version,sourceHash:record.source_hash});
   if(Array.isArray(row?.evidenceRefs)&&row.evidenceRefs.some(x=>x?.kind==='formal_response_ref'))result.item.evidence=await Promise.all(row.evidenceRefs.map(safe));
   return {studyId,...result};
  }),
  options:(user,studyId,input)=>{
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['subjectId','limit','cursor'].includes(k))||!id(input.subjectId))inputError();const limit=pageLimit(input.limit),binding=cursorBinding(user,studyId,'task-visit-options',input.subjectId),afterId=input.cursor===undefined?undefined:sourceCursor.decode(input.cursor,binding,id);
   return run(user,studyId,async(db,s)=>{await auth(db,user,s,'read');const page=await core.listVisits(db,user,s,{subjectId:input.subjectId,limit,...(afterId?{afterId}:{})});const items=[];for(const row of page.items){const value=await source(db,user,s,studyId,{kind:'formal_visit',sourceId:row.id});items.push(value);}return {studyId,items,nextCursor:page.nextAfterId?sourceCursor.encode(binding,page.nextAfterId):null};});
  },
  source:(user,studyId,kind,sourceId)=>{if(!['formal_visit','formal_response_ref'].includes(kind)||!id(sourceId))inputError();return run(user,studyId,async(db,s)=>{await auth(db,user,s,'read');if(kind==='formal_visit')return source(db,user,s,studyId,{kind,sourceId});const current=await core.source.current(db,user,s,sourceId);return source(db,user,s,studyId,{kind,...current},true);});},
  command:(user,studyId,action,taskId,body)=>{const command=parseFormalTaskCommand(action,body,taskId);return run(user,studyId,async(db,s)=>{
   const a=await auth(db,user,s,action==='create'?'create':'read'),operation=action==='transition'&&command.input.status==='cancelled'?'cancel':action;
   await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+s.studyGroupId+':'+s.researchProjectId+':study-task:'+user.accountId+':'+command.requestKey},0))::text`;
   const [previous]=await db.$queryRaw`SELECT receipt,request_hash,task_id FROM rh_study_tasks.operation WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND actor_account_id=${a.actorAccountId} AND request_key=${command.requestKey}`;
   const digest=hash({action,taskId:taskId??null,input:command.input,reason:command.reason??null});let task=null,visibleTask=null;
   if(action!=='create'||previous){task=await findReadableTask(db,a,previous?.task_id??taskId);visibleTask=task;await auth(db,user,s,operation,task);task=await db.studyTask.findFirst({where:{...s,id:task.id,acceptanceFixture:false},select:{id:true,subjectId:true,enrollmentId:true,subjectVisitId:true,evidenceRefs:true}});if(!task)throw taskError('STUDY_TASK_AUTH_REQUIRED');}
   let verified=await checkSource(db,user,s,studyId,command,task);
   if(action==='review'&&command.input.decision==='accept'&&Array.isArray(task?.evidenceRefs)){
    const formal=task.evidenceRefs.filter(ref=>ref?.kind==='formal_response_ref');if(formal.length>1)throw taskError('STUDY_TASK_SOURCE_CHANGED',409);if(formal.length)verified=await checkSource(db,user,s,studyId,{input:{evidenceRefs:[parseFormalRef(formal[0])]}},task);
   }
   if(previous){if(previous.request_hash!==digest)throw taskError('STUDY_TASK_IDEMPOTENCY_CONFLICT',409);return presentReceipt(previous.receipt,command.requestKey,action,studyId);}
   let recipients=[],notification=null;const notice='任务提醒：请核对当前任务及待办状态。';
   if(action==='remind'){
    const [recent]=await db.$queryRaw`SELECT id FROM rh_study_tasks.operation WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND task_id=${taskId} AND action='remind' AND created_at>clock_timestamp()-interval '60 seconds' LIMIT 1`;
    if(recent)throw taskError('STUDY_TASK_REMINDER_RATE_LIMIT',429,'同一任务一分钟内只能提醒一次');
    const ids=[...new Set([visibleTask.assigneeAccountId,...(visibleTask.collaborators??[]).map(x=>x.accountId)].filter(Boolean))].sort(),accounts=ids.length?await db.account.findMany({where:{tenantId:s.tenantId,id:{in:ids},status:'active'},select:{id:true,role:true,authVersion:true}}):[];
    for(const account of accounts){try{await auth(db,{accountId:account.id,tenantId:s.tenantId,role:account.role,authVersion:account.authVersion},s,'read',visibleTask);recipients.push(account.id);}catch(error){const code=error.code??error.getResponse?.()?.code;if(!['STUDY_TASK_AUTH_REQUIRED','STUDY_TASK_AUTH_STALE','STUDY_TASK_SCOPE_REJECTED'].includes(code))throw error;}}
    recipients.sort();if(!recipients.length)throw taskError('STUDY_TASK_NO_RECIPIENT',409,'没有当前可读取任务的有效收件人');
   }
   if(action==='transition'&&command.input.status==='completed'&&command.input.evidenceRefs?.[0]?.kind!=='formal_response_ref')await verifyTaskEvidence(db,a,command.input.evidenceRefs);
   const result=await core.execute(db,user,s,{action,...(taskId?{taskId}:{}),input:command.input,...(command.reason?{reason:command.reason}:{})});
   if(command.input.context){const c=command.input.context;await db.$executeRaw`INSERT INTO rh_study_tasks.context(task_id,tenant_id,study_group_id,research_project_id,kind,source_id,parent_id,root_id,source_version,source_hash,created_by,actor_account_id) VALUES(${result.id},${s.tenantId},${s.studyGroupId},${s.researchProjectId},${c.kind},${c.sourceId??null},${c.parentId??null},${c.rootId??null},${c.sourceVersion??null},${c.sourceHash??null},${a.actorAccountId},${a.actorAccountId}) ON CONFLICT(task_id) DO UPDATE SET kind=EXCLUDED.kind,source_id=EXCLUDED.source_id,parent_id=EXCLUDED.parent_id,root_id=EXCLUDED.root_id,source_version=EXCLUDED.source_version,source_hash=EXCLUDED.source_hash,actor_account_id=EXCLUDED.actor_account_id,updated_at=clock_timestamp()`;}
   if(action==='remind')notification=await db.studyNotification.create({data:{...s,kind:'task_reminder',studyTaskId:result.id,status:'recorded',createdBy:a.actorAccountId}});
   const operationId=randomUUID(),receipt={operationId,taskId:result.id,version:result.version};await db.auditLog.create({data:{...s,accountId:a.actorAccountId,action:'researchhub_study_task_'+action,target:result.id,meta:{operationId,expectedVersion:action==='create'?null:command.input.expectedVersion,version:result.version,fromStatus:null,toStatus:result.status??null,reason:command.reason??null,...(verified?{sourceKind:verified.context.kind,sourceContext:verified.context}: {})}}});
   if(action==='remind')await db.$executeRaw`INSERT INTO rh_study_tasks.operation(id,tenant_id,study_group_id,research_project_id,actor_account_id,request_key,request_hash,action,task_id,expected_version,result_version,reason,recipient_account_ids,notice,notification_id,receipt) VALUES(${operationId},${s.tenantId},${s.studyGroupId},${s.researchProjectId},${a.actorAccountId},${command.requestKey},${digest},${action},${result.id},${command.input.expectedVersion},${result.version},${null},${recipients}::text[],${notice},${notification.id},${JSON.stringify(receipt)}::jsonb)`;
   else await db.$executeRaw`INSERT INTO rh_study_tasks.operation(id,tenant_id,study_group_id,research_project_id,actor_account_id,request_key,request_hash,action,task_id,expected_version,result_version,reason,receipt) VALUES(${operationId},${s.tenantId},${s.studyGroupId},${s.researchProjectId},${a.actorAccountId},${command.requestKey},${digest},${action},${result.id},${action==='create'?null:command.input.expectedVersion},${result.version},${command.reason??null},${JSON.stringify(receipt)}::jsonb)`;
   return presentReceipt(receipt,command.requestKey,action,studyId);
  });},
 };
}
