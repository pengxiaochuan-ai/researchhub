import {randomUUID} from 'node:crypto';
import {researchError,requestHash} from '../research-studies/contract.mjs';
import * as repo from '../research-studies/repository.mjs';
import {FULL_SCHEMA,fullStudyHash,fail} from './full-study-projection.mjs';
import {BATCH_VERSION} from './full-study-batch-receipt.mjs';
import {fullStudyJobTargetsHash,readFullStudyJobPending,fullStudyJobOpenClaims} from './full-study-batch-runs.mjs';
const GROUP='researchhub.full.analysis.run.group',CLAIM='researchhub.full.analysis.process.claim',FINISHED='researchhub.full.analysis.process.finished',STOPPED='researchhub.full.analysis.process.job_stopped';
const published=new Set(['needs_review','completed','needs_input']);
const unavailable=()=>{throw researchError(503,'ANALYSIS_JOB_BRIDGE_UNAVAILABLE','当前整课题后台执行暂不可用。');};
const changed=()=>fail('ANALYSIS_JOB_BINDING_CHANGED');
const immutable=t=>({sliceId:t.sliceId,snapshotId:t.snapshotId,methodKey:t.methodKey});
const stateHash=(id,hash,runs)=>fullStudyHash({groupId:id,manifestHash:hash,runs:runs.map(r=>({id:r.id,status:r.status,reviewStatus:r.reviewStatus})).sort((a,b)=>a.id.localeCompare(b.id))});

