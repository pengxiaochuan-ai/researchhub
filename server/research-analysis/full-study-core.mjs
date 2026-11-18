import {researchError} from '../research-studies/contract.mjs';
import {presentProtocol} from '../research-execution/protocols.mjs';
import {memoizeFullStudyAuthorizationReads} from './full-study-authorization-reads.mjs';
import {memoizeFullStudyIdLocks} from './full-study-id-locks.mjs';
import {memoizeFullStudyFixedPolicyReads} from './full-study-fixed-policy-reads.mjs';
import {withFullStudyVisitReads} from './full-study-visit-reads.mjs';
import {withFullStudyLockedMetadataReads} from './full-study-locked-metadata-reads.mjs';
import {FULL_SCHEMA,validateFullStudyCase,fullStudyHash,buildFullStudySlices,scoreCell,fail} from './full-study-projection.mjs';
export function createFullStudyCore({load,resolveCase,readResponsePair}){
 if(typeof load!=='function'||typeof resolveCase!=='function')throw Error('FULL_STUDY_DEPENDENCIES_REQUIRED');
 if(readResponsePair!==undefined&&typeof readResponsePair!=='function')throw Error('FULL_STUDY_PAIR_READER_REQUIRED');
 const get=(file,name)=>load('study-operations/'+file,name),authorizeNative=get('formal-response-authority','authorizeFormalResponse'),lockScope=get('protocol-migration-lock','lockCaptureScope'),lockBinding=get('protocol-migration-lock','lockCaptureBinding'),capture=get('participation-capture','assertParticipationCapture'),read=get('formal-response-query','readFormalResponseInTransaction'),revision=get('formal-response-history','readFormalResponseRevisionInTransaction'),readVisit=get('formal-response-visits','readFormalVisitInTransaction');
 const gate=file=>load('research-methods/data-quality-release-policy',file);
 async function admission(tx,s,studyId){const c=validateFullStudyCase(await resolveCase(tx,s));if(c.studyId!==studyId||fullStudyHash(c.scope)!==fullStudyHash(s))fail('FULL_STUDY_SCOPE_INVALID');return c;}
 async function authorize(tx,user,s,studyId,admin=false,phase='snapshot'){await load('common/worker-publication','lockAuthorizationMutation')(tx,s.tenantId);await admission(tx,s,studyId);const current=await authorizeNative(tx,user,s.studyGroupId,s.researchProjectId,'read');if(current.role==='tenant_admin'&&current.isTenantAdmin===true)return current;if(admin)throw researchError(403,'FULL_STUDY_ADMIN_REQUIRED','模拟计划和快照由当前租户管理员审批。');const m=await tx.studyGroupMembership.findFirst({where:{...{tenantId:s.tenantId,studyGroupId:s.studyGroupId},accountId:user.accountId,status:'active',role:{tenantId:s.tenantId,status:'active'}},include:{role:true}}),reportRead=phase==='export';if(!Array.isArray(m?.role?.buttonPermissions)||!m.role.buttonPermissions.includes(reportRead?'artifact.read':'data.analyze')||reportRead&&!m.role.menuPermissions?.includes('artifacts'))throw researchError(403,'FULL_STUDY_FORBIDDEN',reportRead?'当前账号无报告查看权限。':'当前账号无分析权限。');return current;}
 async function validateCase(tx,s,studyId,fixed){const c=await admission(tx,s,studyId);if(fixed&&fullStudyHash(c)!==fullStudyHash(fixed))fail('FULL_STUDY_CASE_CHANGED');await lockScope(tx,s,[c.protocolVersionId]);const p=await tx.studyProtocolVersion.findFirst({where:{...s,id:c.protocolVersionId,acceptanceFixture:false,status:{in:['approved','executing','superseded']}},include:{visitPlans:{include:{requirements:{orderBy:{id:'asc'}}},orderBy:{sequence:'asc'}}}});if(!p||presentProtocol(p).revision!==c.protocolHash)fail('FULL_STUDY_PROTOCOL_CHANGED');const policy=await tx.studyExecutionPolicyVersion.findFirst({where:{...s,id:c.policyId,protocolVersionId:c.protocolVersionId,status:'approved',contentHash:c.policyHash}});if(!p||!policy||!policy.reviewedBy||!policy.reviewedAt||fullStudyHash(policy.sections)!==policy.contentHash||p.approvedPolicyVersionId!==policy.id||p.approvedPolicyHash!==c.policyHash)fail('FULL_STUDY_POLICY_CHANGED');return c;}
 async function project(tx,user,s,studyId,plan,review){
  tx=memoizeFullStudyIdLocks(tx,s);await load('common/worker-publication','lockAuthorizationMutation')(tx,s.tenantId);tx=memoizeFullStudyAuthorizationReads(tx);
  if(plan.definition.schemaVersion!==FULL_SCHEMA||fullStudyHash(plan.definition)!==plan.content_hash||review?.decision!=='approved')fail('FULL_STUDY_PLAN_NOT_APPROVED');const c=await validateCase(tx,s,studyId,plan.definition.caseMetadata),observations=[];
  tx=memoizeFullStudyFixedPolicyReads(tx,s,c);
  return withFullStudyLockedMetadataReads(tx,s,c,async tx=>{
  const subjectIds=c.subjects.map(x=>x.id).sort(),subjects=await tx.$queryRaw`SELECT id FROM public.subject WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND id=ANY(${subjectIds}::text[]) AND "deletedAt" IS NULL AND "acceptanceFixture"=false ORDER BY id FOR UPDATE`;if(subjects.length!==6)fail('FULL_STUDY_SUBJECT_CHANGED');
  const forms=await tx.formVersion.findMany({where:{...s,id:{in:c.forms.map(f=>f.id)},status:{in:['published','locked']}}});if(forms.length!==c.forms.length)fail('FULL_STUDY_FORM_CHANGED');
  for(const f of c.forms){const actual=forms.find(x=>x.id===f.id);if(fullStudyHash(actual.schema)!==f.schemaHash||fullStudyHash(actual.scoring??null)!==f.scoringHash)fail('FULL_STUDY_FORM_CHANGED');}
  for(const subject of [...c.subjects].sort((a,b)=>a.id.localeCompare(b.id))){
   const enrollments=await tx.studyEnrollment.findMany({where:{...s,subjectId:subject.id,protocolVersionId:c.protocolVersionId,acceptanceFixture:false},take:2});if(enrollments.length!==1)fail('FULL_STUDY_ENROLLMENT_CHANGED');const e=enrollments[0];if(e.subjectId!==subject.id||e.protocolVersionId!==c.protocolVersionId)fail('FULL_STUDY_ENROLLMENT_CHANGED');
   for(const vp of c.visitPlans.filter(v=>v.armCodes.includes(subject.armCode))){
    const vs=await tx.subjectVisit.findMany({where:{...s,subjectId:subject.id,enrollmentId:e.id,protocolVersionId:c.protocolVersionId,visitPlanId:vp.id,acceptanceFixture:false},take:2});if(vs.length!==1)fail('FULL_STUDY_VISIT_CHANGED');const v=vs[0];await lockBinding(tx,s,{subjectId:subject.id,enrollmentId:e.id,subjectVisitId:v.id,expectedEnrollment:e,requireCurrentConsent:true});await withFullStudyVisitReads(tx,s,{subjectId:subject.id,enrollmentId:e.id,visitId:v.id,visitPlanId:vp.id,protocolVersionId:c.protocolVersionId},async tx=>{await capture(tx,s,e);
    const visit=await readVisit(tx,user,s,v.id);if(visit.status!=='completed'||visit.completionIntegrity!=='current'||visit.scheduleState==='pending_anchor')fail('FULL_STUDY_VISIT_CHANGED');
    const row={subjectId:subject.id,armCode:subject.armCode,enrollmentId:e.id,visitId:v.id,logicalVisit:vp.logicalVisit,visitPlanId:vp.id,visitVersion:visit.version,visitStatus:visit.status,cells:{}};
    const variables=c.variables.filter(x=>x.armCodes.includes(subject.armCode)&&x.logicalVisits.includes(vp.logicalVisit));
    for(const formId of [...new Set(variables.map(x=>x.formVersionId))]){
     const assignments=await tx.formAssignment.findMany({where:{...s,subjectId:subject.id,enrollmentId:e.id,subjectVisitId:v.id,formVersionId:formId,acceptanceFixture:false},select:{id:true},take:2});if(assignments.length>1)fail('FULL_STUDY_ASSIGNMENT_DUPLICATE');
     if(!assignments.length){for(const variable of variables.filter(x=>x.formVersionId===formId))row.cells[variable.key]={value:null,status:'not_collected',source:{visitId:v.id,formVersionId:formId,ref:null}};continue;}
     const pair=readResponsePair?await readResponsePair(tx,user,s,assignments[0].id,{subjectId:subject.id,enrollmentId:e.id,subjectVisitId:v.id,formVersionId:formId}):null;
     if(readResponsePair&&!pair)throw Error('FULL_STUDY_PAIR_READER_INVALID');
     const current=pair?pair.current:await read(tx,user,s,assignments[0].id),r=current.response,a=current.assignment;if(!r.ref||r.status!=='submitted'){for(const variable of variables.filter(x=>x.formVersionId===formId))row.cells[variable.key]={value:null,status:'not_collected',source:{visitId:v.id,formVersionId:formId,assignmentId:assignments[0].id,responseStatus:r.status,responseVersion:r.version,ref:r.ref??null}};continue;}
     if(a.subjectId!==subject.id||a.enrollmentId!==e.id||a.subjectVisitId!==v.id||a.formVersion.id!==formId||!r.locked||r.review!=='review_approved')fail('FULL_STUDY_SOURCE_NOT_LOCKED');
     const fixed=pair?pair.fixed:await revision(tx,user,s,a.id,r.ref);if(!fixed)fail('FULL_STUDY_SOURCE_CHANGED');if(fixed.scoreAlgorithm!==forms.find(f=>f.id===formId).scoring?.algorithm)fail('FULL_STUDY_SCORE_ALGORITHM_CHANGED');if(fullStudyHash(fixed.ref)!==fullStudyHash(r.ref)||fixed.formVersionId!==formId)fail('FULL_STUDY_SOURCE_CHANGED');
     for(const variable of variables.filter(x=>x.formVersionId===formId))row.cells[variable.key]={...scoreCell(variable,fixed),source:{ref:fixed.ref,responseVersion:r.version,formVersionId:formId,fieldKey:variable.fieldKey,schemaHash:c.forms.find(f=>f.id===formId).schemaHash,scoringHash:c.forms.find(f=>f.id===formId).scoringHash,scoreAlgorithm:fixed.scoreAlgorithm??null,selection:variable.source,visitId:v.id}};
    }
    observations.push(row);
    });
   }
  }
  const events=await tx.$queryRaw`SELECT id,"subjectId","enrollmentId",sequence,kind,decision,"policyVersionId","effectiveAt" FROM public.study_participation_event WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND "protocolVersionId"=${c.protocolVersionId} AND "subjectId"=ANY(${subjectIds}::text[]) ORDER BY "subjectId",sequence`;
  const [queries,deviations]=await Promise.all([tx.dataQuery.findMany({where:{...s,acceptanceFixture:false},select:{id:true,status:true,updatedAt:true},orderBy:{id:'asc'}}),tx.protocolDeviation.findMany({where:{...s,acceptanceFixture:false},select:{id:true,status:true,updatedAt:true},orderBy:{id:'asc'}})]);
  const visitIds=observations.map(o=>o.visitId);
  const [files,fulfillments]=await Promise.all([
   tx.modalityFile.findMany({where:{tenantId:s.tenantId,subjectId:{in:subjectIds},subjectVisitId:{in:visitIds},deletedAt:null},select:{id:true,subjectId:true,subjectVisitId:true,modality:true,kind:true,status:true,meta:true,processingTasks:{select:{id:true,status:true,updatedAt:true}}},orderBy:{id:'asc'}}),
   tx.visitRequirementFulfillment.findMany({where:{...s,subjectVisitId:{in:visitIds},visitRequirement:{kind:{not:'form_response'}}},include:{visitRequirement:{select:{kind:true,code:true}}},orderBy:{id:'asc'}})
  ]);
  const statusCounts={};for(const f of files)statusCounts[f.status]=(statusCounts[f.status]??0)+1;
  const modalities={schemaVersion:'full-study-modality-metadata-v1',status:'recorded_metadata_only',fileCount:files.length,requirementCount:fulfillments.length,statusCounts,
   files:files.map(f=>({id:f.id,subjectId:f.subjectId,visitId:f.subjectVisitId,modality:f.modality,kind:f.kind,status:f.status,contentHash:f.meta?.sha256??f.meta?.contentHash??null,processing:f.processingTasks.map(p=>({id:p.id,status:p.status,updatedAt:p.updatedAt.toISOString()}))})),
   requirements:fulfillments.map(f=>({id:f.id,visitId:f.subjectVisitId,kind:f.visitRequirement.kind,code:f.visitRequirement.code,status:f.status,evidenceHash:fullStudyHash(f.evidenceRefs),updatedAt:f.updatedAt.toISOString()}))};
  const serialize=x=>x.map(y=>({...y,...y.updatedAt?{updatedAt:y.updatedAt.toISOString()}: {},...y.effectiveAt?{effectiveAt:y.effectiveAt.toISOString()}: {}})),quality={queries:serialize(queries),deviations:serialize(deviations),modalities},blockers=[...queries,...deviations].filter(x=>x.status!=='closed');
  const manifest={schemaVersion:'full-study-simulation-root-v2',statisticalUnit:'subject',studyId,scope:s,protocolVersionId:c.protocolVersionId,sapVersion:plan.definition.sapVersion,variableMapVersion:plan.definition.variableMapVersion,purposeKey:'synthetic-research-only',executionPolicyVersionId:c.policyId,consentViewHash:fullStudyHash(serialize(events)),blindingViewHash:fullStudyHash({policyHash:c.policyHash,simulation:true}),caseMetadata:c,caseHash:fullStudyHash(c),analysisPlan:{id:plan.id,contentHash:plan.content_hash,reviewId:review.id,reviewSequence:review.sequence},subjectCount:6,rowCount:observations.length,observations,slices:buildFullStudySlices(c,observations),quality};
  const evaluation=gate('createGateEvaluation')({blockingCount:blockers.length,warningCount:0,findingFingerprints:blockers.map(x=>x.id),isEmpty:false});manifest.qualityEvaluation=evaluation;return{manifest,manifestHash:fullStudyHash(manifest),evaluation};
  });
 }
 return{authorize,admission,validateCase,project,hash:fullStudyHash,releaseGate:gate('releaseGate'),assertQualityReleased:gate('assertQualityReleased')};
}
