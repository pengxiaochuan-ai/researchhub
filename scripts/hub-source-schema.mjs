import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertHubSourceAdmission } from './hub-source-admission.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../server/hub-sources/schema.sql', import.meta.url));
const tables = ['source_registry', 'import_batch', 'source_record',
  'canonical_publication', 'canonical_source', 'review_decision'];

export function splitSchemaStatements(sql) {
  return sql.split(/^-- statement\s*$/m)
    .map(part => part.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean);
}

export async function applyHubSourceSchema() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_SOURCE_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const sql = readFileSync(schemaPath, 'utf8');
  const statements = splitSchemaStatements(sql);
  if (statements.length < 20 || statements.some(statement =>
    /\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(statement) ||
    /\b(?:public|wp01_meta)\./i.test(statement))) throw new Error('HUB_SOURCE_SCHEMA_REJECTED');
  return withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const [tenant, admin] = await Promise.all([
      tx.tenant.findUnique({ where: { id: ids.tenant }, select: { id: true, status: true } }),
      tx.account.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, status: true } }),
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
    const before = await tx.$queryRawUnsafe(`
      SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='rh_source' AND c.relkind='r' AND relname = ANY(ARRAY[
        'source_registry','import_batch','source_record','canonical_publication','canonical_source','review_decision'])`);
    if (before.length !== 0 && before.length !== tables.length) throw new Error('HUB_SOURCE_SCHEMA_PARTIAL');
    if (before.length === 0) for (const statement of statements) await tx.$executeRawUnsafe(statement);
    const checked = await tx.$queryRawUnsafe(`
      SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='rh_source' AND c.relkind='r' AND relname = ANY(ARRAY[
        'source_registry','import_batch','source_record','canonical_publication','canonical_source','review_decision'])`);
    if (checked.length !== tables.length || checked.some(row => !row.rls || !row.forced))
      throw new Error('HUB_SOURCE_SCHEMA_INCOMPLETE');
    return { databaseName: target.databaseName, tenantId: ids.tenant, hubKey: 'lingshu-xinyu',
      created: before.length === 0, tables: checked.map(row => row.relname).sort() };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/hub-source-schema.mjs --apply\n');
    process.exitCode = 2;
  } else {
    applyHubSourceSchema().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
