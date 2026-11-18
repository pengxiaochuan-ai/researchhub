// Explicit pre-T06 historical rows in the one newly owned synthetic case.
// This prepares legacy migration cases; it is never a production enrollment bypass.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--prepare-historical-ui']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const pointer=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t05-migration-current.json')),accepted=JSON.parse(readFileSync(pointer.acceptedFile));assert(accepted.syntheticOnly===true&&accepted.runId.startsWith('rh-t05-migration-http-'));
const {load}=runtimeDependencies();
const instantiateEnrollmentVisits=load('study-operations/study-operations-policy','instantiateEnrollmentVisits');
assert.equal(typeof instantiateEnrollmentVisits,'function');
const added=await withFixtureTransaction(env,'direct',async tx=>{
 const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${accepted.runId}`;assert.equal(marker.manifest.studyId,accepted.study.id);assert.equal(marker.manifest.syntheticOnly,true);const scope=marker.manifest.scope;
 const source=await tx.studyProtocolVersion.findFirst({where:{...scope,id:accepted.sourceProtocolId,status:'superseded'},include:{visitPlans:{include:{requirements:true}}}});assert(source);
 const existing=await tx.subject.findMany({where:{...scope,subjectId:{startsWith:'SYNTHETIC-E-'}}});assert.equal(existing.length,0,'HISTORICAL_UI_ALREADY_PREPARED');
 const items={};
 for(const code of ['E','F','G']){
  const subject=await tx.subject.create({data:{...scope,subjectId:'SYNTHETIC-'+code+'-'+accepted.runId.slice(-8)}}),enrolledAt=new Date(source.createdAt.getTime()+100);
  const enrollment=await tx.studyEnrollment.create({data:{...scope,subjectId:subject.id,protocolVersionId:source.id,status:'enrolled',enrolledAt,createdBy:'synthetic-pre-t06-history'}});
  const anchor=await tx.studyEnrollmentAnchor.create({data:{...scope,enrollmentId:enrollment.id,kind:'enrollment',eventKey:'',occurredAt:enrolledAt,evidenceRefs:[{type:'study_enrollment',id:enrollment.id}],recordedBy:'synthetic-pre-t06-history'}});
  const rows=instantiateEnrollmentVisits({enrollmentId:enrollment.id,protocolVersionId:source.id,enrolledAt,plans:source.visitPlans}),visitIds=[];
  for(const row of rows){const visit=await tx.subjectVisit.create({data:{...scope,subjectId:subject.id,enrollmentId:enrollment.id,visitPlanId:row.visitPlanId,protocolVersionId:source.id,occurrence:row.occurrence,status:row.status,targetDate:row.targetDate,windowStart:row.windowStart,windowEnd:row.windowEnd,anchorAt:row.anchorAt,anchorRecordId:anchor.id,scheduleState:row.scheduleState}});visitIds.push(visit.id);const requirements=source.visitPlans.find(p=>p.id===row.visitPlanId).requirements;if(requirements.length)await tx.visitRequirementFulfillment.createMany({data:requirements.map(r=>({...scope,subjectVisitId:visit.id,visitRequirementId:r.id,status:'missing',source:'system',ruleVersion:'visit-requirement-v1'}))});}
  const task=await tx.studyTask.create({data:{...scope,subjectId:subject.id,enrollmentId:enrollment.id,subjectVisitId:visitIds[0],source:'manual',taskType:'data_capture',name:'合成历史访视采集',status:'open'}});
  items[code]={subjectId:subject.id,subjectCode:subject.subjectId,enrollmentId:enrollment.id,visitId:visitIds[0],taskId:task.id};
 }
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${accepted.runId+'-historical-ui'},${JSON.stringify({syntheticOnly:true,parentRunId:accepted.runId,studyId:accepted.study.id,sourceProtocolId:source.id,purpose:'explicit-pre-T06-historical-migration-ui',fixtureSeed:true,normalEnrollmentBypassAdded:false})}::jsonb)`;
 return items;
});
accepted.historicalUiCases=added;writeFileSync(pointer.acceptedFile,JSON.stringify(accepted,null,2),{mode:0o600});
const result={at:new Date().toISOString(),passed:true,syntheticOnly:true,fixtureSeed:true,normalEnrollmentBypassAdded:false,parentRunId:accepted.runId,studyId:accepted.study.id,sourceProtocolId:accepted.sourceProtocolId,items:added};
writeFileSync(workspaceRoot+'researchhub/docs/testing/evidence/research-t05-2026-11-11/'+accepted.runId+'/historical-ui-fixture.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,subjectCodes:Object.values(added).map(x=>x.subjectCode),purpose:result.purpose??'explicit historical UI fixture'}));
