import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialFive, isInitialExternalDocument, verifiedInitialFiles } from '../server/hub-sources/initial-five.mjs';
import { splitSchemaStatements } from './hub-source-schema.mjs';
import { buildInitialRows, sameMetadata, sameSourceProvenance, sameVersionProvenance } from './hub-initial-five-import.mjs';
import { assertExternalCatalogShape, expectedExternalCatalog } from './hub-external-schema.mjs';

test('five selected sources retain original disease separately from Hub inclusion', () => {
  assert.equal(initialFive.length, 5);
  assert.equal(new Set(initialFive.map(item => item.externalKey)).size, 5);
  const cognitive = initialFive.find(item => item.externalKey === 'ChiCTR2300077209');
  assert.equal(cognitive.sourceTargetCondition, '轻度认知障碍');
  assert.equal(cognitive.hubTopic, '情志病相关');
  assert.equal(cognitive.selectionStatus, 'accepted_for_initial_dataset');
  assert.equal(initialFive.filter(item => item.documentType === 'clinical_registry').length, 2);
  assert.equal(initialFive.filter(item => item.documentType === 'research_standard').length, 2);
  assert.equal(initialFive.filter(item => item.documentType === 'clinical_guideline').length, 1);
  assert.ok(initialFive.every(item => !JSON.stringify(item.metadata).match(/@|电话|邮箱|手机号/)));
  assert.equal(new Set(initialFive.filter(item => item.sourceKey === 'chictr')
    .map(item => item.sourceRegistryUrl)).size, 1);
});

test('local source bytes match the reviewed five-file manifest', () => {
  const files = verifiedInitialFiles();
  assert.equal(files.length, 5);
  assert.ok(files.every(item => item.bytes.length > 0 && item.sha256 === item.expectedSha256));
});

test('review scope admits exactly the five pinned source identities', () => {
  const tenantId = 'synthetic-tenant', hubKey = 'lingshu-xinyu';
  const rows = buildInitialRows({ tenantId, hubKey, documents: verifiedInitialFiles() });
  for (const item of rows) assert.equal(isInitialExternalDocument({ id: item.documentId, ...item }, tenantId, hubKey), true);
  assert.equal(isInitialExternalDocument({ id: 'sixth', documentType: 'clinical_registry', externalKey: 'ChiCTR-EXTRA' }, tenantId, hubKey), false);
  assert.equal(isInitialExternalDocument({ id: 'replacement', documentType: rows[0].documentType,
    externalKey: rows[0].externalKey }, tenantId, hubKey), false);
  assert.equal(isInitialExternalDocument({ id: rows[0].documentId, documentType: 'research_standard',
    externalKey: rows[0].externalKey }, tenantId, hubKey), false);
});

test('additive schema forces tenant RLS and withholds original payload from app role', () => {
  const sql = readFileSync(new URL('../server/hub-sources/external-schema.sql', import.meta.url), 'utf8');
  const tables = ['external_document', 'external_document_version',
    'external_document_payload', 'external_review_decision'];
  for (const name of tables) {
    assert.match(sql, new RegExp(`CREATE TABLE rh_source\\.${name}\\b`, 'i'));
    assert.match(sql, new RegExp(`ALTER TABLE rh_source\\.${name} FORCE ROW LEVEL SECURITY`, 'i'));
  }
  assert.doesNotMatch(sql, /GRANT\s+SELECT\s+ON\s+rh_source\.external_document_payload\s+TO\s+aisci_app/i);
  assert.match(sql, /GRANT\s+INSERT\s+ON\s+rh_source\.external_review_decision\s+TO\s+aisci_app/i);
  assert.doesNotMatch(sql, /(?:DROP|TRUNCATE|DELETE|UPDATE)\s+(?:TABLE\s+)?(?:public|rh_source)\./i);
  assert.ok(splitSchemaStatements(sql).length >= 15);
});

