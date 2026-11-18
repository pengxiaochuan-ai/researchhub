import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getSourceFormProfile} from './source-profiles.mjs';
import {createResearchFormAdapter} from './form-core-adapter.mjs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {listCaptureCandidates} from './forms.mjs';
import {parseCaptureCsv} from './import-csv.mjs';
import {importTemplate} from '../../src/capture-import-session.js';

const source=JSON.parse(readFileSync(new URL('../../docs/planning/real-study-full-simulation-2026-11-13/hamd-source/source-audit.json',import.meta.url),'utf8'));
const policy=createResearchFormAdapter(runtimeDependencies()).policy;
const profile=()=>getSourceFormProfile('hamd17-crf-simulation-v1');
const answers=()=>Object.fromEntries(source.items.map(item=>[item.key,0]));
const score=value=>{const p=profile();return policy.scorePublishedFormResponse(p.schema,p.scoring,value);};

test('HAMD simulation profile preserves all 17 source labels/anchors, one-week prompt, and distinct source assumptions',()=>{
 const p=profile();assert.equal(p.simulationOnly,true);assert.equal(p.source.sha256,'da9bbbe2da775cacaaab5825659d56566bef066c4d0834e07b5b4ea23719c968');assert.equal(p.source.authorScoringVerified,false);
 assert.equal(p.schema.presentation.instruction,source.instruction);assert.equal(p.schema.fields.length,17);assert.deepEqual(p.allowedCaptureModes,['researcher']);
 assert.equal(p.scoring.algorithm,'hamd17-simulation-sum-v1');assert.equal(p.scoring.sourceSha256,p.source.sha256);assert.equal(p.scoring.simulationPolicy,'ordinary17-sum-special9-or-missing-no-total-v1');
 assert.match(p.simulationAssumption,/模拟约定/);
 for(const [index,item] of source.items.entries()){
  const field=p.schema.fields[index];assert.equal(field.key,item.key);assert.equal(field.label,item.fieldLabel);assert.equal(field.type,'integer');assert.equal(field.required,true);assert.equal(field.score,true);assert.equal(field.default,undefined);
  assert.deepEqual(field.choices,item.choices.map(({value,label})=>({value,label})));
 }
 assert.equal(p.schema.fields[12].choices[2].label,'2-症状明显');
 assert.deepEqual(p.schema.fields[13].choices.map(choice=>choice.value),[0,1,2,9]);
});
test('ordinary complete HAM17 responses produce only a simulation sum, including normal q14 values',()=>{
 const zero=score(answers());assert.equal(zero.total,0);assert.equal(zero.complete,true);assert.equal(zero.scoreComplete,true);assert.equal(zero.processingStatus,'scored');assert.equal(zero.simulationOnly,true);assert.equal(zero.classification,null);assert.equal(zero.diagnosis,null);
 assert.equal(score({...answers(),hamd17_q14:2}).total,2);
 const max=Object.fromEntries(source.items.map(item=>[item.key,Math.max(...item.ordinaryCodes)]));assert.equal(score(max).total,52);
});
test('q14 source code9 stays an answered non-scored status without a complete total, imputation or severity',()=>{
 const input={...answers(),hamd17_q14:9},result=score(input);
 assert.equal(input.hamd17_q14,9);assert.equal(result.complete,true);assert.equal(result.missingRequired,0);assert.equal(result.scoreComplete,false);assert.equal(result.total,null);assert.equal(result.classification,null);assert.equal(result.diagnosis,null);assert.equal(result.processingStatus,'incomplete_data');
 assert.deepEqual(result.unresolvedItems,[{key:'hamd17_q14',status:'source_code_9'}]);
});
test('each missing answer remains incomplete while explicit zero is valid',()=>{
 for(const item of source.items)for(const value of [null,undefined,'']){
  const result=score({...answers(),[item.key]:value});assert.equal(result.complete,false);assert.equal(result.missingRequired,1);assert.equal(result.scoreComplete,false);assert.equal(result.total,null);assert(result.unresolvedItems.some(x=>x.key===item.key&&x.status==='missing'));
 }
});
test('source hash, simulation-policy identity and fixed 17-field domains cannot be silently overridden',()=>{
 const p=profile(),a=answers();
 assert.throws(()=>policy.scorePublishedFormResponse(p.schema,{...p.scoring,sourceSha256:'forged'},a),/FORM_SCORING_SOURCE_MISMATCH/);
 for(const simulationPolicy of [undefined,'ordinary-sum',{ordinarySum:true}])assert.throws(()=>policy.scorePublishedFormResponse(p.schema,{...p.scoring,simulationPolicy},a),/FORM_SIMULATION_POLICY_UNSUPPORTED/);
 for(const fields of [p.schema.fields.slice(1),[...p.schema.fields,p.schema.fields[0]],p.schema.fields.map((f,i)=>i?f:{...f,key:'other'}),p.schema.fields.map((f,i)=>i?f:{...f,type:'number'}),p.schema.fields.map((f,i)=>i===13?{...f,choices:f.choices.filter(c=>c.value!==9)}:f)])assert.throws(()=>policy.scorePublishedFormResponse({...p.schema,fields},p.scoring,a),/FORM_(?:SCHEMA|ANSWER)/);
 for(const [key,value] of [['hamd17_q1',9],['hamd17_q14',3],['hamd17_q4',3],['hamd17_q1',1.5],['hamd17_q1','0'],['hamd17_q1',false]])assert.throws(()=>score({...a,[key]:value}),/FORM_ANSWER/);
 assert.equal(policy.scorePublishedFormResponse(p.schema,{...p.scoring,weights:{hamd17_q1:999},threshold:0},a).classification,null);
});
test('capture candidates expose HAMD/Fang as researcher-only while retaining PHQ and legacy modes',async()=>{
 const keys=['hamd17-crf-simulation-v1','fang-2023-table5-v1','phq9-zh-CN-v1'];
 const forms=keys.map(key=>({id:key,templateId:key+'-template',template:{key,name:key},versionNumber:1,status:'published',...getSourceFormProfile(key)}));forms.push({id:'legacy',template:{key:'legacy',name:'legacy'},schema:{fields:[]},scoring:null});
 const result=await listCaptureCandidates({formVersion:{findMany:async()=>forms},scaleVersion:{findMany:async()=>[]},outcomeDefinition:{findMany:async()=>[]}},{tenantId:'synthetic',studyGroupId:'synthetic-group',executionProjectId:'synthetic-project'});
 assert.deepEqual(result.forms.map(f=>f.allowedCaptureModes),[['researcher'],['researcher'],['researcher','patient_h5'],['researcher','patient_h5']]);
});
test('CSV decoding preserves q14 source9 as a number and cannot turn it into a severity or zero',()=>{
 const p=profile(),a={...answers(),hamd17_q14:9};
 const csv=importTemplate(p.schema.fields)+['SYNTHETIC-HAMD','V1_PATIENT',...p.schema.fields.map(field=>a[field.key])].join(',')+'\r\n';
 const parsed=parseCaptureCsv(csv,p.schema.fields);assert.deepEqual(parsed.errors,[]);assert.equal(parsed.rows[0].answers.hamd17_q14,9);assert.equal(parsed.rows[0].answers.hamd17_q1,0);
 const result=score(parsed.rows[0].answers);assert.equal(result.complete,true);assert.equal(result.scoreComplete,false);assert.equal(result.total,null);
});
