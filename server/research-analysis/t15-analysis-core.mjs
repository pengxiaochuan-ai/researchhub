import {researchError,only} from '../research-studies/contract.mjs';
import {createT15FormalProjectionReader} from './t15-formal-projection.mjs';
const fail=code=>{throw researchError(409,code,'分析计划、来源或使用条件已变化，请重新核对。');};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export function assertT15SyntheticUsePolicy(sections){
 if(['ethics','screening','researchConsent','dataUse','withdrawal'].some(k=>!['configured','not_applicable'].includes(sections?.[k]?.status))||sections?.blinding?.status!=='not_applicable'||sections.dataUse.status==='configured'&&sections.dataUse.rules?.scope!=='synthetic-research-only')fail('ANALYSIS_USE_POLICY_UNAVAILABLE');
}
export function validateT15Plan(value){
 only(value,['schemaVersion','dataClassification','purposeKey','method','statisticalUnit','protocolVersionId','visitCode','subjectIds','variables','sapVersion','variableMapVersion','reason']);
 if(value.schemaVersion!=='t15-synthetic-plan-v1'||value.dataClassification!=='synthetic'||value.purposeKey!=='synthetic-research-only'||value.method!=='descriptive'||value.statisticalUnit!=='subject'||value.visitCode!=='BASELINE'||!['protocolVersionId','sapVersion','variableMapVersion'].every(k=>id(value[k]))||!Array.isArray(value.subjectIds)||value.subjectIds.length!==3||new Set(value.subjectIds).size!==3||value.subjectIds.some(x=>!id(x))||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>5000||!Array.isArray(value.variables)||!value.variables.length||value.variables.length>30)fail('ANALYSIS_PLAN_INVALID');
 const keys=new Set();for(const v of value.variables){only(v,['key','formVersionId','fieldKey','valueType','unit']);if(!id(v.key)||v.key==='__proto__'||keys.has(v.key)||!id(v.formVersionId)||typeof v.fieldKey!=='string'||!v.fieldKey||!['number','integer','boolean','text','select'].includes(v.valueType)||(v.unit!==null&&(typeof v.unit!=='string'||!v.unit.trim())))fail('ANALYSIS_PLAN_INVALID');keys.add(v.key);}
 return JSON.parse(JSON.stringify(value));
}
/** Actual existing TS core functions, never caller-supplied response values or a mock permission default. */
export function createT15AnalysisCore({load,syntheticStudyIds}){
 if(typeof load!=='function'||!Array.isArray(syntheticStudyIds)||!syntheticStudyIds.length||syntheticStudyIds.some(x=>!id(x)))throw Error('T15_SYNTHETIC_SCOPE_REQUIRED');
 const get=(file,name)=>load('study-operations/'+file,name),lockAuthorization=load('common/worker-publication','lockAuthorizationMutation');
 const auth=get('formal-response-authority','authorizeFormalResponse'),lockScope=get('protocol-migration-lock','lockCaptureScope'),lockBinding=get('protocol-migration-lock','lockCaptureBinding'),capture=get('participation-capture','assertParticipationCapture');
 const readResponse=get('formal-response-query','readFormalResponseInTransaction'),readRevision=get('formal-response-history','readFormalResponseRevisionInTransaction'),readVisit=get('formal-response-visits','readFormalVisitInTransaction'),normalizeSchema=get('study-forms-policy','normalizeFormSchema');
 const canonicalManifestHash=load('research-methods/data-quality-release-policy','canonicalManifestHash'),createGateEvaluation=load('research-methods/data-quality-release-policy','createGateEvaluation'),releaseGate=load('research-methods/data-quality-release-policy','releaseGate'),assertQualityReleased=load('research-methods/data-quality-release-policy','assertQualityReleased');
 async function authorize(tx,user,s,studyId,admin=false){
  if(!syntheticStudyIds.includes(studyId))fail('ANALYSIS_SYNTHETIC_SCOPE_REQUIRED');
  await lockAuthorization(tx,s.tenantId);const current=await auth(tx,user,s.studyGroupId,s.researchProjectId,'read');
  if(current.role==='tenant_admin'&&current.isTenantAdmin)return current;
  if(admin)throw researchError(403,'ANALYSIS_ADMIN_REQUIRED','当前合成计划须由租户管理员提交和复核。');
  const member=await tx.studyGroupMembership.findFirst({where:{tenantId:s.tenantId,studyGroupId:s.studyGroupId,accountId:user.accountId,status:'active'},include:{role:true}});
  if(!Array.isArray(member?.role?.buttonPermissions)||!member.role.buttonPermissions.includes('data.analyze'))throw researchError(403,'ANALYSIS_FORBIDDEN','当前账号无分析权限。');return current;
 }
 async function lockPlanSources(tx,user,s,studyId,definition){
  await authorize(tx,user,s,studyId);await lockScope(tx,s,[definition.protocolVersionId]);
  const ids=[...definition.subjectIds].sort();const subjects=await tx.$queryRaw`SELECT id FROM public.subject WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND id=ANY(${ids}::text[]) AND "deletedAt" IS NULL AND "acceptanceFixture"=false ORDER BY id FOR UPDATE`;
  if(subjects.length!==ids.length)fail('ANALYSIS_SUBJECT_UNAVAILABLE');
  const observations=[];
  for(const subjectId of ids){
   const es=await tx.studyEnrollment.findMany({where:{...s,subjectId,protocolVersionId:definition.protocolVersionId,acceptanceFixture:false},take:2});if(es.length!==1)fail('ANALYSIS_ENROLLMENT_UNAVAILABLE');
   const e=es[0],visits=await tx.subjectVisit.findMany({where:{...s,subjectId,enrollmentId:e.id,protocolVersionId:e.protocolVersionId,acceptanceFixture:false,visitPlan:{is:{...s,protocolVersionId:e.protocolVersionId,code:definition.visitCode}}},take:2});if(visits.length!==1)fail('ANALYSIS_VISIT_UNAVAILABLE');
   await lockBinding(tx,s,{subjectId,enrollmentId:e.id,subjectVisitId:visits[0].id,expectedEnrollment:e,requireCurrentConsent:true});await capture(tx,s,e);
   observations.push({subjectId,enrollmentId:e.id,visitId:visits[0].id,sources:[]});
  }return observations;
 }
 async function usage(tx,user,s,studyId,definition){
  await authorize(tx,user,s,studyId);
  const protocol=await tx.studyProtocolVersion.findFirst({where:{...s,id:definition.protocolVersionId,acceptanceFixture:false,status:{in:['executing','superseded']}}});
  const policy=protocol?.approvedPolicyVersionId?await tx.studyExecutionPolicyVersion.findFirst({where:{...s,id:protocol.approvedPolicyVersionId,protocolVersionId:protocol.id,status:'approved'}}):null;
  if(!policy||policy.contentHash!==protocol.approvedPolicyHash)fail('ANALYSIS_USE_POLICY_UNAVAILABLE');
  assertT15SyntheticUsePolicy(policy.sections);
  const events=await tx.$queryRaw`SELECT id,"subjectId","enrollmentId",sequence,kind,decision,"policyVersionId","effectiveAt" FROM public.study_participation_event WHERE "tenantId"=${s.tenantId} AND "studyGroupId"=${s.studyGroupId} AND "researchProjectId"=${s.researchProjectId} AND "protocolVersionId"=${protocol.id} AND "subjectId"=ANY(${definition.subjectIds}::text[]) ORDER BY "subjectId",sequence`;
  return {decision:'allowed',executionPolicyVersionId:policy.id,consentViewHash:canonicalManifestHash({policyHash:policy.contentHash,events:events.map(e=>({...e,effectiveAt:new Date(e.effectiveAt).toISOString()})),purposeKey:definition.purposeKey}),blindingViewHash:canonicalManifestHash({policyHash:policy.contentHash,blinding:policy.sections.blinding})};
 }
 async function validateSources(tx,user,s,studyId,definition){
  validateT15Plan(definition);const observations=await lockPlanSources(tx,user,s,studyId,definition);await usage(tx,user,s,studyId,definition);
  for(const formId of [...new Set(definition.variables.map(v=>v.formVersionId))]){const form=await tx.formVersion.findFirst({where:{...s,id:formId,status:{in:['published','locked']}}});if(!form)fail('ANALYSIS_FORM_UNAVAILABLE');const fields=normalizeSchema(form.schema).fields;for(const v of definition.variables.filter(v=>v.formVersionId===formId))if(!fields.some(f=>f.key===v.fieldKey&&f.type===v.valueType&&(typeof f.unit==='string'&&f.unit.trim()?f.unit:null)===v.unit))fail('ANALYSIS_FIELD_MAPPING_INVALID');}
  return observations;
 }
 async function project(tx,user,s,studyId,plan,review,phase='snapshot'){
  const definition=validateT15Plan(plan.definition);if(canonicalManifestHash(definition)!==plan.content_hash||review?.decision!=='approved')fail('ANALYSIS_PLAN_NOT_APPROVED');
  const observations=await validateSources(tx,user,s,studyId,definition);
  for(const row of observations)for(const formId of [...new Set(definition.variables.map(v=>v.formVersionId))]){
   const assignments=await tx.formAssignment.findMany({where:{...s,subjectId:row.subjectId,enrollmentId:row.enrollmentId,subjectVisitId:row.visitId,formVersionId:formId,acceptanceFixture:false},select:{id:true},take:2});if(assignments.length!==1)fail('ANALYSIS_SOURCE_UNAVAILABLE');
   const current=await readResponse(tx,user,s,assignments[0].id);if(!current.response.ref)fail('ANALYSIS_SOURCE_UNAVAILABLE');row.sources.push(current.response.ref);
  }
  // validateSources above already owns all sorted parent locks for this entire batch.
  const reader=createT15FormalProjectionReader({lockSources:async()=>{},authorizeUse:()=>usage(tx,user,s,studyId,definition),readResponse,readRevision,readVisit,normalizeSchema,canonicalManifestHash});
  const projected=await reader.read(tx,user,s,{...definition,studyId,observations},{phase});
  const visitIds=observations.map(o=>o.visitId),parents={...s,acceptanceFixture:false,OR:[{subjectVisitId:{in:visitIds}},{subjectVisitId:null,subjectId:{in:definition.subjectIds}},{subjectVisitId:null,subjectId:null}]};
  const [queries,deviations]=await Promise.all([tx.dataQuery.findMany({where:parents,select:{id:true,status:true,updatedAt:true},orderBy:{id:'asc'}}),tx.protocolDeviation.findMany({where:parents,select:{id:true,status:true,updatedAt:true},orderBy:{id:'asc'}})]);
  const quality={rulesetVersion:'t15-structural-v1',queries:queries.map(q=>({...q,updatedAt:q.updatedAt.toISOString()})),deviations:deviations.map(q=>({...q,updatedAt:q.updatedAt.toISOString()}))};
  const manifest={...projected.manifest,analysisPlan:{id:plan.id,contentHash:plan.content_hash,reviewId:review.id,reviewSequence:review.sequence},quality};
  const blockers=[...queries.map(q=>({...q,kind:'query'})),...deviations.map(q=>({...q,kind:'deviation'}))].filter(q=>q.status!=='closed').map(q=>q.kind+':'+q.id);
  return {manifest,manifestHash:canonicalManifestHash(manifest),evaluation:createGateEvaluation({blockingCount:blockers.length,warningCount:0,findingFingerprints:blockers,isEmpty:manifest.rowCount===0})};
 }
 return {authorize,validateSources,project,hash:canonicalManifestHash,releaseGate,assertQualityReleased};
}
