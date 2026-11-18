// Real PG concurrency evidence. Every transaction, including reads, rolls back.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {setTimeout as delay} from 'node:timers/promises';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,validateFixtureConfig,fixtureClient,readFixtureIdentity,checkFixtureIdentity} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createSimulationAdmission} from '../server/research-simulation/admission.mjs';
import {createFullStudyCore} from '../server/research-analysis/full-study-core.mjs';
import {createFullStudyAnalysis} from '../server/research-analysis/full-study-analysis.mjs';
import {createFullStudySourcePairReader} from '../server/research-analysis/full-study-source-pair.mjs';
import {memoizeFullStudyIdLocks} from '../server/research-analysis/full-study-id-locks.mjs';
import {memoizeFullStudyAuthorizationReads} from '../server/research-analysis/full-study-authorization-reads.mjs';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';
import {setContext} from '../server/research-studies/repository.mjs';

if(process.argv.length!==3||process.argv[2]!=='--local-synthetic'){
 console.error(JSON.stringify({guardRejected:true,code:'CONCURRENCY_LOCAL_SYNTHETIC_REQUIRED',databaseCalls:0}));process.exit(2);
}
const json=p=>JSON.parse(readFileSync(p,'utf8')),fileHash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const privateDir=workspaceRoot+'.tmp/real-study-full-simulation-2026-11-13/',evidenceRoot=workspaceRoot+'researchhub/docs/testing/evidence/';
const out=evidenceRoot+'full-study-performance-2026-11-13/concurrency/run-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
const save=(name,value)=>writeFileSync(out+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const code=e=>e?.getResponse?.()?.code??e?.code??e?.message;
const safeError=e=>({name:e?.name??null,code:code(e),sqlState:e?.meta?.code??null,message:String(e?.message??e).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[database-url-redacted]').slice(0,2200)});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const env=fixtureEnvironment(),cfg=validateFixtureConfig(env),b=json(privateDir+'bootstrap.json'),runtime=json(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json');
const snapshot=json(evidenceRoot+'real-study-full-simulation-2026-11-13/report-corrected/snapshot.json'),group=json(evidenceRoot+'real-study-full-simulation-2026-11-13/report-corrected/group.json'),correction=json(evidenceRoot+'real-study-full-simulation-2026-11-13/correction.json');
const baseline=json(evidenceRoot+'full-study-performance-2026-11-13/baseline/baseline.json'),scope=b.scope,subjectIds=b.manifest.subjects.map(x=>x.id).sort();
const originalFiles=Object.fromEntries(Object.entries(baseline.immutableInputs).map(([key,v])=>[key,{path:workspaceRoot+v.path,sha256:fileHash(workspaceRoot+v.path),baselineSha256:v.sha256}]));
const transactions=[],identities=[],cases=[];let user,target,before,after;
const deps=runtimeDependencies(),pair=createFullStudySourcePairReader(deps),admission=createSimulationAdmission({targets:json(privateDir+'targets.json')});
const nativeReview=deps.load('study-operations/formal-response-review','reviewFormalResponseInTransaction'),nativeLock=deps.load('common/worker-publication','lockAuthorizationMutation'),verify=deps.load('study-operations/formal-response-history','verifyFormalRevisionEnvelope');
const core=createFullStudyCore({load:deps.load,resolveCase:admission.resolveCase,readResponsePair:pair.readPair});
const analysis=createFullStudyAnalysis({studies:{withResearchStudyTransaction(){throw Error('CONCURRENCY_NESTED_TRANSACTION_REJECTED');}},load:deps.load,resolveCase:admission.resolveCase,core,cursorSecret:'concurrency-synthetic-test-only-secret'});

async function rollback(kind,label,fn,{readOnly=false,setup=true}={}){
 const client=fixtureClient(kind==='app'?cfg.databaseUrl:cfg.directUrl),abort=Error('CONCURRENCY_FORCE_ROLLBACK'),entry={kind,label,startedAt:new Date().toISOString(),rollbackConfirmed:false};transactions.push(entry);let value;
 try{
  await client.$transaction(async tx=>{
   entry.startedOnConnection=true;
   if(readOnly)await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 15000');
   const identity=await readFixtureIdentity(tx);checkFixtureIdentity(cfg,kind,identity);
   identities.push({label,kind,database:identity.database,role:identity.role,superuser:identity.superuser,bypassRls:identity.bypassRls});
   if(setup)await setContext(tx,user,scope.studyGroupId,scope.researchProjectId);
   value=await fn(tx);throw abort;
  },{isolationLevel:'ReadCommitted',maxWait:8000,timeout:45000});
  throw Error('CONCURRENCY_UNEXPECTED_COMMIT');
 }catch(error){entry.finishedAt=new Date().toISOString();entry.rollbackConfirmed=Boolean(entry.startedOnConnection)&&error.message!=='CONCURRENCY_UNEXPECTED_COMMIT';if(error!==abort){entry.error=safeError(error);throw error;}return value;}
 finally{await client.$disconnect();}
}
const view=tx=>memoizeFullStudyAuthorizationReads(memoizeFullStudyIdLocks(tx,scope));
function sourceSummary(value){return{assignmentId:value.current.assignment.id,responseId:value.current.response.id,version:value.current.response.version,ref:value.current.response.ref,locked:value.current.response.locked,review:value.current.response.review,fixedPresent:Boolean(value.fixed),fixedRef:value.fixed?.ref??null,fixedScoreHash:value.fixed?fullStudyHash(value.fixed.score):null};}

async function state(label){return rollback('direct',label,async tx=>{
 const tables={},remember=(name,rows)=>{const sorted=[...rows].sort((a,z)=>a.id.localeCompare(z.id));tables[name]={count:sorted.length,hash:fullStudyHash(sorted),rows:sorted.map(r=>({id:r.id,hash:fullStudyHash(r)}))};return rows;};
 const c=await admission.resolveCase(tx,scope);assert(c&&c.studyId===b.study.id&&fullStudyHash(c)===snapshot.manifest.caseHash,'CONCURRENCY_REGISTRATION_CHANGED');
 const subjects=remember('subject',await tx.subject.findMany({where:{...scope,id:{in:subjectIds},acceptanceFixture:false}}));assert.equal(subjects.length,6);
 const es=remember('studyEnrollment',await tx.studyEnrollment.findMany({where:{...scope,subjectId:{in:subjectIds},protocolVersionId:c.protocolVersionId,acceptanceFixture:false}}));assert.equal(es.length,6);
 const vs=remember('subjectVisit',await tx.subjectVisit.findMany({where:{...scope,subjectId:{in:subjectIds},protocolVersionId:c.protocolVersionId,acceptanceFixture:false}}));assert.equal(vs.length,18);
 const assignments=remember('formAssignment',await tx.formAssignment.findMany({where:{...scope,subjectId:{in:subjectIds},formVersionId:{in:c.forms.map(f=>f.id)},acceptanceFixture:false}}));assert.equal(assignments.length,46);
 const aids=assignments.map(a=>a.id),responses=remember('formResponse',await tx.formResponse.findMany({where:{...scope,assignmentId:{in:aids}}})),rids=responses.map(r=>r.id);assert.equal(responses.length,46);
 const revisions=remember('formResponseRevision',await tx.formResponseRevision.findMany({where:{...scope,assignmentId:{in:aids}}}));assert.equal(revisions.length,48);for(const r of revisions)verify(r);
 for(const [name,where]of [
  ['formResponseReviewEvent',{...scope,responseId:{in:rids}}],['formResponseCommandReceipt',{...scope,assignmentId:{in:aids}}],
  ['studyProtocolVersion',{...scope,id:c.protocolVersionId}],['studyExecutionPolicyVersion',{...scope,id:c.policyId}],
  ['formVersion',{...scope,id:{in:c.forms.map(f=>f.id)}}],['visitPlan',{...scope,id:{in:c.visitPlans.map(v=>v.id)}}],
  ['visitRequirement',{...scope,visitPlanId:{in:c.visitPlans.map(v=>v.id)}}],['visitRequirementFulfillment',{...scope,subjectVisitId:{in:vs.map(v=>v.id)}}],
  ['studyParticipationEvent',{...scope,subjectId:{in:subjectIds},protocolVersionId:c.protocolVersionId}],
  ['dataQuery',{...scope,acceptanceFixture:false}],['protocolDeviation',{...scope,acceptanceFixture:false}],
  ['researchMethodRun',{...scope,id:{in:group.slices.map(s=>s.methodRunId).filter(Boolean)}}],
  ['researchMethodReview',{...scope,runId:{in:group.slices.map(s=>s.methodRunId).filter(Boolean)}}],
  ['auditLog',{...scope,target:{in:[...rids,...aids]}}],
 ])remember(name,await tx[name].findMany({where}));
 const files=remember('modalityFile',await tx.modalityFile.findMany({where:{tenantId:scope.tenantId,subjectId:{in:subjectIds},subjectVisitId:{in:vs.map(v=>v.id)}}}));
 const tasks=remember('processingTask',await tx.processingTask.findMany({where:{...scope,modalityFileId:{in:files.map(f=>f.id)}}}));
 remember('feature',await tx.feature.findMany({where:{tenantId:scope.tenantId,sourceModalityFileId:{in:files.map(f=>f.id)},sourceProcessingTaskId:{in:tasks.map(t=>t.id)}}}));
 const actor=await tx.account.findFirst({where:{id:user.accountId,tenantId:scope.tenantId},select:{id:true,tenantId:true,status:true,authVersion:true,role:true,isTenantAdmin:true,updatedAt:true}});assert(actor);remember('syntheticActor',[actor]);
 return{at:new Date().toISOString(),caseHash:fullStudyHash(c),tables,hash:fullStudyHash(tables)};
},{readOnly:true});}

async function blocking(pid,holder){return rollback('direct','observe-blocking-'+pid,async tx=>{
 const started=performance.now();let attempts=0,last;
 do{
  attempts++;last=(await tx.$queryRaw`SELECT pid,state,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND pid=${pid}`)[0]??null;
  if(last?.blockers?.map(Number).includes(holder)){
   const locks=await tx.$queryRaw`SELECT pid,locktype,mode,granted,database::text,classid::text,objid::text,objsubid FROM pg_locks WHERE pid=ANY(${[pid,holder]}::int[]) AND locktype='advisory' ORDER BY pid,granted`;
   assert(locks.some(x=>Number(x.pid)===pid&&!x.granted),'CONCURRENCY_NO_NATIVE_WAITING_LOCK');
   return{observedAt:new Date().toISOString(),attempts,observationElapsedMs:performance.now()-started,activity:last,locks};
  }
  await delay(20);
 }while(performance.now()-started<6000);
 throw Object.assign(Error('CONCURRENCY_BLOCKER_NOT_OBSERVED'),{detail:last});
},{readOnly:true});}

async function scenario(kind){
 const held=deferred(),release=deferred(),pid=deferred();let bFinished=false;
 const record={kind,writerRequestKey:kind==='unlock'?'perf-unlock-'+randomUUID():null};cases.push(record);
 const a=rollback('app',kind+'-A',async raw=>{
  const tx=view(raw),[{pid:aPid}]=await raw.$queryRaw`SELECT pg_backend_pid() AS pid`;
  const first=await pair.readPair(tx,user,scope,target.assignmentId,target.binding);assert(first.fixed&&first.current.response.locked);assert.deepEqual(first.fixed.ref,correction.newRef);
  const again=await pair.readPair(tx,user,scope,target.assignmentId,target.binding);assert.deepEqual(sourceSummary(first),sourceSummary(again));
  record.A={pid:aPid,source:sourceSummary(first),secondIndependentPairMatched:true,holds:'tenant authorization and project/protocol/subject/enrollment/visit locks; no reader assignment/response row-lock claim'};
  held.resolve({pid:aPid});await Promise.race([release.promise,delay(20000,null,{ref:false}).then(()=>{throw Error('CONCURRENCY_RELEASE_TIMEOUT');})]);
 }).then(()=>({ok:true}),error=>{held.resolve({error});return{error};});
 const ready=await held.promise;if(ready.error){await a;throw ready.error;}
 const writerKind=kind==='unlock'?'app':'direct';
 const writer=rollback(writerKind,kind+'-B',async raw=>{
  const tx=view(raw),[{pid:bPid}]=await raw.$queryRaw`SELECT pg_backend_pid() AS pid`;pid.resolve(bPid);
  if(kind==='unlock'){
   const command={kind:'unlock',requestKey:record.writerRequestKey,expectedVersion:record.A.source.version,expectedRef:record.A.source.ref,reason:'仅本轮合成并发验证，事务强制回滚'};
   const result=await nativeReview(tx,user,scope,target.assignmentId,command);bFinished=true;
   const current=await pair.readPair(tx,user,scope,target.assignmentId,target.binding);assert.equal(current.current.response.locked,false);assert.equal(current.fixed,null);
   let denied;try{await analysis.assertCurrent(raw,user,scope,b.study.id,snapshot.basis.snapshotId,'publish');}catch(error){denied={code:code(error),status:error.getStatus?.()??error.status};}
   assert(denied&&['FULL_STUDY_VISIT_CHANGED','FULL_STUDY_SOURCE_NOT_LOCKED','FULL_STUDY_SOURCE_CHANGED','ANALYSIS_BASIS_STALE'].includes(denied.code),'CONCURRENCY_OLD_SOURCE_NOT_REJECTED');
   record.B={pid:bPid,nativeResult:result,sourceAfterTransientUnlock:sourceSummary(current),oldSourceRejected:denied,onlyNativeMutation:'unlock plus its original native review event/audit/receipt, all rolled back'};
  }else{
   await nativeLock(tx,scope.tenantId);
   const current=await pair.readPair(tx,user,scope,target.assignmentId,target.binding);assert(current.fixed);
   const changed=await tx.account.updateMany({where:{id:user.accountId,tenantId:scope.tenantId,status:'active',authVersion:user.authVersion},data:{status:'disabled'}});assert.equal(changed.count,1);bFinished=true;
   let denied;try{await pair.readPair(tx,user,scope,target.assignmentId,target.binding);}catch(error){denied={code:code(error),status:error.getStatus?.()??error.status};}
   assert(denied&&denied.code==='AUTH_SESSION_EXPIRED','CONCURRENCY_REVOKED_ACTOR_NOT_REJECTED');
   record.B={pid:bPid,sourceBeforeTransientRevocation:sourceSummary(current),changedActorCount:changed.count,transientStatus:'disabled',newPairRejected:denied,onlyMutation:'existing guarded synthetic actor.status, with automatic updatedAt; all rolled back'};
  }
 }).then(()=>({ok:true}),error=>({error}));
 let observationError;
 try{const bPid=await pid.promise;record.wait=await blocking(bPid,ready.pid);assert.equal(bFinished,false,'CONCURRENCY_WRITER_DID_NOT_WAIT');record.writerUnfinishedBeforeRelease=true;}
 catch(error){observationError=error;}
 finally{record.AReleaseRequestedAt=new Date().toISOString();release.resolve();}
 const [ar,br]=await Promise.all([a,writer]);if(ar.error)throw ar.error;if(br.error)throw br.error;if(observationError)throw observationError;
 record.passed=true;record.allTransactionsRolledBack=true;
}

let failure;
try{
 assert.equal(cfg.databaseName,'wp01_test_full_baseline');assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
 assert.equal(b.study.id,'rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25');assert.equal(b.runId,'rh-full-study-b230c34b');assert.equal(scope.tenantId,runtime.ids.tenant);
 assert.equal(snapshot.basis.manifestHash,'8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7');assert.equal(snapshot.basis.studyId,b.study.id);assert.deepEqual(snapshot.manifest.scope,scope);assert(subjectIds.includes(correction.patch.subjectId));
 // Use the standard marker checker with rollback-only real identity inspections.
 await assertFixtureTarget(env,{inspect:async url=>rollback(url===cfg.databaseUrl?'app':'direct','target-identity',tx=>readFixtureIdentity(tx),{readOnly:true,setup:false})});
 user=await rollback('direct','guard-case-and-actor',async tx=>{
  const rows=await tx.$queryRaw`SELECT run_id,manifest FROM wp01_meta.fixture_run WHERE run_id=ANY(${[runtime.key,b.runId]}::text[]) ORDER BY run_id`;assert.equal(rows.length,2);
  const own=rows.find(x=>x.run_id===b.runId)?.manifest,standing=rows.find(x=>x.run_id===runtime.key)?.manifest;
  assert(own.syntheticOnly===true&&own.studyId===b.study.id&&own.caseId===b.manifest.caseId&&own.studyGroupId===scope.studyGroupId&&own.scope.researchProjectId===scope.researchProjectId,'CONCURRENCY_SYNTHETIC_MARKER_REQUIRED');
  assert(standing.syntheticOnly===true&&standing.ids.tenant===scope.tenantId,'CONCURRENCY_STANDING_MARKER_REQUIRED');
  const actor=await tx.account.findFirst({where:{id:runtime.ids.admin,tenantId:scope.tenantId,status:'active'},select:{id:true,tenantId:true,role:true,isTenantAdmin:true,authVersion:true,status:true}});assert(actor?.role==='tenant_admin'&&actor.isTenantAdmin===true);return{...actor,accountId:actor.id};
 },{readOnly:true,setup:false});
 target=await rollback('direct','guard-corrected-current-ref',async tx=>{
  const a=await tx.formAssignment.findFirst({where:{...scope,id:correction.newRef.assignmentId,subjectId:correction.patch.subjectId,formVersionId:b.refs.phq.id,acceptanceFixture:false},include:{response:true}});assert(a?.response&&a.subjectVisitId);
  const r=a.response,rev=await tx.formResponseRevision.findFirst({where:{...scope,id:r.currentRevisionId}});assert(rev);assert.deepEqual(verify(rev).ref,correction.newRef);assert.equal(r.lockedRevisionId,r.currentRevisionId);assert.equal(r.status,'submitted');assert.equal(r.score.total,14);
  return{assignmentId:a.id,binding:{subjectId:a.subjectId,enrollmentId:a.enrollmentId,subjectVisitId:a.subjectVisitId,formVersionId:a.formVersionId},ref:correction.newRef};
 },{readOnly:true});
 before=await state('scientific-state-before');save('before.json',before);
 await scenario('unlock');await scenario('revoke');
}catch(error){failure=safeError(error);}
finally{
 if(user&&before){try{after=await state('scientific-state-after');save('after.json',after);assert.deepEqual(after.tables,before.tables,'CONCURRENCY_SCIENTIFIC_ROWS_CHANGED');}catch(error){failure??=safeError(error);}}
 const filesAfter=Object.fromEntries(Object.entries(originalFiles).map(([k,v])=>[k,{...v,afterSha256:fileHash(v.path),unchanged:fileHash(v.path)===v.sha256}]));
 if(!Object.values(filesAfter).every(x=>x.unchanged))failure??={code:'CONCURRENCY_OLD_FILES_CHANGED'};
 const result={schemaVersion:'full-study-performance-concurrency-v1',at:new Date().toISOString(),passed:!failure&&cases.length===2&&cases.every(x=>x.passed)&&before?.hash===after?.hash,syntheticOnly:true,rollbackOnly:true,database:cfg.databaseName,studyId:b.study.id,scope,actorId:user?.accountId??null,currentRef:target?.ref??null,manifestHash:snapshot.basis.manifestHash,cases,transactions,identities,scientificRowsUnchanged:before?.hash===after?.hash,beforeHash:before?.hash??null,afterHash:after?.hash??null,original37FilesUnchanged:Object.values(filesAfter).every(x=>x.unchanged),originalFiles:filesAfter,failure:failure??null,httpCalls:0,workerCalls:0,serviceReloads:0,emails:0,businessCommits:0,scopeNote:'Only this registered synthetic case and existing synthetic actor; no trigger/permission changes. Before/after data remains hash-only. PG wait is the original tenant advisory lane, not a claimed direct reader assignment/response row lock.'};
 save('result.json',result);console.log(JSON.stringify({passed:result.passed,cases:cases.map(x=>({kind:x.kind,passed:x.passed,wait:x.wait?.activity?.wait_event})),allTransactionsRolledBack:transactions.every(x=>x.rollbackConfirmed),scientificRowsUnchanged:result.scientificRowsUnchanged,original37FilesUnchanged:result.original37FilesUnchanged,failure:result.failure,evidence:out}));if(!result.passed)process.exitCode=1;
}
