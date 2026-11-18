import test from 'node:test';import assert from 'node:assert/strict';
import {readAnalysisMode} from './analysis-mode.mjs';
test('without a simulation deployment, ordinary mode still requires current Study authority',async()=>{
 const studies={withResearchStudyTransaction:async(user,studyId,operation,fn)=>{assert.equal(operation,'read');if(!user.allowed)throw Object.assign(Error('forbidden'),{status:403});return fn();}};
 assert.deepEqual(await readAnalysisMode({analysis:{},studies,user:{allowed:true},studyId:'ordinary'}),{studyId:'ordinary',schemaVersion:'t15-synthetic-plan-v1'});
 await assert.rejects(readAnalysisMode({studies,user:{allowed:false},studyId:'foreign'}),e=>e.status===403);
});
test('registered mode failures remain explicit and never fall back to ordinary execution',async()=>{
 await assert.rejects(readAnalysisMode({analysis:{configuration:async()=>{throw Object.assign(Error('unready'),{code:'SIMULATION_NOT_READY'});}},studies:{withResearchStudyTransaction:()=>{throw Error('must not fall back');}},user:{},studyId:'registered'}),e=>e.code==='SIMULATION_NOT_READY');
});
