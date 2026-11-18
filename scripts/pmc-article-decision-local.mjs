import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../server/hub-sources/pmc-article-decision.sql', import.meta.url));

export async function applyPmcArticleDecisionLocal() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('PMC_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const sql = readFileSync(schemaPath, 'utf8');
  if (!ids?.tenant || !ids?.admin || /\b(?:DROP|TRUNCATE|DELETE)\b/i.test(sql))
    throw new Error('PMC_SCOPE_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const [tenant, admin] = await Promise.all([
      db.tenant.findUnique({ where: { id: ids.tenant }, select: { id: true, status: true } }),
      db.account.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, username: true, role: true, status: true } }),
    ]);
    if (tenant?.status !== 'active' || admin?.tenantId !== ids.tenant ||
        admin.username !== 'admin@example.org' || admin.role !== 'tenant_admin' || admin.status !== 'active')
      throw new Error('PMC_ADMIN_REJECTED');
    const [present] = await db.$queryRaw`SELECT to_regclass('rh_source.pmc_article_decision')::text AS table_name`;
    if (present.table_name) {
      const [column] = await db.$queryRaw`SELECT 1 AS present FROM information_schema.columns
        WHERE table_schema='rh_source' AND table_name='pmc_article_decision' AND column_name='asset_snapshot'`;
      if (!column) await db.$executeRawUnsafe("ALTER TABLE rh_source.pmc_article_decision ADD COLUMN asset_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb");
    } else {
      for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean))
        await db.$executeRawUnsafe(statement);
    }
    const [created] = await db.$queryRaw`
      SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='rh_source' AND c.relname='pmc_article_decision'`;
    if (!created?.rls || !created.forced) throw new Error('PMC_SCHEMA_INCOMPLETE');
    const [snapshotColumn] = await db.$queryRaw`SELECT 1 AS present FROM information_schema.columns
      WHERE table_schema='rh_source' AND table_name='pmc_article_decision' AND column_name='asset_snapshot'`;
    if (!snapshotColumn) throw new Error('PMC_SCHEMA_INCOMPLETE');
    return { applied: !present.table_name, databaseName: target.databaseName };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] !== '--apply') { process.stderr.write('Usage: node scripts/pmc-article-decision-local.mjs --apply\n'); process.exitCode = 2; }
  else applyPmcArticleDecisionLocal().then(value => process.stdout.write(JSON.stringify(value) + '\n'))
    .catch(error => { process.stderr.write((error.code || error.message) + '\n'); process.exitCode = 1; });
}
