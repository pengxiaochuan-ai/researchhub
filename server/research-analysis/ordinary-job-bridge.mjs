import {researchError} from '../research-studies/contract.mjs';
import {executionJobViewRepository} from './execution-job-view.mjs';

const published=new Set(['needs_review','completed','needs_input']);
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const changed=()=>{throw researchError(409,'ANALYSIS_JOB_BINDING_CHANGED','原分析绑定暂不可核对，请保留任务记录。');};
const failed=()=>{throw researchError(409,'ANALYSIS_JOB_NATIVE_FAILED','本次统计未能生成，请查看原运行记录。');};

// Only scoped identifiers, authorship and Native provenance. Never values, outputs or leases.
export const ordinaryJobBridgeRepository={
 jobMetadata:async(tx,ctx)=>(await tx.$queryRaw`SELECT actor_id,actor_auth_version,checkpoint FROM rh_analysis.execution_job WHERE id=${ctx.job.id} AND tenant_id=${ctx.scope.tenantId} AND study_group_id=${ctx.scope.studyGroupId} AND research_project_id=${ctx.scope.researchProjectId} AND study_id=${ctx.job.studyId}`)[0]??null,
 nativeMetadata:executionJobViewRepository.nativeMetadata,
 publicationProofs:executionJobViewRepository.publicationProofs,
 settlementProofs:(tx,s,authorId,ids,action)=>tx.$queryRaw`SELECT id,target AS "runId",meta->>'jobId' AS "jobId",meta->'runtimeFailure' AS "runtimeFailure",meta->>'errorCode' AS "errorCode" FROM public.audit_log WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND "accountId"=${authorId} AND action=${action} AND target=ANY(${ids}::text[])`,
};

