import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { stageBatch } from './staging-repository.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu' };
const marker = randomUUID();
const source = { createdBy: ids.admin, snapshotPath: `/synthetic/${marker}.xlsx`,
  snapshotSha256: 'a'.repeat(64) };
const preview = version => ({ fileSha256: source.snapshotSha256,
  filePath: 'synthetic.xlsx', sheetName: '主表', sourceKey: `test-${marker}`,
  mapperVersion: version, rows: [
    { rowNumber: 2, sourceName: 'Source A', title: '第一篇', doi: '10.1234/a', url: 'https://example.org/a',
      raw: { 'Title-题名': '第一篇', 'Author-作者': '甲', 'Source-文献来源': '测试期刊', 'Summary-摘要': '长摘要', 'Year-年': 2025 },
      rowSha256: '1'.repeat(64), errors: [] },
    { rowNumber: 3, sourceName: 'Source B', title: '', doi: '', url: '',
      raw: { 'Title-题名': null, 'Summary-摘要': '缺题名' }, rowSha256: '2'.repeat(64), errors: ['TITLE_MISSING'] },
  ] });

test('stages every raw row once, retains bad rows and isolates mapper versions', async () => {
  await assertFixtureTarget(env);
  const sentinel = new Error('ROLLBACK_TEST');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const first = await stageBatch({ db: tx, ...scope, preview: preview('test-v1'), source });
    assert.equal(first.inserted, 2);
    assert.equal(first.errors, 1);
    const second = await stageBatch({ db: tx, ...scope, preview: preview('test-v1'), source });
    assert.equal(second.existing, true);
    assert.equal(second.batchId, first.batchId);
    const newer = await stageBatch({ db: tx, ...scope, preview: preview('test-v2'), source });
    assert.notEqual(newer.batchId, first.batchId);
    const rows = await tx.$queryRaw`
      SELECT title, display_allowed, ai_allowed, validation_errors
      FROM rh_source.source_record WHERE batch_id = ${first.batchId} ORDER BY row_number`;
    assert.equal(rows.length, 2);
    assert.equal(rows[1].title, null);
    assert.deepEqual(rows[1].validation_errors, ['TITLE_MISSING']);
    assert.ok(rows.every(row => !row.display_allowed && !row.ai_allowed));
    throw sentinel;
  }), error => error === sentinel);
});

test('rejects a wrong Hub and a mismatched snapshot hash', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await stageBatch({ db: tx, tenantId: ids.tenant, hubKey: 'other-hub', preview: preview('test-v1'), source });
  }), /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await stageBatch({ db: tx, ...scope, preview: preview('test-v1'),
      source: { ...source, snapshotSha256: 'b'.repeat(64) } });
  }), /HUB_SOURCE_SNAPSHOT_MISMATCH/);
});

test('a failed row insert rolls back its batch and leaves old task counts unchanged', async () => {
  await assertFixtureTarget(env);
  const before = await withFixtureTransaction(env, 'direct', async tx => ({
    chat: await tx.knowledgeChatJob.count(), imports: await tx.knowledgeImportTask.count(),
  }), { readOnly: true });
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const bad = preview('broken'); bad.rows[0].rowNumber = 1;
    await stageBatch({ db: tx, ...scope, preview: bad, source });
  }));
  const after = await withFixtureTransaction(env, 'direct', async tx => ({
    chat: await tx.knowledgeChatJob.count(), imports: await tx.knowledgeImportTask.count(),
    batches: await tx.$queryRaw`SELECT COUNT(*)::int AS count FROM rh_source.import_batch WHERE scope_key = ${`test-${marker}`}`,
  }), { readOnly: true });
  assert.deepEqual({ chat: after.chat, imports: after.imports }, before);
  assert.equal(after.batches[0].count, 0);
});
