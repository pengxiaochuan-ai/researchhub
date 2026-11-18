import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listExternalReviewItems } from './external-preview.mjs';
import { submitExternalReview } from './external-review.mjs';
import { getVisibleGuidanceDocument, retrieveExternalForAi } from './external-visible.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin };
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 };
const owner = { ...admin, accountId: ids.owner };
const items = db => listExternalReviewItems({ db, ...scope, principal: admin });
const inputFor = (item, decision) => ({ documentId: item.id, versionId: item.versionId, sha256: item.sha256,
  extractionId: item.guidanceExtraction.extractionId, payloadSha256: item.guidanceExtraction.payloadSha256,
  fieldKind: 'guidance_clauses', purpose: 'display', decision, confirmed: true,
  expectedVersion: item.guidanceExtraction.review?.version || '0', evidenceRef: 'https://example.org/synthetic-rollback-only' });
const submit = (db, input, principal = admin) => submitExternalReview({ db, ...scope, principal, input });
const rollback = async (role, fn) => {
  await assertFixtureTarget(env);
  await assert.rejects(() => withFixtureTransaction(env, role, async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await fn(db); throw new Error('EXPECTED_GUIDANCE_ROLLBACK');
  }), /EXPECTED_GUIDANCE_ROLLBACK/);
};
test('guidance reviewer requires exact source/extraction/hash, display-only, CAS and current named admin', () => rollback('app', async db => {
  const item = (await items(db)).find(x => x.guidanceExtraction);
  const input = inputFor(item, item.guidanceExtraction.review?.decision === 'approve' ? 'revoke' : 'approve');
  for (const changed of [{ extractionId: 'rhge-wrong' }, { payloadSha256: '0'.repeat(64) }, { sha256: 'f'.repeat(64) }, { expectedVersion: '999999' }])
    await assert.rejects(() => submit(db, { ...input, ...changed }), /HUB_SOURCE_VERSION_CONFLICT/);
  await assert.rejects(() => submit(db, { ...input, purpose: 'ai_retrieval' }), /HUB_SOURCE_REVIEW_INPUT_REJECTED/);
  await assert.rejects(() => submit(db, input, owner), /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
  await submit(db, input);
  await assert.rejects(() => submit(db, input), /HUB_SOURCE_VERSION_CONFLICT/);
}));
test('only excerpt approval exposes clauses; revoke and bibliographic withdrawal close them without granting AI', () => rollback('app', async db => {
  let item = (await items(db)).find(x => x.externalKey === 'ZJ/T E003-2014');
  if (item.guidanceExtraction.review?.decision === 'approve') { await submit(db, inputFor(item, 'revoke')); item = (await items(db)).find(x => x.id === item.id); }
  let detail = await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id });
  assert.equal(detail.clausesStatus, 'pending_review'); assert.ok(!detail.clauseDetails);
  await submit(db, inputFor(item, 'approve'));
  detail = await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id });
  assert.equal(detail.clauseDetails.clauses.length, 4); assert.equal(detail.clauseDetails.clauses[2].pdfPage, 17);
  assert.ok(detail.clauseDetails.clauses[1].quote.includes('中重度'));
  assert.deepEqual(await retrieveExternalForAi({ db, ...scope, principal: owner, query: '抑郁症' }), []);
  item = (await items(db)).find(x => x.id === item.id); await submit(db, inputFor(item, 'revoke'));
  assert.ok(!(await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id })).clauseDetails);
  await submit(db, { ...inputFor(item, 'revoke'), fieldKind: 'bibliographic', expectedVersion:
    item.decisions.find(d => d.fieldKind === 'bibliographic' && d.purpose === 'display').version });
  assert.equal(await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id }), null);
}));
test('bad payload/hash, new extraction and source head cannot reuse approvals', () => rollback('direct', async db => {
  let item = (await items(db)).find(x => x.guidanceExtraction);
  if (item.guidanceExtraction.review?.decision !== 'approve') { await submit(db, inputFor(item, 'approve')); item = (await items(db)).find(x => x.id === item.id); }
  await db.$executeRaw`UPDATE rh_source.guidance_clause_extraction SET payload_sha256=${'f'.repeat(64)} WHERE id=${item.guidanceExtraction.extractionId}`;
  assert.ok(!(await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id })).clauseDetails);
  await db.$executeRaw`UPDATE rh_source.guidance_clause_extraction SET payload_sha256=${item.guidanceExtraction.payloadSha256} WHERE id=${item.guidanceExtraction.extractionId}`;
  const nextId = 'rhge-rollback-' + item.id.slice(-15);
  const payload = { ...item.guidanceExtraction.payload, editionNotice: 'rollback-only changed' };
  await db.$executeRaw`INSERT INTO rh_source.guidance_clause_extraction
    (id,tenant_id,hub_key,version_id,extraction_version,source_sha256,extractor_version,payload,payload_sha256,imported_by)
    VALUES (${nextId},${ids.tenant},'lingshu-xinyu',${item.versionId},2,${item.sha256},'pdf-ocr-visual-v1',
      ${JSON.stringify(payload)}::jsonb,${'e'.repeat(64)},'rollback-only')`;
  assert.ok(!(await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id })).clauseDetails);
  await assert.rejects(() => submit(db, inputFor(item, 'revoke')), /HUB_SOURCE_VERSION_CONFLICT/);
  await db.$executeRaw`INSERT INTO rh_source.external_document_version
    (id,tenant_id,hub_key,document_id,version_number,file_name,mime_type,content_sha256,source_url,metadata,imported_by)
    VALUES (${'rhev-guidance-rollback-' + item.id.slice(-15)},${ids.tenant},'lingshu-xinyu',${item.id},2,'rollback.pdf',
      'application/pdf',${'d'.repeat(64)},NULL,'{}'::jsonb,'rollback-only')`;
  assert.equal(await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id }), null);
}));
test('app cannot overwrite excerpts/reviews, wrong tenant sees neither, and non-guidance detail stays null', async () => {
  for (const sql of ['UPDATE rh_source.guidance_clause_extraction SET imported_by=imported_by',
    'DELETE FROM rh_source.guidance_clause_review', 'UPDATE rh_source.guidance_clause_review SET reviewer_id=reviewer_id',
    'INSERT INTO rh_source.guidance_clause_extraction DEFAULT VALUES'])
    await assert.rejects(() => withFixtureTransaction(env, 'app', db => db.$executeRawUnsafe(sql)), /permission denied/);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', 'wrong-tenant', true)`;
    assert.deepEqual(await db.$queryRaw`SELECT id FROM rh_source.guidance_clause_extraction`, []);
    assert.deepEqual(await db.$queryRaw`SELECT decision_version FROM rh_source.guidance_clause_review`, []);
  }, { readOnly: true });
  await rollback('app', async db => {
    const item = (await items(db)).find(x => x.documentType === 'clinical_registry');
    assert.equal(await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id }), null);
  });
});

