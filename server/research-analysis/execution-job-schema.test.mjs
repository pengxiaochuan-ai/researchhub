import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=()=>readFileSync(new URL('../../../app/server/prisma/migrations/20261117154400_research_analysis_execution_job/migration.sql',import.meta.url),'utf8');
test('new Job RLS leaves every old table/role untouched and admission uniqueness excludes authVersion',()=>{
 const s=sql();assert.match(s,/UNIQUE\s*\(tenant_id,study_id,actor_id,request_key\)/);assert(!/UNIQUE\s*\([^)]*actor_auth_version/.test(s));
 assert.match(s,/ENABLE ROW LEVEL SECURITY/);assert.match(s,/FORCE ROW LEVEL SECURITY/);assert.match(s,/TO aisci_app/);
 assert.match(s,/app\.tenant_id/);assert.match(s,/app\.study_group_id/);assert.match(s,/app\.research_project_id/);
 assert(!/ALTER (?:TABLE|ROLE) (?:public\.|aisci_app|aisci_owner)|row_security\s*=\s*off|DISABLE ROW LEVEL/i.test(s));
});
test('candidate owner is isolated NOLOGIN/NOBYPASSRLS and receives only metadata column SELECT',()=>{
 const s=sql();assert.match(s,/CREATE ROLE rh_analysis_job_candidate_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT/);
 const grant=s.match(/GRANT SELECT\s*\(([^)]+)\) ON rh_analysis\.execution_job TO rh_analysis_job_candidate_reader/);assert(grant);assert(!/token|operator|checkpoint|request_hash/.test(grant[1]));
 assert.match(s,/CREATE POLICY candidate_metadata.*TO rh_analysis_job_candidate_reader/s);
 assert(!/GRANT rh_analysis_job_candidate_reader TO/.test(s));
});
test('definer function is bounded current-tenant/deployment read with no token, native table or mutation',()=>{
 const s=sql(),body=s.match(/CREATE FUNCTION rh_analysis\.discover_execution_jobs[\s\S]+?AS \$candidate\$([\s\S]+?)\$candidate\$/)?.[1];assert(body);
 assert.match(s,/SECURITY DEFINER SET search_path=pg_catalog/);assert.match(s,/REVOKE ALL ON FUNCTION rh_analysis\.discover_execution_jobs[^;]+FROM PUBLIC/);
 assert.match(body,/p_limit<1 OR p_limit>20/);assert.match(body,/p_tenant IS DISTINCT FROM current_setting\('app.tenant_id',true\)/);assert.match(body,/p_deployment IS DISTINCT FROM current_setting\('app.analysis_deployment_id',true\)/);
 assert(!/lease_token|lease_owner|public\.|INSERT|UPDATE|DELETE|FOR UPDATE|EXECUTE\s/i.test(body));assert.match(body,/LIMIT p_limit/);assert.match(body,/ORDER BY j.created_at,j.id/);
});
test('Job trigger protects fixed columns and monotonic per-target bindings before updates',()=>{
 const s=sql();assert.match(s,/ANALYSIS_JOB_BINDING_IMMUTABLE/);assert.match(s,/ANALYSIS_JOB_TARGET_IMMUTABLE/);assert.match(s,/ANALYSIS_JOB_PARENT_INVALID/);
 assert.match(s,/BEFORE INSERT OR UPDATE OR DELETE ON rh_analysis\.execution_job/);assert.match(s,/compute_attempt BETWEEN 0 AND 3/);assert.match(s,/lease_generation>=OLD.lease_generation/);
 assert(!/CREATE TABLE public\.|ALTER TABLE rh_analysis\.(snapshot|plan|plan_review)/.test(s));
});
test('pending first and batch are discriminated; first never claims a native targetsHash',()=>{
 const s=sql();assert.match(s,/ANALYSIS_JOB_PENDING_INVALID/);assert.match(s,/pending->>'kind'='first'/);assert.match(s,/pending->>'kind'='batch'/);assert.match(s,/jobTargetsHash/);assert.match(s,/full-study-batch-v1/);
 assert.match(s,/pending \? 'targetsHash'/);assert.match(s,/pending->'body'->>'limit'<>'1'/);assert.match(s,/pending->'body'->>'limit'<>'3'/);
});
test('rollback holds one exclusive transaction and refuses RLS-hidden or any accepted Job before DROP',()=>{
 const down=readFileSync(new URL('../../../app/server/prisma/migrations/20261117154400_research_analysis_execution_job/rollback.sql',import.meta.url),'utf8');
 const lock=down.indexOf('LOCK TABLE rh_analysis.execution_job IN ACCESS EXCLUSIVE MODE'),rls=down.indexOf('row_security_active'),count=down.indexOf('count(*)'),drop=down.indexOf('DROP FUNCTION');
 assert(lock>=0&&rls>lock&&count>rls&&drop>count);assert.match(down,/row_security_active\([^)]*\) IS DISTINCT FROM false/);assert.match(down,/DO \$rollback\$[\s\S]+DROP ROLE[\s\S]+END \$rollback\$/);
 assert(!/CASCADE|row_security\s*=\s*off|ALTER ROLE/i.test(down));
});
test('candidate effective ACL checks every user relation, column grants, PUBLIC and SET ROLE replacement paths',()=>{
 const s=sql(),acl=s.slice(s.indexOf('DO $privileges$'));
 assert.match(acl,/pg_class/);assert.match(acl,/pg_namespace/);assert.match(acl,/has_any_column_privilege/);assert.match(acl,/has_column_privilege/);assert.match(acl,/has_sequence_privilege/);
 assert.match(acl,/pg_auth_members/);assert.match(acl,/pg_has_role/);assert.match(acl,/pg_roles/);assert.match(acl,/pg_proc/);assert.match(acl,/aclexplode/);assert.match(acl,/grantee=0/);
 assert.match(acl,/ANALYSIS_JOB_CANDIDATE_OWNER_INVALID/);assert.match(acl,/ANALYSIS_JOB_CANDIDATE_COLUMN_INVALID/);assert.match(acl,/ANALYSIS_JOB_FUNCTION_REPLACEABLE/);
 assert.match(acl,/c\.relkind IN \('r','p','v','m','f'\)/);assert.match(acl,/a\.attnum>0 AND NOT a\.attisdropped/);
});
test('explicit statement-break splitting preserves each complete function/DO in one transaction chunk',()=>{
 const down=readFileSync(new URL('../../../app/server/prisma/migrations/20261117154400_research_analysis_execution_job/rollback.sql',import.meta.url),'utf8');
 for(const source of [sql(),down]){
  assert(source.startsWith('-- statement-break\n'));
  const chunks=source.split(/^-- statement-break\s*$/m).filter(v=>v.trim());assert(chunks.length>0);
  for(const chunk of chunks){
   const body=chunk.replace(/^--.*$/gm,'').trim();assert.match(body,/^(?:CREATE|ALTER|REVOKE|GRANT|DO) /);assert(body.endsWith(';'));
   assert.equal((body.match(/^(?:CREATE|ALTER|REVOKE|GRANT|DO) /gm)??[]).length,1);
   const tags=body.match(/\$[a-z_]+\$/g)??[];assert(tags.length===0||tags.length===2&&tags[0]===tags[1]);
  }
  if(source===down)assert.equal(chunks.length,1,'rollback lock/check/drop must be one atomic DO');
 }
});
test('observed PostgreSQL empty-ACL 22023 is avoided with the existing NULL ACL zero-row expression',()=>{
 // Root's immutable read-only isolation, not a PostgreSQL call performed by this test.
 const observed=JSON.parse(readFileSync(new URL('../../docs/testing/evidence/study-workflow-simplification-2026-11-17/wf08/root/acl-array-readonly-diagnostic-v1.json',import.meta.url),'utf8'));
 assert.equal(observed.readOnly,true);assert.equal(observed.persistentWrites,0);
 const empty=observed.results.find(r=>r.label==='empty-acl-array'),nullAcl=observed.results.find(r=>r.label==='null-acl-array');
 assert.equal(empty.passed,false);assert.equal(empty.sqlState,'22023');assert.equal(nullAcl.passed,true);assert.equal(nullAcl.rows[0].count,0);
 const s=sql();assert(s.includes('FROM aclexplode(attribute.attacl) a WHERE a.grantee=0'),'column ACL check must preserve NULL');assert(!s.includes("coalesce(attribute.attacl,'{}'::aclitem[])"));
});
test('observed sequence 42809 requires a CASE type guard rather than WHERE predicate ordering',()=>{
 // Root's actual read-only catalog probe; this test performs no PostgreSQL call.
 const observed=JSON.parse(readFileSync(new URL('../../docs/testing/evidence/study-workflow-simplification-2026-11-17/wf08/root/object-type-readonly-diagnostic-v1.json',import.meta.url),'utf8'));
 assert.equal(observed.readOnly,true);assert.equal(observed.persistentWrites,0);
 const original=observed.results.find(r=>r.label==='sequence-original'),guarded=observed.results.find(r=>r.label==='sequence-case');
 assert.equal(original.passed,false);assert.equal(original.sqlState,'42809');assert.equal(guarded.passed,true);assert.equal(guarded.result,false);
 const s=sql();assert(s.includes("CASE WHEN c.relkind='S' THEN has_sequence_privilege(reader,c.oid,'USAGE,SELECT,UPDATE') ELSE FALSE END"),'sequence privilege call must be inside CASE');
 assert(!s.includes("c.relkind='S' AND has_sequence_privilege"));
});
test('observed boolean-path 42883 is prevented by parenthesizing both JSONB containment operands',()=>{
 const observed=JSON.parse(readFileSync(new URL('../../docs/testing/evidence/study-workflow-simplification-2026-11-17/wf08/root/jsonb-precedence-readonly-diagnostic-v1.json',import.meta.url),'utf8'));
 assert.equal(observed.readOnly,true);assert.equal(observed.persistentWrites,0);
 assert.equal(observed.results.find(r=>r.label==='containment-original').sqlState,'42883');
 const fixed=observed.results.find(r=>r.label==='containment-parenthesized');assert.equal(fixed.passed,true);assert.equal(fixed.rows[0].result,true);
 const s=sql();assert(s.includes("NOT((OLD.checkpoint->'finishedClaimIds')<@(NEW.checkpoint->'finishedClaimIds'))"),'finished containment must keep two explicit JSONB operands');
});
test('observed body-minus 22P02 is prevented by parenthesizing the JSON path without dropping strict keys',()=>{
 const observed=JSON.parse(readFileSync(new URL('../../docs/testing/evidence/study-workflow-simplification-2026-11-17/wf08/root/jsonb-precedence-readonly-diagnostic-v1.json',import.meta.url),'utf8'));
 assert.equal(observed.readOnly,true);assert.equal(observed.persistentWrites,0);
 assert.equal(observed.results.find(r=>r.label==='body-minus-original').sqlState,'22P02');
 const fixed=observed.results.find(r=>r.label==='body-minus-parenthesized');assert.equal(fixed.passed,true);assert.deepEqual(fixed.rows[0].result,{});
 const s=sql();assert(s.includes("(pending->'body')-ARRAY['limit','requestKey','expectedStateHash']<>'{}'::jsonb"),'strict body subtraction must have an explicit JSONB operand');
});
