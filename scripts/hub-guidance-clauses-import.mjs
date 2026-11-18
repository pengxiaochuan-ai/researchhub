import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertExternalAdmission } from './hub-external-schema.mjs';
import { splitSchemaStatements } from './hub-source-schema.mjs';
import { initialDocumentId, verifiedInitialFiles } from '../server/hub-sources/initial-five.mjs';
import { guidancePayload, guidanceHash, validateGuidancePayload } from '../server/hub-sources/guidance-clause-contract.mjs';
import { assertGuidanceCatalog } from '../server/hub-sources/guidance-clause-schema-contract.mjs';

const config = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtime = new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url);
const tables = ['guidance_clause_extraction', 'guidance_clause_review'];
export async function importGuidanceClauses() {
  const { env } = loadFixtureInput(config), target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_GUIDANCE_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtime, 'utf8'));
  const sources = verifiedInitialFiles().filter(s => s.mimeType === 'application/pdf');
  if (sources.length !== 3) throw new Error('HUB_GUIDANCE_MANIFEST_REJECTED');
  return withFixtureTransaction(env, 'direct', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await assertExternalAdmission(db, target, ids);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('rh-guidance-clause-schema-v1', 0))`;
    const existing = await db.$queryRaw`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='rh_source' AND c.relkind='r' AND c.relname=ANY(${tables}::text[])`;
    if (existing.length && existing.length !== 2) throw new Error('HUB_GUIDANCE_SCHEMA_PARTIAL');
    if (!existing.length) for (const sql of splitSchemaStatements(readFileSync(new URL('../server/hub-sources/guidance-clause-schema.sql', import.meta.url), 'utf8')))
      await db.$executeRawUnsafe(sql);
    const guards = await db.$queryRaw`SELECT c.relname,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,
      has_table_privilege('aisci_app',c.oid,'SELECT') AS readable,
      has_any_column_privilege('aisci_app',c.oid,'UPDATE') AS editable,
      has_table_privilege('aisci_app',c.oid,'DELETE') AS deletable,
      has_any_column_privilege('aisci_app',c.oid,'INSERT') AS insertable
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_source'
      AND c.relkind='r' AND c.relname=ANY(${tables}::text[])`;
    if (guards.length !== 2 || guards.some(r => !r.rls || !r.forced || !r.readable || r.editable || r.deletable ||
      r.insertable !== (r.relname === 'guidance_clause_review'))) throw new Error('HUB_GUIDANCE_SCHEMA_DRIFT');
    const policies = await db.$queryRaw`SELECT tablename AS "tableName",policyname AS "policyName",cmd AS command,
      permissive,roles::text[] AS roles,qual,with_check AS "withCheck" FROM pg_policies
      WHERE schemaname='rh_source' AND tablename=ANY(${tables}::text[])`;
    const constraints = await db.$queryRaw`SELECT t.relname AS "tableName",pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='rh_source' AND t.relname=ANY(${tables}::text[]) AND c.contype IN ('f','u')`;
    assertGuidanceCatalog({ policies, constraints });
    const items = [];
    for (const source of sources) {
      const documentId = initialDocumentId(ids.tenant, 'lingshu-xinyu', source);
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ids.tenant + ':lingshu-xinyu:' + documentId},0))`;
      const [version] = await db.$queryRaw`SELECT v.id,v.version_number AS version,v.content_sha256 AS sha,p.content_bytes AS bytes
        FROM rh_source.external_document_version v JOIN rh_source.external_document_payload p
        ON p.tenant_id=v.tenant_id AND p.hub_key=v.hub_key AND p.version_id=v.id
        WHERE v.tenant_id=${ids.tenant} AND v.hub_key='lingshu-xinyu' AND v.document_id=${documentId}
        ORDER BY v.version_number DESC LIMIT 1`;
      if (!version || version.version !== 1 || version.sha !== source.expectedSha256 ||
        createHash('sha256').update(version.bytes).digest('hex') !== source.expectedSha256) throw new Error('HUB_GUIDANCE_SOURCE_DRIFT');
      const payload = validateGuidancePayload(guidancePayload(source.externalKey), source), payloadSha256 = guidanceHash(payload);
      const extractionId = 'rhge-' + createHash('sha256').update(version.id + ':' + payloadSha256).digest('hex').slice(0, 40);
      const [prior] = await db.$queryRaw`SELECT id,payload,payload_sha256 AS hash,source_sha256 AS sha FROM rh_source.guidance_clause_extraction
        WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu' AND version_id=${version.id}
        ORDER BY extraction_version DESC LIMIT 1`;
      if (prior && (prior.id !== extractionId || prior.sha !== version.sha || prior.hash !== payloadSha256 ||
        guidanceHash(prior.payload) !== payloadSha256)) throw new Error('HUB_GUIDANCE_EXTRACTION_DRIFT');
      if (!prior) await db.$executeRaw`INSERT INTO rh_source.guidance_clause_extraction
        (id,tenant_id,hub_key,version_id,extraction_version,source_sha256,extractor_version,payload,payload_sha256,imported_by)
        VALUES (${extractionId},${ids.tenant},'lingshu-xinyu',${version.id},1,${version.sha},'pdf-ocr-visual-v1',
          ${JSON.stringify(payload)}::jsonb,${payloadSha256},'codex-local-pdf-source-recheck-2026-10-31')`;
      items.push({ documentId, externalKey: source.externalKey, extractionId, payloadSha256, clauses: payload.clauses.length, inserted: !prior });
    }
    return { databaseName: target.databaseName, items };
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') throw new Error('Use --apply');
  importGuidanceClauses().then(r => console.log(JSON.stringify(r)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
