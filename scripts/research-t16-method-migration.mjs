// Apply only the independently reviewed method CHECK to the guarded synthetic database.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--apply-reviewed-descriptive-method']);
const migration='20261112050000_descriptive_method',sql=readFileSync(workspaceRoot+'app/server/prisma/migrations/'+migration+'/migration.sql','utf8');
const sha256=createHash('sha256').update(sql).digest('hex'),rollbackSha256=createHash('sha256').update(readFileSync(workspaceRoot+'researchhub/docs/planning/research-study-workflow-2026-11-11/t16/rollback.sql')).digest('hex');
assert.equal(sha256,'1ee76ae5a6071cb8670b69a7c950ef5d87e678b356d015bbf7a5fd85e9f838e4');assert.equal(rollbackSha256,'eb9d238348af95801e892c30ec694bde2b5b28af13e3264a707e71d04cfc72a5');
const env=fixtureEnvironment(),target=await assertFixtureTarget(env);assert.equal(target.databaseName,'wp01_test_full_baseline');
async function snapshot(tx){
 const [rows]=await tx.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY id),'')) AS fingerprint FROM public.research_method_run c`;
 const [history]=await tx.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY id),'')) AS fingerprint FROM public._prisma_migrations m`;
 const [security]=await tx.$queryRaw`SELECT relrowsecurity,relforcerowsecurity,relacl::text FROM pg_class WHERE oid='public.research_method_run'::regclass`;
 return {rows,history,security};
}
const result=await withFixtureTransaction(env,'direct',async(tx,config,marker)=>{
 assert(marker.syntheticOnly);assert.equal(config.databaseName,target.databaseName);
 await tx.$executeRawUnsafe('SET LOCAL row_security = off');await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${migration}))`;
 const [prior]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;
 if(prior){assert.equal(prior.manifest.sha256,sha256);return {...prior.manifest,reused:true};}
 await tx.$executeRawUnsafe('LOCK TABLE public.research_method_run IN ACCESS EXCLUSIVE MODE');
 await tx.$executeRawUnsafe('LOCK TABLE public._prisma_migrations IN SHARE MODE');
 const [constraint]=await tx.$queryRaw`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.research_method_run'::regclass AND conname='research_method_run_skill_key_check'`;
 assert(constraint?.definition.includes('statistical-power')&&constraint.definition.includes('diagnostic-evidence-assembly')&&!constraint.definition.includes('descriptive-statistics'));
 const before=await snapshot(tx);
 assert(!sql.includes('$rh_descriptive_check$')&&!sql.includes('$rh_descriptive_sql$'));
 await tx.$executeRawUnsafe('DO $rh_descriptive_check$ BEGIN EXECUTE $rh_descriptive_sql$'+sql+'$rh_descriptive_sql$; END $rh_descriptive_check$;');
 const after=await snapshot(tx);assert.deepEqual(after,before);
 const [updated]=await tx.$queryRaw`SELECT pg_get_constraintdef(oid) AS definition,convalidated FROM pg_constraint WHERE conrelid='public.research_method_run'::regclass AND conname='research_method_run_skill_key_check'`;
 assert(updated.convalidated&&updated.definition.includes('descriptive-statistics')&&updated.definition.includes('statistical-power')&&updated.definition.includes('diagnostic-evidence-assembly'));
 const record={at:new Date().toISOString(),syntheticOnly:true,migration,databaseName:config.databaseName,sha256,rollbackSha256,before,after,oldRowsAndSecurityUnchanged:true,prismaHistoryModified:false,forwardInOneGuardedTransaction:true,constraintValidated:true,workerExecuted:false,productionAcceptance:false};
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${migration},${JSON.stringify(record)}::jsonb)`;return record;
});
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t16-2026-11-12/';mkdirSync(out,{recursive:true});writeFileSync(out+'method-check-migration.json',JSON.stringify({...result,committed:true},null,2));console.log(JSON.stringify({committed:true,sha256,reused:result.reused??false,oldRowsAndSecurityUnchanged:true,workerExecuted:false}));
