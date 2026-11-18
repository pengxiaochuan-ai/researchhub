import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertExternalAdmission } from './hub-external-schema.mjs';
import { splitSchemaStatements } from './hub-source-schema.mjs';
import { initialDocumentId, verifiedInitialFiles } from '../server/hub-sources/initial-five.mjs';
import { extractRegistryDetails, registryDetailHash } from '../server/hub-sources/registry-detail-contract.mjs';
import { assertRegistryCatalog } from '../server/hub-sources/registry-detail-schema-contract.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const tables = ['clinical_registry_extraction', 'clinical_registry_detail_review'];
export async function importRegistryDetails() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_REGISTRY_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const sources = verifiedInitialFiles().filter(item => item.documentType === 'clinical_registry')
    .map(item => ({ ...item, documentId: initialDocumentId(ids.tenant, 'lingshu-xinyu', item),
      details: extractRegistryDetails(item.bytes, item) }));
  if (sources.length !== 2) throw new Error('HUB_REGISTRY_MANIFEST_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await assertExternalAdmission(db, target, ids);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('rh-registry-detail-schema-v1', 0))`;
    const existing = await db.$queryRaw`SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_source' AND c.relkind='r'
        AND c.relname = ANY(${tables}::text[])`;
    if (existing.length && existing.length !== 2) throw new Error('HUB_REGISTRY_SCHEMA_PARTIAL');
    if (!existing.length) {
      const sql = readFileSync(new URL('../server/hub-sources/registry-detail-schema.sql', import.meta.url), 'utf8');
      for (const statement of splitSchemaStatements(sql)) await db.$executeRawUnsafe(statement);
    }
    const guards = await db.$queryRaw`SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
        has_table_privilege('aisci_app',c.oid,'SELECT') AS readable,
        has_any_column_privilege('aisci_app',c.oid,'UPDATE') AS editable,
        has_table_privilege('aisci_app',c.oid,'DELETE') AS deletable,
        has_any_column_privilege('aisci_app',c.oid,'INSERT') AS insertable
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_source'
        AND c.relkind='r' AND c.relname = ANY(${tables}::text[])`;
    if (guards.length !== 2 || guards.some(row => !row.rls || !row.forced || !row.readable || row.editable || row.deletable ||
      row.insertable !== (row.relname === 'clinical_registry_detail_review'))) throw new Error('HUB_REGISTRY_SCHEMA_DRIFT');
    const policies = await db.$queryRaw`SELECT tablename AS "tableName", policyname AS "policyName",
      cmd AS command, permissive, roles::text[] AS roles, qual, with_check AS "withCheck"
      FROM pg_policies WHERE schemaname='rh_source' AND tablename=ANY(${tables}::text[])`;
    const constraints = await db.$queryRaw`SELECT t.relname AS "tableName", pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='rh_source' AND t.relname=ANY(${tables}::text[]) AND c.contype IN ('f','u')`;
    assertRegistryCatalog({ policies, constraints });
    const receipt = [];
    for (const source of sources) {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
        ${ids.tenant + ':lingshu-xinyu:' + source.documentId}, 0))`;
      const [version] = await db.$queryRaw`SELECT v.id, v.version_number AS version, v.content_sha256 AS sha,
          p.content_bytes AS bytes FROM rh_source.external_document_version v
        JOIN rh_source.external_document_payload p ON p.tenant_id=v.tenant_id AND p.hub_key=v.hub_key AND p.version_id=v.id
        WHERE v.tenant_id=${ids.tenant} AND v.hub_key='lingshu-xinyu' AND v.document_id=${source.documentId}
        ORDER BY v.version_number DESC LIMIT 1`;
      if (!version || version.version !== 1 || version.sha !== source.expectedSha256 ||
        createHash('sha256').update(version.bytes).digest('hex') !== source.expectedSha256) throw new Error('HUB_REGISTRY_SOURCE_DRIFT');
      const payloadSha256 = registryDetailHash(source.details);
      const extractionId = 'rhce-' + createHash('sha256').update(version.id + ':' + payloadSha256).digest('hex').slice(0, 40);
      const before = await db.$queryRaw`SELECT id, payload, source_sha256 AS sha FROM rh_source.clinical_registry_extraction
        WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu' AND version_id=${version.id}
        ORDER BY extraction_version DESC LIMIT 1`;
      if (before.length && (before[0].id !== extractionId || registryDetailHash(before[0].payload) !== payloadSha256 ||
        before[0].sha !== version.sha)) throw new Error('HUB_REGISTRY_EXTRACTION_DRIFT');
      if (!before.length) await db.$executeRaw`INSERT INTO rh_source.clinical_registry_extraction
        (id,tenant_id,hub_key,version_id,extraction_version,source_sha256,extractor_version,payload,payload_sha256,imported_by)
        VALUES (${extractionId},${ids.tenant},'lingshu-xinyu',${version.id},1,${version.sha},'chictr-mhtml-v1',
          ${JSON.stringify(source.details)}::jsonb,${payloadSha256},'codex-user-request-registry-details-2026-10-31')`;
      receipt.push({ documentId: source.documentId, registrationNumber: source.externalKey, extractionId, payloadSha256,
        inserted: !before.length, arms: source.details.arms.length, outcomes: source.details.outcomes.length });
    }
    return { databaseName: target.databaseName, items: receipt };
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') throw new Error('Usage: node scripts/hub-registry-details-import.mjs --apply');
  importRegistryDetails().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
    .catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}