/** Trusted full branch only. No HTTP DTO, timer, candidate query or own lease. */
export function createFullStudyJobBridge({transaction,analysis,methods,adapter,authorizePublication,group,rows}){
 if(![transaction,authorizePublication,group,rows,analysis?.withRootSourceGuard,methods?.authorizeJobOperatorInTransaction,methods?.prepareJobBatchInTransaction,methods?.resumeJobBatch,methods?.settleJobBatchInTransaction,adapter?.beforeLocks].every(f=>typeof f==='function'))unavailable();
 const marker=(ctx,cp)=>({version:1,jobId:ctx.job.id,bindingHash:fullStudyHash({jobId:ctx.job.id,scope:ctx.scope,studyId:ctx.job.studyId,snapshotId:ctx.job.snapshotId,nativeCreateKey:ctx.job.nativeCreateKey,operator:ctx.job.operator,jobTargetsHash:fullStudyJobTargetsHash(cp.targets)})});
 async function current(tx,ctx){const[job]=await tx.$queryRaw`SELECT id,actor_id,actor_auth_version,checkpoint FROM rh_analysis.execution_job WHERE id=${ctx.job.id} AND tenant_id=${ctx.scope.tenantId} AND study_group_id=${ctx.scope.studyGroupId} AND research_project_id=${ctx.scope.researchProjectId} AND study_id=${ctx.job.studyId}`;if(!job||job.id!==ctx.job.id||job.checkpoint?.version!==1||typeof job.actor_id!=='string'||!Number.isSafeInteger(job.actor_auth_version)||job.actor_auth_version<0)changed();return rebase({...ctx,originalActor:{...ctx.scope,accountId:job.actor_id,authVersion:job.actor_auth_version}},job.checkpoint);}
 function rebase(ctx,cp){return{...ctx,job:{...ctx.job,checkpoint:structuredClone(cp)},...(typeof ctx.nativeContext==='function'?{nativeContext(id){const t=cp.targets.find(t=>t.targetId===id);if(!t)changed();const base=ctx.nativeContext(id);return{...base,target:{...base.target,runId:t.runId,inputHash:t.inputHash}};}}:{})};}
 async function guard(tx,ctx,kind,purpose){const fresh=await current(tx,ctx),t=fresh.job.checkpoint.targets[0];if(typeof fresh.nativeContext!=='function'||!t)unavailable();const context=fresh.nativeContext(t.targetId);await adapter.beforeLocks(tx,fresh.actor,{kind,scope:fresh.scope,studyId:fresh.job.studyId,snapshotId:t.snapshotId,methodKey:t.methodKey,context,...(purpose?{settlement:purpose}:{})});return current(tx,fresh);}
 async function rootFrame(tx,ctx,fn){return analysis.withRootSourceGuard(tx,ctx.actor,ctx.scope,ctx.job.studyId,ctx.job.snapshotId,'dispatch',async source=>{const root=await source.assertCurrent(tx,ctx.actor,ctx.scope,ctx.job.studyId,ctx.job.snapshotId,'dispatch');if(root.basis.manifestHash!==ctx.job.manifestHash||root.basis.planId!==ctx.job.planId||root.basis.planReviewId!==ctx.job.reviewId)changed();return fn(root);});}
 async function authorize(tx,ctx){await authorizePublication(tx,ctx.actor,ctx.job.studyId,ctx.scope);if(fullStudyHash(await methods.authorizeJobOperatorInTransaction(tx,ctx.actor,ctx.job.operator))!==fullStudyHash(ctx.job.operator))changed();}
 const proofContext=ctx=>({...ctx,actor:ctx.originalActor,settlingActor:ctx.actor});
 async function header(tx,ctx,root){
  const cp=ctx.job.checkpoint;if(cp.runGroupId===null)return null;
  const a=await tx.auditLog.findFirst({where:{...ctx.scope,id:cp.runGroupId,action:GROUP,target:ctx.job.studyId}}),u=ctx.originalActor,old=await repo.getReceipt(tx,u,ctx.job.nativeCreateKey),digest=requestHash({studyId:ctx.job.studyId,body:{requestKey:ctx.job.nativeCreateKey,snapshotId:ctx.job.snapshotId}});
  if(!a||!a.meta||!a.meta.researchAnalysisJob||!Array.isArray(a.meta.slices)||a.accountId!==u.accountId||a.meta.authVersion!==u.authVersion||a.meta.requestKey!==ctx.job.nativeCreateKey||a.meta.schemaVersion!==FULL_SCHEMA||a.meta.snapshotId!==ctx.job.snapshotId||a.meta.manifestHash!==ctx.job.manifestHash||a.meta.planId!==ctx.job.planId||fullStudyHash(a.meta.researchAnalysisJob)!==fullStudyHash(marker(ctx,cp))||fullStudyHash(a.meta.slices)!==fullStudyHash(cp.targets.map(immutable))||old?.action!=='full.analysis.run.create'||old.request_hash!==digest||old.audit_id!==a.id||old.target_id!==ctx.job.studyId||old.result?.runGroupId!==a.id||old.result.studyId!==ctx.job.studyId||old.result.receipt?.requestKey!==ctx.job.nativeCreateKey)changed();
  if(root)return group(tx,ctx.actor,ctx.scope,ctx.job.studyId,cp.runGroupId,'dispatch',root);
  const cancelled=await tx.auditLog.findFirst({where:{...ctx.scope,action:'researchhub.full.analysis.run.cancel',target:a.id},select:{id:true}});return{a,cancelled:Boolean(cancelled)};
 }

 async function nativeFacts(tx,ctx,g){
  const cp=ctx.job.checkpoint,rs=g?await rows(tx,ctx.scope,g):[],facts=[],auditRows=rs.length?await tx.auditLog.findMany({where:{...ctx.scope,target:{in:rs.map(r=>r.id)},action:{in:['research_method_run_publish','research_method_run_failed','research_method_run_cancel']}}}):[];
  for(const t of cp.targets){const matching=rs.filter(r=>r.idempotencyKey===t.methodKey);if(matching.length>1)changed();const r=matching[0];
   if(!r){if(t.runId!==null||t.inputHash!==null)changed();facts.push({t,run:null,state:'not_started',proofId:ctx.stopProofId??null});continue;}
   const expectedMarker={version:1,jobId:ctx.job.id,targetId:t.targetId,bindingHash:fullStudyHash({jobId:ctx.job.id,targetId:t.targetId,scope:ctx.scope,studyId:ctx.job.studyId,snapshotId:t.snapshotId,methodKey:t.methodKey,operator:ctx.job.operator})};
   if(!r.environment?.researchAnalysisJob||!r.inputSummary||r.id!==t.runId||r.inputHash!==t.inputHash||r.accountId!==ctx.originalActor.accountId||r.agentId!==ctx.job.operator.agentId||r.skillVersion!==ctx.job.operator.skillVersion||r.executorVersion!==ctx.job.operator.executorVersion||r.skillKey!=='descriptive-statistics'||Object.entries(ctx.scope).some(([k,v])=>r[k]!==v)||fullStudyHash(r.inputSummary)!==fullStudyHash({studyId:ctx.job.studyId,snapshotId:t.snapshotId})||fullStudyHash(r.environment?.researchAnalysisJob)!==fullStudyHash(expectedMarker))changed();
   const state=published.has(r.status)?'published':r.status==='failed'?'failed':r.status==='cancelled'?'cancelled':'processing',action=state==='published'?'research_method_run_publish':state==='failed'?'research_method_run_failed':state==='cancelled'?'research_method_run_cancel':null;
   const who=state==='cancelled'?ctx.actor.accountId:ctx.originalActor.accountId,a=auditRows.find(a=>a.target===r.id&&a.action===action&&a.accountId===who&&(state!=='published'||r.environment?.claim&&a.meta?.claim===r.environment.claim));
   if(state!=='processing'&&!a)changed();facts.push({t,run:r,state,proofId:a?.id??null});
  }return facts;
 }
 function terminal(ctx,cp,facts,status,open){if(open.length)return{checkpoint:cp,terminal:null};return{checkpoint:cp,terminal:{status,targets:facts.map(({t,state,proofId})=>({targetId:t.targetId,runId:t.runId,inputHash:t.inputHash,state,proofId})),openClaimIds:open}};}
 async function finish(tx,ctx,root,purpose){
  ctx=await guard(tx,ctx,purpose?'settle':'publish',purpose);await authorize(tx,ctx);const g=await header(tx,ctx,root),p=await readFullStudyJobPending(tx,proofContext(ctx));if(!p)return ctx;
  const facts=await nativeFacts(tx,ctx,g),members=facts.filter(f=>p.pending.targetIds.includes(f.t.targetId));if(members.some(f=>['processing','not_started'].includes(f.state)))return ctx;
  const open=await fullStudyJobOpenClaims(tx,proofContext(ctx));if(open.some(id=>id!==p.claim.id))changed();
  if(open.includes(p.claim.id))await tx.auditLog.createMany({data:{...ctx.scope,accountId:ctx.actor.accountId,action:FINISHED,target:g.a.id,meta:{claimId:p.claim.id,status:members.every(f=>f.state==='published')?'returned':'failed',jobId:ctx.job.id,requestDigest:p.pending.requestHash,jobTargetsHash:p.pending.jobTargetsHash,...(p.pending.kind==='batch'?{targetsHash:p.pending.targetsHash}:{methodKey:p.pending.methodKey})}}});
  const cp=structuredClone((await current(tx,ctx)).job.checkpoint);cp.pending=null;if(!cp.finishedClaimIds.includes(p.claim.id))cp.finishedClaimIds.push(p.claim.id);await ctx.checkpointInTransaction(tx,cp);return current(tx,ctx);
 }
 async function claim(tx,ctx,g,rs,first=false){
  const cp=ctx.job.checkpoint;if(cp.pending!==null){await readFullStudyJobPending(tx,proofContext(ctx));return ctx;}
  if((await fullStudyJobOpenClaims(tx,proofContext(ctx))).length)changed();
  if(rs.some(r=>['failed','cancelled'].includes(r.status)))fail('ANALYSIS_JOB_NATIVE_FAILED');if(rs.some(r=>['queued','running'].includes(r.status)))changed();
  const targets=cp.targets.filter(t=>t.runId===null).slice(0,first?1:3);if(!targets.length)return ctx;
  const key=first?'full-first-'+fullStudyHash(ctx.job.nativeCreateKey):'full-job-batch-'+fullStudyHash({key:ctx.job.nativeCreateKey,finished:cp.finishedClaimIds}),body={limit:first?1:3,requestKey:key,expectedStateHash:stateHash(g.a.id,ctx.job.manifestHash,rs)},digest=requestHash({studyId:ctx.job.studyId,id:g.a.id,body}),claimId=(first?'full-claim-':'full-batch-claim-')+randomUUID(),jobTargetsHash=fullStudyJobTargetsHash(targets),nativeTargets=targets.map(immutable),targetsHash=fullStudyHash(nativeTargets);
  if(await repo.getReceipt(tx,ctx.actor,key))changed();
  const m={requestKey:key,requestDigest:digest,authVersion:ctx.actor.authVersion,jobId:ctx.job.id,jobTargetsHash,...(first?{methodKey:targets[0].methodKey,snapshotId:targets[0].snapshotId}:{batchVersion:BATCH_VERSION,limit:3,rootSnapshotId:ctx.job.snapshotId,manifestHash:ctx.job.manifestHash,targets:nativeTargets,targetsHash})};
  await tx.auditLog.createMany({data:{id:claimId,...ctx.scope,accountId:ctx.actor.accountId,action:CLAIM,target:g.a.id,meta:m}});
  const result={studyId:ctx.job.studyId,runGroupId:g.a.id,claimId,...(first?{accepted:true,executionConfirmed:false,receipt:{requestKey:key,action:'full.analysis.run.process',targetId:g.a.id}}:{batchVersion:BATCH_VERSION,limit:3,targetsHash})};
  await repo.saveReceipt(tx,ctx.actor,{id:(first?'full-process-op-':'full-batch-op-')+randomUUID(),key,hash:digest,action:'full.analysis.run.process',target:g.a.id,result,auditId:claimId});
  cp.pending={kind:first?'first':'batch',claimId,requestKey:key,requestHash:digest,body,jobTargetsHash,targetIds:targets.map(t=>t.targetId),...(first?{methodKey:targets[0].methodKey,snapshotId:targets[0].snapshotId}:{batchVersion:BATCH_VERSION,targetsHash})};await ctx.checkpointInTransaction(tx,cp);return current(tx,ctx);
 }
 async function prepareParent(tx,ctx){
  ctx=await guard(tx,ctx,'prepare');if(ctx.actor.accountId!==ctx.originalActor.accountId||ctx.actor.authVersion!==ctx.originalActor.authVersion)changed();await authorize(tx,ctx);
  return rootFrame(tx,ctx,async root=>{let g=await header(tx,ctx,root),first=false;
   if(!g){const old=await repo.getReceipt(tx,ctx.actor,ctx.job.nativeCreateKey);if(old)changed();const ready=root.manifest.slices.filter(s=>s.status==='ready');if(fullStudyHash(ready.map(s=>s.sliceId))!==fullStudyHash(ctx.job.checkpoint.targets.map(t=>t.sliceId)))changed();
    const snapshots=await tx.$queryRaw`SELECT id,manifest,manifest_hash FROM rh_analysis.snapshot WHERE tenant_id=${ctx.scope.tenantId} AND study_group_id=${ctx.scope.studyGroupId} AND research_project_id=${ctx.scope.researchProjectId} AND study_id=${ctx.job.studyId} AND plan_id=${ctx.job.planId} AND manifest->>'rootSnapshotId'=${ctx.job.snapshotId} ORDER BY id`;
    for(const t of ctx.job.checkpoint.targets){const matches=snapshots.filter(s=>s.id===t.snapshotId&&s.manifest?.sliceId===t.sliceId);if(matches.length!==1||fullStudyHash(matches[0].manifest)!==matches[0].manifest_hash)changed();}
    const id='full-run-'+randomUUID(),meta={schemaVersion:FULL_SCHEMA,studyId:ctx.job.studyId,snapshotId:ctx.job.snapshotId,manifestHash:ctx.job.manifestHash,planId:ctx.job.planId,requestKey:ctx.job.nativeCreateKey,authVersion:ctx.actor.authVersion,slices:ctx.job.checkpoint.targets.map(immutable),researchAnalysisJob:marker(ctx,ctx.job.checkpoint)};
    await tx.auditLog.createMany({data:{id,...ctx.scope,accountId:ctx.actor.accountId,action:GROUP,target:ctx.job.studyId,meta}});const result={studyId:ctx.job.studyId,runGroupId:id,receipt:{requestKey:ctx.job.nativeCreateKey,action:'full.analysis.run.create',targetId:ctx.job.studyId}};await repo.saveReceipt(tx,ctx.actor,{id:'full-run-op-'+randomUUID(),key:ctx.job.nativeCreateKey,hash:requestHash({studyId:ctx.job.studyId,body:{requestKey:ctx.job.nativeCreateKey,snapshotId:ctx.job.snapshotId}}),action:'full.analysis.run.create',target:ctx.job.studyId,result,auditId:id});
    const cp=ctx.job.checkpoint;cp.runGroupId=id;await ctx.checkpointInTransaction(tx,cp);ctx=await current(tx,ctx);g={a:{id,accountId:ctx.actor.accountId,meta},current:root,cancelled:false};first=true;
   }
   const rs=await rows(tx,ctx.scope,g);if(ctx.job.checkpoint.pending){const p=await readFullStudyJobPending(tx,proofContext(ctx)),facts=await nativeFacts(tx,ctx,g);if(p.targets.every(t=>facts.some(f=>f.t.targetId===t.targetId&&!['processing','not_started'].includes(f.state))))return{...await finish(tx,ctx,root),repaired:true};if(facts.some(f=>['failed','cancelled'].includes(f.state)))fail('ANALYSIS_JOB_NATIVE_FAILED');}return claim(tx,ctx,g,rs,first);
  });
 }
 return Object.freeze({
  async advance(initial){
   let ctx=await transaction(initial,tx=>prepareParent(tx,initial)),cp=ctx.job.checkpoint;if(ctx.repaired||cp.pending===null)return;
   ctx=await transaction(ctx,async tx=>{let fresh=await guard(tx,ctx,'prepare');const p=await readFullStudyJobPending(tx,proofContext(fresh));if(!p)return{...fresh,computeTargets:[]};const facts=await nativeFacts(tx,fresh,await header(tx,fresh));if(facts.some(f=>['failed','cancelled'].includes(f.state)))fail('ANALYSIS_JOB_NATIVE_FAILED');const targets=p.targets.filter(t=>!facts.some(f=>f.t.targetId===t.targetId&&f.state==='published'));if(targets.length)await methods.prepareJobBatchInTransaction(tx,fresh.actor,targets.map(t=>fresh.nativeContext(t.targetId)),{studyId:fresh.job.studyId,rootSnapshotId:fresh.job.snapshotId});fresh=await current(tx,fresh);return{...fresh,computeTargets:targets.map(t=>t.targetId)};});
   if(ctx.job.checkpoint.pending===null)return;
   if(!ctx.computeTargets.length){await transaction(ctx,async tx=>{const fresh=await guard(tx,ctx,'publish');return rootFrame(tx,fresh,root=>finish(tx,fresh,root));});return;}
   const targets=ctx.job.checkpoint.targets.filter(t=>ctx.computeTargets.includes(t.targetId));
   try{await methods.resumeJobBatch(ctx.actor,targets.map(t=>ctx.nativeContext(t.targetId)),{studyId:ctx.job.studyId,rootSnapshotId:ctx.job.snapshotId},{authorizePublication:tx=>authorizePublication(tx,ctx.actor,ctx.job.studyId,ctx.scope),...(ctx.job.checkpoint.pending.kind==='batch'?{finishInTransaction:(tx,root)=>finish(tx,ctx,root)}:{})});}catch(error){
    try{await transaction(ctx,async tx=>{const fresh=await guard(tx,ctx,'publish');await authorize(tx,fresh);await rootFrame(tx,fresh,async root=>{await header(tx,fresh,root);const p=await readFullStudyJobPending(tx,proofContext(fresh)),code=error?.getResponse?.()?.code??error?.code;if(p)await tx.auditLog.createMany({data:{...fresh.scope,accountId:fresh.actor.accountId,action:'researchhub.full.analysis.process.attempt_failed',target:fresh.job.checkpoint.runGroupId,meta:{jobId:fresh.job.id,claimId:p.claim.id,errorCode:typeof code==='string'&&/^[A-Z0-9_]{1,100}$/.test(code)?code:'FULL_STUDY_BATCH_UNPROVED'}}});});});}catch{/* Failure evidence never borrows a lost lease or masks the original error. */}throw error;
   }
   if(ctx.job.checkpoint.pending.kind==='first')await transaction(ctx,async tx=>{const fresh=await guard(tx,ctx,'publish');return rootFrame(tx,fresh,root=>finish(tx,fresh,root));});
  },
  async reconcile(tx,initial){
   let ctx=await current(tx,initial);await authorizePublication(tx,ctx.actor,ctx.job.studyId,ctx.scope);const g=await header(tx,ctx),facts=await nativeFacts(tx,ctx,g),open=await fullStudyJobOpenClaims(tx,proofContext(ctx));
   if(ctx.job.checkpoint.pending){const p=await readFullStudyJobPending(tx,proofContext(ctx));if(!open.includes(p.claim.id)&&p.targets.every(t=>facts.some(f=>f.t.targetId===t.targetId&&!['processing','not_started'].includes(f.state)))){const cp=ctx.job.checkpoint;cp.pending=null;if(!cp.finishedClaimIds.includes(p.claim.id))cp.finishedClaimIds.push(p.claim.id);ctx=rebase(ctx,cp);}}
   if(facts.some(f=>['failed','cancelled'].includes(f.state)))fail('ANALYSIS_JOB_NATIVE_FAILED');
   if(facts.every(f=>f.state==='published')&&!open.length&&ctx.job.checkpoint.pending===null)return rootFrame(tx,ctx,async root=>{await header(tx,ctx,root);return terminal(ctx,ctx.job.checkpoint,facts,'completed',open);});
   return{checkpoint:ctx.job.checkpoint,terminal:null};
  },
  async settle(tx,initial,purpose){
   if(fullStudyHash(initial.settlement)!==fullStudyHash(purpose))changed();let ctx=await guard(tx,initial,'settle',purpose);await authorize(tx,ctx);
   return rootFrame(tx,ctx,async root=>{const g=await header(tx,ctx,root);if(g){let p=await readFullStudyJobPending(tx,proofContext(ctx));const before=await nativeFacts(tx,ctx,g);if(purpose.kind==='runtime-failure'&&p&&p.targets.every(t=>before.some(f=>f.t.targetId===t.targetId&&f.state==='published'))){ctx=await finish(tx,ctx,root,purpose);p=null;}const pending=before.filter(f=>f.state==='processing');for(let i=0;i<pending.length;i+=3)await methods.settleJobBatchInTransaction(tx,ctx.actor,pending.slice(i,i+3).map(f=>ctx.nativeContext(f.t.targetId)),purpose);ctx=await current(tx,ctx);if(p&&(await fullStudyJobOpenClaims(tx,proofContext(ctx))).includes(p.claim.id))await tx.auditLog.createMany({data:{...ctx.scope,accountId:ctx.actor.accountId,action:STOPPED,target:g.a.id,meta:{jobId:ctx.job.id,claimId:p.claim.id,requestDigest:p.pending.requestHash,jobTargetsHash:p.pending.jobTargetsHash,status:purpose.kind==='cancel'?'cancelled':'failed',stopProofId:ctx.stopProofId}}});
     if(p){const cp=ctx.job.checkpoint;cp.pending=null;if(!cp.finishedClaimIds.includes(p.claim.id))cp.finishedClaimIds.push(p.claim.id);await ctx.checkpointInTransaction(tx,cp);ctx=await current(tx,ctx);}
    }else await methods.settleJobBatchInTransaction(tx,ctx.actor,[ctx.nativeContext(ctx.job.checkpoint.targets[0].targetId)],purpose);
    const facts=await nativeFacts(tx,ctx,g),open=await fullStudyJobOpenClaims(tx,proofContext(ctx));if(facts.some(f=>f.state==='processing')||open.length)changed();return terminal(ctx,ctx.job.checkpoint,facts,purpose.kind==='cancel'?'cancelled':facts.every(f=>f.state==='published')?'completed':'failed',open);
   });
  },
 });
}
