import test from 'node:test';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:19501';

test('public list is real empty, bounded and never falls back to demo evidence', async () => {
  const response = await fetch(base + '/api/hub-sources/publications?limit=20');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(body.items, []);
  assert.equal(body.counts.stagedRows, 15697);
  assert.equal(body.counts.approvedDisplayRecords, 0);
  assert.equal(body.counts.approvedAiRecords, 0);
  const missing = await fetch(base + '/api/hub-sources/publications/not-approved');
  assert.equal(missing.status, 404);
});
