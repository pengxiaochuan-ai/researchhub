import {requestHash} from '../research-studies/contract.mjs';

const policyKeys=['ethics','screening','researchConsent','dataUse','withdrawal','safety','site','blinding','captureReview'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const emptyRefs=x=>Array.isArray(x)&&x.length===0;

// Only decision metadata is ignored. Every other configured value remains significant.
export function equivalentPolicySections(a,b){
 const normalized=x=>{
  if(!object(x)||policyKeys.some(k=>!object(x[k])||!['configured','not_applicable'].includes(x[k].status)))return null;
  return Object.fromEntries(Object.entries(x).map(([key,value])=>{
   if(!object(value))return [key,value];
   const {decidedBy,decidedAt,...content}=value;
   return [key,content];
  }));
 };
 const left=normalized(a),right=normalized(b);
 return left!==null&&right!==null&&requestHash(left)===requestHash(right);
}

// Pure fail-closed evaluation; callers must obtain complete scoped evidence under
// the shared writer locks before using this result to authorize any mutation.
export function migrationBlockers({enrollment,targetProtocolId,sourcePolicy,targetPolicy,visits,tasks,evidence}){
 const issues=[];
 if(!enrollment||enrollment.status!=='enrolled'||!enrollment.enrolledAt||enrollment.withdrawnAt||!enrollment.protocolVersionId||!targetProtocolId||enrollment.protocolVersionId===targetProtocolId)issues.push('enrollment_ineligible');
 if(!equivalentPolicySections(sourcePolicy,targetPolicy))issues.push('policy_incompatible');
 if(!Array.isArray(visits)||!Array.isArray(tasks)||!Array.isArray(evidence)){issues.push('incomplete_snapshot');return issues;}
 if(visits.some(v=>!v.id||!['planned','due_soon','overdue'].includes(v.status)||v.protocolVersionId!==enrollment?.protocolVersionId||v.actualStartedAt||v.actualCompletedAt||v.performedBy||v.verifiedAt||v.verifiedBy||!emptyRefs(v.evidenceRefs)))issues.push('visit_ineligible');
 if(tasks.some(t=>!t.id||t.status!=='open'||t.reviewStatus!=='not_required'||t.reviewedAt||t.reviewedBy||!emptyRefs(t.evidenceRefs)))issues.push('task_ineligible');
 if(evidence.length)issues.push('existing_evidence');
 return issues;
}

import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {invalid,only,researchError,validateMutation} from '../research-studies/contract.mjs';
import * as repository from '../research-studies/repository.mjs';
import {presentProtocol} from './protocols.mjs';
import {authorizeReleaseContext} from './policy-drafts.mjs';
const fail=(status,code,message)=>{throw researchError(status,code,message);};
const scoped=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const serial=value=>JSON.parse(JSON.stringify(value));
const include={visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}};

async function fixedPolicy(tx,ctx,p,core){
 if(!p.approvedPolicyVersionId||!p.approvedPolicyHash)return null;
 const row=(await tx.$queryRaw`SELECT id,status,sections,"contentHash","createdBy","reviewedBy","reviewedAt" FROM public.study_execution_policy_version WHERE id=${p.approvedPolicyVersionId} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND "protocolVersionId"=${p.id}`)[0];
 if(!row||row.status!=='approved'||row.contentHash!==p.approvedPolicyHash||requestHash(row.sections)!==row.contentHash||!row.reviewedBy||!row.reviewedAt)return null;
 const policy={...row,reviewedAt:new Date(row.reviewedAt).toISOString()};
 if(typeof core.previewExecutionPolicy!=='function'||core.previewExecutionPolicy(policy).length)return null;
 return policy;
}

