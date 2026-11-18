import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const base = 'http://127.0.0.1:19501';
async function cookie(actor) {
  const response = await fetch(base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password }) });
  assert.equal(response.status, 201);
  return response.headers.get('set-cookie').split(';')[0];
}

test('public Hub list and detail show one initialized scope, never demo Hubs', async () => {
  const list = await fetch(base + '/api/hubs');
  assert.equal(list.status, 200);
  const { items } = await list.json();
  assert.deepEqual(items.map(item => item.key), ['lingshu-xinyu']);
  assert.equal(items[0].scopeStatus, 'pending_expert_confirmation');
  assert.equal((await fetch(base + '/api/hubs/missing')).status, 404);
});

test('overview exposes reviewed public sources and current indexed metrics without staged row totals', async () => {
  const response = await fetch(base + '/api/hubs/lingshu-xinyu/overview');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.hub.key, 'lingshu-xinyu');
  assert.equal(body.sourceScopeStatus, 'candidate_not_screened');
  const catalog = await (await fetch(base + '/api/hub-sources/publications?limit=6')).json();
  assert.equal(body.reviewedSourceRecordCount, 13);
  assert.equal(body.reviewedSourceRecordCount, catalog.counts.matchedRecords);
  assert.deepEqual(body.reviewedSources.map(x => [x.id, x.title]), catalog.items.map(x => [x.id, x.title]));
  assert.equal(body.metrics.publications.value, 11);
  assert.equal(body.metrics.registrations.value, 2);
  assert.equal(body.metrics.guides.value, 3);
  assert.equal(JSON.stringify(body).includes('15697'), false);
});

test('follow requires current login and persists idempotently without new rights', async () => {
  const path = base + '/api/hubs/lingshu-xinyu/follow';
  assert.equal((await fetch(path)).status, 401);
  const owner = await cookie('owner');
  const headers = { Cookie: owner, 'Content-Type': 'application/json' };
  const change = followed => fetch(path, { method: 'PUT', headers, body: JSON.stringify({ followed }) });
  assert.equal((await change(true)).status, 200);
  try {
    assert.equal((await change(true)).status, 200);
    const current = await fetch(path, { headers: { Cookie: owner } });
    assert.equal(current.status, 200);
    assert.equal((await current.json()).followed, true);
    assert.equal((await fetch(base + '/api/hubs/missing/follow', { headers: { Cookie: owner } })).status, 403);
  } finally {
    assert.equal((await change(false)).status, 200);
  }
});
