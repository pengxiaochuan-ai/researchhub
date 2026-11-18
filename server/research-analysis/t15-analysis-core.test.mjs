import test from 'node:test';
import assert from 'node:assert/strict';
import {validateT15Plan,createT15AnalysisCore,assertT15SyntheticUsePolicy} from './t15-analysis-core.mjs';
const plan=()=>({schemaVersion:'t15-synthetic-plan-v1',dataClassification:'synthetic',purposeKey:'synthetic-research-only',method:'descriptive',statisticalUnit:'subject',protocolVersionId:'protocol-1',visitCode:'BASELINE',subjectIds:['subject-1','subject-2','subject-3'],variables:[{key:'value',formVersionId:'form-1',fieldKey:'value',valueType:'number',unit:null}],sapVersion:'sap-v1',variableMapVersion:'map-v1',reason:'通用合成软件验收'});
test('synthetic plan requires explicit purpose, fixed mapping, exact cohort and unit; values are never accepted',()=>{
 const input=plan(),result=validateT15Plan(input);assert.deepEqual(result,input);input.subjectIds.push('other');assert.equal(result.subjectIds.length,3);
 for(const change of [{dataClassification:'clinical'},{purposeKey:'clinical'},{method:'inferential'},{statisticalUnit:'subject_visit'},{subjectIds:['subject-1','subject-1','subject-3']},{subjectIds:['subject-1']},{variables:[]},{variables:[{...plan().variables[0],value:42}]},{answers:{value:0}},{reason:''}])assert.throws(()=>validateT15Plan({...plan(),...change}));
});
test('actual core cannot be constructed without explicit synthetic Study scope or core loader',()=>{
 for(const args of [{},{load:()=>{},syntheticStudyIds:[]},{load:()=>{},syntheticStudyIds:['bad scope']},{syntheticStudyIds:['study-1']}])assert.throws(()=>createT15AnalysisCore(args),/T15_SYNTHETIC_SCOPE_REQUIRED/);
});
test('configured synthetic use respects exact machine scope while rejecting missing or clinical purposes and implemented blinding',()=>{
 const policy={ethics:{status:'not_applicable'},screening:{status:'configured'},researchConsent:{status:'configured'},dataUse:{status:'configured',rules:{scope:'synthetic-research-only'}},withdrawal:{status:'configured'},blinding:{status:'not_applicable'}};
 assert.doesNotThrow(()=>assertT15SyntheticUsePolicy(policy));
 for(const change of [{dataUse:{status:'configured',rules:{scope:'clinical'}}},{dataUse:{status:'configured',rules:{purposes:'synthetic-research-only'}}},{researchConsent:{status:'missing'}},{withdrawal:{status:'missing'}},{blinding:{status:'configured'}},{blinding:{status:'missing'}}])assert.throws(()=>assertT15SyntheticUsePolicy({...policy,...change}),e=>e.code==='ANALYSIS_USE_POLICY_UNAVAILABLE');
});
