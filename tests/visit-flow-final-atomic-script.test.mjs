import test from 'node:test';
import assert from 'node:assert/strict';
import {requireAtomicWindow,currentAtomicScope,assertCurrentAtomicCoverage} from '../scripts/visit-flow-final-atomic-proof.mjs';

const checkpoint=()=>({purpose:'visit-flow-final-acceptance-2026-11-17',syntheticOnly:true,runId:'rh-visit-final-ab1234cd',browser:{state:'completed'},cases:Object.fromEntries(['SITE','CSV','H5','SELF'].map(code=>[code,{subject:{id:'subject-'+code,subjectId:'SYNTHETIC-rh-visit-final-ab1234cd-'+code},baseline:'baseline-'+code,channel:'channel-'+code}]))});
test('atomic reader requires exact explicit local read-only window',()=>{
 assert.throws(()=>requireAtomicWindow(['--local-synthetic','--read-only'],{}),/EXPLICIT_FINAL_VISIT_WINDOW_REQUIRED/);
 assert.throws(()=>requireAtomicWindow(['--local-synthetic','--rollback-only'],{VISIT_FLOW_FINAL_QA_WINDOW:'explicit'}));
 assert.doesNotThrow(()=>requireAtomicWindow(['--local-synthetic','--read-only'],{VISIT_FLOW_FINAL_QA_WINDOW:'explicit'}));
});
test('proof scope is exactly the four new subjects and eight distinct visits after fresh QA passed',()=>{
 const cp=checkpoint(),result={passed:true,checkpointRunId:cp.runId,cases:structuredClone(cp.cases)};
 const scope=currentAtomicScope(cp,result);assert.equal(scope.subjectIds.length,4);assert.equal(scope.visitIds.length,8);
 for(const mutate of [value=>{value.browser.state='started';},value=>{value.cases.SELF.baseline=value.cases.SITE.baseline;},value=>{value.cases.SITE.subject.subjectId='real-subject';},value=>{value.cases.OLD={};}]){
  const changed=checkpoint();mutate(changed);assert.throws(()=>currentAtomicScope(changed,result));
 }
 assert.throws(()=>currentAtomicScope(cp,{...result,passed:false}));
 assert.throws(()=>currentAtomicScope(cp,{...result,cases:{}}));
});
test('current coverage requires three distinct fixed forms for SITE, CSV and H5, not three repeats of one',()=>{
 const cp=checkpoint(),scope=currentAtomicScope(cp,{passed:true,cases:cp.cases});
 const assignments=Object.entries({SITE:'baseline-SITE',CSV:'baseline-CSV',H5:'channel-H5'}).flatMap(([code,visit])=>[0,1,2].map(i=>({id:code+i,subjectVisitId:visit,subjectId:'subject-'+code,formVersionId:'version-'+i})));
 const checks=assignments.map(assignment=>({assignmentId:assignment.id}));
 assert.equal(assertCurrentAtomicCoverage(checks,assignments,scope).length,3);
 assert.throws(()=>assertCurrentAtomicCoverage(checks.slice(1),assignments,scope),/THREE_DISTINCT_ORIGINAL_FORMS_REQUIRED/);
 assert.throws(()=>assertCurrentAtomicCoverage([...checks.slice(1),checks[1]],assignments,scope),/THREE_DISTINCT_ORIGINAL_FORMS_REQUIRED/);
 assert.throws(()=>assertCurrentAtomicCoverage([...checks,{assignmentId:'outside'}],assignments,scope),/ASSIGNMENT_OUTSIDE_CURRENT_SCOPE/);
});
