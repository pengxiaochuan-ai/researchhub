import test from 'node:test';
import assert from 'node:assert/strict';
import {displayScore} from '../src/formal-capture-session.js';
import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
import {createResearchFormAdapter} from '../server/research-capture/form-core-adapter.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';

const p=getSourceFormProfile('hamd17-crf-simulation-v1'),policy=createResearchFormAdapter(runtimeDependencies()).policy;
const answers=()=>Object.fromEntries(p.schema.fields.map(field=>[field.key,0]));
const calculate=value=>policy.scorePublishedFormResponse(p.schema,p.scoring,value);
test('HAMD ordinary total is labeled as a simulation sum without frontend diagnosis or severity',()=>{
 const text=displayScore(calculate(answers()),p.schema.fields);assert.match(text,/HAMD-17模拟合计：0/);assert.doesNotMatch(text,/阳性|阴性|轻度|重度|符合|不符合/);
});
test('HAMD source9 displays its non-scoring reason instead of unverifiable data or a zero total',()=>{
 const text=displayScore(calculate({...answers(),hamd17_q14:9}),p.schema.fields);assert.match(text,/原件代码9/);assert.match(text,/未计算总分/);assert.doesNotMatch(text,/暂不可核验|合计：0/);
});
test('HAMD missing answers display fixed source labels and a missing reason',()=>{
 const text=displayScore(calculate({...answers(),hamd17_q4:null}),p.schema.fields);assert.match(text,/未计算总分/);assert.match(text,/入睡[\s\S]*未填写/);assert.doesNotMatch(text,/hamd17_q4|暂不可核验/);
});
test('HAMD display refuses inconsistent numerical, completeness or diagnostic output',()=>{
 const valid=calculate(answers());
 for(const changed of [{...valid,scoreComplete:false},{...valid,classification:'positive'},{...valid,total:NaN},{...valid,total:0.5},{...valid,simulationOnly:false}])assert.equal(displayScore(changed,p.schema.fields),'计分结果暂不可核验');
 const unresolved=calculate({...answers(),hamd17_q14:9});assert.equal(displayScore({...unresolved,total:9},p.schema.fields),'计分结果暂不可核验');
});
