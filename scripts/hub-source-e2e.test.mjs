import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { stageBatch } from '../server/hub-sources/staging-repository.mjs';
import { reviewSource } from '../server/hub-sources/review-service.mjs';
import { listVisible, getVisible } from '../server/hub-sources/visible-repository.mjs';
import { runHubSourceSearch, assertCurrentAiSources, assertHubPublicationSources } from '../server/hub-sources/agent-retrieval.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu' };
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 };
const owner = { accountId: ids.owner, tenantId: ids.tenant, authVersion: 0 };

test('staging → explicit synthetic review → E01/E02 projection → Agent tool → revoke, all rolled back', async () => {
  await assertFixtureTarget(env);
  const before = await withFixtureTransaction(env, 'direct', async db => ({
    rows: (await db.$queryRaw`SELECT count(*)::integer AS count FROM rh_source.source_record WHERE tenant_id = ${ids.tenant}`)[0].count,
    decisions: (await db.$queryRaw`SELECT count(*)::integer AS count FROM rh_source.review_decision WHERE tenant_id = ${ids.tenant}`)[0].count,
  }));
  const marker = randomUUID();
  const preview = { filePath: 'synthetic-e2e.xlsx', fileSha256: 'e'.repeat(64),
    sheetName: '主表', sourceKey: `synthetic-e2e-${marker}`, mapperVersion: 'v1', rows: [{
      rowNumber: 2, sourceName: 'Synthetic Fixture Rights', title: `针灸辅助干预抑郁障碍 合成研究 ${marker}`,
      doi: '10.1234/synthetic', url: 'https://example.org/synthetic',
      raw: { 'Title-题名': `合成研究 ${marker}`, 'Summary-摘要': '合成摘要只供技术验证，不是真实科研证据' },
      rowSha256: 'a'.repeat(64), errors: [],
    }] };
  const sentinel = new Error('ROLLBACK_HUB_SOURCE_E2E');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const batch = await stageBatch({ db, ...scope, preview,
      source: { createdBy: ids.admin, snapshotPath: `/synthetic/${marker}.xlsx`, snapshotSha256: preview.fileSha256 } });
    const [row] = await db.$queryRaw`SELECT id, source_registry_id AS "sourceId" FROM rh_source.source_record WHERE batch_id = ${batch.batchId}`;
    assert.equal((await listVisible({ db, ...scope, principal: null })).items.some(item => item.id === row.id), false);
    const review = (fieldKind, purpose, decision = 'approve', expectedVersion = 0) => reviewSource({
      db, principal: admin, ...scope, input: { batchId: batch.batchId, sourceRegistryId: row.sourceId,
        sourceRecordId: row.id, fieldKind, purpose, decision, audience: 'public',
        evidenceRef: 'https://example.org/synthetic-fixture-rights',
        confirmedCount: 1, excludedCount: 0, expectedVersion },
    });
    const bibliographicDisplay = await review('bibliographic', 'display');
    assert.equal((await getVisible({ db, ...scope, recordId: row.id })).abstract, null);
    await review('abstract', 'display');
    assert.match((await getVisible({ db, ...scope, recordId: row.id })).abstract, /合成摘要/);
    assert.deepEqual((await runHubSourceSearch({ db, ...scope, principal: owner, query: marker })).meta.sources, []);
    const bibliographicAi = await review('bibliographic', 'ai_retrieval');
    const abstractAi = await review('abstract', 'ai_retrieval');
    const tool = await runHubSourceSearch({ db, ...scope, principal: owner, query: marker });
    const natural = await runHubSourceSearch({ db, ...scope, principal: owner,
      query: '针灸辅助干预抑郁障碍的研究背景是什么？' });
    assert.equal(natural.meta.sources[0]?.sourceRecordId, row.id);
    assert.equal(tool.mutated, false);
    assert.equal(tool.meta.sources[0].sourceRecordId, row.id);
    assert.equal(tool.meta.sources[0].rowSha256, 'a'.repeat(64));
    assert.match(tool.meta.sources[0].snippetHash, /^[a-f0-9]{64}$/);
    await assertCurrentAiSources({ db, ...scope, principal: owner, sources: tool.meta.sources });
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${''}, true)`;
    await assertHubPublicationSources({ db, ...scope, principal: owner, sources: tool.meta.sources });
    await assert.rejects(() => assertHubPublicationSources({ db, ...scope,
      principal: { ...owner, tenantId: 'other-tenant' }, sources: tool.meta.sources }), /HUB_SOURCE_SCOPE_REJECTED/);
    await db.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
    try {
      assert.equal((await db.$queryRawUnsafe('SELECT current_user AS role'))[0].role, 'aisci_app');
      const appTool = await runHubSourceSearch({ db, ...scope, principal: owner, query: marker });
      assert.equal(appTool.meta.sources[0].sourceRecordId, row.id);
      await assertCurrentAiSources({ db, ...scope, principal: owner, sources: appTool.meta.sources });
    } finally { await db.$executeRawUnsafe('RESET ROLE'); }
    for (const [field, value] of [['title', '伪造题名'], ['doi', '10.9999/false'],
      ['sourceUrl', 'https://example.org/false'], ['sourceName', '伪造来源'],
      ['fileName', 'false.xlsx'], ['rowNumber', 999], ['batchId', 'rhsb-false']]) {
      await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
        sources: [{ ...tool.meta.sources[0], [field]: value }] }), /HUB_SOURCE_CHANGED/);
    }
    assert.match(tool.result, /合成摘要/);
    const abstractRevoked = await review('abstract', 'ai_retrieval', 'revoke', abstractAi.version);
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: tool.meta.sources }), /HUB_SOURCE_CHANGED/);
    await db.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
    try {
      await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
        sources: tool.meta.sources }), /HUB_SOURCE_CHANGED/);
    } finally { await db.$executeRawUnsafe('RESET ROLE'); }
    await review('abstract', 'ai_retrieval', 'approve', abstractRevoked.version);
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: tool.meta.sources }), /HUB_SOURCE_CHANGED/);
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: [{ ...tool.meta.sources[0], snippetHash: '0'.repeat(64) }] }), /HUB_SOURCE_CHANGED/);
    await db.agentAccess.update({ where: { tenantId_agentId_scopeKey: {
      tenantId: ids.tenant, agentId: ids.tenant + '-kb-research', scopeKey: ids.owner,
    } }, data: { enabled: false } });
    await assert.rejects(() => runHubSourceSearch({ db, ...scope, principal: owner, query: marker }), /HUB_SOURCE_SCOPE_REJECTED/);
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: tool.meta.sources }), /HUB_SOURCE_SCOPE_REJECTED/);
    await db.agentAccess.update({ where: { tenantId_agentId_scopeKey: {
      tenantId: ids.tenant, agentId: ids.tenant + '-kb-research', scopeKey: ids.owner,
    } }, data: { enabled: true } });
    await review('bibliographic', 'ai_retrieval', 'revoke', bibliographicAi.version);
    assert.equal((await runHubSourceSearch({ db, ...scope, principal: owner, query: marker })).meta.sources.length, 0);
    await review('bibliographic', 'display', 'revoke', bibliographicDisplay.version);
    assert.equal(await getVisible({ db, ...scope, recordId: row.id }), null);
    throw sentinel;
  }), error => error === sentinel);
  const after = await withFixtureTransaction(env, 'direct', async db => ({
    rows: (await db.$queryRaw`SELECT count(*)::integer AS count FROM rh_source.source_record WHERE tenant_id = ${ids.tenant}`)[0].count,
    decisions: (await db.$queryRaw`SELECT count(*)::integer AS count FROM rh_source.review_decision WHERE tenant_id = ${ids.tenant}`)[0].count,
  }));
  assert.deepEqual(after, before);
  assert.deepEqual(after, { rows: 15697, decisions: 0 });
});

test('publication shared source lock excludes a concurrent review update until commit', async () => {
  await assertFixtureTarget(env);
  const [{ id }] = await withFixtureTransaction(env, 'direct', db => db.$queryRaw`
    SELECT id FROM rh_source.source_record WHERE tenant_id = ${ids.tenant} LIMIT 1`, { readOnly: true });
  assert.ok(id);
  let held, release;
  const locked = new Promise(resolve => { held = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  const publication = withFixtureTransaction(env, 'direct', async db => {
    const rows = await db.$queryRaw`
      SELECT s.id FROM rh_source.source_registry s
      JOIN rh_source.source_record r ON r.source_registry_id = s.id
      WHERE r.id = ${id} AND r.tenant_id = ${ids.tenant}
        AND r.hub_key = ${scope.hubKey} AND s.tenant_id = ${ids.tenant}
        AND s.hub_key = ${scope.hubKey} FOR SHARE OF s`;
    assert.equal(rows.length, 1);
    held();
    await resume;
  });
  try {
    await locked;
    await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
      await db.$executeRawUnsafe("SET LOCAL lock_timeout = '250ms'");
      await db.$queryRaw`
        SELECT s.id FROM rh_source.source_registry s
        JOIN rh_source.source_record r ON r.source_registry_id = s.id
        WHERE r.id = ${id} AND r.tenant_id = ${ids.tenant}
          AND r.hub_key = ${scope.hubKey} FOR UPDATE OF s`;
    }), error => error?.code === 'P2010' && error?.meta?.code === '55P03');
  } finally { release(); await publication; }
});

test('AI source expires during an open publication transaction', async () => {
  await assertFixtureTarget(env);
  const marker = randomUUID(), sentinel = new Error('ROLLBACK_EXPIRY');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const preview = { filePath: 'synthetic-expiry.xlsx', fileSha256: 'f'.repeat(64),
      sheetName: '主表', sourceKey: `synthetic-expiry-${marker}`, mapperVersion: 'v1', rows: [{
        rowNumber: 2, sourceName: 'Synthetic Expiry Rights', title: `合成有效期研究 ${marker}`,
        doi: null, url: 'https://example.org/synthetic-expiry',
        raw: { 'Title-题名': `合成有效期研究 ${marker}` }, rowSha256: 'b'.repeat(64), errors: [],
      }] };
    const batch = await stageBatch({ db, ...scope, preview,
      source: { createdBy: ids.admin, snapshotPath: `/synthetic/${marker}.xlsx`, snapshotSha256: preview.fileSha256 } });
    const [row] = await db.$queryRaw`SELECT id, source_registry_id AS "sourceId" FROM rh_source.source_record WHERE batch_id = ${batch.batchId}`;
    const approve = (purpose, expiresAt) => reviewSource({ db, principal: admin, ...scope,
      input: { batchId: batch.batchId, sourceRegistryId: row.sourceId, sourceRecordId: row.id,
        fieldKind: 'bibliographic', purpose, decision: 'approve', audience: 'public',
        evidenceRef: 'https://example.org/synthetic-expiry-rights', confirmedCount: 1,
        excludedCount: 0, expectedVersion: 0, ...(expiresAt ? { expiresAt } : {}) } });
    await approve('display');
    const expiry = new Date(Date.now() + 600);
    await approve('ai_retrieval', expiry.toISOString());
    const before = await runHubSourceSearch({ db, ...scope, principal: owner, query: marker });
    assert.equal(before.meta.sources[0]?.sourceRecordId, row.id);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry.getTime() - Date.now() + 80)));
    assert.equal((await runHubSourceSearch({ db, ...scope, principal: owner, query: marker })).meta.sources.length, 0);
    await assert.rejects(() => assertHubPublicationSources({ db, ...scope, principal: owner,
      sources: before.meta.sources }), /HUB_SOURCE_CHANGED/);
    throw sentinel;
  }), error => error === sentinel);
});
