import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listExternalReviewItems } from './external-preview.mjs';
import { submitExternalReview } from './external-review.mjs';
import { listVisibleExternal, listVisibleClinicalRegistries, getVisibleClinicalRegistry, listVisibleGuidanceDocuments,
  retrieveExternalForAi, getCurrentExternalAiHit } from './external-visible.mjs';
import { runHubSourceSearch, assertCurrentAiSources, assertHubPublicationSources } from './agent-retrieval.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu' };
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 };
const owner = { accountId: ids.owner, tenantId: ids.tenant, authVersion: 0 };

// Every caller rolls this transaction back; persistent admin display decisions
// are a valid baseline and must survive these negative-path fixtures unchanged.
async function privateBaseline(db) {
  const items = await listExternalReviewItems({ db, ...scope, principal: admin, reviewerAccountId: ids.admin });
  for (const item of items) for (const decision of item.decisions) {
    if (decision.fieldKind !== 'bibliographic' || decision.decision !== 'approve' || decision.audience !== 'public') continue;
    await submitExternalReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { documentId: item.id, versionId: item.versionId, sha256: item.sha256,
        fieldKind: 'bibliographic', purpose: decision.purpose, decision: 'revoke',
        expectedVersion: decision.version, confirmed: true, evidenceRef: 'https://example.org/synthetic-rollback-only' } });
  }
}
async function currentVersion(db, item, purpose) {
  const rows = await db.$queryRaw`SELECT decision_version AS version FROM rh_source.external_review_decision
    WHERE tenant_id = ${ids.tenant} AND hub_key = ${scope.hubKey} AND version_id = ${item.versionId}
      AND field_kind = 'bibliographic' AND purpose = ${purpose} ORDER BY decision_version DESC LIMIT 1`;
  return String(rows[0]?.version ?? '0');
}

test('five sources stay private without current per-purpose approval', async () => {
  await assertFixtureTarget(env);
  const rollback = new Error('ROLLBACK_PRIVATE_BASELINE');
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await privateBaseline(db);
    assert.deepEqual(await listVisibleExternal({ db, ...scope }), []);
    assert.deepEqual(await listVisibleClinicalRegistries({ db, ...scope }), []);
    assert.deepEqual(await listVisibleGuidanceDocuments({ db, ...scope }), []);
    assert.equal(await getVisibleClinicalRegistry({ db, ...scope, documentId: 'rhed-' + '0'.repeat(40) }), null);
    assert.deepEqual(await retrieveExternalForAi({ db, ...scope, principal: owner, query: '针灸' }), []);
    await assert.rejects(() => retrieveExternalForAi({ db, ...scope,
      principal: { ...owner, accountId: ids.uninvited }, query: '针灸' }), /HUB_SOURCE_SCOPE_REJECTED/);
    await assert.rejects(() => retrieveExternalForAi({ db, ...scope,
      principal: { ...owner, tenantId: 'wrong' }, query: '针灸' }), /HUB_SOURCE_SCOPE_REJECTED/);
    throw rollback;
  }), error => error === rollback);
});

