import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixtureEnvironment,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const apply=process.argv[2]==='--apply';assert(apply||process.argv[2]==='--dry-run');
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const dir=workspaceRoot+'researchhub/docs/testing/evidence/real-study-full-simulation-2026-11-13/migration/';mkdirSync(dir,{recursive:true});
const source=readFileSync(new URL('../docs/planning/real-study-full-simulation-2026-11-13/v2-analysis-parent-candidate.sql',import.meta.url),'utf8');
const save=(name,value)=>writeFileSync(dir+name,JSON.stringify(value,null,2)+'\n');
async function fingerprint(tx){return(await tx.$queryRaw`SELECT md5(pg_get_functiondef(oid)) AS md5,md5(prosrc) AS "sourceMd5",pg_get_functiondef(oid) AS definition,proowner::regrole::text AS owner,proacl::text AS acl FROM pg_proc WHERE oid='rh_analysis.parents()'::regprocedure`)[0];}
const before=await withFixtureTransaction(env,'direct',fingerprint,{readOnly:true});
assert.equal(before.sourceMd5,'df0eb9cddf4df5d592e07b9ef78f191e','CURRENT_ANALYSIS_PARENTS_CHANGED_STOP_REVIEW');
save('before.json',before);const rollback=Error('EXPECTED_DRY_RUN_ROLLBACK');let after,checks;
try{await withFixtureTransaction(env,'direct',async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('researchhub:full-study-parent-migration-v2',0))::text`;
 assert.equal((await fingerprint(tx)).md5,before.md5);
 await tx.$executeRaw`SELECT set_config('rh_migration.expected_parents_md5',${before.md5},true)`;
 for(const statement of source.split('-- @statement').slice(1))if(statement.trim())await tx.$executeRawUnsafe(statement);
 after=await fingerprint(tx);assert.notEqual(after.md5,before.md5);assert.equal(after.owner,before.owner);assert.equal(after.acl,before.acl);
 await tx.$executeRawUnsafe('SAVEPOINT analysis_v1_regression');
 const [old]=await tx.$queryRaw`SELECT * FROM rh_analysis.plan WHERE definition->>'schemaVersion'='t15-synthetic-plan-v1' ORDER BY created_at DESC LIMIT 1`;
 assert(old,'V1_REAL_BASELINE_REQUIRED');
 await tx.$executeRaw`INSERT INTO rh_analysis.plan(id,tenant_id,study_group_id,research_project_id,study_id,protocol_version_id,definition,content_hash,submitted_by)VALUES('full-study-migration-v1-rollback-probe',${old.tenant_id},${old.study_group_id},${old.research_project_id},${old.study_id},${old.protocol_version_id},${JSON.stringify(old.definition)}::jsonb,${old.content_hash},${old.submitted_by})`;
 // PostgreSQL exception subtransactions verify the preserved v1 and independent v2 rejection paths.
 await tx.$executeRawUnsafe(`DO $$ BEGIN
 BEGIN INSERT INTO rh_analysis.plan SELECT 'full-study-migration-bad-v1',tenant_id,study_group_id,research_project_id,study_id,protocol_version_id,jsonb_set(definition,'{purposeKey}','"invalid"'),content_hash,submitted_by,now() FROM rh_analysis.plan WHERE id='full-study-migration-v1-rollback-probe'; RAISE EXCEPTION 'BAD_V1_ACCEPTED'; EXCEPTION WHEN check_violation THEN IF SQLERRM<>'ANALYSIS_PLAN_INVALID' THEN RAISE; END IF; END;
 BEGIN INSERT INTO rh_analysis.plan SELECT 'full-study-migration-bad-v2',tenant_id,study_group_id,research_project_id,study_id,protocol_version_id,jsonb_set(definition,'{schemaVersion}','"full-study-simulation-v2"'),content_hash,submitted_by,now() FROM rh_analysis.plan WHERE id='full-study-migration-v1-rollback-probe'; RAISE EXCEPTION 'BAD_V2_ACCEPTED'; EXCEPTION WHEN check_violation THEN IF SQLERRM<>'FULL_STUDY_PLAN_INVALID' THEN RAISE; END IF; END;
 END $$;`);
 checks={oldV1RealPlanAccepted:true,oldV1WrongPurposeRejected:true,v2MissingCaseRejected:true,ownerAndAclUnchanged:true};
 await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT analysis_v1_regression');
 if(!apply)throw rollback;
 await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest)VALUES('rh-full-study-analysis-parents-v2-20261113',${JSON.stringify({syntheticOnly:true,database:'wp01_test_full_baseline',beforeMd5:before.md5,afterMd5:after.md5,sourceSha256:createHash('sha256').update(source).digest('hex'),checks})}::jsonb)`;
});}catch(e){if(e!==rollback)throw e;}
const observed=await withFixtureTransaction(env,'direct',fingerprint,{readOnly:true});assert.equal(observed.md5,apply?after.md5:before.md5);
save(apply?'applied.json':'dry-run.json',{at:new Date().toISOString(),applied:apply,rolledBack:!apply,beforeMd5:before.md5,afterMd5:after.md5,observedMd5:observed.md5,sourceSha256:createHash('sha256').update(source).digest('hex'),checks});save('after-candidate.json',after);
console.log(JSON.stringify({applied:apply,rolledBack:!apply,checks}));
