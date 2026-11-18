import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { initialFive, initialDocumentId } from './initial-five.mjs';

const runtime = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const base = 'http://127.0.0.1:19501';

async function cookie(actor) {
  const response = await fetch(base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password }) });
  assert.equal(response.status, 201);
  return response.headers.get('set-cookie').split(';')[0];
}

async function approvedDocuments(types = initialFive.map(item => item.documentType)) {
  const response = await fetch(base + '/api/hub-sources/external-review-items', { headers: { Cookie: await cookie('admin') } });
  assert.equal(response.status, 200);
  const { items } = await response.json();
  return items.filter(item => {
    const source = initialFive.find(value => value.externalKey === item.externalKey && value.documentType === item.documentType);
    const current = item.decisions.find(value => value.fieldKind === 'bibliographic' && value.purpose === 'display');
    return source && types.includes(item.documentType) && item.versionNumber === 1 && item.sha256 === source.expectedSha256 &&
      item.id === initialDocumentId(runtime.ids.tenant, 'lingshu-xinyu', source) && current?.decision === 'approve' &&
      current.audience === 'public' && (!current.expiresAt || new Date(current.expiresAt) > new Date());
  });
}

test('review routes deny anonymous and non-Hub-admin requests', async () => {
  const path = '/api/hub-sources/review-batches';
  assert.equal((await fetch(base + path)).status, 401);
  const owner = await cookie('owner');
  assert.equal((await fetch(base + path, { headers: { Cookie: owner } })).status, 403);
  const uninvited = await cookie('uninvited');
  assert.equal((await fetch(base + path, { headers: { Cookie: uninvited } })).status, 403);
  const admin = await cookie('admin');
  const response = await fetch(base + path, { headers: { Cookie: admin } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.batches));
  assert.equal(body.batches.length, 2);
});

test('a signed token for another tenant cannot reach Hub review', async () => {
  const encoded = object => Buffer.from(JSON.stringify(object)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = encoded({ alg: 'HS256', typ: 'JWT' });
  const payload = encoded({ sub: 'other-account', accountId: 'other-account', tenantId: 'other-tenant',
    authVersion: 0, role: 'tenant_admin', iat: now, exp: now + 60 });
  const signed = `${head}.${payload}`;
  const token = signed + '.' + createHmac('sha256', runtime.secret).update(signed).digest('base64url');
  const response = await fetch(base + '/api/hub-sources/review-batches', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 401);
});

test('review submission rejects missing evidence without creating a decision', async () => {
  const admin = await cookie('admin');
  const response = await fetch(base + '/api/hub-sources/reviews', { method: 'POST',
    headers: { Cookie: admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId: 'unknown', sourceRegistryId: 'unknown', fieldKind: 'bibliographic',
      purpose: 'display', decision: 'approve', evidenceRef: '', confirmedCount: 1,
      excludedCount: 0, homogeneousRightsConfirmed: true, expectedVersion: 0 }) });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'HUB_SOURCE_EVIDENCE_REQUIRED');
});

test('external review preview is bounded to the current Hub reviewer and omits source payload', async () => {
  const path = '/api/hub-sources/external-review-items';
  assert.equal((await fetch(base + path)).status, 401);
  const owner = await cookie('owner');
  assert.equal((await fetch(base + path, { headers: { Cookie: owner } })).status, 403);
  const admin = await cookie('admin');
  const response = await fetch(base + path, { headers: { Cookie: admin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.items.length, 5);
  assert.equal(body.items.find(item => item.externalKey === 'ChiCTR2300077209').sourceTargetCondition, '轻度认知障碍');
  assert.equal(body.items.every(item => item.reviewDecisionCount >= 0 && !('metadata' in item) && !('contentBytes' in item)), true);
});

test('public external catalogue returns only actually approved metadata', async () => {
  const response = await fetch(base + '/api/hub-sources/external-documents');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(body.items.map(item => item.documentId).sort(), (await approvedDocuments()).map(item => item.id).sort());
});

test('clinical registry endpoints expose only currently approved metadata and hide unknown detail', async () => {
  const list = await fetch(base + '/api/hub-sources/clinical-registries');
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('cache-control'), 'no-store');
  const expected = await approvedDocuments(['clinical_registry']);
  assert.deepEqual((await list.json()).items.map(item => item.documentId).sort(), expected.map(item => item.id).sort());
  for (const item of expected) {
    const current = await fetch(base + '/api/hub-sources/clinical-registries/' + item.id);
    assert.equal(current.status, 200);
    assert.equal((await current.json()).item.externalKey, item.externalKey);
  }
  const detail = await fetch(base + '/api/hub-sources/clinical-registries/rhed-' + '0'.repeat(40));
  assert.equal(detail.status, 404);
  assert.equal(detail.headers.get('cache-control'), 'no-store');
});

test('guidance endpoint exposes exactly current approved standard and guideline IDs', async () => {
  const response = await fetch(base + '/api/hub-sources/guidance-documents');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json()).items.map(item => item.documentId).sort(),
    (await approvedDocuments(['research_standard', 'clinical_guideline'])).map(item => item.id).sort());
});

