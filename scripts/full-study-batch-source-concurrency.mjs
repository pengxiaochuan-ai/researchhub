// Explicit synthetic-fixture window only. Every transaction is forced to roll back.
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
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';
import {setContext} from '../server/research-studies/repository.mjs';

if(process.argv.length!==3||process.argv[2]!=='--local-synthetic'){
 console.error(JSON.stringify({guardRejected:true,code:'BATCH_SOURCE_LOCAL_SYNTHETIC_REQUIRED',databaseCalls:0}));process.exit(2);
}
const json=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const root=workspaceRoot,privateDir=root+'.tmp/real-study-full-simulation-2026-11-13/',old=root+'researchhub/docs/testing/evidence/',newRoot=old+'full-study-batch-performance-2026-11-16/';
const out=newRoot+'source-concurrency/run-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
const save=(name,value)=>writeFileSync(out+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const code=e=>e?.getResponse?.()?.code??e?.code??e?.message;
const safeError=e=>({name:e?.name??null,code:code(e),sqlState:e?.meta?.code??null,message:String(e?.message??e).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[database-url-redacted]').slice(0,1800)});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const env=fixtureEnvironment(),cfg=validateFixtureConfig(env),b=json(privateDir+'bootstrap.json'),runtime=json(root+'.tmp/researchhub-knowledge-local/runtime.json'),scope=b.scope;
const snapshot=json(old+'real-study-full-simulation-2026-11-13/report-corrected/snapshot.json'),group=json(old+'real-study-full-simulation-2026-11-13/report-corrected/group.json'),correction=json(old+'real-study-full-simulation-2026-11-13/correction.json');
const baseline=json(newRoot+'baseline-independent/baseline.json'),originals=Object.fromEntries(baseline.frozenFiles.map(f=>[f.source,{path:root+f.source,beforeSha256:sha(root+f.source),frozenSha256:f.sha256}]));
const sourceFiles=Object.fromEntries(['server/research-analysis/full-study-batch-source.mjs','server/research-analysis/full-study-analysis.mjs','scripts/full-study-batch-source-concurrency.mjs'].map(p=>[p,sha(root+'researchhub/'+p)]));
const deps=runtimeDependencies(),pairs=createFullStudySourcePairReader(deps),admission=createSimulationAdmission({targets:json(privateDir+'targets.json')});
const nativeLock=deps.load('common/worker-publication','lockAuthorizationMutation'),nativeReview=deps.load('study-operations/formal-response-review','reviewFormalResponseInTransaction'),verify=deps.load('study-operations/formal-response-history','verifyFormalRevisionEnvelope');
const heartbeat=deps.load('common/worker-claim','heartbeat'),recover=deps.load('common/worker-claim','recoverExpiredClaim'),claim=deps.load('common/worker-claim','claim');
const workerScope={allowedTenantIds:[scope.tenantId],enabledWorkerKinds:['raw-processing']};
const core=createFullStudyCore({load:deps.load,resolveCase:admission.resolveCase,readResponsePair:pairs.readPair});
const analysis=createFullStudyAnalysis({studies:{withResearchStudyTransaction(){throw Error('BATCH_SOURCE_NESTED_TRANSACTION_FORBIDDEN');}},load:deps.load,resolveCase:admission.resolveCase,core});
const subjects=b.manifest.subjects.map(x=>x.id).sort(),transactions=[],identities=[],cases=[];let user,target,before,after,failure;
const rootId=snapshot.basis.snapshotId,childId=group.slices.find(x=>x.methodRunId).snapshotId;

async function rollback(kind,label,fn,{readOnly=false,setup=true}={}){
 const client=fixtureClient(kind==='app'?cfg.databaseUrl:cfg.directUrl),abort=Error('BATCH_SOURCE_FORCE_ROLLBACK');
 const entry={kind,label,startedAt:new Date().toISOString(),rollbackConfirmed:false};transactions.push(entry);let value;
 try{
  await client.$transaction(async tx=>{
   if(readOnly)await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 15000');
   const who=await readFixtureIdentity(tx);checkFixtureIdentity(cfg,kind,who);identities.push({label,kind,database:who.database,role:who.role,superuser:who.superuser,bypassRls:who.bypassRls});
   if(setup)await setContext(tx,user,scope.studyGroupId,scope.researchProjectId);
   value=await fn(tx);throw abort;
  },{isolationLevel:'ReadCommitted',maxWait:8000,timeout:60000});
  throw Error('BATCH_SOURCE_UNEXPECTED_COMMIT');
 }catch(error){entry.finishedAt=new Date().toISOString();entry.rollbackConfirmed=error===abort;if(error!==abort){entry.error=safeError(error);throw error;}return value;}
 finally{await client.$disconnect();}
}
async function state(label){return rollback('direct',label,async tx=>{
 const tables={},remember=(name,rows)=>{const sorted=[...rows].sort((a,z)=>a.id.localeCompare(z.id));tables[name]={count:sorted.length,hash:fullStudyHash(sorted),rows:sorted.map(x=>({id:x.id,hash:fullStudyHash(x)}))};return rows;};
 const c=await admission.resolveCase(tx,scope);assert.equal(fullStudyHash(c),snapshot.manifest.caseHash);
 remember('subject',await tx.subject.findMany({where:{...scope,id:{in:subjects},acceptanceFixture:false}}));
 const visits=remember('subjectVisit',await tx.subjectVisit.findMany({where:{...scope,subjectId:{in:subjects},protocolVersionId:c.protocolVersionId,acceptanceFixture:false}}));assert.equal(visits.length,18);
 const assignments=remember('formAssignment',await tx.formAssignment.findMany({where:{...scope,subjectId:{in:subjects},acceptanceFixture:false}}));assert.equal(assignments.length,46);
 const ids=assignments.map(x=>x.id),responses=remember('formResponse',await tx.formResponse.findMany({where:{...scope,assignmentId:{in:ids}}}));assert.equal(responses.length,46);
 const revisions=remember('formResponseRevision',await tx.formResponseRevision.findMany({where:{...scope,assignmentId:{in:ids}}}));assert.equal(revisions.length,48);for(const x of revisions)verify(x);
 for(const [name,where]of [
  ['studyEnrollment',{...scope,subjectId:{in:subjects}}],['formResponseReviewEvent',{...scope,responseId:{in:responses.map(x=>x.id)}}],['formResponseCommandReceipt',{...scope,assignmentId:{in:ids}}],
  ['studyProtocolVersion',{...scope,id:c.protocolVersionId}],['studyExecutionPolicyVersion',{...scope,id:c.policyId}],['formVersion',{...scope,id:{in:c.forms.map(x=>x.id)}}],
  ['visitPlan',{...scope,id:{in:c.visitPlans.map(x=>x.id)}}],['visitRequirement',{...scope,visitPlanId:{in:c.visitPlans.map(x=>x.id)}}],['visitRequirementFulfillment',{...scope,subjectVisitId:{in:visits.map(x=>x.id)}}],
  ['studyParticipationEvent',{...scope,subjectId:{in:subjects},protocolVersionId:c.protocolVersionId}],['dataQuery',{...scope,acceptanceFixture:false}],['protocolDeviation',{...scope,acceptanceFixture:false}],
  ['researchMethodRun',scope],['researchMethodReview',scope],['auditLog',scope],
 ])remember(name,await tx[name].findMany({where}));
 const files=remember('modalityFile',await tx.modalityFile.findMany({where:{tenantId:scope.tenantId,subjectId:{in:subjects},subjectVisitId:{in:visits.map(x=>x.id)}}}));
 const tasks=remember('processingTask',await tx.processingTask.findMany({where:{...scope,modalityFileId:{in:files.map(x=>x.id)}}}));
 remember('feature',await tx.feature.findMany({where:{tenantId:scope.tenantId,sourceModalityFileId:{in:files.map(x=>x.id)},sourceProcessingTaskId:{in:tasks.map(x=>x.id)}}}));
 remember('syntheticActor',await tx.account.findMany({where:{id:user.accountId,tenantId:scope.tenantId},select:{id:true,tenantId:true,status:true,authVersion:true,role:true,isTenantAdmin:true,updatedAt:true}}));
 return{at:new Date().toISOString(),tables,hash:fullStudyHash(tables)};
 },{readOnly:true});}
async function observe(waiter,holder){return rollback('direct','observe-'+waiter,async tx=>{
 const start=performance.now();let last;
 do{
  await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
  last=(await tx.$queryRaw`SELECT pid,state,wait_event_type,wait_event,query,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND pid=${waiter}`)[0];
  if(last?.blockers?.map(Number).includes(holder)){
   const locks=await tx.$queryRaw`SELECT pid,locktype,mode,granted,relation::text,transactionid::text,classid::text,objid::text FROM pg_locks WHERE pid=ANY(${[waiter,holder]}::int[]) ORDER BY pid,locktype,granted`;
   assert(locks.some(x=>Number(x.pid)===waiter&&!x.granted));return{at:new Date().toISOString(),elapsedMs:performance.now()-start,activity:last,locks};
  }
  await delay(20);
 }while(performance.now()-start<7000);
 throw Object.assign(Error('BATCH_SOURCE_WAIT_NOT_OBSERVED'),{detail:last});
 },{readOnly:true});}
async function assertStale(tx){
 let denied;try{await analysis.assertCurrent(tx,user,scope,b.study.id,rootId,'publish');}catch(error){denied={code:code(error),status:error.getStatus?.()??error.status};}
 assert(denied&&['ANALYSIS_BASIS_STALE','FULL_STUDY_VISIT_CHANGED','FULL_STUDY_SOURCE_NOT_LOCKED','FULL_STUDY_SOURCE_CHANGED','AUTH_SESSION_EXPIRED'].includes(denied.code),'BATCH_SOURCE_TRANSIENT_CHANGE_NOT_REJECTED');return denied;
}
async function holdGuard(tx,held,release,record){
 await nativeLock(tx,scope.tenantId,{includeOfficial:true});const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
 await analysis.withBatchResolver(tx,user,scope,b.study.id,rootId,[childId],'publish',async(resolver,guarded,current)=>{
  assert.equal(current.basis.manifestHash,snapshot.basis.manifestHash);await resolver.assertCurrent(guarded,user,scope,b.study.id,childId,'publish');
  record.A={pid,rootId,manifestHash:current.basis.manifestHash,taskId:target.task.id,taskRowSharedLockBeforeProof:true};held.resolve({pid});
  await Promise.race([release.promise,delay(25000,null,{ref:false}).then(()=>{throw Error('BATCH_SOURCE_RELEASE_TIMEOUT');})]);
 });
}
async function guardedWriter(kind,write,role='app'){
 const held=deferred(),release=deferred(),pid=deferred(),record={kind};cases.push(record);let writerFinished=false;
 const a=rollback('app',kind+'-A',tx=>holdGuard(tx,held,release,record)).then(()=>({ok:true}),error=>{held.resolve({error});return{error};});
 const ready=await held.promise;if(ready.error){await a;throw ready.error;}
 const btx=rollback(role,kind+'-B',async tx=>{const [{pid:bPid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;pid.resolve(bPid);record.B={pid:bPid};await write(tx,record);writerFinished=true;}).then(()=>({ok:true}),error=>{pid.resolve(null);return{error};});
 let observedError;
 try{const bPid=await pid.promise;assert(bPid);record.wait=await observe(bPid,ready.pid);assert.equal(writerFinished,false);record.writerUnfinishedBeforeRelease=true;}
 catch(error){observedError=error;}
 finally{record.releaseRequestedAt=new Date().toISOString();release.resolve();}
 const [ar,br]=await Promise.all([a,btx]);if(ar.error)throw ar.error;if(br.error)throw br.error;if(observedError)throw observedError;
 record.passed=true;record.allTransactionsRolledBack=true;console.log(JSON.stringify({case:kind,passed:true,wait:record.wait.activity.wait_event,blockedStatement:record.blockedStatement}));
}
async function prepareTask(tx,kind,record){
 const ref={kind:'raw-processing',taskId:target.task.id,tenantId:scope.tenantId,executionToken:randomUUID(),workerOwner:'batch-source:'+randomUUID()};
 record.blockedStatement='preparatory processing_task UPDATE, not the later native '+kind;
 record.preparationStartedAt=new Date().toISOString();
 if(kind==='claim')await tx.$executeRaw`UPDATE public.processing_task SET status='queued',"executionToken"=NULL,"workerOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=${target.task.id} AND "tenantId"=${scope.tenantId}`;
 else if(kind==='recover')await tx.$executeRaw`UPDATE public.processing_task SET status='running',"executionToken"=${ref.executionToken},"workerOwner"=${ref.workerOwner},"leaseExpiresAt"=clock_timestamp()-INTERVAL '1 second',"updatedAt"=clock_timestamp() WHERE id=${target.task.id} AND "tenantId"=${scope.tenantId}`;
 else await tx.$executeRaw`UPDATE public.processing_task SET status='running',"executionToken"=${ref.executionToken},"workerOwner"=${ref.workerOwner},"leaseExpiresAt"=clock_timestamp()+INTERVAL '120 seconds',"updatedAt"=clock_timestamp() WHERE id=${target.task.id} AND "tenantId"=${scope.tenantId}`;
 record.preparationFinishedAt=new Date().toISOString();return ref;
}
async function reverseHeartbeat(){
 const held=deferred(),release=deferred(),aPid=deferred(),record={kind:'native-heartbeat-before-guard'};cases.push(record);let aFinished=false;
 const btx=rollback('app','reverse-heartbeat-B',async tx=>{
  const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;const ref=await prepareTask(tx,'heartbeat',record);
  assert.equal(await heartbeat(tx,workerScope,ref),true);record.nativeHeartbeatCompletedBeforeGuard=true;record.B={pid};held.resolve({pid});await release.promise;
 }).then(()=>({ok:true}),error=>{held.resolve({error});return{error};});
 const ready=await held.promise;if(ready.error){await btx;throw ready.error;}
 const atx=rollback('app','reverse-heartbeat-A',async tx=>{
  await nativeLock(tx,scope.tenantId,{includeOfficial:true});const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;aPid.resolve(pid);
  await analysis.withBatchResolver(tx,user,scope,b.study.id,rootId,[childId],'publish',async(resolver,g,current)=>{assert.equal(current.basis.manifestHash,snapshot.basis.manifestHash);await resolver.assertCurrent(g,user,scope,b.study.id,childId,'publish');record.A={pid,manifestHash:current.basis.manifestHash,readsOriginalSourceAfterBRollback:true};aFinished=true;});
 }).then(()=>({ok:true}),error=>{aPid.resolve(null);return{error};});
 let observationError;try{const pid=await aPid.promise;assert(pid);record.wait=await observe(pid,ready.pid);assert.equal(aFinished,false);assert.match(record.wait.activity.query,/processing_task/);record.blockedStatement='guard SELECT task IDs FOR SHARE; B already completed real heartbeat within its uncommitted preparation transaction';}
 catch(error){observationError=error;}finally{release.resolve();}
 const [ar,br]=await Promise.all([atx,btx]);if(ar.error)throw ar.error;if(br.error)throw br.error;if(observationError)throw observationError;
 record.passed=true;record.allTransactionsRolledBack=true;console.log(JSON.stringify({case:record.kind,passed:true,wait:record.wait.activity.wait_event}));
}

try{
 assert.equal(cfg.databaseName,'wp01_test_full_baseline');assert.equal(runtime.key,'rh-kb-local-b0e2af9d');assert.equal(b.study.id,'rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25');assert.equal(b.runId,'rh-full-study-b230c34b');assert.equal(scope.tenantId,runtime.ids.tenant);assert.equal(snapshot.basis.manifestHash,'8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7');
 assert(Object.values(originals).every(x=>x.beforeSha256===x.frozenSha256),'BATCH_SOURCE_OLD_FILES_CHANGED_BEFORE_RUN');
 assert.equal(sourceFiles['server/research-analysis/full-study-batch-source.mjs'],'c1e72fc2ed5ba205ad5083838a293e71fb154ad3ac0b6b47131adf7f0df4cffa');
 await assertFixtureTarget(env,{inspect:async url=>rollback(url===cfg.databaseUrl?'app':'direct','target-identity',tx=>readFixtureIdentity(tx),{readOnly:true,setup:false})});
 user=await rollback('direct','guard-synthetic-actor',async tx=>{
  const rows=await tx.$queryRaw`SELECT run_id,manifest FROM wp01_meta.fixture_run WHERE run_id=ANY(${[runtime.key,b.runId]}::text[])`;assert.equal(rows.length,2);
  const own=rows.find(x=>x.run_id===b.runId)?.manifest,standing=rows.find(x=>x.run_id===runtime.key)?.manifest;assert(own?.syntheticOnly===true&&own.studyId===b.study.id&&own.caseId===b.manifest.caseId&&own.scope.researchProjectId===scope.researchProjectId&&standing?.syntheticOnly===true&&standing.ids.tenant===scope.tenantId);
  const actor=await tx.account.findFirst({where:{id:runtime.ids.admin,tenantId:scope.tenantId,status:'active'},select:{id:true,tenantId:true,role:true,isTenantAdmin:true,authVersion:true}});assert(actor?.role==='tenant_admin'&&actor.isTenantAdmin);return{...actor,accountId:actor.id,...scope};
 },{readOnly:true,setup:false});
 target=await rollback('direct','guard-current-source',async tx=>{
  const a=await tx.formAssignment.findFirst({where:{...scope,id:correction.newRef.assignmentId,subjectId:correction.patch.subjectId,formVersionId:b.refs.phq.id,acceptanceFixture:false},include:{response:true}});assert(a?.response&&a.subjectVisitId&&a.response.lockedRevisionId===a.response.currentRevisionId);
  const rev=await tx.formResponseRevision.findFirst({where:{...scope,id:a.response.currentRevisionId}});assert.deepEqual(verify(rev).ref,correction.newRef);
  const task=await tx.processingTask.findFirst({where:{...scope,subjectId:{in:subjects},modalityFile:{tenantId:scope.tenantId,subjectId:{in:subjects},subjectVisitId:{not:null},deletedAt:null}},orderBy:{id:'asc'}});assert(task&&task.status==='complete');
  return{task,assignmentId:a.id,ref:correction.newRef,responseVersion:a.response.version};
 },{readOnly:true});
 before=await state('scientific-state-before');save('before.json',before);
 await reverseHeartbeat();
 for(const kind of ['heartbeat','recover','claim'])await guardedWriter('guard-before-native-'+kind,async(tx,r)=>{
  const ref=await prepareTask(tx,kind,r);r.nativeStartedAt=new Date().toISOString();let result;
  if(kind==='heartbeat'){result=await heartbeat(tx,workerScope,ref);assert.equal(result,true);}
  else if(kind==='recover'){result=await recover(tx,workerScope,'raw-processing',target.task.id);assert.equal(result,true);}
  else{result=await claim(tx,workerScope,'raw-processing',target.task.id,'batch-source:'+randomUUID());assert(result?.taskId===target.task.id);result={claimed:true,refHash:fullStudyHash(result)};}
  r.nativeCompletedAt=new Date().toISOString();r.B.nativeHelper={name:kind,result,taskSkillKey:target.task.skillKey,note:'direct original lifecycle helper; no worker claimNext selection or Worker execution is claimed'};r.B.oldRootRejected=await assertStale(tx);
 });
 await guardedWriter('new-task-phantom',async(tx,r)=>{
  r.blockedStatement='original tenant authorization advisory lock before transient task INSERT';await nativeLock(tx,scope.tenantId);r.tenantLockAcquiredAt=new Date().toISOString();
  const id='batch-source-transient-'+randomUUID();const inserted=await tx.processingTask.create({data:{id,...scope,subjectId:target.task.subjectId,modalityFileId:target.task.modalityFileId,skillKey:target.task.skillKey,status:'complete',progress:100,idempotencyKey:id,createdBy:user.accountId}});
  r.B.insertedTask={id:inserted.id,fileId:inserted.modalityFileId,status:inserted.status,protocol:'production-equivalent tenant fence; bounded synthetic ORM insertion, not a full upload/Worker'};r.B.oldRootRejected=await assertStale(tx);
 });
 await guardedWriter('native-source-unlock',async(tx,r)=>{
  r.blockedStatement='original formal response review tenant authorization lock';const requestKey='batch-source-unlock-'+randomUUID();
  r.B.nativeResult=await nativeReview(tx,user,scope,target.assignmentId,{kind:'unlock',requestKey,expectedVersion:target.responseVersion,expectedRef:target.ref,reason:'仅合成批次来源并发验证，事务强制回滚'});r.B.oldRootRejected=await assertStale(tx);
 });
 await guardedWriter('native-tenant-fenced-revocation',async(tx,r)=>{
  r.blockedStatement='original tenant authorization advisory lock before synthetic actor status revocation';await nativeLock(tx,scope.tenantId);
  const changed=await tx.account.updateMany({where:{id:user.accountId,tenantId:scope.tenantId,status:'active',authVersion:user.authVersion},data:{status:'disabled'}});assert.equal(changed.count,1);r.B.changedActorCount=changed.count;r.B.newGuardRejected=await assertStale(tx);assert.equal(r.B.newGuardRejected.code,'AUTH_SESSION_EXPIRED');
 },'direct');
}catch(error){failure=safeError(error);}
finally{
 if(before){try{after=await state('scientific-state-after');save('after.json',after);assert.deepEqual(after.tables,before.tables,'BATCH_SOURCE_SCIENTIFIC_ROWS_CHANGED');}catch(error){failure??=safeError(error);}}
 const filesAfter=Object.fromEntries(Object.entries(originals).map(([k,v])=>[k,{...v,afterSha256:sha(v.path),unchanged:sha(v.path)===v.beforeSha256}]));
 if(!Object.values(filesAfter).every(x=>x.unchanged))failure??={code:'BATCH_SOURCE_OLD_FILES_CHANGED'};
 const result={schemaVersion:'full-study-batch-source-concurrency-v1',at:new Date().toISOString(),passed:!failure&&cases.length===7&&cases.every(x=>x.passed)&&before?.hash===after?.hash&&transactions.every(x=>x.rollbackConfirmed),syntheticOnly:true,rollbackOnly:true,database:cfg.databaseName,studyId:b.study.id,scope,actorId:user?.accountId??null,currentRef:target?.ref??null,manifestHash:snapshot.basis.manifestHash,sourceFiles,cases,transactions,identities,scientificRowsUnchanged:before?.hash===after?.hash,beforeHash:before?.hash??null,afterHash:after?.hash??null,original25FilesUnchanged:Object.values(filesAfter).every(x=>x.unchanged),originalFiles:filesAfter,failure:failure??null,httpCalls:0,workerCalls:0,serviceReloads:0,businessCommits:0,scopeNote:'Only registered synthetic case, existing synthetic task and actor. All temporary writes and original native audits/receipts roll back. Guard-before-native task cases observe preparatory UPDATE blocking, not a claim that heartbeat/recover/claim itself was waiting.'};
 save('result.json',result);console.log(JSON.stringify({passed:result.passed,cases:cases.map(x=>({kind:x.kind,passed:x.passed})),transactions:transactions.length,allTransactionsRolledBack:transactions.every(x=>x.rollbackConfirmed),scientificRowsUnchanged:result.scientificRowsUnchanged,original25FilesUnchanged:result.original25FilesUnchanged,failure:result.failure,evidence:out}));if(!result.passed)process.exitCode=1;
}
