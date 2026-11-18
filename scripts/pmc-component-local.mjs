import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

const targetPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));

export async function enforcePmcComponentOnceLocal() {
  const { env } = loadFixtureInput(targetPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('PMC_TARGET_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    const duplicates = await db.$queryRaw`
      SELECT version_id, component_ref FROM rh_source.pmc_asset
      GROUP BY tenant_id, hub_key, version_id, component_ref HAVING count(*) > 1 LIMIT 1`;
    if (duplicates.length) throw new Error('PMC_COMPONENT_COLLISION_REQUIRES_REVIEW');
    const [existing] = await db.$queryRaw`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid='rh_source.pmc_asset'::regclass AND conname='pmc_asset_component_once'`;
    if (existing && !existing.definition.includes('UNIQUE (tenant_id, hub_key, version_id, component_ref)'))
      throw new Error('PMC_COMPONENT_CONSTRAINT_MISMATCH');
    if (!existing) await db.$executeRawUnsafe(`ALTER TABLE rh_source.pmc_asset
      ADD CONSTRAINT pmc_asset_component_once UNIQUE (tenant_id, hub_key, version_id, component_ref)`);
    return { databaseName: target.databaseName, componentOnce: true, changed: !existing };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/pmc-component-local.mjs --apply\n');
    process.exitCode = 2;
  } else {
    enforcePmcComponentOnceLocal().then(value => process.stdout.write(JSON.stringify(value) + '\n'))
      .catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  }
}
