import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthClient } from '../src/auth-session.js';

const user = { accountId: 'a-new', tenantId: 't-new', username: 'researcher@example.org', displayName: '合成研究者', studyGroups: [] };
test('missing tenant configuration refuses login before sending credentials', async () => {
  let sent = false;
  const client = createAuthClient({ fetchImpl: async () => { sent = true; } });
  await assert.rejects(client.login({ username: 'a', password: 'synthetic' }), { code: 'AUTH_NOT_CONFIGURED' });
  assert.equal(sent, false);
});
test('login uses the configured tenant, a fixed same-origin endpoint, and no browser token', async () => {
  let observed;
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async (url, options) => {
    observed = { url, ...options, body: JSON.parse(options.body) };
    return Response.json({ user, token: 'must-never-be-returned' });
  } });
  const result = await client.login({ username: '  researcher@example.org  ', password: ' synthetic ', tenantSlug: 'old-system' });
  assert.deepEqual(result, user);
  assert.equal(observed.url, '/api/auth/login');
  assert.equal(observed.method, 'POST');
  assert.equal(observed.credentials, 'same-origin');
  assert.equal(observed.cache, 'no-store');
  assert.equal(observed.redirect, 'error');
  assert.equal(observed.mode,'same-origin');
  assert.equal(observed.headers['X-ResearchHub-Request'],'session-v1');
  assert.deepEqual(observed.body, { tenantSlug: 'new-hub', username: 'researcher@example.org', password: ' synthetic ' });
});
test('401 me is an anonymous session, not a demo account', async () => {
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => Response.json({}, { status: 401 }) });
  assert.equal(await client.me(), null);
});
test('me returns the actual profile without persisting or inventing membership', async () => {
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async url => {
    assert.equal(url, '/api/auth/me'); return Response.json(user);
  } });
  assert.deepEqual(await client.me(), user);
});
for (const [status, code] of [[401, 'AUTH_INVALID_CREDENTIALS'], [403, 'AUTH_FORBIDDEN'], [429, 'AUTH_RATE_LIMITED'], [500, 'AUTH_UNAVAILABLE']]) {
  test(`login ${status} is explicit and never retries or leaks server detail`, async () => {
    let calls = 0;
    const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => {
      calls++; return Response.json({ message: 'internal secret must not be displayed' }, { status });
    } });
    await assert.rejects(client.login({ username: 'a', password: 'synthetic' }), error => error.code === code && !error.message.includes('internal secret'));
    assert.equal(calls, 1);
  });
}
test('network failure is explicit and does not become a successful demo session', async () => {
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => { throw new TypeError('network'); } });
  await assert.rejects(client.login({ username: 'a', password: 'synthetic' }), { code: 'AUTH_NETWORK' });
});
test('source-verification 403 is not mislabeled as missing account permission or raw server detail',async()=>{const c=createAuthClient({tenantSlug:'new-hub',fetchImpl:async()=>Response.json({code:'AUTH_ORIGIN_REJECTED',message:'untrusted detail'},{status:403})});await assert.rejects(c.login({username:'admin@example.org',password:'synthetic'}),e=>e.code==='AUTH_ORIGIN_REJECTED'&&!e.message.includes('无权')&&!e.message.includes('untrusted'));});
test('abort or timeout reports unconfirmed execution without retrying', async () => {
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } });
  await assert.rejects(client.login({ username: 'a', password: 'synthetic' }), { code: 'AUTH_TIMEOUT' });
});
for (const value of [{}, { user: { ...user, studyGroups: undefined } }, { user: { ...user, accountId: '' } }]) {
  test('malformed login profile is not accepted as authenticated', async () => {
    const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => Response.json(value) });
    await assert.rejects(client.login({ username: 'a', password: 'synthetic' }), { code: 'AUTH_RESPONSE_INVALID' });
  });
}
test('logout requires real ok acknowledgement and sends no token or user selection', async () => {
  let request;
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async (url, options) => {
    request = { url, options }; return Response.json({ ok: true });
  } });
  await client.logout();
  assert.equal(request.url, '/api/auth/logout');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {});
});
test('unconfirmed logout is not reported as logged out', async () => {
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => Response.json({}) });
  await assert.rejects(client.logout(), { code: 'AUTH_RESPONSE_INVALID' });
});
test('only server-returned Study summary is displayed and nested credential fields are discarded', async () => {
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => Response.json({
    ...user, token: 'not-a-browser-credential', studyGroups: [{ id: 'g1', name: '组一', secret: 'ignored',
      researchProjects: [{ id: 's1', name: '授权研究', token: 'ignored' }] }],
  }) });
  assert.deepEqual((await client.me()).studyGroups, [{ id: 'g1', name: '组一', researchProjects: [{ id: 's1', name: '授权研究' }] }]);
  assert.equal('token' in await client.me(), false);
});
test('invalid Study entries cannot create an authenticated-looking summary', async () => {
  const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => Response.json({
    ...user, studyGroups: [{ id: 'g1', name: '组一', researchProjects: [{ name: 'missing identity' }] }],
  }) });
  await assert.rejects(client.me(), { code: 'AUTH_RESPONSE_INVALID' });
});
for (const invalid of [{ isTenantAdmin: 'true' }, { tenantName: { internal: 'not display text' } }]) {
  test('malformed identity presentation fields are not accepted as a verified profile', async () => {
    const client = createAuthClient({ tenantSlug: 'new-hub', fetchImpl: async () => Response.json({ ...user, ...invalid }) });
    await assert.rejects(client.me(), { code: 'AUTH_RESPONSE_INVALID' });
  });
}
test('controlled group and project role presentation retains no permissions or credentials',async()=>{
 const client=createAuthClient({tenantSlug:'new-hub',fetchImpl:async()=>Response.json({...user,studyGroups:[{id:'g',name:'G',role:{name:'只读',key:'readonly',menuPermissions:['*'],password:'secret'},researchProjects:[{id:'p',name:'P',roleKey:'researcher',token:'ignored'}]}]})});
 assert.deepEqual((await client.me()).studyGroups,[{id:'g',name:'G',role:{name:'只读',key:'readonly'},researchProjects:[{id:'p',name:'P',roleKey:'researcher'}]}]);
});
