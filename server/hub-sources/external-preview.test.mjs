import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listExternalReviewItems } from './external-preview.mjs';

const { env } = loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const { ids } = JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu' };

test('current Hub reviewer sees bounded metadata and controlled extracted fields, never raw files or contacts', async () => {
  await assertFixtureTarget(env);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const items = await listExternalReviewItems({ db, ...scope, reviewerAccountId: ids.admin,
      principal: { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 } });
    assert.equal(items.length, 5);
    assert.deepEqual(items.map(item => item.externalKey).sort(), [
      'ChiCTR2300073486', 'ChiCTR2300077209', 'T/CAAM 0010-2020',
      'T/CAAM 0012-2020', 'ZJ/T E003-2014',
    ].sort());
    assert.equal(items.find(item => item.externalKey === 'ChiCTR2300077209').sourceTargetCondition, '轻度认知障碍');
    for (const item of items) {
      assert.ok(item.reviewDecisionCount >= 0);
      assert.equal(typeof item.fileName, 'string');
      assert.match(item.sha256, /^[a-f0-9]{64}$/);
      assert.ok(!('metadata' in item) && !('contentBytes' in item) && !('payload' in item));
      assert.ok(!/\b(?:phone|email|address)\b/i.test(JSON.stringify(Object.keys(item))));
    }
  }, { readOnly: true });
});

test('researcher, wrong tenant and stale session cannot preview the five sources', async () => {
  await assertFixtureTarget(env);
  await withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    for (const principal of [
      { accountId: ids.owner, tenantId: ids.tenant, authVersion: 0 },
      { accountId: ids.admin, tenantId: 'other-tenant', authVersion: 0 },
      { accountId: ids.admin, tenantId: ids.tenant, authVersion: 999 },
    ]) await assert.rejects(() => listExternalReviewItems({ db, ...scope, reviewerAccountId: ids.admin, principal }),
      /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
    await assert.rejects(() => listExternalReviewItems({ db, ...scope, reviewerAccountId: ids.owner,
      principal: { accountId: ids.admin, tenantId: ids.tenant, authVersion: 0 } }),
    /HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
  }, { readOnly: true });
});
