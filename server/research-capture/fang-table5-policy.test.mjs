import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {createResearchFormAdapter} from './form-core-adapter.mjs';
import {FANG_TABLE5_ALGORITHM,FANG_TABLE5_SOURCE_SHA256,FANG_TABLE5_ITEMS,scoreFangTable5} from './fang-table5-policy.mjs';

const schema={schemaVersion:'form-schema.v1',fields:[...FANG_TABLE5_ITEMS.map(item=>({key:item.key,label:item.label,type:'select',required:true,score:false,options:['present','absent','not_applicable','uncertain']})),...['tongue_category','pulse_category'].map(key=>({key,label:key,type:'select',required:true,score:false,options:['met','not_met','uncertain']}))]};
const confirmedPolicy={status:'confirmed',categoryMode:'explicit_reviewed_categories',pulseCooccurrence:'review_required',inapplicable:'incomplete_no_total',reviewedBy:'synthetic-reviewer',reviewedAt:'2026-11-13T00:00:00.000Z'};
const scoring={algorithm:FANG_TABLE5_ALGORITHM,sourceSha256:FANG_TABLE5_SOURCE_SHA256,projectPolicy:confirmedPolicy};
function answers(present=['main_distension_pain','main_depressed_emotion','secondary_globus','secondary_emotional_trigger','tongue_pale_red','tongue_thin_white_coating']){return {...Object.fromEntries(FANG_TABLE5_ITEMS.map(item=>[item.key,present.includes(item.key)?'present':'absent'])),tongue_category:'met',pulse_category:'not_met'};}

