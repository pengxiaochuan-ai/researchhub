import {randomUUID} from 'node:crypto';
import {only,invalid,researchError,validateMutation,requestHash} from '../research-studies/contract.mjs';
import * as repo from '../research-studies/repository.mjs';
import {fullStudyHash,fail,FULL_SCHEMA} from './full-study-projection.mjs';
import {buildT17Report} from './t17-report-content.mjs';
import {fullStudyRunSummary} from './full-study-summary.mjs';
import {createFullStudyReviewOperations} from './full-study-review-operations.mjs';
import {createFullStudyProcessReceipt} from './full-study-process-receipt.mjs';
import {createFullStudyBatchProcess,fullStudyJobTargetsHash} from './full-study-batch-runs.mjs';
import {BATCH_VERSION} from './full-study-batch-receipt.mjs';
import {createFullStudyJobBridge} from './full-study-job-bridge.mjs';
const ACTION='researchhub.full.analysis.run.group',scopeOf=c=>({tenantId:c.tenantId,studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId});
export function createFullStudyRuns({studies,analysis,methods,authorizeCancelInTransaction,jobAdapter}){
 if(!studies?.withResearchStudyTransaction||!analysis?.assertCurrent||!methods?.createFromWorkbench)throw Error('FULL_STUDY_RUN_DEPENDENCIES_REQUIRED');
 const transaction=(u,studyId,fn)=>studies.withResearchStudyTransaction(u,studyId,'read',async(tx,c)=>{const s=scopeOf(c);await repo.setContext(tx,u,s.studyGroupId,s.researchProjectId);return fn(tx,s,{...u,studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId});},jobAdapter?{includeOfficial:true}:undefined);
 const reviewTransaction=(u,studyId,fn)=>studies.withResearchStudyTransaction(u,studyId,'read',async(tx,c)=>{const s=scopeOf(c);await repo.setContext(tx,u,s.studyGroupId,s.researchProjectId);return fn(tx,s,{...u,studyGroupId:s.studyGroupId,researchProjectId:s.researchProjectId});},{includeOfficial:true});
 async function beforeLegacyGroup(tx,u,s,studyId,id,body,kind='dispatch'){
  const a=await tx.auditLog.findFirst({where:{...s,id,action:ACTION,target:studyId}}),old=body?await repo.getReceipt(tx,u,body.requestKey):null,readOnly=old?.action==='full.analysis.run.process'&&old.target_id===id&&old.request_hash===requestHash({studyId,id,body});
  if(a?.meta?.researchAnalysisJob){if(readOnly)return{readOnlyJob:true,requestKey:body.requestKey};throw researchError(409,'ANALYSIS_JOB_RESERVED','请从原后台分析任务核对或停止。');}
  if(jobAdapter&&a?.meta?.snapshotId)try{await jobAdapter.beforeLocks(tx,{...u,...s},{kind,scope:s,studyId,snapshotId:a.meta.snapshotId,methodKey:body?.requestKey??id});}catch(error){if(readOnly&&(error?.getResponse?.()?.code??error?.code)==='ANALYSIS_JOB_RESERVED')return{readOnlyJob:true,requestKey:body.requestKey};throw error;}
  return null;
 }
 async function group(tx,u,s,studyId,groupId,phase='dispatch',providedCurrent){const a=await tx.auditLog.findFirst({where:{...s,id:groupId,action:ACTION,target:studyId}});if(!a||a.meta?.studyId!==studyId||a.meta?.schemaVersion!==FULL_SCHEMA||!Array.isArray(a.meta.slices))throw researchError(404,'FULL_STUDY_RUN_NOT_FOUND','未找到当前整课题运行。');const current=providedCurrent??await analysis.assertCurrent(tx,u,s,studyId,a.meta.snapshotId,phase);if(providedCurrent&&(current.basis.studyId!==studyId||current.basis.snapshotId!==a.meta.snapshotId))fail('ANALYSIS_BASIS_STALE');if(current.manifest.schemaVersion!=='full-study-simulation-root-v2'||current.basis.manifestHash!==a.meta.manifestHash)fail('ANALYSIS_BASIS_STALE');const cancelled=await tx.auditLog.findFirst({where:{...s,action:'researchhub.full.analysis.run.cancel',target:groupId},select:{id:true}});return{a,current,cancelled:Boolean(cancelled)};}
 async function rows(tx,s,g){const keys=g.a.meta.slices.map(x=>x.methodKey);return keys.length?tx.researchMethodRun.findMany({where:{...s,skillKey:'descriptive-statistics',idempotencyKey:{in:keys}},orderBy:{createdAt:'asc'}}):[];}
 async function linkedJobId(tx,s,studyId,g){
  const a=g.a,m=a.meta.researchAnalysisJob,id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
  if(m?.version!==1||!id(m.jobId)||!/^[a-f0-9]{64}$/.test(m.bindingHash??'')||!Number.isSafeInteger(a.meta.authVersion)||a.meta.authVersion<0)return null;
  const jobs=await tx.$queryRaw`SELECT id,tenant_id,study_group_id,research_project_id,study_id,snapshot_id,actor_id,actor_auth_version,branch,plan_id,review_id,manifest_hash,native_create_key,operator_ref,operator_hash,checkpoint FROM rh_analysis.execution_job WHERE id=${m.jobId} AND tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId} AND snapshot_id=${a.meta.snapshotId} AND actor_id=${a.accountId} AND actor_auth_version=${a.meta.authVersion} AND branch='full' AND checkpoint->>'runGroupId'=${a.id}`;
  if(jobs.length!==1)return null;const j=jobs[0],cp=j.checkpoint;
  if(j.id!==m.jobId||j.branch!=='full'||j.tenant_id!==s.tenantId||j.study_group_id!==s.studyGroupId||j.research_project_id!==s.researchProjectId||j.study_id!==studyId||j.snapshot_id!==a.meta.snapshotId||j.actor_id!==a.accountId||j.actor_auth_version!==a.meta.authVersion||j.plan_id!==g.current.basis.planId||j.review_id!==g.current.basis.planReviewId||j.manifest_hash!==a.meta.manifestHash||j.native_create_key!==a.meta.requestKey||!j.operator_ref||fullStudyHash(j.operator_ref)!==j.operator_hash||cp?.version!==1||cp.runGroupId!==a.id||!Array.isArray(cp.targets)||!cp.targets.length||cp.targets.some(t=>t.targetId!==t.sliceId||![t.targetId,t.snapshotId,t.methodKey].every(id))||new Set(cp.targets.map(t=>t.targetId)).size!==cp.targets.length||fullStudyHash(cp.targets.map(({sliceId,snapshotId,methodKey})=>({sliceId,snapshotId,methodKey})))!==fullStudyHash(a.meta.slices))return null;
  const expected={version:1,jobId:j.id,bindingHash:fullStudyHash({jobId:j.id,scope:s,studyId,snapshotId:j.snapshot_id,nativeCreateKey:j.native_create_key,operator:j.operator_ref,jobTargetsHash:fullStudyJobTargetsHash(cp.targets)})};return fullStudyHash(m)===fullStudyHash(expected)?j.id:null;
 }
 function present(studyId,g,runs){const {basis,manifest,qualityGate}=g.current;if(basis.studyId!==studyId||basis.planId!==g.a.meta.planId||basis.snapshotId!==g.a.meta.snapshotId||basis.manifestHash!==g.a.meta.manifestHash)fail('ANALYSIS_BASIS_STALE');const sourceSnapshot=structuredClone({basis,manifest,qualityGate});const slices=g.current.manifest.slices.map(slice=>{const binding=g.a.meta.slices.find(x=>x.sliceId===slice.sliceId),r=binding?runs.find(x=>x.idempotencyKey===binding.methodKey):null;return{sliceId:slice.sliceId,kind:slice.kind,armCode:slice.armCode,logicalVisit:slice.logicalVisit,variable:slice.variable,denominators:slice.denominators,summary:fullStudyRunSummary(r,slice,binding,studyId),status:binding?r?.status??'queued':slice.status,reviewStatus:r?.reviewStatus??null,methodRunId:r?.id??null,snapshotId:binding?.snapshotId??null,errorCode:r?.errorCode??null};});const active=slices.filter(x=>x.snapshotId),remaining=active.filter(x=>x.status==='queued').length;return{studyId,id:g.a.id,runGroupId:g.a.id,jobId:null,snapshotId:g.a.meta.snapshotId,planId:g.current.basis.planId,manifestHash:g.current.basis.manifestHash,status:g.cancelled?'cancelled':active.some(x=>['failed','cancelled'].includes(x.status))?'blocked':remaining||active.some(x=>x.status==='running')?'running':active.length&&active.every(x=>x.status==='completed'&&x.reviewStatus==='confirmed')?'completed':active.length?'needs_review':'no_valid_data',reviewStatus:active.length&&active.every(x=>x.reviewStatus==='confirmed')?'confirmed':'pending_review',remaining,stateHash:fullStudyHash({groupId:g.a.id,manifestHash:g.current.basis.manifestHash,runs:runs.map(r=>({id:r.id,status:r.status,reviewStatus:r.reviewStatus})).sort((a,b)=>a.id.localeCompare(b.id))}),slices,sourceSnapshot,...(typeof methods.createBatchFromWorkbench==='function'&&typeof analysis.withBatchResolver==='function'?{batching:{version:BATCH_VERSION,maxItems:3}}:{}),capabilities:{canReview:!g.cancelled&&remaining===0&&active.every(x=>['needs_review','completed'].includes(x.status))&&active.some(x=>x.status==='needs_review'),canCancel:!g.cancelled&&active.some(x=>['queued','running','needs_review'].includes(x.status))}};}
 async function withCapabilities(u,studyId,id){
  const actual=await transaction(u,studyId,async(tx,s,scoped)=>{const g=await group(tx,u,s,studyId,id),runs=await rows(tx,s,g);return{value:{...present(studyId,g,runs),jobId:await linkedJobId(tx,s,studyId,g)},scoped,isActor:g.a.accountId===u.accountId&&g.a.meta.authVersion===u.authVersion,runs,jobBound:Boolean(g.a.meta.researchAnalysisJob)};});
  return addCapabilities(u,studyId,id,actual);
 }
 async function addCapabilities(u,studyId,id,actual){
  const value=actual.value,authority={canReview:false,canCancel:false,canProcessRun:false};
  if(!actual.isActor&&!value.capabilities.canReview)return{...value,capabilities:authority};
  if(typeof methods.getDescriptiveCapabilities!=='function')return{...value,capabilities:authority};
  const checkCancel=!actual.jobBound&&actual.isActor&&typeof authorizeCancelInTransaction==='function'&&value.capabilities.canCancel;
  let review=value.capabilities.canReview,cancel=false;
  const pending=actual.runs.filter(r=>['queued','running','needs_review'].includes(r.status));
  const consume=async get=>{for(const r of pending){
   if(!review&&(!checkCancel||cancel))break;
   const checkReview=review&&r.status==='needs_review';
   if(!checkReview&&(!checkCancel||cancel))continue;
   const current=await get(r.id);
   if(checkReview)review=current.capabilities?.canReview===true;
   if(checkCancel)cancel=cancel||current.capabilities?.canCancel===true;
  }};
  try{
   if(actual.batchProcess===true&&review&&pending.length>0&&pending.length<=39&&typeof methods.withDescriptiveCapabilities==='function')await methods.withDescriptiveCapabilities(actual.scoped,pending.map(r=>r.id),consume);
   else await consume(id=>methods.getDescriptiveCapabilities(actual.scoped,id));
  }
  catch(error){
   if((error?.getStatus?.()??error?.status)===409&&(error?.getResponse?.()?.code??error?.code)==='METHOD_RUN_CHANGED'){
    // A concurrent review can change the native capability snapshot. Re-read
    // current sources before showing read-only metadata; source failures still throw.
    return transaction(u,studyId,async(tx,s)=>{const g=await group(tx,u,s,studyId,id);return{...present(studyId,g,await rows(tx,s,g)),capabilities:authority};});
   }
   if((error?.getStatus?.()??error?.status)!==403||(error?.getResponse?.()?.code??error?.code)!=='METHOD_AUTHORIZATION_REVOKED')throw error;
   // Metadata has its own current analysis-read permission. Do not grant Methods
   // actions, or hide a revoked identity behind the optional capability query.
   await analysis.configuration(u,studyId);return{...value,capabilities:authority};
  }
  return{...value,capabilities:{canReview:value.capabilities.canReview&&review,canCancel:!actual.jobBound&&actual.isActor&&typeof authorizeCancelInTransaction==='function'&&value.capabilities.canCancel&&cancel,canProcessRun:!actual.jobBound&&actual.isActor&&value.remaining>0&&!actual.runs.some(r=>['queued','running'].includes(r.status))&&!['blocked','cancelled','no_valid_data'].includes(value.status)}};
 }
 const authorizePublication=async(tx,actor,studyId,expectedScope)=>{
  if(typeof studies.resolveResearchStudyInTransaction!=='function')throw researchError(503,'FULL_STUDY_PUBLICATION_AUTHORITY_UNAVAILABLE','当前研究的发布权限暂不可核对。');
  const account=await tx.account.findFirst({where:{id:actor.accountId,tenantId:actor.tenantId},include:{tenant:{select:{status:true}}}});
  if(!account||account.status!=='active'||account.tenant?.status!=='active'||account.authVersion!==actor.authVersion)throw researchError(401,'AUTH_SESSION_EXPIRED','登录会话已失效，请重新登录。');
  const verified={accountId:account.id,tenantId:account.tenantId,role:account.role,isTenantAdmin:account.isTenantAdmin,authVersion:account.authVersion};
  if(verified.role==='platform_admin'||verified.isTenantAdmin!==(verified.role==='tenant_admin'))throw researchError(403,'RESEARCH_FORBIDDEN','当前账号无权操作此研究。');
  await repo.setContext(tx,verified);
  const context=await studies.resolveResearchStudyInTransaction(tx,verified,studyId,'read');
  if(context.studyId!==studyId||context.tenantId!==expectedScope.tenantId||context.studyGroupId!==expectedScope.studyGroupId||context.executionProjectId!==expectedScope.researchProjectId)fail('FULL_STUDY_SCOPE_INVALID');
  await repo.setContext(tx,verified,expectedScope.studyGroupId,expectedScope.researchProjectId);
 };
 const batch=createFullStudyBatchProcess({transaction,reviewTransaction,group,rows,present,addCapabilities,analysis,methods,authorizePublication,beforeLegacyGroup});
 async function claimOne(tx,u,s,scoped,studyId,id,body,frame){
   const readOnly=await beforeLegacyGroup(tx,u,s,studyId,id,body);if(readOnly)return readOnly;
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':full-run:'+id},0))::text`;
   const current=frame?await frame.guard.assertCurrent(tx,u,s,studyId,frame.rootId,'dispatch'):undefined;
   const g=await group(tx,u,s,studyId,id,'dispatch',current);if(g.cancelled)fail('FULL_STUDY_RUN_BLOCKED');if(g.a.accountId!==u.accountId||g.a.meta.authVersion!==u.authVersion)throw researchError(403,'FULL_STUDY_RUN_ACTOR_CHANGED','当前身份不能继续原运行。');
   const old=await repo.getReceipt(tx,u,body.requestKey),requestDigest=requestHash({studyId,id,body});if(old){if(old.action!=='full.analysis.run.process'||old.target_id!==id||old.request_hash!==requestDigest)fail('RESEARCH_REQUEST_KEY_CONFLICT');return null;}
   const existing=await rows(tx,s,g),state=present(studyId,g,existing);if(state.stateHash!==body.expectedStateHash)fail('FULL_STUDY_RUN_STATE_CHANGED');
   const events=await tx.auditLog.findMany({where:{...s,target:id,action:{in:['researchhub.full.analysis.process.claim','researchhub.full.analysis.process.finished']}},select:{id:true,action:true,meta:true},take:1000});
   if(events.some(e=>e.action==='researchhub.full.analysis.process.claim'&&!events.some(f=>f.action==='researchhub.full.analysis.process.finished'&&f.meta?.claimId===e.id)))fail('FULL_STUDY_PROCESS_PENDING');
   if(existing.some(r=>['queued','running'].includes(r.status)))fail('FULL_STUDY_PROCESS_PENDING');
   if(existing.some(r=>['failed','cancelled'].includes(r.status)))fail('FULL_STUDY_RUN_BLOCKED');
   const binding=g.a.meta.slices.find(x=>!existing.some(r=>r.idempotencyKey===x.methodKey));if(!binding)return null;
   const claimId='full-claim-'+randomUUID(),result={studyId,runGroupId:id,claimId,accepted:true,executionConfirmed:false,receipt:{requestKey:body.requestKey,action:'full.analysis.run.process',targetId:id}};
   await tx.auditLog.createMany({data:{id:claimId,...s,accountId:u.accountId,action:'researchhub.full.analysis.process.claim',target:id,meta:{requestKey:body.requestKey,requestDigest,authVersion:u.authVersion,methodKey:binding.methodKey,snapshotId:binding.snapshotId}}});
   await repo.saveReceipt(tx,u,{id:'full-process-op-'+randomUUID(),key:body.requestKey,hash:requestDigest,action:'full.analysis.run.process',target:id,result,auditId:claimId});return{binding,scoped,claimId};
 }
 async function executeClaim(u,studyId,id,next){
   if(next?.readOnlyJob)return api.processReceipt(u,studyId,id,next.requestKey);
   if(next){let failure;try{await methods.createFromWorkbench(next.scoped,{skillKey:'descriptive-statistics',idempotencyKey:next.binding.methodKey,input:{studyId,snapshotId:next.binding.snapshotId}});}catch(error){failure=error;}
    const actual=await transaction(u,studyId,async(tx,s,scoped)=>{const g=await group(tx,u,s,studyId,id);await tx.auditLog.createMany({data:{...s,accountId:u.accountId,action:'researchhub.full.analysis.process.finished',target:id,meta:{claimId:next.claimId,status:failure?'failed':'returned',methodKey:next.binding.methodKey}}});if(failure)return null;const runs=await rows(tx,s,g);return{value:present(studyId,g,runs),scoped,isActor:g.a.accountId===u.accountId&&g.a.meta.authVersion===u.authVersion,runs,jobBound:Boolean(g.a.meta.researchAnalysisJob)};});if(failure)throw failure;
    return addCapabilities(u,studyId,id,actual);
   }return api.read(u,studyId,id);
 }
 const api={
  async create(u,studyId,body){only(body,['requestKey','snapshotId']);validateMutation(body);const created=await transaction(u,studyId,async(tx,s,scoped)=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+u.accountId+':'+body.requestKey},0))::text`;const old=await repo.getReceipt(tx,u,body.requestKey),hash=requestHash({studyId,body});if(old){if(old.action!=='full.analysis.run.create'||old.request_hash!==hash)fail('RESEARCH_REQUEST_KEY_CONFLICT');return{id:old.result.runGroupId,replay:true};}if(jobAdapter)await jobAdapter.beforeLocks(tx,scoped,{kind:'create',scope:s,studyId,snapshotId:body.snapshotId,methodKey:body.requestKey});const prepare=async guard=>{const current=guard?await guard.assertCurrent(tx,u,s,studyId,body.snapshotId,'dispatch'):await analysis.assertCurrent(tx,u,s,studyId,body.snapshotId,'dispatch');if(current.manifest.schemaVersion!=='full-study-simulation-root-v2')fail('FULL_STUDY_ROOT_REQUIRED');const snapshots=await tx.$queryRaw`SELECT id,manifest,manifest_hash FROM rh_analysis.snapshot WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId} AND plan_id=${current.basis.planId} AND manifest->>'rootSnapshotId'=${body.snapshotId} ORDER BY id`;const slices=current.manifest.slices.filter(x=>x.status==='ready').map(slice=>{const matches=snapshots.filter(x=>x.manifest.sliceId===slice.sliceId);if(matches.length!==1||fullStudyHash(matches[0].manifest)!==matches[0].manifest_hash)fail('FULL_STUDY_SLICE_CHANGED');return{sliceId:slice.sliceId,snapshotId:matches[0].id,methodKey:'full-slice-'+fullStudyHash({studyId,actor:u.accountId,requestKey:body.requestKey,snapshotId:matches[0].id})};});const id='full-run-'+randomUUID(),meta={schemaVersion:FULL_SCHEMA,studyId,snapshotId:body.snapshotId,manifestHash:current.basis.manifestHash,planId:current.basis.planId,requestKey:body.requestKey,authVersion:u.authVersion,slices};await tx.auditLog.createMany({data:{id,...s,accountId:u.accountId,action:ACTION,target:studyId,meta}});const result={studyId,runGroupId:id,receipt:{requestKey:body.requestKey,action:'full.analysis.run.create',targetId:studyId}};await repo.saveReceipt(tx,u,{id:'full-run-op-'+randomUUID(),key:body.requestKey,hash,action:'full.analysis.run.create',target:studyId,result,auditId:id});const g={a:{id,accountId:u.accountId,meta},current,cancelled:false},state=present(studyId,g,await rows(tx,s,g));const processBody={limit:1,requestKey:'full-first-'+fullStudyHash(body.requestKey),expectedStateHash:state.stateHash},next=await claimOne(tx,u,s,scoped,studyId,id,processBody,guard?{guard,rootId:body.snapshotId}:undefined);return{id,replay:false,next};};return typeof analysis.withRootSourceGuard==='function'?analysis.withRootSourceGuard(tx,u,s,studyId,body.snapshotId,'dispatch',prepare):prepare(null);});if(!created.replay)return executeClaim(u,studyId,created.id,created.next);return api.read(u,studyId,created.id);},
  async process(u,studyId,id,body){if(body?.limit===3)return batch.process(u,studyId,id,body);only(body,['limit','requestKey','expectedStateHash']);validateMutation(body);if(body.limit!==1||typeof body.expectedStateHash!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedStateHash))invalid();const next=await transaction(u,studyId,(tx,s,scoped)=>claimOne(tx,u,s,scoped,studyId,id,body));return executeClaim(u,studyId,id,next);
  },
  read:withCapabilities,
  list:(u,studyId)=>transaction(u,studyId,async(tx,s)=>{const items=await tx.auditLog.findMany({where:{...s,action:ACTION,target:studyId},select:{id:true,createdAt:true,meta:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:50});return{studyId,items:items.map(x=>({id:x.id,runGroupId:x.id,snapshotId:x.meta.snapshotId,planId:x.meta.planId,createdAt:x.createdAt})),limit:50};}),
  capabilities:async(u,studyId,id)=>{const value=await withCapabilities(u,studyId,id);return{studyId,runId:id,status:value.status,reviewStatus:value.reviewStatus,capabilities:value.capabilities};},
  receipt:(u,studyId,key)=>transaction(u,studyId,async(tx,s)=>{validateMutation({requestKey:key});const saved=await repo.getReceipt(tx,u,key);if(saved?.action!=='full.analysis.run.create'||saved.result?.studyId!==studyId)throw researchError(404,'FULL_STUDY_RUN_RECEIPT_NOT_FOUND','未找到原运行回执。');const g=await group(tx,u,s,studyId,saved.result.runGroupId);return{...present(studyId,g,await rows(tx,s,g)),jobId:await linkedJobId(tx,s,studyId,g),receipt:saved.result.receipt};}),
  async review(u,studyId,id,body){only(body,['requestKey','conclusion','comment']);validateMutation(body);if(!['confirmed','returned','needs_input'].includes(body.conclusion)||typeof body.comment!=='string'||!body.comment.trim()||body.comment.length>5000)invalid();const scoped=await transaction(u,studyId,async(tx,s,actor)=>{const g=await group(tx,u,s,studyId,id);if(g.cancelled)fail('FULL_STUDY_RUN_BLOCKED');const runs=await rows(tx,s,g);if(runs.length!==g.a.meta.slices.length||runs.some(r=>!['needs_review','completed'].includes(r.status)))fail('FULL_STUDY_RUN_INCOMPLETE');return{actor,runs};});for(const row of scoped.runs)await methods.review(scoped.actor,row.id,{...body,requestKey:'full-review-'+fullStudyHash({requestKey:body.requestKey,runId:row.id})});return api.read(u,studyId,id);},
  async reviewReceipt(u,studyId,id,key){validateMutation({requestKey:key});const value=await transaction(u,studyId,async(tx,s,actor)=>{const g=await group(tx,u,s,studyId,id);if(g.cancelled)fail('FULL_STUDY_RUN_BLOCKED');const runs=await rows(tx,s,g);if(runs.length!==g.a.meta.slices.length||runs.some(r=>!['needs_review','completed'].includes(r.status)))fail('FULL_STUDY_RUN_INCOMPLETE');return{actor,runs};});for(const row of value.runs)await methods.getDescriptiveReviewReceipt(value.actor,row.id,'full-review-'+fullStudyHash({requestKey:key,runId:row.id}));return api.read(u,studyId,id);},
  async cancel(u,studyId,id){
   const assertActor=g=>{if(g.a.accountId!==u.accountId||g.a.meta.authVersion!==u.authVersion)throw researchError(403,'FULL_STUDY_RUN_ACTOR_CHANGED','当前身份不能取消原运行。');};
   const cancellable=r=>['queued','running','needs_review','needs_input'].includes(r.status);
   // Public capability calls own their transactions. The native callback below repeats
   // their authority under the final authorization/group/row locks before any audit.
   const before=await transaction(u,studyId,async(tx,s,actor)=>{
    await beforeLegacyGroup(tx,u,s,studyId,id,undefined,'cancel');const g=await group(tx,u,s,studyId,id);assertActor(g);const runs=await rows(tx,s,g);
    if(!g.cancelled&&!runs.some(cancellable)&&runs.length===g.a.meta.slices.length)fail('FULL_STUDY_RUN_NOT_CANCELLABLE');
    return{actor,runs:structuredClone(runs),stateHash:fullStudyHash({audit:g.a,runs,cancelled:g.cancelled})};
   });
   if(before.runs.length&&(typeof methods.getDescriptiveCapabilities!=='function'||typeof authorizeCancelInTransaction!=='function'))throw researchError(503,'FULL_STUDY_CANCEL_AUTHORITY_UNAVAILABLE','当前运行的取消权限暂不可核对。');
   for(const row of before.runs){const actual=await methods.getDescriptiveCapabilities(before.actor,row.id);if(actual.capabilities?.canCancel!==true)throw researchError(403,'FULL_STUDY_CANCEL_FORBIDDEN','当前账号无权取消此运行。');}
   const value=await transaction(u,studyId,async(tx,s,actor)=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':full-run:'+id},0))::text`;
    await beforeLegacyGroup(tx,u,s,studyId,id,undefined,'cancel');const g=await group(tx,u,s,studyId,id);assertActor(g);const runs=await rows(tx,s,g);
    if(fullStudyHash({audit:g.a,runs,cancelled:g.cancelled})!==before.stateHash)fail('FULL_STUDY_RUN_STATE_CHANGED');
    const events=await tx.auditLog.findMany({where:{...s,target:id,action:{in:['researchhub.full.analysis.process.claim','researchhub.full.analysis.process.finished']}},select:{id:true,action:true,meta:true},take:1000});
    if(events.some(e=>e.action==='researchhub.full.analysis.process.claim'&&!events.some(f=>f.action==='researchhub.full.analysis.process.finished'&&f.meta?.claimId===e.id)))fail('FULL_STUDY_PROCESS_PENDING');
    for(const row of runs)await authorizeCancelInTransaction(tx,actor,row);
    if(!g.cancelled)await tx.auditLog.createMany({data:{...s,accountId:u.accountId,action:'researchhub.full.analysis.run.cancel',target:id,meta:{studyId,authVersion:u.authVersion}}});
    return{actor,runs};
   });
   for(const row of value.runs)if(cancellable(row))await methods.cancel(value.actor,row.id);
   return api.read(u,studyId,id);
  },
  async confirmedBundleInTransaction(tx,u,s,studyId,id){const g=await group(tx,u,s,studyId,id,'export');if(g.cancelled)fail('FULL_STUDY_RUN_BLOCKED');const runs=await rows(tx,s,g),slices=[],proofCache=new Map([[studyId+':'+g.current.basis.planId+':'+g.current.basis.planReviewId,{manifest:g.current.manifest,hash:g.current.basis.manifestHash}]]);for(const slice of g.current.manifest.slices){const binding=g.a.meta.slices.find(x=>x.sliceId===slice.sliceId);if(!binding){if(!['not_applicable','no_valid_data'].includes(slice.status))fail('FULL_STUDY_RUN_INCOMPLETE');slices.push({...slice,rows:undefined});continue;}const r=runs.find(x=>x.idempotencyKey===binding.methodKey);if(!r||r.inputSummary?.studyId!==studyId||r.inputSummary?.snapshotId!==binding.snapshotId)fail('FULL_STUDY_RUN_INCOMPLETE');const current=await analysis.assertCurrent(tx,u,s,studyId,binding.snapshotId,'export',proofCache);await tx.$queryRaw`SELECT id FROM public.research_method_run WHERE id=${r.id} AND "tenantId"=${s.tenantId} FOR SHARE`;const actual=await tx.researchMethodRun.findFirst({where:{...s,id:r.id}}),review=await tx.researchMethodReview.findFirst({where:{...s,runId:r.id},orderBy:{version:'desc'}});if(!actual||fullStudyHash(actual)!==fullStudyHash(r)||review?.conclusion!=='confirmed'||!review.comment?.trim())fail('FULL_STUDY_METHOD_REVIEW_REQUIRED');buildT17Report(actual,current.basis,'固定来源核对');slices.push({...slice,rows:undefined,status:'confirmed',methodRunId:actual.id,executorVersion:actual.executorVersion,outputs:actual.artifactRefs.outputs,numericEvidence:actual.numericEvidence,basis:current.basis,actualRun:actual});}return{schemaVersion:'full-study-confirmed-runs-v2',studyId,planId:g.current.basis.planId,snapshotId:g.a.meta.snapshotId,manifestHash:g.current.basis.manifestHash,runGroupId:id,basis:g.current.basis,caseMetadata:g.current.manifest.caseMetadata,quality:g.current.manifest.quality,slices};},
  confirmedBundle:(u,studyId,id)=>transaction(u,studyId,(tx,s)=>api.confirmedBundleInTransaction(tx,u,s,studyId,id)),
 };
 Object.assign(api,createFullStudyReviewOperations({transaction:reviewTransaction,group,rows,methods,authorizeReviewInTransaction:methods.authorizeReviewInTransaction}));
 const singleReceipt=createFullStudyProcessReceipt({transaction:reviewTransaction,group,rows,present,analysis,verifyProcessRunInTransaction:methods.verifyProcessRunInTransaction});
 api.processReceipt=async(u,studyId,id,key)=>{const isBatch=await reviewTransaction(u,studyId,async tx=>{validateMutation({requestKey:key});const saved=await repo.getReceipt(tx,u,key);if(saved?.action!=='full.analysis.run.process'||saved.target_id!==id)return false;const claim=await tx.auditLog.findFirst({where:{id:saved.result?.claimId,accountId:u.accountId,tenantId:u.tenantId,action:'researchhub.full.analysis.process.claim',target:id}});if(saved.result?.batchVersion===BATCH_VERSION)return true;if(claim?.meta?.batchVersion===BATCH_VERSION)fail('FULL_STUDY_PROCESS_RECEIPT_CHANGED');return false;});return isBatch?batch.read(u,studyId,id,key):singleReceipt(u,studyId,id,key);};
 if(jobAdapter)Object.defineProperty(api,'jobBranch',{value:createFullStudyJobBridge({transaction:(ctx,fn)=>reviewTransaction(ctx.actor,ctx.job.studyId,async(tx,s)=>{if(fullStudyHash(s)!==fullStudyHash(ctx.scope))fail('ANALYSIS_JOB_BINDING_CHANGED');return fn(tx);}),analysis,methods,adapter:jobAdapter,authorizePublication,group,rows}),enumerable:false});
 return api;
}
