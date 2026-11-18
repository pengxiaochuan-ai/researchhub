// App-role RLS/immutability proof. Every inserted context row is rolled back.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root=fileURLToPath(new URL('../../',import.meta.url));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const [row]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});
assert(row?.manifest?.syntheticOnly===true,'S08_FIXTURE_REQUIRED');
const {plan,taskIds}=row.manifest,scope=plan.scope,taskId=taskIds[0];
const rollback=new Error('S08_EXPECTED_RLS_ROLLBACK'),checks=[];let stage='hash-not-null';
try{
  try{
    await withFixtureTransaction(env,'app',async db=>{
      await db.$executeRaw`SELECT set_config('app.tenant_id',${scope.tenantId},true),set_config('app.study_group_id',${scope.studyGroupId},true),set_config('app.research_project_id',${scope.researchProjectId},true)`;
      await db.$executeRawUnsafe('SAVEPOINT s08_hash_probe');let missingHashRejected=false;
      try{await db.$executeRaw`INSERT INTO rh_study_tasks.context(task_id,tenant_id,study_group_id,research_project_id,kind,source_id,parent_id,root_id,source_version,created_by,actor_account_id)
        VALUES(${taskId},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},'synthetic_crf_record','synthetic-invalid-source','synthetic-invalid-parent','synthetic-invalid-root',1,${plan.ids.admin},${plan.ids.admin})`;}
      catch(error){missingHashRejected=error.meta?.code==='23514';}
      await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT s08_hash_probe');
      assert(missingHashRejected,'S08_MISSING_HASH_ACCEPTED');checks.push('context_requires_source_hash');stage='rls-read';
      await db.$executeRaw`INSERT INTO rh_study_tasks.context(task_id,tenant_id,study_group_id,research_project_id,kind,created_by,actor_account_id)
        VALUES(${taskId},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},'none',${plan.ids.admin},${plan.ids.admin})`;
      const count=async()=>Number((await db.$queryRaw`SELECT count(*) n FROM rh_study_tasks.context WHERE task_id=${taskId}`)[0].n);
      assert.equal(await count(),1);
      await db.$executeRaw`SELECT set_config('app.tenant_id','synthetic-foreign-tenant',true)`;assert.equal(await count(),0);
      await db.$executeRaw`SELECT set_config('app.tenant_id',${scope.tenantId},true),set_config('app.study_group_id','synthetic-foreign-group',true)`;assert.equal(await count(),0);
      await db.$executeRaw`SELECT set_config('app.study_group_id',${scope.studyGroupId},true),set_config('app.research_project_id',${plan.project.id},true)`;assert.equal(await count(),0);
      checks.push('app_role_tenant_group_project_rls');stage='immutable-receipt';
      await db.$executeRaw`SELECT set_config('app.research_project_id',${scope.researchProjectId},true)`;
      await db.$executeRawUnsafe('SAVEPOINT s08_immutable_probe');let updateDenied=false;
      try{await db.$executeRaw`UPDATE rh_study_tasks.operation SET reason='synthetic-forbidden-change' WHERE task_id=${taskId}`;}
      catch(error){updateDenied=error.meta?.code==='42501';}
      await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT s08_immutable_probe');
      assert(updateDenied,'S08_OPERATION_MUTATION_ALLOWED');checks.push('app_cannot_update_receipt');
      throw rollback;
    });
  }catch(error){if(error!==rollback)throw error;}
  const [after]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT count(*) n FROM rh_study_tasks.context WHERE task_id=${taskId}`,{readOnly:true});
  assert.equal(Number(after.n),0);checks.push('context_probe_rolled_back');
  const output=root+'researchhub/.superpowers/sdd/implementation-plan-study-tasks-s08-2026-11-02/schema-pg-'+randomUUID()+'.json';
  writeFileSync(output,JSON.stringify({passed:true,stage,checks,taskId,committedProbeRows:0},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({passed:true,checks,committedProbeRows:0,evidence:output}));
}catch(error){console.error(JSON.stringify({passed:false,stage,code:/^S08_/.test(error.message)?error.message:error.meta?.code??error.code??'S08_SCHEMA_PG_UNAVAILABLE',checks}));process.exitCode=1;}