/** Private ordinary branch; transaction composition and all Job/Native fences remain canonical. */
export function createOrdinaryJobBridge({methods,transaction,assertCurrent,hash,repository=ordinaryJobBridgeRepository}={}){
 if(!['prepareDescriptiveJobInTransaction','resumeDescriptiveJob','settleDescriptiveJobInTransaction'].every(k=>typeof methods?.[k]==='function')||![transaction,assertCurrent,hash].every(v=>typeof v==='function')||!['jobMetadata','nativeMetadata','publicationProofs','settlementProofs'].every(k=>typeof repository?.[k]==='function'))throw researchError(503,'ANALYSIS_JOB_BRIDGE_UNAVAILABLE','当前后台分析桥接暂不可用。');
 const repo=repository;
 function target(ctx){
  const j=ctx?.job,s=ctx?.scope,cp=j?.checkpoint,t=cp?.targets?.[0];
  if(j?.branch!=='ordinary'||!s||Object.keys(s).sort().join(',')!=='researchProjectId,studyGroupId,tenantId'||!Object.values(s).every(identifier)||![j.id,j.studyId,j.snapshotId,j.planId,j.reviewId,ctx.actor?.accountId].every(identifier)||ctx.actor.tenantId!==s.tenantId||!Number.isSafeInteger(ctx.actor.authVersion)||ctx.actor.authVersion<0||!digest(j.manifestHash)||!j.operator||cp?.version!==1||!Array.isArray(cp.targets)||cp.targets.length!==1||cp.runGroupId!==null||cp.pending!==null||!Array.isArray(cp.finishedClaimIds)||cp.finishedClaimIds.length||t?.targetId!=='ordinary'||t.sliceId!==undefined||t.snapshotId!==j.snapshotId||!identifier(t.methodKey)||!((t.runId===null&&t.inputHash===null)||(identifier(t.runId)&&digest(t.inputHash))))changed();return t;
 }
 async function source(tx,ctx){
  target(ctx);const current=await assertCurrent(tx,ctx),b=current?.basis,m=current?.manifest;
  if(b?.type!=='study-analysis-snapshot'||b.studyId!==ctx.job.studyId||b.snapshotId!==ctx.job.snapshotId||b.planId!==ctx.job.planId||b.planReviewId!==ctx.job.reviewId||b.manifestHash!==ctx.job.manifestHash||m?.schemaVersion!=='t15-formal-projection-v1'||m.studyId!==ctx.job.studyId||!m.scope||hash(m.scope)!==hash(ctx.scope))changed();
 }
 async function facts(tx,ctx){
  const t=target(ctx),original=await repo.jobMetadata(tx,ctx);
  if(!original||!identifier(original.actor_id)||!Number.isSafeInteger(original.actor_auth_version)||original.actor_auth_version<0||!original.checkpoint||hash(original.checkpoint)!==hash(ctx.job.checkpoint)||!ctx.settlement&&(ctx.actor.accountId!==original.actor_id||ctx.actor.authVersion!==original.actor_auth_version))changed();
  if(t.runId===null)return{t,run:null,original,state:'not_started',proofId:ctx.stopProofId??null};
  const rows=await repo.nativeMetadata(tx,ctx.scope,[t.runId]);if(!Array.isArray(rows)||rows.length!==1)changed();const run=rows[0],op=ctx.job.operator,marker={version:1,jobId:ctx.job.id,targetId:t.targetId,bindingHash:hash({jobId:ctx.job.id,targetId:t.targetId,scope:ctx.scope,studyId:ctx.job.studyId,snapshotId:t.snapshotId,methodKey:t.methodKey,operator:op})};
  if(!run||run.runId!==t.runId||Object.entries(ctx.scope).some(([k,v])=>run[k]!==v)||run.accountId!==original.actor_id||run.agentId!==op.agentId||run.skillKey!=='descriptive-statistics'||run.skillVersion!==op.skillVersion||run.executorVersion!==op.executorVersion||!identifier(run.sessionId)||run.studyId!==ctx.job.studyId||run.snapshotId!==t.snapshotId||run.methodKey!==t.methodKey||run.inputHash!==t.inputHash||!run.marker||hash(run.marker)!==hash(marker))changed();
  const proofs=await repo.publicationProofs(tx,ctx.scope,original.actor_id,[t.runId]);if(!Array.isArray(proofs))changed();
  if(published.has(run.status)){if(proofs.length!==1||!identifier(proofs[0].id)||proofs[0].runId!==run.runId||!identifier(run.claim)||proofs[0].claim!==run.claim)changed();return{t,run,original,state:'published',proofId:proofs[0].id};}
  if(proofs.length||!['queued','running','failed','cancelled'].includes(run.status))changed();return{t,run,original,state:run.status==='failed'?'failed':run.status==='cancelled'?'cancelled':'processing',proofId:null};
 }
 const proof=(ctx,f,status)=>({checkpoint:structuredClone(ctx.job.checkpoint),terminal:{status,targets:[{targetId:f.t.targetId,runId:f.t.runId,inputHash:f.t.inputHash,state:f.state,proofId:f.proofId}],openClaimIds:[]}});
 return Object.freeze({
  async advance(ctx){const t=target(ctx);if(typeof ctx.nativeContext!=='function')changed();if(t.runId===null){await transaction(ctx,tx=>methods.prepareDescriptiveJobInTransaction(tx,ctx.actor,ctx.nativeContext(t.targetId)));return;}await methods.resumeDescriptiveJob(ctx.actor,ctx.nativeContext(t.targetId));},
  async reconcile(tx,ctx){const f=await facts(tx,ctx);if(f.state==='failed'||f.state==='cancelled')failed();if(f.state!=='published')return{checkpoint:structuredClone(ctx.job.checkpoint),terminal:null};await source(tx,ctx);return proof(ctx,f,ctx.settlement?.kind==='cancel'?'cancelled':'completed');},
  async settle(tx,ctx,purpose){
   target(ctx);if(typeof ctx.nativeContext!=='function'||!purpose||hash(ctx.settlement)!==hash(purpose)||!(purpose.kind==='cancel'&&Object.keys(purpose).length===1||purpose.kind==='runtime-failure'&&purpose.code==='ANALYSIS_JOB_ATTEMPTS_EXHAUSTED'&&Object.keys(purpose).length===2))changed();
   await source(tx,ctx);await facts(tx,ctx);await methods.settleDescriptiveJobInTransaction(tx,ctx.actor,ctx.nativeContext('ordinary'),purpose);const f=await facts(tx,ctx),cancel=purpose.kind==='cancel';
   if(f.state==='not_started'){if(!identifier(f.proofId))changed();}
   else if(f.state!=='published'){
    if(f.state!==(cancel?'cancelled':'failed'))changed();const audits=await repo.settlementProofs(tx,ctx.scope,cancel?ctx.actor.accountId:f.original.actor_id,[f.t.runId],cancel?'research_method_run_cancel':'research_method_run_failed');
    if(!Array.isArray(audits)||audits.length!==1||!identifier(audits[0].id)||audits[0].runId!==f.t.runId||audits[0].jobId!==ctx.job.id||!cancel&&(audits[0].runtimeFailure!==true||audits[0].errorCode!==purpose.code))changed();f.proofId=audits[0].id;
   }
   return proof(ctx,f,cancel?'cancelled':f.state==='published'?'completed':'failed');
  },
 });
}
