import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const runtime = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const base = 'http://127.0.0.1:19501';
async function cookie(actor) {
  const response = await fetch(base + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password }) });
  assert.equal(response.status, 201);
  return response.headers.get('set-cookie').split(';')[0];
}

test('actual HTTP Agent retrieval uses two existing accounts and yields zero unreviewed hits', async () => {
  // An unrelated administrator's real approval must not invalidate the empty-result fixture.
  const path = '/api/hub-sources/agent-retrieval?query=' + encodeURIComponent('absent-source-'+randomUUID());
  assert.equal((await fetch(base + path)).status, 401);
  const owner = await cookie('owner');
  const response = await fetch(base + path, { headers: { Cookie: owner } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mutated, false);
  assert.equal(body.meta.actualRetrieval, 'ResearchHub-current-reviewed-PG');
  assert.deepEqual(body.meta.sources, []);
  const uninvited = await cookie('uninvited');
  assert.equal((await fetch(base + path, { headers: { Cookie: uninvited } })).status, 403);
});
