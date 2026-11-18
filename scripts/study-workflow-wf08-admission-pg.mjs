// Pure injected QA entry. This module never reads env/files, connects, or applies DDL at import.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const identifier=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(s);
export function requireWF08AdmissionWindow(args,env){
 assert.equal(env?.STUDY_WORKFLOW_WF08_QA_WINDOW,'explicit','WF08_EXPLICIT_WINDOW_REQUIRED');
 assert.equal(env?.VISIT_WORKFLOW_QA_WINDOW,'explicit','WF08_SHARED_WINDOW_REQUIRED');
 assert.deepEqual([...args].sort(),['--local-synthetic','--rollback-predict'].sort(),'WF08_ROLLBACK_PREDICT_ONLY');
}
export async function runWF08AdmissionPrediction({args,env,withFixtureTransaction,applyMigrationInTransaction,createApi,readProtection,compareProtection,migrationSql,expectedMigrationHash,resources}){
 requireWF08AdmissionWindow(args,env);
 for(const fn of [withFixtureTransaction,applyMigrationInTransaction,createApi,readProtection,compareProtection])assert.equal(typeof fn,'function','WF08_PREDICTION_DEPENDENCIES_REQUIRED');
 assert.equal(typeof migrationSql,'string');assert.equal(hash(migrationSql),expectedMigrationHash,'WF08_FROZEN_MIGRATION_REQUIRED');
 assert(resources?.syntheticOnly===true&&identifier(resources.deploymentId)&&Array.isArray(resources.cases)&&resources.cases.length>0&&resources.cases.length<=2,'WF08_FROZEN_RESOURCES_REQUIRED');
 for(const c of resources.cases){assert([c.studyId,c.snapshotId,c.actor?.tenantId,c.actor?.accountId,c.scope?.studyGroupId,c.scope?.researchProjectId].every(identifier));assert(Number.isSafeInteger(c.actor.authVersion)&&c.actor.authVersion>=0);}
 const sentinel=Object.freeze(new Error('WF08_EXPECTED_FULL_ROLLBACK')),prefix='wf08-predict-'+randomUUID(),transientIds=[],cases=[];
 let before,rolledBack=false,failure;
 try{
  before=await readProtection({phase:'before',requestPrefix:prefix,expectedPersistentWrites:0});
  try{await withFixtureTransaction(env,'direct',async tx=>{
   const [login]=await tx.$queryRaw`SELECT current_user AS role`;assert.equal(login.role,'aisci_owner');
   // Root supplies its reviewed, statement-aware SQL applier; never a startup migration call.
   await applyMigrationInTransaction(tx,migrationSql,{expectedSha256:expectedMigrationHash});
   await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
   const [app]=await tx.$queryRaw`SELECT current_user AS role`;assert.equal(app.role,'aisci_app');
   async function expectDbRejection(callback,expectedCode){
    await tx.$executeRawUnsafe('SAVEPOINT wf08_countercase');let code;
    try{await callback();}catch(error){code=error?.meta?.code??error?.code;}
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT wf08_countercase');await tx.$executeRawUnsafe('RELEASE SAVEPOINT wf08_countercase');assert.equal(code,expectedCode,'WF08_EXPECTED_REAL_DB_REJECTION');
   }
   for(const [i,c] of resources.cases.entries()){
    const built=await createApi({tx,case:c,deploymentId:resources.deploymentId});assert.equal(built?.authorityMode,'native-read-only','WF08_DRY_AUTHORITY_IS_NOT_PG_PROOF');
    const api=built.api,requestKey=prefix+'-'+i,body={requestKey,snapshotId:c.snapshotId};
    const accepted=await api.create(c.actor,c.studyId,body);transientIds.push(accepted.job.id);
    assert.equal(accepted.job.status,'queued');assert.equal(accepted.receipt.authVersion,c.actor.authVersion);assert.deepEqual(await api.create(c.actor,c.studyId,body),accepted);assert.deepEqual(await api.receipt(c.actor,c.studyId,requestKey),accepted);
    const rows=await tx.$queryRaw`SELECT id,admission_audit_id,checkpoint FROM rh_analysis.execution_job WHERE id=${accepted.job.id}`;assert.equal(rows.length,1);transientIds.push(rows[0].admission_audit_id);assert(rows[0].checkpoint.targets.every(t=>t.runId===null&&t.inputHash===null));
    await tx.$executeRaw`SELECT set_config('app.analysis_deployment_id',${resources.deploymentId},true)`;
    const candidates=await tx.$queryRaw`SELECT * FROM rh_analysis.discover_execution_jobs(${c.actor.tenantId},${resources.deploymentId},20)`;assert(candidates.some(v=>v.job_id===accepted.job.id));
    for(const v of candidates)assert.deepEqual(Object.keys(v).sort(),['job_id','tenant_id','study_group_id','research_project_id','study_id','actor_id','actor_auth_version','status'].sort());
    await expectDbRejection(()=>tx.$executeRaw`UPDATE rh_analysis.execution_job SET actor_auth_version=actor_auth_version+1 WHERE id=${accepted.job.id}`,'23514');
    await expectDbRejection(()=>tx.$queryRaw`SELECT * FROM rh_analysis.discover_execution_jobs(${'wrong-tenant'},${resources.deploymentId},20)`,'22023');
    await expectDbRejection(()=>tx.$queryRaw`SELECT * FROM rh_analysis.discover_execution_jobs(${c.actor.tenantId},${resources.deploymentId},0)`,'22023');
    await tx.$executeRaw`SELECT set_config('app.study_group_id',${'wf08-wrong-scope'},true)`;
    assert.equal((await tx.$queryRaw`SELECT id FROM rh_analysis.execution_job WHERE id=${accepted.job.id}`).length,0);
    await tx.$executeRaw`SELECT set_config('app.study_group_id',${c.scope.studyGroupId},true)`;
    await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');
    cases.push({jobId:accepted.job.id,authVersion:c.actor.authVersion,role:app.role,admission:true,receipt:true,candidateMetadata:true,wrongScopeDenied:true,bindingsImmutable:true,HTTP:false,Chrome:false});
   }
   throw sentinel;
  });throw Error('WF08_TRANSACTION_DID_NOT_ROLLBACK');}catch(error){if(error!==sentinel)throw error;rolledBack=true;}
 }catch(error){failure={name:error?.name??'Error',code:/^[A-Z0-9_]{1,100}$/.test(error?.code??'')?error.code:'WF08_ADMISSION_PREDICTION_FAILED'};}
 let protection=false;
 if(before!==undefined)try{const after=await readProtection({phase:'after',requestPrefix:prefix,transientIds,expectedPersistentWrites:0});const result=await compareProtection(before,after);assert.equal(result?.passed,true,'WF08_EXTERNAL_PROTECTION_REQUIRED');protection=true;}catch{failure={code:'WF08_EXTERNAL_PROTECTION_FAILED'};}
 if(failure||!rolledBack||!protection)throw Object.assign(Error('WF08_ADMISSION_PREDICTION_FAILED'),{code:failure?.code??'WF08_ADMISSION_PREDICTION_FAILED'});
 return{passed:true,phase:'A-admission-schema-only',persistentWrites:0,rolledBack,protection,cases,nativeComputation:false,HTTP:false,Chrome:false};
}
