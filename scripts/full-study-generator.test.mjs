import test from 'node:test';import assert from 'node:assert/strict';import {generateSubjectData,ARMS} from './full-study-generator.mjs';import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
const p={phq:getSourceFormProfile('phq9-zh-CN-v1'),fang:getSourceFormProfile('fang-2023-table5-v1'),hamd:getSourceFormProfile('hamd17-crf-simulation-v1')};
test('six stable designs preserve structural applicability, valid zero, special9 and correction fixtures',()=>{
 const all=ARMS.flatMap(a=>[0,1].map(i=>generateSubjectData(a,i,p)));assert.deepEqual(all,ARMS.flatMap(a=>[0,1].map(i=>generateSubjectData(a,i,p))));
 for(const d of all){assert.equal(Object.keys(d.visits).length,d.armCode==='HEALTHY_REFERENCE'?1:4);assert.equal(d.baselineDesignLabel,d.armCode);}
 assert(Object.values(all[4].visits.V1.phq).filter(x=>typeof x==='number').every(x=>x===0));assert.equal(all[3].visits.V3.hamd.hamd17_q14,9);assert.equal(all[1].visits.V3.fang.secondary_irregular_menses,'not_applicable');assert.equal(all[0].visits.V1.fangInitial.pulse_deep_wiry,'present');assert.equal(all[0].visits.V1.fang.pulse_deep_wiry,'absent');assert.equal(all[0].visits.V2.hamd,undefined);assert.deepEqual(all[0].visits.V2.modalities,{});
});