// Internal snapshot used by preview; mutation must reload it under common writer locks.
export async function collectMigrationSnapshot(tx,ctx,target,enrollmentIds,core){
 const s=scoped(ctx),targetPolicy=await fixedPolicy(tx,ctx,target,core),items=[];
 const rows=await tx.studyEnrollment.findMany({where:{...s,id:{in:enrollmentIds},acceptanceFixture:false},orderBy:{id:'asc'}});
 if(rows.length!==enrollmentIds.length)fail(404,'RESEARCH_NOT_FOUND','入组记录不存在或当前账号无权查看。');
 for(const enrollment of rows){
  const subject=await tx.subject.findFirst({where:{...s,id:enrollment.subjectId,acceptanceFixture:false,deletedAt:null},select:{id:true}});
  if(!subject)fail(404,'RESEARCH_NOT_FOUND','入组记录不存在或当前账号无权查看。');
  const source=await tx.studyProtocolVersion.findFirst({where:{...s,id:enrollment.protocolVersionId,acceptanceFixture:false},include});
  const sourcePolicy=source?await fixedPolicy(tx,ctx,source,core):null;
  const visits=await tx.subjectVisit.findMany({where:{...s,enrollmentId:enrollment.id},orderBy:{id:'asc'}});
  const ids=visits.map(v=>v.id);
  const related={OR:[{enrollmentId:enrollment.id},{subjectId:enrollment.subjectId},...(ids.length?[{subjectVisitId:{in:ids}}]:[])]};
  const [tasks,assignments,scales,files,photos,features,profiles,manifests,processingTasks,processingStatuses,queries,deviations,fulfillments,anchors,participationRows]=await Promise.all([
   tx.studyTask.findMany({where:{...s,...related},orderBy:{id:'asc'}}),
   tx.formAssignment.count({where:{...s,OR:[...related.OR,{participant:{subjectId:enrollment.subjectId}}]}}),
   tx.scaleResult.count({where:{tenantId:s.tenantId,subjectId:enrollment.subjectId}}),
   tx.modalityFile.count({where:{tenantId:s.tenantId,subjectId:enrollment.subjectId}}),
   tx.subjectPhoto.count({where:{tenantId:s.tenantId,subjectId:enrollment.subjectId}}),
   tx.feature.count({where:{tenantId:s.tenantId,subjectId:enrollment.subjectId}}),
   tx.subjectProfile.count({where:{tenantId:s.tenantId,subjectId:enrollment.subjectId}}),
   tx.manifest.count({where:{tenantId:s.tenantId,subjectId:enrollment.subjectId}}),
   tx.processingTask.count({where:{...s,subjectId:enrollment.subjectId}}),
   tx.processingStatus.count({where:{tenantId:s.tenantId,subjectId:enrollment.subjectId}}),
   tx.dataQuery.count({where:{...s,...related}}),tx.protocolDeviation.count({where:{...s,...related}}),
   tx.visitRequirementFulfillment.findMany({where:{...s,subjectVisitId:{in:ids}},orderBy:{id:'asc'}}),
   tx.studyEnrollmentAnchor.findMany({where:{...s,enrollmentId:enrollment.id},orderBy:{id:'asc'}}),
   tx.$queryRaw`SELECT count(*)::integer AS count FROM public.study_participation_event WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND ("subjectId"=${enrollment.subjectId} OR "enrollmentId"=${enrollment.id})`,
  ]);
  const taskIds=tasks.map(t=>t.id);
  const [notifications,taskDependencies,legacyDependents]=await Promise.all([
   tx.studyNotification.count({where:{...s,OR:[{subjectVisitId:{in:ids}},{studyTaskId:{in:taskIds}}]}}),
   tx.studyTaskDependency.count({where:{...s,OR:[{studyTaskId:{in:taskIds}},{dependsOnTaskId:{in:taskIds}}]}}),
   tx.studyTask.count({where:{...s,dependsOnTaskId:{in:taskIds}}}),
  ]);
  const counts={participationEvents:participationRows[0].count,assignments,scales,files,photos,features,profiles,manifests,processingTasks,processingStatuses,queries,deviations,notifications,taskDependencies,legacyDependents,fulfillments:fulfillments.filter(f=>f.status!=='missing'||f.satisfiedAt||f.satisfiedBy||f.verifiedAt||f.verifiedBy||f.note||f.source!=='system'||!emptyRefs(f.evidenceRefs)).length};
  counts.anchorEvidence=anchors.filter(a=>{
   if(emptyRefs(a.evidenceRefs))return false;
   const refs=a.evidenceRefs;return !(a.kind==='enrollment'&&a.eventKey===''&&Array.isArray(refs)&&refs.length===1&&object(refs[0])&&Object.keys(refs[0]).sort().join(',')==='id,type'&&refs[0].type==='study_enrollment'&&refs[0].id===enrollment.id);
  }).length;
  const evidence=Object.entries(counts).filter(([,n])=>n>0).map(([kind,count])=>({kind,count}));
  const blockers=migrationBlockers({enrollment,targetProtocolId:target.id,sourcePolicy:sourcePolicy?.sections,targetPolicy:targetPolicy?.sections,visits,tasks,evidence});
  if(!source||!['executing','superseded'].includes(source.status)||!sourcePolicy||!targetPolicy)blockers.push('approved_policy_unavailable');
  if(tasks.some(t=>t.requiresReview))blockers.push('task_review_required');
  if(anchors.some(a=>a.kind!=='enrollment'||a.eventKey!==''))blockers.push('unsupported_anchor');
  const enrollmentAnchors=anchors.filter(a=>a.kind==='enrollment'&&a.eventKey==='');
  if(enrollmentAnchors.length!==1||!enrollment.enrolledAt||new Date(enrollmentAnchors[0].occurredAt).getTime()!==new Date(enrollment.enrolledAt).getTime())blockers.push('enrollment_anchor_unavailable');
  if(visits.some(v=>v.subjectId!==enrollment.subjectId)||tasks.some(t=>t.enrollmentId&&t.enrollmentId!==enrollment.id||t.subjectId&&t.subjectId!==enrollment.subjectId||t.subjectVisitId&&!ids.includes(t.subjectVisitId)))blockers.push('parent_chain_mismatch');
  const factFingerprint=requestHash(serial({enrollment,sourceProtocol:source?presentProtocol(source):null,sourcePolicy:sourcePolicy?{id:sourcePolicy.id,contentHash:sourcePolicy.contentHash}:null,visits,tasks,counts,fulfillments,anchors}));
  items.push({enrollmentId:enrollment.id,sourceProtocolId:source?.id??null,sourcePolicy:sourcePolicy?{id:sourcePolicy.id,contentHash:sourcePolicy.contentHash}:null,visitIds:visits.map(v=>v.id),tasksToCancel:tasks.filter(t=>t.status==='open').map(t=>({id:t.id,name:t.name,status:t.status})),evidenceCounts:counts,blockingReasons:[...new Set(blockers)],factFingerprint});
 }
 return serial({targetProtocol:presentProtocol(target),targetPolicy:targetPolicy?{id:targetPolicy.id,contentHash:targetPolicy.contentHash}:null,items});
}