test('expired excerpt review and a change before the single public projection cannot deliver prior text', () => rollback('direct', async db => {
  let item = (await items(db)).find(x => x.guidanceExtraction);
  if (item.guidanceExtraction.review?.decision !== 'approve') { await submit(db, inputFor(item, 'approve')); item = (await items(db)).find(x => x.id === item.id); }
  await db.$executeRaw`UPDATE rh_source.guidance_clause_review SET expires_at=clock_timestamp()-interval '1 second'
    WHERE tenant_id=${ids.tenant} AND extraction_id=${item.guidanceExtraction.extractionId}`;
  let result = await getVisibleGuidanceDocument({ db, ...scope, documentId: item.id });
  assert.equal(result.clausesStatus, 'pending_review'); assert.ok(!result.clauseDetails);
  let projections = 0;
  const observed = { $queryRaw: async (strings, ...values) => {
    if (strings.join('').includes('FROM rh_source.external_document d')) {
      projections++;
      const prior = item.decisions.find(x => x.fieldKind === 'bibliographic' && x.purpose === 'display');
      await submit(db, { ...inputFor(item, 'revoke'), fieldKind: 'bibliographic', expectedVersion: prior.version });
    } else assert.ok(strings.join('').includes("current_setting('app.tenant_id'"), 'No follow-up approval SELECT may splice old data');
    return db.$queryRaw(strings, ...values);
  } };
  result = await getVisibleGuidanceDocument({ db: observed, ...scope, documentId: item.id });
  assert.equal(result, null); assert.equal(projections, 1);
}));
