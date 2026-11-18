// Synthetic after-2 QA only. A writer returning normally is still rolled back.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const base=root+'researchhub/docs/testing/evidence/';
const task=base+'full-study-compute-tail-2026-11-16/';
const frozen=task+'fresh-old234/run-86e9656d/';
const scope={tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-full-study-b230c34b-group',researchProjectId:'cmweunjpe001iluicrmxl5ii5'};
const studyId='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25',actorId='rh-kb-local-b0e2af9d-admin';
const caseHash='09148434d355b7d44d582786b63547cdb850191575f4e741edc4af52a8a0842f';
const diagGroup='full-run-36bf2af8-b9b1-44d6-a913-da12675706fc';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const table=rows=>({count:rows.length,hash:fullStudyHash([...rows].sort((a,b)=>a.id.localeCompare(b.id)))});
const assertScope=row=>{for(const k of Object.keys(scope))assert.equal(row[k],scope[k]);};
export function requireWindow(argv,window){
 assert.deepEqual(argv,['--local-synthetic','after-2'],'AFTER2_LOCAL_SYNTHETIC_REQUIRED');
 assert.equal(window,'explicit','LOCKED_METADATA_PG_WINDOW_REQUIRED');
}
export function checkedInputs(){
 const source=json(base+'real-study-full-simulation-2026-11-13/report-corrected/snapshot.json'),c=source.manifest.caseMetadata;
 assert.equal(fullStudyHash(c),caseHash);assert.equal(source.basis.studyId,studyId);assertScope(c.scope);
 assert.equal(fullStudyHash(source.manifest),'8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7');
 const subjects=c.subjects.map(s=>s.id).sort(),o=source.manifest.observations[0];
 assert.equal(subjects.length,6);assert.equal(new Set(subjects).size,6);assert(subjects.includes(o.subjectId));assert.equal(o.visitStatus,'completed');
 const old234=json(task+'candidates/old-native-runs-234.json'),fresh=json(frozen+'native-runs-234.json'),extra=json(task+'actual/diagnostic/actual-method-runs.json'),proof=json(task+'profile/diagnostic-four-runs/native-and-stage-proof.json');
 assert.equal(json(frozen+'result.json').passed,true);assert.equal(old234.runs.length,234);assert.deepEqual(table(fresh.runs),table(old234.runs));
 assert.equal(extra.runGroupId,diagGroup);assert.equal(proof.groupId,diagGroup);assert.equal(extra.runs.length,4);assert.deepEqual(table(extra.runs),table(proof.native.runs));
 const oldRuns=[...old234.runs,...extra.runs];assert.equal(new Set(oldRuns.map(r=>r.id)).size,238);
 for(const r of oldRuns){assertScope(r);assert.equal(r.inputSummary.studyId,studyId);}
 const revisions=json(frozen+'native-revisions-full-48.json'),children=json(frozen+'child-snapshots-39.json');
 assert.equal(new Set(revisions.map(r=>r.id)).size,48);assert.equal(new Set(children.map(r=>r.id)).size,39);
 const files=Object.values(json(frozen+'scientific-files.json')).filter(f=>!f.authorizedProfileScriptException);
 assert.equal(files.length,36);
 return {c,subjects,b:{subjectId:o.subjectId,enrollmentId:o.enrollmentId,visitId:o.visitId,visitPlanId:o.visitPlanId,protocolVersionId:c.protocolVersionId},oldRuns,revisions,children,files};
}
const waitPrefix={enrollment:'UPDATE public.study_enrollment SET ',visit:'UPDATE public.subject_visit SET ',withdraw:'SELECT pg_advisory_xact_lock(', 'direct-insert':'INSERT INTO public.study_participation_event '};
export function checkWait(op,row,waiter,holder){
 assert(Object.hasOwn(waitPrefix,op));assert(Number.isSafeInteger(waiter)&&Number.isSafeInteger(holder)&&waiter!==holder);
 assert.equal(row?.pid,waiter);assert.equal(row.wait_event_type,'Lock');assert(row.blockers.includes(holder));assert(row.query.trimStart().startsWith(waitPrefix[op]));
}
export async function forceRollback(transaction,label,records,operation){
 const token=Error('LOCKED_METADATA_FORCE_ROLLBACK'),record={label,startedAt:new Date().toISOString(),rolledBack:false};
 records.push(record);let result,problem;
 try{
  await transaction(async tx=>{try{result=await operation(tx);}catch(e){problem=e;}throw token;});
  throw Error('LOCKED_METADATA_UNEXPECTED_COMMIT');
 }catch(e){if(e!==token)throw e;record.rolledBack=true;record.finishedAt=new Date().toISOString();}
 if(problem)throw problem;return result;
}
export async function readOutreach(tx,assignmentIds){
 assert.equal(assignmentIds.length,46);
 assert.equal(new Set(assignmentIds).size,46);
 const relation={...scope,assignmentId:{in:assignmentIds}};
 const invitations=await tx.questionnaireInvitation.findMany({where:relation});
 const sessions=await tx.questionnaireSession.findMany({where:relation});
 return {invitations,sessions};
}
function countedView(tx,counts){
 const classify=sql=>sql.startsWith('SELECT id,"subjectId","protocolVersionId",status FROM public.study_enrollment ')?'eLock':
  sql.startsWith('SELECT id,"subjectId","enrollmentId","protocolVersionId",status FROM public.subject_visit ')?'vLock':
  sql.startsWith('SELECT kind,decision,method,evidence,reason,signer,"textVersion",scope FROM public.study_participation_event ')?'consent':
  sql.startsWith('SELECT ep.id FROM public.study_execution_policy_version ep JOIN ')?'policyLink':null;
 return new Proxy(tx,{get(target,k){
  const v=Reflect.get(target,k,target);
  if(k==='$queryRaw')return(...args)=>{const n=Array.isArray(args[0])&&classify(args[0].join('?'));if(n)counts[n]++;return v.apply(target,args);};
  if(['studyEnrollment','subjectVisit','studyProtocolVersion'].includes(k))return new Proxy(v,{get(model,m){const fn=Reflect.get(model,m,model);if(m==='findFirst')return arg=>{if(arg.select)counts[k]++;return fn.call(model,arg);};return typeof fn==='function'?fn.bind(model):fn;}});
  return typeof v==='function'?v.bind(target):v;
 }});
}
async function run(){
 const {withFullStudyLockedMetadataReads:withView}=await import('../server/research-analysis/full-study-locked-metadata-reads.mjs');
 const {createFullStudyCore}=await import('../server/research-analysis/full-study-core.mjs');
 const {createSimulationAdmission}=await import('../server/research-simulation/admission.mjs');
 const {runtimeDependencies}=await import('../server/research-runtime/dependencies.mjs');
 const {setContext}=await import('../server/research-studies/repository.mjs');
 const {fixtureEnvironment}=await import('./research-creation-fixture.mjs');
 const {assertFixtureTarget,validateFixtureConfig,withFixtureTransaction}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const data=checkedInputs(),{c,b,subjects}=data,env=fixtureEnvironment();
 assert.equal(validateFixtureConfig(env).databaseName,'wp01_test_full_baseline');await assertFixtureTarget(env);
 const admission=createSimulationAdmission({targets:json(root+'.tmp/real-study-full-simulation-2026-11-13/targets.json')});
 const {load}=runtimeDependencies(),core=createFullStudyCore({load,resolveCase:admission.resolveCase});
 const native=(file,fn)=>load('study-operations/'+file,fn),authLock=load('common/worker-publication','lockAuthorizationMutation');
 const lockP=native('protocol-migration-lock','lockCaptureScope'),lockBinding=native('protocol-migration-lock','lockCaptureBinding'),capture=native('participation-capture','assertParticipationCapture'),withdraw=native('participation-events','recordParticipationInTransaction');
 const nativeVerify=native('formal-response-history','verifyFormalRevisionEnvelope'),readHistory=native('formal-response-history','readFormalResponseRevisionInTransaction');
 const out=task+'locked-metadata-pg/run-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
 const result={syntheticOnly:true,studyId,scope,binding:b,caseHash,readOnlyOutsideRollback:true,transactions:[],waits:[],workerCalls:0,httpCalls:0};
 const code=e=>e?.getResponse?.()?.code??e?.meta?.code??e?.cause?.code??e?.code??e?.name;
 // Preserve assertion/control-site diagnostics without ever logging returned consent/clinical rows.
 const failure=e=>({code:code(e),site:String(e?.stack??'').split('\n').find(l=>l.startsWith('    at ')&&l.includes('locked-metadata-pg.mjs'))?.trim()??null});
 let actor,initial,problem;
 const originalFiles=()=>Object.fromEntries(data.files.map(f=>{assert.equal(sha(root+f.path),f.sha256,'SCIENTIFIC_FILE_CHANGED');return[f.path,f.sha256];}));
 async function state(){
  const scientific=originalFiles();
  return withFixtureTransaction(env,'direct',async tx=>{
   const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${'rh-full-study-b230c34b'}`;
   assert.equal(marker?.manifest?.syntheticOnly,true);assert.equal(marker.manifest.studyId,studyId);assertScope(marker.manifest.scope);
   assert.equal(fullStudyHash(await admission.resolveCase(tx,scope)),caseHash);
   const a=await tx.account.findFirst({where:{tenantId:scope.tenantId,id:actorId,status:'active'},select:{id:true,authVersion:true,role:true,isTenantAdmin:true}});
   assert.equal(a?.role,'tenant_admin');assert.equal(a.isTenantAdmin,true);assert(Number.isSafeInteger(a.authVersion));
   const sourceWhere={...scope,subjectId:{in:subjects},protocolVersionId:b.protocolVersionId,acceptanceFixture:false};
   const es=await tx.studyEnrollment.findMany({where:sourceWhere}),vs=await tx.subjectVisit.findMany({where:sourceWhere});
   assert.equal(es.length,6);assert.equal(vs.length,18);const v=vs.find(r=>r.id===b.visitId);
   assert.equal(v.enrollmentId,b.enrollmentId);assert.equal(v.subjectId,b.subjectId);assert.equal(v.visitPlanId,b.visitPlanId);assert.equal(v.status,'completed');assert.equal(v.scheduleState,'scheduled');
   const events=await tx.$queryRaw`SELECT * FROM public.study_participation_event WHERE "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND "subjectId"=ANY(${subjects}::text[]) ORDER BY id`;
   const assignments=await tx.formAssignment.findMany({where:{...scope,subjectId:{in:subjects},acceptanceFixture:false}}),assignmentIds=assignments.map(r=>r.id);
   const revisions=await tx.formResponseRevision.findMany({where:{...scope,assignmentId:{in:assignmentIds}}});revisions.forEach(nativeVerify);
   const childIds=data.children.map(x=>x.id),children=await tx.$queryRaw`SELECT * FROM rh_analysis.snapshot WHERE tenant_id=${scope.tenantId} AND study_group_id=${scope.studyGroupId} AND research_project_id=${scope.researchProjectId} AND study_id=${studyId} AND id=ANY(${childIds}::text[]) ORDER BY id`;
   const old=await tx.researchMethodRun.findMany({where:{...scope,id:{in:data.oldRuns.map(r=>r.id)}}});
   assert.deepEqual(table(old),table(data.oldRuns));assert.deepEqual(table(revisions),table(data.revisions));assert.deepEqual(table(children),table(data.children));
   assert.deepEqual([...assignmentIds].sort(),[...new Set(data.revisions.map(r=>r.assignmentId))].sort());
   const {invitations,sessions}=await readOutreach(tx,assignmentIds);
   const audit=await tx.auditLog.findMany({where:{...scope,action:'study_participation_record'}});
   return {actor:a,enrollments:table(es),visits:table(vs),participation:table(events),assignments:table(assignments),outreachInvitations:table(invitations),outreachSessions:table(sessions),participationAudits:table(audit),native238:table(old),raw48:table(revisions),child39:table(children),scientific36:{count:data.files.length,hash:fullStudyHash(scientific)}};
  },{readOnly:true});
 }
 const app=fn=>withFixtureTransaction(env,'app',async tx=>{await setContext(tx,actor,scope.studyGroupId,scope.researchProjectId);return fn(tx);});
 const rb=(label,fn)=>forceRollback(app,label,result.transactions,fn);
 const input=()=>({kind:'data_use_consent',decision:'withdrawn',effectiveAt:new Date(),reason:'synthetic rollback QA',evidence:'synthetic rollback QA'});
 const Pq={where:{...scope,id:c.protocolVersionId,acceptanceFixture:false,status:{in:['executing','superseded']}},select:{id:true}};
 const Eq={where:{...scope,id:b.enrollmentId,subjectId:b.subjectId,acceptanceFixture:false},select:{id:true,subjectId:true,protocolVersionId:true,status:true}};
 const Vq={where:{...scope,id:b.visitId},select:{status:true,scheduleState:true}};
 const counts=()=>({eLock:0,vLock:0,consent:0,policyLink:0,studyEnrollment:0,subjectVisit:0,studyProtocolVersion:0});
 const spec=e=>({subjectId:b.subjectId,enrollmentId:b.enrollmentId,subjectVisitId:b.visitId,expectedEnrollment:e,requireCurrentConsent:true});
 const bulk=async view=>{const rows=await view.$queryRaw`SELECT id FROM public.subject WHERE "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND id=ANY(${subjects}::text[]) AND "deletedAt" IS NULL AND "acceptanceFixture"=false ORDER BY id FOR UPDATE`;assert.deepEqual(rows.map(x=>x.id).sort(),subjects);};
 async function holder(label,fn){
  return rb(label,async tx=>{
   await authLock(tx,scope.tenantId,{includeOfficial:true});
   const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
   const observedCase=await core.validateCase(tx,scope,studyId,c);assert.equal(fullStudyHash(observedCase),caseHash);
   const e=await tx.studyEnrollment.findFirst(Eq);assert.equal(e?.protocolVersionId,b.protocolVersionId);assert.equal(e.subjectId,b.subjectId);
   const calls=counts();return withView(countedView(tx,calls),scope,observedCase,view=>fn({view,pid,e,calls}));
  });
 }
 async function directInsert(tx){
  const [row]=await tx.$queryRaw`SELECT COALESCE(MAX(sequence),0)::int AS n FROM public.study_participation_event WHERE "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND "subjectId"=${b.subjectId}`;
  // Null enrollment isolates the nonnull subject FK from the enrollment FK.
  return tx.$executeRaw`INSERT INTO public.study_participation_event (id,"tenantId","studyGroupId","researchProjectId","subjectId","enrollmentId","protocolVersionId","policyVersionId","policyHash",sequence,kind,decision,evidence,reason,"effectiveAt","recordedBy") VALUES (${'spe-qa-'+randomUUID()},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},${b.subjectId},NULL,${b.protocolVersionId},${c.policyId},${c.policyHash},${row.n+1},'data_use_consent','withdrawn','synthetic rollback QA','synthetic rollback QA',CURRENT_TIMESTAMP,${actorId})`;
 }
 async function contention(pid,op,write){
  const record={operation:op,holder:pid};result.waits.push(record);
  await withFixtureTransaction(env,'direct',async obs=>{
   const started=Promise.withResolvers();
   const writer=rb('writer-'+op,async tx=>{
    await tx.$executeRawUnsafe('SET LOCAL lock_timeout = 1400');const [{pid:waiter}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;started.resolve(waiter);
    try{await write(tx);}catch(e){assert.equal(code(e),'55P03');record.sqlState='55P03';return;}
    throw Error('WRITER_DID_NOT_TIME_OUT');
   }).then(()=>null,e=>{started.resolve(null);return e;});
   try{
    const waiter=await started.promise;assert(Number.isSafeInteger(waiter));record.waiter=waiter;const deadline=performance.now()+2150;
    do{
     await obs.$executeRaw`SELECT pg_stat_clear_snapshot()`;
     const [row]=await obs.$queryRaw`SELECT pid,query,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND pid=${waiter}`;
     if(row?.wait_event_type==='Lock'&&row.blockers?.includes(pid)){checkWait(op,row,waiter,pid);record.observed={at:new Date().toISOString(),waitEventType:'Lock',blockers:row.blockers,statementPrefix:waitPrefix[op]};break;}
     await delay(20);
    }while(performance.now()<deadline);
   }finally{const e=await writer;if(e)throw e;}
   assert(record.observed,'BLOCKING_PID_NOT_OBSERVED');assert.equal(record.sqlState,'55P03');
  },{readOnly:true});
 }
 try{
  initial=await state();result.before=initial;actor={...scope,accountId:actorId,role:initial.actor.role,isTenantAdmin:initial.actor.isTenantAdmin,authVersion:initial.actor.authVersion};
  await holder('holder-source-locks',async({view,pid,e,calls})=>{
   await bulk(view);
   await lockBinding(view,scope,spec(e));await lockBinding(view,scope,spec(e));
   await capture(view,scope,e);await capture(view,scope,e);
   assert.equal(calls.eLock,1);assert.equal(calls.vLock,1);assert.equal(calls.consent,1);
   const snapshot=json(base+'real-study-full-simulation-2026-11-13/report-corrected/snapshot.json'),o=snapshot.manifest.observations.find(x=>x.visitId===b.visitId);
   const ref=Object.values(o.cells).map(x=>x.source?.ref).find(r=>r?.assignmentId);assert(ref);
   for(let i=0;i<2;i++){const fixed=await readHistory(view,actor,scope,ref.assignmentId,ref);assert.deepEqual(fixed.ref,ref);}
   assert.equal(calls.policyLink,1);assert.equal(calls.studyProtocolVersion,1);
   result.initialReadCounts={...calls};
   await contention(pid,'enrollment',tx=>tx.$executeRaw`UPDATE public.study_enrollment SET status=status WHERE id=${b.enrollmentId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND "subjectId"=${b.subjectId} AND "protocolVersionId"=${b.protocolVersionId} AND "acceptanceFixture"=false`);
   await contention(pid,'visit',tx=>tx.$executeRaw`UPDATE public.subject_visit SET "scheduleState"='pending_anchor' WHERE id=${b.visitId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} AND "subjectId"=${b.subjectId} AND "enrollmentId"=${b.enrollmentId} AND "protocolVersionId"=${b.protocolVersionId} AND "visitPlanId"=${b.visitPlanId} AND "acceptanceFixture"=false AND "scheduleState"='scheduled'`);
   await contention(pid,'withdraw',tx=>withdraw(tx,actor,scope,b.subjectId,input()));
   await contention(pid,'direct-insert',directInsert);
  });
  await holder('holder-own-withdrawal',async({view,e,calls})=>{
   await bulk(view);await lockBinding(view,scope,spec(e));await capture(view,scope,e);assert.equal(calls.consent,1);
   const event=await withdraw(view,actor,scope,b.subjectId,input());assert.equal(event.protocolVersionId,c.protocolVersionId);assert.equal(event.policyVersionId,c.policyId);
   const beforeRetry=calls.consent;await assert.rejects(capture(view,scope,e),err=>code(err)==='PARTICIPATION_CAPTURE_BLOCKED');assert.equal(calls.consent,beforeRetry+1);
   result.ownWithdrawal={originalRuleAccepted:true,afterNativeAppend:'PARTICIPATION_CAPTURE_BLOCKED',physicalConsentRequery:true};
  });
  await holder('holder-savepoint',async({view,e,calls})=>{
   await view.$executeRawUnsafe('SAVEPOINT rh_qa_visit_metadata');
   await lockP(view,scope,[c.protocolVersionId]);await bulk(view);await lockBinding(view,scope,spec(e));
   for(let i=0;i<2;i++){await view.studyEnrollment.findFirst(Eq);await view.subjectVisit.findFirst(Vq);await view.studyProtocolVersion.findFirst(Pq);}
   await view.$executeRawUnsafe('ROLLBACK TO SAVEPOINT rh_qa_visit_metadata');
   const before={...calls};for(let i=0;i<2;i++){await view.studyEnrollment.findFirst(Eq);await view.subjectVisit.findFirst(Vq);await view.studyProtocolVersion.findFirst(Pq);}
   for(const k of ['studyEnrollment','subjectVisit','studyProtocolVersion'])assert.equal(calls[k]-before[k],2);
   await rb('writer-after-savepoint',async tx=>{
    const E=await tx.$queryRaw`SELECT id FROM public.study_enrollment WHERE id=${b.enrollmentId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} FOR UPDATE NOWAIT`;
    const V=await tx.$queryRaw`SELECT id FROM public.subject_visit WHERE id=${b.visitId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} FOR UPDATE NOWAIT`;
    assert.deepEqual(E,[{id:b.enrollmentId}]);assert.deepEqual(V,[{id:b.visitId}]);
    assert.equal(await directInsert(tx),1); // The released subject FK lock also permits this insert now.
   });
   await lockP(view,scope,[c.protocolVersionId]);await bulk(view);const prior={...calls};await lockBinding(view,scope,spec(e));await lockBinding(view,scope,spec(e));
   assert.equal(calls.eLock-prior.eLock,1);assert.equal(calls.vLock-prior.vLock,1);await capture(view,scope,e);
   result.savepoint={postRollbackTwoPhysicalReadsPerShape:true,externalNowaitOnBothRows:true,externalNullableEnrollmentInsert:true,bindingsReacquired:true,originalConsentAccepted:true};
  });
 }catch(e){problem=e;}finally{
  if(initial){try{result.after=await state();assert.deepEqual(result.after,initial);result.protectedStateUnchanged=true;}catch(e){result.afterError=failure(e);problem??=e;}}
  result.passed=!problem&&result.protectedStateUnchanged&&result.transactions.length===8&&result.transactions.every(x=>x.rolledBack)&&result.waits.length===4;
  if(problem)result.failure=failure(problem);writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({passed:result.passed,evidence:out,completedRollbacks:result.transactions.filter(x=>x.rolledBack).length}));if(!result.passed)process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 requireWindow(process.argv.slice(2),process.env.FULL_STUDY_LOCKED_METADATA_WINDOW);
 await run();
}
