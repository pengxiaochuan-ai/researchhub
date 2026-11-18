import {randomUUID} from 'node:crypto';
import {only,validateMutation,researchError,requestHash} from '../research-studies/contract.mjs';
import {setContext,getReceipt,saveReceipt} from '../research-studies/repository.mjs';

const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const action='analysis.job.create',cancelAction='analysis.job.cancel';
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const unavailable=()=>fail(503,'ANALYSIS_JOB_AUTHORITY_UNAVAILABLE','当前后台分析尚不可接纳，请保留已放行记录。');
const changed=()=>fail(409,'ANALYSIS_JOB_ACTOR_CHANGED','原操作属于账号的其他授权版本，请只读查看原任务。');
const conflict=()=>fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他操作，请核对原记录。');
const missing=()=>fail(404,'ANALYSIS_JOB_RECEIPT_NOT_FOUND','暂未查到此后台分析操作，请保留原记录。');
const requireJobId=value=>{if(!identifier(value))fail(400,'RESEARCH_INPUT_INVALID','分析任务标识无效，请返回原任务。');};
const operatorKeys=['agentId','skillId','skillKey','skillVersion','executorVersion','configurationHash'];
function operator(value){
 if(!value||Object.keys(value).some(k=>!operatorKeys.includes(k))||!identifier(value.agentId)||!identifier(value.skillId)||value.skillKey!=='descriptive-statistics'||!Number.isSafeInteger(value.skillVersion)||value.skillVersion<1||typeof value.executorVersion!=='string'||!value.executorVersion.length||value.executorVersion.length>160||!digest(value.configurationHash))unavailable();
 return structuredClone(value);
}
function fixed(value,snapshotId){
 if(!value||Object.keys(value).some(k=>!['branch','snapshotId','planId','reviewId','manifestHash','slices'].includes(k))||!['ordinary','full'].includes(value.branch)||value.snapshotId!==snapshotId||![value.planId,value.reviewId].every(identifier)||!digest(value.manifestHash))unavailable();
 if(value.branch==='full'&&(!Array.isArray(value.slices)||value.slices.length<1||value.slices.length>1000||value.slices.some(s=>!s||Object.keys(s).some(k=>!['sliceId','snapshotId'].includes(k))||![s.sliceId,s.snapshotId].every(identifier)||s.snapshotId===snapshotId)||new Set(value.slices.map(s=>s.sliceId)).size!==value.slices.length||new Set(value.slices.map(s=>s.snapshotId)).size!==value.slices.length))unavailable();
 if(value.branch==='ordinary'&&value.slices!==undefined)unavailable();
 return structuredClone(value);
}
function view(row){
 return {id:row.id,status:row.status,branch:row.branch,studyId:row.study_id,snapshotId:row.snapshot_id,planId:row.plan_id,manifestHash:row.manifest_hash,
  createdAt:row.created_at?new Date(row.created_at).toISOString():null,
  result:{runId:row.branch==='ordinary'?row.checkpoint?.targets?.[0]?.runId??null:null,runGroupId:row.checkpoint?.runGroupId??null}};
}
function admission(row,job){return {studyId:row.study_id,job,receipt:{requestKey:row.request_key,action,targetId:row.id,studyId:row.study_id,requestHash:row.request_hash,authVersion:row.actor_auth_version}};}
function exact(row,s){if(!row||row.tenant_id!==s.tenantId||row.study_group_id!==s.studyGroupId||row.research_project_id!==s.researchProjectId||row.study_id!==s.studyId)missing();return row;}