test('rollback-only review opens metadata by purpose, then revoke immediately closes it', async () => {
  await assertFixtureTarget(env);
  const rollback = new Error('ROLLBACK_EXTERNAL_PROJECTION');
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await privateBaseline(db);
    const items = await listExternalReviewItems({ db, ...scope, principal: admin, reviewerAccountId: ids.admin });
    const item = items.find(value => value.externalKey === 'ChiCTR2300077209');
    const review = async (purpose, decision, expectedVersion) => submitExternalReview({ db,
      ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { documentId: item.id, versionId: item.versionId, sha256: item.sha256,
        fieldKind: 'bibliographic', purpose, decision, expectedVersion: expectedVersion ?? await currentVersion(db, item, purpose), confirmed: true,
        evidenceRef: 'https://example.org/synthetic-rollback-only' } });
    const display = await review('display', 'approve');
    let visible = await listVisibleExternal({ db, ...scope });
    assert.equal(visible.length, 1);
    assert.equal(visible[0].externalKey, 'ChiCTR2300077209');
    assert.equal(visible[0].sourceTargetCondition, '轻度认知障碍');
    assert.equal(visible[0].documentType, 'clinical_registry');
    assert.deepEqual(await listVisibleClinicalRegistries({ db, ...scope }), visible);
    const { structuredDetails, structuredDetailsStatus, ...detailMetadata } = await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id });
    assert.deepEqual(detailMetadata, visible[0]);
    assert.ok(['approved', 'pending_review', 'unavailable'].includes(structuredDetailsStatus));
    assert.ok(!('metadata' in visible[0]) && !('sha256' in visible[0]) && !('fileName' in visible[0]));
    assert.deepEqual(await retrieveExternalForAi({ db, ...scope, principal: owner, query: '轻度认知障碍' }), []);
    const ai = await review('ai_retrieval', 'approve');
    const hits = await retrieveExternalForAi({ db, ...scope, principal: owner, query: '轻度认知障碍' });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].snippetField, 'bibliographic');
    assert.equal(hits[0].contentSha256, item.sha256);
    assert.equal(hits[0].aiReviewVersion, ai.version);
    assert.equal((await getCurrentExternalAiHit({ db, ...scope, principal: owner, documentId: item.id }))?.documentId, item.id);
    const tool = await runHubSourceSearch({ db, ...scope, principal: owner, query: '轻度认知障碍' });
    assert.equal(tool.meta.sources.length, 1);
    assert.equal(tool.meta.sources[0].externalDocumentId, item.id);
    assert.ok(!('sourceRecordId' in tool.meta.sources[0]));
    await assertCurrentAiSources({ db, ...scope, principal: owner, sources: tool.meta.sources });
    await assertHubPublicationSources({ db, ...scope, principal: owner, sources: tool.meta.sources });
    await review('display', 'revoke', display.version);
    visible = await listVisibleExternal({ db, ...scope });
    assert.deepEqual(visible, []);
    assert.deepEqual(await listVisibleClinicalRegistries({ db, ...scope }), []);
    assert.equal(await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id }), null);
    assert.deepEqual(await retrieveExternalForAi({ db, ...scope, principal: owner, query: '轻度认知障碍' }), []);
    assert.equal(await getCurrentExternalAiHit({ db, ...scope, principal: owner, documentId: item.id }), null);
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: tool.meta.sources }), /HUB_SOURCE_CHANGED/);
    throw rollback;
  }), error => error === rollback);
});

test('approved standard and guideline never appear in clinical registry list or detail', async () => {
  await assertFixtureTarget(env);
  const rollback = new Error('ROLLBACK_NON_CLINICAL_PROJECTION');
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await privateBaseline(db);
    const items = await listExternalReviewItems({ db, ...scope, principal: admin, reviewerAccountId: ids.admin });
    for (const item of items.filter(value => ['research_standard', 'clinical_guideline'].includes(value.documentType))) {
      await submitExternalReview({ db, ...scope, principal: admin, reviewerAccountId: ids.admin,
        input: { documentId: item.id, versionId: item.versionId, sha256: item.sha256,
          fieldKind: 'bibliographic', purpose: 'display', decision: 'approve', expectedVersion: await currentVersion(db, item, 'display'),
          confirmed: true, evidenceRef: 'https://example.org/synthetic-rollback-only' } });
      assert.equal(await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id }), null);
    }
    assert.equal((await listVisibleExternal({ db, ...scope })).length, 3);
    assert.deepEqual(await listVisibleClinicalRegistries({ db, ...scope }), []);
    const guidance = await listVisibleGuidanceDocuments({ db, ...scope });
    assert.equal(guidance.length, 3);
    assert.deepEqual(new Set(guidance.map(item => item.documentType)), new Set(['research_standard', 'clinical_guideline']));
    throw rollback;
  }), error => error === rollback);
});

