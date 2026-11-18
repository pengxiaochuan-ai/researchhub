import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { verifiedInitialFiles } from '../server/hub-sources/initial-five.mjs';
import { buildInitialRows } from './hub-initial-five-import.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function verifyInitialFive() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_INITIAL_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const rows = buildInitialRows({ tenantId: ids.tenant, hubKey: 'lingshu-xinyu',
    documents: verifiedInitialFiles() });
  const direct = await withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const documents = await tx.$queryRaw`
      SELECT d.id, d.external_key AS "externalKey", d.document_type AS "documentType",
             d.source_target_condition AS "targetCondition", d.hub_topic AS "hubTopic",
             d.selection_status AS "selectionStatus", v.id AS "versionId",
             v.content_sha256 AS sha256, p.content_bytes AS bytes
      FROM rh_source.external_document d
      JOIN rh_source.external_document_version v
        ON v.tenant_id = d.tenant_id AND v.hub_key = d.hub_key AND v.document_id = d.id
      JOIN rh_source.external_document_payload p
        ON p.tenant_id = v.tenant_id AND p.hub_key = v.hub_key AND p.version_id = v.id
      WHERE d.tenant_id = ${ids.tenant} AND d.hub_key = 'lingshu-xinyu'
        AND d.selection_basis = 'user-selected-initial-data-2026-10-30'`;
    if (documents.length !== 5) throw new Error('HUB_INITIAL_COUNT_MISMATCH');
    for (const expected of rows) {
      const actual = documents.find(item => item.id === expected.documentId);
      if (!actual || actual.externalKey !== expected.externalKey ||
          actual.documentType !== expected.documentType || actual.targetCondition !== expected.sourceTargetCondition ||
          actual.hubTopic !== expected.hubTopic || actual.selectionStatus !== 'accepted_for_initial_dataset' ||
          actual.versionId !== expected.versionId || actual.sha256 !== expected.sha256 ||
          sha256(actual.bytes) !== expected.sha256) throw new Error('HUB_INITIAL_CONTENT_MISMATCH');
    }
    const decisions = await tx.$queryRaw`
      SELECT r.version_id AS "versionId", r.reviewer_id AS "reviewerId",
             r.evidence_ref AS "evidenceRef" FROM rh_source.external_review_decision r
      JOIN rh_source.external_document_version v
        ON v.tenant_id = r.tenant_id AND v.hub_key = r.hub_key AND v.id = r.version_id
      JOIN rh_source.external_document d
        ON d.tenant_id = v.tenant_id AND d.hub_key = v.hub_key AND d.id = v.document_id
      WHERE d.tenant_id = ${ids.tenant} AND d.hub_key = 'lingshu-xinyu'
        AND d.selection_basis = 'user-selected-initial-data-2026-10-30'`;
    const versionIds = new Set(rows.map(row => row.versionId));
    if (decisions.some(item => !versionIds.has(item.versionId) || item.reviewerId !== ids.admin ||
        !item.evidenceRef.startsWith('https://')))
      throw new Error('HUB_INITIAL_REVIEW_SCOPE_MISMATCH');
    return { documents: documents.length, versions: documents.length,
      payloads: documents.length, reviewDecisions: decisions.length };
  }, { readOnly: true });
  const app = await withFixtureTransaction(env, 'app', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    const own = await tx.$queryRaw`
      SELECT COUNT(*)::integer AS count FROM rh_source.external_document
      WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
        AND selection_basis = 'user-selected-initial-data-2026-10-30'`;
    const permission = await tx.$queryRaw`
      SELECT has_table_privilege(current_user, 'rh_source.external_document_payload', 'SELECT') AS readable,
             has_table_privilege(current_user, 'rh_source.external_review_decision', 'INSERT') AS review_writable`;
    await tx.$executeRaw`SELECT set_config('app.tenant_id', 'unrelated-synthetic-tenant', true)`;
    const other = await tx.$queryRaw`
      SELECT COUNT(*)::integer AS count FROM rh_source.external_document
      WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'`;
    if (own[0]?.count !== 5 || permission[0]?.readable !== false ||
        permission[0]?.review_writable !== true || other[0]?.count !== 0)
      throw new Error('HUB_INITIAL_APP_BOUNDARY_FAILED');
    return { ownRows: own[0].count, crossTenantRows: other[0].count,
      payloadReadable: permission[0].readable, reviewWritable: permission[0].review_writable };
  }, { readOnly: true });
  return { databaseName: target.databaseName, ...direct, ...app };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
    process.stderr.write('Usage: node scripts/hub-initial-five-verify.mjs --verify\n');
    process.exitCode = 2;
  } else {
    verifyInitialFive().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