// Caller owns the current authorized transaction. This only locks and verifies.
export async function prepareMigrationInTransaction(tx,user,ctx,studyId,protocolId,body,core){
 const bad=()=>fail(409,'PROTOCOL_MIGRATION_PREVIEW_INVALID','转版预览无效或已过期，请重新预览。');
 const saved=await repository.getReceipt(tx,user,body.previewRequestKey),preview=saved?.result;
 if(!saved||saved.action!=='protocol.migration.preview'||saved.target_id!==protocolId||preview?.studyId!==studyId||preview.protocolId!==protocolId||!preview.canMigrate||!Number.isFinite(Date.parse(preview.expiresAt))||Date.parse(preview.expiresAt)<=Date.now()||typeof preview.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(preview.tokenHash)||typeof body.previewToken!=='string')return bad();
 const digest=createHash('sha256').update(body.previewToken).digest();
 if(!timingSafeEqual(digest,Buffer.from(preview.tokenHash,'hex')))return bad();
 await tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${ctx.executionProjectId} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM public.study_protocol_version WHERE id=${protocolId} AND "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} FOR UPDATE`;
 const s=scoped(ctx),target=await tx.studyProtocolVersion.findFirst({where:{...s,id:protocolId,acceptanceFixture:false},include});
 if(!target||!['approved','executing'].includes(target.status)||presentProtocol(target).revision!==body.expectedRevision)return bad();
 const enrollmentIds=preview.snapshot?.items?.map(item=>item.enrollmentId);
 if(!Array.isArray(enrollmentIds)||!enrollmentIds.length||enrollmentIds.length>100||new Set(enrollmentIds).size!==enrollmentIds.length)return bad();
 const enrollments=await tx.studyEnrollment.findMany({where:{...s,id:{in:enrollmentIds},acceptanceFixture:false},select:{id:true,subjectId:true}});
 if(enrollments.length!==enrollmentIds.length)return bad();
 const subjectIds=[...new Set(enrollments.map(e=>e.subjectId))].sort(),sortedEnrollments=[...enrollmentIds].sort();
 await tx.$queryRaw`SELECT id FROM public.subject WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND id=ANY(${subjectIds}::text[]) ORDER BY id FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM public.study_enrollment WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND id=ANY(${sortedEnrollments}::text[]) ORDER BY id FOR UPDATE`;
 const visits=await tx.subjectVisit.findMany({where:{...s,enrollmentId:{in:sortedEnrollments}},select:{id:true},orderBy:{id:'asc'}}),visitIds=visits.map(v=>v.id);
 await tx.$queryRaw`SELECT id FROM public.subject_visit WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND id=ANY(${visitIds}::text[]) ORDER BY id FOR UPDATE`;
 const tasks=await tx.studyTask.findMany({where:{...s,OR:[{enrollmentId:{in:sortedEnrollments}},{subjectId:{in:subjectIds}},{subjectVisitId:{in:visitIds}}]},select:{id:true},orderBy:{id:'asc'}}),taskIds=tasks.map(t=>t.id);
 await tx.$queryRaw`SELECT id FROM public.study_task WHERE "tenantId"=${ctx.tenantId} AND "studyGroupId"=${ctx.studyGroupId} AND "researchProjectId"=${ctx.executionProjectId} AND id=ANY(${taskIds}::text[]) ORDER BY id FOR UPDATE`;
 const currentEnrollments=await tx.studyEnrollment.findMany({where:{...s,id:{in:sortedEnrollments},acceptanceFixture:false},select:{id:true,subjectId:true}});
 if(currentEnrollments.length!==enrollments.length||currentEnrollments.some(e=>!enrollments.some(old=>old.id===e.id&&old.subjectId===e.subjectId)))return bad();
 if(Date.parse(preview.expiresAt)<=Date.now())return bad();
 const snapshot=await collectMigrationSnapshot(tx,ctx,target,sortedEnrollments,core);
 if(requestHash(snapshot)!==preview.fingerprint||snapshot.items.some(item=>item.blockingReasons.length))fail(409,'PROTOCOL_MIGRATION_PREVIEW_CHANGED','影响范围已变化，请重新预览。');
 return {target,snapshot};
}

