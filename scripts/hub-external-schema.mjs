import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget, withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { assertHubSourceAdmission } from './hub-source-admission.mjs';
import { splitSchemaStatements } from './hub-source-schema.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../server/hub-sources/external-schema.sql', import.meta.url));
const tables = ['external_document', 'external_document_version',
  'external_document_payload', 'external_review_decision'];

const columnSpecs = {
  external_document: ['id:text', 'tenant_id:text', 'hub_key:text', 'source_registry_id:text',
    'document_type:text', 'external_key:text', 'title:text', 'source_target_condition:text?',
    'hub_topic:text', 'selection_status:text', 'selection_basis:text',
    'created_at:timestamp with time zone'],
  external_document_version: ['id:text', 'tenant_id:text', 'hub_key:text', 'document_id:text',
    'version_number:integer', 'file_name:text', 'mime_type:text', 'content_sha256:character(64)',
    'source_url:text?', 'source_updated_on:date?', 'metadata:jsonb', 'imported_by:text',
    'imported_at:timestamp with time zone'],
  external_document_payload: ['version_id:text', 'tenant_id:text', 'hub_key:text',
    'byte_count:integer', 'content_bytes:bytea'],
  external_review_decision: ['decision_version:bigint', 'tenant_id:text', 'hub_key:text',
    'version_id:text', 'field_kind:text', 'purpose:text', 'audience:text', 'decision:text',
    'evidence_ref:text', 'reviewer_id:text', 'expires_at:timestamp with time zone?',
    'created_at:timestamp with time zone'],
};
const constraintSpecs = {
  external_document: [
    'PRIMARY KEY (id)', 'UNIQUE (tenant_id, hub_key, id)',
    'UNIQUE (tenant_id, hub_key, document_type, external_key)',
    'FOREIGN KEY (tenant_id, hub_key, source_registry_id) REFERENCES rh_source.source_registry(tenant_id, hub_key, id)',
    "CHECK ((document_type = ANY (ARRAY['clinical_registry'::text, 'research_standard'::text, 'clinical_guideline'::text])))",
    'CHECK ((length(TRIM(BOTH FROM external_key)) > 0))',
    'CHECK ((length(TRIM(BOTH FROM title)) > 0))',
    "CHECK ((selection_status = 'accepted_for_initial_dataset'::text))",
  ],
  external_document_version: [
    'PRIMARY KEY (id)', 'UNIQUE (tenant_id, hub_key, id)',
    'UNIQUE (tenant_id, hub_key, document_id, version_number)',
    'UNIQUE (tenant_id, hub_key, document_id, content_sha256)',
    'FOREIGN KEY (tenant_id, hub_key, document_id) REFERENCES rh_source.external_document(tenant_id, hub_key, id)',
    'CHECK ((version_number > 0))',
    "CHECK ((mime_type = ANY (ARRAY['multipart/related'::text, 'application/pdf'::text])))",
    "CHECK ((content_sha256 ~ '^[0-9a-f]{64}$'::text))",
    "CHECK ((jsonb_typeof(metadata) = 'object'::text))",
  ],
  external_document_payload: [
    'PRIMARY KEY (version_id)',
    'FOREIGN KEY (tenant_id, hub_key, version_id) REFERENCES rh_source.external_document_version(tenant_id, hub_key, id)',
    'CHECK (((byte_count > 0) AND (byte_count <= 8388608)))',
    'CHECK ((byte_count = octet_length(content_bytes)))',
  ],
  external_review_decision: [
    'PRIMARY KEY (decision_version)',
    'FOREIGN KEY (tenant_id, hub_key, version_id) REFERENCES rh_source.external_document_version(tenant_id, hub_key, id)',
    "CHECK ((field_kind = ANY (ARRAY['bibliographic'::text, 'abstract'::text, 'fulltext'::text])))",
    "CHECK ((purpose = ANY (ARRAY['display'::text, 'ai_retrieval'::text])))",
    "CHECK ((audience = ANY (ARRAY['tenant'::text, 'public'::text])))",
    "CHECK ((decision = ANY (ARRAY['approve'::text, 'revoke'::text])))",
    'CHECK ((length(TRIM(BOTH FROM evidence_ref)) > 0))',
    'CHECK ((length(TRIM(BOTH FROM reviewer_id)) > 0))',
  ],
};
const tenantPolicy = "(tenant_id = current_setting('app.tenant_id'::text, true))";
export const expectedExternalCatalog = {
  columns: Object.entries(columnSpecs).flatMap(([tableName, specs]) => specs.map(spec => {
    const [columnName, encodedType] = spec.split(':');
    return { tableName, columnName, type: encodedType.replace(/\?$/, ''),
      notNull: !encodedType.endsWith('?') };
  })),
  constraints: Object.entries(constraintSpecs).flatMap(([tableName, definitions]) =>
    definitions.map(definition => ({ tableName, definition }))),
  policies: tables.map(tableName => ({ tableName, policyName: 'tenant_rows',
    qual: tenantPolicy, withCheck: tenantPolicy })),
  privileges: tables.map(tableName => ({ tableName,
    canSelect: tableName !== 'external_document_payload',
    columnSelect: tableName !== 'external_document_payload',
    canInsert: tableName === 'external_review_decision',
    columnInsert: tableName === 'external_review_decision',
    canUpdate: false, columnUpdate: false, canDelete: false })),
};

export function assertExternalCatalogShape(actual) {
  for (const key of ['columns', 'constraints', 'policies', 'privileges']) {
    const expected = expectedExternalCatalog[key].map(row => JSON.stringify(row)).sort();
    const observed = actual[key]?.map(row => JSON.stringify(row)).sort();
    if (!observed || !isSameArray(expected, observed)) throw new Error(`HUB_INITIAL_SCHEMA_DRIFT:${key}`);
  }
}

