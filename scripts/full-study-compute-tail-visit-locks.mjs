// Explicit local synthetic-fixture probe. All transactions that can write are forced to roll back.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';
import {withFullStudyVisitReads} from '../server/research-analysis/full-study-visit-reads.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = root + 'researchhub/docs/testing/evidence/';
const task = evidence + 'full-study-compute-tail-2026-11-16/';
const studyId = 'rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25';
const scope = Object.freeze({tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-full-study-b230c34b-group',researchProjectId:'cmweunjpe001iluicrmxl5ii5'});
const rootHash = '8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7';
const caseHash = '09148434d355b7d44d582786b63547cdb850191575f4e741edc4af52a8a0842f';
const fixtureId = 'rh-full-study-b230c34b';
const adminId = 'rh-kb-local-b0e2af9d-admin';
const json = p => JSON.parse(readFileSync(p,'utf8'));
const normalize = value => JSON.parse(JSON.stringify(value));
const sorted = rows => [...rows].sort((a,b)=>a.id.localeCompare(b.id));
const table = rows => ({count:rows.length,hash:fullStudyHash(sorted(normalize(rows)))});
const sqlState = error => error?.meta?.code ?? error?.cause?.code ?? error?.code;
const errorInfo = error => ({name:error?.name,code:error?.code??null,sqlState:error?.meta?.code??null,message:String(error?.message??error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[redacted]').slice(0,600)});
const assertScope = row => {for(const key of Object.keys(scope))assert.equal(row?.[key],scope[key]);};

function frozenInputs(){
 const snapshot=json(evidence+'real-study-full-simulation-2026-11-13/report-corrected/snapshot.json'), prior=json(task+'live-freeze/run-9fb87de0/native-runs-156.json'), baseline=json(task+'actual/baseline/actual-method-runs.json');
 assert.equal(snapshot.basis.studyId,studyId);assert.equal(snapshot.basis.snapshotId,'full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198');
 assert.equal(fullStudyHash(snapshot.manifest),rootHash);assert.equal(snapshot.basis.manifestHash,rootHash);
 assert.equal(fullStudyHash(snapshot.manifest.caseMetadata),caseHash);assertScope(snapshot.manifest.scope);
 const c=snapshot.manifest.caseMetadata, subjectIds=c.subjects.map(s=>s.id).sort();
 assert.equal(subjectIds.length,6);assert.equal(new Set(subjectIds).size,6);
 const obs=snapshot.manifest.observations;assert.equal(obs.length,18);
 const o=obs[0];assert(subjectIds.includes(o.subjectId));assert.equal(o.visitStatus,'completed');
 assert.equal(prior.runs.length,156);assert.equal(baseline.runs.length,39);
 assert.equal(baseline.runGroupId,'full-run-b45d1768-8f72-406a-9da5-cb083aead9db');
 const historical=[...prior.runs,...baseline.runs];assert.equal(new Set(historical.map(r=>r.id)).size,195);
 for(const r of historical){assertScope(r);assert.equal(r.inputSummary.studyId,studyId);}
 return {c,subjectIds,historical,binding:{subjectId:o.subjectId,enrollmentId:o.enrollmentId,visitId:o.visitId,visitPlanId:o.visitPlanId,protocolVersionId:c.protocolVersionId}};
}

function assertVisit(v,b){
 assertScope(v);assert.equal(v.id,b.visitId);assert.equal(v.subjectId,b.subjectId);assert.equal(v.enrollmentId,b.enrollmentId);assert.equal(v.visitPlanId,b.visitPlanId);assert.equal(v.protocolVersionId,b.protocolVersionId);assert.equal(v.acceptanceFixture,false);assert.equal(v.status,'completed');assert.equal(v.scheduleState,'scheduled');
}
function assertObserved(row,waiter,holder,relation){
 assert(Number.isSafeInteger(waiter)&&Number.isSafeInteger(holder)&&waiter!==holder);
 assert.equal(row?.pid,waiter);assert.equal(row.wait_event_type,'Lock');assert(row.blockers.includes(holder));
 assert(row.query.trimStart().startsWith('UPDATE public.'+relation+' SET '));
}
function selfTest(){
 const {binding:b}=frozenInputs(),v={...scope,id:b.visitId,...b,status:'completed',scheduleState:'scheduled',acceptanceFixture:false};
 assertVisit(v,b);
 for(const bad of [{id:'other'},{subjectId:'other'},{enrollmentId:'other'},{visitPlanId:'other'},{protocolVersionId:'other'},{tenantId:'other'},{scheduleState:'pending_anchor'},{acceptanceFixture:true}])assert.throws(()=>assertVisit({...v,...bad},b));
 const row={pid:13,wait_event_type:'Lock',blockers:[12],query:'UPDATE public.subject_visit SET "scheduleState"=$1'};
 assertObserved(row,13,12,'subject_visit');
 for(const bad of [{blockers:[]},{wait_event_type:'IO'},{pid:12},{query:'SELECT 1'}])assert.throws(()=>assertObserved({...row,...bad},13,12,'subject_visit'));
 console.log(JSON.stringify({passed:true,mode:'offline',fixedSubjects:6,protectedRuns:195,rejectedVisitMismatches:8,rejectedWaitMismatches:4,databaseCalls:0}));
}

async function probe(){
 const {fixtureEnvironment}=await import('./research-creation-fixture.mjs');
 const {assertFixtureTarget,validateFixtureConfig,withFixtureTransaction}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const {createSimulationAdmission}=await import('../server/research-simulation/admission.mjs');
 const {runtimeDependencies}=await import('../server/research-runtime/dependencies.mjs');
 const {setContext}=await import('../server/research-studies/repository.mjs');
 const data=frozenInputs(),{subjectIds,binding:b}=data,env=fixtureEnvironment(),cfg=validateFixtureConfig(env);
 assert.equal(cfg.databaseName,'wp01_test_full_baseline');await assertFixtureTarget(env);
 const out=task+'visit-locks/run-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
 const result={passed:false,syntheticOnly:true,studyId,scope,binding:b,caseHash,transactions:[],contention:[],httpCalls:0,workerCalls:0};
 const save=()=>writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});
 const admission=createSimulationAdmission({targets:json(root+'.tmp/real-study-full-simulation-2026-11-13/targets.json')});
 const {load}=runtimeDependencies(),authLock=load('common/worker-publication','lockAuthorizationMutation'),bindingLock=load('study-operations/protocol-migration-lock','lockCaptureBinding'),capture=load('study-operations/participation-capture','assertParticipationCapture');
 let user,before,failure;
 async function readState(){
  return withFixtureTransaction(env,'direct',async tx=>{
   const [registration]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${fixtureId}`;
   assert.equal(registration?.manifest?.syntheticOnly,true);assert.equal(registration.manifest.studyId,studyId);assertScope(registration.manifest.scope);
   assert.equal(fullStudyHash(await admission.resolveCase(tx,scope)),caseHash);
   const actor=await tx.account.findFirst({where:{id:adminId,tenantId:scope.tenantId,status:'active'},select:{id:true,role:true,isTenantAdmin:true,authVersion:true}});
   assert.equal(actor?.role,'tenant_admin');assert.equal(actor.isTenantAdmin,true);assert(Number.isSafeInteger(actor.authVersion));
   const subjects=await tx.subject.findMany({where:{...scope,id:{in:subjectIds},acceptanceFixture:false,deletedAt:null}});
   const enrolled=await tx.studyEnrollment.findMany({where:{...scope,subjectId:{in:subjectIds},protocolVersionId:b.protocolVersionId,acceptanceFixture:false}});
   const visits=await tx.subjectVisit.findMany({where:{...scope,subjectId:{in:subjectIds},protocolVersionId:b.protocolVersionId,acceptanceFixture:false}});
   const assignments=await tx.formAssignment.findMany({where:{...scope,subjectId:{in:subjectIds},acceptanceFixture:false}});
   const responses=await tx.formResponse.findMany({where:{...scope,assignmentId:{in:assignments.map(r=>r.id)}}});
   const revisions=await tx.formResponseRevision.findMany({where:{...scope,assignmentId:{in:assignments.map(r=>r.id)}}});
   const runs=await tx.researchMethodRun.findMany({where:{...scope,id:{in:data.historical.map(r=>r.id)}}});
   assert.deepEqual([subjects.length,enrolled.length,visits.length,assignments.length,responses.length,revisions.length,runs.length],[6,6,18,46,46,48,195]);
   assert.deepEqual(table(runs),table(data.historical));assertVisit(visits.find(v=>v.id===b.visitId),b);
   return {actor,subjects:table(subjects),enrollments:table(enrolled),visits:table(visits),assignments:table(assignments),responses:table(responses),revisions:table(revisions),historicalRuns:table(runs)};
  },{readOnly:true});
 }
 async function rollback(label,operation){
  const stop=Error('VISIT_LOCK_ROLLBACK'),entry={label,startedAt:new Date().toISOString(),forcedRollback:false};result.transactions.push(entry);
  let value,problem;
  try{
   await withFixtureTransaction(env,'app',async tx=>{
    try{await setContext(tx,user,scope.studyGroupId,scope.researchProjectId);value=await operation(tx);}catch(e){problem=e;}
    throw stop;
   });
   throw Error('VISIT_LOCK_UNEXPECTED_COMMIT');
  }catch(e){if(e!==stop)throw e;entry.forcedRollback=true;entry.finishedAt=new Date().toISOString();}
  if(problem)throw problem;return value;
 }
 async function contend(holder,relation){
  assert(['study_enrollment','subject_visit'].includes(relation));
  const record={relation,holder};result.contention.push(record);
  await withFixtureTransaction(env,'direct',async observer=>{
   const started=Promise.withResolvers();
   const writer=rollback('blocked-'+relation,async tx=>{
    await tx.$executeRawUnsafe('SET LOCAL lock_timeout = 1800');
    const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;started.resolve(pid);
    try{
     if(relation==='study_enrollment')await tx.$executeRaw`UPDATE public.study_enrollment SET status=status WHERE id=${b.enrollmentId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND "subjectId"=${b.subjectId} AND "protocolVersionId"=${b.protocolVersionId} AND "acceptanceFixture"=false`;
     else await tx.$executeRaw`UPDATE public.subject_visit SET "scheduleState"='pending_anchor' WHERE id=${b.visitId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND "subjectId"=${b.subjectId} AND "enrollmentId"=${b.enrollmentId} AND "protocolVersionId"=${b.protocolVersionId} AND "visitPlanId"=${b.visitPlanId} AND "acceptanceFixture"=false AND "scheduleState"='scheduled'`;
    }catch(e){assert.equal(sqlState(e),'55P03');record.sqlState=sqlState(e);return;}
    throw Error('VISIT_LOCK_WRITER_DID_NOT_TIME_OUT');
   }).then(()=>null,e=>{started.resolve(null);return e;});
   try{
    const pid=await started.promise;assert(Number.isSafeInteger(pid));record.waiter=pid;
    const deadline=performance.now()+2400;
    do{
     const [waiting]=await observer.$queryRaw`SELECT pid,wait_event_type,query,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND pid=${pid}`;
     if(waiting?.blockers?.includes(holder)&&waiting.wait_event_type==='Lock'){
      assertObserved(waiting,pid,holder,relation);record.observed={at:new Date().toISOString(),waitEventType:waiting.wait_event_type,blockers:waiting.blockers};break;
     }
     // pg_stat_activity is a transaction-scoped statistics snapshot.
     await observer.$executeRaw`SELECT pg_stat_clear_snapshot()`;await delay(20);
    }while(performance.now()<deadline);
   }finally{const error=await writer;if(error)throw error;}
   assert(record.observed,'VISIT_LOCK_ACTUAL_BLOCKING_PID_REQUIRED');assert.equal(record.sqlState,'55P03');
  },{readOnly:true});
 }
 try{
  before=await readState();result.before=before;user={...scope,accountId:adminId,authVersion:before.actor.authVersion};
  await rollback('native-binding-holder',async tx=>{
   await authLock(tx,scope.tenantId,{includeOfficial:true});
   const enrollment=await tx.studyEnrollment.findFirst({where:{...scope,id:b.enrollmentId,subjectId:b.subjectId,protocolVersionId:b.protocolVersionId,acceptanceFixture:false}});assert(enrollment);
   const locked=()=>bindingLock(tx,scope,{subjectId:b.subjectId,enrollmentId:b.enrollmentId,subjectVisitId:b.visitId,expectedEnrollment:enrollment,requireCurrentConsent:true});
   await locked();const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
   const counts={visitReads:0,enrollmentReads:0,consentSQL:0,visitLockSQL:0};
   const delegate=(source,key)=>new Proxy(source,{get(target,name){const fn=Reflect.get(target,name,target);if(name==='findFirst')return(...args)=>{counts[key]++;return fn.apply(target,args);};return typeof fn==='function'?fn.bind(target):fn;}});
   const counted=new Proxy(tx,{get(target,name){const value=Reflect.get(target,name,target);
    if(name==='subjectVisit')return delegate(value,'visitReads');if(name==='studyEnrollment')return delegate(value,'enrollmentReads');
    if(name==='$queryRaw')return(...args)=>{const sql=args[0].join('?');if(sql.includes('FROM public.study_participation_event'))counts.consentSQL++;if(sql.includes('FROM public.subject_visit')&&sql.endsWith('FOR UPDATE'))counts.visitLockSQL++;return value.apply(target,args);};
    return typeof value==='function'?value.bind(target):value;
   }});
   const v1={where:{...scope,id:b.visitId},select:{status:true,scheduleState:true}},e2={where:{...scope,id:b.enrollmentId,subjectId:b.subjectId,acceptanceFixture:false},select:{id:true,subjectId:true,protocolVersionId:true,status:true}};
   let escaped;await withFullStudyVisitReads(counted,scope,b,async view=>{
    escaped=view.subjectVisit.findFirst;assert.equal((await escaped(v1)).scheduleState,'scheduled');assert.deepEqual(await escaped(v1),{status:'completed',scheduleState:'scheduled'});assert.equal(counts.visitReads,1);
    const first=await view.studyEnrollment.findFirst(e2);assert.equal(first.id,b.enrollmentId);assert.deepEqual(await view.studyEnrollment.findFirst(e2),first);assert.equal(counts.enrollmentReads,1);
    for(let i=0;i<2;i++){
     await capture(view,scope,enrollment);
     await bindingLock(view,scope,{subjectId:b.subjectId,enrollmentId:b.enrollmentId,subjectVisitId:b.visitId,expectedEnrollment:enrollment,requireCurrentConsent:true});
    }
    assert.equal(counts.consentSQL,4);assert.equal(counts.visitLockSQL,2);
    const beforeScalar={...counts};await view.subjectVisit.findFirst(v1);await view.studyEnrollment.findFirst(e2);assert.deepEqual(counts,beforeScalar);
    await contend(pid,'study_enrollment');await contend(pid,'subject_visit');
    const n=await view.$executeRaw`UPDATE public.subject_visit SET "scheduleState"='pending_anchor' WHERE id=${b.visitId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND "subjectId"=${b.subjectId} AND "enrollmentId"=${b.enrollmentId} AND "protocolVersionId"=${b.protocolVersionId} AND "visitPlanId"=${b.visitPlanId} AND status='completed' AND "acceptanceFixture"=false AND "scheduleState"='scheduled'`;assert.equal(n,1);
    assert.deepEqual(await view.subjectVisit.findFirst(v1),{status:'completed',scheduleState:'pending_anchor'});assert.equal(counts.visitReads,beforeScalar.visitReads+1);
    result.inTransaction={initial:'scheduled',afterOwnUpdate:'pending_anchor',ownUpdatedRows:n,scalarCountsBeforeUpdate:beforeScalar,countsAfterUpdate:{...counts}};
   });
   const beforeExpired={...counts};await assert.rejects(escaped(v1),/VISIT_READS_EXPIRED/);assert.deepEqual(counts,beforeExpired);result.expiredCallReachedDatabase=false;
  });
 }catch(e){failure=e;}finally{
  if(before){try{result.after=await readState();assert.deepEqual(result.after,before);result.afterHashesMatched=true;}catch(e){failure??=e;result.afterGuardFailure=errorInfo(e);}}
  result.passed=!failure&&result.afterHashesMatched===true&&result.transactions.length===3&&result.transactions.every(t=>t.forcedRollback);if(failure)result.failure=errorInfo(failure);
  save();console.log(JSON.stringify({passed:result.passed,evidence:out}));if(!result.passed)process.exitCode=1;
 }
}

const mode=process.argv.slice(2);
if(mode.length===1&&mode[0]==='--self-test')selfTest();
else if(mode.length===1&&mode[0]==='--local-synthetic'&&process.env.FULL_STUDY_VISIT_LOCK_WINDOW==='explicit')await probe();
else{console.error(JSON.stringify({guardRejected:true,databaseCalls:0,code:'EXPLICIT_VISIT_LOCK_WINDOW_REQUIRED'}));process.exitCode=2;}
