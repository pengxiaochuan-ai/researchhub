import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { initialDocumentId, verifiedInitialFiles } from '../server/hub-sources/initial-five.mjs';
import { applyExternalSchema, assertExternalAdmission } from './hub-external-schema.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const idFor = (prefix, parts) => prefix + createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 40);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const importedBy = 'codex-local-user-provided-seed-2026-10-30';
const selectionBasis = 'user-selected-initial-data-2026-10-30';
export const sameMetadata = (expected, actual) => isDeepStrictEqual(expected, actual);
export const sameSourceProvenance = (expected, actual) =>
  expected.sourceName === actual?.sourceName && expected.sourceUrl === actual?.sourceUrl;
const dateOnly = value => value instanceof Date ? value.toISOString().slice(0, 10) : value;
export const sameVersionProvenance = (expected, actual) =>
  expected.documentId === actual?.documentId && expected.versionNumber === actual?.versionNumber &&
  expected.sha256 === actual?.sha256 && expected.fileName === actual?.fileName &&
  expected.mimeType === actual?.mimeType && expected.sourceUrl === actual?.sourceUrl &&
  dateOnly(expected.sourceUpdatedOn) === dateOnly(actual?.sourceUpdatedOn) &&
  expected.importedBy === actual?.importedBy && sameMetadata(expected.metadata, actual?.metadata);

export function buildInitialRows({ tenantId, hubKey, documents }) {
  if (!tenantId || !hubKey || !Array.isArray(documents) || documents.length !== 5)
    throw new Error('HUB_INITIAL_MANIFEST_REJECTED');
  return documents.map(item => {
    const sourceId = idFor('rhss-', [tenantId, hubKey, item.sourceKey]);
    const documentId = initialDocumentId(tenantId, hubKey, item);
    return { ...item, sourceId, documentId,
      versionId: idFor('rhev-', [documentId, item.sha256]) };
  });
}

