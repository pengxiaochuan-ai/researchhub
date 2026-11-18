import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listPmcReviewItems, getReviewablePmcImage, submitPmcReview, submitPmcArticleReview } from './pmc-review-service.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin };
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 };

test('one PMC article decision is current-version scoped and append-only', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin })).find(row => row.versionId);
    const input = { versionId: item.versionId, rawSha256: item.rawSha256,
      visibility: 'public', expectedVersion: '0', expectedAssetFingerprint: item.assetFingerprint };
    await assert.rejects(() => submitPmcArticleReview({ db, ...scope, principal: admin,
      input: { ...input, expectedAssetFingerprint: '0'.repeat(64) } }), /HUB_SOURCE_VERSION_CONFLICT/);
    await assert.rejects(() => submitPmcArticleReview({ db, ...scope,
      principal: { ...admin, accountId: ids.owner }, input }), /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    await assert.rejects(() => submitPmcArticleReview({ db, ...scope, principal: admin,
      input: { ...input, rawSha256: '0'.repeat(64) } }), /HUB_SOURCE_VERSION_CONFLICT/);
    const legacyInput = { versionId: item.versionId, rawSha256: item.rawSha256,
      fieldKind: 'bibliographic', purpose: 'display', audience: 'public',
      decision: 'approve', evidenceRef: 'https://pmc.ncbi.nlm.nih.gov/about/copyright/',
      expectedVersion: '0', confirmed: true };
    const oldApproval = await submitPmcReview({ db, ...scope, principal: admin, input: legacyInput });
    const approved = await submitPmcArticleReview({ db, ...scope, principal: admin, input });
    assert.equal(approved.visibility, 'public');
    await assert.rejects(() => submitPmcReview({ db, ...scope, principal: admin,
      input: { ...legacyInput, decision: 'revoke', expectedVersion: oldApproval.version } }),
    /HUB_SOURCE_ARTICLE_DECISION_REQUIRED/);
    await assert.rejects(() => submitPmcArticleReview({ db, ...scope, principal: admin, input }),
      /HUB_SOURCE_VERSION_CONFLICT/);
    const withheld = await submitPmcArticleReview({ db, ...scope, principal: admin,
      input: { ...input, visibility: 'withheld', expectedVersion: approved.version } });
    assert.equal(withheld.visibility, 'withheld');
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('PMC candidate review is current-admin-only and defaults to unapproved', async () => {
  await assertFixtureTarget(env);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await assert.rejects(() => listPmcReviewItems({ db, ...scope,
      principal: { ...admin, accountId: ids.owner } }), /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    const items = await listPmcReviewItems({ db, ...scope, principal: admin });
    assert.ok(items.length >= 1 && items.length <= 20);
    assert.ok(items.every(item => /^PMC\d+$/.test(item.pmcid)));
    const withVersion = items.find(item => item.versionId);
    assert.ok(withVersion);
    assert.equal(withVersion.decisions.length, 0);
    assert.ok(withVersion.expectedAssetCount >= withVersion.stagedAssetCount);
  }, { readOnly: true });
});

test('PMC image preview is limited to named current reviewer and current image version', async () => {
  await assertFixtureTarget(env);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin }))
      .find(value => value.pmcid === 'PMC13691533');
    const image = item.assets.find(value => value.assetKind === 'image');
    assert.ok(image);
    await assert.rejects(() => getReviewablePmcImage({ db, ...scope,
      principal: { ...admin, accountId: ids.owner }, assetId: image.id }),
    /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    const asset = await getReviewablePmcImage({ db, ...scope, principal: admin, assetId: image.id });
    assert.equal(asset.sha256, image.sha256);
    assert.match(asset.localObjectKey, /^objects\/[a-f0-9]{64}$/);
    assert.equal(await getReviewablePmcImage({ db, ...scope, principal: admin,
      assetId: '00000000-0000-0000-0000-000000000000' }), null);
  }, { readOnly: true });
});

test('PMC review requires exact version/rights evidence and rollback leaves no approval', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin })).find(row => row.versionId);
    const input = { versionId: item.versionId, rawSha256: item.rawSha256,
      fieldKind: 'bibliographic', purpose: 'display', audience: 'public',
      decision: 'approve', evidenceRef: 'https://pmc.ncbi.nlm.nih.gov/about/copyright/',
      expectedVersion: '0', confirmed: true };
    await assert.rejects(() => submitPmcReview({ db, ...scope, principal: admin,
      input: { ...input, evidenceRef: '' } }), /HUB_SOURCE_EVIDENCE_REQUIRED/);
    await assert.rejects(() => submitPmcReview({ db, ...scope, principal: admin,
      input: { ...input, rawSha256: '0'.repeat(64) } }), /HUB_SOURCE_VERSION_CONFLICT/);
    const saved = await submitPmcReview({ db, ...scope, principal: admin, input });
    assert.equal(saved.fieldKind, 'bibliographic');
    await assert.rejects(() => submitPmcReview({ db, ...scope, principal: admin, input }),
      /HUB_SOURCE_VERSION_CONFLICT/);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});
