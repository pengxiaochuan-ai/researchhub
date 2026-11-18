import test from 'node:test';
import assert from 'node:assert/strict';
import { objectReviewState, externalReviewFingerprint } from './object-review.mjs';

const reference = 'evidence://hub-review/00000000-0000-4000-8000-000000000001/' + 'a'.repeat(64);
const slots = visibility => ['display', 'ai_retrieval'].map((purpose, index) => ({
  fieldKind: 'bibliographic', purpose, decision: visibility === 'withheld' ? 'revoke' : 'approve',
  audience: visibility === 'withheld' ? 'tenant' : visibility, evidenceRef: reference,
  version: String(index + 1), expiresAt: null,
}));
test('review queue distinguishes undecided, partial legacy and all three one-action decisions', () => {
  assert.equal(objectReviewState([]).status, 'pending');
  assert.equal(objectReviewState(slots('public').slice(0, 1)).status, 'partial');
  assert.equal(objectReviewState(slots('public').map(x => ({ ...x, evidenceRef: 'https://example.org' }))).status, 'partial');
  for (const visibility of ['public', 'tenant', 'withheld'])
    assert.equal(objectReviewState(slots(visibility)).status, visibility);
});
test('changed extraction, mixed action and expired approval require review again', () => {
  assert.equal(objectReviewState(slots('public'), ['bibliographic', 'guidance_clauses']).status, 'partial');
  assert.equal(objectReviewState(slots('public').map((x, i) => i ? { ...x, evidenceRef: reference + 'b' } : x)).status, 'partial');
  assert.equal(objectReviewState(slots('tenant').map(x => ({ ...x, expiresAt: '2000-01-01T00:00:00Z' }))).status, 'partial');
});
test('external preview fingerprint changes with content, extraction and every current decision', () => {
  const item = { id: 'doc-1', versionId: 'version-1', sha256: 'a'.repeat(64), title: '原始题名', decisions: slots('public') };
  const baseline = externalReviewFingerprint(item);
  for (const changed of [{ title: '变更题名' }, { sha256: 'b'.repeat(64) },
    { guidanceExtraction: { extractionId: 'new', payloadSha256: 'c'.repeat(64) } },
    { decisions: slots('tenant') }]) assert.notEqual(externalReviewFingerprint({ ...item, ...changed }), baseline);
  assert.equal(externalReviewFingerprint({ ...item, decisions: [...item.decisions].reverse() }), baseline);
});
