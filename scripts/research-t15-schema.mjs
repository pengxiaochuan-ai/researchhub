// Explicit, reviewed new schema only. Does not run Prisma migration deployment.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--apply-reviewed-analysis-basis']);
const migration='20261112040000_analysis_basis',sql=readFileSync(workspaceRoot+'app/server/prisma/migrations/'+migration+'/migration.sql','utf8');
const sha256=createHash('sha256').update(sql).digest('hex');assert.equal(sha256,'b7782324249cffeadb36986c989a934622180c48a7e0e909f403a9a64fe1ad7a');
assert.equal(readFileSync(workspaceRoot+'researchhub/docs/planning/research-study-workflow-2026-11-11/t15/schema-candidate.sql','utf8'),sql);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
async function oldState(tx){
 const [history]=await tx.$queryRaw`SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY id),'')) AS fingerprint FROM public._prisma_migrations m`;
 const security=await tx.$queryRaw`SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','rh_research') AND c.relkind='r' ORDER BY n.nspname,c.relname`;
 const policies=await tx.$queryRaw`SELECT * FROM pg_policies WHERE schemaname IN ('public','rh_research') ORDER BY schemaname,tablename,policyname`;
 return {history,securityHash:createHash('sha256').update(JSON.stringify(security)).digest('hex'),policiesHash:createHash('sha256').update(JSON.stringify(policies)).digest('hex')};
}
const result=await withFixtureTransaction(env,'direct',async(tx,config,marker)=>{
 assert(marker.syntheticOnly);await tx.$executeRawUnsafe('SET LOCAL row_security=off');await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${migration}))::text`;
 const [prior]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${migration}`;if(prior){assert.equal(prior.manifest.sha256,sha256);return {...prior.manifest,reused:true};}
 const [existing]=await tx.$queryRaw`SELECT count(*)::int AS count FROM pg_namespace WHERE nspname='rh_analysis'`;assert.equal(existing.count,0);
 await tx.$executeRawUnsafe('LOCK TABLE public._prisma_migrations IN SHARE MODE');const before=await oldState(tx);
 assert(!sql.includes('$rh_analysis_apply$')&&!sql.includes('$rh_analysis_sql$'));
 await tx.$executeRawUnsafe('DO $rh_analysis_apply$ BEGIN EXECUTE $rh_analysis_sql$'+sql+'$rh_analysis_sql$; END $rh_analysis_apply$;');
 const after=await oldState(tx);assert.deepEqual(after,before);
 const tables=await tx.$queryRaw`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege('aisci_app',c.oid,'SELECT') AS can_select,has_table_privilege('aisci_app',c.oid,'INSERT') AS can_insert,has_table_privilege('aisci_app',c.oid,'UPDATE') AS can_update,has_table_privilege('aisci_app',c.oid,'DELETE') AS can_delete,has_table_privilege('aisci_app',c.oid,'TRUNCATE') AS can_truncate FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_analysis' AND c.relkind='r' ORDER BY c.relname`;
 assert.deepEqual(tables.map(x=>x.relname),['plan','plan_review','snapshot']);assert(tables.every(x=>x.relrowsecurity&&x.relforcerowsecurity&&x.can_select&&x.can_insert&&!x.can_update&&!x.can_delete&&!x.can_truncate));
 const record={at:new Date().toISOString(),syntheticOnly:true,migration,sha256,databaseName:config.databaseName,before,after,tables,oldSecurityPoliciesAndPrismaHistoryUnchanged:true,rollbackExecuted:false,productionAcceptance:false};
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${migration},${JSON.stringify(record)}::jsonb)`;return record;
});
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t15-2026-11-12/';mkdirSync(out,{recursive:true});writeFileSync(out+'schema-migration.json',JSON.stringify({...result,committed:true},null,2));console.log(JSON.stringify({committed:true,sha256,reused:result.reused??false,oldSecurityPoliciesAndPrismaHistoryUnchanged:true}));