// Caller must use the current authorized Study transaction.
export async function executeMigrationInTransaction(tx,user,ctx,studyId,protocolId,body,core){
 if(!await authorizeReleaseContext(tx,user,ctx))fail(403,'RESEARCH_FORBIDDEN','当前账号无权管理方案审批。');
 only(body,['requestKey','expectedRevision','migrateExisting','previewRequestKey','previewToken','reason']);validateMutation(body);
 if(body.migrateExisting!==true||typeof body.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedRevision)||typeof body.previewRequestKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(body.previewRequestKey)||typeof body.previewToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.previewToken)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>5000)invalid();
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
 const action='protocol.migration.execute',saved=await repository.getReceipt(tx,user,body.requestKey);
 if(saved){if(saved.action!==action||saved.target_id!==protocolId||saved.request_hash!==requestHash(body)||saved.result.studyId!==studyId)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容，请重新操作。');return saved.result;}
 const {target,snapshot}=await prepareMigrationInTransaction(tx,user,ctx,studyId,protocolId,body,core);
 const actor={...user,tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId};
 if(target.status==='approved')await core.activateProtocolInTransaction(actor,protocolId,tx,ctx.studyGroupId,ctx.executionProjectId);
 else {
  const release=await core.protocolReleaseStatusInTransaction(tx,ctx.studyGroupId,ctx.executionProjectId,protocolId);
  const fixed=await core.fixedReferenceStatusInTransaction(tx,ctx.tenantId,ctx.studyGroupId,ctx.executionProjectId,protocolId);
  if(release?.gate?.ready!==true||fixed?.ready!==true)fail(409,'PROTOCOL_RELEASE_CHECK_BLOCKED','方案发布检查或固定引用已变化，请重新核对。');
 }
 const migrations=[];
 for(const item of snapshot.items){
  const scope=scoped(ctx),taskIds=item.tasksToCancel.map(t=>t.id),visitIds=item.visitIds;
  const taskResult=await tx.studyTask.updateMany({where:{...scope,id:{in:taskIds},status:'open'},data:{status:'cancelled',version:{increment:1}}});
  if(taskResult.count!==taskIds.length)fail(409,'PROTOCOL_MIGRATION_PREVIEW_CHANGED','任务已变化，请重新预览。');
  const visitResult=await tx.subjectVisit.updateMany({where:{...scope,id:{in:visitIds},enrollmentId:item.enrollmentId,protocolVersionId:item.sourceProtocolId,status:{in:['planned','due_soon','overdue']}},data:{status:'cancelled',version:{increment:1}}});
  if(visitResult.count!==visitIds.length)fail(409,'PROTOCOL_MIGRATION_PREVIEW_CHANGED','访视已变化，请重新预览。');
  const enrollment=await tx.studyEnrollment.updateMany({where:{...scope,id:item.enrollmentId,protocolVersionId:item.sourceProtocolId,status:'enrolled',withdrawnAt:null},data:{protocolVersionId:protocolId}});
  if(enrollment.count!==1)fail(409,'PROTOCOL_MIGRATION_PREVIEW_CHANGED','入组已变化，请重新预览。');
  const newVisitIds=await core.generateVisitsForEnrollmentInTransaction(tx,actor,ctx.studyGroupId,ctx.executionProjectId,item.enrollmentId,protocolId);
  migrations.push({enrollmentId:item.enrollmentId,sourceProtocolId:item.sourceProtocolId,oldVisitIds:visitIds,cancelledTaskIds:taskIds,newVisitIds});
 }
 const auditId='rh-audit-'+randomUUID(),id='rh-op-'+randomUUID();
 const result={studyId,protocolId,migrations,receipt:{id,requestKey:body.requestKey,action,targetId:protocolId}};
 await tx.auditLog.createMany({data:{id:auditId,...scoped(ctx),accountId:user.accountId,action:'researchhub.'+action,target:protocolId,meta:{requestKey:body.requestKey,previewRequestKey:body.previewRequestKey,reason:body.reason.trim(),targetPolicy:snapshot.targetPolicy,sourcePolicies:snapshot.items.map(item=>({enrollmentId:item.enrollmentId,policy:item.sourcePolicy})),migrations}}});
 await repository.saveReceipt(tx,user,{id,key:body.requestKey,hash:requestHash(body),action,target:protocolId,result,auditId});
 return result;
}

