import {createT15FormalProjectionReader} from '../research-analysis/t15-formal-projection.mjs';
import {validateT15Plan,assertT15SyntheticUsePolicy} from '../research-analysis/t15-analysis-core.mjs';
import {deriveT17Presentation} from '../research-analysis/t17-report-presentation.mjs';
import {buildT17Report,canonicalReportJson,REPORT_SCHEMA,reportDigest} from '../research-analysis/t17-report-content.mjs';

const fail=()=>{throw Object.assign(Error('原报告或分析依据已变化，请重新核对。'),{status:409,code:'HUB_REPORT_SOURCE_INVALID'});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const same=(a,b)=>canonicalReportJson(a)===canonicalReportJson(b);
const iso=v=>{const d=new Date(v);if(!Number.isFinite(d.getTime()))fail();return d.toISOString();};
const one=(rows,predicate)=>{const found=rows.filter(predicate);if(found.length!==1)fail();return found[0];};
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const scoped=(row,s)=>row&&scopeKeys.every(k=>(row[k]??row[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())])===s[k]);

/** Pure verification over an entry-scoped, locked SQL bundle. This never authorizes a caller. */
export function createHubReportSourceVerifier({load,syntheticStudyIds=[]}){
 if(typeof load!=='function')throw TypeError('HUB_REPORT_NATIVE_DEPENDENCIES_REQUIRED');
 if(!Array.isArray(syntheticStudyIds)||syntheticStudyIds.some(value=>!id(value)))throw TypeError('HUB_REPORT_SYNTHETIC_SCOPE_INVALID');
 // Match the native T15 runtime admission; a stored bundle cannot enable itself.
 const admittedStudies=new Set(syntheticStudyIds);
 const native=(file,name)=>load('study-operations/'+file,name);
 const hash=load('research-methods/data-quality-release-policy','canonicalManifestHash');
 const assertQualityReleased=load('research-methods/data-quality-release-policy','assertQualityReleased');
 const normalizeSchema=native('study-forms-policy','normalizeFormSchema');
 const verifyRevision=native('formal-response-history','verifyFormalRevisionEnvelope');
 const policyHash=native('execution-policy-gate','policyContentHash'),policyIssues=native('execution-policy-gate','executionPolicyIssues');
 const participationIssues=native('participation-gate','participationIssues');
 return async function verify(bundle,expected){
  try{return await verified(bundle,expected);}catch(error){if(error?.code==='HUB_REPORT_SOURCE_INVALID')throw error;fail();}
 };
 async function verified(b,x){
  if(!b||!x||!id(b.actorId)||!id(x.studyId)||!admittedStudies.has(x.studyId)||!id(x.reportId)||x.version!==1||!/^rh-formal-report-/.test(x.reportId)||!/^[a-f0-9]{64}$/.test(x.contentHash??'')||b.studyId!==x.studyId||!b.scope||!scopeKeys.every(k=>id(b.scope[k])))fail();
  const s=b.scope,lists=['subjects','enrollments','visits','visitPlans','visitRequirements','assignments','responses','revisions','responseReviews','formVersions','participationEvents','queries','deviations'];
  for(const key of lists)if(!Array.isArray(b[key])||b[key].length>10000||b[key].some(row=>!scoped(row,s)))fail();
  const {report:a,reportVersion:v,reportReview:ar,run,methodReview:mr,plan:p,planReview:pr,snapshot:snap,protocol,policy}=b;
  if([a,v,ar,run,mr,p,pr,snap,protocol,policy].some(row=>!scoped(row,s)))fail();
  if(a.id!==x.reportId||a.typeKey!=='analysis_report'||a.status!=='released'||a.deletedAt||a.currentVersionNo!==1||a.approvedVersionNo!==1||a.releasedVersionNo!==1||v.artifactId!==a.id||v.versionNo!==1||v.contentHash!==x.contentHash||ar.artifactId!==a.id||ar.versionId!==v.id||ar.conclusion!=='approved'||!ar.comment?.trim())fail();
  const block=v.contentBlocks?.[0];
  if(v.contentBlocks?.length!==1||block?.schemaVersion!==REPORT_SCHEMA||block.runId!==run.id||block.analysisBasis?.studyId!==x.studyId||run.inputSummary?.studyId!==x.studyId||run.inputSummary?.snapshotId!==snap.id||mr.runId!==run.id||mr.conclusion!=='confirmed'||!mr.comment?.trim())fail();
  const definition=validateT15Plan(p.definition);
  if(p.study_id!==x.studyId||p.protocol_version_id!==definition.protocolVersionId||snap.study_id!==x.studyId||pr.study_id!==x.studyId||snap.plan_id!==p.id||pr.plan_id!==p.id||snap.review_id!==pr.id||pr.decision!=='approved'||hash(definition)!==p.content_hash||hash(snap.manifest)!==snap.manifest_hash||snap.quality_gate?.id!==snap.quality_gate_id||snap.quality_gate?.version!==1)fail();
  if(protocol.id!==definition.protocolVersionId||protocol.acceptanceFixture===true||!['executing','superseded'].includes(protocol.status)||protocol.approvedPolicyVersionId!==policy.id||policy.protocolVersionId!==protocol.id||protocol.approvedPolicyHash!==policy.contentHash||policyHash(policy.sections)!==policy.contentHash||policyIssues({...policy,reviewedAt:iso(policy.reviewedAt)}).length)fail();
  assertT15SyntheticUsePolicy(policy.sections);
  // SQL preserves the exact ORDER BY subjectId,sequence used by native usage().
  const events=[...b.participationEvents],lastSequence=new Map();
  for(const event of events){if(!Number.isSafeInteger(event.sequence)||event.sequence<1||event.sequence<=(lastSequence.get(event.subjectId)??0))fail();lastSequence.set(event.subjectId,event.sequence);}
  if(events.some(e=>e.protocolVersionId!==protocol.id||!definition.subjectIds.includes(e.subjectId)))fail();
  const use={decision:'allowed',executionPolicyVersionId:policy.id,consentViewHash:hash({policyHash:policy.contentHash,events:events.map(e=>({id:e.id,subjectId:e.subjectId,enrollmentId:e.enrollmentId,sequence:e.sequence,kind:e.kind,decision:e.decision,policyVersionId:e.policyVersionId,effectiveAt:iso(e.effectiveAt)})),purposeKey:definition.purposeKey}),blindingViewHash:hash({policyHash:policy.contentHash,blinding:policy.sections.blinding})};
  const observations=[],currentByAssignment=new Map(),revisionByAssignment=new Map(),visitById=new Map();
  for(const subjectId of [...definition.subjectIds].sort()){
   const subject=one(b.subjects,r=>r.id===subjectId);if(subject.deletedAt||subject.acceptanceFixture===true)fail();
   const enrollment=one(b.enrollments,r=>r.subjectId===subjectId&&r.protocolVersionId===protocol.id&&!r.acceptanceFixture);
   if(!['enrolled','grouped','in_progress'].includes(enrollment.status)||participationIssues(policy.sections,events.filter(e=>e.subjectId===subjectId&&e.policyVersionId===policy.id)).length)fail();
   const planIds=b.visitPlans.filter(r=>r.protocolVersionId===protocol.id&&r.code===definition.visitCode).map(r=>r.id);
   const visit=one(b.visits,r=>r.subjectId===subjectId&&r.enrollmentId===enrollment.id&&r.protocolVersionId===protocol.id&&planIds.includes(r.visitPlanId)&&!r.acceptanceFixture);
   if(visit.scheduleState==='pending_anchor'||!['planned','due_soon','overdue','in_progress','deviation','completed'].includes(visit.status))fail();
   const selected={subjectId,enrollmentId:enrollment.id,visitId:visit.id,sources:[]};
   for(const formId of [...new Set(definition.variables.map(v=>v.formVersionId))]){
    const assignment=one(b.assignments,r=>r.subjectId===subjectId&&r.enrollmentId===enrollment.id&&r.subjectVisitId===visit.id&&r.formVersionId===formId&&!r.acceptanceFixture);
    const form=one(b.formVersions,r=>r.id===formId);if(!['published','locked'].includes(form.status))fail();
    const response=one(b.responses,r=>r.assignmentId===assignment.id);
    const raw=one(b.revisions,r=>r.id===response.currentRevisionId&&r.responseId===response.id&&r.assignmentId===assignment.id);
    const review=b.responseReviews.filter(r=>r.responseId===response.id&&r.revisionId===raw.id&&['review_approved','review_returned'].includes(r.action)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).at(-1);
    if(response.status!=='submitted'||response.lockedRevisionId!==raw.id||review?.action!=='review_approved'||raw.subjectId!==subjectId||raw.enrollmentId!==enrollment.id||raw.subjectVisitId!==visit.id||raw.formVersionId!==formId||raw.protocolVersionId!==protocol.id||raw.policyVersionId!==policy.id||raw.policyHash!==policy.contentHash)fail();
    const revision=verifyRevision({...raw,createdAt:new Date(raw.createdAt),sourceSubmittedAt:raw.sourceSubmittedAt===null?null:new Date(raw.sourceSubmittedAt)});
    const current={assignment:{...assignment,formVersion:form},response:{...response,ref:revision.ref,locked:true,review:review.action}};
    currentByAssignment.set(assignment.id,current);revisionByAssignment.set(assignment.id,revision);selected.sources.push(revision.ref);
   }
   const requirements=b.visitRequirements.filter(r=>r.visitPlanId===visit.visitPlanId&&r.required);
   let integrity='not_completed';
   if(visit.status==='completed'){
    if(requirements.some(r=>['scale','modality_file'].includes(r.kind)))fail();
    // Unversioned completion records cannot establish the locked revision chain.
    if(Array.isArray(visit.evidenceRefs)&&visit.evidenceRefs.some(r=>r?.type==='form_response'))fail();
    const refs=new Map((Array.isArray(visit.evidenceRefs)?visit.evidenceRefs:[]).filter(r=>r?.type==='formal_response_revision').map(r=>[r.assignmentId,r]));
    for(const requirement of requirements.filter(r=>r.kind==='form_response')){
     const matches=[...currentByAssignment.values()].filter(c=>c.assignment.subjectVisitId===visit.id&&c.assignment.formVersionId===requirement.config?.formVersionId);if(!matches.length)fail();
     for(const c of matches){const ref=refs.get(c.assignment.id);if(!ref||ref.responseVersion!==c.response.version||!same({...c.response.ref,type:ref.type,responseVersion:ref.responseVersion},ref))fail();}
    }integrity='current';
   }
   visitById.set(visit.id,{...visit,subject:{id:subjectId},completionIntegrity:integrity});observations.push(selected);
  }
  const reader=createT15FormalProjectionReader({lockSources:async()=>{},authorizeUse:async()=>use,readResponse:async(_tx,_u,_s,id)=>currentByAssignment.get(id),readRevision:async(_tx,_u,_s,id)=>revisionByAssignment.get(id),readVisit:async(_tx,_u,_s,id)=>visitById.get(id),normalizeSchema,canonicalManifestHash:hash});
  const projected=await reader.read(null,{tenantId:s.tenantId,accountId:b.actorId},s,{...definition,studyId:x.studyId,observations},{phase:'export'});
  // Preserve the native SQL ORDER BY id, including database collation.
  const dates=rows=>rows.map(r=>({id:r.id,status:r.status,updatedAt:iso(r.updatedAt)}));
  const manifest={...projected.manifest,analysisPlan:{id:p.id,contentHash:p.content_hash,reviewId:pr.id,reviewSequence:pr.sequence},quality:{rulesetVersion:'t15-structural-v1',queries:dates(b.queries),deviations:dates(b.deviations)}};
  if(b.queries.some(r=>r.status!=='closed')||b.deviations.some(r=>r.status!=='closed')||!same(manifest,snap.manifest)||hash(manifest)!==snap.manifest_hash)fail();
  assertQualityReleased(snap.quality_gate,hash(manifest));
  const basis={type:'study-analysis-snapshot',studyId:x.studyId,snapshotId:snap.id,manifestHash:snap.manifest_hash,qualityGateId:snap.quality_gate_id,qualityGateVersion:1,planId:p.id,planReviewId:pr.id,purposeKey:definition.purposeKey,...Object.fromEntries(['protocolVersionId','sapVersion','variableMapVersion','executionPolicyVersionId','consentViewHash','blindingViewHash'].map(k=>[k,manifest[k]]))};
  const presentation=Object.hasOwn(block,'presentation')?deriveT17Presentation(manifest,b.formVersions,normalizeSchema,hash):undefined;
  const built=buildT17Report(run,basis,a.title,presentation),sources=v.sources??b.sources;
  if(!Array.isArray(sources)||sources.length!==built.sources.length||!same(v.contentBlocks,built.contentBlocks)||v.contentMd!==built.contentMd||v.contentHash!==built.contentHash||v.sourceSnapshotHash!==built.sourceSnapshotHash)fail();
  for(const expectedSource of built.sources){const saved=one(sources,r=>r.sourceType===expectedSource.sourceType&&r.sourceId===expectedSource.sourceId);if(saved.sourceVersion!==expectedSource.sourceVersion||!same(saved.snapshot,expectedSource.snapshot)||saved.hash!==reportDigest(canonicalReportJson(expectedSource.snapshot)))fail();}
  return{reportId:a.id,version:1,contentHash:built.contentHash,contentMd:built.contentMd,basis};
 }
}
