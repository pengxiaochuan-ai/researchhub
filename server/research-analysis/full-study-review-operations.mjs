import {randomUUID} from 'node:crypto';
import {only,invalid,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repo from '../research-studies/repository.mjs';
import {fullStudyHash,fail} from './full-study-projection.mjs';
import {batchTargets,batchReceipt,BATCH_VERSION} from './full-study-batch-receipt.mjs';

const KIND='full-study-review-v1',OP='researchhub.full.analysis.review.operation',CLAIM='researchhub.full.analysis.review.claim',FINISHED='researchhub.full.analysis.review.finished';
const START='full.analysis.review.start',ADVANCE='full.analysis.review.advance';
const uid=kind=>'full-review-'+kind+'-'+randomUUID();
const keyFor=(parent,runId)=>'full-review-'+fullStudyHash({requestKey:parent,runId});
const auditFor=(u,key)=>'descriptive-review-'+fullStudyHash({tenantId:u.tenantId,accountId:u.accountId,requestKey:key});
const sameScope=(a,b)=>['tenantId','studyGroupId','researchProjectId'].every(k=>a?.[k]===b[k]);
const missing=()=>{throw researchError(404,'FULL_STUDY_REVIEW_OPERATION_NOT_FOUND','未找到原审核请求，请保留原核对记录。');};
const actorChanged=()=>{throw researchError(403,'FULL_STUDY_REVIEW_ACTOR_CHANGED','请使用发起审核时的账号重新核对。');};

/** Each transaction owns fresh source/authority checks. No request or source proof cache survives it. */
export function createFullStudyReviewOperations({transaction,group,rows,methods,authorizeReviewInTransaction,now=Date.now,leaseMs=60000}){
 if(!Number.isSafeInteger(leaseMs)||leaseMs<1||leaseMs>600000)throw Error('FULL_STUDY_REVIEW_LEASE_INVALID');
 const mutex=(tx,s,key)=>tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':full-review:'+key},0))::text`;
 const receipt=(key,id)=>({requestKey:key,action:START,targetId:id});
 async function context(tx,u,s,actor,studyId,id){
  const g=await group(tx,u,s,studyId,id),currentRows=await rows(tx,s,g);
  if(g.cancelled)fail('FULL_STUDY_RUN_BLOCKED');
  if(typeof authorizeReviewInTransaction!=='function'||!currentRows.length)throw researchError(503,'FULL_STUDY_REVIEW_AUTHORITY_UNAVAILABLE','当前审核权限暂不可核对。');
  // Official -> tenant locks protect this transaction against native Methods
  // writers. Only complete, identical authorization identities may share a check;
  // every actual child write still repeats its own full native live check.
  const checked=new Set(),identityFields=['tenantId','studyGroupId','researchProjectId','skillKey','accountId','sessionId','agentId'];
  for(const row of currentRows){
   const binding=g.a.meta.slices.find(b=>b.methodKey===row.idempotencyKey);
   if(!binding||!bound(row,{runId:row.id,methodKey:binding.methodKey,snapshotId:binding.snapshotId},studyId,s))fail('FULL_STUDY_REVIEW_BINDING_CHANGED');
   const complete=identityFields.every(k=>typeof row[k]==='string'&&row[k].length>0)&&Number.isSafeInteger(row.skillVersion)&&row.skillVersion>0;
   const identity=complete?fullStudyHash({reviewer:{tenantId:u.tenantId,accountId:u.accountId,authVersion:u.authVersion},run:{...Object.fromEntries(identityFields.map(k=>[k,row[k]])),skillVersion:row.skillVersion}}):null;
   if(identity&&checked.has(identity))continue;
   await authorizeReviewInTransaction(tx,actor,row);if(identity)checked.add(identity);
  }
  return{g,currentRows};
 }
 function bound(row,target,studyId,s){return row&&sameScope(row,s)&&row.skillKey==='descriptive-statistics'&&row.id===target.runId&&row.idempotencyKey===target.methodKey&&row.inputSummary?.studyId===studyId&&row.inputSummary?.snapshotId===target.snapshotId;}
 function claimTargets(claim,parent){
  const c=claim.meta;
  if(c?.batchVersion===undefined){const t=parent.targets.find(t=>t.runId===c?.runId&&t.nativeKey===c?.nativeKey);if(!t)fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');return[t];}
  if(c.batchVersion!==BATCH_VERSION||c.limit!==3||Object.hasOwn(c,'runId')||Object.hasOwn(c,'nativeKey'))fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
  const targets=batchTargets('review',c.targets,c.targetsHash);
  if(targets.some(t=>!parent.targets.some(p=>fullStudyHash(p)===fullStudyHash(t))))fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
  return targets;
 }
 async function state(tx,u,s,actor,studyId,id,operationId,verifiedContext){
  const op=await tx.auditLog.findFirst({where:{...s,id:operationId,action:OP,target:id}});if(!op)missing();
  const m=op.meta;if(op.accountId!==u.accountId||m?.authVersion!==u.authVersion)actorChanged();
  if(m.kind!==KIND||m.studyId!==studyId||m.runGroupId!==id||!Array.isArray(m.targets)||m.commandHash!==requestHash({studyId,runGroupId:id,body:{requestKey:m.requestKey,conclusion:m.conclusion,comment:m.comment}}))fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
  const {g,currentRows}=verifiedContext??await context(tx,u,s,actor,studyId,id);
  if(g.a.meta.snapshotId!==m.snapshotId||g.current.basis.manifestHash!==m.manifestHash)fail('ANALYSIS_BASIS_STALE');
  if(m.targetsHash!==fullStudyHash(m.targets)||new Set(m.targets.map(t=>t.runId)).size!==m.targets.length||m.targets.some(t=>t.nativeKey!==keyFor(m.requestKey,t.runId)||t.commandHash!==fullStudyHash({runId:t.runId,conclusion:m.conclusion,comment:m.comment})||!g.a.meta.slices.some(b=>b.methodKey===t.methodKey&&b.snapshotId===t.snapshotId)))fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
  const auditIds=m.targets.map(t=>auditFor(u,t.nativeKey));
  const nativeAudits=auditIds.length?await tx.auditLog.findMany({where:{...s,id:{in:auditIds},accountId:u.accountId,action:'research_method_run_review'}}):[];
  const reviewIds=nativeAudits.map(a=>a.meta?.reviewId).filter(x=>typeof x==='string');
  const reviews=reviewIds.length?await tx.researchMethodReview.findMany({where:{...s,id:{in:reviewIds}}}):[];
  const proven=new Set();let errorCode;
  for(const t of m.targets){
   const row=currentRows.find(r=>r.id===t.runId),a=nativeAudits.find(a=>a.id===auditFor(u,t.nativeKey)),review=reviews.find(r=>r.id===a?.meta?.reviewId);
   if(!bound(row,t,studyId,s)){errorCode='FULL_STUDY_REVIEW_BINDING_CHANGED';continue;}
   if(a){
    const meta=a.meta,valid=sameScope(a,s)&&a.accountId===u.accountId&&a.target===t.runId&&meta?.requestKey===t.nativeKey&&meta.commandHash===t.commandHash&&meta.conclusion===m.conclusion&&Number.isSafeInteger(meta.reviewVersion)&&meta.reviewVersion>0&&review&&sameScope(review,s)&&review.runId===t.runId&&review.version===meta.reviewVersion&&review.reviewerAccountId===u.accountId&&['tenant_admin','pi','methodologist'].includes(review.reviewRole)&&review.conclusion===m.conclusion&&review.comment===m.comment;
    if(valid&&row.reviewStatus===m.conclusion&&row.status===(m.conclusion==='confirmed'?'completed':'needs_input'))proven.add(t.runId);else errorCode='FULL_STUDY_REVIEW_PROOF_INVALID';
   }else if(row.status!=='needs_review')errorCode='FULL_STUDY_REVIEW_NOT_PROVEN';
  }
  const events=await tx.auditLog.findMany({where:{...s,target:operationId,accountId:u.accountId,action:{in:[CLAIM,FINISHED]}}});
  const claims=events.filter(e=>e.action===CLAIM).sort((a,b)=>a.meta.sequence-b.meta.sequence),finishes=events.filter(e=>e.action===FINISHED);
  // The independent operation receipt anchors every persisted claim before it
  // can drive recovery or be shown as proof; self-consistent claim edits do not.
  const claimReceipts=claims.length?await tx.$queryRaw`SELECT * FROM rh_research.operation WHERE tenant_id=${u.tenantId} AND actor_id=${u.accountId} AND action=${ADVANCE} AND target_id=${operationId}`:[];
  const targetsByClaim=new Map();for(const c of claims){
   if(c.meta?.authVersion!==u.authVersion||!Number.isFinite(c.meta.leaseUntil)||!Number.isSafeInteger(c.meta.sequence))fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
   const receipts=claimReceipts.filter(r=>r.request_key===c.meta.requestKey),saved=receipts[0];
   if(receipts.length!==1||saved.tenant_id!==u.tenantId||saved.actor_id!==u.accountId||saved.action!==ADVANCE||saved.target_id!==operationId||saved.result?.studyId!==studyId||saved.result?.runGroupId!==id||saved.result?.operationId!==operationId||saved.result?.claimId!==c.id||saved.audit_id!==c.id)fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
   if((c.meta.batchVersion!==undefined||c.meta.requestDigest!==undefined)&&(typeof c.meta.requestDigest!=='string'||!/^[a-f0-9]{64}$/.test(c.meta.requestDigest)||saved.request_hash!==c.meta.requestDigest))fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
   if(c.meta.batchVersion!==undefined){if(saved.result.batchVersion!==BATCH_VERSION||saved.result.targetsHash!==c.meta.targetsHash||saved.result.limit!==3)fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');}
   else if(['batchVersion','targetsHash','limit'].some(k=>Object.hasOwn(saved.result,k)))fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
   targetsByClaim.set(c.id,claimTargets(c,m));
  }
  const allProven=c=>targetsByClaim.get(c.id).every(t=>proven.has(t.runId));
  const unfinished=claims.filter(c=>!finishes.some(f=>f.meta.claimId===c.id));
  const unresolved=unfinished.filter(c=>!allProven(c));
  if(new Set(unresolved.map(c=>fullStudyHash(targetsByClaim.get(c.id)))).size>1)fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
  const active=unresolved.find(c=>c.meta.leaseUntil>now());
  const failed=finishes.find(f=>{const c=claims.find(c=>c.id===f.meta.claimId);return f.meta.status==='failed'&&c&&!allProven(c);});
  if(failed)errorCode=failed.meta.errorCode??'FULL_STUDY_REVIEW_FAILED';
  const completed=proven.size,all=completed===m.targets.length;
  const status=errorCode?'blocked':all?'completed':active?'processing':'ready';
  const stateHash=fullStudyHash({operationId,manifestHash:m.manifestHash,targets:m.targets.map(t=>({runId:t.runId,proven:proven.has(t.runId),status:currentRows.find(r=>r.id===t.runId)?.status,reviewStatus:currentRows.find(r=>r.id===t.runId)?.reviewStatus})),events:events.map(e=>({id:e.id,action:e.action,meta:e.meta})).sort((a,b)=>a.id.localeCompare(b.id)),errorCode:errorCode??null});
  const stepProof=claim=>({requestKey:claim.meta.requestKey,status:proven.has(claim.meta.runId)?'completed':finishes.some(f=>f.meta.claimId===claim.id&&f.meta.status==='failed')?'failed':'processing',executionConfirmed:proven.has(claim.meta.runId),runId:claim.meta.runId});
  const batchProof=claim=>batchReceipt('review',{requestKey:claim.meta.requestKey,studyId,runGroupId:id,operationId,snapshotId:m.snapshotId,manifestHash:m.manifestHash},targetsByClaim.get(claim.id),targetsByClaim.get(claim.id).map(t=>({...t,status:proven.has(t.runId)?'completed':finishes.some(f=>f.meta.claimId===claim.id&&f.meta.status==='failed')?'failed':'processing',executionConfirmed:proven.has(t.runId)})));
  const latest=claims.at(-1);
  const value={studyId,runGroupId:id,operationId,requestKey:m.requestKey,kind:KIND,snapshotId:m.snapshotId,manifestHash:m.manifestHash,status,progress:{total:m.targets.length,completed,remaining:m.targets.length-completed},stateHash,canContinue:status==='ready',receipt:receipt(m.requestKey,id),...(active?{retryAfterMs:Math.max(1,active.meta.leaseUntil-now())}:{}),...(errorCode?{errorCode}:{}),...(typeof methods.reviewBatch==='function'?{batching:{version:BATCH_VERSION,maxItems:3}}:{}),...(latest?latest.meta.batchVersion?{lastBatch:batchProof(latest)}:{lastStep:stepProof(latest)}:{})};
  return{op,m,g,currentRows,claims,finishes,unfinished,unresolved,proven,value,stepProof,batchProof,targetsByClaim,allProven};
 }
 async function saveEvent(tx,u,s,action,target,meta){const id=uid('event');await tx.auditLog.createMany({data:{id,...s,accountId:u.accountId,action,target,meta}});return id;}
 async function exactStep(tx,u,s,actor,studyId,id,operationId,key,verifiedContext){
  const saved=await repo.getReceipt(tx,u,key);if(!saved||saved.action!==ADVANCE||saved.target_id!==operationId||saved.result?.studyId!==studyId||saved.result?.runGroupId!==id||saved.result?.operationId!==operationId)missing();
  const current=await state(tx,u,s,actor,studyId,id,operationId,verifiedContext),claim=current.claims.find(c=>c.id===saved.result.claimId&&c.meta.requestKey===key);if(!claim||typeof claim.meta.requestDigest!=='string'||!/^[a-f0-9]{64}$/.test(claim.meta.requestDigest)||saved.request_hash!==claim.meta.requestDigest||saved.audit_id!==claim.id)fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');
  if(claim.meta.batchVersion){if(saved.result.batchVersion!==BATCH_VERSION||saved.result.targetsHash!==claim.meta.targetsHash||saved.result.limit!==3)fail('FULL_STUDY_REVIEW_OPERATION_CHANGED');return{...current.value,batchReceipt:current.batchProof(claim)};}
  return{...current.value,stepReceipt:current.stepProof(claim)};
 }
 const api={
  startReviewOperation(u,studyId,id,body){
   only(body,['requestKey','conclusion','comment']);validateMutation(body);
   if(!['confirmed','returned','needs_input'].includes(body.conclusion)||typeof body.comment!=='string'||!body.comment.trim()||body.comment.length>5000)invalid();
   const normalized={...body,comment:body.comment.trim()},digest=requestHash({studyId,runGroupId:id,body:normalized});
   return transaction(u,studyId,async(tx,s,actor)=>{
    await mutex(tx,s,u.accountId+':'+body.requestKey);const old=await repo.getReceipt(tx,u,body.requestKey);
    if(old){if(old.action!==START||old.target_id!==id||old.request_hash!==digest)fail('RESEARCH_REQUEST_KEY_CONFLICT');return(await state(tx,u,s,actor,studyId,id,old.result.operationId)).value;}
    const {g,currentRows}=await context(tx,u,s,actor,studyId,id);
    if(currentRows.length!==g.a.meta.slices.length||currentRows.some(r=>r.status!=='needs_review'&&!(body.conclusion==='confirmed'&&r.status==='completed'&&r.reviewStatus==='confirmed')))fail('FULL_STUDY_RUN_INCOMPLETE');
    const bindings=g.a.meta.slices.map(b=>{const r=currentRows.find(r=>r.idempotencyKey===b.methodKey);if(!r)fail('FULL_STUDY_RUN_INCOMPLETE');return{runId:r.id,methodKey:b.methodKey,snapshotId:b.snapshotId,nativeKey:keyFor(body.requestKey,r.id),commandHash:fullStudyHash({runId:r.id,conclusion:normalized.conclusion,comment:normalized.comment})};});
    if(bindings.some(t=>!bound(currentRows.find(r=>r.id===t.runId),t,studyId,s)))fail('FULL_STUDY_REVIEW_BINDING_CHANGED');
    const targets=bindings.filter(t=>currentRows.find(r=>r.id===t.runId).status==='needs_review');
    const operationId=uid('operation'),meta={kind:KIND,studyId,runGroupId:id,requestKey:body.requestKey,authVersion:u.authVersion,snapshotId:g.a.meta.snapshotId,manifestHash:g.current.basis.manifestHash,conclusion:normalized.conclusion,comment:normalized.comment,commandHash:digest,targets,targetsHash:fullStudyHash(targets)};
    await tx.auditLog.createMany({data:{id:operationId,...s,accountId:u.accountId,action:OP,target:id,meta}});
    await repo.saveReceipt(tx,u,{id:uid('receipt'),key:body.requestKey,hash:digest,action:START,target:id,result:{studyId,runGroupId:id,operationId},auditId:operationId});
    return(await state(tx,u,s,actor,studyId,id,operationId,{g,currentRows})).value;
   });
  },
  readReviewOperation:(u,studyId,id,operationId)=>transaction(u,studyId,async(tx,s,actor)=>(await state(tx,u,s,actor,studyId,id,operationId)).value),
  reviewOperationReceipt(u,studyId,id,key){validateMutation({requestKey:key});return transaction(u,studyId,async(tx,s,actor)=>{const saved=await repo.getReceipt(tx,u,key);if(!saved||saved.action!==START||saved.target_id!==id||saved.result?.studyId!==studyId||saved.result?.runGroupId!==id)missing();return(await state(tx,u,s,actor,studyId,id,saved.result.operationId)).value;});},
  reviewStepReceipt(u,studyId,id,operationId,key){validateMutation({requestKey:key});return transaction(u,studyId,(tx,s,actor)=>exactStep(tx,u,s,actor,studyId,id,operationId,key));},
  async advanceReviewOperation(u,studyId,id,operationId,body){
   only(body,['requestKey','expectedStateHash','limit']);validateMutation(body);if(![1,3].includes(body.limit)||typeof body.expectedStateHash!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedStateHash))invalid();
   const digest=requestHash({studyId,runGroupId:id,operationId,body});
   const accepted=await transaction(u,studyId,async(tx,s,actor)=>{
    await mutex(tx,s,operationId);await mutex(tx,s,u.accountId+':'+body.requestKey);
    const old=await repo.getReceipt(tx,u,body.requestKey);
    if(old){if(old.action!==ADVANCE||old.target_id!==operationId||old.request_hash!==digest)fail('RESEARCH_REQUEST_KEY_CONFLICT');return{replay:await exactStep(tx,u,s,actor,studyId,id,operationId,body.requestKey)};}
    const current=await state(tx,u,s,actor,studyId,id,operationId);
    if(current.value.stateHash!==body.expectedStateHash)fail('FULL_STUDY_REVIEW_STATE_CHANGED');
    if(current.value.status==='processing')fail('FULL_STUDY_REVIEW_PROCESSING');
    if(!current.value.canContinue)fail('FULL_STUDY_REVIEW_NOT_CONTINUABLE');
    // Only explicit POST repairs missing acknowledgements or releases an expired
    // claim. An expired unproved claim keeps the same child and native request key.
    const targets=current.unresolved.length?current.targetsByClaim.get(current.unresolved[0].id):current.m.targets.filter(t=>!current.proven.has(t.runId)).slice(0,body.limit);if(!targets.length)fail('FULL_STUDY_REVIEW_NOT_CONTINUABLE');
    if(body.limit===1&&targets.length>1)fail('FULL_STUDY_BATCH_REQUIRED');
    if(body.limit===3&&typeof methods.reviewBatch!=='function')throw researchError(503,'FULL_STUDY_BATCH_UNAVAILABLE','当前批次审核暂不可用，请保留原核对记录。');
    for(const claim of current.unfinished)await saveEvent(tx,u,s,FINISHED,operationId,{claimId:claim.id,status:current.allProven(claim)?'returned':'expired',recovered:true});
    const batch=body.limit===3?{batchVersion:BATCH_VERSION,limit:3,targets:batchTargets('review',targets),targetsHash:fullStudyHash(targets)}:null,target=targets[0];
    const claimId=await saveEvent(tx,u,s,CLAIM,operationId,{requestKey:body.requestKey,requestDigest:digest,authVersion:u.authVersion,...(batch??{runId:target.runId,nativeKey:target.nativeKey}),leaseUntil:now()+leaseMs,sequence:current.claims.length+1});
    await repo.saveReceipt(tx,u,{id:uid('receipt'),key:body.requestKey,hash:digest,action:ADVANCE,target:operationId,result:{studyId,runGroupId:id,operationId,claimId,...(batch?{batchVersion:BATCH_VERSION,limit:3,targetsHash:batch.targetsHash}:{})},auditId:claimId});
    return{actor,claimId,target,targets,batch,rows:targets.map(t=>current.currentRows.find(r=>r.id===t.runId)),command:{requestKey:batch?current.m.requestKey:target.nativeKey,conclusion:current.m.conclusion,comment:current.m.comment},context:{studyId,rootSnapshotId:current.m.snapshotId}};
   });
   if(accepted.replay)return accepted.replay;
   let failure;try{if(accepted.batch)await methods.reviewBatch(accepted.actor,accepted.rows,accepted.command,accepted.context);else await methods.review(accepted.actor,accepted.target.runId,accepted.command);}catch(error){failure=error;}
   return transaction(u,studyId,async(tx,s,actor)=>{
    await mutex(tx,s,operationId);const current=await state(tx,u,s,actor,studyId,id,operationId),proved=accepted.targets.every(t=>current.proven.has(t.runId));
    if(!current.finishes.some(f=>f.meta.claimId===accepted.claimId))await saveEvent(tx,u,s,FINISHED,operationId,{claimId:accepted.claimId,status:proved?'returned':'failed',...(!proved?{errorCode:failure?.getResponse?.()?.code??failure?.code??'FULL_STUDY_REVIEW_NOT_PROVEN'}:{})});
    const result=await exactStep(tx,u,s,actor,studyId,id,operationId,body.requestKey,{g:current.g,currentRows:current.currentRows});
    return{result,failure:proved?null:failure};
   }).then(({result,failure})=>{if(failure)throw failure;return result;});
  },
 };
 return api;
}