export function createProtocolMigrationService({studies,core}){
 return {receipt:(user,studyId,protocolId,requestKey)=>{
  validateMutation({requestKey});
  return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
   if(!await authorizeReleaseContext(tx,user,ctx))fail(403,'RESEARCH_FORBIDDEN','当前账号无权管理方案审批。');
   const saved=await repository.getReceipt(tx,user,requestKey);
   if(!saved||saved.action!=='protocol.migration.execute'||saved.target_id!==protocolId||saved.result?.studyId!==studyId||saved.result?.protocolId!==protocolId)fail(404,'RESEARCH_NOT_FOUND','未查到对应转版回执，请稍后再次核对。');
   return saved.result;
  });
 },execute:(user,studyId,protocolId,body)=>{
  return studies.withResearchStudyTransaction(user,studyId,'read',(tx,ctx)=>executeMigrationInTransaction(tx,user,ctx,studyId,protocolId,body,core));
 },preview:(user,studyId,protocolId,body)=>{
  only(body,['requestKey','expectedRevision','enrollmentIds']);validateMutation(body);
  if(typeof body.expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedRevision)||!Array.isArray(body.enrollmentIds)||body.enrollmentIds.length<1||body.enrollmentIds.length>100||body.enrollmentIds.some(id=>typeof id!=='string'||!id||id.length>160)||new Set(body.enrollmentIds).size!==body.enrollmentIds.length)invalid();
  return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
   if(!await authorizeReleaseContext(tx,user,ctx))fail(403,'RESEARCH_FORBIDDEN','当前账号无权管理方案审批。');
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId+':'+user.accountId+':'+body.requestKey},0))::text AS locked`;
   const target=await tx.studyProtocolVersion.findFirst({where:{...scoped(ctx),id:protocolId,acceptanceFixture:false},include});
   if(!target)fail(404,'RESEARCH_NOT_FOUND','研究方案不存在或当前账号无权查看。');
   const saved=await repository.getReceipt(tx,user,body.requestKey),action='protocol.migration.preview';
   if(saved){
    if(saved.action!==action||saved.target_id!==protocolId||saved.request_hash!==requestHash(body)||saved.result.studyId!==studyId)fail(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容，请重新操作。');
    if(!Number.isFinite(Date.parse(saved.result.expiresAt))||Date.parse(saved.result.expiresAt)<=Date.now())fail(409,'PROTOCOL_MIGRATION_PREVIEW_EXPIRED','转版预览已过期，请重新预览。');
    return saved.result;
   }
   if(!['approved','executing'].includes(target.status))fail(409,'PROTOCOL_NOT_APPROVED','只有已批准或执行中的方案可以预览转版。');
   if(presentProtocol(target).revision!==body.expectedRevision)fail(409,'RESEARCH_VERSION_CONFLICT','方案已改变，请刷新核对。');
   const snapshot=await collectMigrationSnapshot(tx,ctx,target,body.enrollmentIds,core),token=randomBytes(32).toString('base64url'),auditId='rh-audit-'+randomUUID(),id='rh-op-'+randomUUID();
   const result={studyId,protocolId,previewRequestKey:body.requestKey,token,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+15*60*1000).toISOString(),fingerprint:requestHash(snapshot),snapshot,canMigrate:snapshot.items.every(item=>!item.blockingReasons.length),executionAvailable:true,receipt:{id,requestKey:body.requestKey,action,targetId:protocolId}};
   await tx.auditLog.createMany({data:{id:auditId,...scoped(ctx),accountId:user.accountId,action:'researchhub.'+action,target:protocolId,meta:{requestKey:body.requestKey,enrollmentCount:body.enrollmentIds.length}}});
   await repository.saveReceipt(tx,user,{id,key:body.requestKey,hash:requestHash(body),action,target:protocolId,result,auditId});
   return result;
  });
 }};
}
