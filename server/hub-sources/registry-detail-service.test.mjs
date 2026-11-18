import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listExternalReviewItems } from './external-preview.mjs';
import { submitExternalReview } from './external-review.mjs';
import { getVisibleClinicalRegistry, retrieveExternalForAi } from './external-visible.mjs';
import { registryDetailHash } from './registry-detail-contract.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin };
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 };
const owner = { ...admin, accountId: ids.owner };
const rollback = async (role, fn) => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, role, async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await fn(db); throw new Error('EXPECTED_REGISTRY_ROLLBACK');
  }), /EXPECTED_REGISTRY_ROLLBACK/);
};
const items = db => listExternalReviewItems({ db, ...scope, principal: admin });
const inputFor = (item, decision) => ({ documentId: item.id, versionId: item.versionId, sha256: item.sha256,
  extractionId: item.structuredExtraction.extractionId, payloadSha256: item.structuredExtraction.payloadSha256,
  fieldKind: 'registry_details', purpose: 'display', decision, confirmed: true,
  expectedVersion: item.structuredExtraction.review?.version || '0', evidenceRef: 'https://example.org/synthetic-rollback-only' });
const submit = (db, input, principal = admin) => submitExternalReview({ db, ...scope, principal, input });

test('structured review requires same current reviewer, extraction/hash, source version, display-only and CAS', () => rollback('app', async db => {
  let item = (await items(db)).find(value => value.documentType === 'clinical_registry');
  let input = inputFor(item, item.structuredExtraction.review?.decision === 'approve' ? 'revoke' : 'approve');
  for (const changed of [{ extractionId: 'rhce-wrong' }, { payloadSha256: '0'.repeat(64) },
    { sha256: 'f'.repeat(64) }, { expectedVersion: '99999999999' }])
    await assert.rejects(() => submit(db, { ...input, ...changed }), /HUB_SOURCE_VERSION_CONFLICT/);
  await assert.rejects(() => submit(db, { ...input, purpose: 'ai_retrieval' }), /HUB_SOURCE_REVIEW_INPUT_REJECTED/);
  await assert.rejects(() => submit(db, input, owner), /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
  const saved = await submit(db, input);
  await assert.rejects(() => submit(db, input), /HUB_SOURCE_VERSION_CONFLICT/);
  item = (await items(db)).find(value => value.id === item.id);
  assert.equal(item.structuredExtraction.review.version, saved.version);
  assert.equal(saved.extractionId, item.structuredExtraction.extractionId);
}));

test('detail approval does not grant AI/fulltext; revoke hides all structured values, bibliographic revoke hides entire record', () => rollback('app', async db => {
  let item = (await items(db)).find(value => value.externalKey === 'ChiCTR2300073486');
  if (item.structuredExtraction.review?.decision === 'approve') {
    await submit(db, inputFor(item, 'revoke'));
    item = (await items(db)).find(value => value.id === item.id);
  }
  let detail = await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id });
  assert.equal(detail.structuredDetailsStatus, 'pending_review'); assert.ok(!('structuredDetails' in detail));
  await submit(db, inputFor(item, 'approve'));
  detail = await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id });
  assert.equal(detail.structuredDetailsStatus, 'approved');
  assert.equal(detail.structuredDetails.outcomes.length, 9);
  assert.equal(detail.structuredDetails.outcomes[1].englishName.value, 'response rate/remission rate');
  assert.deepEqual(await retrieveExternalForAi({ db, ...scope, principal: owner, query: 'ChiCTR2300073486' }), []);
  item = (await items(db)).find(value => value.id === item.id);
  await submit(db, { ...inputFor(item, 'revoke'), fieldKind: 'bibliographic',
    expectedVersion: item.decisions.find(value => value.fieldKind === 'bibliographic' && value.purpose === 'display').version });
  assert.equal(await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id }), null);
}));

