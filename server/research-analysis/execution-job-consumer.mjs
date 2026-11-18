import {randomUUID} from 'node:crypto';

const active=['queued','running','recovering','cancelling'],published=['needs_review','completed','needs_input'];
const POLL_MS=1000,HEARTBEAT_MS=20000,LEASE_MS=120000;
const fullSourceFaults=new Set(['ANALYSIS_BASIS_STALE','FULL_STUDY_CASE_CHANGED','FULL_STUDY_PROTOCOL_CHANGED',
 'FULL_STUDY_POLICY_CHANGED','FULL_STUDY_SUBJECT_CHANGED','FULL_STUDY_FORM_CHANGED','FULL_STUDY_ENROLLMENT_CHANGED',
 'FULL_STUDY_VISIT_CHANGED','FULL_STUDY_ASSIGNMENT_DUPLICATE','FULL_STUDY_SOURCE_NOT_LOCKED','FULL_STUDY_SOURCE_CHANGED',
 'FULL_STUDY_SCORE_ALGORITHM_CHANGED','FULL_STUDY_PLAN_CHANGED','FULL_STUDY_PLAN_NOT_APPROVED','FULL_STUDY_SLICE_CHANGED',
 'PARTICIPATION_CAPTURE_BLOCKED','PROTOCOL_BINDING_CHANGED','FORM_REVISION_INTEGRITY_INVALID','FORM_LEGACY_UNVERSIONED',
 'FULL_STUDY_NUMERIC_RANGE','FULL_STUDY_OBSERVATION_INVALID','FULL_STUDY_VISIT_MAP_INVALID','FULL_STUDY_VARIABLES_INVALID']);
const fullQualityFaults=new Set(['QUALITY_GATE_REQUIRED','QUALITY_GATE_STALE','QUALITY_GATE_BLOCKED']);
const fullConfigurationFaults=new Set(['FULL_STUDY_BATCH_NATIVE_UNAVAILABLE','FULL_STUDY_BATCH_UNAVAILABLE','FULL_STUDY_PREPARE_UNAVAILABLE','FULL_STUDY_PUBLICATION_AUTHORITY_UNAVAILABLE','FULL_STUDY_PROCESS_AUTHORITY_UNAVAILABLE','FULL_STUDY_CANCEL_AUTHORITY_UNAVAILABLE']);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const lost=()=>fail('DESCRIPTIVE_JOB_FENCE_LOST');
const scope=r=>({tenantId:r.tenant_id,studyGroupId:r.study_group_id,researchProjectId:r.research_project_id});
const clearLease={lease_token:null,lease_owner:null,lease_expires_at:null,heartbeat_at:null};
const actor=(r,accountId=r.actor_id,authVersion=r.actor_auth_version)=>({...scope(r),accountId,authVersion});

