import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { stageBatch } from './staging-repository.mjs';
import { reviewSource, listReviewBatches, listReviewHistory, listBatchSources, listReviewRows } from './review-service.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const tenantId = ids.tenant, hubKey = 'lingshu-xinyu';
const marker = randomUUID();
const preview = { filePath: 'synthetic-review.xlsx', fileSha256: 'c'.repeat(64),
  sheetName: '主表', sourceKey: `review-test-${marker}`, mapperVersion: 'v1', rows: [
    { rowNumber: 2, sourceName: 'Open Source', title: '可审书目', doi: '10.1234/review', url: 'https://example.org/p', raw: { 'Title-题名': '可审书目', 'Summary-摘要': '合成摘要' }, rowSha256: '1'.repeat(64), errors: [] },
    { rowNumber: 3, sourceName: 'Open Source', title: '', doi: '', url: '', raw: { 'Title-题名': null }, rowSha256: '2'.repeat(64), errors: ['TITLE_MISSING'] },
    { rowNumber: 4, sourceName: 'Other Source', title: '异源', doi: '', url: '', raw: { 'Title-题名': '异源' }, rowSha256: '3'.repeat(64), errors: [] },
  ] };
const source = { createdBy: ids.admin, snapshotPath: `/synthetic/${marker}.xlsx`, snapshotSha256: preview.fileSha256 };
const principal = accountId => ({ accountId, tenantId, authVersion: 0 });

test('requires explicit current grant, evidence, exact source count and CAS; revoke appends history', async () => {
  await assertFixtureTarget(env);
  const sentinel = new Error('ROLLBACK_REVIEW_TEST');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const batch = await stageBatch({ db, tenantId, hubKey, preview, source });
    const batches = await listReviewBatches({ db, principal: principal(ids.admin), tenantId, hubKey });
    assert.ok(batches.some(item => item.id === batch.batchId));
    const sourceSummaries = await listBatchSources({ db, principal: principal(ids.admin), tenantId, hubKey, batchId: batch.batchId });
    assert.equal(sourceSummaries.length, 2);
    assert.equal(sourceSummaries.find(item => item.sourceName === 'Open Source').eligibleBibliographic, 1);
    const reviewRows = await listReviewRows({ db, principal: principal(ids.admin), tenantId, hubKey,
      batchId: batch.batchId, sourceRegistryId: sourceSummaries.find(item => item.sourceName === 'Open Source').sourceRegistryId });
    assert.equal(reviewRows.items.length, 2);
    assert.equal(reviewRows.items.find(item => item.errors.length > 0).title, null);
    const sources = await db.$queryRaw`SELECT id, source_name AS name FROM rh_source.source_registry WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey} AND source_name IN ('Open Source','Other Source')`;
    const sourceId = sources.find(item => item.name === 'Open Source').id;
    const input = { batchId: batch.batchId, sourceRegistryId: sourceId,
      fieldKind: 'bibliographic', purpose: 'display', decision: 'approve',
      evidenceRef: 'https://example.org/synthetic-license', confirmedCount: 1,
      excludedCount: 1, homogeneousRightsConfirmed: true, expectedVersion: 0,
      audience: 'public', expiresAt: '2099-01-01T00:00:00.000Z' };
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.owner), tenantId, hubKey, input }), /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey,
      input: { ...input, evidenceRef: '' } }), /HUB_SOURCE_EVIDENCE_REQUIRED/);
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey,
      input: { ...input, confirmedCount: 2 } }), /HUB_SOURCE_COUNT_MISMATCH/);
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey,
      input: { ...input, sourceRegistryId: null } }), /HUB_SOURCE_SCOPE_REJECTED/);
    const approved = await reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey, input });
    assert.equal(approved.confirmedCount, 1);
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey, input }), /HUB_SOURCE_VERSION_CONFLICT/);
    const revoked = await reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey,
      input: { ...input, decision: 'revoke', expectedVersion: approved.version } });
    assert.notEqual(revoked.version, approved.version);
    const history = await listReviewHistory({ db, principal: principal(ids.admin), tenantId, hubKey, sourceRegistryId: sourceId });
    assert.deepEqual(history.slice(-2).map(item => item.decision), ['approve', 'revoke']);
    assert.equal(history.at(-2).audience, 'public');
    assert.equal(history.at(-2).expiresAt, '2099-01-01T00:00:00.000Z');
    await db.$executeRaw`
      INSERT INTO rh_source.review_decision
        (tenant_id,hub_key,source_registry_id,batch_id,field_kind,purpose,decision,
         audience,evidence_ref,reviewer_id,confirmed_count)
      SELECT ${tenantId},${hubKey},${sourceId},${batch.batchId},'bibliographic','display',
             'approve','public','https://example.org/synthetic-license',${ids.admin},1
      FROM generate_series(1, 201)`;
    const capped = await listReviewHistory({ db, principal: principal(ids.admin), tenantId, hubKey, sourceRegistryId: sourceId });
    const newest = await db.$queryRaw`SELECT max(decision_version)::text AS version FROM rh_source.review_decision
      WHERE tenant_id = ${tenantId} AND source_registry_id = ${sourceId}`;
    assert.equal(capped.length, 200);
    assert.equal(capped.at(-1).version, newest[0].version);
    assert.ok(BigInt(capped[0].version) > BigInt(history[0].version));
    throw sentinel;
  }), error => error === sentinel);
});

