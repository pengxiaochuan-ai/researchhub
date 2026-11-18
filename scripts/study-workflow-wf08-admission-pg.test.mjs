import test from 'node:test';import assert from 'node:assert/strict';
import {requireWF08AdmissionWindow,runWF08AdmissionPrediction} from './study-workflow-wf08-admission-pg.mjs';
const args=['--local-synthetic','--rollback-predict'],env={STUDY_WORKFLOW_WF08_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'};
test('WF08 prediction guards precede every fixture/protection/schema callback and accept only exact mode',async()=>{
 for(const input of [{env:{},args},{env:{STUDY_WORKFLOW_WF08_QA_WINDOW:'explicit'},args},{env,args:[]},{env,args:[...args,'--apply']}]){
  let calls=0;await assert.rejects(runWF08AdmissionPrediction({...input,withFixtureTransaction:()=>calls++,readProtection:()=>calls++,applyMigrationInTransaction:()=>calls++}));assert.equal(calls,0);
 }
 assert.doesNotThrow(()=>requireWF08AdmissionWindow(args,env));
});
test('even admitted window cannot perform I/O with missing dependencies or unapproved resources',async()=>{
 let calls=0;await assert.rejects(runWF08AdmissionPrediction({args,env,withFixtureTransaction:()=>calls++,readProtection:()=>calls++}));assert.equal(calls,0);
});
