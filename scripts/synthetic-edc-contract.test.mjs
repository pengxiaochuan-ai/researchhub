import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {syntheticEdcConfig} from '../tests/fixtures/synthetic-edc.mjs';
import {normalizeSyntheticCaptureInput,classifySyntheticAnswers,assertSyntheticCollection,edcDigest} from './synthetic-edc-contract.mjs';

const require=createRequire(new URL('../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {normalizeAndValidateAnswers}=require('../../app/server/src/study-operations/study-forms-policy.ts');
const input=()=>({parentRootVersionNo:3,preparationRevisionNo:1,visitKeys:['baseline','followup'],subjectCount:3});
const value=v=>({state:'value',value:v});
const classify=answers=>classifySyntheticAnswers(syntheticEdcConfig(),answers,normalizeAndValidateAnswers);

test('capture_capacity_and_binding: only saved visits and 3–5 synthetic subjects',()=>{
 assert.equal(normalizeSyntheticCaptureInput(syntheticEdcConfig(),input()).subjectCount,3);
 assert.equal(normalizeSyntheticCaptureInput(syntheticEdcConfig(),{...input(),subjectCount:5}).subjectCount,5);
 for(const subjectCount of [2,6,3.5,'3'])assert.throws(()=>normalizeSyntheticCaptureInput(syntheticEdcConfig(),{...input(),subjectCount}));
 for(const visitKeys of [['baseline','baseline'],['baseline','unknown'],['baseline']])assert.throws(()=>normalizeSyntheticCaptureInput(syntheticEdcConfig(),{...input(),visitKeys}));
 assert.throws(()=>normalizeSyntheticCaptureInput(syntheticEdcConfig(),{...input(),ownerAccountId:'other'}));
});
test('capture rejects empty and oversized CRF rather than declaring it ready',()=>{
 for(const count of [0,13]){const c=syntheticEdcConfig();c.form.schema.fields=Array.from({length:count},(_,i)=>({key:'field'+i,label:'合成字段',type:'text',required:false}));c.mappings=[];assert.throws(()=>normalizeSyntheticCaptureInput(c,input()));}
 const c=syntheticEdcConfig();c.form.schema.fields=Array.from({length:12},(_,i)=>({key:'field'+i,label:'合成字段',type:'text',required:false}));c.mappings=[];assert.equal(normalizeSyntheticCaptureInput(c,input()).subjectCount,3);
});
test('answers_zero_false_and_explicit_missing retain distinct values',()=>{
 const r=classify({value:value(0),flag:value(false),choice:{state:'not_measured'}});
 assert.deepEqual(r.answers,{value:value(0),flag:value(false),choice:{state:'not_measured'},note:{state:'missing'}});
 assert.deepEqual(r.findings,[]);
});
test('required missing and not_applicable do not become valid zero or exemptions',()=>{
 const r=classify({value:{state:'not_applicable'}});
 assert.deepEqual(r.findings.map(x=>[x.ruleKey,x.fieldKey]),[['D01','value'],['D01','flag']]);
 assert.equal(r.answers.value.state,'not_applicable');
});
test('out_of_range_value_is_preserved_and_flagged without changing old validator',()=>{
 assert.throws(()=>normalizeAndValidateAnswers(syntheticEdcConfig().form.schema,{value:11}),/OUT_OF_RANGE/);
 const r=classify({value:value(11),flag:value(false)});
 assert.equal(r.answers.value.value,11);assert.deepEqual(r.findings.map(x=>[x.ruleKey,x.fieldKey]),[['D02','value']]);
});
for(const bad of ['11',null,NaN,Infinity,{},[]])test('invalid_type_is_not_soft_range: '+String(bad),()=>assert.throws(()=>classify({value:value(bad)})));
for(const bad of [{value:value(' ')},{flag:value('false')},{choice:value('unknown')},{extra:value(1)},{note:{state:'missing',value:'hidden'}},{value:{state:'value'}},{value:{state:'unknown'}},{note:value('x'.repeat(501))}])test('reject malformed answer '+JSON.stringify(bad).slice(0,75),()=>assert.throws(()=>classify(bad)));
test('classification does not mutate user answers or the configured range',()=>{
 const c=syntheticEdcConfig(),answers={value:value(-1),flag:value(true)},before=JSON.stringify({c,answers});
 classifySyntheticAnswers(c,answers,normalizeAndValidateAnswers);assert.equal(JSON.stringify({c,answers}),before);
});
test('persisted collection contract rejects unknown fields even with a newly computed seal',()=>{
 const config=syntheticEdcConfig(),subjects=Array.from({length:3},(_,i)=>({key:'SIM_0'+(i+1),label:'合成被试 '+(i+1)})),records=subjects.flatMap(s=>['baseline','followup'].map(visitKey=>({recordId:s.key+visitKey,syntheticSubjectKey:s.key,visitKey,formKey:'crf',status:'draft',responseRevision:0,answers:classify({}).answers,updatedBy:'owner',updatedAt:'now',recordedBy:null,recordedAt:null})));
 const unsigned={type:'rh-synthetic-edc.v1',schemaVersion:1,purpose:'synthetic_capture_rehearsal',ownerAccountId:'owner',binding:{planId:'plan',parentRootVersionNo:3,preparationRevisionNo:1,configHash:edcDigest(config),picoConfirmationHash:'pico',sourcesHash:'sources',basis:{},ownerAccountId:'owner',tenantId:'tenant',studyGroupId:'group',researchProjectId:'study',sessionId:'session',kbId:'kb'},config,selectedVisitKeys:['baseline','followup'],subjects,records,dataRevision:0,quality:null,pending:null,operations:[]},sealed=b=>({...b,seal:edcDigest(b)});
 assertSyntheticCollection(sealed(unsigned),normalizeAndValidateAnswers);assert.throws(()=>assertSyntheticCollection(sealed({...unsigned,unexpected:true}),normalizeAndValidateAnswers));assert.throws(()=>assertSyntheticCollection(sealed({...unsigned,binding:{...unsigned.binding,foreign:true}}),normalizeAndValidateAnswers));assert.throws(()=>assertSyntheticCollection(sealed({...unsigned,records:[...records.slice(1),records[1]]}),normalizeAndValidateAnswers));
});