test('never batch-approves an error row, another Hub or a row from another source', async () => {
  await assertFixtureTarget(env);
  const sentinel = new Error('ROLLBACK_REVIEW_SCOPE');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const batch = await stageBatch({ db, tenantId, hubKey, preview, source });
    const rows = await db.$queryRaw`SELECT id, source_registry_id AS "sourceId", row_number AS "rowNumber" FROM rh_source.source_record WHERE batch_id = ${batch.batchId} ORDER BY row_number`;
    const input = { batchId: batch.batchId, sourceRegistryId: rows[0].sourceId,
      sourceRecordId: rows[1].id, fieldKind: 'bibliographic', purpose: 'display',
      decision: 'approve', evidenceRef: 'https://example.org/synthetic-license',
      confirmedCount: 1, excludedCount: 0, expectedVersion: 0 };
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey, input }), /HUB_SOURCE_RECORD_INVALID/);
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey,
      input: { ...input, sourceRecordId: rows[2].id } }), /HUB_SOURCE_SCOPE_REJECTED/);
    await assert.rejects(() => reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey: 'other-hub', input }), /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    throw sentinel;
  }), error => error === sentinel);
});

test('a grant revocation cannot commit between review authorization and its decision commit', async () => {
  await assertFixtureTarget(env);
  const rollbackReview = new Error('ROLLBACK_LOCK_REVIEW');
  const rollbackRevoke = new Error('ROLLBACK_LOCK_REVOKE');
  let revokerStarted;
  const started = new Promise(resolve => { revokerStarted = resolve; });
  let revokerSettled = false;
  let revoker;
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const batch = await stageBatch({ db, tenantId, hubKey, preview, source });
    const [record] = await db.$queryRaw`SELECT id, source_registry_id AS "sourceId"
      FROM rh_source.source_record WHERE batch_id = ${batch.batchId} AND row_number = 2`;
    await reviewSource({ db, principal: principal(ids.admin), tenantId, hubKey, input: {
      batchId: batch.batchId, sourceRegistryId: record.sourceId, sourceRecordId: record.id,
      fieldKind: 'bibliographic', purpose: 'display', decision: 'approve',
      evidenceRef: 'https://example.org/synthetic-license', confirmedCount: 1,
      excludedCount: 0, expectedVersion: 0, audience: 'public' } });
    revoker = withFixtureTransaction(env, 'direct', async other => {
      await other.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      revokerStarted();
      await other.$executeRaw`INSERT INTO rh_source.review_grant_event
        (tenant_id,hub_key,account_id,capability,decision,approval_ref,actor_ref)
        VALUES (${tenantId},${hubKey},${ids.admin},'source.review','revoke',
                ${`synthetic-lock-${marker}`},'synthetic-test')`;
      throw rollbackRevoke;
    }).catch(error => { revokerSettled = true; if (error !== rollbackRevoke) throw error; });
    await started;
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(revokerSettled, false);
    throw rollbackReview;
  }), error => error === rollbackReview);
  await revoker;
});
