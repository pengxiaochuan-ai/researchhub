import { fixtureClient, validateFixtureConfig, readFixtureIdentity, checkFixtureIdentity } from '../../../app/server/scripts/wp01/fixture-guard.mjs';

// A full workbook is atomic. Reuse the original fixture identity checks on the
// same connection, with a longer *local-only* interactive transaction timeout.
export async function withHubSourceTransaction(env, operation) {
  const config = validateFixtureConfig(env);
  if (config.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_SOURCE_TARGET_REJECTED');
  const client = fixtureClient(config.directUrl);
  try {
    return await client.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 10000');
      checkFixtureIdentity(config, 'direct', await readFixtureIdentity(tx));
      return operation(tx);
    }, { maxWait: 8000, timeout: 120000 });
  } finally { await client.$disconnect(); }
}
