// Local synthetic after-3 only. Every application-role contender and holder rolls back.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {checkedInputs,forceRollback} from './full-study-compute-tail-locked-metadata-pg.mjs';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';

const workspace=fileURLToPath(new URL('../../',import.meta.url));
const repo=workspace+'researchhub/',evidence=repo+'docs/testing/evidence/';
const base=evidence+'full-study-compute-tail-2026-11-16/';
const actorId='rh-kb-local-b0e2af9d-admin';
const frozenGuard='aa1348afdb119e4c02213ad83bad4b12ecaf4ee90dc22dd58f90267bbd4e83df';
const guardPath=repo+'server/research-analysis/full-study-batch-source.mjs';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const table=rows=>({count:rows.length,hash:fullStudyHash([...rows].sort((a,b)=>a.id.localeCompare(b.id)))});

export function requireMembershipWindow(argv,window){
 assert.deepEqual(argv,['--local-synthetic','after-3']);
 assert.equal(window,'explicit','AFTER3_TASK_MEMBERSHIP_WINDOW_REQUIRED');
}
export function inputs(){
 const prior=checkedInputs(),p=base+'candidates/old-native-runs-277.json';
 assert.equal(sha(p),'191b02dac4953b89431887733ce38543c8a3f42de42509aa73436e4a26b87986');
 const {runs,scope,studyId}=json(p);
 assert.equal(runs.length,277);assert.equal(new Set(runs.map(r=>r.id)).size,277);
 assert.deepEqual(scope,prior.c.scope);assert.equal(studyId,prior.c.studyId);
 const {basis,manifest}=json(evidence+'real-study-full-simulation-2026-11-13/report-corrected/snapshot.json');
 const modalities=manifest.quality.modalities.files,target=modalities.find(f=>f.processing.length>0);
 assert.equal(modalities.length,38);assert.equal(fullStudyHash(manifest),basis.manifestHash);
 assert(target&&prior.subjects.includes(target.subjectId));
 assert(manifest.observations.some(v=>v.subjectId===target.subjectId&&v.visitId===target.visitId));
 return {...prior,scope,studyId,basis,modalities,target,runs};
}
export function checkBlockedInsert(row,waiter,holder){
 assert(Number.isSafeInteger(waiter)&&Number.isSafeInteger(holder)&&waiter!==holder);
 assert.equal(row?.pid,waiter);assert.equal(row.wait_event_type,'Lock');assert(row.blockers.includes(holder));
 assert(/^INSERT INTO public\.processing_task\s*\(/.test(row.query.trimStart()));
}
export const assertLockOrder=events=>assert.deepEqual(events,['task-share','file-update']);

function observeLocks(tx,events,target){
 return new Proxy(tx,{get(raw,k){
  const fn=Reflect.get(raw,k,raw);
  if(k!=='$queryRaw')return typeof fn==='function'?fn.bind(raw):fn;
  return async(...args)=>{
   const sql=Array.isArray(args[0])?args[0].join('?'):'',rows=await fn.apply(raw,args);
   if(sql.startsWith('SELECT t.id FROM public.processing_task ')&&sql.endsWith('ORDER BY t.id FOR SHARE OF t')){
    assert(rows.some(r=>r.id===target.processing[0].id));events.push('task-share');
   }
   if(sql.startsWith('SELECT f.id FROM public.modality_file ')&&sql.endsWith('ORDER BY f.id FOR UPDATE OF f')){
    assert(rows.some(r=>r.id===target.id));events.push('file-update');
   }
   if(sql.startsWith('SELECT id FROM public.subject ')&&sql.endsWith('ORDER BY id FOR UPDATE'))events.push('subject-update');
   return rows;
  };
 }});
}

async function run(){
 const d=inputs(),{scope,studyId,basis,target}=d,actorBase={...scope,accountId:actorId};
 assert.equal(sha(guardPath),frozenGuard,'SOURCE_GUARD_VERSION_CHANGED');
 const {runtimeDependencies}=await import('../server/research-runtime/dependencies.mjs');
 const {fixtureEnvironment}=await import('./research-creation-fixture.mjs');
 const {withFixtureTransaction,assertFixtureTarget}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const {setContext}=await import('../server/research-studies/repository.mjs');
 const {createFullStudyCore}=await import('../server/research-analysis/full-study-core.mjs');
 const {createFullStudyAnalysis}=await import('../server/research-analysis/full-study-analysis.mjs');
 const {createFullStudySourcePairReader}=await import('../server/research-analysis/full-study-source-pair.mjs');
 const {createFullStudyBatchSource}=await import('../server/research-analysis/full-study-batch-source.mjs');
 const {createSimulationAdmission}=await import('../server/research-simulation/admission.mjs');
 const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const deps=runtimeDependencies(),{load}=deps;
 const admission=createSimulationAdmission({targets:json(workspace+'.tmp/real-study-full-simulation-2026-11-13/targets.json')});
 const core=createFullStudyCore({load,resolveCase:admission.resolveCase,readResponsePair:createFullStudySourcePairReader(deps).readPair});
 const analysis=createFullStudyAnalysis({core}),authLock=load('common/worker-publication','lockAuthorizationMutation');
 const verify=load('study-operations/formal-response-history','verifyFormalRevisionEnvelope');
 const out=base+'task-membership-pg/run-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
 const key='task-membership-'+randomUUID(),txns=[],result={syntheticOnly:true,studyId,scope,sourceSha256:frozenGuard,httpCalls:0,workerCalls:0,transactions:txns};
 let actor,prior,probe,problem;
 async function state(){
  const science=d.files.map(f=>{assert.equal(sha(workspace+f.path),f.sha256);return{path:f.path,hash:f.sha256};});
  return withFixtureTransaction(env,'direct',async tx=>{
   const [m]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${'rh-full-study-b230c34b'}`;
   assert(m?.manifest?.syntheticOnly&&m.manifest.studyId===studyId&&Object.keys(scope).every(k=>m.manifest.scope[k]===scope[k]));
   assert.equal(fullStudyHash(await admission.resolveCase(tx,scope)),fullStudyHash(d.c));
   const a=await tx.account.findFirst({where:{id:actorId,tenantId:scope.tenantId,status:'active'},select:{id:true,role:true,authVersion:true,isTenantAdmin:true,tenant:{select:{status:true}}}});
   assert(a?.role==='tenant_admin'&&a.isTenantAdmin===true&&a.tenant.status==='active'&&Number.isSafeInteger(a.authVersion));
   const retained=await tx.researchMethodRun.findMany({where:{...scope,id:{in:d.runs.map(r=>r.id)}}});
   const aids=[...new Set(d.revisions.map(r=>r.assignmentId))];assert.equal(aids.length,46);
   const revisions=await tx.formResponseRevision.findMany({where:{...scope,assignmentId:{in:aids}}});revisions.forEach(verify);
   const kids=d.children.map(x=>x.id);
   const snaps=await tx.$queryRaw`SELECT * FROM rh_analysis.snapshot WHERE tenant_id=${scope.tenantId} AND study_group_id=${scope.studyGroupId} AND research_project_id=${scope.researchProjectId} AND study_id=${studyId} AND id=ANY(${kids}::text[]) ORDER BY id`;
   assert.deepEqual(table(retained),table(d.runs));assert.deepEqual(table(revisions),table(d.revisions));assert.deepEqual(table(snaps),table(d.children));
   const files=await tx.modalityFile.findMany({where:{tenantId:scope.tenantId,subjectId:{in:d.subjects}}});
   const tasks=await tx.processingTask.findMany({where:{modalityFileId:{in:files.map(f=>f.id)}}});
   assert(d.modalities.every(m=>files.some(f=>f.id===m.id&&f.subjectId===m.subjectId&&f.subjectVisitId===m.visitId&&f.deletedAt===null)));
   const original=tasks.find(t=>t.id===target.processing[0].id);assert(original&&Object.keys(scope).every(k=>original[k]===scope[k])&&original.subjectId===target.subjectId&&original.modalityFileId===target.id);
   assert.equal(await tx.processingTask.count({where:{OR:[{id:key},{idempotencyKey:key}]}}),0);
   return {actor:a,skill:original.skillKey,native277:table(retained),raw48:table(revisions),child39:table(snaps),science36:{count:science.length,hash:fullStudyHash(science)},files:table(files),allTheirTasks:table(tasks)};
  },{readOnly:true});
 }
 const app=fn=>withFixtureTransaction(env,'app',async tx=>{await setContext(tx,actor,scope.studyGroupId,scope.researchProjectId);return fn(tx);});
 const rollback=(label,fn)=>forceRollback(app,label,txns,fn);
 async function insert(tx){
  const count=await tx.$executeRaw`INSERT INTO public.processing_task (id,"tenantId","studyGroupId","researchProjectId","subjectId","modalityFileId","skillKey",status,progress,"idempotencyKey","createdBy","updatedAt") VALUES (${key},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},${target.subjectId},${target.id},${prior.skill},'complete',100,${key},${actorId},CURRENT_TIMESTAMP)`;
  assert.equal(count,1);
 }
 async function checkBlock(holder,events){
  assertLockOrder(events);
  const pidReady=Promise.withResolvers();
  const writer=rollback('writer-blocked',async tx=>{
   await tx.$executeRawUnsafe('SET LOCAL lock_timeout = 1800');
   // Taking this FK lock now rules out the subject as the reason the INSERT waits.
   const subject=await tx.$queryRaw`SELECT id FROM public.subject WHERE id=${target.subjectId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} AND "researchProjectId"=${scope.researchProjectId} FOR KEY SHARE NOWAIT`;
   assert.deepEqual(subject,[{id:target.subjectId}]);
   const project=await tx.$queryRaw`SELECT id FROM public.research_project WHERE id=${scope.researchProjectId} AND "tenantId"=${scope.tenantId} AND "studyGroupId"=${scope.studyGroupId} FOR KEY SHARE NOWAIT`;
   assert.deepEqual(project,[{id:scope.researchProjectId}]);
   const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;pidReady.resolve(pid);
   try{await insert(tx);}catch(e){if((e?.meta?.code??e?.code)!=='55P03')throw e;result.writerSqlState='55P03';return;}
   throw Error('TASK_INSERT_DID_NOT_BLOCK');
  }).then(()=>null,e=>{pidReady.resolve(null);return e;});
  try{
   const waiter=await pidReady.promise;assert(Number.isSafeInteger(waiter));
   await withFixtureTransaction(env,'direct',async tx=>{
    const end=performance.now()+2500;
    do{
     await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
     const [row]=await tx.$queryRaw`SELECT pid,query,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=${waiter} AND datname=current_database()`;
     if(row?.wait_event_type==='Lock'&&row.blockers.includes(holder)){checkBlockedInsert(row,waiter,holder);result.wait={holder,waiter,at:new Date().toISOString(),blockers:row.blockers,observedStatement:'INSERT INTO public.processing_task',subjectAndProjectKeyShareAlreadyHeld:true};break;}
     await delay(20);
    }while(performance.now()<end);
   },{readOnly:true});
  }finally{const error=await writer;if(error)throw error;}
  assert(result.wait&&result.writerSqlState==='55P03');assertLockOrder(events);
 }
 const safeFailure=e=>({code:e?.meta?.code??e?.code??e?.name,site:String(e?.stack??'').split('\n').find(s=>s.startsWith('    at ')&&s.includes('task-membership-pg.mjs'))?.trim()??null});
 try{
  prior=await state();actor={...actorBase,role:prior.actor.role,isTenantAdmin:prior.actor.isTenantAdmin,authVersion:prior.actor.authVersion};result.before=prior;
  await rollback('holder-protected-publication',async tx=>{
   await authLock(tx,scope.tenantId,{includeOfficial:true});
   const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`,events=[],observed=observeLocks(tx,events,target);
   let entered=false;const withGuard=createFullStudyBatchSource({authorize:core.authorize,validateCase:core.validateCase,assertCurrent:async(...args)=>{
    if(!entered){entered=true;assert.equal(args[4],basis.snapshotId);assert.equal(args[5],'publish');await checkBlock(pid,events);}
    return analysis.assertCurrent(...args);
   }});
   const slice=d.children.find(x=>x.manifest?.rootSnapshotId===basis.snapshotId);
   assert(slice,'FROZEN_CHILD_REQUIRED');
   await withGuard(observed,actor,scope,studyId,basis.snapshotId,[slice.id],'publish',async(resolver,view,current)=>{
    assert.equal(current.basis.manifestHash,basis.manifestHash);
    assert(events.includes('subject-update'));const child=await resolver.assertCurrent(view,actor,scope,studyId,slice.id,'publish');
    assert.equal(child.basis.rootSnapshotId,basis.snapshotId);assert.equal(child.basis.manifestHash,slice.manifest_hash);result.provedRootAndChild=true;
   });
   assert(entered);result.lockOrder=events;
  });
  await rollback('control-after-holder-release',async tx=>{
   await tx.$executeRawUnsafe('SET LOCAL lock_timeout = 1800');await insert(tx);
   assert.equal(await tx.processingTask.count({where:{...scope,id:key,idempotencyKey:key,subjectId:target.subjectId,modalityFileId:target.id,skillKey:prior.skill,status:'complete'}}),1);
   result.sameInsertReadBack=1;
  });
 }catch(e){problem=e;}finally{
  if(prior)try{result.after=await state();assert.deepEqual(result.after,prior);result.scientificAndDatabaseRowsUnchanged=true;}catch(e){result.verificationFailure=safeFailure(e);problem??=e;}
  if(sha(guardPath)!==frozenGuard)problem??=Error('SOURCE_CHANGED');
  result.passed=Boolean(!problem&&result.provedRootAndChild&&result.sameInsertReadBack===1&&result.scientificAndDatabaseRowsUnchanged&&txns.length===3&&txns.every(t=>t.rolledBack));
  if(problem)result.failure=safeFailure(problem);
  writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({passed:result.passed,completedRollbacks:txns.filter(t=>t.rolledBack).length,evidence:out}));if(!result.passed)process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 requireMembershipWindow(process.argv.slice(2),process.env.FULL_STUDY_TASK_MEMBERSHIP_WINDOW);
 await run();
}
