// Only the independently reviewed canonical SQL, on the marked local synthetic database.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--apply-reviewed-policy']);
const migration='20261111230000_study_execution_policy',sql=readFileSync(workspaceRoot+'app/server/prisma/migrations/'+migration+'/migration.sql','utf8'),digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex'),hash=digest(sql);
assert.equal(hash,'030d4b895b4b24b6eb4cdce5b49a7b3c142d59317c55a1fbfa016ae17947f19e','MIGRATION_SOURCE_CHANGED_REQUIRES_REVIEW');
assert(!sql.includes('$rh_t05_canonical$')&&!sql.includes('$rh_t05_apply$'));
const env=fixtureEnvironment(),target=await assertFixtureTarget(env);assert.equal(target.databaseName,'wp01_test_full_baseline');
const rows=tx=>tx.$queryRaw`SELECT id,"tenantId","studyGroupId","researchProjectId","versionNumber",status,"updatedAt" FROM public.study_protocol_version ORDER BY id`;
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t05-2026-11-11/';mkdirSync(out,{recursive:true});
try{
 const result=await withFixtureTransaction(env,'direct',async(tx,config,marker)=>{
  assert.equal(config.databaseName,target.databaseName);assert.equal(marker.syntheticOnly,true);assert.equal(marker.runId,config.runId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${migration}))`;
  const [prior]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;
  if(prior){assert.equal(prior.manifest.sha256,hash);assert((await tx.$queryRaw`SELECT to_regclass('public.study_execution_policy_version')::text AS name`)[0].name);return {...prior.manifest,reused:true};}
  assert.equal((await tx.$queryRaw`SELECT to_regclass('public.study_execution_policy_version')::text AS name`)[0].name,null);
  await tx.$executeRawUnsafe('LOCK TABLE public.study_protocol_version IN ACCESS EXCLUSIVE MODE');
  const before=await rows(tx);
  // PostgreSQL executes the reviewed multi-command string through its native SPI in this same transaction.
  await tx.$executeRawUnsafe('DO $rh_t05_apply$ BEGIN EXECUTE $rh_t05_canonical$'+sql+'$rh_t05_canonical$; END $rh_t05_apply$;');
  const after=await rows(tx);assert.deepEqual(after,before);
  const [facts]=await tx.$queryRaw`SELECT (SELECT count(*)::int FROM public.study_execution_policy_version) AS policies,(SELECT count(*)::int FROM public.study_protocol_version WHERE "approvedPolicyVersionId" IS NOT NULL OR "approvedPolicyHash" IS NOT NULL) AS bindings,(SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.study_execution_policy_version'::regclass) AS rls,has_table_privilege('aisci_app','public.study_execution_policy_version','SELECT,INSERT,UPDATE') AS app_privileges`;
  assert.equal(facts.policies,0);assert.equal(facts.bindings,0);assert.equal(facts.rls,true);assert.equal(facts.app_privileges,true);
  const manifest={at:new Date().toISOString(),purpose:'research-t05-reviewed-canonical-policy-fixture',syntheticOnly:true,databaseName:config.databaseName,fixtureRunId:config.runId,migration,sha256:hash,existingProtocolRows:before.length,beforeHash:digest(before),afterHash:digest(after),facts,canonicalSqlOnly:true,prismaHistoryModified:false,businessRowsModified:0};
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${migration},${JSON.stringify(manifest)}::jsonb)`;return manifest;
 });
 writeFileSync(out+'migration.json',JSON.stringify({...result,committed:true},null,2));console.log(JSON.stringify({committed:true,migration,sha256:hash,reused:result.reused??false,existingProtocolRows:result.existingProtocolRows,oldValuesUnchanged:result.beforeHash===result.afterHash}));
}catch(error){writeFileSync(out+'migration-failure.json',JSON.stringify({passed:false,migration,message:error.message},null,2));console.error(JSON.stringify({passed:false,migration,message:String(error.message).slice(0,1400)}));process.exitCode=1;}
