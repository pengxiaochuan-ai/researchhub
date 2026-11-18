import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));

export async function applyReviewScopeUpgrade() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_SOURCE_TARGET_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    const table = await db.$queryRawUnsafe("SELECT to_regclass('rh_source.review_decision')::text AS name");
    if (table[0]?.name !== 'rh_source.review_decision') throw new Error('HUB_SOURCE_SCHEMA_REQUIRED');
    await db.$executeRawUnsafe(`ALTER TABLE rh_source.review_decision
      ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'tenant'
      CHECK (audience IN ('tenant','public'))`);
    await db.$executeRawUnsafe(`ALTER TABLE rh_source.review_decision
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
    const [currentLock] = await db.$queryRawUnsafe(`SELECT pg_get_function_result(
      to_regprocedure('rh_source.hold_review_grants_for_commit()')) AS result`);
    if (currentLock?.result === 'void')
      await db.$executeRawUnsafe('DROP FUNCTION rh_source.hold_review_grants_for_commit()');
    else if (currentLock?.result && currentLock.result !== 'integer')
      throw new Error('HUB_SOURCE_GRANT_LOCK_CONTRACT_REJECTED');
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION rh_source.hold_review_grants_for_commit() RETURNS integer
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, rh_source AS $$
      BEGIN
        LOCK TABLE rh_source.review_grant_event IN SHARE MODE;
        RETURN 1;
      END;
      $$`);
    await db.$executeRawUnsafe('REVOKE ALL ON FUNCTION rh_source.hold_review_grants_for_commit() FROM PUBLIC');
    await db.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION rh_source.hold_review_grants_for_commit() TO aisci_app');
    return { databaseName: target.databaseName, table: table[0].name, audienceDefault: 'tenant' };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/hub-source-review-upgrade.mjs --apply\n');
    process.exitCode = 2;
  } else {
    applyReviewScopeUpgrade().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
