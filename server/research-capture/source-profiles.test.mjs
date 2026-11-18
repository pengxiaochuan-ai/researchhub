import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getSourceFormProfile} from './source-profiles.mjs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {createResearchFormAdapter} from './form-core-adapter.mjs';
import {FANG_TABLE5_ITEMS} from './fang-table5-policy.mjs';

const candidate=JSON.parse(readFileSync(new URL('../../docs/planning/first-real-study-calibration-2026-11-13/core-forms/phq9-form-v1.json',import.meta.url)));
const pendingRaw=readFileSync(new URL('../../docs/planning/study-form-electronic-scoring-2026-11-13/history/fang-2023-table5-v1-policy-pending-v1.json',import.meta.url));
const pendingProfile=JSON.parse(pendingRaw);
const confirmedVersion='fang-2023-table5-5e34d90ff887-source-v1-project-policy-v1';
const confirmedBy='project-user-confirmation',confirmedAt='2026-11-13T09:18:47.000Z';
const policy=createResearchFormAdapter(runtimeDependencies()).policy;
function table5Answers(){
 const present=new Set(['main_distension_pain','main_depressed_emotion','secondary_globus','secondary_emotional_trigger','tongue_pale_red','pulse_wiry']);
 return {...Object.fromEntries(FANG_TABLE5_ITEMS.map(item=>[item.key,present.has(item.key)?'present':'absent'])),tongue_category:'met',pulse_category:'met'};
}
function scoreCanonical(answers){const p=getSourceFormProfile('fang-2023-table5-v1');return policy.scorePublishedFormResponse(p.schema,p.scoring,answers);}
test('PHQ published profile retains original instructions, option glyphs, all nine numeric fields and unnumbered unscored difficulty',()=>{
 const p=getSourceFormProfile('phq9-zh-CN-v1'),c=candidate.content;
 assert.equal(p.source.sha256,candidate.sourcePdfSha256);
 assert.deepEqual(p.schema.presentation,{title:c.title,recallPeriodPrompt:c.recallPeriodPrompt,instruction:c.instruction,attribution:c.permissionNotice});
 assert.deepEqual(p.allowedCaptureModes,['researcher','patient_h5']);
 assert.equal(p.schema.fields.length,10);
 for(let i=0;i<9;i++){
  const f=p.schema.fields[i];assert.equal(f.label,`${i+1}. ${c.scoredItems[i].text}`);
  assert.equal(f.type,'integer');assert.equal(f.required,true);assert.equal(f.score,true);
  assert.deepEqual(f.choices,c.answerOptions.map(({value,label})=>({value,label})));
  assert.equal(f.default,undefined);
 }
 const last=p.schema.fields[9];assert.equal(last.label,c.functionalDifficulty.text);assert.equal(last.score,false);
 assert.equal(last.required,false);assert.deepEqual(last.options,c.functionalDifficulty.options.map(({label},i)=>({value:`difficulty_${i+1}`,label})));
 assert.equal(p.scoring.algorithm,'numeric-sum-v1');
});
test('source profiles are isolated copies and unknown instruments cannot substitute an unverified form',()=>{
 const a=getSourceFormProfile('phq9-zh-CN-v1');a.schema.fields[0].choices[0].label='tampered';
 assert.equal(getSourceFormProfile('phq9-zh-CN-v1').schema.fields[0].choices[0].label,'从来沒有');
 assert.throws(()=>getSourceFormProfile('five-symptom-v1'),/SOURCE_FORM_UNKNOWN/);
});
test('table5 canonical records the user-confirmed project policy without changing source rows or capture modes',()=>{
 const p=getSourceFormProfile('fang-2023-table5-v1');
 const source=JSON.parse(readFileSync(new URL('../../docs/planning/first-real-study-calibration-2026-11-13/core-forms/target-syndrome-fang2023-source-v1.json',import.meta.url)));
 assert.equal(p.source.sha256,source.source.sha256);assert.equal(p.schema.fields.length,14);
 assert.deepEqual(p.allowedCaptureModes,['researcher']);assert.equal(p.scoring.projectPolicy.status,'confirmed');
 assert.equal(p.versionTag,confirmedVersion);
 assert.equal(p.scoring.projectPolicy.reviewedBy,confirmedBy);assert.equal(p.scoring.projectPolicy.reviewedAt,confirmedAt);
 for(const [i,row] of source.items.entries()){
  assert.equal(p.schema.fields[i].key,row.key);assert.equal(p.schema.fields[i].label,row.label);
  assert.deepEqual(p.schema.fields[i].options.map(o=>o.value),['present','absent','not_applicable','uncertain']);
 }
 assert.deepEqual(p.schema.fields.slice(-2).map(f=>f.key),['tongue_category','pulse_category']);
 assert.equal(p.schema.presentation.recallPeriodPrompt,undefined);
});
test('canonical upgrade changes only the four approved policy/version metadata fields and preserves exact pending bytes',()=>{
 assert.equal(createHash('sha256').update(pendingRaw).digest('hex'),'031bb15099b50fcebc7321091acdc55b9985bc24376bf4bdbba827d6626402ea');
 assert.equal(pendingProfile.scoring.projectPolicy.status,'pending');assert.equal(pendingProfile.scoring.projectPolicy.reviewedBy,null);assert.equal(pendingProfile.scoring.projectPolicy.reviewedAt,null);
 const expected=structuredClone(pendingProfile);expected.versionTag=confirmedVersion;
 Object.assign(expected.scoring.projectPolicy,{status:'confirmed',reviewedBy:confirmedBy,reviewedAt:confirmedAt});
 assert.deepEqual(getSourceFormProfile('fang-2023-table5-v1'),expected);
});
test('real canonical profile runs through ResearchHub policy to the complete 24-point positive result',()=>{
 const score=scoreCanonical(table5Answers());assert.equal(score.policyConfirmed,true);assert.equal(score.complete,true);assert.equal(score.scoreComplete,true);assert.equal(score.total,24);assert.equal(score.processingStatus,'scored');assert.equal(score.classification,'positive');assert.equal(score.diagnosis,true);
 assert.equal(score.thresholdMet,true);assert.deepEqual(score.composition,{primary:true,secondary:true,tongueOrPulse:true});
});
test('real canonical N-A and uncertain observations remain answered but produce no complete score',()=>{
 for(const value of ['not_applicable','uncertain']){
  const score=scoreCanonical({...table5Answers(),secondary_irregular_menses:value});assert.equal(score.complete,true);assert.equal(score.scoreComplete,false);assert.equal(score.total,null);assert.equal(score.classification,null);assert.equal(score.processingStatus,'incomplete_data');assert(score.unresolvedItems.some(item=>item.key==='secondary_irregular_menses'&&item.status===value));
 }
});
test('real canonical dual-pulse observation requires review without silently summing both pulses',()=>{
 const score=scoreCanonical({...table5Answers(),pulse_deep_wiry:'present'});assert.equal(score.complete,true);assert.equal(score.scoreComplete,false);assert.equal(score.total,null);assert.equal(score.classification,null);assert.equal(score.processingStatus,'review_required');assert.equal(score.pulseReviewRequired,true);
});
test('real canonical missing observations remain incomplete without a fabricated total or label',()=>{
 const answers=table5Answers();delete answers.secondary_irregular_menses;
 const score=scoreCanonical(answers);assert.equal(score.complete,false);assert.equal(score.missingRequired,1);assert.equal(score.scoreComplete,false);assert.equal(score.total,null);assert.equal(score.classification,null);assert.equal(score.processingStatus,'incomplete_data');
});
test('explicit pending clones and the archived pending original still return awaiting_policy without changing canonical',()=>{
 const clone=getSourceFormProfile('fang-2023-table5-v1');Object.assign(clone.scoring.projectPolicy,{status:'pending',reviewedBy:null,reviewedAt:null});
 for(const p of [clone,pendingProfile]){
  const score=policy.scorePublishedFormResponse(p.schema,p.scoring,table5Answers());assert.equal(score.complete,true);assert.equal(score.policyConfirmed,false);assert.equal(score.scoreComplete,false);assert.equal(score.total,null);assert.equal(score.classification,null);assert.equal(score.processingStatus,'awaiting_policy');
 }
 assert.equal(getSourceFormProfile('fang-2023-table5-v1').scoring.projectPolicy.status,'confirmed');
});
