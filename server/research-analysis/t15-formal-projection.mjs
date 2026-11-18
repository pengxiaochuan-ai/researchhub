import {researchError} from '../research-studies/contract.mjs';
const fail=(code)=>{throw researchError(409,code,'分析来源或使用条件不可核验，请刷新并核对。');};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const compare=(a,b)=>a<b?-1:a>b?1:0;
const sameRef=(a,b)=>a&&b&&['responseId','assignmentId','revisionNo','contentHash'].every(k=>a[k]===b[k]);
const validRef=r=>r&&id(r.responseId)&&id(r.assignmentId)&&Number.isSafeInteger(r.revisionNo)&&r.revisionNo>0&&hash(r.contentHash);
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function selection(input){
 if(!input||!['studyId','protocolVersionId','sapVersion','variableMapVersion','purposeKey'].every(k=>id(input[k]))||!['subject','subject_visit'].includes(input.statisticalUnit)||!Array.isArray(input.variables)||!input.variables.length||input.variables.length>100||!Array.isArray(input.observations)||!input.observations.length||input.observations.length>1000)fail('ANALYSIS_SELECTION_INVALID');
 const keys=new Set();
 for(const v of input.variables){if(!v||!id(v.key)||keys.has(v.key)||!id(v.formVersionId)||typeof v.fieldKey!=='string'||!v.fieldKey||!['number','integer','boolean','text','select'].includes(v.valueType)||(v.unit!==null&&(typeof v.unit!=='string'||!v.unit.trim())))fail('ANALYSIS_VARIABLE_MAP_INVALID');keys.add(v.key);}
 const visits=new Set(),subjects=new Set();
 for(const row of input.observations){
  if(!row||!['subjectId','enrollmentId','visitId'].every(k=>id(row[k]))||!Array.isArray(row.sources)||!row.sources.length||row.sources.length>100||row.sources.some(r=>!validRef(r)))fail('ANALYSIS_SELECTION_INVALID');
  if(visits.has(row.visitId)||new Set(row.sources.map(r=>r.assignmentId)).size!==row.sources.length)fail('ANALYSIS_DUPLICATE_OBSERVATION');
  if(input.statisticalUnit==='subject'&&subjects.has(row.subjectId))fail('ANALYSIS_REPEATED_SUBJECT');
  visits.add(row.visitId);subjects.add(row.subjectId);
 }
}
/** No default authorization, persistence, quality release or runtime registration. Dependencies are server-owned. */
export function createT15FormalProjectionReader(deps){
 for(const key of ['lockSources','authorizeUse','readResponse','readRevision','readVisit','normalizeSchema','canonicalManifestHash'])if(typeof deps?.[key]!=='function')throw Error('T15_DEPENDENCY_REQUIRED:'+key);
 return {async read(tx,user,scope,input,{phase='snapshot'}={}){
  selection(input);
  if(!scope||!['tenantId','studyGroupId','researchProjectId'].every(k=>id(scope[k]))||user?.tenantId!==scope.tenantId||!id(user?.accountId)||!['snapshot','dispatch','publish','export'].includes(phase))fail('ANALYSIS_SCOPE_INVALID');
  // Integration must own current tenant authorization and every parent lock before any response read.
  await deps.lockSources(tx,user,scope,input);
  const use=await deps.authorizeUse(tx,user,scope,{phase,input});
  if(use?.decision!=='allowed'||!id(use.executionPolicyVersionId)||!hash(use.consentViewHash)||!hash(use.blindingViewHash))fail('ANALYSIS_USE_POLICY_UNAVAILABLE');
  const rows=[];
  for(const row of [...input.observations].sort((a,b)=>compare(a.subjectId,b.subjectId)||compare(a.visitId,b.visitId))){
   const visit=await deps.readVisit(tx,user,scope,row.visitId);
   if(!['planned','due_soon','overdue','in_progress','deviation','completed'].includes(visit.status)||!Number.isSafeInteger(visit.version)||visit.version<0||!['not_completed','current','requires_review','legacy_unversioned'].includes(visit.completionIntegrity)||visit.id!==row.visitId||visit.subject?.id!==row.subjectId||visit.enrollmentId!==row.enrollmentId||visit.protocolVersionId!==input.protocolVersionId||visit.scheduleState==='pending_anchor'||['cancelled','canceled'].includes(visit.status)||visit.status==='completed'&&visit.completionIntegrity!=='current')fail('ANALYSIS_VISIT_CHANGED');
   const byForm=new Map();
   for(const ref of row.sources){
    const current=await deps.readResponse(tx,user,scope,ref.assignmentId),a=current?.assignment,r=current?.response;
    if(!a||!r||a.id!==ref.assignmentId||a.subjectId!==row.subjectId||a.enrollmentId!==row.enrollmentId||a.subjectVisitId!==row.visitId||!sameRef(r.ref,ref)||r.status!=='submitted'||!Number.isSafeInteger(r.version)||r.version<1)fail('ANALYSIS_SOURCE_CHANGED');
    if(!r.locked||r.review!=='review_approved')fail('ANALYSIS_SOURCE_NOT_REVIEWED');
    const revision=await deps.readRevision(tx,user,scope,ref.assignmentId,ref);
    if(!sameRef(revision.ref,ref)||revision.formVersionId!==a.formVersion?.id||!input.variables.some(v=>v.formVersionId===revision.formVersionId)||byForm.has(revision.formVersionId)||!revision.answers||typeof revision.answers!=='object'||Array.isArray(revision.answers))fail('ANALYSIS_SOURCE_CHANGED');
    byForm.set(revision.formVersionId,{revision,version:r.version,definitionHash:deps.canonicalManifestHash({schema:a.formVersion.schema,scoring:a.formVersion.scoring??null}),fields:deps.normalizeSchema(a.formVersion.schema).fields});
   }
   const cells=[];
   for(const variable of [...input.variables].sort((a,b)=>compare(a.key,b.key))){
    const source=byForm.get(variable.formVersionId),field=source?.fields.find(f=>f.key===variable.fieldKey);
    if(!source||!field||field.type!==variable.valueType||(typeof field.unit==='string'&&field.unit.trim()?field.unit:null)!==variable.unit)fail('ANALYSIS_FIELD_MAPPING_INVALID');
    const present=Object.hasOwn(source.revision.answers,variable.fieldKey),value=present?source.revision.answers[variable.fieldKey]:null;
    if(value===undefined||value!==null&&!(typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)))fail('ANALYSIS_VALUE_INVALID');
    const missing=!present?'not_recorded':value===null?'null':value===''?'blank':null;
    if(!missing&&(['number','integer'].includes(field.type)?typeof value!=='number'||field.type==='integer'&&!Number.isSafeInteger(value):field.type==='boolean'?typeof value!=='boolean':typeof value!=='string'))fail('ANALYSIS_VALUE_INVALID');
    cells.push({key:variable.key,value,missing,unit:variable.unit,source:{formVersionId:variable.formVersionId,fieldKey:variable.fieldKey,formDefinitionHash:source.definitionHash,ref:{responseId:source.revision.ref.responseId,assignmentId:source.revision.ref.assignmentId,revisionNo:source.revision.ref.revisionNo,contentHash:source.revision.ref.contentHash},responseVersion:source.version}});
   }
   rows.push({subjectId:row.subjectId,enrollmentId:row.enrollmentId,visitId:row.visitId,protocolVersionId:input.protocolVersionId,visitStatus:visit.status,visitVersion:visit.version,completionIntegrity:visit.completionIntegrity,cells});
  }
  const manifest={schemaVersion:'t15-formal-projection-v1',hashAlgorithm:'m10-canonical-manifest-sha256',studyId:input.studyId,purposeKey:input.purposeKey,scope:{tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId},protocolVersionId:input.protocolVersionId,sapVersion:input.sapVersion,variableMapVersion:input.variableMapVersion,statisticalUnit:input.statisticalUnit,executionPolicyVersionId:use.executionPolicyVersionId,consentViewHash:use.consentViewHash,blindingViewHash:use.blindingViewHash,variables:[...input.variables].sort((a,b)=>compare(a.key,b.key)).map(v=>({key:v.key,formVersionId:v.formVersionId,fieldKey:v.fieldKey,valueType:v.valueType,unit:v.unit})),rowCount:rows.length,subjectCount:new Set(rows.map(r=>r.subjectId)).size,rows};
  // Only manifest values are retained; dependency-owned objects are not frozen or shared.
  const detached=JSON.parse(JSON.stringify(manifest));
  return freeze({manifest:detached,manifestHash:deps.canonicalManifestHash(detached)});
 }};
}
/** Recompute via the same reader at dispatch/publish/export; never authorize from the stored hash alone. */
export function assertT15ProjectionCurrent(expectedManifestHash,current){
 if(!hash(expectedManifestHash)||!hash(current?.manifestHash)||expectedManifestHash!==current.manifestHash)fail('ANALYSIS_BASIS_STALE');
}
