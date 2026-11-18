import {randomUUID} from 'node:crypto';
import {researchError,only,validateMutation,invalid,requestHash} from '../research-studies/contract.mjs';
import * as repo from '../research-studies/repository.mjs';
import {fullStudyHash,fail} from './full-study-projection.mjs';
import {BATCH_VERSION,batchTargets,batchReceipt} from './full-study-batch-receipt.mjs';
const ACTION='researchhub.full.analysis.run.group',CLAIM='researchhub.full.analysis.process.claim',FINISHED='researchhub.full.analysis.process.finished';
const terminal=new Set(['needs_review','completed','needs_input','failed','cancelled']);
// Internal Job metadata proof. First retains its native single-claim contract;
// only a batch has native targetsHash/BATCH_VERSION. Mutable Run bindings never
// become the immutable request/source digest.
export function fullStudyJobTargetsHash(targets){return fullStudyHash(targets.map(({targetId,sliceId,snapshotId,methodKey})=>({targetId,sliceId,snapshotId,methodKey})));}
export async function readFullStudyJobPending(tx,ctx){
 const {job,actor,scope}=ctx,p=job.checkpoint.pending;if(p===null)return null;const bad=()=>fail('ANALYSIS_JOB_CLAIM_CHANGED'),first=p?.kind==='first',keys=['kind','claimId','requestKey','requestHash','body','jobTargetsHash','targetIds',...(first?['methodKey','snapshotId']:['batchVersion','targetsHash'])];
 if(!p||!['first','batch'].includes(p.kind)||Object.keys(p).sort().join(',')!==keys.sort().join(',')||!Array.isArray(p.targetIds)||p.targetIds.length<1||p.targetIds.length>(first?1:3)||new Set(p.targetIds).size!==p.targetIds.length||!p.body||Object.keys(p.body).sort().join(',')!=='expectedStateHash,limit,requestKey'||p.body.limit!==(first?1:3)||p.body.requestKey!==p.requestKey||requestHash({studyId:job.studyId,id:job.checkpoint.runGroupId,body:p.body})!==p.requestHash)bad();
 const targets=p.targetIds.map(id=>job.checkpoint.targets.find(t=>t.targetId===id));if(targets.some(t=>!t)||fullStudyJobTargetsHash(targets)!==p.jobTargetsHash)bad();
 const claim=await tx.auditLog.findFirst({where:{...scope,id:p.claimId,accountId:actor.accountId,action:CLAIM,target:job.checkpoint.runGroupId}}),m=claim?.meta,saved=await repo.getReceipt(tx,actor,p.requestKey);
 if(!m||m.jobId!==job.id||m.jobTargetsHash!==p.jobTargetsHash||m.requestKey!==p.requestKey||m.requestDigest!==p.requestHash||m.authVersion!==actor.authVersion||saved?.action!=='full.analysis.run.process'||saved.target_id!==job.checkpoint.runGroupId||saved.request_hash!==p.requestHash||saved.audit_id!==claim.id||saved.result?.studyId!==job.studyId||saved.result.runGroupId!==job.checkpoint.runGroupId||saved.result.claimId!==claim.id)bad();
 if(first){if(m.batchVersion!==undefined||m.targetsHash!==undefined||m.methodKey!==p.methodKey||m.snapshotId!==p.snapshotId||targets[0].methodKey!==p.methodKey||targets[0].snapshotId!==p.snapshotId)bad();}
 else{const nativeTargets=targets.map(({sliceId,methodKey,snapshotId})=>({sliceId,methodKey,snapshotId}));if(p.batchVersion!==BATCH_VERSION||!Array.isArray(m.targets)||m.batchVersion!==BATCH_VERSION||m.limit!==3||m.targetsHash!==p.targetsHash||fullStudyHash(nativeTargets)!==p.targetsHash||fullStudyHash(m.targets)!==p.targetsHash||m.rootSnapshotId!==job.snapshotId||m.manifestHash!==job.manifestHash||saved.result.batchVersion!==BATCH_VERSION||saved.result.limit!==3||saved.result.targetsHash!==p.targetsHash)bad();try{batchTargets('process',m.targets,p.targetsHash);}catch{bad();}}
 return{pending:structuredClone(p),targets,claim,operation:saved};
}
export async function fullStudyJobOpenClaims(tx,ctx){
 if(ctx.job.checkpoint.runGroupId===null)return[];
 const all=await tx.auditLog.findMany({where:{...ctx.scope,target:ctx.job.checkpoint.runGroupId,action:{in:[CLAIM,FINISHED,'researchhub.full.analysis.process.job_stopped']}}}),claims=all.filter(e=>e.action===CLAIM),open=[];
 for(const c of claims){if(c.accountId!==ctx.actor.accountId||c.meta?.jobId!==ctx.job.id||c.meta.authVersion!==ctx.actor.authVersion)fail('ANALYSIS_JOB_CLAIM_CHANGED');const ends=all.filter(e=>e.action!==CLAIM&&e.meta?.claimId===c.id);if(ends.length>1)fail('ANALYSIS_JOB_CLAIM_CHANGED');if(!ends.length){open.push(c.id);continue;}const end=ends[0];const who=end.action==='researchhub.full.analysis.process.job_stopped'?ctx.settlingActor?.accountId??ctx.actor.accountId:ctx.actor.accountId;if(end.accountId!==who||end.action==='researchhub.full.analysis.process.job_stopped'&&ctx.stopProofId!==undefined&&end.meta.stopProofId!==ctx.stopProofId||end.meta.jobId!==ctx.job.id||end.meta.requestDigest!==c.meta.requestDigest||end.meta.jobTargetsHash!==c.meta.jobTargetsHash||!['returned','failed','cancelled'].includes(end.meta.status))fail('ANALYSIS_JOB_CLAIM_CHANGED');}
 if(all.some(e=>e.action!==CLAIM&&!claims.some(c=>c.id===e.meta?.claimId)))fail('ANALYSIS_JOB_CLAIM_CHANGED');return open;
}
export function createFullStudyBatchProcess({transaction,reviewTransaction,group,rows,present,addCapabilities,authorizePublication,analysis,methods,beforeLegacyGroup}){
 const ready=()=>typeof methods.createBatchFromWorkbench==='function'&&typeof analysis.withBatchResolver==='function';
 const unavailable=()=>researchError(503,'FULL_STUDY_BATCH_UNAVAILABLE','当前批次处理暂不可用，请保留原操作记录。');
 const requireReady=()=>{if(!ready())throw unavailable();};
 const assertActor=(u,g)=>{if(g.a.accountId!==u.accountId||g.a.meta.authVersion!==u.authVersion)throw researchError(403,'FULL_STUDY_RUN_ACTOR_CHANGED','请使用发起计算时的账号核对原运行。');};
 async function read(u,studyId,id,key,options={}){
  requireReady();validateMutation({requestKey:key});
  return reviewTransaction(u,studyId,(tx,s,actor)=>prove(tx,s,actor,u,studyId,id,key,options));
 }
 async function prove(tx,s,actor,u,studyId,id,key,{finish,withActual=false,reconcile=false}={},frame){
   const saved=await repo.getReceipt(tx,u,key);if(saved?.action!=='full.analysis.run.process'||saved.target_id!==id||saved.result?.studyId!==studyId||saved.result?.runGroupId!==id)throw researchError(404,'FULL_STUDY_PROCESS_RECEIPT_NOT_FOUND','暂未查到原计算请求。');
   const claim=await tx.auditLog.findFirst({where:{...s,id:saved.result.claimId,accountId:u.accountId,action:CLAIM,target:id}}),m=claim?.meta;
   if(saved.result?.batchVersion!==BATCH_VERSION||saved.result.limit!==3||saved.result.targetsHash!==m?.targetsHash||m?.batchVersion!==BATCH_VERSION||m.limit!==3||typeof m.requestDigest!=='string'||!/^[a-f0-9]{64}$/.test(m.requestDigest)||m.requestKey!==key||m.authVersion!==u.authVersion||saved.audit_id!==claim.id||saved.request_hash!==m.requestDigest)fail('FULL_STUDY_PROCESS_RECEIPT_CHANGED');
   const targets=batchTargets('process',m.targets,m.targetsHash),header=await tx.auditLog.findFirst({where:{...s,id,action:ACTION,target:studyId}});if(!header||header.meta?.snapshotId!==m.rootSnapshotId||header.meta.manifestHash!==m.manifestHash)fail('FULL_STUDY_BATCH_CHANGED');
   if(frame&&(m.rootSnapshotId!==frame.rootSnapshotId||m.targetsHash!==frame.targetsHash||m.requestDigest!==frame.requestDigest||claim.id!==finish?.claimId))fail('FULL_STUDY_BATCH_CHANGED');
   async function check(resolver,view,current,phase){
    const g=await group(view,u,s,studyId,id,phase,current);assertActor(u,g);const rs=await rows(view,s,g),items=[];
    for(const t of targets){if(!g.a.meta.slices.some(b=>fullStudyHash(b)===fullStudyHash(t)))fail('FULL_STUDY_BATCH_CHANGED');const matches=rs.filter(r=>r.idempotencyKey===t.methodKey);if(matches.length>1)fail('FULL_STUDY_BATCH_CHANGED');let r=matches[0];
     if(r){if(r.accountId!==u.accountId||r.inputSummary?.studyId!==studyId||r.inputSummary?.snapshotId!==t.snapshotId||r.skillKey!=='descriptive-statistics'||!['tenantId','studyGroupId','researchProjectId'].every(k=>r[k]===s[k]))fail('FULL_STUDY_BATCH_CHANGED');const proof=await resolver.assertCurrent(view,actor,s,studyId,t.snapshotId,phase);r=await methods.verifyProcessRunInTransaction(view,actor,r,proof);}
     const proved=Boolean(r&&terminal.has(r.status));items.push({...t,runId:r?.id??null,status:proved?['failed','cancelled'].includes(r.status)?'failed':'completed':'processing',executionConfirmed:proved});
    }
    const batch=batchReceipt('process',{studyId,runGroupId:id,requestKey:key,snapshotId:m.rootSnapshotId,manifestHash:m.manifestHash},targets,items);
    if((reconcile||frame)&&!batch.executionConfirmed)fail('FULL_STUDY_PROCESS_PENDING');if(finish?.failure&&!batch.executionConfirmed)await view.auditLog.createMany({data:{...s,accountId:u.accountId,action:'researchhub.full.analysis.process.attempt_failed',target:id,meta:{claimId:claim.id,targetsHash:m.targetsHash,errorCode:finish.failure.code??'FULL_STUDY_BATCH_UNPROVED'}}});if((finish||reconcile)&&batch.executionConfirmed){if(finish&&finish.claimId!==claim.id)fail('FULL_STUDY_BATCH_CHANGED');const events=await view.auditLog.findMany({where:{...s,accountId:u.accountId,action:FINISHED,target:id}});if(!events.some(e=>e.meta?.claimId===claim.id))await view.auditLog.createMany({data:{...s,accountId:u.accountId,action:FINISHED,target:id,meta:{claimId:claim.id,status:finish?.failure?'failed':'returned',targetsHash:m.targetsHash,...(reconcile?{recovered:true}:{})}}});}
    return{...(withActual?{_actual:{value:present(studyId,g,rs),scoped:actor,isActor:true,runs:rs,batchProcess:true}}:{}),studyId,runGroupId:id,requestKey:key,status:batch.status,executionConfirmed:batch.executionConfirmed,group:{...present(studyId,g,rs),capabilities:{canReview:false,canCancel:false,canProcessRun:false}},receipt:{requestKey:key,action:'full.analysis.run.process',targetId:id},batchReceipt:batch};
   }
   if(frame)return check(frame.resolver,tx,frame.current,'publish');
   return analysis.withBatchResolver(tx,actor,s,studyId,m.rootSnapshotId,targets.map(t=>t.snapshotId),'snapshot',(resolver,view,current)=>check(resolver,view,current,'snapshot'));
 }
 async function process(u,studyId,id,body){
  only(body,['limit','requestKey','expectedStateHash']);validateMutation(body);if(body.limit!==3||typeof body.expectedStateHash!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedStateHash))invalid();requireReady();
  if(typeof methods.createBatchAndProve!=='function'||typeof authorizePublication!=='function')throw unavailable();
  const key=body.requestKey;
  const accepted=await reviewTransaction(u,studyId,async(tx,s,actor)=>{
   const readOnly=await beforeLegacyGroup?.(tx,u,s,studyId,id,body);if(readOnly)return readOnly;
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':full-run:'+id},0))::text`;
   const g=await group(tx,u,s,studyId,id);assertActor(u,g);if(g.cancelled)fail('FULL_STUDY_RUN_BLOCKED');const digest=requestHash({studyId,id,body}),old=await repo.getReceipt(tx,u,body.requestKey);
   if(old){if(old.action!=='full.analysis.run.process'||old.target_id!==id||old.request_hash!==digest)fail('RESEARCH_REQUEST_KEY_CONFLICT');return{replay:true};}
   const existing=await rows(tx,s,g),state=present(studyId,g,existing);if(state.stateHash!==body.expectedStateHash)fail('FULL_STUDY_RUN_STATE_CHANGED');
   const events=await tx.auditLog.findMany({where:{...s,target:id,action:{in:[CLAIM,FINISHED]}},select:{id:true,action:true,meta:true},take:1000});
   if(existing.some(r=>['queued','running'].includes(r.status)))fail('FULL_STUDY_PROCESS_PENDING');
   for(const c of events.filter(c=>c.action===CLAIM&&!events.some(f=>f.action===FINISHED&&f.meta?.claimId===c.id))){if(c.meta?.batchVersion!==BATCH_VERSION)fail('FULL_STUDY_PROCESS_PENDING');await prove(tx,s,actor,u,studyId,id,c.meta.requestKey,{reconcile:true});}
   if(existing.some(r=>['failed','cancelled','needs_input'].includes(r.status)))fail('FULL_STUDY_RUN_BLOCKED');
   const targets=batchTargets('process',g.a.meta.slices.filter(t=>!existing.some(r=>r.idempotencyKey===t.methodKey)).slice(0,3));
   const claimId='full-batch-claim-'+randomUUID(),meta={batchVersion:BATCH_VERSION,limit:3,requestKey:body.requestKey,requestDigest:digest,authVersion:u.authVersion,rootSnapshotId:g.a.meta.snapshotId,manifestHash:g.a.meta.manifestHash,targets,targetsHash:fullStudyHash(targets)};
   await tx.auditLog.createMany({data:{id:claimId,...s,accountId:u.accountId,action:CLAIM,target:id,meta}});
   await repo.saveReceipt(tx,u,{id:'full-batch-op-'+randomUUID(),key:body.requestKey,hash:digest,action:'full.analysis.run.process',target:id,result:{studyId,runGroupId:id,claimId,batchVersion:BATCH_VERSION,limit:3,targetsHash:meta.targetsHash},auditId:claimId});return{actor,scope:s,targets,claimId,rootSnapshotId:g.a.meta.snapshotId,targetsHash:meta.targetsHash,requestDigest:digest};
  });
  if(accepted.readOnlyJob)return read(u,studyId,id,key);
  let receipt,failure;
  if(!accepted.replay){
   const {actor,scope,claimId,rootSnapshotId,targetsHash,requestDigest}=accepted;
   const items=accepted.targets.map(t=>({skillKey:'descriptive-statistics',idempotencyKey:t.methodKey,input:{studyId,snapshotId:t.snapshotId}}));
   let result,proved,authorized=false;
   try{
    result=await methods.createBatchAndProve(actor,items,{studyId,rootSnapshotId},{
     authorizePublication:async physical=>{
      if(authorized)throw unavailable();
      await authorizePublication(physical,actor,studyId,scope);
      authorized=true;
     },
     provePublication:async(resolver,view,current)=>{
      if(!authorized||proved||!resolver||!view||!current)throw unavailable();
      proved=await prove(view,scope,actor,u,studyId,id,key,{finish:{claimId},withActual:true},{resolver,current,rootSnapshotId,targetsHash,requestDigest});
      return proved;
     }
    });
   }catch(error){failure=error;}
   // Only a successfully committed callback can return its exact parent proof.
   // Existing members or failed native results use the independent, fresh path.
   if(!failure){
    if(result?.kind==='published'&&proved?.executionConfirmed&&result.receipt===proved)receipt=proved;
    else if(proved||!['existing','failed'].includes(result?.kind))throw unavailable();
   }
  }
  if(!receipt)receipt=await read(u,studyId,id,key,{...(!accepted.replay?{finish:{claimId:accepted.claimId,failure}}:{}),withActual:true,...(accepted.replay?{reconcile:true}:{})});
  if(failure)throw failure;if(!receipt.executionConfirmed)fail('FULL_STUDY_PROCESS_PENDING');
  return{...await addCapabilities(u,studyId,id,receipt._actual),batchReceipt:receipt.batchReceipt};
 }
 return{process,read,ready};
}
