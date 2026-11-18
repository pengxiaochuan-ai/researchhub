// Pure injection boundary. Importing performs no I/O; this module never writes files or opens a fixture.
// Only root calls capture with its READ ONLY h.read and existing science/admission dependencies.
import assert from 'node:assert/strict';
import {bodyHash,requireWF03Window} from './study-workflow-wf03-qa.mjs';
export const releaseMutableColumns=Object.freeze(['status','approvedBy','lockedAt','approvedPolicyVersionId','approvedPolicyHash','effectiveFrom','effectiveTo','supersededById','updatedAt']);
const immutablePublic=['tenant','account','permission_role','study_group','study_group_membership','research_project','research_project_membership','subject','subject_group_definition','subject_profile','study_enrollment','study_enrollment_anchor','subject_visit','visit_requirement_fulfillment','form_assignment','form_response','form_response_revision','form_response_review_event','form_response_command_receipt','form_template','form_version','outcome_definition','visit_plan','visit_requirement','study_task_template','scale_version_applicability','scale_definition','scale_version','scale_version_item','scoring_rule'];
const globalScale=new Set(['scale_definition','scale_version','scale_version_item','scoring_rule']);
const appendSpecs={
 'public.study_execution_policy_version':'t."protocolVersionId" AS "protocolId",t."studyGroupId",t."researchProjectId"',
 'public.protocol_release_check':'t."protocolVersionId" AS "protocolId",t."studyGroupId",t."researchProjectId"',
 'public.protocol_release_check_finding':'t."checkId",t."studyGroupId",t."researchProjectId"',
 'public.remediation_case':'t."sourceType",t."sourceId",t."affectedResource"->>\'id\' AS "affectedId",t."affectedResource"->>\'type\' AS "affectedType",t."studyGroupId",t."researchProjectId"',
 'public.remediation_attempt':'t."remediationCaseId" AS "caseId",t."studyGroupId",t."researchProjectId"',
 'public.remediation_event':'t."remediationCaseId" AS "caseId",t."studyGroupId",t."researchProjectId"',
 'rh_research.operation':'t.target_id AS "protocolId",t.actor_id AS "actorId",t.request_key AS "requestKey",t.request_hash AS "requestHash",t.audit_id AS "auditId",t.action',
 'public.audit_log':'t.action,t.target,t."accountId" AS "actorId",t."studyGroupId",t."researchProjectId"',
};
const protocolTable='public.study_protocol_version';
export function normalizedProtocolTargets(ids){
 if(!Array.isArray(ids)){assert.deepEqual(Object.keys(ids??{}).sort(),['A','B','D'],'EXACT_A_B_D_PROTOCOL_IDS_REQUIRED');ids=['A','B','D'].map(k=>ids[k]);}
 assert.equal(ids.length,3);assert(ids.every(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id)));assert.equal(new Set(ids).size,3);return[...ids].sort();
}
async function rows(tx,table,tenantId,{extra='',id='t.id',tenantColumn='tenantId',official=false}={}){
 // Every SQL identifier/expression is a fixed module literal, never root/user text.
 const where=official?`(t."${tenantColumn}"=$1 OR t."${tenantColumn}" IS NULL)`:`t."${tenantColumn}"=$1`;
 return tx.$queryRawUnsafe(`SELECT ${id} AS id,md5(row_to_json(t)::text) AS hash${extra?','+extra:''} FROM ${table} t WHERE ${where} ORDER BY id`,tenantId);
}
export async function captureWF03Protection(h,protocolIds,{phase='before',readProtection,compareProtection,originalScience,verifyWF02Admission,env=process.env}={}){
 requireWF03Window(env);const targetProtocolIds=normalizedProtocolTargets(protocolIds);assert(['before','after'].includes(phase));assert.equal(typeof h?.read,'function');
 const tenantId=h.runtime?.ids?.tenant;assert(typeof tenantId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(tenantId));
 assert.equal(typeof readProtection,'function');assert.equal(typeof compareProtection,'function');assert(originalScience,'ORIGINAL_SCIENCE_BASELINE_REQUIRED');if(phase==='before')assert.equal(typeof verifyWF02Admission,'function','ROOT_ACCEPTED_WF02_ADMISSION_REQUIRED');
 const science=await readProtection(h);await compareProtection(originalScience,science);
 const captured=await h.read(async tx=>{
  const [state]=await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS readonly,current_user AS role");assert.equal(state.readonly,'on','ROOT_H_READ_MUST_BE_READ_ONLY');
  const immutable={};for(const table of immutablePublic)immutable['public.'+table]=await rows(tx,'public."'+table+'"',tenantId,{tenantColumn:table==='tenant'?'id':'tenantId',official:globalScale.has(table)});
  for(const table of ['project_intent','study_binding'])immutable['rh_research.'+table]=await rows(tx,'rh_research."'+table+'"',tenantId,{tenantColumn:'tenant_id'});
  immutable['rh_research.hub_role']=await rows(tx,'rh_research.hub_role',tenantId,{tenantColumn:'tenant_id',id:"concat(t.hub_key,':',t.account_id)"});
  const columns=releaseMutableColumns.map(k=>"'"+k+"'").join(',');
  const protocols=await rows(tx,protocolTable,tenantId,{extra:`md5((to_jsonb(t)-ARRAY[${columns}]::text[])::text) AS "stableHash",t.status,t."studyGroupId",t."researchProjectId",t."approvedPolicyVersionId"`});
  const append={};for(const [table,extra]of Object.entries(appendSpecs))append[table]=await rows(tx,table,tenantId,{extra,tenantColumn:table.startsWith('rh_research.')?'tenant_id':'tenantId'});
  return{readOnly:true,readRole:state.role,immutable,protocols,append};
 });
 const snapshot={schema:1,task:'WF03',at:new Date().toISOString(),phase,tenantId,targetProtocolIds,science,...captured,wf02AdmissionVerified:false};
 const found=new Map(snapshot.protocols.map(p=>[p.id,p]));for(const id of targetProtocolIds)assert(found.has(id),'FROZEN_TARGET_PROTOCOL_MISSING');
 if(phase==='before'){
  for(const id of targetProtocolIds){assert.equal(found.get(id).status,'draft','INITIAL_TARGET_MUST_STILL_BE_WF02_DRAFT');assert.equal(found.get(id).approvedPolicyVersionId,null);}
  assert.equal(snapshot.append['public.study_execution_policy_version'].filter(p=>targetProtocolIds.includes(p.protocolId)).length,0,'INITIAL_TARGET_POLICY_MUST_BE_ZERO');
  // Root must compare accepted WF02 fixed copies/import records and original source hashes now.
  // Capturing a current snapshot alone must never grandfather pre-existing drift.
  await verifyWF02Admission(snapshot);snapshot.wf02AdmissionVerified=true;
 }
 return snapshot;
}
function unchangedRows(before,after,{append=false,label}={}){
 const current=new Map(after.map(r=>[r.id,r]));assert.equal(current.size,after.length,label+':DUPLICATE_ID');const original=new Set(before.map(r=>r.id));assert.equal(original.size,before.length);
 if(!append)assert.equal(after.length,before.length,label+':ROW_COUNT_CHANGED');
 for(const row of before){assert(current.has(row.id),label+':ORIGINAL_ID_MISSING');assert.equal(current.get(row.id).hash,row.hash,label+':ORIGINAL_FULL_ROW_CHANGED');}
 return after.filter(r=>!original.has(r.id));
}
export async function compareWF03Protection(before,after,{compareProtection}={}){
 assert.equal(typeof compareProtection,'function');for(const x of [before,after]){assert.equal(x.schema,1);assert.equal(x.task,'WF03');assert.equal(x.readOnly,true);}
 assert.equal(before.phase,'before','USE_THE_ORIGINAL_WF03_BASELINE');assert.equal(before.wf02AdmissionVerified,true,'UNADMITTED_BASELINE_CANNOT_GRANDFATHER_DRIFT');assert.equal(after.phase,'after');assert.equal(after.tenantId,before.tenantId);assert.deepEqual(after.targetProtocolIds,before.targetProtocolIds);await compareProtection(before.science,after.science);
 assert.deepEqual(Object.keys(after.immutable).sort(),Object.keys(before.immutable).sort());for(const [table,old]of Object.entries(before.immutable))unchangedRows(old,after.immutable[table],{label:table});
 const targets=new Set(before.targetProtocolIds),protocols=new Map(after.protocols.map(p=>[p.id,p]));assert.equal(protocols.size,after.protocols.length);assert.equal(after.protocols.length,before.protocols.length,'NO_NEW_OR_DELETED_PROTOCOL');
 for(const old of before.protocols){const current=protocols.get(old.id);assert(current,'ORIGINAL_PROTOCOL_ID_MISSING');assert.equal(targets.has(old.id)?current.stableHash:current.hash,targets.has(old.id)?old.stableHash:old.hash,targets.has(old.id)?'TARGET_NON_RELEASE_COLUMN_CHANGED':'SOURCE_OR_UNRELATED_PROTOCOL_FULL_ROW_CHANGED');}
 assert.deepEqual(Object.keys(after.append).sort(),Object.keys(before.append).sort());const added={};for(const [table,old]of Object.entries(before.append))added[table]=unchangedRows(old,after.append[table],{append:true,label:table});
 const scopeMatches=(row,protocolId)=>{assert(targets.has(protocolId),'NEW_ROW_OUTSIDE_THREE_PROTOCOL_TARGETS');const p=protocols.get(protocolId);assert(p);if(row.studyGroupId!==undefined)assert.equal(row.studyGroupId,p.studyGroupId);if(row.researchProjectId!==undefined)assert.equal(row.researchProjectId,p.researchProjectId);};
 for(const table of ['public.study_execution_policy_version','public.protocol_release_check','rh_research.operation'])for(const r of added[table])scopeMatches(r,r.protocolId);
 const checks=new Map(after.append['public.protocol_release_check'].map(r=>[r.id,r]));for(const r of added['public.protocol_release_check_finding']){const parent=checks.get(r.checkId);assert(parent,'NEW_FINDING_MUST_HAVE_REAL_CHECK');scopeMatches(r,parent.protocolId);}
 const cases=new Map(after.append['public.remediation_case'].map(r=>[r.id,r]));const caseProtocol=row=>{assert.equal(row.sourceType,'protocol_release_finding','NEW_REMEDIATION_MUST_BE_PROTOCOL_RELEASE');assert.equal(row.affectedType,'study_protocol');assert.equal(row.affectedId,row.sourceId);scopeMatches(row,row.sourceId);return row.sourceId;};
 for(const r of added['public.remediation_case'])caseProtocol(r);
 for(const table of ['public.remediation_attempt','public.remediation_event'])for(const r of added[table]){const parent=cases.get(r.caseId);assert(parent,'NEW_REMEDIATION_CHILD_MUST_HAVE_REAL_CASE');scopeMatches(r,caseProtocol(parent));}
 // Existing audit IDs are immutable; new auth logs may coexist with native business logs.
 // Root's manifest separately counts target business actions/receipts, never the global audit delta.
 return{passed:true,originalSciencePreserved:true,originalRowsPreserved:true,targetProtocolIds:before.targetProtocolIds,protectedNonTargetProtocols:before.protocols.length-targets.size,immutableCounts:Object.fromEntries(Object.entries(before.immutable).map(([k,v])=>[k,v.length])),addedCounts:Object.fromEntries(Object.entries(added).map(([k,v])=>[k,v.length])),newOperations:added['rh_research.operation'].map(o=>({...o,targetId:o.protocolId})),newAudits:added['public.audit_log'],newPolicies:added['public.study_execution_policy_version'],newChecks:added['public.protocol_release_check'],newFindings:added['public.protocol_release_check_finding'],newRemediationCases:added['public.remediation_case'],newRemediationAttempts:added['public.remediation_attempt'],newRemediationEvents:added['public.remediation_event'],businessOperationBudgetVerified:false,globalAuditDeltaIsBusinessCount:false,protectedRowsHash:bodyHash(before.immutable)};
}
