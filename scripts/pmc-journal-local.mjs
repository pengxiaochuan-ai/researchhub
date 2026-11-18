import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

// One-time additive correction for the already-created synthetic PMC table.
export async function addPmcJournalLocal() {
  const path = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
  const { env } = loadFixtureInput(path);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('PMC_TARGET_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    const tables = await db.$queryRaw`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='rh_source' AND c.relname='pmc_candidate_version' AND c.relkind='r'`;
    if (tables.length !== 1) throw new Error('PMC_SCHEMA_MISSING');
    await db.$executeRawUnsafe('ALTER TABLE rh_source.pmc_candidate_version ADD COLUMN IF NOT EXISTS journal TEXT');
    const columns = await db.$queryRaw`
      SELECT data_type AS type FROM information_schema.columns
      WHERE table_schema='rh_source' AND table_name='pmc_candidate_version' AND column_name='journal'`;
    if (columns[0]?.type !== 'text') throw new Error('PMC_JOURNAL_SCHEMA_MISMATCH');
    return { databaseName: target.databaseName, column: 'rh_source.pmc_candidate_version.journal' };
  });
}

export async function backfillPmcJournalLocal() {
  await addPmcJournalLocal();
  const path = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
  const root = fileURLToPath(new URL('../.tmp/researchhub-pmc-local/objects/', import.meta.url));
  const runtime = JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url), 'utf8'));
  const { env } = loadFixtureInput(path);
  await assertFixtureTarget(env);
  const require = createRequire('/Users/mac/aisciencesys/app/server/package.json');
  const parser = new (require('fast-xml-parser').XMLParser)({ ignoreAttributes: true, processEntities: false });
  return withFixtureTransaction(env, 'direct', async db => {
    const rows = await db.$queryRaw`
      SELECT id, pmcid, raw_sha256 AS sha FROM rh_source.pmc_candidate_version
      WHERE tenant_id=${runtime.ids.tenant} AND hub_key='lingshu-xinyu'
        AND campaign_key='pmc-first-2026-10-31' AND journal IS NULL
        AND NOT EXISTS (SELECT 1 FROM rh_source.pmc_review_decision d
          WHERE d.version_id=pmc_candidate_version.id AND d.tenant_id=pmc_candidate_version.tenant_id)
      ORDER BY staged_at LIMIT 20`;
    let updated = 0, unavailable = 0;
    for (const row of rows) {
      if (!/^PMC[1-9][0-9]{0,10}$/.test(row.pmcid) || !/^[a-f0-9]{64}$/.test(row.sha))
        throw new Error('PMC_BACKFILL_SCOPE_REJECTED');
      const raw = readFileSync(root + row.sha);
      if (createHash('sha256').update(raw).digest('hex') !== row.sha) throw new Error('PMC_BACKFILL_HASH_MISMATCH');
      if (raw.includes('<!DOCTYPE') || raw.length > 8 * 1024 * 1024) throw new Error('PMC_BACKFILL_XML_REJECTED');
      const article = parser.parse(raw)?.['OAI-PMH']?.GetRecord?.record?.metadata?.article;
      const title = article?.front?.['journal-meta']?.['journal-title-group']?.['journal-title'];
      const journal = typeof title === 'string' ? title.trim()
        : typeof title?.['#text'] === 'string' ? title['#text'].trim() : '';
      if (!journal || journal.length > 512) { unavailable++; continue; }
      const count = await db.$executeRaw`
        UPDATE rh_source.pmc_candidate_version SET journal=${journal}
        WHERE id=${row.id} AND tenant_id=${runtime.ids.tenant}
          AND raw_sha256=${row.sha} AND journal IS NULL
          AND NOT EXISTS (SELECT 1 FROM rh_source.pmc_review_decision d
            WHERE d.version_id=pmc_candidate_version.id AND d.tenant_id=pmc_candidate_version.tenant_id)`;
      if (count !== 1) throw new Error('PMC_BACKFILL_CONFLICT');
      updated++;
    }
    return { inspected: rows.length, updated, unavailable };
  });
}

export async function alignPmcLicenseLocal() {
  const path = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
  const { env } = loadFixtureInput(path);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('PMC_TARGET_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    const [constraint] = await db.$queryRaw`
      SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid='rh_source.pmc_candidate_version'::regclass
        AND conname='pmc_candidate_version_license_uri_check'`;
    if (!constraint) throw new Error('PMC_LICENSE_CONSTRAINT_MISSING');
    if (constraint.definition.includes('creativecommons[.]org/licenses/by/'))
      return { databaseName: target.databaseName, aligned: true, changed: false };
    if (!constraint.definition.includes('publicdomain/zero/1.0/') ||
        !constraint.definition.includes('creativecommons.org/licenses/by/4.0/'))
      throw new Error('PMC_LICENSE_CONSTRAINT_UNEXPECTED');
    await db.$executeRawUnsafe('ALTER TABLE rh_source.pmc_candidate_version DROP CONSTRAINT pmc_candidate_version_license_uri_check');
    await db.$executeRawUnsafe(`ALTER TABLE rh_source.pmc_candidate_version
      ADD CONSTRAINT pmc_candidate_version_license_uri_check
      CHECK (license_uri ~ '^https://creativecommons[.]org/licenses/by/[1-9][0-9]*([.][0-9]+)?/?$'
        OR license_uri ~ '^https://creativecommons[.]org/publicdomain/zero/[1-9][0-9]*([.][0-9]+)?/?$')`);
    return { databaseName: target.databaseName, aligned: true, changed: true };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || !['--apply', '--backfill', '--license'].includes(process.argv[2])) {
    process.stderr.write('Usage: node scripts/pmc-journal-local.mjs --apply|--backfill|--license\n');
    process.exitCode = 2;
  } else {
    (process.argv[2] === '--apply' ? addPmcJournalLocal()
      : process.argv[2] === '--license' ? alignPmcLicenseLocal() : backfillPmcJournalLocal())
      .then(value => process.stdout.write(JSON.stringify(value) + '\n'))
      .catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  }
}