test('schema admission casts PostgreSQL regclass before Prisma deserializes it', () => {
  const script = readFileSync(new URL('./hub-external-schema.mjs', import.meta.url), 'utf8');
  assert.match(script, /to_regclass\('rh_source\.source_registry'\)::text/i);
});

test('initial row keys are deterministic and carry no approval event', () => {
  const input = { tenantId: 'synthetic-tenant', hubKey: 'lingshu-xinyu', documents: verifiedInitialFiles() };
  const first = buildInitialRows(input);
  const second = buildInitialRows(input);
  assert.deepEqual(first.map(row => [row.sourceId, row.documentId, row.versionId]),
    second.map(row => [row.sourceId, row.documentId, row.versionId]));
  assert.equal(new Set(first.map(row => row.documentId)).size, 5);
  assert.ok(first.every(row => row.selectionStatus === 'accepted_for_initial_dataset'));
  assert.ok(first.every(row => !Object.hasOwn(row, 'reviewerId') && !Object.hasOwn(row, 'rightsApproved')));
});

test('PostgreSQL jsonb key ordering does not make an unchanged source version conflict', () => {
  const expected = { registrationNumber: 'ChiCTR2300077209', originalTargetDisease: '轻度认知障碍' };
  const fromJsonb = { originalTargetDisease: '轻度认知障碍', registrationNumber: 'ChiCTR2300077209' };
  assert.equal(sameMetadata(expected, fromJsonb), true);
  assert.equal(sameMetadata(expected, { ...fromJsonb, originalTargetDisease: '抑郁症' }), false);
});

test('reimport refuses drift in source and immutable version provenance', () => {
  const source = { sourceName: '中国临床试验注册中心', sourceUrl: 'https://example.org/a' };
  assert.equal(sameSourceProvenance(source, { ...source }), true);
  assert.equal(sameSourceProvenance(source, { ...source, sourceUrl: 'https://example.org/b' }), false);
  const version = { documentId: 'doc', versionNumber: 1, sha256: 'a'.repeat(64),
    fileName: 'a.pdf', mimeType: 'application/pdf', sourceUrl: 'https://example.org/a',
    sourceUpdatedOn: '2024-01-02', importedBy: 'local-seed', metadata: { a: 1, b: 2 } };
  assert.equal(sameVersionProvenance(version, { ...version, sourceUpdatedOn: new Date('2024-01-02T00:00:00Z'),
    metadata: { b: 2, a: 1 } }), true);
  for (const field of ['versionNumber', 'sourceUrl', 'sourceUpdatedOn', 'importedBy']) {
    const drift = { ...version, [field]: field === 'versionNumber' ? 2 : null };
    assert.equal(sameVersionProvenance(version, drift), false, field);
  }
});

test('existing same-name tables fail closed on column, constraint or tenant policy drift', () => {
  const catalog = structuredClone(expectedExternalCatalog);
  assert.doesNotThrow(() => assertExternalCatalogShape(catalog));
  for (const key of ['columns', 'constraints', 'policies']) {
    const drift = structuredClone(catalog);
    drift[key].pop();
    assert.throws(() => assertExternalCatalogShape(drift), /HUB_INITIAL_SCHEMA_DRIFT/, key);
  }
  const drift = structuredClone(catalog);
  drift.privileges[0].canInsert = true;
  assert.throws(() => assertExternalCatalogShape(drift), /HUB_INITIAL_SCHEMA_DRIFT/);
  const columnGrant = structuredClone(catalog);
  columnGrant.privileges.find(row => row.tableName === 'external_document_payload').columnSelect = true;
  assert.throws(() => assertExternalCatalogShape(columnGrant), /HUB_INITIAL_SCHEMA_DRIFT/);
  const script = readFileSync(new URL('./hub-external-schema.mjs', import.meta.url), 'utf8');
  assert.match(script, /has_any_column_privilege\('aisci_app', t\.oid, 'SELECT'\)/);
  assert.match(script, /has_any_column_privilege\('aisci_app', t\.oid, 'UPDATE'\)/);
});
