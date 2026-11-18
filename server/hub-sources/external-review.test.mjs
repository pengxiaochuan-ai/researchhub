import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listExternalReviewItems } from './external-preview.mjs';
import { submitExternalReview } from './external-review.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin };
const admin = { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 };

test('five-source decisions require current named reviewer, exact current file and evidence', async () => {
  await assertFixtureTarget(env);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const [item] = await listExternalReviewItems({ db, ...scope, principal: admin });
    const input = { documentId: item.id, versionId: item.versionId, sha256: item.sha256,
      fieldKind: 'bibliographic', purpose: 'display', decision: 'approve',
      evidenceRef: 'https://example.org/synthetic-rollback-only', expectedVersion: '0', confirmed: true };
    await assert.rejects(() => submitExternalReview({ db, ...scope, principal: { ...admin, accountId: ids.owner }, input }),
      /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    await assert.rejects(() => submitExternalReview({ db, ...scope, principal: admin,
      input: { ...input, evidenceRef: '' } }), /HUB_SOURCE_EVIDENCE_REQUIRED/);
    await assert.rejects(() => submitExternalReview({ db, ...scope, principal: admin,
      input: { ...input, evidenceRef: 'evidence://unregistered/placeholder' } }), /HUB_SOURCE_EVIDENCE_REQUIRED/);
    await assert.rejects(() => submitExternalReview({ db, ...scope, principal: admin,
      input: { ...input, sha256: '0'.repeat(64) } }), /HUB_SOURCE_VERSION_CONFLICT/);
    await assert.rejects(() => submitExternalReview({ db, ...scope, principal: admin,
      input: { ...input, confirmed: false } }), /HUB_SOURCE_REVIEW_INPUT_REJECTED/);
  });
});

test('append-only field/purpose decision is CAS guarded and rollbacks leave public source closed', async () => {
  await assertFixtureTarget(env);
  const before = await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    return (await listExternalReviewItems({ db, ...scope, principal: admin }))
      .map(item => [item.id, item.reviewDecisionCount]);
  }, { readOnly: true });
  await assert.rejects(() => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const [item] = await listExternalReviewItems({ db, ...scope, principal: admin });
    const current = item.decisions.find(value => value.fieldKind === 'bibliographic' && value.purpose === 'display');
    const active = current?.decision === 'approve' && (!current.expiresAt || new Date(current.expiresAt) > new Date());
    const firstDecision = active ? 'revoke' : 'approve';
    const input = { documentId: item.id, versionId: item.versionId, sha256: item.sha256,
      fieldKind: 'bibliographic', purpose: 'display', decision: firstDecision,
      evidenceRef: 'https://example.org/synthetic-rollback-only',
      expectedVersion: current?.version || '0', confirmed: true };
    const saved = await submitExternalReview({ db, ...scope, principal: admin, input });
    assert.equal(saved.decision, firstDecision);
    assert.equal(saved.fieldKind, 'bibliographic');
    assert.equal(saved.purpose, 'display');
    await assert.rejects(() => submitExternalReview({ db, ...scope, principal: admin, input }),
      /HUB_SOURCE_VERSION_CONFLICT/);
    const opposite = await submitExternalReview({ db, ...scope, principal: admin,
      input: { ...input, decision: active ? 'approve' : 'revoke', expectedVersion: saved.version } });
    assert.equal(opposite.decision, active ? 'approve' : 'revoke');
    throw new Error('EXPECTED_TEST_ROLLBACK');
  }), /EXPECTED_TEST_ROLLBACK/);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const items = await listExternalReviewItems({ db, ...scope, principal: admin });
    assert.deepEqual(items.map(item => [item.id, item.reviewDecisionCount]), before);
  }, { readOnly: true });
});