// All SQL is scoped and runs only when a caller invokes a method. Importing does not open a connection.
export const executionJobRepository={
 async lockRequest(tx,s,u,key){await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${requestHash({tenantId:s.tenantId,studyId:s.studyId,actorId:u.accountId,key})},0))::text`;},
 async findByRequest(tx,s,u,key){return(await tx.$queryRaw`SELECT * FROM rh_analysis.execution_job WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${s.studyId} AND actor_id=${u.accountId} AND request_key=${key}`)[0]??null;},
 async findById(tx,s,id,lock=false){return(lock?await tx.$queryRaw`SELECT * FROM rh_analysis.execution_job WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${s.studyId} AND id=${id} FOR UPDATE`:await tx.$queryRaw`SELECT * FROM rh_analysis.execution_job WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${s.studyId} AND id=${id}`)[0]??null;},
 async audit(tx,data){await tx.auditLog.createMany({data});},
 async insert(tx,r){return(await tx.$queryRaw`INSERT INTO rh_analysis.execution_job (id,tenant_id,study_group_id,research_project_id,study_id,deployment_id,actor_id,actor_auth_version,request_key,request_hash,branch,snapshot_id,plan_id,review_id,manifest_hash,operator_ref,operator_hash,native_create_key,admission_audit_id,checkpoint)
 VALUES (${r.id},${r.tenant_id},${r.study_group_id},${r.research_project_id},${r.study_id},${r.deployment_id},${r.actor_id},${r.actor_auth_version},${r.request_key},${r.request_hash},${r.branch},${r.snapshot_id},${r.plan_id},${r.review_id},${r.manifest_hash},${JSON.stringify(r.operator_ref)}::jsonb,${r.operator_hash},${r.native_create_key},${r.admission_audit_id},${JSON.stringify(r.checkpoint)}::jsonb) RETURNING *`)[0];},
 cancellationReceipt:(tx,_s,u,key)=>getReceipt(tx,u,key),
 saveCancellation:(tx,r)=>saveReceipt(tx,{tenantId:r.tenant_id,accountId:r.actor_id},{id:r.id,key:r.request_key,hash:r.request_hash,action:cancelAction,target:r.target_id,result:r.result,auditId:r.audit_id}),
 async requestCancellation(tx,row,c){return(await tx.$queryRaw`UPDATE rh_analysis.execution_job SET status='cancelling',lease_generation=lease_generation+1,lease_token=NULL,lease_owner=NULL,lease_expires_at=NULL,heartbeat_at=NULL,cancellation_id=${c.id},updated_at=clock_timestamp() WHERE id=${row.id} AND tenant_id=${row.tenant_id} AND status=${row.status} AND lease_generation=${row.lease_generation} AND cancellation_id IS NULL RETURNING *`)[0];},
};

export function createExecutionJobs({studies,authority,deployment,repository=executionJobRepository,id=randomUUID,presentInTransaction,assertAdmissionReady}){
 if(typeof studies?.withResearchStudyTransaction!=='function'||typeof authority?.resolveFixedBasisInTransaction!=='function'||typeof authority?.authorizeOperatorInTransaction!=='function'||presentInTransaction!==undefined&&typeof presentInTransaction!=='function'||assertAdmissionReady!==undefined&&typeof assertAdmissionReady!=='function'||!identifier(deployment?.deploymentId)||!Array.isArray(deployment.allowedTenantIds)||!deployment.allowedTenantIds.length||!deployment.allowedTenantIds.every(identifier)||new Set(deployment.allowedTenantIds).size!==deployment.allowedTenantIds.length)throw Error('ANALYSIS_JOB_DEPENDENCIES_REQUIRED');
 const config=structuredClone(deployment),repo=repository;
 const present=(tx,actor,s,row)=>presentInTransaction?presentInTransaction(tx,actor,s,row):view(row);
 const ready=async()=>{if(await assertAdmissionReady?.()===false)fail(503,'ANALYSIS_JOB_CONSUMER_UNAVAILABLE','后台分析暂不可用，原任务记录仍保留。');};
 function transaction(u,studyId,fn){
  if(!u||!identifier(u.accountId)||!Number.isSafeInteger(u.authVersion)||u.authVersion<0||!config.allowedTenantIds.includes(u.tenantId)||!identifier(studyId))fail(401,'AUTH_SESSION_EXPIRED','当前身份不可用于分析操作。');
  return studies.withResearchStudyTransaction(u,studyId,'read',async(tx,c)=>{
   const s={tenantId:c.tenantId,studyId:c.studyId,studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId};
   if(s.tenantId!==u.tenantId||s.studyId!==studyId||!Object.values(s).every(identifier))unavailable();
   await setContext(tx,u,s.studyGroupId,s.researchProjectId);return fn(tx,s,{...u,studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId});
  },{includeOfficial:true}).catch(error=>{if(error?.code==='P2002'||error?.meta?.code==='23505')conflict();throw error;});
 }
 function receiptActor(row,u){if(row.actor_id!==u.accountId)missing();if(row.actor_auth_version!==u.authVersion)changed();}
 function savedCancellation(saved,u,s,jobId,key,hash){
  if(!saved)return null;
  if(saved.action!==cancelAction||saved.target_id!==jobId||saved.result?.studyId!==s.studyId||saved.result?.jobId!==jobId||saved.result?.receipt?.requestKey!==key||saved.result?.receipt?.requestHash!==saved.request_hash||saved.result?.receipt?.targetId!==jobId||hash&&hash!==saved.request_hash)conflict();
  if(saved.result.receipt.authVersion!==u.authVersion)changed();return saved.result;
 }
 return Object.freeze({
  async create(u,studyId,body){
   only(body,['requestKey','snapshotId']);validateMutation(body);if(!identifier(body.snapshotId))fail(400,'RESEARCH_INPUT_INVALID','请选择已放行的数据。');
   const hash=requestHash({action,studyId,body});
   return transaction(u,studyId,async(tx,s,actor)=>{
    await repo.lockRequest(tx,s,actor,body.requestKey);const old=await repo.findByRequest(tx,s,actor,body.requestKey);
    if(old){exact(old,s);if(old.request_hash!==hash)conflict();receiptActor(old,actor);return admission(old,await present(tx,actor,s,old));}
    await ready();
    const basis=fixed(await authority.resolveFixedBasisInTransaction(tx,actor,s,body.snapshotId),body.snapshotId),ref=operator(await authority.authorizeOperatorInTransaction(tx,actor,s));
    const jobId='analysis-job-'+id(),auditId='analysis-job-audit-'+id(),nativeKey='analysis-job-native-'+requestHash({jobId}),items=basis.branch==='ordinary'?[{targetId:'ordinary',snapshotId:body.snapshotId}]:basis.slices.map(v=>({targetId:v.sliceId,sliceId:v.sliceId,snapshotId:v.snapshotId}));
    const row={id:jobId,tenant_id:s.tenantId,study_group_id:s.studyGroupId,research_project_id:s.researchProjectId,study_id:studyId,deployment_id:config.deploymentId,actor_id:actor.accountId,actor_auth_version:actor.authVersion,request_key:body.requestKey,request_hash:hash,branch:basis.branch,snapshot_id:body.snapshotId,plan_id:basis.planId,review_id:basis.reviewId,manifest_hash:basis.manifestHash,operator_ref:ref,operator_hash:requestHash(ref),native_create_key:nativeKey,admission_audit_id:auditId,status:'queued',lease_generation:0,compute_attempt:0,checkpoint:{version:1,runGroupId:null,targets:items.map(v=>({...v,methodKey:basis.branch==='ordinary'?nativeKey:'analysis-job-native-slice-'+requestHash({studyId,actor:actor.accountId,requestKey:nativeKey,snapshotId:v.snapshotId}),runId:null,inputHash:null})),pending:null,finishedClaimIds:[]}};
    await ready();
    await repo.audit(tx,{id:auditId,tenantId:s.tenantId,studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId,accountId:actor.accountId,action:'researchhub.'+action,target:jobId,meta:{studyId,requestKey:body.requestKey,requestHash:hash,authVersion:actor.authVersion,snapshotId:body.snapshotId}});
    const saved=await repo.insert(tx,row);return admission(saved,await present(tx,actor,s,saved));
   });
  },
  read:(u,studyId,jobId)=>{requireJobId(jobId);return transaction(u,studyId,async(tx,s,actor)=>({studyId,job:await present(tx,actor,s,exact(await repo.findById(tx,s,jobId),s))}));},
  receipt:(u,studyId,key)=>{validateMutation({requestKey:key});return transaction(u,studyId,async(tx,s,actor)=>{const row=exact(await repo.findByRequest(tx,s,actor,key),s);receiptActor(row,actor);return admission(row,await present(tx,actor,s,row));});},
  async cancel(u,studyId,jobId,body){
   requireJobId(jobId);only(body,['requestKey']);validateMutation(body);
   return transaction(u,studyId,async(tx,s,actor)=>{
    await repo.lockRequest(tx,s,actor,body.requestKey);
    const hash=requestHash({action:cancelAction,studyId,jobId,body}),saved=savedCancellation(await repo.cancellationReceipt(tx,s,actor,body.requestKey),actor,s,jobId,body.requestKey,hash);if(saved)return saved;
    const row=exact(await repo.findById(tx,s,jobId,true),s);
    if(row.cancellation_id||row.cancellation||['cancelling','completed','cancelled','blocked','failed'].includes(row.status))fail(409,'ANALYSIS_JOB_NOT_CANCELLABLE','此任务已有停止请求或已结束，请查看原任务。');
    if(typeof authority.authorizeCancellationInTransaction!=='function')unavailable();await authority.authorizeCancellationInTransaction(tx,actor,s,row);
    const operationId='analysis-job-cancel-'+id(),auditId='analysis-job-cancel-audit-'+id(),result={studyId,jobId,status:'cancelling',receipt:{requestKey:body.requestKey,action:cancelAction,targetId:jobId,requestHash:hash,authVersion:actor.authVersion}};
    await repo.audit(tx,{id:auditId,tenantId:s.tenantId,studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId,accountId:actor.accountId,action:'researchhub.'+cancelAction,target:jobId,meta:{studyId,requestKey:body.requestKey,requestHash:hash,authVersion:actor.authVersion}});
    const savedRow={id:operationId,tenant_id:s.tenantId,actor_id:actor.accountId,request_key:body.requestKey,request_hash:hash,action:cancelAction,target_id:jobId,result,audit_id:auditId};await repo.saveCancellation(tx,savedRow);
    if(!await repo.requestCancellation(tx,row,savedRow))conflict();return result;
   });
  },
  cancellationReceipt:(u,studyId,jobId,key)=>{requireJobId(jobId);validateMutation({requestKey:key});return transaction(u,studyId,async(tx,s,actor)=>{exact(await repo.findById(tx,s,jobId),s);const result=savedCancellation(await repo.cancellationReceipt(tx,s,actor,key),actor,s,jobId,key);if(!result)missing();return result;});},
 });
}