test('all twelve frozen labels, dimensions and final integer weights match the received table5 source',()=>{
 const source=JSON.parse(readFileSync(new URL('../../docs/planning/first-real-study-calibration-2026-11-13/core-forms/target-syndrome-fang2023-source-v1.json',import.meta.url),'utf8'));
 assert.equal(FANG_TABLE5_SOURCE_SHA256,source.source.sha256);
 assert.deepEqual(FANG_TABLE5_ITEMS.map(({key,label,dimension,presentScore})=>({key,label,dimension,presentScore})),source.items.map(item=>({key:item.key,label:item.label,dimension:item.dimension,presentScore:item.sourceChoices.find(c=>c.value===true).score})));
});
test('missing or pending fixed project policy never produces a complete total or diagnosis',()=>{
 for(const projectPolicy of [undefined,{status:'pending'}, {...confirmedPolicy,status:'pending'}, {...confirmedPolicy,reviewedBy:''},{...confirmedPolicy,reviewedAt:'not-a-date'},{...confirmedPolicy,categoryMode:undefined},{...confirmedPolicy,pulseCooccurrence:undefined},{...confirmedPolicy,inapplicable:undefined}]){
  const value=scoreFangTable5(schema,{...scoring,projectPolicy},answers());assert.equal(value.processingStatus,'awaiting_policy');assert.equal(value.complete,true);assert.equal(value.scoreComplete,false);assert.equal(value.total,null);assert.equal(value.diagnosis,null);assert.equal(value.classification,null);
 }
});
test('exact clinical threshold is >=20 AND both primary, at least one secondary, and an explicitly met category',()=>{
 const exact=scoreFangTable5(schema,scoring,answers());assert.equal(exact.total,20);assert.equal(exact.complete,true);assert.equal(exact.diagnosis,true);
 const below=scoreFangTable5(schema,scoring,answers(['main_distension_pain','main_depressed_emotion','secondary_globus','secondary_sighing','tongue_pale_red']));assert.equal(below.total,19);assert.equal(below.diagnosis,false);
 for(const missingCondition of ['primary','secondary','category']){
  let a=answers();
  if(missingCondition==='primary')a=answers(['main_distension_pain','secondary_irritability','secondary_sighing','secondary_globus','secondary_irregular_menses','tongue_pale_red']);
  if(missingCondition==='secondary')a={...answers(['main_distension_pain','main_depressed_emotion','tongue_pale_red','tongue_thin_white_coating','pulse_wiry']),pulse_category:'met'};
  if(missingCondition==='category')a={...a,tongue_category:'not_met',pulse_category:'not_met'};
  const value=scoreFangTable5(schema,scoring,a);assert(value.total>=20);assert.equal(value.complete,true);assert.equal(value.diagnosis,false,missingCondition);
 }
});
test('tongue and pulse category decisions are never inferred from item presence',()=>{
 const noCategory={...answers(),tongue_category:'not_met',pulse_category:'not_met'};
 assert.equal(scoreFangTable5(schema,scoring,noCategory).diagnosis,false);
 const pulseExplicit={...answers(),tongue_category:'not_met',pulse_category:'met'};
 assert.equal(scoreFangTable5(schema,scoring,pulseExplicit).diagnosis,true);
});
test('missing, uncertain and not-applicable remain unresolved for each source item',()=>{
 for(const item of FANG_TABLE5_ITEMS)for(const state of [null,undefined,'','uncertain','not_applicable']){
  const value=scoreFangTable5(schema,scoring,{...answers(),[item.key]:state});assert.equal(value.processingStatus,'incomplete_data');assert.equal(value.complete,['uncertain','not_applicable'].includes(state));assert.equal(value.scoreComplete,false);assert.equal(value.total,null);assert.equal(value.diagnosis,null);assert(value.unresolvedItems.some(x=>x.key===item.key));
 }
 for(const key of ['tongue_category','pulse_category'])for(const state of [null,undefined,'','uncertain'])assert.equal(scoreFangTable5(schema,scoring,{...answers(),[key]:state}).total,null);
});
test('both pulses present always require clinical correction, independent of declared category',()=>{
 const a={...answers(),pulse_wiry:'present',pulse_deep_wiry:'present',pulse_category:'met'};
 const value=scoreFangTable5(schema,scoring,a);assert.equal(value.processingStatus,'review_required');assert.equal(value.complete,true);assert.equal(value.scoreComplete,false);assert.equal(value.total,null);assert.equal(value.diagnosis,null);
 assert.equal(scoreFangTable5(schema,{...scoring,projectPolicy:{status:'pending'}},a).processingStatus,'awaiting_policy');
});
test('source identity, schema domains and answer codes fail closed rather than changing clinical rules',()=>{
 assert.throws(()=>scoreFangTable5(schema,{...scoring,sourceSha256:'wrong'},answers()),/FORM_SCORING_SOURCE_MISMATCH/);
 assert.throws(()=>scoreFangTable5({...schema,fields:schema.fields.slice(1)},scoring,answers()),/FORM_SCHEMA_TABLE5_INVALID/);
 for(const fields of [[...schema.fields,schema.fields[0]],schema.fields.map((field,i)=>i?field:{...field,key:'renamed'}),schema.fields.map((field,i)=>i?field:{...field,type:'integer'}),schema.fields.map((field,i)=>i?field:{...field,options:['present','absent']})])assert.throws(()=>scoreFangTable5({...schema,fields},scoring,answers()),/FORM_SCHEMA_TABLE5_INVALID/);
 for(const value of [true,4,'4','yes'])assert.throws(()=>scoreFangTable5(schema,scoring,{...answers(),main_distension_pain:value}),/FORM_ANSWER_INVALID_OPTION/);
 assert.throws(()=>scoreFangTable5(schema,scoring,{...answers(),projectPolicy:confirmedPolicy}),/FORM_ANSWER_UNKNOWN_FIELD/);
 const unchangeable=scoreFangTable5(schema,{...scoring,weights:{main_distension_pain:999},threshold:999},answers());assert.equal(unchangeable.total,20);assert.equal(unchangeable.diagnosis,true);
});
test('ResearchHub policy dispatch actually executes table5 while keeping generic numeric forms compatible',()=>{
 const adapter=createResearchFormAdapter(runtimeDependencies());
 const result=adapter.policy.scorePublishedFormResponse(schema,scoring,answers());assert.equal(result.algorithm,FANG_TABLE5_ALGORITHM);assert.equal(result.total,20);assert.equal(result.diagnosis,true);
 const numeric=adapter.policy.scorePublishedFormResponse({fields:[{key:'n',label:'合成数值',type:'integer',required:true,min:0,max:3}]},{algorithm:'numeric-sum-v1'},{n:0});assert.equal(numeric.total,0);
});