// Application-role transactions only. Discovery's definer returns metadata, not execution authority.
export const executionJobConsumerRepository={
 discover:(prisma,tenant,deployment,limit)=>prisma.withTenantTransaction(tenant,undefined,undefined,async tx=>{
  await tx.$executeRaw`SELECT set_config('app.analysis_deployment_id',${deployment},true)`;
  return tx.$queryRaw`SELECT * FROM rh_analysis.discover_execution_jobs(${tenant},${deployment},${limit}::integer)`;
 }),
 async lock(tx,s,jobId){return(await tx.$queryRaw`SELECT * FROM rh_analysis.execution_job WHERE id=${jobId} AND tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} FOR UPDATE`)[0]??null;},
 async read(tx,s,jobId){return(await tx.$queryRaw`SELECT * FROM rh_analysis.execution_job WHERE id=${jobId} AND tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId}`)[0]??null;},
 async clock(tx){const r=(await tx.$queryRaw`SELECT clock_timestamp() AS now,pg_backend_pid()::text AS "backendPid",txid_current()::text AS "transactionId"`)[0];return r;},
 account:(tx,accountId)=>tx.account.findUnique({where:{id:accountId},include:{tenant:true}}),
 async cancellation(tx,r){return(await tx.$queryRaw`SELECT o.*,to_jsonb(a) AS cancellation_audit FROM rh_research.operation o JOIN public.audit_log a ON a.id=o.audit_id WHERE o.id=${r.cancellation_id} AND o.tenant_id=${r.tenant_id}`)[0]??null;},
 async replace(tx,r,n,claim=false){return(await tx.$queryRaw`UPDATE rh_analysis.execution_job SET status=${n.status},lease_generation=${n.lease_generation},compute_attempt=${n.compute_attempt},checkpoint=${JSON.stringify(n.checkpoint)}::jsonb,lease_token=${n.lease_token},lease_owner=${n.lease_owner},lease_expires_at=${n.lease_expires_at},heartbeat_at=${n.heartbeat_at},error_code=${n.error_code??null},terminal_at=${n.terminal_at},updated_at=clock_timestamp()
  WHERE id=${r.id} AND tenant_id=${r.tenant_id} AND study_group_id=${r.study_group_id} AND research_project_id=${r.research_project_id} AND study_id=${r.study_id} AND status=${r.status} AND lease_generation=${r.lease_generation}
  AND lease_token IS NOT DISTINCT FROM ${r.lease_token} AND lease_owner IS NOT DISTINCT FROM ${r.lease_owner}
  AND ((${claim} AND (lease_expires_at IS NULL OR lease_expires_at<=clock_timestamp())) OR (NOT ${claim} AND lease_token IS NOT NULL AND lease_expires_at>clock_timestamp())) RETURNING *`)[0]??null;},
 audit:(tx,data)=>tx.auditLog.create({data}),
 auditById:(tx,auditId)=>tx.auditLog.findUnique({where:{id:auditId}}),
 async nativeRun(tx,runId){return(await tx.$queryRaw`SELECT id AS "runId","tenantId","studyGroupId","researchProjectId","accountId","sessionId","agentId","skillVersion","executorVersion",status,"inputHash","updatedAt","idempotencyKey" AS "methodKey","inputSummary"->>'studyId' AS "studyId","inputSummary"->>'snapshotId' AS "snapshotId",environment->>'claim' AS claim,environment->'researchAnalysisJob' AS marker FROM public.research_method_run WHERE id=${runId}`)[0]??null;},
 reservations:(tx,s,u,op)=>tx.$queryRaw`SELECT * FROM rh_analysis.execution_job j WHERE j.tenant_id=${s.tenantId} AND j.study_group_id=${s.studyGroupId} AND j.research_project_id=${s.researchProjectId} AND (j.native_create_key=${op.methodKey} OR EXISTS(SELECT 1 FROM jsonb_array_elements(j.checkpoint->'targets') t WHERE t->>'methodKey'=${op.methodKey}) OR (j.study_id=${op.studyId} AND j.actor_id=${u.accountId} AND j.status IN ('queued','running','recovering','cancelling') AND (j.snapshot_id=${op.snapshotId} OR EXISTS(SELECT 1 FROM jsonb_array_elements(j.checkpoint->'targets') t WHERE t->>'snapshotId'=${op.snapshotId}))))`,
};

