import {createHmac,timingSafeEqual} from 'node:crypto';
import {taskError} from './authorization.mjs';
import {presentTaskEvidence} from './evidence.mjs';
import {readTaskContext} from './links.mjs';

const statuses=['open','in_progress','blocked','completed','cancelled'];
const reviews=['not_required','not_submitted','pending_review','accepted','returned'];
const idPattern=/^[A-Za-z0-9_-]{1,160}$/;
const invalid=()=>{throw taskError('STUDY_TASK_QUERY_INVALID',400,'任务查询参数无效');};
export function parseTaskQuery(params,allowed=['q','status','reviewStatus','assigneeAccountId','overdue','limit','cursor']) {
 const result={q:'',limit:20};
 for(const [key,value] of params){
  if(!allowed.includes(key)||params.getAll(key).length!==1||value.length>2048)invalid();
  if(key==='limit'){if(!/^(?:[1-9]|1[0-9]|20)$/.test(value))invalid();result.limit=Number(value);}
  else if(key==='q'){if(value.trim().length>120)invalid();result.q=value.trim();}
  else if(key==='status'){if(!statuses.includes(value))invalid();result.status=value;}
  else if(key==='reviewStatus'){if(!reviews.includes(value))invalid();result.reviewStatus=value;}
  else if(key==='overdue'){if(!['true','false'].includes(value))invalid();result.overdue=value==='true';}
  else if(key==='assigneeAccountId'){if(!idPattern.test(value))invalid();result.assigneeAccountId=value;}
  else if(key==='cursor'){if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))invalid();result.cursor=value;}
 }
 return result;
}
const cursorBinding=(authority,query)=>JSON.stringify({
 tenantId:authority.tenantId,studyGroupId:authority.studyGroupId,researchProjectId:authority.researchProjectId,
 actor:authority.actorAccountId,filters:Object.fromEntries(Object.entries(query).filter(([k])=>k!=='cursor').sort(([a],[b])=>a.localeCompare(b))),
});
export function createTaskCursor(secret) {
 if(typeof secret!=='string'||secret.length<32)throw new Error('S08_CURSOR_SECRET_REQUIRED');
 const sign=value=>createHmac('sha256',secret).update(value).digest('base64url');
 return {
  encode(authority,query,row){
   const body=Buffer.from(JSON.stringify({binding:cursorBinding(authority,query),id:row.id,createdAt:new Date(row.createdAt).toISOString()})).toString('base64url');
   return body+'.'+sign(body);
  },
  decode(authority,query,token){
   try{
    if(typeof token!=='string'||token.length>2048)throw new Error();
    const [body,sig,...rest]=token.split('.');const actual=Buffer.from(sig??'','base64url'),expected=Buffer.from(sign(body),'base64url');
    if(rest.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error();
    const data=JSON.parse(Buffer.from(body,'base64url'));
    if(data.binding!==cursorBinding(authority,query)||!idPattern.test(data.id)||typeof data.createdAt!=='string'||new Date(data.createdAt).toISOString()!==data.createdAt)throw new Error();
    return {id:data.id,createdAt:new Date(data.createdAt)};
   }catch{throw taskError('STUDY_TASK_CURSOR_INVALID',400,'翻页信息已失效，请返回第一页');}
  },
 };
}

const names={id:true,displayName:true};
export const taskSelect={id:true,tenantId:true,studyGroupId:true,researchProjectId:true,name:true,taskType:true,source:true,
 status:true,reviewStatus:true,requiresReview:true,priority:true,assigneeAccountId:true,dueAt:true,version:true,
 createdAt:true,updatedAt:true,blockedReason:true,completionNote:true,evidenceRefs:true,reviewNote:true,reviewedBy:true,reviewedAt:true,
 dependsOnTaskId:true,assignee:{select:names},reviewer:{select:names},
 collaborators:{select:{accountId:true,account:{select:names}}},dependencies:{select:{dependsOnTaskId:true}}};
export function taskVisibility(authority) {
 return authority.readAll?{}:{OR:[{assigneeAccountId:authority.actorAccountId},{collaborators:{some:{accountId:authority.actorAccountId}}}]};
}
export function taskScope(authority) {
 return {tenantId:authority.tenantId,studyGroupId:authority.studyGroupId,researchProjectId:authority.researchProjectId,acceptanceFixture:false};
}
const iso=value=>value?new Date(value).toISOString():null;
const person=value=>value?{id:value.id,displayName:value.displayName||'未设置姓名'}:null;
export function taskCapabilities(authority,task) {
 if(Array.isArray(authority.writableTaskIds)&&!authority.writableTaskIds.includes(task.id))return {
  canConfigure:false,canAssign:false,canReview:false,canRemind:false,canLink:false,requiresActingReason:false,
  transitions:[],readOnlyReason:'前序任务在本轮合成环境仅供只读核对',
 };
 const assigned=task.assigneeAccountId===authority.actorAccountId||task.collaborators?.some(c=>c.accountId===authority.actorAccountId);
 const ended=['completed','cancelled'].includes(task.status);
 const executor=authority.canExecute&&(authority.isTenantAdmin||assigned);
 const transitions={open:['in_progress','blocked'],in_progress:['blocked','completed'],blocked:['in_progress']}[task.status]??[];
 return {canConfigure:authority.canConfigure&&!ended,canAssign:authority.canConfigure&&!ended,
  canReview:authority.canReview&&task.status==='completed'&&task.reviewStatus==='pending_review',
  canRemind:authority.readAll||authority.canExecute&&assigned,canLink:authority.canConfigure&&!ended,
  requiresActingReason:authority.isTenantAdmin&&!assigned,
  transitions:[...(executor?transitions:[]),...(!ended&&authority.canConfigure?['cancelled']:[])]};
}
export function projectTask(row,authority,now=new Date()) {
 return {id:row.id,name:row.name||row.taskType,status:row.status,reviewStatus:row.reviewStatus,
  priority:row.priority,source:row.source,taskType:row.taskType,requiresReview:row.requiresReview,
  assignee:person(row.assignee),collaborators:(row.collaborators??[]).map(c=>person(c.account)),
  dueAt:iso(row.dueAt),overdue:Boolean(row.dueAt)&&new Date(row.dueAt)<now&&!['completed','cancelled'].includes(row.status),
  version:row.version,createdAt:iso(row.createdAt),updatedAt:iso(row.updatedAt),capabilities:taskCapabilities(authority,row)};
}
export async function readTaskPage(db,authority,query,cursor,now=new Date()) {
 const AND=[taskVisibility(authority)];
 if(query.q)AND.push({name:{contains:query.q,mode:'insensitive'}});
 if(query.status)AND.push({status:query.status});
 if(query.reviewStatus)AND.push({reviewStatus:query.reviewStatus});
 if(query.assigneeAccountId)AND.push({assigneeAccountId:query.assigneeAccountId});
 if(query.overdue!==undefined){const overdue={dueAt:{lt:now},status:{notIn:['completed','cancelled']}};AND.push(query.overdue?overdue:{NOT:overdue});}
 if(query.cursor){const last=cursor.decode(authority,query,query.cursor);AND.push({OR:[{createdAt:{lt:last.createdAt}},{createdAt:last.createdAt,id:{lt:last.id}}]});}
 const rows=await db.studyTask.findMany({where:{...taskScope(authority),AND},select:taskSelect,orderBy:[{createdAt:'desc'},{id:'desc'}],take:query.limit+1});
 const items=rows.slice(0,query.limit);
 return {items:items.map(r=>projectTask(r,authority,now)),nextCursor:rows.length>query.limit?cursor.encode(authority,query,items.at(-1)):null};
}
export async function findReadableTask(db,authority,id) {
 if(!idPattern.test(id))throw taskError('STUDY_TASK_QUERY_INVALID',400);
 const task=await db.studyTask.findFirst({where:{...taskScope(authority),id,AND:[taskVisibility(authority)]},select:taskSelect});
 if(!task)throw taskError('STUDY_TASK_AUTH_REQUIRED');
 return task;
}
export async function readTaskReviewSummary(db,authority,task){
 if(task.status!=='completed'&&task.reviewStatus!=='returned')return {submission:null,sameActorReview:null};
 const event=await db.auditLog.findFirst({where:{tenantId:authority.tenantId,studyGroupId:authority.studyGroupId,researchProjectId:authority.researchProjectId,target:task.id,
  OR:[{action:'researchhub_study_task_transition',meta:{path:['toStatus'],equals:'completed'}},{action:'study_task_update',meta:{path:['to'],equals:'completed'}}]},select:{accountId:true,createdAt:true,meta:true},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 if(!event?.accountId)return {submission:null,sameActorReview:null};
 const actor=await db.account.findFirst({where:{id:event.accountId,tenantId:authority.tenantId},select:{id:true,displayName:true}});
 if(!actor)return {submission:null,sameActorReview:null};
 const version=Number.isSafeInteger(event.meta?.version)?event.meta.version:Number.isSafeInteger(event.meta?.expectedVersion)?event.meta.expectedVersion+1:null;
 return {submission:{actor:person(actor),createdAt:iso(event.createdAt),version},sameActorReview:task.reviewedBy?task.reviewedBy===actor.id:null};
}
export async function readTaskDetail(db,authority,id,contextDeps) {
 const task=await findReadableTask(db,authority,id);
 const dependencyIds=[...new Set([task.dependsOnTaskId,...(task.dependencies??[]).map(d=>d.dependsOnTaskId)].filter(Boolean))];
 const visible=dependencyIds.length?await db.studyTask.findMany({where:{...taskScope(authority),id:{in:dependencyIds},AND:[taskVisibility(authority)]},select:{id:true,name:true,status:true,reviewStatus:true}}):[];
 const dependencies=dependencyIds.map(key=>{const t=visible.find(d=>d.id===key);return t?{readable:true,id:t.id,name:t.name,status:t.status,reviewStatus:t.reviewStatus}:{readable:false};});
 const parents=dependencyIds.length?await db.studyTask.findMany({where:{...taskScope(authority),id:{in:dependencyIds}},select:{id:true,status:true,requiresReview:true,reviewStatus:true}}):[];
 const dependenciesReady=parents.length===dependencyIds.length&&parents.every(parent=>parent.status==='completed'&&(!parent.requiresReview||parent.reviewStatus==='accepted'));
 const projected=projectTask(task,authority);
 if(!dependenciesReady)projected.capabilities.transitions=projected.capabilities.transitions.filter(status=>status!=='in_progress');
 const history=await db.$queryRaw`SELECT o.id,o.action,o.expected_version,o.result_version,o.reason,o.notice,o.created_at,
    a.id actor_id,a."displayName" actor_name FROM rh_study_tasks.operation o JOIN account a ON a.id=o.actor_account_id AND a."tenantId"=o.tenant_id
    WHERE o.tenant_id=${authority.tenantId} AND o.study_group_id=${authority.studyGroupId} AND o.research_project_id=${authority.researchProjectId}
    AND o.task_id=${id} AND (o.action<>'remind' OR ${authority.actorAccountId}=ANY(o.recipient_account_ids) OR o.actor_account_id=${authority.actorAccountId})
    ORDER BY o.created_at DESC,o.id DESC LIMIT 30`;
 const audits=history.length?await db.auditLog.findMany({where:{tenantId:authority.tenantId,studyGroupId:authority.studyGroupId,researchProjectId:authority.researchProjectId,target:id,
  action:{in:['create','edit','assign','transition','review','remind','link'].map(action=>'researchhub_study_task_'+action)}},select:{meta:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:90}):[];
 const [c]=await db.$queryRaw`SELECT kind,source_id,parent_id,root_id,source_version,source_hash FROM rh_study_tasks.context WHERE task_id=${id}
  AND tenant_id=${authority.tenantId} AND study_group_id=${authority.studyGroupId} AND research_project_id=${authority.researchProjectId}`;
 const context=await readTaskContext(db,authority,c?{kind:c.kind,sourceId:c.source_id,parentId:c.parent_id,rootId:c.root_id,sourceVersion:c.source_version,sourceHash:c.source_hash}:null,contextDeps);
 return {item:{...projected,dependenciesReady,context,blockedReason:task.blockedReason??null,completionNote:task.completionNote??null,
  evidence:await presentTaskEvidence(db,authority,task.evidenceRefs),reviewNote:task.reviewNote??null,reviewer:person(task.reviewer),reviewedAt:iso(task.reviewedAt),dependencies,
  ...await readTaskReviewSummary(db,authority,task),
  history:history.map(h=>{const meta=audits.find(a=>a.meta?.operationId===h.id)?.meta;return {id:h.id,action:h.action,expectedVersion:h.expected_version,resultVersion:h.result_version,
   fromStatus:statuses.includes(meta?.fromStatus)?meta.fromStatus:null,toStatus:statuses.includes(meta?.toStatus)?meta.toStatus:null,
   reviewDecision:['accept','return'].includes(meta?.reviewDecision)?meta.reviewDecision:null,
   reason:h.reason??(typeof meta?.reviewNote==='string'?meta.reviewNote:null),notice:h.notice??null,createdAt:iso(h.created_at),actor:{id:h.actor_id,displayName:h.actor_name||'未设置姓名'}};})}};
}
export async function readTaskReceipt(db,authority,key) {
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(key))throw taskError('STUDY_TASK_QUERY_INVALID',400);
 const [row]=await db.$queryRaw`SELECT task_id,receipt FROM rh_study_tasks.operation WHERE tenant_id=${authority.tenantId}
  AND study_group_id=${authority.studyGroupId} AND research_project_id=${authority.researchProjectId}
  AND actor_account_id=${authority.actorAccountId} AND request_key=${key}`;
 if(!row)throw taskError('STUDY_TASK_RECEIPT_NOT_FOUND',404,'尚未查到提交回执，不代表提交必未发生');
 await findReadableTask(db,authority,row.task_id);
 return row.receipt;
}
