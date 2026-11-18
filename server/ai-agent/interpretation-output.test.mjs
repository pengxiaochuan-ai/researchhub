import test from 'node:test';import assert from 'node:assert/strict';
import {buildSnapshotPack} from './interpretation-evidence.mjs';
import * as output from './interpretation-output.mjs';
const sources=[{id:'P1',kind:'pubmed-live',pmid:'123',title:'A protocol',abstract:'This is a study protocol. Results are not available.'},{id:'P2',kind:'pubmed-live',pmid:'456',title:'A randomized trial',abstract:'Adults were randomized to treatment or sham. No significant difference was observed.'}].map(s=>({...s,pack:buildSnapshotPack(s)}));
const e={hash:'bound',selected:sources};
const part={text:'本次来源不足以判断长期疗效。',fragmentIds:['fragment-1'],kind:'insufficient'};
const value=()=>({items:sources.map(s=>({id:s.id,sections:Object.fromEntries(['researchType','observations','limitations','relevance'].map(k=>[k,{...part,fragmentIds:[s.id+':fragment-1']}]))})),comparison:{text:'方案与已完成试验不可直接作疗效比较。',references:sources.map(s=>({sourceId:s.id,fragmentIds:[s.id+':fragment-1']}))}});
test('each article reuses the B04 response policy and preserves its own source and actual excerpt',()=>{
 const accepted=output.acceptInterpretationOutput(JSON.stringify(value()),e);assert(accepted.text.includes('A protocol'));assert(accepted.text.includes('Results are not available'));assert(accepted.text.includes('No significant difference'));assert(accepted.text.includes('不可直接'));assert.equal(accepted.validation.items.length,2);
});
test('cross-paper fabricated ids, missing papers and unsupported comparison references stop delivery',()=>{
 const bad=value();bad.comparison.references[0].sourceId='P99';assert.throws(()=>output.acceptInterpretationOutput(JSON.stringify(bad),e));
 const missing=value();missing.items.pop();assert.throws(()=>output.acceptInterpretationOutput(JSON.stringify(missing),e));
 const fragment=value();fragment.items[0].sections.researchType={...part,fragmentIds:['other-paper-fragment']};assert.throws(()=>output.acceptInterpretationOutput(JSON.stringify(fragment),e));
 const cross=value();cross.items[0].sections.researchType={...part,fragmentIds:['P2:fragment-1']};assert.throws(()=>output.acceptInterpretationOutput(JSON.stringify(cross),e));
});
test('explicit no-results protocol cannot be delivered as a completed effective study, even with valid citations',()=>{
 const evidence={hash:'p',selected:[{...sources[0],pack:buildSnapshotPack({...sources[0],abstract:'This is a study protocol. Results are not available. No participant outcomes have been collected.'})}]};
 const v=value();v.items=v.items.slice(0,1);for(const key of Object.keys(v.items[0].sections))v.items[0].sections[key].text='本研究已完成，结果显示治疗显著有效。';
 v.comparison={text:'研究证实治疗有效，可支持临床疗效结论。',references:[{sourceId:'P1',fragmentIds:['P1:fragment-1']}]};
 assert.throws(()=>output.acceptInterpretationOutput(JSON.stringify(v),evidence),/NO_DELIVERABLE/);
});
test('primary-negative inversion is withheld locally without rejecting correct secondary or uncertain explanations',()=>{
 const e={hash:'n',selected:[{...sources[0],title:'Trial',pack:buildSnapshotPack({...sources[0],title:'Trial',abstract:'There was no significant difference between groups in the primary outcome. Secondary sleep outcomes improved.'})}]};
 const v=value();v.items=v.items.slice(0,1);v.items[0].sections.observations.text='治疗组的主要结局显著优于假治疗组。';v.items[0].sections.limitations.text='主要结局未显示组间差异，但作者报告次要睡眠指标改善，尚不能判断长期效果。';
 v.comparison={text:'主要结局显著优于对照。',references:[{sourceId:'P1',fragmentIds:['P1:fragment-1']}]};
 const x=output.acceptInterpretationOutput(JSON.stringify(v),e);assert(!x.text.includes('主要结局显著优于'));assert(x.text.includes('次要睡眠指标改善'));assert(x.validation.items[0].claimIssues.observations.includes('PRIMARY_OUTCOME_CONTRADICTION'));assert(x.validation.comparison.issues.includes('PRIMARY_OUTCOME_CONTRADICTION'));
});
test('T07 retains independent qualitative limitations while withholding a numeric clause and preserves v1 replay',()=>{
 const source={id:'P1',kind:'pubmed-live',pmid:'123',title:'Trial',abstract:'This single-center RCT was approved by the committee. All outcomes were subjective scales. Follow-up was limited to 14 days. There was no sham control.'};
 const e={hash:'q',selected:[{...source,pack:buildSnapshotPack(source)}]},v=value();v.items=v.items.slice(0,1);
 v.items[0].sections.researchType.text='本研究是一项单中心随机对照试验。';
 v.items[0].sections.limitations.text='作者指出结局均为主观量表；随访仅至治疗后14天；未设假针刺对照，无法确定特异性效应。';
 v.comparison={text:'尚不能判断长期效果。',references:[{sourceId:'P1',fragmentIds:['P1:fragment-1']}]};
 const x=output.acceptInterpretationOutput(JSON.stringify(v),e);assert(x.text.includes('本研究是单中心随机对照试验'));assert(x.text.includes('作者指出结局均为主观量表'));assert(x.text.includes('未设假针刺对照，无法确定特异性效应'));assert(!x.text.includes('随访仅至治疗后14天'));
 assert.equal(x.validation.schema,'hub-interpretation-output.v3');assert.equal(x.validation.items[0].repairs.length,2);
 const old=output.acceptInterpretationOutput(JSON.stringify(v),e,{policy:'hub-interpretation-output.v1'});assert(!old.text.includes('作者指出结局均为主观量表'));assert.equal(old.validation.schema,'hub-interpretation-output.v1');
});
test('T07 does not split semicolon sentences with contrastive or conditional dependencies',()=>{
 const e={hash:'d',selected:[sources[0]]},v=value();v.items=v.items.slice(0,1);v.items[0].sections.limitations.text='疗效改善30%；但未优于假治疗，不能据此支持疗效。';v.comparison={text:'尚不能判断长期效果。',references:[{sourceId:'P1',fragmentIds:['P1:fragment-1']}]};
 const x=output.acceptInterpretationOutput(JSON.stringify(v),e);assert(!x.text.includes('疗效改善30%'));assert(!x.validation.items[0].repairs.some(r=>r.field==='limitations'));
});
test('only actual selected article identifiers and selection counts are repaired, not fabricated citations',()=>{
 const v=value();v.comparison.text='两篇材料范围不同：P1为研究方案，P2为已完成研究，不能直接比较疗效。';
 const x=output.acceptInterpretationOutput(JSON.stringify(v),e);assert(x.text.includes('文献一为研究方案，文献二为已完成研究'));assert(!x.text.includes('P1为'));
 const bad=value();bad.comparison.text='P99证实治疗有效。';assert.throws(()=>output.acceptInterpretationOutput(JSON.stringify(bad),e));
});
test('trusted article labels cannot be mistaken for outcome quantities across comma clauses',()=>{
 const v=value();v.comparison.text='两篇研究对象不同：P1无已完成结果，P2已有结果；研究结局不同，文献二不能用于判断文献一的疗效。';
 const x=output.acceptInterpretationOutput(JSON.stringify(v),e);assert(x.text.includes('研究结局不同，文献二不能用于判断文献一的疗效'));assert(!x.validation.comparison.issues.includes('NUMBER_UNVERIFIED'));
 const old=output.acceptInterpretationOutput(JSON.stringify(v),e,{policy:'hub-interpretation-output.v2'});assert(old.validation.comparison.issues.includes('NUMBER_UNVERIFIED'));
 v.comparison.text='文献三证明治疗有效。';assert.throws(()=>output.acceptInterpretationOutput(JSON.stringify(v),e));
});
