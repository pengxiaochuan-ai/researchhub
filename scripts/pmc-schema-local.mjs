import { randomBytes } from 'node:crypto';
import { openSync, writeFileSync, closeSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertHubSourceAdmission } from './hub-source-admission.mjs';
import { splitSchemaStatements } from './hub-source-schema.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../server/hub-sources/pmc-schema.sql', import.meta.url));
const articleSchemaPath = fileURLToPath(new URL('../server/hub-sources/pmc-article-decision.sql', import.meta.url));
const outputPath = fileURLToPath(new URL('../.tmp/researchhub-pmc-local/collector.json', import.meta.url));
const role = 'rh_pmc_collector_local';
const tables = ['pmc_run', 'pmc_candidate', 'pmc_candidate_version', 'pmc_asset',
  'pmc_review_decision', 'pmc_collector_binding', 'pmc_article_decision'];

export async function applyPmcSchemaLocal() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('PMC_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const campaign = 'pmc-first-2026-10-31';
  if (!ids?.tenant || !ids?.admin) throw new Error('PMC_SCOPE_REJECTED');
  const statements = splitSchemaStatements(readFileSync(schemaPath, 'utf8'));
  if (statements.length < 30 || statements.some(sql => /\b(?:DROP|TRUNCATE|DELETE)\b|\b(?:public|wp01_meta)\./i.test(sql)))
    throw new Error('PMC_SCHEMA_REJECTED');
  const secret = randomBytes(36).toString('base64url');
  const result = await withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const [tenant, admin] = await Promise.all([
      tx.tenant.findUnique({ where: { id: ids.tenant }, select: { id: true, status: true } }),
      tx.account.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, username: true, role: true, status: true } }),
    ]);
    const grant = await tx.$queryRaw`
      SELECT tenant_id AS "tenantId", hub_key AS "hubKey", account_id AS "accountId",
             capability, decision FROM rh_source.review_grant_event
      WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
        AND account_id = ${ids.admin} AND capability = 'source.review'
      ORDER BY event_version DESC LIMIT 1`;
    assertHubSourceAdmission({ target: { ...target, syntheticOnly: true }, tenant, admin,
      hubGrant: grant[0] && { ...grant[0], status: grant[0].decision === 'grant' ? 'active' : 'revoked' } },
    { databaseName: target.databaseName, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', adminId: ids.admin });
    if (admin.username !== 'admin@example.org' || admin.role !== 'tenant_admin') throw new Error('PMC_ADMIN_REJECTED');

    const [foundRole] = await tx.$queryRaw`SELECT rolname FROM pg_roles WHERE rolname = ${role}`;
    const before = await tx.$queryRaw`
      SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='rh_source' AND c.relkind='r' AND relname = ANY(${tables}::text[])`;
    if (foundRole || before.length || existsSync(outputPath)) throw new Error('PMC_SCHEMA_ALREADY_PRESENT_REVIEW_REQUIRED');
    await tx.$executeRaw`SELECT set_config('rh.pmc_password', ${secret}, true)`;
    await tx.$executeRawUnsafe(`DO $$ BEGIN EXECUTE format('CREATE ROLE ${role} LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', current_setting('rh.pmc_password')); END $$`);
    await tx.$executeRawUnsafe(`GRANT CONNECT ON DATABASE wp01_test_full_baseline TO ${role}`);
    await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA rh_source TO ${role}`);
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
    for (const statement of readFileSync(articleSchemaPath, 'utf8').split(';').map(part => part.trim()).filter(Boolean))
      await tx.$executeRawUnsafe(statement);
    await tx.$executeRaw`
      INSERT INTO rh_source.pmc_collector_binding (role_name, tenant_id, hub_key, campaign_key)
      VALUES (${role}, ${ids.tenant}, 'lingshu-xinyu', ${campaign})`;
    const checked = await tx.$queryRaw`
      SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='rh_source' AND c.relkind='r' AND relname = ANY(${tables}::text[])`;
    if (checked.length !== 7 || checked.some(row => !row.rls || !row.forced)) throw new Error('PMC_SCHEMA_INCOMPLETE');
    return { databaseName: target.databaseName, tenantId: ids.tenant, hubKey: 'lingshu-xinyu',
      campaign, tables: checked.map(row => row.relname).sort() };
  });
  const url = new URL(env.WP01_TEST_DATABASE_URL);
  url.username = role;
  url.password = secret;
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  const fd = openSync(outputPath, 'wx', 0o600);
  try {
    writeFileSync(fd, JSON.stringify({ databaseUrl: url.href, ...result }) + '\n');
  } finally { closeSync(fd); }
  return { ...result, configPath: outputPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/pmc-schema-local.mjs --apply\n');
    process.exitCode = 2;
  } else {
    applyPmcSchemaLocal().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
