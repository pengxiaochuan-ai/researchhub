import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKnowledgeScope, canEditKnowledgeScope, createKnowledgeClient } from '../src/knowledge-session.js';

const user = { accountId: 'a', tenantId: 't', role: 'researcher', studyGroups: [
  { id: 'g', name: '研究组', role: { menuPermissions: ['knowledge'] }, researchProjects: [{ id: 'p', name: '研究' }] },
] };
test('scope accepts only current me membership, never a URL-selected foreign project', () => {
  assert.deepEqual(resolveKnowledgeScope(user, 'g', 'foreign'), { studyGroupId: 'g', researchProjectId: 'p' });
  assert.equal(resolveKnowledgeScope({ ...user, studyGroups: [] }), null);
  assert.equal(resolveKnowledgeScope({ ...user, studyGroups: [{ ...user.studyGroups[0], role: { menuPermissions: [] } }] }), null);
});
test('editing needs existing study permission, including admins; foreign scopes do not inherit it', () => {
  const scope = resolveKnowledgeScope(user);
  assert.equal(canEditKnowledgeScope(user, scope), false);
  const writer = { ...user, studyGroups: [{ ...user.studyGroups[0], role: { menuPermissions: ['knowledge'], buttonPermissions: ['knowledge.edit'] } }] };
  assert.equal(canEditKnowledgeScope(writer, scope), true);
  assert.equal(canEditKnowledgeScope(writer, { ...scope, researchProjectId: 'foreign' }), false);
  assert.equal(canEditKnowledgeScope({ ...user, role: 'tenant_admin' }, scope), false);
});
test('same-origin knowledge calls carry authorized scope and cookie, not a token', async () => {
  let call;
  const api = createKnowledgeClient({ scope: () => resolveKnowledgeScope(user), fetchImpl: async (url, init) => {
    call = { url, init }; return new Response(JSON.stringify([{ id: 'k' }]), { headers: { 'Content-Type': 'application/json' } });
  } });
  assert.deepEqual(await api.get('/knowledge/bases'), [{ id: 'k' }]);
  assert.equal(call.url, '/api/knowledge/bases');
  assert.equal(call.init.credentials, 'same-origin');
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.headers['X-Study-Group-Id'], 'g');
  assert.equal(call.init.headers['X-Research-Project-Id'], 'p');
  assert.equal(call.init.headers.Authorization, undefined);
});
test('missing scope and external URL fail closed without a request', async () => {
  const api = createKnowledgeClient({ scope: () => null, fetchImpl: () => assert.fail('must not request') });
  await assert.rejects(api.get('/knowledge/bases'), /邀请|授权/);
  await assert.rejects(api.get('https://example.org'), /路径/);
});
for (const status of [401, 403, 409, 503]) test(`HTTP ${status} is not an empty/success fallback and retains typed status`, async () => {
  const api = createKnowledgeClient({ scope: () => resolveKnowledgeScope(user), fetchImpl: async () => new Response('{"message":"synthetic failure"}', { status, headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(api.patch('/knowledge/docs/d', { baseVersion: 1 }), error => error.status === status && error.message.includes('synthetic failure'));
});
test('HTML success cannot masquerade as API JSON', async () => {
  const api = createKnowledgeClient({ scope: () => resolveKnowledgeScope(user), fetchImpl: async () => new Response('<html>demo</html>') });
  await assert.rejects(api.get('/knowledge/bases'), /响应/);
});
test('same in-flight mutation is sent once, but a later intentional edit remains possible', async () => {
  let release, requests = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const api = createKnowledgeClient({ scope: () => resolveKnowledgeScope(user), fetchImpl: async () => {
    requests++; await gate; return new Response('{"id":"doc"}', { headers: { 'Content-Type': 'application/json' } });
  } });
  const first = api.post('/knowledge/docs', { kbId: 'k', title: '合成' });
  const duplicate = api.post('/knowledge/docs', { kbId: 'k', title: '合成' });
  release();
  assert.deepEqual(await first, await duplicate);
  assert.equal(requests, 1);
  await api.post('/knowledge/docs', { kbId: 'k', title: '合成' });
  assert.equal(requests, 2);
});
