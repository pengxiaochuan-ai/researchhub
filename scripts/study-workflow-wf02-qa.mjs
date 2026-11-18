// Offline WF02 acceptance primitives. Importing performs no filesystem/HTTP/PG/browser I/O.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {bodyHash,json,save,sha,assertOldHashes} from './study-workflow-wf01-qa.mjs';

export {bodyHash,json,save,sha,assertOldHashes};
export const purpose='study-workflow-simplification-2026-11-17/wf02';
export const action='protocol.template.import';
export const expectedNativeStatus=200;
export const caseRoles={A:'admin',Bseed:'admin',B:'reviewer',D:'admin'};
export const steps={A:['preview','import','readback','reconcile','verify-ui'],Bseed:['preview','import','readback','reconcile','verify-ui'],B:['preview','import','readback','reconcile','verify-ui'],D:['preview','import-loss','recover','readback','reconcile','verify-ui']};
const digest=x=>assert.match(x??'',/^[a-f0-9]{64}$/,'OPAQUE_SHA256_REQUIRED');
const id=x=>assert(typeof x==='string'&&x.length>0&&x.length<=200,'REGISTERED_ID_REQUIRED');
const only=(value,keys,message)=>assert(value&&Object.keys(value).every(k=>keys.includes(k)),message);

export function requireWindow(env=process.env){
 assert.equal(env.STUDY_WORKFLOW_WF02_QA_WINDOW,'explicit','ROOT_WF02_IO_WINDOW_REQUIRED');
 assert.equal(env.VISIT_WORKFLOW_QA_WINDOW,'explicit','SHARED_HELPER_WINDOW_REQUIRED');
}
export function parseArgs(args,env=process.env){
 if(args.length===1&&args[0]==='--help')return{help:true};
 assert.equal(args[0],'--local-synthetic','SYNTHETIC_TARGET_REQUIRED');requireWindow(env);
 assert.equal(args[1],'--manifest','FROZEN_MANIFEST_REQUIRED');assert(args[2]?.startsWith('/'),'ABSOLUTE_MANIFEST_PATH_REQUIRED');
 if(args.length===4&&['--reconcile','--audit','--visual','--boundaries'].includes(args[3]))return{mode:args[3].slice(2),manifestPath:args[2]};
 assert.equal(args.length,7,'USE_ONE_CASE_AND_ONE_STEP');assert.equal(args[3],'--case');assert.equal(args[5],'--step');
 const code=args[4],step=args[6];assert(steps[code]?.includes(step),'UNKNOWN_WF02_CASE_STEP');
 return{mode:'case',manifestPath:args[2],code,step};
}
export function validateManifest(m){
 only(m,['schema','purpose','syntheticOnly','phase','state','approvedAt','tenantId','sources','cases','limits','protection'],'UNKNOWN_MANIFEST_FIELD');
 assert.equal(m.schema,1);assert.equal(m.purpose,purpose);assert.equal(m.syntheticOnly,true);assert.equal(m.state,'frozen','ROOT_MUST_FREEZE_MANIFEST');
 assert(Number.isFinite(Date.parse(m.approvedAt)),'ROOT_APPROVAL_TIMESTAMP_REQUIRED');id(m.tenantId);
 assert(m.sources&&Object.keys(m.sources).length>=1&&Object.keys(m.sources).length<=3,'BOUNDED_REGISTERED_SOURCES_REQUIRED');
 for(const [key,s]of Object.entries(m.sources)){
  id(key);only(s,['studyId','protocolId','versionNumber','revision','fingerprint','status','formVersionIds','outcomeDefinitionIds'],'SOURCE_BODY_MUST_NOT_BE_PERSISTED');
  id(s.studyId);id(s.protocolId);digest(s.fingerprint);digest(s.revision);assert(Number.isSafeInteger(s.versionNumber)&&s.versionNumber>=1);assert(['approved','executing'].includes(s.status));
  for(const list of [s.formVersionIds,s.outcomeDefinitionIds]){assert(Array.isArray(list));list.forEach(id);assert.equal(new Set(list).size,list.length,'DUPLICATE_SOURCE_VERSION');}
 }
 assert(['primary','reviewer-reuse'].includes(m.phase),'FROZEN_PHASE_REQUIRED');
 const codes=Object.keys(m.cases??{}).sort();
 if(m.phase==='primary')assert(['A,B,D','A,Bseed,D'].includes(codes.join(',')),'PRIMARY_HAS_THREE_REGISTERED_CASES');
 else assert.deepEqual(codes,['B']);
 const targetStudies=new Set();
 for(const [code,c]of Object.entries(m.cases)){
  only(c,['role','actorId','authVersion','studyId','executionProjectId','sourceId','targetFingerprint'],'CASE_BODY_MUST_NOT_BE_PERSISTED');
  assert.equal(c.role,caseRoles[code]);id(c.actorId);assert(Number.isInteger(c.authVersion)&&c.authVersion>=0,'AUTH_VERSION_ZERO_IS_VALID');
  id(c.studyId);id(c.executionProjectId);digest(c.targetFingerprint);assert(m.sources[c.sourceId],'REGISTERED_SOURCE_REQUIRED');
  if(m.phase==='primary')assert.notEqual(c.studyId,m.sources[c.sourceId].studyId,'PRIMARY_SOURCE_AND_TARGET_MUST_DIFFER');
  else assert.equal(c.studyId,m.sources[c.sourceId].studyId,'REVIEWER_REUSES_APPROVED_SOURCE_IN_OWN_B');
  targetStudies.add(c.studyId);
 }
 assert.equal(targetStudies.size,m.phase==='primary'?3:1,'REUSE_REGISTERED_WF01_STUDIES');
 assert.deepEqual(m.limits,{importSuccesses:m.phase==='primary'?3:1,newStudies:0,newSubjects:0,newAnswers:0,newAccounts:0,newRoles:0,newPolicies:0,newLicenses:0,newApplicability:0});
 only(m.protection,['baselinePath','wf01BaselinePath'],'PROTECTION_PATHS_ONLY');
 for(const p of Object.values(m.protection))assert(typeof p==='string'&&p.startsWith('/'),'ABSOLUTE_PROTECTION_BASELINE_REQUIRED');
 assert.equal(Object.keys(m.protection).length,2);return m;
}
// Root supplies real preview fingerprints only after its target window. Public resources contain no body/credentials.
export function manifestFromResources(resource,reviewerSource,{admin,previews,protection,approvedAt}){
 assert.equal(resource.readOnly,true);assert.equal(resource.writes,0);assert.equal(reviewerSource.readOnly,true);assert.equal(reviewerSource.writes,0);
 assert.equal(resource.source.fixedReady,true);assert.equal(reviewerSource.fixedReady,true);
 assert.equal(reviewerSource.actorId,resource.reviewer.actorId);assert.equal(reviewerSource.canConfigure,true);
 assert.equal(previews.A.sourceFingerprint,previews.D.sourceFingerprint,'SAME_FIXED_SOURCE_MUST_HAVE_SAME_FINGERPRINT');
 const source=(s,fingerprint)=>Object.fromEntries(['studyId','protocolId','versionNumber','revision','status','formVersionIds','outcomeDefinitionIds'].map(k=>[k,s[k]]).concat([['fingerprint',fingerprint]]));
 const m={schema:1,purpose,syntheticOnly:true,phase:'primary',state:'frozen',approvedAt,tenantId:resource.tenantId,
  sources:{real:source(resource.source,previews.A.sourceFingerprint),qa:source(reviewerSource,previews.B.sourceFingerprint)},
  cases:Object.fromEntries(['A','B','D'].map(code=>{const t=resource.targets[code];assert.equal(t.protocolCount,0);assert.equal(t.canConfigure,true);return[code,{role:caseRoles[code],actorId:code==='B'?resource.reviewer.actorId:admin.actorId,authVersion:code==='B'?resource.reviewer.authVersion:admin.authVersion,studyId:t.id,executionProjectId:t.executionProjectId,sourceId:code==='B'?'qa':'real',targetFingerprint:previews[code].targetFingerprint}];})),
  limits:{importSuccesses:3,newStudies:0,newSubjects:0,newAnswers:0,newAccounts:0,newRoles:0,newPolicies:0,newLicenses:0,newApplicability:0},protection};
 return validateManifest(m);
}
export const mutationAction=(method,path)=>method==='POST'&&/^\/api\/research-studies\/[^/]+\/protocol-template-imports$/.test(path)?action:null;
export const knownRejected=request=>request.nativeStatus>=400&&request.nativeStatus<500;
export const receiptCandidate=request=>request.dispatched&&!knownRejected(request);
export function assertImportBody(body,m,code){
 const c=m.cases[code],s=m.sources[c.sourceId];
 only(body,['requestKey','sourceStudyId','sourceProtocolId','sourceFingerprint','targetFingerprint'],'STRICT_IMPORT_BODY_REQUIRED');
 assert.equal(Object.keys(body).length,5);id(body.requestKey);assert.equal(body.sourceStudyId,s.studyId);assert.equal(body.sourceProtocolId,s.protocolId);
 assert.equal(body.sourceFingerprint,s.fingerprint);assert.equal(body.targetFingerprint,c.targetFingerprint);return true;
}
export function requestMetadata({method,path,body,actorId,authVersion},m,code){
 const c=m.cases[code];assert(c,'REGISTERED_CASE_REQUIRED');assert.equal(mutationAction(method,path),action);
 assert.equal(path,'/api/research-studies/'+encodeURIComponent(c.studyId)+'/protocol-template-imports');
 assert.equal(actorId,c.actorId);assert.equal(authVersion,c.authVersion);assertImportBody(body,m,code);
 return{method,path,action,requestKey:body.requestKey,requestHash:bodyHash(body),actorId,authVersion,studyId:c.studyId,
  sourceStudyId:body.sourceStudyId,sourceProtocolId:body.sourceProtocolId,sourceFingerprint:body.sourceFingerprint,targetFingerprint:body.targetFingerprint,
  sourceRevision:m.sources[c.sourceId].revision,sourceVersionNumber:m.sources[c.sourceId].versionNumber,
  sourceFormVersionIds:[...m.sources[c.sourceId].formVersionIds],sourceOutcomeDefinitionIds:[...m.sources[c.sourceId].outcomeDefinitionIds]};
}
export function receiptPath(request){
 id(request.studyId);id(request.requestKey);digest(request.requestHash);
 return'/api/research-studies/'+encodeURIComponent(request.studyId)+'/protocol-template-imports/receipts/'+encodeURIComponent(request.requestKey)+'?'+new URLSearchParams({requestHash:request.requestHash});
}
export function verifyReceipt(request,out,{actorId,authVersion}){
 assert.equal(out?.found,true,'ORIGINAL_RECEIPT_UNRESOLVED_NO_REPLAY');
 assert.equal(actorId,request.actorId);assert.equal(authVersion,request.authVersion);
 const r=out.receipt,p=out.protocol,o=out.origin;assert(r&&p&&o,'NATIVE_IMPORT_RESULT_REQUIRED');
 for(const k of ['requestKey','action','requestHash','authVersion','studyId','sourceStudyId','sourceProtocolId','sourceFingerprint','targetFingerprint'])assert.equal(r[k],request[k],k+'_RECEIPT_MISMATCH');
 id(r.id);id(p.id);assert.equal(r.targetId,p.id);assert.notEqual(p.id,request.sourceProtocolId);assert.equal(p.status,'draft','TEMPLATE_IMPORT_MUST_CREATE_DRAFT');
 for(const k of ['sourceStudyId','sourceProtocolId','sourceFingerprint','targetFingerprint','sourceRevision','sourceVersionNumber'])assert.equal(o[k],request[k],k+'_ORIGIN_MISMATCH');
 assert(Array.isArray(o.forms)&&Array.isArray(o.outcomes),'COPY_REUSE_MAPPING_REQUIRED');
 const mapping=(rows,sourceKey,targetKey,expected)=>{
  for(const row of rows){only(row,[sourceKey,targetKey,'reused'],'MAPPING_IDS_ONLY');id(row[sourceKey]);id(row[targetKey]);assert.equal(typeof row.reused,'boolean');}
  assert.deepEqual(rows.map(r=>r[sourceKey]).sort(),[...expected].sort(),'FIXED_SOURCE_VERSIONS_MUST_NOT_BE_DROPPED');
  return rows.map(r=>({[sourceKey]:r[sourceKey],[targetKey]:r[targetKey],reused:r.reused}));
 };
 const forms=mapping(o.forms,'sourceVersionId','targetVersionId',request.sourceFormVersionIds);
 const outcomes=mapping(o.outcomes,'sourceOutcomeId','targetOutcomeId',request.sourceOutcomeDefinitionIds);
 return{protocolId:p.id,status:p.status,receiptId:r.id,origin:{sourceStudyId:o.sourceStudyId,sourceProtocolId:o.sourceProtocolId,
  sourceFingerprint:o.sourceFingerprint,targetFingerprint:o.targetFingerprint,sourceRevision:o.sourceRevision,sourceVersionNumber:o.sourceVersionNumber,forms,outcomes}};
}
export function mayExecuteStep(step){
 if(!step)return true;if(step.status==='verified')return false;
 assert(!(step.requests??[]).some(receiptCandidate),'NATIVE_WRITE_ALREADY_DISPATCHED_RECONCILE_ONLY');return true;
}
export function createJournal(path,manifest){
 validateManifest(manifest);const manifestHash=bodyHash(manifest);
 const journal=existsSync(path)?json(path):{schema:1,purpose,syntheticOnly:true,manifestHash,createdAt:new Date().toISOString(),steps:{}};
 assert.equal(journal.schema,1);assert.equal(journal.purpose,purpose);assert.equal(journal.syntheticOnly,true);assert.equal(journal.manifestHash,manifestHash,'FROZEN_MANIFEST_CHANGED');
 const persist=()=>save(path,journal);
 const event=(step,state,extra={})=>{assert.equal(journal.steps[step.id],step,'OWNED_CHECKPOINT_REQUIRED');step.events.push({at:new Date().toISOString(),state,...extra});persist();};
 return{journal,persist,event,
  begin(code,name){
   assert(steps[code]?.includes(name),'UNKNOWN_WF02_CASE_STEP');assert(manifest.cases[code],'CASE_NOT_IN_FROZEN_PHASE');const key=code+'.'+name,existing=journal.steps[key];
   if(!mayExecuteStep(existing))return existing;
   const step=existing??{id:key,code,name,status:'intent',requests:[],events:[]};journal.steps[key]=step;persist();return step;
  },
  beforeRequest(step,input){
   assert.notEqual(step.status,'verified','VERIFIED_STEP_MUST_NOT_REPLAY');
   assert.equal(journal.steps[step.id],step,'OWNED_CHECKPOINT_REQUIRED');
   assert(['import','import-loss'].includes(step.name),'READONLY_STEP_MUST_NOT_DISPATCH');
   assert(!Object.values(journal.steps).flatMap(s=>s.requests).some(r=>receiptCandidate(r)&&!r.proof),'UNRESOLVED_NATIVE_WRITE_RECONCILE_ONLY');
   assert(!step.requests.some(receiptCandidate),'ONE_ORIGINAL_IMPORT_ONLY_RECONCILE_FIRST');
   assert(!Object.values(journal.steps).flatMap(s=>s.requests).some(r=>r.studyId===manifest.cases[step.code].studyId&&receiptCandidate(r)),'TARGET_ALREADY_DISPATCHED_RECONCILE_ONLY');
   const confirmed=Object.values(journal.steps).flatMap(s=>s.requests).filter(r=>r.nativeStatus===200||r.proof);
   assert(confirmed.length<manifest.limits.importSuccesses,'FROZEN_PHASE_SUCCESSFUL_IMPORT_LIMIT');
   const request={...requestMetadata(input,manifest,step.code),at:new Date().toISOString(),dispatched:true};
   if(step.requests.length){assert.equal(request.requestKey,step.requests[0].requestKey,'RETRY_MUST_USE_ORIGINAL_KEY');assert.equal(request.requestHash,step.requests[0].requestHash,'RETRY_MUST_KEEP_ORIGINAL_INTENT');}
   step.requests.push(request);event(step,'before-native-dispatch',{requestKey:request.requestKey,requestHash:request.requestHash});return request;
  },
  responded(step,request,status){
   assert(step.requests.includes(request));assert(Number.isInteger(status));request.nativeStatus=status;
   request.state=status===expectedNativeStatus?'native-accepted':knownRejected(request)?'rejected':'unknown';
   event(step,request.state,{requestKey:request.requestKey,status});return request.state;
  },
  confirmed(step,request,out,actor){
   assert(step.requests.includes(request));request.proof=verifyReceipt(request,out,actor);request.receiptConfirmedAt=new Date().toISOString();
   event(step,'receipt-confirmed',{requestKey:request.requestKey,protocolId:request.proof.protocolId});return request.proof;
  },
  verified(step){
   assert(step.requests.every(r=>knownRejected(r)||r.proof),'NATIVE_ACCEPTED_IS_NOT_UI_VERIFIED');
   step.status='verified';step.verifiedAt=new Date().toISOString();event(step,'ui-verified');
  }
 };
}
