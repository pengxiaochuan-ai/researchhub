// Approved synthetic-only probe. No AppModule, lifecycle polling or real store.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

const root = new URL('../../', import.meta.url).pathname;
const directory = new URL('../docs/planning/qiyan-ai-data-agent-complete-2026-11-17/', import.meta.url).pathname;
const { env } = loadFixtureInput(root + '.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids, key } = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
assert.equal(key, 'rh-kb-local-b0e2af9d');
assert.equal((await assertFixtureTarget(env)).databaseName, 'wp01_test_full_baseline');
const require = createRequire(root + 'app/server/package.json');
require('ts-node').register({ project: root + 'app/server/tsconfig.json', transpileOnly: true });
const load = (path, name) => require(root + 'app/server/src/' + path + '.ts')[name];
const scope = { deploymentId: 'hub-raw-exact-20261117', product: 'researchhub', allowedTenantIds: [ids.tenant], enabledWorkerKinds: ['raw-processing'], controlPlaneEnabled: false, officialJobKinds: [] };
const studyId = 'rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090';
const prefix = 'rh-raw-exact-20261117-';
const subjectId = prefix + 'subject', taskA = prefix + 'task-A', taskB = prefix + 'task-B', fileA = prefix + 'file-A', fileB = prefix + 'file-B';
const report = { syntheticOnly: true, database: 'wp01_test_full_baseline', studyId, modelCalls: 0, realStorageCalls: 0, roleChanges: 0, startupOrPollingCalls: 0, checks: [], phase: 'preflight' };
report.startedAt = new Date().toISOString();
report.sources = Object.fromEntries(['app/server/src/ingest/raw-processing.service.ts', 'app/server/src/common/worker-authorization.ts'].map(path => [path, createHash('sha256').update(readFileSync(root + path)).digest('hex')]));
const save = () => writeFileSync(directory + 'exact-rollback-result.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const preflight = await withFixtureTransaction(env, 'app', async tx => {
  await tx.$queryRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.account_id',$3,true)", ids.tenant, ids.group, ids.admin);
  const [binding] = await tx.$queryRawUnsafe('SELECT study_group_id,execution_project_id FROM rh_research.study_binding WHERE tenant_id=$1 AND id=$2', ids.tenant, studyId);
  assert(binding && binding.study_group_id === ids.group);
  const actor = await tx.account.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, role: true, isTenantAdmin: true, authVersion: true, status: true } });
  assert(actor?.status === 'active' && actor.tenantId === ids.tenant && actor.role === 'tenant_admin' && actor.isTenantAdmin);
  await load('ingest/ingest-authorization', 'authorizeIngestInTransaction')(tx, { ...actor, accountId: actor.id }, binding.study_group_id, binding.execution_project_id);
  return { group: binding.study_group_id, project: binding.execution_project_id, authVersion: actor.authVersion };
}, { readOnly: true });
report.preflight = preflight;
if (process.argv.slice(2).length !== 1 || process.argv[2] !== '--run-approved-rollback') {
  assert(process.argv.length === 2 || process.argv[2] === '--preflight');
  console.log(JSON.stringify({ ...report, writeOperations: 0 }));
} else {
  const rollback = Error('APPROVED_SYNTHETIC_ROLLBACK_ONLY');
  let rolledBack = false, executionError;
  const logsDirectory = root + 'researchhub/.tmp/data-agent-exact-20261117/logs';
  mkdirSync(logsDirectory, { recursive: true, mode: 0o700 });
  const logs = new (load('common/execution-log.service', 'ExecutionLogService'))({ directory: logsDirectory, timezone: 'Asia/Shanghai' });
  const bytes = Buffer.from('subject_id,value\nSYNTH-A,0\n');
  const malformedWorkbook = Buffer.from('synthetic malformed workbook, not a ZIP container');
  let downloads = 0, mode = 'normal';
  const failure = Error('SYNTHETIC_DOWNLOAD_FAILURE');
  report.phase = 'running';
  try {
    await withFixtureTransaction(env, 'app', async tx => {
      // Do not queue behind another task's tenant window.
      const [lock] = await tx.$queryRawUnsafe('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired', 'wp01:tenant:' + ids.tenant);
      assert.equal(lock?.acquired, true, 'SYNTHETIC_TENANT_WINDOW_BUSY');
      const setScope = (tenant = ids.tenant, group = preflight.group, project = preflight.project) => tx.$queryRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)", tenant, group, project, ids.admin);
      await setScope();
      const oldTasks = async () => (await tx.$queryRawUnsafe('SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(row_to_json(t)::text),\',\' ORDER BY t.id),\'\')) AS hash FROM public.processing_task t WHERE t."tenantId"=$1 AND t.id<>ALL($2::text[])', ids.tenant, [taskA, taskB]))[0];
      const before = await oldTasks();
      assert.equal(await tx.subject.count({ where: { id: subjectId } }), 0);
      await tx.subject.create({ data: { id: subjectId, tenantId: ids.tenant, studyGroupId: preflight.group, researchProjectId: preflight.project, subjectId: 'HUB-RAW-20261117-A', createdBy: ids.admin, acceptanceFixture: false } });
      for (const [fileId, name, modality] of [[fileA, 'synthetic.csv', 'dataset'], [fileB, 'sentinel.wav', 'audio']]) await tx.modalityFile.create({ data: { id: fileId, tenantId: ids.tenant, subjectId, kind: 'raw', modality, filename: name, storageKey: prefix + fileId, createdBy: ids.admin, meta: { syntheticOnly: true, sha256: createHash('sha256').update(bytes).digest('hex') } } });
      for (const [id, fileId, skillKey] of [[taskA, fileA, 'raw-tabular-orchestration'], [taskB, fileB, 'raw-file-triage']]) await tx.processingTask.create({ data: { id, tenantId: ids.tenant, studyGroupId: preflight.group, researchProjectId: preflight.project, subjectId, modalityFileId: fileId, skillKey, status: 'queued', createdBy: ids.admin, idempotencyKey: id } });
      const bState = async () => ({ task: await tx.processingTask.findUnique({ where: { id: taskB } }), file: await tx.modalityFile.findUnique({ where: { id: fileB } }), features: await tx.feature.findMany({ where: { tenantId: ids.tenant, OR: [{ sourceProcessingTaskId: taskB }, { sourceModalityFileId: fileB }] }, orderBy: { id: 'asc' } }), statuses: await tx.processingStatus.findMany({ where: { subjectId, modality: 'audio' }, orderBy: { id: 'asc' } }), audits: await tx.auditLog.findMany({ where: { tenantId: ids.tenant, target: { in: [taskB, fileB] } }, orderBy: { id: 'asc' } }) });
      const bBefore = await bState();
      // All native publication, failure and heartbeat callbacks use this tx.
      const transaction = async fn => fn(tx);
      const prisma = { elevated: { $transaction: transaction }, forTenant: () => tx, withTenantTransaction: async (_t, _g, _p, fn) => fn(tx) };
      const worker = new (load('ingest/raw-processing.service', 'RawProcessingService'))(prisma, { downloadToFile: async (key, path) => {
        assert.equal(key, prefix + fileA); downloads++;
        if (mode === 'download_failure') throw failure;
        await writeFile(path, mode === 'parse_failure' ? malformedWorkbook : bytes);
        if (mode === 'lose_claim') await tx.processingTask.update({ where: { id: taskA }, data: { executionToken: 'synthetic-new-generation' } });
      } }, logs, scope);
      async function check(name, fn) { await fn(); report.checks.push({ name, passed: true }); }
      let caseNumber = 0;
      async function isolatedCase(name, fn) {
        const point = 'raw_case_' + (++caseNumber);
        await tx.$executeRawUnsafe('SAVEPOINT ' + point);
        try { await check(name, fn); } finally { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + point); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + point); mode = 'normal'; }
      }
      try {
        const { claim } = require(root + 'app/server/src/common/worker-claim.ts');
        await check('app_rls_rejects_foreign_tenant', async () => { await setScope('foreign-synthetic-tenant'); assert.equal(await tx.processingTask.count({ where: { id: taskA } }), 0); await setScope(); });
        await check('app_rls_rejects_wrong_group_or_project', async () => { for (const [group, project] of [['foreign-synthetic-group', preflight.project], [preflight.group, 'foreign-synthetic-project']]) { await setScope(ids.tenant, group, project); assert.equal(await tx.processingTask.count({ where: { id: taskA } }), 0); } await setScope(); });
        await check('queued_task_is_not_a_live_claim', async () => { await assert.rejects(worker.executeClaimed({ kind: 'raw-processing', taskId: taskA, tenantId: ids.tenant, executionToken: 'not-claimed', workerOwner: 'hub-exact' }), /WORKER_CLAIM_LOST/); assert.equal(downloads, 0); });
        const ref = await claim(tx, scope, 'raw-processing', taskA, 'hub-exact'); assert(ref && ref.taskId === taskA);
        await check('wrong_token_and_owner_rejected_before_download', async () => { for (const changed of [{ executionToken: 'other' }, { workerOwner: 'other' }]) await assert.rejects(worker.executeClaimed({ ...ref, ...changed }), /WORKER_CLAIM_LOST/); assert.equal(downloads, 0); });
        await isolatedCase('expired_db_lease_rejected', async () => { await tx.$executeRawUnsafe('UPDATE public.processing_task SET "leaseExpiresAt"=clock_timestamp()-interval \'1 second\' WHERE id=$1', taskA); await assert.rejects(worker.executeClaimed(ref), /WORKER_CLAIM_LOST/); assert.equal(downloads, 0); });
        await isolatedCase('deleted_new_source_rejected_before_download', async () => { await tx.modalityFile.update({ where: { id: fileA }, data: { deletedAt: new Date() } }); await assert.rejects(worker.executeClaimed(ref), e => e.getResponse?.()?.code === 'WORKER_AUTHORIZATION_REVOKED'); assert.equal(downloads, 0); });
        await isolatedCase('invalid_new_task_actor_rejected_without_editing_accounts', async () => { await tx.processingTask.update({ where: { id: taskA }, data: { createdBy: prefix + 'nonexistent-actor' } }); await assert.rejects(worker.executeClaimed(ref), e => e.getResponse?.()?.code === 'WORKER_AUTHORIZATION_REVOKED'); assert.equal(downloads, 0); });
        await isolatedCase('terminal_task_rejected', async () => { await tx.processingTask.update({ where: { id: taskA }, data: { status: 'complete' } }); await assert.rejects(worker.executeClaimed(ref), /WORKER_CLAIM_LOST/); });
        await isolatedCase('real_download_failure_is_published_and_propagated', async () => { mode = 'download_failure'; await assert.rejects(worker.executeClaimed(ref), e => e === failure); assert.equal((await tx.processingTask.findUnique({ where: { id: taskA } })).status, 'failed'); assert.equal((await tx.modalityFile.findUnique({ where: { id: fileA } })).status, 'failed'); });
        await isolatedCase('actual_xlsx_parser_rejects_malformed_workbook_and_propagates', async () => {
          mode = 'parse_failure';
          await tx.modalityFile.update({ where: { id: fileA }, data: { filename: 'malformed.xlsx', meta: { syntheticOnly: true, sha256: createHash('sha256').update(malformedWorkbook).digest('hex') } } });
          const count = downloads;
          await assert.rejects(worker.executeClaimed(ref), e => {
            report.parserFailure = { name: e.name, code: e.code ?? null, message: String(e.message).split('\n')[0].slice(0, 180) };
            // Prove the real archive reader ran and rejected this workbook,
            // rather than accepting a missing executable or unrelated failure.
            return e.code !== 'ENOENT' && /unzip|XLSX|zip|central.directory/i.test(e.message);
          });
          assert.equal(downloads, count + 1);
          assert.equal((await tx.processingTask.findUnique({ where: { id: taskA } })).status, 'failed');
          assert.equal(await tx.feature.count({ where: { subjectId } }), 0);
        });
        await isolatedCase('claim_generation_lost_in_flight_does_not_publish_result', async () => { mode = 'lose_claim'; await assert.rejects(worker.executeClaimed(ref), /WORKER_CLAIM_LOST/); assert.equal(await tx.feature.count({ where: { subjectId } }), 0); assert.equal((await tx.processingTask.findUnique({ where: { id: taskA } })).result, null); });
        await check('A_actual_csv_processing_preserves_needs_review', async () => { await worker.executeClaimed(ref); const row = await tx.processingTask.findUnique({ where: { id: taskA } }); assert.equal(row.status, 'needs_review'); assert(row.result); assert.equal(await tx.feature.count({ where: { subjectId } }), 0); report.actualResult = { status: row.status, progress: row.progress, result: row.result }; });
        await check('B_full_row_and_related_results_unchanged', async () => { assert.deepEqual(await bState(), bBefore); });
        await check('all_preexisting_scoped_tasks_unchanged', async () => { assert.deepEqual(await oldTasks(), before); report.preexistingTasks = before; });
        report.downloads = downloads;
      } finally { worker.onModuleDestroy(); await logs.flush(); }
      throw rollback;
    });
  } catch (error) { if (error === rollback) rolledBack = true; else executionError = error; }
  await withFixtureTransaction(env, 'direct', async tx => {
    assert.equal(await tx.subject.count({ where: { id: subjectId } }), 0);
    assert.equal(await tx.modalityFile.count({ where: { id: { in: [fileA, fileB] } } }), 0);
    assert.equal(await tx.processingTask.count({ where: { id: { in: [taskA, taskB] } } }), 0);
    assert.equal(await tx.feature.count({ where: { subjectId } }), 0);
    assert.equal(await tx.processingStatus.count({ where: { subjectId } }), 0);
    assert.equal(await tx.auditLog.count({ where: { tenantId: ids.tenant, target: { in: [subjectId, taskA, taskB, fileA, fileB] } } }), 0);
  }, { readOnly: true });
  report.phase = executionError ? 'failed' : 'passed'; report.rolledBack = rolledBack; report.persistentFixtureRows = 0;
  report.checks.push({ name: 'new_readonly_connection_confirms_full_fixture_rollback', passed: true });
  report.logsDirectory = 'researchhub/.tmp/data-agent-exact-20261117/logs';
  report.completedAt = new Date().toISOString();
  if (executionError) report.error = { code: executionError.code ?? executionError.name, message: String(executionError.message).split('\n')[0].slice(0, 180) };
  save();
  if (executionError) throw executionError;
  assert(rolledBack);
  console.log(JSON.stringify({ phase: report.phase, checks: report.checks.length, rolledBack, persistentFixtureRows: 0 }));
}
