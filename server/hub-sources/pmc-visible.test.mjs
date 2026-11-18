import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listPmcReviewItems, submitPmcReview, submitPmcArticleReview } from './pmc-review-service.mjs';
import { getVisiblePmc, listVisiblePmc, getDownloadablePmcAsset } from './pmc-visible.mjs';
import { runHubSourceSearch, assertCurrentAiSources, assertHubPublicationSources } from './agent-retrieval.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu' };
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 };

test('one current PMC decision controls public page, assets and AI together', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin }))
      .find(row => row.pmcid === 'PMC13691533');
    const owner = { accountId: ids.owner, tenantId: ids.tenant, authVersion: 0 };
    const asset = item.assets.find(value => value.assetKind === 'image');
    const approved = await submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { versionId: item.versionId,
        rawSha256: item.rawSha256, visibility: 'public', expectedVersion: '0',
        expectedAssetFingerprint: item.assetFingerprint } });
    const visible = await getVisiblePmc({ db, ...scope, recordId: `pmc-${item.pmcid}` });
    assert.equal(visible.reviewVersion, `article:${approved.version}`);
    assert.equal(visible.abstract, item.abstract);
    assert.equal(visible.assets.length, item.assets.filter(value =>
      ['image','supplement'].includes(value.assetKind)).length);
    assert.ok(await getDownloadablePmcAsset({ db, ...scope, assetId: asset.id }));
    const result = await runHubSourceSearch({ db, ...scope, principal: owner, query: item.title.slice(0, 40) });
    const source = result.meta.sources.find(value => value.pmcRecordId === `pmc-${item.pmcid}`);
    assert.ok(source);
    await submitPmcArticleReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { versionId: item.versionId, rawSha256: item.rawSha256,
        visibility: 'withheld', expectedVersion: approved.version } });
    assert.equal(await getVisiblePmc({ db, ...scope, recordId: `pmc-${item.pmcid}` }), null);
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: [source] }), /HUB_SOURCE_CHANGED/);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('tenant-only PMC decision is hidden from public but readable by active tenant researcher and AI', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(row => row.pmcid === 'PMC13691533');
    const owner = { accountId: ids.owner, tenantId: ids.tenant, authVersion: 0 };
    await submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { versionId: item.versionId,
        rawSha256: item.rawSha256, visibility: 'tenant', expectedVersion: '0',
        expectedAssetFingerprint: item.assetFingerprint } });
    const recordId = `pmc-${item.pmcid}`;
    assert.equal(await getVisiblePmc({ db, ...scope, recordId }), null);
    assert.deepEqual(await listVisiblePmc({ db, ...scope, query: item.pmcid }), []);
    assert.ok((await getVisiblePmc({ db, ...scope, recordId, principal: owner,
      audience: 'tenant' })).assets.length);
    await assert.rejects(() => getVisiblePmc({ db, ...scope, recordId,
      audience: 'tenant' }), /HUB_SOURCE_SCOPE_REJECTED/);
    await assert.rejects(() => getVisiblePmc({ db, ...scope, recordId,
      principal: { ...owner, tenantId: 'other-tenant' }, audience: 'tenant' }),
    /HUB_SOURCE_SCOPE_REJECTED/);
    const result = await runHubSourceSearch({ db, ...scope, principal: owner,
      query: item.title.slice(0, 40) });
    assert.ok(result.meta.sources.some(source => source.pmcRecordId === recordId));
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('a newly staged image stays hidden until the same article scope is confirmed again', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(row => row.pmcid === 'PMC13691533');
    const source = item.assets.find(asset => asset.assetKind === 'image');
    const input = { versionId: item.versionId, rawSha256: item.rawSha256,
      visibility: 'public', expectedVersion: '0', expectedAssetFingerprint: item.assetFingerprint };
    const first = await submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input });
    const addedId = randomUUID();
    await db.$executeRaw`
      INSERT INTO rh_source.pmc_asset
        (id,tenant_id,hub_key,version_id,campaign_key,component_ref,asset_kind,
         official_url,object_sha256,object_md5,byte_count,local_object_key,mime_type,
         rights_uri,attribution,third_party_rights,parsed_text)
      SELECT ${addedId},tenant_id,hub_key,version_id,campaign_key,
        component_ref || '-late',asset_kind,official_url,object_sha256,object_md5,
        byte_count,local_object_key,mime_type,rights_uri,attribution,third_party_rights,parsed_text
      FROM rh_source.pmc_asset WHERE id=${source.id}`;
    const recordId = `pmc-${item.pmcid}`;
    const before = await getVisiblePmc({ db, ...scope, recordId });
    assert.equal(before.assets.some(asset => asset.id === addedId), false);
    assert.equal(await getDownloadablePmcAsset({ db, ...scope, assetId: addedId }), null);
    await assert.rejects(() => submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { ...input, expectedVersion: first.version } }),
    /HUB_SOURCE_VERSION_CONFLICT/);
    const refreshed = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(row => row.pmcid === item.pmcid);
    const second = await submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { ...input, expectedVersion: first.version,
        expectedAssetFingerprint: refreshed.assetFingerprint } });
    assert.notEqual(second.version, first.version);
    const after = await getVisiblePmc({ db, ...scope, recordId });
    assert.equal(after.assets.some(asset => asset.id === addedId), true);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('withheld remains available even after media exceeds the review preview cap', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(row => row.pmcid === 'PMC13691533');
    const image = item.assets.find(asset => asset.assetKind === 'image');
    const approved = await submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { versionId: item.versionId,
        rawSha256: item.rawSha256, visibility: 'public', expectedVersion: '0',
        expectedAssetFingerprint: item.assetFingerprint } });
    await db.$executeRaw`
      INSERT INTO rh_source.pmc_asset
        (id,tenant_id,hub_key,version_id,campaign_key,component_ref,asset_kind,
         official_url,object_sha256,object_md5,byte_count,local_object_key,mime_type,
         rights_uri,attribution,third_party_rights,parsed_text)
      SELECT gen_random_uuid()::text,tenant_id,hub_key,version_id,campaign_key,
        component_ref || '-late-' || series.i,asset_kind,official_url,object_sha256,object_md5,
        byte_count,local_object_key,mime_type,rights_uri,attribution,third_party_rights,parsed_text
      FROM rh_source.pmc_asset CROSS JOIN generate_series(1,261) AS series(i)
      WHERE id=${image.id}`;
    await assert.rejects(() => submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { versionId: item.versionId,
        rawSha256: item.rawSha256, visibility: 'tenant', expectedVersion: approved.version,
        expectedAssetFingerprint: item.assetFingerprint } }), /HUB_SOURCE_REVIEW_INPUT_REJECTED/);
    await submitPmcArticleReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { versionId: item.versionId,
        rawSha256: item.rawSha256, visibility: 'withheld', expectedVersion: approved.version } });
    assert.equal(await getVisiblePmc({ db, ...scope, recordId: `pmc-${item.pmcid}` }), null);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('PMC public projection is closed before review and opens only within current decision', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(value => value.versionId);
    const recordId = `pmc-${item.pmcid}`;
    assert.equal(await getVisiblePmc({ db, ...scope, recordId }), null);
    assert.deepEqual(await listVisiblePmc({ db, ...scope, query: item.pmcid }), []);
    await submitPmcReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { versionId: item.versionId, rawSha256: item.rawSha256,
        fieldKind: 'bibliographic', purpose: 'display', audience: 'public',
        decision: 'approve', evidenceRef: 'https://pmc.ncbi.nlm.nih.gov/about/copyright/',
        expectedVersion: '0', confirmed: true } });
    const visible = await getVisiblePmc({ db, ...scope, recordId });
    assert.equal(visible.id, recordId);
    assert.equal(visible.title, item.title);
    assert.equal(visible.abstract, null);
    assert.equal(visible.body, null);
    assert.equal((await listVisiblePmc({ db, ...scope, query: item.pmcid }))[0].id, recordId);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    assert.equal(await getVisiblePmc({ db, ...scope, recordId: 'pmc-PMC13691533' }), null);
  }, { readOnly: true });
});

