// Apply only independently reviewed canonical SQL to the marked synthetic database.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--apply-reviewed-participation']);
const migration='20261112010000_study_participation_event';
const sql=readFileSync(workspaceRoot+'app/server/prisma/migrations/'+migration+'/migration.sql','utf8');
const sha256=createHash('sha256').update(sql).digest('hex');
assert.equal(sha256,'5bbaf33225b366f690eb3e9ba484f3074ca6b999376964150342fd4b11643e47','MIGRATION_SOURCE_CHANGED_REQUIRES_REVIEW');
assert(!sql.includes('$rh_t06_canonical$')&&!sql.includes('$rh_t06_apply$'));
const env=fixtureEnvironment(),target=await assertFixtureTarget(env);
assert.equal(target.databaseName,'wp01_test_full_baseline');
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t06-2026-11-12/';mkdirSync(out,{recursive:true});
const oldFacts=async tx=>{
 const facts={};
 for(const table of ['subject','study_enrollment','study_protocol_version','study_execution_policy_version']){
  facts[table]=(await tx.$queryRawUnsafe('SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text,\'\' ORDER BY id),\'\')) AS fingerprint FROM public.'+table+' t'))[0];
 }
 return facts;
};
try{
 const result=await withFixtureTransaction(env,'direct',async(tx,config,marker)=>{
  assert.equal(config.databaseName,target.databaseName);assert.equal(marker.syntheticOnly,true);assert.equal(marker.runId,config.runId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${migration}))`;
  const [prior]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;
  if(prior){assert.equal(prior.manifest.sha256,sha256);assert((await tx.$queryRaw`SELECT to_regclass('public.study_participation_event')::text AS name`)[0].name);return {...prior.manifest,reused:true};}
  assert.equal((await tx.$queryRaw`SELECT to_regclass('public.study_participation_event')::text AS name`)[0].name,null);
  await tx.$executeRawUnsafe('LOCK TABLE public.subject, public.study_enrollment, public.study_protocol_version, public.study_execution_policy_version IN SHARE MODE');
  const before=await oldFacts(tx);
  await tx.$executeRawUnsafe('DO $rh_t06_apply$ BEGIN EXECUTE $rh_t06_canonical$'+sql+'$rh_t06_canonical$; END $rh_t06_apply$;');
  const after=await oldFacts(tx);assert.deepEqual(after,before);
  const [facts]=await tx.$queryRaw`SELECT (SELECT count(*)::int FROM public.study_participation_event) AS events,(SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.study_participation_event'::regclass) AS rls,has_table_privilege('aisci_app','public.study_participation_event','SELECT,INSERT') AS app_read_insert,has_table_privilege('aisci_app','public.study_participation_event','UPDATE') AS app_update,has_table_privilege('aisci_app','public.study_participation_event','DELETE') AS app_delete,has_table_privilege('aisci_app','public.study_participation_event','TRUNCATE') AS app_truncate,has_table_privilege('aisci_app','public.study_participation_event','REFERENCES') AS app_references,has_table_privilege('aisci_app','public.study_participation_event','TRIGGER') AS app_trigger,(SELECT count(*)::int FROM pg_trigger WHERE tgrelid='public.study_participation_event'::regclass AND tgname='study_participation_event_guard') AS immutable_trigger`;
  assert.deepEqual(facts,{events:0,rls:true,app_read_insert:true,app_update:false,app_delete:false,app_truncate:false,app_references:false,app_trigger:false,immutable_trigger:1});
  const manifest={at:new Date().toISOString(),purpose:'research-t06-reviewed-participation-fixture',syntheticOnly:true,databaseName:config.databaseName,fixtureRunId:config.runId,migration,sha256,before,after,oldValuesUnchanged:true,facts,canonicalSqlOnly:true,prismaHistoryModified:false,businessRowsModified:0};
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${migration},${JSON.stringify(manifest)}::jsonb)`;
  return manifest;
 });
 writeFileSync(out+'migration.json',JSON.stringify({...result,committed:true},null,2));
 console.log(JSON.stringify({committed:true,migration,sha256,reused:result.reused??false,oldValuesUnchanged:result.oldValuesUnchanged,facts:result.facts}));
}catch(error){
 const failure={passed:false,migration,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(0,1400)};
 writeFileSync(out+'migration-failure.json',JSON.stringify(failure,null,2));console.error(JSON.stringify(failure));process.exitCode=1;
}
