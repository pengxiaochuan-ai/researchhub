import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listHubs, getHub, setFollow, getFollow } from './repository.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const { env } = loadFixtureInput(root + '.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));

async function withApp(operation) {
  return withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    return operation(db);
  });
}

test('only initialized active Hub is listed and an unknown key is absent', async () => {
  await withApp(async db => {
    const items = await listHubs({ db, tenantId: ids.tenant });
    assert.equal(items.length, 1);
    assert.equal(items[0].key, 'lingshu-xinyu');
    assert.equal(items[0].name, '针灸治疗情志病');
    assert.equal(await getHub({ db, tenantId: ids.tenant, hubKey: 'not-real' }), null);
  });
});

test('RLS and explicit scope reject another tenant', async () => {
  await withApp(async db => {
    await assert.rejects(listHubs({ db, tenantId: 'another-tenant' }), /HUB_SCOPE_REJECTED/);
    await assert.rejects(getHub({ db, tenantId: 'another-tenant', hubKey: 'lingshu-xinyu' }), /HUB_SCOPE_REJECTED/);
  });
});

test('follow is idempotent and cannot manufacture Study membership', async () => {
  const sentinel = new Error('ROLLBACK_HUB_FOLLOW_TEST');
  await assert.rejects(withApp(async db => {
    const account = await db.account.findUnique({ where: { id: ids.owner }, select: { authVersion: true } });
    const principal = { tenantId: ids.tenant, accountId: ids.owner, authVersion: account.authVersion };
    const membershipsBefore = await db.researchProjectMembership.count({ where: { tenantId: ids.tenant, accountId: ids.owner } });
    assert.equal(typeof await getFollow({ db, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal }), 'boolean');
    assert.equal(await setFollow({ db, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal, followed: true }), true);
    assert.equal(await setFollow({ db, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal, followed: true }), true);
    assert.equal(await getFollow({ db, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal }), true);
    assert.equal(await setFollow({ db, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal, followed: false }), false);
    assert.equal(await db.researchProjectMembership.count({ where: { tenantId: ids.tenant, accountId: ids.owner } }), membershipsBefore);
    throw sentinel;
  }), error => error === sentinel);
});

test('stale authVersion cannot read or mutate follow', async () => {
  await withApp(async db => {
    const account = await db.account.findUnique({ where: { id: ids.owner }, select: { authVersion: true } });
    const principal = { tenantId: ids.tenant, accountId: ids.owner, authVersion: account.authVersion + 1 };
    await assert.rejects(getFollow({ db, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal }), /HUB_SCOPE_REJECTED/);
    await assert.rejects(setFollow({ db, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal, followed: true }), /HUB_SCOPE_REJECTED/);
  });
});

test('app role cannot edit Hub metadata or scope version', async () => {
  await assert.rejects(withApp(db => db.$executeRaw`UPDATE rh_hub.hub
    SET name = 'not allowed' WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'`),
  /P2010|permission denied/);
  await assert.rejects(withApp(db => db.$executeRaw`UPDATE rh_hub.scope_version
    SET status = 'confirmed' WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'`),
  /P2010|permission denied/);
});

test('database guard refuses a follower account owned by another tenant', async () => {
  const other = await withFixtureTransaction(env, 'direct', async db => {
    const rows = await db.$queryRaw`SELECT id FROM public.account
      WHERE "tenantId" <> ${ids.tenant} ORDER BY id LIMIT 1`;
    return rows[0]?.id;
  });
  assert.ok(other, 'dedicated synthetic database needs another tenant for this isolation probe');
  await assert.rejects(withApp(db => db.$executeRaw`INSERT INTO rh_hub.hub_follow
    (tenant_id, hub_key, account_id, followed) VALUES
    (${ids.tenant}, 'lingshu-xinyu', ${other}, true)`), /P2010|HUB_FOLLOW_ACCOUNT_TENANT_REJECTED/);
});
