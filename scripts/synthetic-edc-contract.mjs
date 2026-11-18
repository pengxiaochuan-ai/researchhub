// Synthetic capture only. Never invokes formal assignment, submission or scoring.
import assert from 'node:assert/strict';
import {normalizePreparationConfig,preparationDigest} from './research-execution-preparation-contract.mjs';

export const EDC_MARKER='rh-synthetic-edc.v1';
export const edcDigest=preparationDigest;
const check=(value,code='EDC_INPUT_INVALID')=>assert.ok(value,code);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export function exactEdcFields(v,keys){check(plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));}
const positive=v=>Number.isSafeInteger(v)&&v>0;

/** @returns {{parentRootVersionNo:number,preparationRevisionNo:number,visitKeys:string[],subjectCount:number}} */
export function normalizeSyntheticCaptureInput(config,input){
 const c=normalizePreparationConfig(config);exactEdcFields(input,['parentRootVersionNo','preparationRevisionNo','visitKeys','subjectCount']);
 check(positive(input.parentRootVersionNo)&&positive(input.preparationRevisionNo));
 check(Number.isInteger(input.subjectCount)&&input.subjectCount>=3&&input.subjectCount<=5);
 check(Array.isArray(input.visitKeys)&&input.visitKeys.length===2&&new Set(input.visitKeys).size===2&&input.visitKeys.every(k=>c.visits.some(v=>v.key===k)));
 check(c.form.schema.fields.length>=1&&c.form.schema.fields.length<=12);
 return{...input,visitKeys:[...input.visitKeys]};
}

/** Strict types are hard errors; finite range errors are retained as synthetic DQ facts. */
export function classifySyntheticAnswers(config,input,validate){
 const c=normalizePreparationConfig(config),fields=c.form.schema.fields;
 check(plain(input)&&typeof validate==='function'&&Object.keys(input).every(k=>fields.some(f=>f.key===k)));
 const answers={},findings=[];
 for(const field of fields){
  const entry=Object.hasOwn(input,field.key)?input[field.key]:{state:'missing'};
  check(plain(entry));
  if(entry.state!=='value'){
   exactEdcFields(entry,['state']);check(['missing','not_measured','not_applicable'].includes(entry.state));
   answers[field.key]={state:entry.state};
   if(field.required)findings.push({ruleKey:'D01',fieldKey:field.key,code:'REQUIRED_MISSING'});
   continue;
  }
  exactEdcFields(entry,['state','value']);
  check(entry.value!==null&&entry.value!==undefined&&!(typeof entry.value==='string'&&!entry.value.trim()),'EDC_EMPTY_VALUE');
  if(field.type==='text')check(typeof entry.value==='string'&&entry.value.length<=500);
  const typed={...field};delete typed.min;delete typed.max;
  try{validate({schemaVersion:'form-schema.v1',fields:[typed]},{[field.key]:entry.value});}catch(e){e.edcFieldKey=field.key;throw e;}
  try{validate({schemaVersion:'form-schema.v1',fields:[field]},{[field.key]:entry.value});}
  catch(e){if(e.message!=='FORM_ANSWER_OUT_OF_RANGE')throw e;findings.push({ruleKey:'D02',fieldKey:field.key,code:e.message});}
  answers[field.key]={state:'value',value:entry.value};
 }
 return{answers,findings};
}

