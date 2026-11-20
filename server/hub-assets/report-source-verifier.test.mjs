import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubReportSourceVerifier} from './report-source-verifier.mjs';
import {reportFixture} from './report-source-verifier-fixture.mjs';
test('missing or unknown provenance cannot become a source-valid report',async()=>{
 const verify=createHubReportSourceVerifier({load:()=>()=>{throw Error('unused');},syntheticStudyIds:['study']});
 for(const bundle of [null,{}, {studyId:'study',report:{id:'rh-formal-report-a'}}])await assert.rejects(()=>verify(bundle,{studyId:'study',reportId:'rh-formal-report-a',version:1,contentHash:'a'.repeat(64)}),e=>e.code==='HUB_REPORT_SOURCE_INVALID');
});
test('native pure checks rederive current provenance and deliver only the exact fixed report',async()=>{
 const f=await reportFixture(),result=await createHubReportSourceVerifier({load:f.load,syntheticStudyIds:[f.expected.studyId]})(f.bundle,f.expected);
 assert.equal(result.contentMd,f.bundle.reportVersion.contentMd);assert.equal(result.contentHash,f.expected.contentHash);assert.equal(result.version,1);assert.equal(Object.hasOwn(result,'rows'),false);
});
test('native display labels and completed form evidence remain current only with exact fixed references',async()=>{
 const f=await reportFixture({presentation:true,completed:true}),verify=createHubReportSourceVerifier({load:f.load,syntheticStudyIds:[f.expected.studyId]});
 assert.equal((await verify(f.bundle,f.expected)).contentMd,f.bundle.reportVersion.contentMd);
 for(const change of [b=>b.visits[0].evidenceRefs[0].responseVersion++,b=>b.visits[0].evidenceRefs.push({type:'form_response',assignmentId:'unknown'})]){
  const b=structuredClone(f.bundle);change(b);await assert.rejects(()=>verify(b,f.expected),e=>e.code==='HUB_REPORT_SOURCE_INVALID');
 }
});
test('source lifecycle, review, participation, revision and policy changes all reject delivery',async()=>{
 const f=await reportFixture(),verify=createHubReportSourceVerifier({load:f.load,syntheticStudyIds:[f.expected.studyId]});
 for(const change of [b=>b.report.status='archived',b=>b.reportReview.conclusion='changes_requested',b=>b.methodReview.conclusion='rejected',b=>b.planReview.decision='revoked',b=>b.subjects[0].deletedAt='2026-11-20T01:00:00Z',b=>b.enrollments[0].status='withdrawn',b=>b.visits[0].scheduleState='pending_anchor',b=>b.participationEvents[2].decision='withdrawn',b=>b.responses[0].lockedRevisionId=null,b=>b.responseReviews[0].action='review_returned',b=>b.revisions[0].answers.value=100,b=>b.policy.sections.dataUse.rules.scope='other-purpose',b=>b.formVersions[0].schema.fields[0].label='Changed',b=>b.reportVersion.sources[0].hash='0'.repeat(64),b=>b.run.numericEvidence[0].value=999,b=>b.snapshot.quality_gate.status='stale']){
  const value=structuredClone(f.bundle);change(value);await assert.rejects(()=>verify(value,f.expected),e=>e.code==='HUB_REPORT_SOURCE_INVALID');
 }
});
test('plan protocol relation must match the approved definition and captured protocol',async()=>{
 const f=await reportFixture();f.bundle.plan.protocol_version_id='other-protocol';
 await assert.rejects(()=>createHubReportSourceVerifier({load:f.load,syntheticStudyIds:[f.expected.studyId]})(f.bundle,f.expected),e=>e.code==='HUB_REPORT_SOURCE_INVALID');
});
test('the configured native synthetic study allowlist must independently admit the fixed source',async()=>{
 const f=await reportFixture();
 for(const options of [{},{syntheticStudyIds:[]},{syntheticStudyIds:['other-study']}]){
  await assert.rejects(()=>createHubReportSourceVerifier({load:f.load,...options})(f.bundle,f.expected),e=>e.code==='HUB_REPORT_SOURCE_INVALID');
 }
 for(const syntheticStudyIds of [null,'study',['study','bad id'],[f.expected.studyId,undefined]]){
  assert.throws(()=>createHubReportSourceVerifier({load:f.load,syntheticStudyIds}),/HUB_REPORT_SYNTHETIC_SCOPE_INVALID/);
 }
 const configured=[f.expected.studyId],verify=createHubReportSourceVerifier({load:f.load,syntheticStudyIds:configured});configured.length=0;
 assert.equal((await verify(f.bundle,f.expected)).reportId,f.expected.reportId);
});