test('new extraction, corrupt hash, source v2 and tenant switch cannot reuse prior detail approval', () => rollback('direct', async db => {
  let item = (await items(db)).find(value => value.documentType === 'clinical_registry');
  if (item.structuredExtraction.review?.decision !== 'approve') {
    await submit(db, inputFor(item, 'approve')); item = (await items(db)).find(value => value.id === item.id);
  }
  const next = structuredClone(item.structuredExtraction.payload); next.design[0].value += ' (rollback fixture)';
  next.design[0].source.quote = next.design[0].value;
  const nextId = 'rhce-rollback-next-' + item.id.slice(-15);
  await db.$executeRaw`INSERT INTO rh_source.clinical_registry_extraction
    (id,tenant_id,hub_key,version_id,extraction_version,source_sha256,extractor_version,payload,payload_sha256,imported_by)
    VALUES (${nextId},${ids.tenant},'lingshu-xinyu',${item.versionId},2,${item.sha256},'chictr-mhtml-v1',
      ${JSON.stringify(next)}::jsonb,${registryDetailHash(next)},'rollback-only')`;
  let detail = await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id });
  assert.equal(detail.structuredDetailsStatus, 'pending_review'); assert.ok(!detail.structuredDetails);
  await assert.rejects(() => submit(db, inputFor(item, 'revoke')), /HUB_SOURCE_VERSION_CONFLICT/);
  await db.$executeRaw`UPDATE rh_source.clinical_registry_extraction SET payload_sha256=${'f'.repeat(64)} WHERE id=${nextId}`;
  detail = await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id });
  assert.equal(detail.structuredDetailsStatus, 'unavailable'); assert.ok(!detail.structuredDetails);
  await db.$executeRaw`INSERT INTO rh_source.external_document_version
    (id,tenant_id,hub_key,document_id,version_number,file_name,mime_type,content_sha256,source_url,metadata,imported_by)
    VALUES (${'rhev-rollback-' + item.id.slice(-15)},${ids.tenant},'lingshu-xinyu',${item.id},2,'rollback.mhtml',
      'multipart/related',${'f'.repeat(64)},${item.sourceUrl},'{}'::jsonb,'rollback-only')`;
  assert.equal(await getVisibleClinicalRegistry({ db, ...scope, documentId: item.id }), null);
}));

test('app role cannot edit/delete extracted values or reviews and RLS hides other tenant rows', async () => {
  for (const statement of ['UPDATE rh_source.clinical_registry_extraction SET imported_by=imported_by',
    'DELETE FROM rh_source.clinical_registry_detail_review', 'UPDATE rh_source.clinical_registry_detail_review SET reviewer_id=reviewer_id',
    'INSERT INTO rh_source.clinical_registry_extraction DEFAULT VALUES']) {
    await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
      await db.$executeRawUnsafe(statement);
    }), /permission denied/);
  }
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', 'wrong-tenant', true)`;
    const rows = await db.$queryRaw`SELECT id FROM rh_source.clinical_registry_extraction`;
    assert.deepEqual(rows, []);
    const reviews = await db.$queryRaw`SELECT decision_version FROM rh_source.clinical_registry_detail_review`;
    assert.deepEqual(reviews, []);
  }, { readOnly: true });
});

test('public details use one source/approval/extraction snapshot, never a mixed multi-query projection', () => rollback('app', async db => {
  const item = (await items(db)).find(value => value.documentType === 'clinical_registry');
  if (item.structuredExtraction.review?.decision !== 'approve') await submit(db, inputFor(item, 'approve'));
  let projections = 0;
  const observed = { $queryRaw: async (strings, ...values) => {
    if (strings.join('').includes('FROM rh_source.external_document d')) {
      projections++;
      // Reproduce a change between the preliminary tenant-context read and the
      // public projection, inside the rollback fixture (no persistent revokes).
      const current = (await items(db)).find(value => value.id === item.id);
      const prior = current.decisions.find(value => value.fieldKind === 'bibliographic' && value.purpose === 'display');
      await submit(db, { ...inputFor(current, 'revoke'), fieldKind: 'bibliographic', expectedVersion: prior.version });
    } else assert.ok(strings.join('').includes("current_setting('app.tenant_id'"), 'No follow-up extraction/review SELECT may build the public result');
    return db.$queryRaw(strings, ...values);
  } };
  assert.equal(await getVisibleClinicalRegistry({ db: observed, ...scope, documentId: item.id }), null);
  assert.equal(projections, 1);
  const current = (await items(db)).find(value => value.id === item.id);
  await submit(db, { ...inputFor(current, 'approve'), fieldKind: 'bibliographic',
    expectedVersion: current.decisions.find(value => value.fieldKind === 'bibliographic' && value.purpose === 'display').version });
  let statementCount = 0;
  const bounded = { $queryRaw: (strings, ...values) => { statementCount++; return db.$queryRaw(strings, ...values); } };
  const detail = await getVisibleClinicalRegistry({ db: bounded, ...scope, documentId: item.id });
  assert.equal(detail.structuredDetailsStatus, 'approved');
  assert.equal(statementCount, 2, 'One tenant-context read plus one coherent source/detail projection');
}));
