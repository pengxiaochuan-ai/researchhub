import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { stageBatch } from './staging-repository.mjs';
import { reviewSource } from './review-service.mjs';
import { listVisible, getVisible, retrieveForAi, visibleCounts, overviewVisible } from './visible-repository.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const tenantId = ids.tenant, hubKey = 'lingshu-xinyu';
const marker = randomUUID();
const preview = { filePath: 'synthetic-visible.xlsx', fileSha256: 'd'.repeat(64),
  sheetName: '主表', sourceKey: `visible-test-${marker}`, mapperVersion: 'v1', rows: [
    { rowNumber: 2, sourceName: 'Open Fixture', title: '针灸研究甲', doi: '10.1234/shared', url: 'https://example.org/a', raw: { 'Title-题名': '针灸研究甲', 'Summary-摘要': '可审核摘要甲' }, rowSha256: '1'.repeat(64), errors: [] },
    { rowNumber: 3, sourceName: 'Other Fixture', title: '针灸研究乙', doi: '10.1234/shared', url: 'https://example.org/b', raw: { 'Title-题名': '针灸研究乙', 'Summary-摘要': '独立摘要乙' }, rowSha256: '2'.repeat(64), errors: [] },
    { rowNumber: 4, sourceName: 'Open Fixture', title: '', doi: '', url: '', raw: { 'Title-题名': null, 'Summary-摘要': '错误行不得可见' }, rowSha256: '3'.repeat(64), errors: ['TITLE_MISSING'] },
  ] };
const source = { createdBy: ids.admin, snapshotPath: `/synthetic/${marker}.xlsx`, snapshotSha256: preview.fileSha256 };
const admin = { accountId: ids.admin, tenantId, authVersion: 0 };
const owner = { accountId: ids.owner, tenantId, authVersion: 0 };
const scope = { tenantId, hubKey };

test('shared projection keeps abstract and AI uses separate, supports revoke and distinct same-DOI sources', async () => {
  await assertFixtureTarget(env);
  const sentinel = new Error('ROLLBACK_VISIBLE_TEST');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const batch = await stageBatch({ db, ...scope, preview, source });
    const rows = await db.$queryRaw`SELECT id, source_registry_id AS "sourceId", row_number AS "rowNumber" FROM rh_source.source_record WHERE batch_id = ${batch.batchId} ORDER BY row_number`;
    const review = async ({ row = rows[0], fieldKind = 'bibliographic', purpose = 'display',
      decision = 'approve', expectedVersion = 0, expiresAt = null } = {}) => reviewSource({ db,
      principal: admin, ...scope, input: { batchId: batch.batchId, sourceRegistryId: row.sourceId,
        sourceRecordId: row.id, fieldKind, purpose, decision,
        evidenceRef: 'https://example.org/fixture-license', confirmedCount: 1,
        excludedCount: 0, expectedVersion, audience: 'public', expiresAt } });
    const first = await review();
    let list = await listVisible({ db, ...scope, principal: null, filters: { q: '针灸' }, limit: 1 });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].title, '针灸研究甲');
    const approvedRecordId = list.items[0].id;
    assert.equal(list.items[0].abstract, null);
    assert.equal((await retrieveForAi({ db, ...scope, principal: owner, query: '针灸', limit: 10 })).length, 0);
    await review({ fieldKind: 'abstract', purpose: 'display' });
    assert.equal((await getVisible({ db, ...scope, principal: null, recordId: list.items[0].id })).abstract, '可审核摘要甲');
    await review({ purpose: 'ai_retrieval' });
    assert.equal((await retrieveForAi({ db, ...scope, principal: owner, query: '针灸', limit: 10 })).length, 1);
    assert.equal((await retrieveForAi({ db, ...scope, principal: owner, query: '可审核摘要甲', limit: 10 })).length, 0);
    await review({ fieldKind: 'abstract', purpose: 'ai_retrieval' });
    const ai = await retrieveForAi({ db, ...scope, principal: owner, query: '针灸', limit: 10 });
    assert.equal(ai[0].snippet, '可审核摘要甲');
    assert.equal(ai[0].rowSha256, '1'.repeat(64));
    assert.equal(ai[0].sourceRecordId, rows[0].id);
    await review({ row: rows[1] });
    list = await listVisible({ db, ...scope, principal: null, filters: {}, limit: 1 });
    assert.equal(list.items.length, 1);
    assert.ok(list.nextCursor);
    const next = await listVisible({ db, ...scope, principal: null, filters: {}, cursor: list.nextCursor, limit: 1 });
    assert.equal(next.items.length, 1);
    assert.notEqual(next.items[0].id, list.items[0].id);
    assert.equal(next.items[0].doi, list.items[0].doi);
    const counts = await visibleCounts({ db, ...scope });
    assert.equal(counts.stagedRows >= 3, true);
    assert.equal(counts.approvedDisplayRecords >= 2, true);
    const candidateOverview = await overviewVisible({ db, ...scope });
    assert.equal(candidateOverview.recordCount, 2);
    assert.equal(candidateOverview.items.length, 2);
    assert.equal(candidateOverview.items[0].doi, candidateOverview.items[1].doi);
    const revoked = await review({ decision: 'revoke', expectedVersion: first.version });
    assert.equal(revoked.decision, 'revoke');
    assert.equal(await getVisible({ db, ...scope, principal: null, recordId: approvedRecordId }), null);
    const afterWithdrawal = await overviewVisible({ db, ...scope });
    assert.equal(afterWithdrawal.recordCount, 1);
    assert.equal(afterWithdrawal.items.length, 1);
    assert.equal((await retrieveForAi({ db, ...scope, principal: owner, query: '针灸研究甲', limit: 10 })).length, 0);
    throw sentinel;
  }), error => error === sentinel);
});

