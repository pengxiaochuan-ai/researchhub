// Current acceptance READ ONLY proof. No target/configuration I/O at import time.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {assertAtomicProof} from './visit-workflow-atomic-proof.mjs';

const workspace='/Users/mac/aisciencesys/',repo=workspace+'researchhub/';
const purpose='visit-flow-final-acceptance-2026-11-17';
const privateDir=workspace+'.tmp/'+purpose+'/';
const output=repo+'docs/testing/evidence/'+purpose+'/atomic-proof/';
const json=path=>JSON.parse(readFileSync(path,'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');

export function requireAtomicWindow(args,env=process.env){
 assert.deepEqual(args,['--local-synthetic','--read-only']);
 assert.equal(env.VISIT_FLOW_FINAL_QA_WINDOW,'explicit','EXPLICIT_FINAL_VISIT_WINDOW_REQUIRED');
}

export function currentAtomicScope(checkpoint,result){
 assert.equal(checkpoint.purpose,purpose);assert.equal(checkpoint.syntheticOnly,true);
 assert.match(checkpoint.runId,/^rh-visit-final-[a-f0-9]{8}$/);
 assert.equal(checkpoint.browser?.state,'completed','FRESH_BROWSER_ACCEPTANCE_REQUIRED');
 assert.equal(result.passed,true,'FRESH_BROWSER_RESULT_REQUIRED');
 if(result.runId)assert.equal(result.runId,checkpoint.runId);
 if(result.checkpointRunId)assert.equal(result.checkpointRunId,checkpoint.runId);
 assert.deepEqual(result.cases,checkpoint.cases,'RESULT_CASES_MUST_MATCH_CURRENT_CHECKPOINT');
 assert.deepEqual(Object.keys(checkpoint.cases).sort(),['CSV','H5','SELF','SITE']);
 const cases=checkpoint.cases,subjectIds=[],visitIds=[];
 for(const [name,item] of Object.entries(cases)){
  assert.equal(item.subject?.subjectId,'SYNTHETIC-'+checkpoint.runId+'-'+name);
  assert(typeof item.subject.id==='string'&&typeof item.baseline==='string'&&typeof item.channel==='string');
  subjectIds.push(item.subject.id);visitIds.push(item.baseline,item.channel);
 }
 assert.equal(new Set(subjectIds).size,4,'FOUR_DISTINCT_NEW_SUBJECTS_REQUIRED');
 assert.equal(new Set(visitIds).size,8,'EIGHT_DISTINCT_CURRENT_VISITS_REQUIRED');
 return {cases,subjectIds,visitIds,runId:checkpoint.runId};
}

export function assertCurrentAtomicCoverage(checks,assignments,scope,requiredFormVersionIds){
 for(const check of checks){
  const assignment=assignments.find(item=>item.id===check.assignmentId);
  assert(assignment&&scope.visitIds.includes(assignment.subjectVisitId)&&scope.subjectIds.includes(assignment.subjectId),'ASSIGNMENT_OUTSIDE_CURRENT_SCOPE');
 }
 return [['SITE',scope.cases.SITE.baseline],['CSV',scope.cases.CSV.baseline],['H5',scope.cases.H5.channel]].map(([name,visitId])=>{
  const successful=checks.filter(check=>assignments.find(assignment=>assignment.id===check.assignmentId)?.subjectVisitId===visitId);
  const ids=[...new Set(successful.map(check=>check.assignmentId))];
  const formVersionIds=[...new Set(ids.map(id=>assignments.find(assignment=>assignment.id===id).formVersionId))];
  assert(ids.length>=3&&formVersionIds.length>=3,'THREE_DISTINCT_ORIGINAL_FORMS_REQUIRED:'+name);
  if(requiredFormVersionIds)assert(requiredFormVersionIds.every(id=>formVersionIds.includes(id)),'THREE_FIXED_ORIGINAL_VERSIONS_REQUIRED:'+name);
  return {case:name,visitId,distinctAssignments:ids.length,successfulFinishes:successful.length,formVersionIds};
 });
}

export async function runFinalAtomicProof(){
 requireAtomicWindow(process.argv.slice(2));
 const {validateFixture,save,normalize}=await import('./visit-workflow-qa.mjs');
 const fixture=json(workspace+'.tmp/visit-capture-review-flow-2026-11-16/fixture.json');validateFixture(fixture);assert(fixture.ready);
 const checkpoint=json(privateDir+'checkpoint.json'),browser=json(repo+'docs/testing/evidence/'+purpose+'/browser/result.json');
 const scope=currentAtomicScope(checkpoint,browser);assert.equal(browser.studyId,fixture.study.id);
 assert(!existsSync(output+'result.json'),'CURRENT_ATOMIC_PROOF_ALREADY_RECORDED');
 const {fixtureEnvironment}=await import('./research-creation-fixture.mjs');
 const {assertFixtureTarget,withFixtureTransaction}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const sourcePaths=['researchhub/server/research-capture/visit-workflow.mjs','app/server/src/study-operations/formal-response-review.ts','app/server/src/study-operations/formal-response-policy.ts','researchhub/scripts/visit-workflow-atomic-proof.mjs'];
 const sourceHashes=()=>Object.fromEntries(sourcePaths.map(path=>[path,sha(readFileSync(workspace+path))]));
 const sources=sourceHashes();
 // Only compare the actual current browser run's captured workflow source; no old-controller inference.
 assert.equal(sources['researchhub/server/research-capture/visit-workflow.mjs'],browser.sourceHashes['server/research-capture/visit-workflow.mjs'],'WORKFLOW_CHANGED_SINCE_CURRENT_BROWSER_EXECUTION');
 const proof=await withFixtureTransaction(env,'direct',async tx=>{
  const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${fixture.runId}`;
  assert.equal(marker?.manifest?.syntheticOnly,true);assert.equal(marker.manifest.tenantId,fixture.scope.tenantId);assert.equal(marker.manifest.studyGroupId,fixture.scope.studyGroupId);
  const visits=await tx.subjectVisit.findMany({where:{...fixture.scope,id:{in:scope.visitIds},subjectId:{in:scope.subjectIds},acceptanceFixture:false},select:{id:true,subjectId:true,visitPlan:{select:{code:true}}},orderBy:{id:'asc'}});
  assert.equal(visits.length,8);
  for(const item of Object.values(scope.cases)){
   assert(visits.some(visit=>visit.id===item.baseline&&visit.subjectId===item.subject.id&&visit.visitPlan.code==='BASELINE'));
   assert(visits.some(visit=>visit.id===item.channel&&visit.subjectId===item.subject.id&&visit.visitPlan.code==='CHANNEL'));
  }
  const assignments=await tx.formAssignment.findMany({where:{...fixture.scope,subjectVisitId:{in:scope.visitIds},subjectId:{in:scope.subjectIds},acceptanceFixture:false},select:{id:true,subjectId:true,subjectVisitId:true,formVersionId:true},orderBy:{id:'asc'}});
  const headers=normalize(await tx.$queryRaw`SELECT *,xmin::text AS txid FROM public.audit_log WHERE "tenantId"=${fixture.scope.tenantId} AND "studyGroupId"=${fixture.scope.studyGroupId} AND "researchProjectId"=${fixture.scope.researchProjectId} AND action='researchhub.visit.review.batch' AND target=ANY(${scope.visitIds}::text[]) ORDER BY id`);
  assert(headers.length>0,'CURRENT_BATCH_HEADERS_REQUIRED');
  for(const header of headers){
   assert.equal(header.meta?.studyId,fixture.study.id);assert.equal(header.meta.visitId,header.target);assert(scope.visitIds.includes(header.target));
   assert.match(header.id,/^visit-batch-[a-f0-9-]+$/);
   assert(header.meta.members?.length>0);
   for(const member of header.meta.members)assert(assignments.some(assignment=>assignment.id===member.assignmentId&&assignment.subjectVisitId===header.target&&assignment.formVersionId===member.formVersionId),'HEADER_MEMBER_OUTSIDE_CURRENT_VISIT');
  }
  const batchIds=headers.map(header=>header.id);
  const events=normalize(await tx.$queryRaw`SELECT *,xmin::text AS txid FROM public.audit_log WHERE "tenantId"=${fixture.scope.tenantId} AND "studyGroupId"=${fixture.scope.studyGroupId} AND "researchProjectId"=${fixture.scope.researchProjectId} AND target=ANY(${batchIds}::text[]) AND action IN ('researchhub.visit.review.claim','researchhub.visit.review.finished') ORDER BY id`);
  for(const event of events){
   const header=headers.find(item=>item.id===event.target),member=header?.meta.members.find(item=>item.assignmentId===event.meta?.assignmentId);
   assert.equal(event.accountId,header?.accountId,'BATCH_EVENT_ACTOR_MISMATCH');assert(member,'CURRENT_BATCH_MEMBER_REQUIRED');
   assert.equal(event.meta.batchHash,header.meta.batchHash);assert.deepEqual(event.meta.expectedRef,member.expectedRef);
   if(event.action==='researchhub.visit.review.claim')assert.equal(event.meta.expectedVersion,member.initialVersion);
   else{assert.equal(event.meta.initialVersion,member.initialVersion);assert.equal(event.meta.memberAction,member.action);}
  }
  const successful=events.filter(event=>event.action==='researchhub.visit.review.finished'&&event.meta?.status==='completed');
  assert(successful.length>0,'NO_CURRENT_SUCCESSFUL_FINISHES');
  const nativeKeys=[...new Set(successful.flatMap(event=>Object.values(event.meta.nativeKeys)))];
  assert(nativeKeys.every(key=>typeof key==='string'&&/^visit-(review|lock)-[a-f0-9]{64}$/.test(key)),'INVALID_CURRENT_NATIVE_KEYS');
  const nativeAudits=normalize(await tx.$queryRaw`SELECT *,xmin::text AS txid FROM public.audit_log WHERE "tenantId"=${fixture.scope.tenantId} AND "studyGroupId"=${fixture.scope.studyGroupId} AND "researchProjectId"=${fixture.scope.researchProjectId} AND action IN ('formal_response_review_approved','formal_response_lock') AND meta->>'requestKey'=ANY(${nativeKeys}::text[]) ORDER BY id`);
  const claimIds=events.filter(event=>event.action==='researchhub.visit.review.claim').map(event=>event.id);
  const operations=normalize(await tx.$queryRaw`SELECT *,xmin::text AS txid FROM rh_research.operation WHERE tenant_id=${fixture.scope.tenantId} AND audit_id=ANY(${claimIds}::text[]) ORDER BY id`);
  return {visits,assignments,headers,events,nativeAudits,operations};
 },{readOnly:true});
 const audits=[...proof.headers,...proof.events,...proof.nativeAudits];
 const checks=assertAtomicProof(audits,proof.operations,fixture.study.id);
 const coverage=assertCurrentAtomicCoverage(checks,proof.assignments,scope,['phq','fang','hamd'].map(kind=>fixture.refs[kind]));
 assert.deepEqual(sourceHashes(),sources,'PROOF_SOURCE_CHANGED_DURING_READ');
 save(output+'native-xmin.json',proof);
 const result={purpose,at:new Date().toISOString(),passed:true,studyId:fixture.study.id,checkpointRunId:scope.runId,subjectIds:scope.subjectIds,visitIds:scope.visitIds,sourceHashes:sources,currentBrowserEvidence:'browser/result.json',currentBrowserEvidenceSha256:sha(readFileSync(repo+'docs/testing/evidence/'+purpose+'/browser/result.json')),readOnly:true,businessWrites:0,httpRequests:0,successfulFinishes:checks.length,nativeAuditRows:checks.reduce((count,check)=>count+check.native.length,0),coverage,checks,qualification:'Fresh current-run PostgreSQL xmin evidence for successful SITE/CSV/H5 batch members, scoped to four new subjects and eight visits. Each immutable native review/lock audit shares its FINISH transaction; each claim and advance receipt shares a separate transaction. Current response xmin is not used because later corrections can update it. No inherited controller hash or assertion that the entire backend is unchanged; no permission, DDL, business writes, restart, clinical or production claim.'};
 save(output+'result.json',result);
 console.log(JSON.stringify({passed:true,readOnly:true,successfulFinishes:checks.length,coverage:coverage.map(item=>item.case),evidence:output+'result.json'}));
 return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runFinalAtomicProof();
