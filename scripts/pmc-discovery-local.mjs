import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

// Apply only the additive, least-privilege discovery finalizer to the named local fixture.
const schemaPath = fileURLToPath(new URL('../server/hub-sources/pmc-schema.sql', import.meta.url));
const targetPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));

export async function applyPmcDiscoveryLocal() {
  const { env } = loadFixtureInput(targetPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('PMC_TARGET_REJECTED');
  const statements = readFileSync(schemaPath, 'utf8').split('\n-- statement\n').map(value => value.trim());
  const required = [
    'CREATE OR REPLACE FUNCTION rh_source.set_pmc_query_translation',
    'REVOKE ALL ON FUNCTION rh_source.set_pmc_query_translation',
    'GRANT EXECUTE ON FUNCTION rh_source.set_pmc_query_translation',
  ];
  const selected = required.map(prefix => {
    const matches = statements.filter(value => value.startsWith(prefix));
    if (matches.length !== 1) throw new Error('PMC_DISCOVERY_SCHEMA_MISMATCH');
    return matches[0];
  });
  return withFixtureTransaction(env, 'direct', async db => {
    for (const statement of selected) await db.$executeRawUnsafe(statement);
    const [grant] = await db.$queryRaw`SELECT has_function_privilege(
      'rh_pmc_collector_local', 'rh_source.set_pmc_query_translation(text,text,text)', 'EXECUTE') AS allowed`;
    if (!grant?.allowed) throw new Error('PMC_DISCOVERY_GRANT_MISSING');
    return { databaseName: target.databaseName, function: 'rh_source.set_pmc_query_translation', collectorExecute: true };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/pmc-discovery-local.mjs --apply\n');
    process.exitCode = 2;
  } else {
    applyPmcDiscoveryLocal().then(value => process.stdout.write(JSON.stringify(value) + '\n'))
      .catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  }
}
