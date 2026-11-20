import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeSchema, dataCheck, stageSql, sequenceResetSql, buildPackage, preDataEmptyGuardSql, ROLE_MAP } from './manual-rds-package.mjs';

test('maps only frozen role names and preserves fixture IDs; no psql directives/session leakage',()=>{
 const result=normalizeSchema("\\restrict abc\nSET lock_timeout = 0;\nSET row_security = off;\nSELECT pg_catalog.set_config('search_path', '', false);\nGRANT SELECT ON rh_asset.asset TO aisci_app;\n-- rh-kb-local-b0e2af9d\n\\unrestrict abc\n",'post-data');
 assert.match(result,/SET LOCAL row_security/);assert.match(result,/search_path', '', true/);
 assert.match(result,/TO researchhub_demo_app/);assert.match(result,/rh-kb-local-b0e2af9d/);assert.doesNotMatch(result,/\\restrict|SET lock_timeout/);
});
test('unexpected executable dump commands and data mutations fail closed',()=>{
 for(const sql of ['\\connect aisci\n','INSERT INTO x VALUES(1);','DROP TABLE x;','COPY x FROM stdin;']) assert.throws(()=>normalizeSchema(sql,'post-data'),/MANUAL_/);
});
test('pre-data preserves special function ownership with temporary schema CREATE',()=>{
 const result=normalizeSchema('CREATE SCHEMA public;\nALTER SCHEMA public OWNER TO pg_database_owner;\nALTER FUNCTION rh_analysis.discover_execution_jobs(p_tenant text, p_deployment text, p_limit integer) OWNER TO rh_analysis_job_candidate_reader;','pre-data');
 assert.doesNotMatch(result,/CREATE SCHEMA public;/);assert.match(result,/GRANT USAGE,CREATE ON SCHEMA rh_analysis/);assert.match(result,/REVOKE CREATE/);
});
test('wrong database guard executes before any grant and all transaction grants are revoked',()=>{
 const sql=stageSql('SELECT 1;',"DO $$ BEGIN IF current_database()<>'researchhub' THEN RAISE EXCEPTION 'wrong'; END IF; END $$;",'');
 assert.ok(sql.indexOf('current_database()')<sql.indexOf('GRANT '));assert.match(sql,/REVOKE researchhub_demo_analysis_reader FROM researchhub_demo_owner;[\s\S]*COMMIT;/);
 assert.equal(Object.keys(ROLE_MAP).length,4);
});
test('post-data and password activation cannot bypass data completeness',()=>{
 assert.match(dataCheck([{schema:'public',table:'account',rows:20}]),/actual<>20/);
 const passwords=readFileSync(new URL('./manual-rds/07-set-passwords.sql',import.meta.url),'utf8');
 assert.match(passwords,/MANUAL_GENERATE_PRIVATE_PACKAGE_FIRST/);assert.match(passwords,/-- SOURCE_AND_STAGE_GUARD/);assert.match(passwords,/MANUAL_FILL_TWO_DIFFERENT_PASSWORDS/);
});
test('identity sequence inventory is exact and imported values determine next allocation',()=>{
 assert.throws(()=>sequenceResetSql(''),/MANUAL_IDENTITY_INVENTORY_CHANGED/);
 const sql=sequenceResetSql(Array.from({length:7},(_,i)=>`ALTER TABLE rh_source.table_${i} ALTER COLUMN value ADD GENERATED ALWAYS AS IDENTITY`).join('\n'));
 assert.equal((sql.match(/pg_catalog.setval/g)||[]).length,7);assert.match(sql,/max\(value\)/);
});
test('private schema cannot be generated into a public source directory',()=>{
 assert.throws(()=>buildPackage('/not-read','/Users/mac/aisciencesys/researchhub/deploy/unsafe-output'),/MANUAL_OUTPUT_MUST_BE_LOCAL_IGNORED_TMP/);
});
test('RDS metadata exception requires one precise persistent extension member',()=>{
 const sql=preDataEmptyGuardSql();
 for(const clause of ["n.nspname='vector'","c.relname='rabitq_info'","c.relpersistence='p'","c.relkind IN ('r','p')","pg_get_userbyid(c.relowner)='aisci_control'","d.deptype='e'","d.objsubid=0","e.extname='vector'","e.extversion='0.8.1.2'","en.nspname='public'"]) assert.ok(sql.includes(clause),clause);
 assert.match(sql,/NOT COALESCE/);
 assert.match(sql,/MANUAL_TARGET_NOT_EMPTY/);
});