test('wrong tenant or Hub, unreviewed errors and expired decisions never expose content', async () => {
  await assertFixtureTarget(env);
  const sentinel = new Error('ROLLBACK_VISIBLE_SCOPE');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const batch = await stageBatch({ db, ...scope, preview, source });
    const rows = await db.$queryRaw`SELECT id, source_registry_id AS "sourceId" FROM rh_source.source_record WHERE batch_id = ${batch.batchId} ORDER BY row_number`;
    assert.equal((await listVisible({ db, ...scope, principal: null, filters: {}, limit: 10 })).items.length, 0);
    assert.equal(await getVisible({ db, ...scope, principal: null, recordId: rows[2].id }), null);
    await assert.rejects(() => retrieveForAi({ db, tenantId, hubKey: 'other-hub', principal: owner, query: '针灸', limit: 10 }), /HUB_SOURCE_SCOPE_REJECTED/);
    await assert.rejects(() => retrieveForAi({ db, ...scope, principal: { ...owner, tenantId: 'other-tenant' }, query: '针灸', limit: 10 }), /HUB_SOURCE_SCOPE_REJECTED/);
    await assert.rejects(() => retrieveForAi({ db, ...scope, principal: { ...owner, accountId: ids.uninvited }, query: '针灸', limit: 10 }), /HUB_SOURCE_SCOPE_REJECTED/);
    await db.$executeRaw`
      INSERT INTO rh_source.review_decision
        (tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,decision,audience,expires_at,evidence_ref,reviewer_id,confirmed_count)
      VALUES (${tenantId},${hubKey},${rows[0].sourceId},${rows[0].id},'bibliographic','display','approve','public',now()-interval '1 day','https://example.org/expired',${ids.admin},1)`;
    assert.equal((await listVisible({ db, ...scope, principal: null, filters: {}, limit: 10 })).items.length, 0);
    throw sentinel;
  }), error => error === sentinel);
});

test('one row can be withdrawn after source-batch approval without hiding its sibling', async () => {
  await assertFixtureTarget(env);
  const sentinel = new Error('ROLLBACK_ROW_WITHDRAWAL');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const twoRows = { ...preview, sourceKey: `row-withdraw-${marker}`, rows: [
      preview.rows[0],
      { ...preview.rows[2], title: '针灸研究丙', raw: { 'Title-题名': '针灸研究丙' }, errors: [] },
    ] };
    const batch = await stageBatch({ db, ...scope, preview: twoRows, source });
    const rows = await db.$queryRaw`SELECT id, source_registry_id AS "sourceId" FROM rh_source.source_record
      WHERE batch_id = ${batch.batchId} ORDER BY row_number`;
    const common = { batchId: batch.batchId, sourceRegistryId: rows[0].sourceId,
      fieldKind: 'bibliographic', purpose: 'display', audience: 'public',
      evidenceRef: 'https://example.org/fixture-license', confirmedCount: 2,
      excludedCount: 0, expectedVersion: 0, homogeneousRightsConfirmed: true };
    await reviewSource({ db, principal: admin, ...scope, input: { ...common, decision: 'approve' } });
    assert.equal((await listVisible({ db, ...scope })).items.filter(item => rows.some(row => row.id === item.id)).length, 2);
    await reviewSource({ db, principal: admin, ...scope, input: { ...common,
      sourceRecordId: rows[0].id, decision: 'revoke', confirmedCount: 1,
      homogeneousRightsConfirmed: false } });
    assert.equal(await getVisible({ db, ...scope, recordId: rows[0].id }), null);
    assert.equal((await getVisible({ db, ...scope, recordId: rows[1].id })).title, '针灸研究丙');
    throw sentinel;
  }), error => error === sentinel);
});
