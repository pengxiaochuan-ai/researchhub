// Single reviewed canonical migration, guarded synthetic target only. No Prisma history writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

assert.deepEqual(process.argv.slice(2),['--local-synthetic','--apply-reviewed-response-revisions']);
const migration='20261112020000_form_response_revision';
const directory=workspaceRoot+'app/server/prisma/migrations/'+migration+'/';
const sql=readFileSync(directory+'migration.sql','utf8');
const sha256=createHash('sha256').update(sql).digest('hex');
const rollbackSha256=createHash('sha256').update(readFileSync(directory+'rollback.sql')).digest('hex');
assert.equal(sha256,'340a95acc2f8b16d35e0b903685d0cbd3e9a25e07383e88e0aa7d4172ee726e4','MIGRATION_SOURCE_CHANGED_REQUIRES_REVIEW');
assert.equal(rollbackSha256,'22ce9ba20f552725a5d33a0e079edfee137d5bd151d0c17a928da945a3adbb8c','ROLLBACK_SOURCE_CHANGED_REQUIRES_REVIEW');
assert(!sql.includes('$rh_t07_canonical$')&&!sql.includes('$rh_t07_apply$'));
const tables=['form_response_revision','form_response_review_event','form_response_command_receipt'];
const preserved=['form_response','form_assignment','study_enrollment','subject_visit','visit_requirement_fulfillment','study_protocol_version','study_execution_policy_version'];
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t07-2026-11-12/';
mkdirSync(out,{recursive:true});
const env=fixtureEnvironment(),target=await assertFixtureTarget(env);
assert.equal(target.databaseName,'wp01_test_full_baseline');
async function fingerprints(tx){
 const result={};
 for(const table of preserved){
  const value=table==='form_response'?"to_jsonb(t)-'currentRevisionId'-'lockedRevisionId'-'version'":'to_jsonb(t)';
  result[table]=(await tx.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg((${value})::text,'' ORDER BY id),'')) AS fingerprint FROM public.${table} t`))[0];
 }
 result.prismaHistory=(await tx.$queryRawUnsafe('SELECT count(*)::int AS count, md5(coalesce(string_agg(to_jsonb(t)::text,\'\' ORDER BY id),\'\')) AS fingerprint FROM public._prisma_migrations t'))[0];
 return result;
}
try{
 const result=await withFixtureTransaction(env,'direct',async(tx,config,marker)=>{
  assert.equal(config.databaseName,target.databaseName);assert.equal(marker.syntheticOnly,true);assert.equal(marker.runId,config.runId);
  await tx.$executeRawUnsafe('SET LOCAL row_security = off');
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${migration}))`;
  const [prior]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;
  if(prior){
   assert.equal(prior.manifest.sha256,sha256);assert.equal(prior.manifest.rollbackSha256,rollbackSha256);
   for(const table of tables)assert((await tx.$queryRawUnsafe(`SELECT to_regclass('public.${table}')::text AS name`))[0].name);
   return {...prior.manifest,reused:true};
  }
  for(const table of tables)assert.equal((await tx.$queryRawUnsafe(`SELECT to_regclass('public.${table}')::text AS name`))[0].name,null);
  await tx.$executeRawUnsafe('LOCK TABLE '+preserved.map(t=>'public.'+t).join(', ')+' IN SHARE MODE');
  const before=await fingerprints(tx);
  await tx.$executeRawUnsafe('DO $rh_t07_apply$ BEGIN EXECUTE $rh_t07_canonical$'+sql+'$rh_t07_canonical$; END $rh_t07_apply$;');
  const after=await fingerprints(tx);assert.deepEqual(after,before);
  const [projection]=await tx.$queryRaw`SELECT count(*)::int AS changed FROM public.form_response WHERE version<>0 OR "currentRevisionId" IS NOT NULL OR "lockedRevisionId" IS NOT NULL`;
  assert.equal(projection.changed,0);
  const facts={};
  for(const table of tables){
   const [fact]=await tx.$queryRawUnsafe(`SELECT (SELECT count(*)::int FROM public.${table}) AS rows,
    (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.${table}'::regclass) AS rls,
    has_table_privilege('aisci_app','public.${table}','SELECT,INSERT') AS app_read_insert,
    has_table_privilege('aisci_app','public.${table}','UPDATE') AS app_update,
    has_table_privilege('aisci_app','public.${table}','DELETE') AS app_delete,
    has_table_privilege('aisci_app','public.${table}','TRUNCATE') AS app_truncate,
    has_table_privilege('aisci_app','public.${table}','REFERENCES') AS app_references,
    has_table_privilege('aisci_app','public.${table}','TRIGGER') AS app_trigger,
    (SELECT count(*)::int FROM pg_trigger WHERE tgrelid='public.${table}'::regclass AND NOT tgisinternal) AS guards`);
   assert.deepEqual(fact,{rows:0,rls:true,app_read_insert:true,app_update:false,app_delete:false,app_truncate:false,app_references:false,app_trigger:false,guards:2});
   facts[table]=fact;
  }
  const manifest={at:new Date().toISOString(),purpose:'research-t07-reviewed-response-revisions',syntheticOnly:true,databaseName:config.databaseName,fixtureRunId:config.runId,migration,sha256,rollbackSha256,before,after,oldValuesUnchanged:true,projection,facts,canonicalSqlOnly:true,prismaHistoryModified:false,businessRowsModified:0};
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${migration},${JSON.stringify(manifest)}::jsonb)`;
  return manifest;
 });
 writeFileSync(out+'migration.json',JSON.stringify({...result,committed:true},null,2));
 console.log(JSON.stringify({committed:true,migration,sha256,rollbackSha256,reused:result.reused??false,oldValuesUnchanged:result.oldValuesUnchanged,facts:result.facts}));
}catch(error){
 const failure={passed:false,migration,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[database]').slice(0,1800)};
 writeFileSync(out+'migration-failure-'+Date.now()+'.json',JSON.stringify(failure,null,2));
 console.error(JSON.stringify(failure));process.exitCode=1;
}
