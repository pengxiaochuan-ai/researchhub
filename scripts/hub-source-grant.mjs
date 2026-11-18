import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertHubSourceAdmission } from './hub-source-admission.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const hubKey = 'lingshu-xinyu';
const approvalRef = 'codex-user-approval-2026-10-30-hub-source-review-local';

export async function applyNamedSyntheticHubReviewGrant() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_SOURCE_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  if (!ids?.tenant || !ids?.admin) throw new Error('HUB_SOURCE_SCOPE_REJECTED');
  const expected = { databaseName: target.databaseName, tenantId: ids.tenant,
    hubKey, adminId: ids.admin };
  const result = await withFixtureTransaction(env, 'direct', async tx => {
    const [tenant, admin] = await Promise.all([
      tx.tenant.findUnique({ where: { id: ids.tenant }, select: { id: true, status: true } }),
      tx.account.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, username: true, role: true, status: true } }),
    ]);
    if (tenant?.status !== 'active' || admin?.status !== 'active' ||
        admin.tenantId !== ids.tenant || admin.username !== 'admin@example.org' ||
        admin.role !== 'tenant_admin') throw new Error('HUB_SOURCE_SCOPE_REJECTED');
    await tx.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS rh_source');
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS rh_source.review_grant_event (
        event_version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        hub_key TEXT NOT NULL,
        account_id TEXT NOT NULL,
        capability TEXT NOT NULL CHECK (capability = 'source.review'),
        decision TEXT NOT NULL CHECK (decision IN ('grant','revoke')),
        approval_ref TEXT NOT NULL UNIQUE,
        actor_ref TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await tx.$executeRawUnsafe('ALTER TABLE rh_source.review_grant_event ENABLE ROW LEVEL SECURITY');
    await tx.$executeRawUnsafe('ALTER TABLE rh_source.review_grant_event FORCE ROW LEVEL SECURITY');
    const policies = await tx.$queryRawUnsafe(`
      SELECT policyname, qual, with_check AS "withCheck" FROM pg_policies
      WHERE schemaname = 'rh_source' AND tablename = 'review_grant_event'`);
    if (policies.length === 0) {
      await tx.$executeRawUnsafe(`
        CREATE POLICY tenant_rows ON rh_source.review_grant_event FOR ALL
        USING (tenant_id = current_setting('app.tenant_id', true))
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true))`);
    } else if (policies.length !== 1 || policies[0].policyname !== 'tenant_rows' ||
               !policies[0].qual?.includes("current_setting('app.tenant_id'::text, true)") ||
               !policies[0].withCheck?.includes("current_setting('app.tenant_id'::text, true)")) {
      throw new Error('HUB_SOURCE_POLICY_REJECTED');
    }
    await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA rh_source TO aisci_app');
    await tx.$executeRawUnsafe('GRANT SELECT ON rh_source.review_grant_event TO aisci_app');
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const inserted = await tx.$queryRaw`
      INSERT INTO rh_source.review_grant_event
        (tenant_id, hub_key, account_id, capability, decision, approval_ref, actor_ref)
      VALUES (${ids.tenant}, ${hubKey}, ${ids.admin}, 'source.review', 'grant',
              ${approvalRef}, 'explicit-user-approval')
      ON CONFLICT (approval_ref) DO NOTHING RETURNING event_version`;
    const rows = await tx.$queryRaw`
      SELECT tenant_id AS "tenantId", hub_key AS "hubKey", account_id AS "accountId",
             capability, decision, event_version AS "eventVersion"
      FROM rh_source.review_grant_event
      WHERE tenant_id = ${ids.tenant} AND hub_key = ${hubKey}
        AND account_id = ${ids.admin} AND capability = 'source.review'
      ORDER BY event_version DESC LIMIT 1`;
    assertHubSourceAdmission({ target: { ...target, syntheticOnly: true }, tenant, admin,
      hubGrant: rows[0] && { ...rows[0], status: rows[0].decision === 'grant' ? 'active' : 'revoked' } }, expected);
    return { inserted: inserted.length === 1, grantVersion: String(rows[0].eventVersion),
      databaseName: target.databaseName, tenantId: ids.tenant, hubKey, accountId: ids.admin };
  });
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/hub-source-grant.mjs --apply\n');
    process.exitCode = 2;
  } else {
    applyNamedSyntheticHubReviewGrant().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