test('guidance approval, revocation and new version each affect H06 visibility', async () => {
  await assertFixtureTarget(env);
  const rollback = new Error('ROLLBACK_GUIDANCE_LIFECYCLE');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await privateBaseline(db);
    const item = (await listExternalReviewItems({ db, ...scope, principal: admin, reviewerAccountId: ids.admin }))
      .find(value => value.externalKey === 'T/CAAM 0010-2020');
    const review = async (decision, expectedVersion) => submitExternalReview({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin, input: { documentId: item.id, versionId: item.versionId,
        sha256: item.sha256, fieldKind: 'bibliographic', purpose: 'display', decision,
        expectedVersion: expectedVersion ?? await currentVersion(db, item, 'display'), confirmed: true, evidenceRef: 'https://example.org/synthetic-rollback-only' } });
    const approved = await review('approve');
    assert.deepEqual((await listVisibleGuidanceDocuments({ db, ...scope })).map(value => value.externalKey), [item.externalKey]);
    const revoked = await review('revoke', approved.version);
    assert.deepEqual(await listVisibleGuidanceDocuments({ db, ...scope }), []);
    await review('approve', revoked.version);
    assert.equal((await listVisibleGuidanceDocuments({ db, ...scope })).length, 1);
    await db.$executeRaw`INSERT INTO rh_source.external_document_version
      (id, tenant_id, hub_key, document_id, version_number, file_name, mime_type,
       content_sha256, source_url, metadata, imported_by)
      VALUES (${'rhedv-synthetic-guidance-' + item.id.slice(5, 18)}, ${ids.tenant}, ${scope.hubKey},
        ${item.id}, ${item.versionNumber + 1}, 'synthetic-standard-v2.pdf',
        'application/pdf', ${'f'.repeat(64)}, ${item.sourceUrl}, '{}'::jsonb, ${ids.admin})`;
    assert.deepEqual(await listVisibleGuidanceDocuments({ db, ...scope }), []);
    throw rollback;
  }), error => error === rollback);
});

test('a new external file version invalidates prior display and AI decisions', async () => {
  await assertFixtureTarget(env);
  const rollback = new Error('ROLLBACK_EXTERNAL_NEW_VERSION');
  await assert.rejects(() => withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await privateBaseline(db);
    const item = (await listExternalReviewItems({ db, ...scope, principal: admin,
      reviewerAccountId: ids.admin })).find(value => value.externalKey === 'ChiCTR2300073486');
    for (const purpose of ['display', 'ai_retrieval']) await submitExternalReview({ db,
      ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { documentId: item.id, versionId: item.versionId, sha256: item.sha256,
        fieldKind: 'bibliographic', purpose, decision: 'approve', expectedVersion: await currentVersion(db, item, purpose),
        confirmed: true, evidenceRef: 'https://example.org/synthetic-rollback-only' } });
    assert.equal((await listVisibleExternal({ db, ...scope })).length, 1);
    const prior = await runHubSourceSearch({ db, ...scope, principal: owner, query: 'ChiCTR2300073486' });
    assert.equal(prior.meta.sources.length, 1);
    const nextVersionId = 'rhedv-synthetic-version-' + item.id.slice(5, 18);
    await db.$executeRaw`INSERT INTO rh_source.external_document_version
      (id, tenant_id, hub_key, document_id, version_number, file_name, mime_type,
       content_sha256, source_url, metadata, imported_by)
      VALUES (${nextVersionId}, ${ids.tenant}, ${scope.hubKey},
        ${item.id}, ${item.versionNumber + 1}, 'synthetic-version.mhtml',
        'multipart/related', ${'e'.repeat(64)}, ${item.sourceUrl}, '{}'::jsonb, ${ids.admin})`;
    for (const purpose of ['display', 'ai_retrieval']) await submitExternalReview({ db,
      ...scope, principal: admin, reviewerAccountId: ids.admin,
      input: { documentId: item.id, versionId: nextVersionId, sha256: 'e'.repeat(64),
        fieldKind: 'bibliographic', purpose, decision: 'approve', expectedVersion: '0',
        confirmed: true, evidenceRef: 'https://example.org/synthetic-rollback-only' } });
    assert.deepEqual(await listVisibleExternal({ db, ...scope }), []);
    assert.deepEqual(await retrieveExternalForAi({ db, ...scope, principal: owner,
      query: 'ChiCTR2300073486' }), []);
    await assert.rejects(() => assertCurrentAiSources({ db, ...scope, principal: owner,
      sources: prior.meta.sources }), /HUB_SOURCE_CHANGED/);
    throw rollback;
  }), error => error === rollback);
});