/** Server composition supplies the canonical issuer/hash and genuine ordinary/full bridges. No work starts at import or construction. */
export function createExecutionJobConsumer({prisma,withAuthorizationMutation,issuer,canonicalHash:hash,deployment,createBranches,repository=executionJobConsumerRepository,timers=globalThis}){
 const required=['discover','lock','read','clock','account','cancellation','replace','audit','auditById','nativeRun','reservations'];
 if(!prisma||typeof withAuthorizationMutation!=='function'||typeof issuer?.issue!=='function'||typeof issuer?.read!=='function'||typeof hash!=='function'||typeof createBranches!=='function'||!id(deployment?.deploymentId)||!Array.isArray(deployment.allowedTenantIds)||!deployment.allowedTenantIds.length||!deployment.allowedTenantIds.every(id)||new Set(deployment.allowedTenantIds).size!==deployment.allowedTenantIds.length||required.some(k=>typeof repository[k]!=='function')||typeof timers.setInterval!=='function'||typeof timers.clearInterval!=='function')fail('ANALYSIS_JOB_CONSUMER_UNAVAILABLE');
 const config=structuredClone(deployment),repo=repository,owner=randomUUID(),leases=new WeakMap(),lockedTransactions=new WeakMap();
 let running=null,starting=null,stopPromise=null,pollTimer=null,heartbeatTimer=null,stopping=false,unavailable=null;
 const equal=(a,b)=>a===undefined||b===undefined?a===b:hash(a)===hash(b),stamp=c=>{if(!c||!Number.isFinite(+new Date(c.now))||!/^\d+$/.test(String(c.backendPid))||!/^\d+$/.test(String(c.transactionId)))lost();return`${c.backendPid}:${c.transactionId}`;};
 const transact=(s,fn)=>withAuthorizationMutation(prisma,s.tenantId,fn,{studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId,includeOfficial:true});
 function validRow(r){if(!r||![r.id,r.study_id,r.actor_id,...Object.values(scope(r))].every(id)||!Number.isSafeInteger(r.actor_auth_version)||r.actor_auth_version<0||r.deployment_id!==config.deploymentId||!config.allowedTenantIds.includes(r.tenant_id)||!['ordinary','full'].includes(r.branch)||!equal(r.operator_hash,hash(r.operator_ref)))lost();return r;}
 function lease(cap){const privateLease=cap&&typeof cap==='object'?leases.get(cap):null,b=issuer.read(cap);if(!privateLease||!b||!equal(b,privateLease.binding))lost();return privateLease;}
 async function cancellation(tx,r){
  const o=await repo.cancellation(tx,r),receipt=o?.result?.receipt,a=o?.cancellation_audit;
  if(!o||o.id!==r.cancellation_id||o.tenant_id!==r.tenant_id||o.action!=='analysis.job.cancel'||o.target_id!==r.id||!id(o.actor_id)||!digest(o.request_hash)||o.result?.studyId!==r.study_id||o.result?.jobId!==r.id||receipt?.action!=='analysis.job.cancel'||receipt.targetId!==r.id||receipt.requestKey!==o.request_key||receipt.requestHash!==o.request_hash||!Number.isSafeInteger(receipt.authVersion)||receipt.authVersion<0||a?.id!==o.audit_id||a.tenantId!==r.tenant_id||a.studyGroupId!==r.study_group_id||a.researchProjectId!==r.research_project_id||a.accountId!==o.actor_id||a.action!=='researchhub.analysis.job.cancel'||a.target!==r.id||a.meta?.studyId!==r.study_id||a.meta.requestKey!==o.request_key||a.meta.requestHash!==o.request_hash||a.meta.authVersion!==receipt.authVersion)lost();
  return{actor:actor(r,o.actor_id,receipt.authVersion),proofId:o.audit_id};
 }
 async function check(tx,cap,r,clock){
  const l=lease(cap),b=l.binding;validRow(r);
  if(!active.includes(r.status)||r.id!==b.jobId||!equal(scope(r),b.scope)||r.study_id!==b.studyId||r.lease_generation!==b.generation||r.lease_owner!==owner||r.lease_token!==l.token||!r.lease_expires_at||+new Date(r.lease_expires_at)<=+new Date(clock.now))lost();
  if(b.mode==='compute'){if(r.cancellation_id||r.status==='cancelling'||b.actorId!==r.actor_id||b.authVersion!==r.actor_auth_version)lost();}
  else if(b.settlement.kind==='cancel'){const c=await cancellation(tx,r);if(r.status!=='cancelling'||c.actor.accountId!==b.actorId||c.actor.authVersion!==b.authVersion)lost();}
  else if(r.cancellation_id||r.status==='cancelling'||r.compute_attempt!==3||b.actorId!==r.actor_id||b.authVersion!==r.actor_auth_version)lost();
  return l;
 }
 async function locked(tx,cap){const l=lease(cap),clock=await repo.clock(tx),proof=lockedTransactions.get(tx)?.get(cap);if(proof!==stamp(clock))lost();const r=await repo.read(tx,l.binding.scope,l.binding.jobId);await check(tx,cap,r,clock);return{r,clock,l};}
 function remember(tx,cap,clock){let entries=lockedTransactions.get(tx);if(!entries)lockedTransactions.set(tx,entries=new Map());entries.set(cap,stamp(clock));}
 async function write(tx,r,next,claim=false){const saved=await repo.replace(tx,r,next,claim);if(!saved)lost();return saved;}
 function expectedTarget(r,targetId){const t=r.checkpoint.targets.find(t=>t.targetId===targetId);if(!t)lost();return t;}
 const nativeTarget=(r,t)=>({jobId:r.id,targetId:t.targetId,studyId:r.study_id,snapshotId:t.snapshotId,methodKey:t.methodKey,runId:t.runId,inputHash:t.inputHash});
 function marker(r,t){return{version:1,jobId:r.id,targetId:t.targetId,bindingHash:hash({jobId:r.id,targetId:t.targetId,scope:scope(r),studyId:r.study_id,snapshotId:t.snapshotId,methodKey:t.methodKey,operator:r.operator_ref})};}
 function nativeProof(r,t,run,unbound=false){
  const s=run?.scope??{tenantId:run?.tenantId,studyGroupId:run?.studyGroupId,researchProjectId:run?.researchProjectId};
  if(!run||!id(run.runId)||!digest(run.inputHash)||!id(run.sessionId)||!equal(s,scope(r))||run.studyId!==r.study_id||run.snapshotId!==t.snapshotId||run.methodKey!==t.methodKey||run.accountId!==r.actor_id||run.agentId!==r.operator_ref.agentId||run.skillVersion!==r.operator_ref.skillVersion||run.executorVersion!==r.operator_ref.executorVersion||!equal(run.marker,marker(r,t))||(!unbound||t.runId!==null)&&(run.runId!==t.runId||run.inputHash!==t.inputHash))lost();
 }
 function operation(r,u,op,cap){
  const b=lease(cap).binding,c=op?.context,t=c?.target;
  if(!c||c.capability!==cap||!equal(c.scope,scope(r))||!equal(op.scope,scope(r))||!equal(c.operator,r.operator_ref)||u?.accountId!==b.actorId||u.authVersion!==b.authVersion||u.tenantId!==r.tenant_id||!equal({tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId},scope(r))||op.studyId!==r.study_id||t?.jobId!==r.id||t.studyId!==r.study_id)lost();
  const fixed=expectedTarget(r,t.targetId);if(!equal(t,nativeTarget(r,fixed))||op.snapshotId!==fixed.snapshotId||op.methodKey!==fixed.methodKey)lost();
  if(b.mode==='settle'?(op.kind!=='settle'||!equal(op.settlement,b.settlement)):!['prepare','create','dispatch','publish','basis-cleanup'].includes(op.kind))lost();
  return fixed;
 }
 const dispatchId=r=>'analysis-job-dispatch-'+hash({jobId:r.id,generation:r.lease_generation});
 function auditMatches(a,r,who,action,target,meta){return a&&a.tenantId===r.tenant_id&&a.studyGroupId===r.study_group_id&&a.researchProjectId===r.research_project_id&&a.accountId===who&&a.action===action&&a.target===target&&Object.entries(meta).every(([k,v])=>equal(a.meta?.[k],v));}
 function checkpoint(r,next){
  const old=r.checkpoint;
  if(!next||!equal(Object.keys(next).sort(),['finishedClaimIds','pending','runGroupId','targets','version'])||next.version!==1||!equal(next.targets,old.targets)||!Array.isArray(next.finishedClaimIds)||!next.finishedClaimIds.every(id)||new Set(next.finishedClaimIds).size!==next.finishedClaimIds.length||old.finishedClaimIds.some(x=>!next.finishedClaimIds.includes(x))||old.runGroupId!==null&&next.runGroupId!==old.runGroupId||next.runGroupId!==null&&!id(next.runGroupId)||next.pending!==null&&(typeof next.pending!=='object'||!['first','batch'].includes(next.pending.kind)))lost();
  if(r.branch==='ordinary'&&(next.runGroupId!==null||next.pending!==null||next.finishedClaimIds.length))lost();
  return structuredClone(next);
 }
 async function commitCheckpoint(tx,cap,next){const{r}=await locked(tx,cap),cp=checkpoint(r,next);return equal(cp,r.checkpoint)?r:write(tx,r,{...r,checkpoint:cp});}
 // existing is metadata constructed by Native from its exact successful Run, never an HTTP field.
 // This compatibility branch issues no capability; dispatch/bind/outcome still require the private lease.
 function knownNativeRead(u,op){const run=op.existing,s=op.scope;return['prepare','create','dispatch'].includes(op.kind)&&['needs_review','completed','needs_input'].includes(run?.status)&&equal(run.scope,s)&&equal({tenantId:u?.tenantId,studyGroupId:u?.studyGroupId,researchProjectId:u?.researchProjectId},s)&&run.studyId===op.studyId&&run.snapshotId===op.snapshotId&&run.methodKey===op.methodKey&&[run.runId,run.sessionId,run.accountId,run.agentId,run.marker?.jobId,run.marker?.targetId].every(id)&&digest(run.inputHash)&&run.marker?.version===1&&digest(run.marker.bindingHash);}
 const adapter=Object.freeze({
  capabilities:Object.freeze({read(value){try{return structuredClone(lease(value).binding);}catch{return null;}}}),
  async beforeLocks(tx,u,op){
   if(!op?.context){
    const s=op?.scope;if(!s||!config.allowedTenantIds.includes(s.tenantId)||!id(op.studyId)||!id(op.snapshotId)||!id(op.methodKey))lost();
    if(op.methodKey.startsWith('analysis-job-native-')){if(knownNativeRead(u,op))return;fail('ANALYSIS_JOB_RESERVED');}
    const reservations=await repo.reservations(tx,s,u,op);if(!reservations.length&&op.existing?.marker)fail('ANALYSIS_JOB_RESERVED');
    for(const r of reservations){const t=r.checkpoint.targets.find(t=>t.methodKey===op.methodKey);if(!t||!['prepare','create','dispatch'].includes(op.kind)||!published.includes(op.existing?.status))fail('ANALYSIS_JOB_RESERVED');nativeProof(r,t,op.existing);}
    return;
   }
   const cap=op.context.capability,l=lease(cap);let clock=await repo.clock(tx),r;
   if(lockedTransactions.get(tx)?.get(cap)===stamp(clock))r=await repo.read(tx,l.binding.scope,l.binding.jobId);
   else{r=await repo.lock(tx,l.binding.scope,l.binding.jobId);clock=await repo.clock(tx);}
   await check(tx,cap,r,clock);operation(r,u,op,cap);remember(tx,cap,clock);
  },
  async verify(tx,u,op,run){const cap=op?.context?.capability,{r}=await locked(tx,cap),t=operation(r,u,op,cap);nativeProof(r,t,run);},
  async beforeDispatch(tx,u,op,run){
   const cap=op?.context?.capability,{r}=await locked(tx,cap),t=operation(r,u,op,cap);if(op.kind!=='dispatch'||lease(cap).binding.mode!=='compute'||!['queued','running'].includes(run.status))lost();nativeProof(r,t,run);
   const auditId=dispatchId(r),a=await repo.auditById(tx,auditId),meta={studyId:r.study_id,authVersion:r.actor_auth_version,generation:r.lease_generation,computeAttempt:r.compute_attempt};
   if(a){if(!r.compute_attempt||!auditMatches(a,r,r.actor_id,'researchhub.analysis.job.dispatch',r.id,meta))lost();return;}
   if(r.compute_attempt>=3)fail('ANALYSIS_JOB_ATTEMPTS_EXHAUSTED');
   await write(tx,r,{...r,compute_attempt:r.compute_attempt+1});
   await repo.audit(tx,{id:auditId,...scope(r),accountId:r.actor_id,action:'researchhub.analysis.job.dispatch',target:r.id,meta:{...meta,computeAttempt:r.compute_attempt+1}});
  },
  async bind(tx,u,op,run){
   const cap=op?.context?.capability,{r}=await locked(tx,cap),t=operation(r,u,op,cap);if(!['prepare','create'].includes(op.kind))lost();nativeProof(r,t,run,true);
   if(t.runId!==null)return;
   const cp=structuredClone(r.checkpoint),target=cp.targets.find(x=>x.targetId===t.targetId);target.runId=run.runId;target.inputHash=run.inputHash;await write(tx,r,{...r,checkpoint:cp});
  },
  async outcome(tx,u,op,run,outcome){
   const cap=op?.context?.capability,{r}=await locked(tx,cap),t=operation(r,u,op,cap);nativeProof(r,t,run);
   const states={published:['needs_review','completed','needs_input'],failed:['failed'],'basis-blocked':['failed','blocked'],cancelled:['cancelled']};if(!states[outcome]?.includes(run.status))lost();
  },
 });
 const branches=createBranches({adapter});
 if(!branches||['ordinary','full'].some(k=>['advance','reconcile','settle'].some(m=>typeof branches[k]?.[m]!=='function')))fail('ANALYSIS_JOB_BRIDGE_UNAVAILABLE');
 function context(r,cap,u,stopProofId=null){
  const b=lease(cap).binding,job={id:r.id,branch:r.branch,studyId:r.study_id,snapshotId:r.snapshot_id,planId:r.plan_id,reviewId:r.review_id,manifestHash:r.manifest_hash,operator:structuredClone(r.operator_ref),nativeCreateKey:r.native_create_key,checkpoint:structuredClone(r.checkpoint),generation:r.lease_generation,computeAttempt:r.compute_attempt,status:r.status};
  return{job,actor:structuredClone(u),scope:scope(r),capability:cap,...(b.mode==='settle'?{settlement:structuredClone(b.settlement)}:{}),stopProofId,nativeContext(targetId){const t=expectedTarget(r,targetId);return{scope:scope(r),target:nativeTarget(r,t),operator:structuredClone(r.operator_ref),capability:cap};},checkpointInTransaction:(tx,next)=>commitCheckpoint(tx,cap,next)};
 }
 function readContext(r,cap,u,stopProofId){const{job,actor,scope,settlement}=context(r,cap,u,stopProofId);return{job,actor,scope,...(settlement?{settlement}:{}),stopProofId,readOnly:true};}
 async function withLease(cap,fn){const l=lease(cap);return transact(l.binding.scope,async tx=>{const r=await repo.lock(tx,l.binding.scope,l.binding.jobId),clock=await repo.clock(tx);await check(tx,cap,r,clock);remember(tx,cap,clock);const u=actor(r,l.binding.actorId,l.binding.authVersion),stopProofId=l.binding.mode==='settle'&&l.binding.settlement.kind==='cancel'?(await cancellation(tx,r)).proofId:null;return fn(tx,r,u,clock,stopProofId);});}
 async function actorActive(tx,u){const a=await repo.account(tx,u.accountId);return a&&a.id===u.accountId&&a.tenantId===u.tenantId&&a.authVersion===u.authVersion&&a.status==='active'&&a.tenant?.status==='active'&&['researcher','tenant_admin'].includes(a.role)&&a.isTenantAdmin===(a.role==='tenant_admin');}
 async function claim(candidate){
  const s={tenantId:candidate.tenant_id,studyGroupId:candidate.study_group_id,researchProjectId:candidate.research_project_id};
  if(!config.allowedTenantIds.includes(s.tenantId)||![candidate.job_id,candidate.study_id,candidate.actor_id,...Object.values(s)].every(id)||!Number.isSafeInteger(candidate.actor_auth_version)||candidate.actor_auth_version<0)fail('ANALYSIS_JOB_CANDIDATE_INVALID');
  const result=await transact(s,async tx=>{
   const r=validRow(await repo.lock(tx,s,candidate.job_id)),clock=await repo.clock(tx);stamp(clock);if(!equal(scope(r),s)||r.study_id!==candidate.study_id||r.actor_id!==candidate.actor_id||r.actor_auth_version!==candidate.actor_auth_version)lost();
   if(!active.includes(r.status)||r.lease_expires_at&&+new Date(r.lease_expires_at)>+new Date(clock.now))return null;
   const cancel=r.status==='cancelling'?(await cancellation(tx,r)):null,u=cancel?.actor??actor(r);
   if(!await actorActive(tx,u)){await write(tx,r,{...r,...clearLease,status:'blocked',lease_generation:r.lease_generation+1,error_code:'ANALYSIS_JOB_ACTOR_REVOKED',terminal_at:clock.now},true);return{blocked:true};}
   const mode=cancel||r.compute_attempt>=3?'settle':'compute',settlement=cancel?{kind:'cancel'}:{kind:'runtime-failure',code:'ANALYSIS_JOB_ATTEMPTS_EXHAUSTED'},token=randomUUID(),next={...r,status:cancel?'cancelling':r.status==='queued'?'running':'recovering',lease_generation:r.lease_generation+1,lease_token:token,lease_owner:owner,lease_expires_at:new Date(+new Date(clock.now)+LEASE_MS),heartbeat_at:clock.now};
   return{r:await write(tx,r,next,true),u,token,binding:{jobId:r.id,generation:next.lease_generation,scope:s,studyId:r.study_id,actorId:u.accountId,authVersion:u.authVersion,mode,...(mode==='settle'?{settlement}:{})}};
  });
  if(!result||result.blocked)return result;
  const cap=issuer.issue(result.binding);leases.set(cap,{token:result.token,binding:structuredClone(result.binding)});return{cap,r:result.r};
 }
 async function terminal(tx,r,u,cap,proof,clock){
  const invalid=()=>fail('ANALYSIS_JOB_TERMINAL_PROOF_INVALID');
  if(!proof||!Object.hasOwn(proof,'terminal'))fail('ANALYSIS_JOB_TERMINAL_PROOF_INVALID');
  r=await commitCheckpoint(tx,cap,proof.checkpoint);if(proof.terminal===null)return null;
  const end=proof.terminal,b=lease(cap).binding;
  if(!['completed','cancelled','failed','blocked'].includes(end.status)||!Array.isArray(end.targets)||end.targets.length!==r.checkpoint.targets.length||new Set(end.targets.map(t=>t.targetId)).size!==end.targets.length||!Array.isArray(end.openClaimIds)||end.openClaimIds.length||r.checkpoint.pending!==null)fail('ANALYSIS_JOB_TERMINAL_PROOF_INVALID');
  if(end.status==='cancelled'&&(b.mode!=='settle'||b.settlement.kind!=='cancel')||r.branch==='full'&&r.checkpoint.runGroupId===null&&(end.status==='completed'||r.checkpoint.targets.some(t=>t.runId!==null))||end.code!==undefined&&(typeof end.code!=='string'||!/^[A-Z0-9_]{1,100}$/.test(end.code)))invalid();
  for(const t of r.checkpoint.targets){
   const item=end.targets.find(p=>p.targetId===t.targetId);if(!item||item.runId!==t.runId||item.inputHash!==t.inputHash||!id(item.proofId))invalid();
   if(item.state==='not_started'){
    if(t.runId!==null||t.inputHash!==null||b.mode!=='settle'||end.status==='completed')invalid();
    const a=await repo.auditById(tx,item.proofId),cancel=b.settlement.kind==='cancel';
    if(cancel?(item.proofId!==(await cancellation(tx,r)).proofId):!auditMatches(a,r,r.actor_id,'researchhub.analysis.job.runtime-failure',r.id,{studyId:r.study_id,authVersion:r.actor_auth_version,generation:r.lease_generation,code:'ANALYSIS_JOB_ATTEMPTS_EXHAUSTED',computeAttempt:3}))invalid();
    continue;
   }
   const run=await repo.nativeRun(tx,t.runId),a=await repo.auditById(tx,item.proofId);try{nativeProof(r,t,run);}catch{invalid();}
   const action=item.state==='published'?'research_method_run_publish':item.state==='cancelled'?'research_method_run_cancel':'research_method_run_failed',who=item.state==='cancelled'?u.accountId:r.actor_id;
   if(!auditMatches(a,r,who,action,t.runId,{})||item.state==='published'&&(!published.includes(run.status)||!run.claim||a.meta?.claim!==run.claim)||item.state==='cancelled'&&(run.status!=='cancelled'||b.mode!=='settle'||b.settlement.kind!=='cancel'||a.meta?.jobId!==r.id)||item.state==='failed'&&(run.status!=='failed'||b.mode==='settle'&&(b.settlement.kind!=='runtime-failure'||a.meta?.runtimeFailure!==true||a.meta?.jobId!==r.id||a.meta?.errorCode!=='ANALYSIS_JOB_ATTEMPTS_EXHAUSTED'))||!['published','cancelled','failed'].includes(item.state)||end.status==='completed'&&item.state!=='published'||end.status==='cancelled'&&item.state==='failed')invalid();
  }
  if(end.status==='failed'&&!end.targets.some(t=>['failed','not_started'].includes(t.state))||b.mode==='settle'&&b.settlement.kind==='cancel'&&end.status!=='cancelled')invalid();
  await write(tx,r,{...r,...clearLease,status:end.status,error_code:b.mode==='settle'&&b.settlement.kind==='runtime-failure'&&end.status==='failed'?b.settlement.code:end.code??null,terminal_at:clock.now});return{status:end.status,jobId:r.id};
 }
 async function reconcile(cap,unknownProbe=false){return withLease(cap,async(tx,r,u,clock,stopProofId)=>{const proof=await branches[r.branch].reconcile(tx,readContext(r,cap,u,stopProofId));if(unknownProbe&&proof?.terminal===null)return null;return terminal(tx,r,u,cap,proof,clock);});}
 async function settle(cap){return withLease(cap,async(tx,r,u,clock,stopProofId)=>{
  const b=lease(cap).binding;if(b.mode!=='settle')lost();
  if(b.settlement.kind==='runtime-failure'){
   stopProofId='analysis-job-exhausted-'+hash({jobId:r.id,generation:r.lease_generation});const old=await repo.auditById(tx,stopProofId),meta={studyId:r.study_id,authVersion:r.actor_auth_version,generation:r.lease_generation,code:'ANALYSIS_JOB_ATTEMPTS_EXHAUSTED',computeAttempt:3};
   if(old){if(!auditMatches(old,r,r.actor_id,'researchhub.analysis.job.runtime-failure',r.id,meta))lost();}else await repo.audit(tx,{id:stopProofId,...scope(r),accountId:r.actor_id,action:'researchhub.analysis.job.runtime-failure',target:r.id,meta});
  }
  const proof=await branches[r.branch].settle(tx,context(r,cap,u,stopProofId),structuredClone(b.settlement));return terminal(tx,r,u,cap,proof,clock);
 });}
 async function block(cap,error){const code=error?.getResponse?.()?.code??error?.code;return withLease(cap,async(tx,r,_u,clock)=>{await write(tx,r,{...r,...clearLease,status:'blocked',error_code:typeof code==='string'&&/^[A-Z0-9_]{1,100}$/.test(code)?code:'ANALYSIS_JOB_NATIVE_UNAVAILABLE',terminal_at:clock.now});return{status:'blocked',jobId:r.id};});}
 function definitive(error){const status=error?.getStatus?.()??error?.status,code=error?.getResponse?.()?.code??error?.code;return status===401||status===403||['METHOD_AUTHORIZATION_REVOKED','AUTH_SESSION_EXPIRED','METHOD_RUN_CHANGED','ANALYSIS_BASIS_STALE','DESCRIPTIVE_JOB_CAPABILITY_INVALID'].includes(code)||status===409&&/^ANALYSIS_/.test(code??'')||/^ANALYSIS_JOB_(?:TERMINAL_PROOF_INVALID|BRIDGE_UNAVAILABLE|PROGRESS_UNAVAILABLE|SETTLEMENT_INCOMPLETE)$/.test(code??'')||status===409&&fullSourceFaults.has(code)||error?.name==='QualityGateError'&&fullQualityFaults.has(code)||status===503&&fullConfigurationFaults.has(code);}
 async function recover(cap){return withLease(cap,async(tx,r)=>{const status=r.cancellation_id?'cancelling':'recovering';await write(tx,r,{...r,...clearLease,status,error_code:'ANALYSIS_JOB_OUTCOME_UNKNOWN',terminal_at:null});return{status,jobId:r.id};});}
 async function pulse(cap){return withLease(cap,async(tx,r,_u,clock)=>write(tx,r,{...r,lease_expires_at:new Date(+new Date(clock.now)+LEASE_MS),heartbeat_at:clock.now}));}
 async function consume(found){
  const {cap}=found;let heartbeatPending=null;
  heartbeatTimer=timers.setInterval(()=>{if(heartbeatPending||stopping)return;heartbeatPending=pulse(cap).catch(()=>{}).finally(()=>{heartbeatPending=null;});},HEARTBEAT_MS);
  try{
   for(let step=0;step<found.r.checkpoint.targets.length*2+4;step++){
    const finished=await reconcile(cap);if(finished)return finished;
    if(stopping)return{status:'stopped',jobId:found.r.id};
    if(lease(cap).binding.mode==='settle'){const result=await settle(cap);if(!result)fail('ANALYSIS_JOB_SETTLEMENT_INCOMPLETE');return result;}
    const ctx=await withLease(cap,async(_tx,r,u)=>context(r,cap,u));await branches[found.r.branch].advance(ctx);
   }
   fail('ANALYSIS_JOB_PROGRESS_UNAVAILABLE');
  }catch(e){
   if(e?.code==='DESCRIPTIVE_JOB_FENCE_LOST')return{status:'lease-lost',jobId:found.r.id};
   try{
    if(definitive(e))return await block(cap,e);
    try{const finished=await reconcile(cap,true);if(finished)return finished;}catch(readError){if(readError?.code==='DESCRIPTIVE_JOB_FENCE_LOST')throw readError;if(definitive(readError))return await block(cap,readError);}
    return await recover(cap);
   }catch(late){if(late?.code==='DESCRIPTIVE_JOB_FENCE_LOST')return{status:'lease-lost',jobId:found.r.id};throw late;}
  }finally{if(heartbeatTimer!==null)timers.clearInterval(heartbeatTimer);heartbeatTimer=null;await heartbeatPending;}
 }
 async function work(){for(const tenant of config.allowedTenantIds){const candidates=await repo.discover(prisma,tenant,config.deploymentId,20);if(!Array.isArray(candidates)||candidates.length>20)fail('ANALYSIS_JOB_CANDIDATE_INVALID');for(const c of candidates){if(c.tenant_id!==tenant)fail('ANALYSIS_JOB_CANDIDATE_INVALID');const found=await claim(c);if(found?.blocked)return{status:'blocked',jobId:c.job_id};if(found)return consume(found);}}return{status:'idle'};}
 function tick(){if(unavailable)return Promise.reject(unavailable);if(stopping)return Promise.resolve({status:'stopped'});if(running)return Promise.resolve({status:'busy'});running=work().finally(()=>{running=null;});return running;}
 const background=()=>{tick().catch(()=>{unavailable=Object.assign(Error('ANALYSIS_JOB_CONSUMER_UNAVAILABLE'),{code:'ANALYSIS_JOB_CONSUMER_UNAVAILABLE'});if(pollTimer!==null)timers.clearInterval(pollTimer);pollTimer=null;});};
 function start(){
  if(stopPromise)return Promise.reject(Object.assign(Error('ANALYSIS_JOB_CONSUMER_STOPPING'),{code:'ANALYSIS_JOB_CONSUMER_STOPPING'}));
  if(starting)return starting;if(pollTimer!==null)return Promise.resolve({status:'started'});stopping=false;unavailable=null;
  starting=(async()=>{try{for(const tenant of config.allowedTenantIds){const candidates=await repo.discover(prisma,tenant,config.deploymentId,20);if(!Array.isArray(candidates)||candidates.length>20)fail('ANALYSIS_JOB_CANDIDATE_INVALID');}}catch{fail('ANALYSIS_JOB_CONSUMER_UNAVAILABLE');}
   if(stopping)return{status:'stopped'};pollTimer=timers.setInterval(background,POLL_MS);background();return{status:'started'};
  })().finally(()=>{starting=null;});return starting;
 }
 function stop(){
  if(stopPromise)return stopPromise;stopping=true;if(pollTimer!==null)timers.clearInterval(pollTimer);pollTimer=null;if(heartbeatTimer!==null)timers.clearInterval(heartbeatTimer);heartbeatTimer=null;
  stopPromise=(async()=>{await starting;await running;return{status:'stopped'};})().finally(()=>{stopPromise=null;});return stopPromise;
 }
 function availability(){const state=stopPromise?'stopping':stopping?'stopped':unavailable?'unavailable':starting?'starting':pollTimer!==null?'ready':'unstarted';return{available:state==='ready',state};}
 return Object.freeze({adapter,tick,start,stop,availability});
}