test('PMC AI retrieval requires separate current approval and fails after revocation', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(value => value.versionId);
    const owner = { accountId: ids.owner, tenantId: ids.tenant, authVersion: 0 };
    const query = item.title.slice(0, 40);
    const input = { versionId: item.versionId, rawSha256: item.rawSha256,
      fieldKind: 'bibliographic', audience: 'public', decision: 'approve',
      evidenceRef: 'https://pmc.ncbi.nlm.nih.gov/about/copyright/',
      expectedVersion: '0', confirmed: true };
    await submitPmcReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { ...input, purpose: 'display' } });
    let result = await runHubSourceSearch({ db, ...scope, principal: owner, query });
    assert.equal(result.meta.sources.some(source => source.pmcRecordId), false);
    await submitPmcReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { ...input, purpose: 'ai_retrieval' } });
    result = await runHubSourceSearch({ db, ...scope, principal: owner, query });
    const source = result.meta.sources.find(value => value.pmcRecordId === `pmc-${item.pmcid}`);
    assert.ok(source);
    await assertCurrentAiSources({ db, ...scope, principal: owner, sources: [source] });
    await submitPmcReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { ...input, purpose: 'ai_retrieval', decision: 'revoke', expectedVersion: source.aiReviewVersion } });
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: [source] }), /HUB_SOURCE_CHANGED/);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('a public PMC object link requires both display and download decisions', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(value => value.versionId &&
        value.assets.some(asset => ['image','supplement'].includes(asset.assetKind)));
    assert.ok(item);
    const asset = item.assets.find(value => ['image','supplement'].includes(value.assetKind));
    assert.equal(await getDownloadablePmcAsset({ db, ...scope, assetId: asset.id }), null);
    const input = { versionId: item.versionId, rawSha256: item.rawSha256,
      audience: 'public', decision: 'approve',
      evidenceRef: 'https://pmc.ncbi.nlm.nih.gov/about/copyright/',
      expectedVersion: '0', confirmed: true };
    const review = data => submitPmcReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { ...input, ...data } });
    await review({ fieldKind: 'bibliographic', purpose: 'display' });
    await review({ fieldKind: asset.assetKind, assetId: asset.id,
      componentSha256: asset.sha256, thirdPartyRightsConfirmed: true, purpose: 'display' });
    let visible = await getVisiblePmc({ db, ...scope, recordId: `pmc-${item.pmcid}` });
    assert.deepEqual(visible.assets, []);
    assert.equal(await getDownloadablePmcAsset({ db, ...scope, assetId: asset.id }), null);
    await review({ fieldKind: asset.assetKind, assetId: asset.id,
      componentSha256: asset.sha256, thirdPartyRightsConfirmed: true, purpose: 'download' });
    visible = await getVisiblePmc({ db, ...scope, recordId: `pmc-${item.pmcid}` });
    assert.equal(visible.assets[0].officialUrl, asset.officialUrl);
    const downloadable = await getDownloadablePmcAsset({ db, ...scope, assetId: asset.id });
    assert.equal(downloadable.assetKind, asset.assetKind);
    assert.equal(downloadable.sha256, asset.sha256);
    assert.match(downloadable.localObjectKey, /^objects\/[a-f0-9]{64}$/);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('PMC13691533 approved images retain original JATS figure order and captions', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(value => value.pmcid === 'PMC13691533');
    const first = item.assets.find(value => value.componentRef.endsWith('g001.webp'));
    assert.ok(first);
    const input = { versionId: item.versionId, rawSha256: item.rawSha256,
      audience: 'public', decision: 'approve', evidenceRef: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC13691533/',
      expectedVersion: '0', confirmed: true };
    for (const [fieldKind, purpose] of [['bibliographic', 'display'], ['image', 'display'], ['image', 'download']])
      await submitPmcReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
        input: { ...input, fieldKind, purpose,
          ...(fieldKind === 'image' ? { assetId: first.id, componentSha256: first.sha256,
            thirdPartyRightsConfirmed: true } : {}) } });
    const visible = await getVisiblePmc({ db, ...scope, recordId: 'pmc-PMC13691533' });
    assert.equal(visible.assets.length, 1);
    assert.equal(visible.assets[0].label, 'FIGURE 1');
    assert.match(visible.assets[0].caption, /Overall experimental process/);
    assert.equal(visible.assets[0].figureOrder, 0);
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});

test('PMC source passes the elevated final publication fence only while current', async () => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const item = (await listPmcReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(value => value.versionId);
    const owner = { accountId: ids.owner, tenantId: ids.tenant, authVersion: 0 };
    for (const purpose of ['display', 'ai_retrieval']) await submitPmcReview({ db,
      ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { versionId: item.versionId, rawSha256: item.rawSha256,
        fieldKind: 'bibliographic', purpose, audience: 'public', decision: 'approve',
        evidenceRef: 'https://pmc.ncbi.nlm.nih.gov/about/copyright/',
        expectedVersion: '0', confirmed: true } });
    const result = await runHubSourceSearch({ db, ...scope, principal: owner,
      query: item.title.slice(0, 40) });
    const source = result.meta.sources.find(value => value.pmcRecordId === `pmc-${item.pmcid}`);
    assert.ok(source);
    await assertHubPublicationSources({ db, ...scope, principal: owner, sources: [source] });
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
});