const isSameArray = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export async function assertExternalAdmission(tx, target, ids) {
  const [tenant, admin] = await Promise.all([
    tx.tenant.findUnique({ where: { id: ids.tenant }, select: { id: true, status: true } }),
    tx.account.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, status: true } }),
  ]);
  const grant = await tx.$queryRaw`
    SELECT tenant_id AS "tenantId", hub_key AS "hubKey", account_id AS "accountId",
           capability, decision FROM rh_source.review_grant_event
    WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu'
      AND account_id = ${ids.admin} AND capability = 'source.review'
    ORDER BY event_version DESC LIMIT 1`;
  assertHubSourceAdmission({ target: { ...target, syntheticOnly: true }, tenant, admin,
    hubGrant: grant[0] && { ...grant[0], status: grant[0].decision === 'grant' ? 'active' : 'revoked' } },
  { databaseName: target.databaseName, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', adminId: ids.admin });
  const hub = await tx.$queryRaw`
    SELECT status FROM rh_hub.hub WHERE tenant_id = ${ids.tenant} AND hub_key = 'lingshu-xinyu' LIMIT 1`;
  if (hub[0]?.status !== 'active') throw new Error('HUB_INITIAL_HUB_MISSING');
}

export async function applyExternalSchema() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_INITIAL_TARGET_REJECTED');
  const { ids } = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const statements = splitSchemaStatements(readFileSync(schemaPath, 'utf8'));
  if (statements.length < 15 || statements.some(statement =>
    /\b(?:DROP|TRUNCATE|DELETE|UPDATE)\b/i.test(statement) || /\b(?:public|wp01_meta)\./i.test(statement)))
    throw new Error('HUB_INITIAL_SCHEMA_REJECTED');
  return withFixtureTransaction(env, 'direct', async tx => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await assertExternalAdmission(tx, target, ids);
    const base = await tx.$queryRawUnsafe("SELECT to_regclass('rh_source.source_registry')::text AS source");
    if (!base[0]?.source) throw new Error('HUB_INITIAL_SOURCE_SCHEMA_MISSING');
    const before = await tx.$queryRaw`
      SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'rh_source' AND c.relkind = 'r'
        AND relname = ANY(ARRAY['external_document','external_document_version',
                                'external_document_payload','external_review_decision'])`;
    if (before.length !== 0 && before.length !== tables.length) throw new Error('HUB_INITIAL_SCHEMA_PARTIAL');
    if (before.length === 0) for (const statement of statements) await tx.$executeRawUnsafe(statement);
    // Tighten a previously installed synthetic copy as well as fresh installs.
    await tx.$executeRawUnsafe('GRANT INSERT ON rh_source.external_review_decision TO aisci_app');
    await tx.$executeRawUnsafe('GRANT USAGE ON SEQUENCE rh_source.external_review_decision_decision_version_seq TO aisci_app');
    const checked = await tx.$queryRaw`
      SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'rh_source' AND c.relkind = 'r'
        AND relname = ANY(ARRAY['external_document','external_document_version',
                                'external_document_payload','external_review_decision'])`;
    if (checked.length !== tables.length || checked.some(row => !row.rls || !row.forced))
      throw new Error('HUB_INITIAL_SCHEMA_INCOMPLETE');
    const columns = await tx.$queryRaw`
      SELECT t.relname AS "tableName", a.attname AS "columnName",
             format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS "notNull"
      FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE n.nspname = 'rh_source' AND t.relkind = 'r'
        AND t.relname = ANY(ARRAY['external_document','external_document_version',
                                   'external_document_payload','external_review_decision'])`;
    const constraints = await tx.$queryRaw`
      SELECT t.relname AS "tableName", pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'rh_source' AND t.relname = ANY(ARRAY[
        'external_document','external_document_version','external_document_payload','external_review_decision'])`;
    const policies = await tx.$queryRaw`
      SELECT tablename AS "tableName", policyname AS "policyName",
             qual, with_check AS "withCheck" FROM pg_policies
      WHERE schemaname = 'rh_source' AND tablename = ANY(ARRAY[
        'external_document','external_document_version','external_document_payload','external_review_decision'])`;
    const privileges = await tx.$queryRaw`
      SELECT t.relname AS "tableName",
             has_table_privilege('aisci_app', t.oid, 'SELECT') AS "canSelect",
             has_any_column_privilege('aisci_app', t.oid, 'SELECT') AS "columnSelect",
             has_table_privilege('aisci_app', t.oid, 'INSERT') AS "canInsert",
             has_any_column_privilege('aisci_app', t.oid, 'INSERT') AS "columnInsert",
             has_table_privilege('aisci_app', t.oid, 'UPDATE') AS "canUpdate",
             has_any_column_privilege('aisci_app', t.oid, 'UPDATE') AS "columnUpdate",
             has_table_privilege('aisci_app', t.oid, 'DELETE') AS "canDelete"
      FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'rh_source' AND t.relkind = 'r' AND t.relname = ANY(ARRAY[
        'external_document','external_document_version','external_document_payload','external_review_decision'])`;
    assertExternalCatalogShape({ columns, constraints, policies, privileges });
    return { databaseName: target.databaseName, tenantId: ids.tenant,
      created: before.length === 0, tables: checked.map(row => row.relname).sort() };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/hub-external-schema.mjs --apply\n');
    process.exitCode = 2;
  } else {
    applyExternalSchema().then(result => process.stdout.write(JSON.stringify(result) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
