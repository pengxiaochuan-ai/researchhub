import test from 'node:test';
import assert from 'node:assert/strict';
import { assertHubSourceAdmission } from './hub-source-admission.mjs';

const expected = Object.freeze({
  databaseName: 'wp01_test_full_baseline',
  tenantId: 'synthetic-tenant',
  hubKey: 'lingshu-xinyu',
  adminId: 'synthetic-admin',
});
const valid = () => ({
  target: { databaseName: expected.databaseName, syntheticOnly: true, runId: 'fixture-run' },
  tenant: { id: expected.tenantId, status: 'active' },
  admin: { id: expected.adminId, tenantId: expected.tenantId, role: 'tenant_admin', status: 'active' },
  hubGrant: { tenantId: expected.tenantId, hubKey: expected.hubKey, accountId: expected.adminId, capability: 'source.review', status: 'active' },
});

test('accepts only an explicit current Hub review grant', () => {
  assert.deepEqual(assertHubSourceAdmission(valid(), expected), {
    databaseName: expected.databaseName,
    runId: 'fixture-run',
    tenantId: expected.tenantId,
    hubKey: expected.hubKey,
    adminId: expected.adminId,
    allowed: true,
  });
});

test('rejects clinical and unknown database targets', () => {
  for (const databaseName of ['aisci', 'clinical', 'unknown']) {
    const input = valid(); input.target.databaseName = databaseName;
    assert.throws(() => assertHubSourceAdmission(input, expected), { code: 'HUB_SOURCE_TARGET_REJECTED' });
  }
  const input = valid(); input.target.syntheticOnly = false;
  assert.throws(() => assertHubSourceAdmission(input, expected), { code: 'HUB_SOURCE_TARGET_REJECTED' });
});

test('rejects a different tenant, Hub or review principal', () => {
  for (const change of [
    input => { input.tenant.id = 'other-tenant'; },
    input => { input.admin.tenantId = 'other-tenant'; },
    input => { input.hubGrant.hubKey = 'other-hub'; },
    input => { input.hubGrant.accountId = 'other-admin'; },
  ]) {
    const input = valid(); change(input);
    assert.throws(() => assertHubSourceAdmission(input, expected), { code: 'HUB_SOURCE_SCOPE_REJECTED' });
  }
});

test('tenant admin alone cannot review or release Hub sources', () => {
  const input = valid(); input.hubGrant = null;
  assert.throws(() => assertHubSourceAdmission(input, expected), { code: 'HUB_SOURCE_REVIEW_AUTH_REQUIRED' });
  const input2 = valid(); input2.hubGrant.status = 'revoked';
  assert.throws(() => assertHubSourceAdmission(input2, expected), { code: 'HUB_SOURCE_REVIEW_AUTH_REQUIRED' });
});
