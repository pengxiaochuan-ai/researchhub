import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertHubSourceAdmission } from './hub-source-admission.mjs';
import { applyNamedSyntheticHubReviewGrant } from './hub-source-grant.mjs';

const configPath = '../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json';
const runtimePath = '../.tmp/researchhub-knowledge-local/runtime.json';

test('only the named synthetic admin has the current Hub source review grant', async () => {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const expected = { databaseName: target.databaseName, tenantId: ids.tenant,
    hubKey: 'lingshu-xinyu', adminId: ids.admin };
  const state = await withFixtureTransaction(env, 'direct', async tx => {
    const [tenant, admin, relation] = await Promise.all([
      tx.tenant.findUnique({ where: { id: ids.tenant }, select: { id: true, status: true } }),
      tx.account.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, status: true, role: true } }),
      tx.$queryRawUnsafe("SELECT to_regclass('rh_source.review_grant_event')::text AS name"),
    ]);
    assert.equal(relation[0].name, 'rh_source.review_grant_event');
    const rows = await tx.$queryRaw`
      SELECT tenant_id AS "tenantId", hub_key AS "hubKey", account_id AS "accountId",
             capability, decision, approval_ref AS "approvalRef", event_version AS "eventVersion"
      FROM rh_source.review_grant_event
      WHERE tenant_id = ${ids.tenant} AND hub_key = ${expected.hubKey}
        AND account_id = ${ids.admin} AND capability = 'source.review'
      ORDER BY event_version DESC LIMIT 1`;
    const others = await tx.$queryRaw`
      SELECT COUNT(*)::int AS count FROM rh_source.review_grant_event
      WHERE tenant_id = ${ids.tenant} AND hub_key = ${expected.hubKey}
        AND account_id <> ${ids.admin} AND decision = 'grant'`;
    return { tenant, admin, grant: rows[0], otherGrants: others[0].count };
  }, { readOnly: true });
  assert.equal(state.admin.role, 'tenant_admin');
  assert.equal(state.otherGrants, 0);
  assert.equal(state.grant?.decision, 'grant');
  assert.match(state.grant.approvalRef, /2026-10-30/);
  assertHubSourceAdmission({
    target: { ...target, syntheticOnly: true }, tenant: state.tenant, admin: state.admin,
    hubGrant: { ...state.grant, status: state.grant.decision === 'grant' ? 'active' : 'revoked' },
  }, expected);
});

test('reapplying the same approval never appends a second grant event', async () => {
  const result = await applyNamedSyntheticHubReviewGrant();
  assert.equal(result.inserted, false);
  const { env } = loadFixtureInput(configPath);
  const count = await withFixtureTransaction(env, 'direct', async tx => {
    const rows = await tx.$queryRaw`
      SELECT COUNT(*)::int AS count FROM rh_source.review_grant_event
      WHERE approval_ref = 'codex-user-approval-2026-10-30-hub-source-review-local'`;
    return rows[0].count;
  }, { readOnly: true });
  assert.equal(count, 1);
});
