import {researchError} from '../research-studies/contract.mjs';

const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const published=new Set(['needs_review','completed','needs_input']);
const unfinished=new Set(['queued','validating','running']);
const statuses=new Set(['queued','running','recovering','cancelling','completed','cancelled','blocked','failed']);
const changed=()=>{throw researchError(409,'ANALYSIS_JOB_PROGRESS_CHANGED','原分析进度暂不可核对，请保留任务记录后重新读取。');};
const unavailable=()=>{throw researchError(503,'ANALYSIS_JOB_PROGRESS_UNAVAILABLE','分析进度暂不可读取，原任务记录仍保留。');};
const scopeOf=row=>({tenantId:row.tenant_id,studyGroupId:row.study_group_id,researchProjectId:row.research_project_id});
const validTarget=target=>Boolean(target&&[target.targetId,target.snapshotId,target.methodKey].every(identifier)&&((target.runId===null&&target.inputHash===null)||(identifier(target.runId)&&digest(target.inputHash))));

// Only identifiers, status and provenance metadata are selected. No answers,
// numeric outputs, native result payloads, Job leases or Worker payloads.
export const executionJobViewRepository={
 nativeMetadata:(tx,s,ids)=>tx.$queryRaw`SELECT id AS "runId","tenantId","studyGroupId","researchProjectId","accountId","agentId","skillKey","skillVersion","executorVersion","sessionId","idempotencyKey" AS "methodKey",status,"inputHash","inputSummary"->>'studyId' AS "studyId","inputSummary"->>'snapshotId' AS "snapshotId",environment->'researchAnalysisJob' AS marker,environment->>'claim' AS claim FROM public.research_method_run WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND id=ANY(${ids}::text[])`,
 publicationProofs:(tx,s,authorId,ids)=>tx.$queryRaw`SELECT id,target AS "runId",meta->>'claim' AS claim FROM public.audit_log WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND "accountId"=${authorId} AND action='research_method_run_publish' AND target=ANY(${ids}::text[])`,
};

function issueFor(row){
 if(!['blocked','failed'].includes(row.status))return null;
 const code=row.error_code;
 if(['ANALYSIS_JOB_ACTOR_REVOKED','AUTH_SESSION_EXPIRED','METHOD_AUTHORIZATION_REVOKED','ANALYSIS_FORBIDDEN','FULL_STUDY_FORBIDDEN','HUB_ADMISSION_REQUIRED'].includes(code))return{code,message:'发起账号或研究权限已变化，本次分析已停止。请核对权限后查看原任务。'};
 if(['ANALYSIS_PLAN_CHANGED','ANALYSIS_PLAN_NOT_APPROVED','FULL_STUDY_PLAN_CHANGED','FULL_STUDY_PLAN_NOT_APPROVED'].includes(code))return{code,message:'统计计划或批准记录已变化，本次分析已停止。请先核对统计计划。'};
 if(['ANALYSIS_BASIS_STALE','FULL_STUDY_SOURCE_CHANGED','FULL_STUDY_SOURCE_NOT_LOCKED','PARTICIPATION_CAPTURE_BLOCKED','PROTOCOL_BINDING_CHANGED','QUALITY_GATE_REQUIRED','QUALITY_GATE_STALE','QUALITY_GATE_BLOCKED'].includes(code))return{code,message:'统计依据或使用条件已变化，本次分析已停止。请先核对数据来源与使用条件。'};
 if(code==='ANALYSIS_JOB_ATTEMPTS_EXHAUSTED')return{code,message:'计算未能完成，已停止自动接续。已生成的结果仍保留。'};
 if(code==='ANALYSIS_JOB_NATIVE_FAILED')return{code,message:'部分统计未能生成，已停止后续计算。请查看原运行记录。'};
 return{code:'ANALYSIS_JOB_NOT_COMPLETED',message:'本次分析尚未完成，原任务与已生成结果仍保留。请查看原运行记录。'};
}