export function syntheticRecordValidation(config,record,validate){
 const {findings}=classifySyntheticAnswers(config,record.answers,validate);
 return{findings,findingsHash:edcDigest({recordId:record.recordId,responseRevision:record.responseRevision,findings})};
}
export function applySyntheticDraft(block,recordId,input,accountId,at,validate){
 exactEdcFields(input,['baseResponseRevision','answers']);const record=block.records.find(r=>r.recordId===recordId);check(record,'EDC_RECORD_NOT_FOUND');
 check(record.status==='draft','EDC_RECORD_STATE');check(record.responseRevision===input.baseResponseRevision,'EDC_RESPONSE_CONFLICT');
 const {answers}=classifySyntheticAnswers(block.config,input.answers,validate);if(edcDigest(answers)===edcDigest(record.answers))return structuredClone(block);
 return{...structuredClone(block),dataRevision:block.dataRevision+1,records:block.records.map(r=>r!==record?r:{...r,answers,responseRevision:r.responseRevision+1,updatedBy:accountId,updatedAt:at})};
}
export function completeSyntheticRecord(block,recordId,input,accountId,at,validate){
 exactEdcFields(input,['baseResponseRevision','acknowledgeFindingsHash']);const r=block.records.find(r=>r.recordId===recordId);check(r,'EDC_RECORD_NOT_FOUND');check(r.status==='draft','EDC_RECORD_STATE');check(r.responseRevision===input.baseResponseRevision,'EDC_RESPONSE_CONFLICT');
 check(input.acknowledgeFindingsHash===syntheticRecordValidation(block.config,r,validate).findingsHash,'EDC_ACK_REQUIRED');
 return{...structuredClone(block),dataRevision:block.dataRevision+1,records:block.records.map(v=>v!==r?v:{...v,status:'recorded',responseRevision:v.responseRevision+1,updatedBy:accountId,updatedAt:at,recordedBy:accountId,recordedAt:at})};
}
export function correctSyntheticRecord(block,recordId,input,accountId,at,validate){
 exactEdcFields(input,['baseResponseRevision','answers','reason']);const r=block.records.find(r=>r.recordId===recordId);check(r,'EDC_RECORD_NOT_FOUND');check(r.status==='recorded','EDC_RECORD_STATE');check(r.responseRevision===input.baseResponseRevision,'EDC_RESPONSE_CONFLICT');
 check(typeof input.reason==='string'&&input.reason.trim().length>=8&&input.reason.trim().length<=500,'EDC_REASON_INVALID');const {answers}=classifySyntheticAnswers(block.config,input.answers,validate);
 const changes=block.config.form.schema.fields.filter(f=>edcDigest(r.answers[f.key])!==edcDigest(answers[f.key])).map(f=>({fieldKey:f.key,before:r.answers[f.key],after:answers[f.key]}));if(!changes.length)return structuredClone(block);
 return{...structuredClone(block),dataRevision:block.dataRevision+1,records:block.records.map(v=>v!==r?v:{...v,answers,responseRevision:v.responseRevision+1,updatedBy:accountId,updatedAt:at}),lastChange:{recordId,changes,reason:input.reason.trim(),author:accountId,at}};
}
export const EDC_RULES='synthetic-crf-dq.v1';
export function syntheticDataBasis(block){
 const configHash=edcDigest(block.config),records=block.records.map(r=>({recordId:r.recordId,syntheticSubjectKey:r.syntheticSubjectKey,visitKey:r.visitKey,formKey:r.formKey,responseRevision:r.responseRevision,status:r.status,answers:r.answers})).sort((a,b)=>a.recordId.localeCompare(b.recordId));
 return{dataRevision:block.dataRevision,configHash,dataHash:edcDigest({configHash,selectedVisitKeys:block.selectedVisitKeys??[],records})};
}
export function runSyntheticQuality(block,{id,accountId,at},validate){
 const findings=[];
 for(const r of [...block.records].sort((a,b)=>a.recordId.localeCompare(b.recordId))){
  const add=f=>{const location={recordId:r.recordId,subjectKey:r.syntheticSubjectKey,visitKey:r.visitKey,formKey:r.formKey,fieldKey:f.fieldKey};findings.push({findingId:'edcf_'+edcDigest({rulesVersion:EDC_RULES,ruleKey:f.ruleKey,...location}).slice(0,24),...location,...f});};
  for(const f of classifySyntheticAnswers(block.config,r.answers,validate).findings)add(f);
  if(r.status!=='recorded')add({ruleKey:'D03',fieldKey:null,code:'FORM_NOT_RECORDED'});
 }
 check(findings.length<=130,'EDC_QUALITY_CAPACITY');
 return{id,basis:syntheticDataBasis(block),rulesVersion:EDC_RULES,findings,findingsHash:edcDigest(findings),checkedRecordCount:block.records.length,recordedRecordCount:block.records.filter(r=>r.status==='recorded').length,createdBy:accountId,createdAt:at};
}
export function syntheticQualityCurrent(block){
 const q=block.quality;return!!q&&q.rulesVersion===EDC_RULES&&edcDigest(q.basis)===edcDigest(syntheticDataBasis(block))&&q.findingsHash===edcDigest(q.findings);
}
export function assertSyntheticCollection(b,validate){
 exactEdcFields(b,['type','schemaVersion','purpose','ownerAccountId','binding','config','selectedVisitKeys','subjects','records','dataRevision','quality','pending','operations','seal',...(Object.hasOwn(b,'lastChange')?['lastChange']:[])]);
 check(b.type===EDC_MARKER&&b.schemaVersion===1&&b.purpose==='synthetic_capture_rehearsal');check(Number.isSafeInteger(b.dataRevision)&&b.dataRevision>=0);
 exactEdcFields(b.binding,['planId','parentRootVersionNo','preparationRevisionNo','configHash','picoConfirmationHash','sourcesHash','basis','ownerAccountId','tenantId','studyGroupId','researchProjectId','sessionId','kbId']);
 check(Array.isArray(b.subjects)&&Array.isArray(b.records)&&Array.isArray(b.operations)&&b.operations.length<=128);
 normalizeSyntheticCaptureInput(b.config,{parentRootVersionNo:b.binding.parentRootVersionNo,preparationRevisionNo:b.binding.preparationRevisionNo,visitKeys:b.selectedVisitKeys,subjectCount:b.subjects.length});
 check(edcDigest(b.config)===b.binding.configHash&&b.ownerAccountId===b.binding.ownerAccountId&&b.records.length===b.subjects.length*2);
 const keys=new Set(),records=new Set(),pairs=new Set();for(const [i,s] of b.subjects.entries()){exactEdcFields(s,['key','label']);check(s.key==='SIM_'+String(i+1).padStart(2,'0')&&s.label==='合成被试 '+(i+1));keys.add(s.key);}
 for(const r of b.records){exactEdcFields(r,['recordId','syntheticSubjectKey','visitKey','formKey','status','responseRevision','answers','updatedBy','updatedAt','recordedBy','recordedAt']);check(typeof r.recordId==='string'&&!records.has(r.recordId));records.add(r.recordId);const pair=r.syntheticSubjectKey+':'+r.visitKey;check(keys.has(r.syntheticSubjectKey)&&b.selectedVisitKeys.includes(r.visitKey)&&r.formKey===b.config.form.key&&!pairs.has(pair));pairs.add(pair);check(['draft','recorded'].includes(r.status)&&Number.isSafeInteger(r.responseRevision)&&r.responseRevision>=0&&edcDigest(classifySyntheticAnswers(b.config,r.answers,validate).answers)===edcDigest(r.answers));}
 const unsigned={...b};delete unsigned.seal;check(b.seal===edcDigest(unsigned)&&Buffer.byteLength(JSON.stringify(b))<=262144,'EDC_CONTEXT_INVALID');return b;
}