test('guidance details return only separately approved current excerpts, never clinical records or raw PDF bytes', async () => {
  const expected = await approvedDocuments(['research_standard', 'clinical_guideline']);
  const adminCookie = await cookie('admin');
  const { items } = await (await fetch(base + '/api/hub-sources/external-review-items', { headers: { Cookie: adminCookie } })).json();
  for (const item of expected) {
    const response = await fetch(base + '/api/hub-sources/guidance-documents/' + item.id);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = (await response.json()).item;
    const e = items.find(x => x.id === item.id).guidanceExtraction;
    const active = e?.review?.decision === 'approve' && (!e.review.expiresAt || new Date(e.review.expiresAt) > new Date());
    assert.equal(Boolean(result.clauseDetails), Boolean(active));
    assert.equal(result.clausesStatus, active ? 'approved' : e ? 'pending_review' : 'unavailable');
    if (active) assert.equal(result.clauseDetails.payloadSha256, e.payloadSha256);
    assert.ok(!('contentBytes' in result) && !('metadata' in result));
  }
  const clinical = (await approvedDocuments(['clinical_registry']))[0];
  assert.equal((await fetch(base + '/api/hub-sources/guidance-documents/' + clinical.id)).status, 404);
  assert.equal((await fetch(base + '/api/hub-sources/guidance-documents/' + 'rhed-' + '0'.repeat(40))).status, 404);
});

test('external review write route rejects anonymous, researcher, missing evidence and stale file', async () => {
  const path = base + '/api/hub-sources/external-reviews';
  const headers = { 'Content-Type': 'application/json' };
  const input = { documentId: 'invalid', versionId: 'invalid', sha256: '0'.repeat(64),
    fieldKind: 'bibliographic', purpose: 'display', decision: 'approve',
    evidenceRef: '', expectedVersion: '0', confirmed: true };
  assert.equal((await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) })).status, 401);
  const owner = await cookie('owner');
  assert.equal((await fetch(path, { method: 'POST', headers: { ...headers, Cookie: owner },
    body: JSON.stringify(input) })).status, 403);
  const admin = await cookie('admin');
  const preview = await (await fetch(base + '/api/hub-sources/external-review-items',
    { headers: { Cookie: admin } })).json();
  const item = preview.items[0];
  const beforeCounts = new Map(preview.items.map(value => [value.id, value.reviewDecisionCount]));
  const scoped = { ...input, documentId: item.id, versionId: item.versionId };
  const noEvidence = await fetch(path, { method: 'POST', headers: { ...headers, Cookie: admin },
    body: JSON.stringify(scoped) });
  assert.equal(noEvidence.status, 400);
  assert.equal((await noEvidence.json()).code, 'HUB_SOURCE_EVIDENCE_REQUIRED');
  const stale = await fetch(path, { method: 'POST', headers: { ...headers, Cookie: admin },
    body: JSON.stringify({ ...scoped, evidenceRef: 'https://example.org/synthetic-negative-only' }) });
  assert.equal(stale.status, 409);
  assert.equal(stale.headers.get('cache-control'), 'no-store');
  const after = await (await fetch(base + '/api/hub-sources/external-review-items',
    { headers: { Cookie: admin } })).json();
  assert.equal(after.items.every(value => value.reviewDecisionCount === beforeCounts.get(value.id)), true);
});
