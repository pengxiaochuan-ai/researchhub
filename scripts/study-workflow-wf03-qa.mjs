// Pure WF03 QA evidence guards, not product session logic. Importing performs no filesystem/network/PG/browser I/O.
// Receipt/marker DTO and DOM adapters intentionally wait for the implementer's final contract.
import assert from 'node:assert/strict';
import {bodyHash} from './study-workflow-wf01-qa.mjs';
export {bodyHash};
export const purpose='study-workflow-simplification-2026-11-17/wf03';
const digest=v=>assert.match(v??'',/^[a-f0-9]{64}$/,'OPAQUE_DIGEST_REQUIRED');
const id=v=>assert(typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v),'OPAQUE_ID_REQUIRED');
export function requireWF03Window(env=process.env){assert.equal(env.STUDY_WORKFLOW_WF03_QA_WINDOW,'explicit','ROOT_WF03_IO_WINDOW_REQUIRED');assert.equal(env.VISIT_WORKFLOW_QA_WINDOW,'explicit','SHARED_HELPER_WINDOW_REQUIRED');}
export function atomicEvidence(action,body,binding,{mode='strict'}={}){
 assert(['check','submit','approve','activate'].includes(action));assert(['strict','legacy'].includes(mode),'EXPLICIT_QA_EVIDENCE_MODE_REQUIRED');
 const submission=['check','submit'].includes(action);assert(mode==='strict'||submission,'LEGACY_MODE_ONLY_FOR_OLD_CHECK_SUBMIT');
 const policyBound=action==='approve'||submission&&mode==='strict';
 const keys=['requestKey','expectedRevision',...(policyBound?['policyVersionId','expectedPolicyHash']:action==='activate'?['migrateExisting']:[])];
 assert.deepEqual(Object.keys(body).sort(),keys.sort(),'STRICT_NATIVE_BODY_REQUIRED');id(body.requestKey);digest(body.expectedRevision);
 for(const k of ['actorId','studyId','protocolId'])id(binding[k]);assert(Number.isInteger(binding.authVersion)&&binding.authVersion>=0,'AUTH_VERSION_ZERO_IS_VALID');
 if(policyBound){id(body.policyVersionId);digest(body.expectedPolicyHash);}else if(action==='activate')assert.equal(body.migrateExisting,false,'NO_HISTORICAL_MIGRATION');
 // evidenceMode is QA metadata, not a guessed product marker/receipt DTO field.
 return{action,evidenceMode:mode,...Object.fromEntries(['actorId','authVersion','studyId','protocolId'].map(k=>[k,binding[k]])),requestKey:body.requestKey,requestHash:bodyHash(body),expectedRevision:body.expectedRevision,...(policyBound?{policyVersionId:body.policyVersionId,policyHash:body.expectedPolicyHash}:action==='activate'?{migrateExisting:false}:{})};
}
export function assertOriginalAtomicRetry(original,retry){
 for(const key of ['action','evidenceMode','actorId','authVersion','studyId','protocolId','requestKey','requestHash','expectedRevision','policyVersionId','policyHash','migrateExisting'])assert.equal(retry[key],original[key],'RETRY_MUST_KEEP_ORIGINAL_ATOMIC_INTENT');return true;
}
export function classifyEvidence({kind,status,found,strictBindingVerified=false,evidenceMode}){
 assert(['command','receipt'].includes(kind));
 if(evidenceMode!==undefined)assert(['strict','legacy'].includes(evidenceMode));
 if(kind==='receipt')return status===200&&found===true&&strictBindingVerified&&evidenceMode==='strict'?'strict-confirmed':'unknown';
 if(status===200)return'native-accepted';if(status>=400&&status<500)return'definite-rejection';return'unknown';
}
export function preservePriorUnknown(original,retry){
 assertOpaqueQAEvidence(original);assertOpaqueQAEvidence(retry);assertOriginalAtomicRetry(original,retry);return original.everUnknown===true&&original.strictConfirmed!==true;
}
export function assertOpaqueQAEvidence(record){
 const allowed=['action','evidenceMode','actorId','authVersion','studyId','protocolId','requestKey','requestHash','expectedRevision','policyVersionId','policyHash','migrateExisting','phase','epoch','everUnknown','strictConfirmed','nativeStatus','operationId','transmission','responseDiscarded'];
 assert(Object.keys(record).every(k=>allowed.includes(k)),'QA_EVIDENCE_MUST_NOT_PERSIST_POLICY_BODY_OR_REASON');
 for(const key of ['actorId','studyId','protocolId','requestKey'])id(record[key]);digest(record.requestHash);digest(record.expectedRevision);assert(Number.isInteger(record.authVersion)&&record.authVersion>=0);
 assert(['check','submit','approve','activate'].includes(record.action));assert(['strict','legacy'].includes(record.evidenceMode),'EXPLICIT_QA_EVIDENCE_MODE_REQUIRED');
 if(record.evidenceMode==='legacy'){assert(['check','submit'].includes(record.action));assert.equal(record.policyVersionId,undefined);assert.equal(record.policyHash,undefined);assert.notEqual(record.strictConfirmed,true,'LEGACY_CANNOT_BECOME_NEW_STRICT_PROOF');}
 else if(['check','submit','approve'].includes(record.action)){id(record.policyVersionId);digest(record.policyHash);}
 if(record.action==='activate')assert.equal(record.migrateExisting,false);
 if(record.nativeStatus!==undefined)assert(Number.isInteger(record.nativeStatus)&&record.nativeStatus>=100&&record.nativeStatus<=599,'ACTUAL_NATIVE_STATUS_REQUIRED');if(record.operationId!==undefined)id(record.operationId);return true;
}
export function assertAttemptAndSuccessBudget(attempts,{approve=3,activate=3}={}){
 const accepted=new Map(),counts={approve:new Set(),activate:new Set()};
 for(const a of attempts){
  assertOpaqueQAEvidence(a);assert(['approve','activate'].includes(a.action),'APPROVAL_ACTIVATION_ATTEMPTS_ONLY');assert(['forwarded','intercepted-before-native'].includes(a.transmission),'TRANSPORT_EVIDENCE_REQUIRED');
  const key=a.studyId+':'+a.protocolId+':'+a.action;assert(!accepted.has(key),'SUCCESSFUL_NATIVE_STEP_MUST_NOT_REPLAY');
  if(a.transmission==='intercepted-before-native'){assert.equal(a.nativeStatus,undefined,'SIMULATED_NETWORK_FAILURE_IS_NOT_NATIVE_STATUS');assert.equal(a.operationId,undefined,'SIMULATED_FAILURE_HAS_NO_NATIVE_OPERATION');continue;}
  if(a.responseDiscarded)assert.equal(a.nativeStatus,200,'DISCARD_ONLY_AFTER_ACTUAL_NATIVE_200');
  if(a.nativeStatus===200){id(a.operationId);accepted.set(key,a.operationId);counts[a.action].add(a.operationId);}
 }
 assert(counts.approve.size<=approve&&counts.activate.size<=activate,'FROZEN_NATIVE_TRANSITION_BUDGET_EXCEEDED');return{approve:counts.approve.size,activate:counts.activate.size};
}
// Caller normalizes actual persisted rh_research.operation rows; transport simulations are not operations.
export function assertWorkflowOperationBudget(operations,targetProtocolIds,{policy=3,check=3,submit=3,approve=3,activate=3}={}){
 const limits={policy,check,submit,approve,activate},targets=new Set(targetProtocolIds),seen=new Map(),counts={policy:0,check:0,submit:0,approve:0,activate:0};
 for(const limit of Object.values(limits))assert(Number.isInteger(limit)&&limit>=0&&limit<=3,'WF03_PER_ACTION_LIMIT_CANNOT_EXPAND');
 for(const o of operations){id(o.id);id(o.targetId);assert(targets.has(o.targetId),'WF03_OPERATION_TARGET_NOT_FROZEN');id(o.requestKey);digest(o.requestHash);const kind=o.action==='protocol.policy.save'?'policy':o.action?.startsWith('protocol.')?o.action.slice(9):null;assert(Object.hasOwn(counts,kind),'WF03_UNEXPECTED_SUCCESSFUL_OPERATION');
  if(seen.has(o.id)){assert.equal(bodyHash(seen.get(o.id)),bodyHash(o),'SAME_OPERATION_ID_MUST_KEEP_EXACT_EVIDENCE');continue;}seen.set(o.id,o);counts[kind]++;assert(counts[kind]<=limits[kind],'FROZEN_WORKFLOW_OPERATION_BUDGET_EXCEEDED');
 }
 const total=Object.values(counts).reduce((n,x)=>n+x,0);assert(total<=15,'WF03_FIFTEEN_OPERATION_LIMIT');return{...counts,total};
}
export const qaReleaseMutableColumns=Object.freeze(['status','approvedBy','lockedAt','approvedPolicyVersionId','approvedPolicyHash','effectiveFrom','effectiveTo','supersededById','updatedAt']);
const normalized=row=>JSON.parse(JSON.stringify(row));
export function stableProtocolHash(row,{target=false}={}){
 // Preservation whitelist only. Root separately asserts effectiveTo/supersededById remain null
 // for these three targets, which had no prior executing Protocol or subjects.
 assert(!Object.hasOwn(row,'revision'),'RAW_DB_PROTOCOL_ROWS_REQUIRED');const value=normalized(row);if(target)for(const key of qaReleaseMutableColumns)delete value[key];return bodyHash(value);
}
export function assertProtocolProtection(before,after,targetProtocolIds){
 const targets=new Set(targetProtocolIds),current=new Map(after.map(r=>[r.id,r]));assert.equal(current.size,after.length);assert.equal(after.length,before.length,'WF03_MUST_NOT_CREATE_PROTOCOL');
 for(const original of before){const row=current.get(original.id);assert(row,'ORIGINAL_PROTOCOL_ID_MISSING');const target=targets.has(original.id);
  if(target)assert(['draft','pending_review','approved','executing'].includes(row.status),'UNEXPECTED_TARGET_PROTOCOL_STATE');
  assert.equal(stableProtocolHash(row,{target}),stableProtocolHash(original,{target}),'PROTOCOL_SCIENCE_OR_UNRELATED_ROW_CHANGED');
 }
 return true;
}
