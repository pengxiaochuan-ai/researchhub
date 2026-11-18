import {randomUUID} from 'node:crypto';
import {cursorCodec,cursorBinding,pageLimit} from '../research-capture/capture-cursor.mjs';
import {invalid,only,researchError,requestHash,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {validateT15Plan} from './t15-analysis-core.mjs';
const fail=code=>{throw researchError(409,code,'分析计划、来源或放行条件已变化，请重新核对。');};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const reason=x=>{if(typeof x!=='string'||!x.trim()||x.length>5000)invalid();return x.trim();};
const uid=kind=>'t15-'+kind+'-'+randomUUID();
const quality=fn=>{try{return fn();}catch(error){if(typeof error?.code==='string'&&error.code.startsWith('QUALITY_'))fail(error.code);throw error;}};
/** The Study wrapper owns transaction and current scope. All records and receipts commit atomically. */
export function createT15AnalysisService({studies,core,receipts=repository,cursorSecret}){
 const cursors=cursorCodec(cursorSecret);
 const capabilities=current=>{const allowed=current?.role==='tenant_admin'&&current?.isTenantAdmin===true;return {canSubmitPlan:allowed,canReviewPlan:allowed,canReleaseSnapshot:allowed};};
 const page=(user,studyId,kind,filter,query)=>{only(query,['limit','cursor']);const binding=cursorBinding(user,studyId,kind,filter);return {limit:pageLimit(query.limit),binding,after:query.cursor===undefined?'':cursors.decode(query.cursor,binding,id)};};
 const run=(user,studyId,fn)=>studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{const s={tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId};await repository.setContext(tx,user,s.studyGroupId,s.researchProjectId);return fn(tx,s);});
 async function plan(tx,s,studyId,planId){
  if(!id(planId))invalid();const rows=await tx.$queryRaw`SELECT * FROM rh_analysis.plan WHERE id=${planId} AND tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId}`;
  if(!rows.length)throw researchError(404,'ANALYSIS_PLAN_NOT_FOUND','未找到可访问的分析计划。');
  if(core.hash(rows[0].definition)!==rows[0].content_hash)fail('ANALYSIS_PLAN_CHANGED');return rows[0];
 }
 const lockPlan=(tx,s,planId)=>tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':t15-plan:'+planId},0))::text AS locked`;
 async function latest(tx,s,planId){return (await tx.$queryRaw`SELECT * FROM rh_analysis.plan_review WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND plan_id=${planId} ORDER BY sequence DESC LIMIT 1`)[0]??null;}
 async function approved(tx,s,studyId,planId){await lockPlan(tx,s,planId);const p=await plan(tx,s,studyId,planId),r=await latest(tx,s,planId);if(r?.decision!=='approved')fail('ANALYSIS_PLAN_NOT_APPROVED');return {p,r};}
 async function assertCurrent(tx,user,s,studyId,snapshotId,phase='dispatch'){
  await core.authorize(tx,user,s,studyId);if(!id(snapshotId)||!['snapshot','dispatch','publish','export'].includes(phase))invalid();
  const snap=(await tx.$queryRaw`SELECT * FROM rh_analysis.snapshot WHERE id=${snapshotId} AND tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId}`)[0];
  if(!snap)throw researchError(404,'ANALYSIS_SNAPSHOT_NOT_FOUND','未找到可访问的分析快照。');
  const {p,r}=await approved(tx,s,studyId,snap.plan_id);if(r.id!==snap.review_id)fail('ANALYSIS_BASIS_STALE');
  const current=await core.project(tx,user,s,studyId,p,r,phase);
  if(core.hash(snap.manifest)!==snap.manifest_hash||current.manifestHash!==snap.manifest_hash||snap.quality_gate?.id!==snap.quality_gate_id||snap.quality_gate?.version!==1)fail('ANALYSIS_BASIS_STALE');
  quality(()=>core.assertQualityReleased(snap.quality_gate,current.manifestHash));
  return {basis:{type:'study-analysis-snapshot',studyId,snapshotId:snap.id,manifestHash:snap.manifest_hash,qualityGateId:snap.quality_gate_id,qualityGateVersion:1,planId:p.id,planReviewId:r.id,purposeKey:p.definition.purposeKey,...Object.fromEntries(['protocolVersionId','sapVersion','variableMapVersion','executionPolicyVersionId','consentViewHash','blindingViewHash'].map(k=>[k,snap.manifest[k]]))},manifest:snap.manifest,qualityGate:snap.quality_gate};
 }
 async function replay(tx,user,s,studyId,key,saved,action,target){
  await core.authorize(tx,user,s,studyId,true);const value=saved?.result;
  if(!saved||saved.action!==action||saved.target_id!==target||value?.studyId!==studyId||value.receipt?.requestKey!==key||value.receipt?.action!==action||value.receipt?.targetId!==target)throw researchError(404,'ANALYSIS_RECEIPT_NOT_FOUND','暂未查到此请求回执，请保留核对记录。');
  if(action==='analysis.release')await assertCurrent(tx,user,s,studyId,value.snapshotId,'snapshot');else await plan(tx,s,studyId,value.planId);
  return value;
 }
 async function mutate(user,studyId,body,action,target,perform){
  validateMutation(body);return run(user,studyId,async(tx,s)=>{
   await core.authorize(tx,user,s,studyId,true);
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${s.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   const hash=requestHash({studyId,action,target,body}),saved=await receipts.getReceipt(tx,user,body.requestKey);
   if(saved){if(saved.request_hash!==hash)fail('RESEARCH_REQUEST_KEY_CONFLICT');return replay(tx,user,s,studyId,body.requestKey,saved,action,target);}
   const value=await perform(tx,s),auditId=uid('audit'),result={studyId,...value,receipt:{requestKey:body.requestKey,action,targetId:target}};
   await tx.auditLog.createMany({data:{id:auditId,...s,accountId:user.accountId,action:'researchhub.'+action,target,meta:{requestKey:body.requestKey,planId:value.planId,snapshotId:value.snapshotId??null,reason:body.reason??body.definition?.reason??null}}});
   await receipts.saveReceipt(tx,user,{id:uid('operation'),key:body.requestKey,hash,action,target,result,auditId});return result;
  });
 }
 return {
  list:(user,studyId,query={})=>run(user,studyId,async(tx,s)=>{
   const pagination=page(user,studyId,'analysis-plans',null,query),current=await core.authorize(tx,user,s,studyId);
   const items=await tx.$queryRaw`SELECT p.id AS "planId",p.definition,p.content_hash AS "contentHash",p.created_at AS "createdAt",r.id AS "reviewId",r.sequence AS "reviewSequence",r.decision FROM rh_analysis.plan p LEFT JOIN LATERAL(SELECT id,sequence,decision FROM rh_analysis.plan_review WHERE tenant_id=p.tenant_id AND plan_id=p.id ORDER BY sequence DESC LIMIT 1) r ON true WHERE p.tenant_id=${s.tenantId} AND p.study_group_id=${s.studyGroupId} AND p.research_project_id=${s.researchProjectId} AND p.study_id=${studyId} AND p.id>${pagination.after} ORDER BY p.id LIMIT ${pagination.limit+1}`;
   const selected=items.slice(0,pagination.limit);return {studyId,items:selected,capabilities:capabilities(current),nextCursor:items.length>pagination.limit?cursors.encode(pagination.binding,selected.at(-1).planId):null};
  }),
  readPlan:(user,studyId,planId,query={})=>run(user,studyId,async(tx,s)=>{
   const pagination=page(user,studyId,'analysis-plan-snapshots',planId,query),current=await core.authorize(tx,user,s,studyId),p=await plan(tx,s,studyId,planId),review=await latest(tx,s,planId);
   const snapshots=await tx.$queryRaw`SELECT id AS "snapshotId",manifest_hash AS "manifestHash",quality_gate_id AS "qualityGateId",created_at AS "createdAt" FROM rh_analysis.snapshot WHERE tenant_id=${s.tenantId} AND study_group_id=${s.studyGroupId} AND research_project_id=${s.researchProjectId} AND study_id=${studyId} AND plan_id=${planId} AND id>${pagination.after} ORDER BY id LIMIT ${pagination.limit+1}`;
   const selected=snapshots.slice(0,pagination.limit),nextSnapshotsCursor=snapshots.length>pagination.limit?cursors.encode(pagination.binding,selected.at(-1).snapshotId):null;
   return {studyId,planId:p.id,definition:p.definition,contentHash:p.content_hash,capabilities:capabilities(current),review:review?{reviewId:review.id,sequence:review.sequence,decision:review.decision,reason:review.reason}:null,snapshots:selected,nextSnapshotsCursor};
  }),
  submitPlan(user,studyId,body){only(body,['requestKey','definition']);const definition=validateT15Plan(body.definition);return mutate(user,studyId,body,'analysis.plan.submit',studyId,async(tx,s)=>{
   await core.validateSources(tx,user,s,studyId,definition);const planId=uid('plan'),hash=core.hash(definition);
   await tx.$executeRaw`INSERT INTO rh_analysis.plan(id,tenant_id,study_group_id,research_project_id,study_id,protocol_version_id,definition,content_hash,submitted_by) VALUES(${planId},${s.tenantId},${s.studyGroupId},${s.researchProjectId},${studyId},${definition.protocolVersionId},${JSON.stringify(definition)}::jsonb,${hash},${user.accountId})`;
   return {planId,contentHash:hash,definition};
  });},
  reviewPlan(user,studyId,planId,body){only(body,['requestKey','expectedSequence','decision','reason']);reason(body.reason);if(!id(planId)||!Number.isSafeInteger(body.expectedSequence)||body.expectedSequence<0||!['approved','revoked'].includes(body.decision))invalid();return mutate(user,studyId,body,'analysis.plan.review',planId,async(tx,s)=>{
   await lockPlan(tx,s,planId);const p=await plan(tx,s,studyId,planId),r=await latest(tx,s,planId);if((r?.sequence??0)!==body.expectedSequence)fail('ANALYSIS_REVIEW_CONFLICT');if(!r&&body.decision!=='approved')fail('ANALYSIS_PLAN_NOT_APPROVED');
   if(body.decision==='approved')await core.validateSources(tx,user,s,studyId,p.definition);
   const reviewId=uid('review'),sequence=(r?.sequence??0)+1;
   await tx.$executeRaw`INSERT INTO rh_analysis.plan_review(id,tenant_id,study_group_id,research_project_id,study_id,plan_id,sequence,decision,reason,reviewed_by) VALUES(${reviewId},${s.tenantId},${s.studyGroupId},${s.researchProjectId},${studyId},${planId},${sequence},${body.decision},${reason(body.reason)},${user.accountId})`;
   return {planId,reviewId,sequence,decision:body.decision};
  });},
  preview:(user,studyId,planId)=>run(user,studyId,async(tx,s)=>{await core.authorize(tx,user,s,studyId);const {p,r}=await approved(tx,s,studyId,planId);return {studyId,planId,...await core.project(tx,user,s,studyId,p,r)};}),
  release(user,studyId,planId,body){only(body,['requestKey','previewHash','reason']);reason(body.reason);if(!id(planId)||!hex(body.previewHash))invalid();return mutate(user,studyId,body,'analysis.release',planId,async(tx,s)=>{
   const {p,r}=await approved(tx,s,studyId,planId),current=await core.project(tx,user,s,studyId,p,r);if(current.manifestHash!==body.previewHash)fail('ANALYSIS_PREVIEW_CHANGED');
   const snapshotId=uid('snapshot'),gateId=uid('gate'),gate={...current.evaluation,...quality(()=>core.releaseGate({...current.evaluation,manifestHash:current.manifestHash},{role:'tenant_admin',waivers:[]})),id:gateId,version:1,reviewedBy:user.accountId,reason:reason(body.reason)};
   await tx.$executeRaw`INSERT INTO rh_analysis.snapshot(id,tenant_id,study_group_id,research_project_id,study_id,plan_id,review_id,manifest,manifest_hash,quality_gate_id,quality_gate,released_by) VALUES(${snapshotId},${s.tenantId},${s.studyGroupId},${s.researchProjectId},${studyId},${planId},${r.id},${JSON.stringify(current.manifest)}::jsonb,${current.manifestHash},${gateId},${JSON.stringify(gate)}::jsonb,${user.accountId})`;
   return {planId,snapshotId,manifestHash:current.manifestHash,qualityGateId:gateId,qualityGateVersion:1};
  });},
  readSnapshot:(user,studyId,snapshotId,phase='snapshot')=>run(user,studyId,(tx,s)=>assertCurrent(tx,user,s,studyId,snapshotId,phase)),
  receipt(user,studyId,key,{action,targetId}){validateMutation({requestKey:key});if(!['analysis.plan.submit','analysis.plan.review','analysis.release'].includes(action)||!id(targetId))invalid();return run(user,studyId,async(tx,s)=>{await core.authorize(tx,user,s,studyId,true);return replay(tx,user,s,studyId,key,await receipts.getReceipt(tx,user,key),action,targetId);});},
  assertCurrent,
 };
}