export async function importInitialFive() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_INITIAL_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const rows = buildInitialRows({ tenantId: ids.tenant, hubKey: 'lingshu-xinyu',
    documents: verifiedInitialFiles() });
  await applyExternalSchema();
  return withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await assertExternalAdmission(tx, target, ids);
    let inserted = 0;
    for (const item of rows) {
      // Every supported version writer shares this document lock with review submission.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
        ${ids.tenant + ':lingshu-xinyu:' + item.documentId}, 0))`;
      await tx.$executeRaw`
        INSERT INTO rh_source.source_registry
          (id, tenant_id, hub_key, source_key, source_name, source_url)
        VALUES (${item.sourceId}, ${ids.tenant}, 'lingshu-xinyu', ${item.sourceKey},
                ${item.sourceName}, ${item.sourceRegistryUrl})
        ON CONFLICT (tenant_id, hub_key, source_key) DO NOTHING`;
      const source = await tx.$queryRaw`
        SELECT id, source_name AS "sourceName", source_url AS "sourceUrl" FROM rh_source.source_registry
        WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
          AND source_key = ${item.sourceKey}`;
      if (source[0]?.id !== item.sourceId || !sameSourceProvenance({
        sourceName: item.sourceName, sourceUrl: item.sourceRegistryUrl }, source[0]))
        throw new Error('HUB_INITIAL_SOURCE_CONFLICT');

      const previous = await tx.$queryRaw`
        SELECT id FROM rh_source.external_document
        WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
          AND id = ${item.documentId}`;
      await tx.$executeRaw`
        INSERT INTO rh_source.external_document
          (id, tenant_id, hub_key, source_registry_id, document_type, external_key,
           title, source_target_condition, hub_topic, selection_status, selection_basis)
        VALUES (${item.documentId}, ${ids.tenant}, 'lingshu-xinyu', ${item.sourceId},
                ${item.documentType}, ${item.externalKey}, ${item.title},
                ${item.sourceTargetCondition}, ${item.hubTopic}, ${item.selectionStatus},
                ${selectionBasis})
        ON CONFLICT (id) DO NOTHING`;
      const document = await tx.$queryRaw`
        SELECT source_registry_id AS "sourceId", document_type AS "documentType",
               external_key AS "externalKey", title, source_target_condition AS "targetCondition",
               hub_topic AS "hubTopic", selection_status AS "selectionStatus",
               selection_basis AS "selectionBasis"
        FROM rh_source.external_document
        WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
          AND id = ${item.documentId}`;
      if (document[0]?.sourceId !== item.sourceId || document[0]?.documentType !== item.documentType ||
          document[0]?.externalKey !== item.externalKey || document[0]?.title !== item.title ||
          document[0]?.targetCondition !== item.sourceTargetCondition ||
          document[0]?.hubTopic !== item.hubTopic || document[0]?.selectionStatus !== item.selectionStatus ||
          document[0]?.selectionBasis !== selectionBasis)
        throw new Error('HUB_INITIAL_DOCUMENT_CONFLICT');

      await tx.$executeRaw`
        INSERT INTO rh_source.external_document_version
          (id, tenant_id, hub_key, document_id, version_number, file_name, mime_type,
           content_sha256, source_url, source_updated_on, metadata, imported_by)
        VALUES (${item.versionId}, ${ids.tenant}, 'lingshu-xinyu', ${item.documentId}, 1,
                ${item.fileName}, ${item.mimeType}, ${item.sha256}, ${item.sourceUrl},
                ${item.sourceUpdatedOn}::date, ${JSON.stringify(item.metadata)}::jsonb,
                ${importedBy})
        ON CONFLICT (id) DO NOTHING`;
      const version = await tx.$queryRaw`
        SELECT document_id AS "documentId", version_number AS "versionNumber",
               content_sha256 AS sha256, file_name AS "fileName", mime_type AS "mimeType",
               source_url AS "sourceUrl", source_updated_on AS "sourceUpdatedOn",
               imported_by AS "importedBy", metadata
        FROM rh_source.external_document_version
        WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
          AND id = ${item.versionId}`;
      if (!sameVersionProvenance({ documentId: item.documentId, versionNumber: 1,
        sha256: item.sha256, fileName: item.fileName, mimeType: item.mimeType,
        sourceUrl: item.sourceUrl, sourceUpdatedOn: item.sourceUpdatedOn,
        importedBy, metadata: item.metadata }, version[0]))
        throw new Error('HUB_INITIAL_VERSION_CONFLICT');

      await tx.$executeRaw`
        INSERT INTO rh_source.external_document_payload
          (version_id, tenant_id, hub_key, byte_count, content_bytes)
        VALUES (${item.versionId}, ${ids.tenant}, 'lingshu-xinyu',
                ${item.bytes.length}, ${item.bytes})
        ON CONFLICT (version_id) DO NOTHING`;
      const payload = await tx.$queryRaw`
        SELECT byte_count AS "byteCount", content_bytes AS bytes
        FROM rh_source.external_document_payload
        WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
          AND version_id = ${item.versionId}`;
      if (payload[0]?.byteCount !== item.bytes.length || hash(payload[0]?.bytes || Buffer.alloc(0)) !== item.sha256)
        throw new Error('HUB_INITIAL_PAYLOAD_CONFLICT');
      if (previous.length === 0) inserted += 1;
    }
    const decisions = await tx.$queryRaw`
      SELECT COUNT(*)::integer AS count FROM rh_source.external_review_decision
      WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
        AND version_id = ANY(${rows.map(row => row.versionId)}::text[])`;
    return { databaseName: target.databaseName, hubKey: 'lingshu-xinyu',
      documents: rows.length, inserted, rawPayloads: rows.length, reviewDecisions: decisions[0].count };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/hub-initial-five-import.mjs --apply\n');
    process.exitCode = 2;
  } else {
    importInitialFive().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