/** Called inside the existing authorized Study transaction; reads never advance work. */
export function createExecutionJobPresenter({hash,availability,authorizeCancellationInTransaction,repository=executionJobViewRepository}={}){
 if(typeof hash!=='function'||typeof availability!=='function'||typeof authorizeCancellationInTransaction!=='function'||typeof repository?.nativeMetadata!=='function'||typeof repository?.publicationProofs!=='function')unavailable();
 return async(tx,reader,s,row)=>{
  if(!row||!s||!reader||reader.tenantId!==s.tenantId||!identifier(reader.accountId)||!Number.isSafeInteger(reader.authVersion)||reader.authVersion<0||row.study_id!==s.studyId||row.tenant_id!==s.tenantId||row.study_group_id!==s.studyGroupId||row.research_project_id!==s.researchProjectId||!Object.values(scopeOf(row)).every(identifier)||![row.id,row.actor_id,row.study_id,row.snapshot_id,row.plan_id].every(identifier)||!statuses.has(row.status)||!Number.isSafeInteger(row.actor_auth_version)||row.actor_auth_version<0||!['ordinary','full'].includes(row.branch)||!row.operator_ref||typeof row.operator_ref!=='object'||!digest(row.operator_hash)||hash(row.operator_ref)!==row.operator_hash)changed();
  const serviceAvailable=availability();if(typeof serviceAvailable!=='boolean')unavailable();
  const scope=scopeOf(row),cp=row.checkpoint,targets=cp?.targets;
  if(cp?.version!==1||!Array.isArray(targets)||!targets.length||targets.length>1000||row.branch==='ordinary'&&targets.length!==1||targets.some(t=>!validTarget(t))||new Set(targets.map(t=>t.targetId)).size!==targets.length||new Set(targets.map(t=>t.methodKey)).size!==targets.length||(cp.runGroupId!==null&&!identifier(cp.runGroupId))||(row.branch==='ordinary'&&cp.runGroupId!==null))changed();
  const bound=targets.filter(t=>t.runId!==null),ids=bound.map(t=>t.runId);
  if(new Set(ids).size!==ids.length)changed();
  const runs=ids.length?await repository.nativeMetadata(tx,scope,ids):[],proofs=ids.length?await repository.publicationProofs(tx,scope,row.actor_id,ids):[];
  if(!Array.isArray(runs)||!Array.isArray(proofs)||runs.length!==ids.length||new Set(runs.map(r=>r.runId)).size!==runs.length||runs.some(r=>!ids.includes(r.runId))||proofs.some(p=>!ids.includes(p.runId)||!identifier(p.id)))changed();
  const progress={total:targets.length,published:0,unfinished:targets.length-bound.length,failed:0,cancelled:0,needsInput:0};
  for(const target of bound){
   const run=runs.find(r=>r.runId===target.runId),expectedMarker={version:1,jobId:row.id,targetId:target.targetId,bindingHash:hash({jobId:row.id,targetId:target.targetId,scope,studyId:row.study_id,snapshotId:target.snapshotId,methodKey:target.methodKey,operator:row.operator_ref})};
   if(!run||!run.marker||typeof run.marker!=='object'||Object.entries(scope).some(([key,value])=>run[key]!==value)||run.accountId!==row.actor_id||run.agentId!==row.operator_ref.agentId||run.skillKey!=='descriptive-statistics'||run.skillVersion!==row.operator_ref.skillVersion||run.executorVersion!==row.operator_ref.executorVersion||!identifier(run.sessionId)||run.studyId!==row.study_id||run.snapshotId!==target.snapshotId||run.methodKey!==target.methodKey||run.inputHash!==target.inputHash||hash(run.marker)!==hash(expectedMarker))changed();
   const publication=proofs.filter(p=>p.runId===run.runId);
   if(published.has(run.status)){
    if(publication.length!==1||!identifier(run.claim)||publication[0].claim!==run.claim)changed();
    progress.published++;if(run.status==='needs_input')progress.needsInput++;
   }else{
    if(publication.length)changed();
    if(unfinished.has(run.status))progress.unfinished++;
    else if(run.status==='failed')progress.failed++;
    else if(run.status==='cancelled')progress.cancelled++;
    else changed();
   }
  }
  let canRequestCancellation=false;
  if(['queued','running','recovering'].includes(row.status)&&!row.cancellation_id){
   try{await authorizeCancellationInTransaction(tx,reader,s,row);canRequestCancellation=true;}
   catch(error){if((error?.getStatus?.()??error?.status)!==403)throw error;}
  }
  return{id:row.id,status:row.status,branch:row.branch,studyId:row.study_id,snapshotId:row.snapshot_id,planId:row.plan_id,manifestHash:row.manifest_hash,createdAt:row.created_at?new Date(row.created_at).toISOString():null,result:{runId:row.branch==='ordinary'?targets[0].runId:null,runGroupId:cp.runGroupId},progress,capabilities:{canRequestCancellation},serviceAvailable,issue:issueFor(row)};
 };
}
