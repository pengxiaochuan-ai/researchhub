import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const text = value => value == null ? null : String(value).trim() || null;
const field = (raw, prefix) => Object.entries(raw).find(([key]) => key.startsWith(prefix))?.[1];
const chunks = (items, size = 600) => Array.from({ length: Math.ceil(items.length / size) },
  (_, index) => items.slice(index * size, (index + 1) * size));

export async function stageBatch({ db, tenantId, hubKey, preview, source }) {
  if (!db || !tenantId || !hubKey || !source?.createdBy || !source?.snapshotPath ||
      !/^[a-f0-9]{64}$/.test(preview?.fileSha256 || '') ||
      source.snapshotSha256 !== preview.fileSha256) throw new Error('HUB_SOURCE_SNAPSHOT_MISMATCH');
  if (!preview.sheetName || !preview.mapperVersion || !preview.sourceKey || !Array.isArray(preview.rows))
    throw new Error('HUB_SOURCE_PREVIEW_REJECTED');
  const context = await db.$queryRawUnsafe("SELECT current_setting('app.tenant_id', true) AS tenant");
  if (context[0]?.tenant !== tenantId) throw new Error('HUB_SOURCE_SCOPE_REJECTED');
  const actor = await db.account.findUnique({ where: { id: source.createdBy },
    select: { id: true, tenantId: true, status: true } });
  if (actor?.tenantId !== tenantId || actor.status !== 'active') throw new Error('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  const grants = await db.$queryRaw`
    SELECT decision FROM rh_source.review_grant_event
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND account_id = ${source.createdBy} AND capability = 'source.review'
    ORDER BY event_version DESC LIMIT 1`;
  if (grants[0]?.decision !== 'grant') throw new Error('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  const batchKey = [tenantId, hubKey, preview.fileSha256, preview.sheetName,
    preview.mapperVersion, preview.sourceKey].join('\n');
  const batchId = 'rhsb-' + hash(batchKey).slice(0, 40);
  const existing = await db.$queryRaw`
    SELECT id, row_count AS "rowCount", error_count AS "errorCount"
    FROM rh_source.import_batch WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND file_sha256 = ${preview.fileSha256} AND sheet_name = ${preview.sheetName}
      AND mapper_version = ${preview.mapperVersion} AND scope_key = ${preview.sourceKey}`;
  if (existing.length) {
    if (existing[0].rowCount !== preview.rows.length || existing[0].id !== batchId)
      throw new Error('HUB_SOURCE_BATCH_CONFLICT');
    return { batchId, inserted: 0, existing: true, errors: existing[0].errorCount };
  }
  const sourceNames = [...new Set(preview.rows.map(row => row.sourceName || 'UNSPECIFIED'))];
  const sourceIdByName = new Map(sourceNames.map(name =>
    [name, 'rhss-' + hash([tenantId, hubKey, name.normalize('NFKC').toLowerCase()].join('\n')).slice(0, 40)]));
  for (const name of sourceNames) {
    const sourceId = sourceIdByName.get(name);
    await db.$executeRaw`
      INSERT INTO rh_source.source_registry
        (id, tenant_id, hub_key, source_key, source_name)
      VALUES (${sourceId}, ${tenantId}, ${hubKey}, ${sourceId}, ${name})
      ON CONFLICT (tenant_id, hub_key, source_key) DO NOTHING`;
  }
  const errorCount = preview.rows.filter(row => row.errors.length > 0).length;
  await db.$executeRaw`
    INSERT INTO rh_source.import_batch
      (id, tenant_id, hub_key, file_name, file_sha256, snapshot_path,
       sheet_name, mapper_version, scope_key, row_count, error_count, created_by)
    VALUES (${batchId}, ${tenantId}, ${hubKey}, ${source.fileName || basename(preview.filePath)},
            ${preview.fileSha256}, ${source.snapshotPath}, ${preview.sheetName},
            ${preview.mapperVersion}, ${preview.sourceKey}, ${preview.rows.length},
            ${errorCount}, ${source.createdBy})`;
  const records = preview.rows.map(row => ({
    id: 'rhsr-' + hash(batchId + ':' + row.rowNumber).slice(0, 40),
    tenant_id: tenantId, hub_key: hubKey, batch_id: batchId,
    source_registry_id: sourceIdByName.get(row.sourceName || 'UNSPECIFIED'),
    row_number: row.rowNumber, row_sha256: row.rowSha256,
    raw_fields: row.raw, validation_errors: row.errors,
    title: text(row.title), authors: text(field(row.raw, 'Author-')),
    journal: text(field(row.raw, 'Source-')),
    publication_year: text(field(row.raw, 'Year-')),
    doi: text(row.doi), source_url: text(row.url),
    abstract_text: text(field(row.raw, 'Summary-')),
  }));
  for (const part of chunks(records)) await db.$executeRaw`
    INSERT INTO rh_source.source_record
      (id,tenant_id,hub_key,batch_id,source_registry_id,row_number,row_sha256,
       raw_fields,validation_errors,title,authors,journal,publication_year,doi,source_url,abstract_text)
    SELECT id,tenant_id,hub_key,batch_id,source_registry_id,row_number,row_sha256,
           raw_fields,validation_errors,title,authors,journal,publication_year,doi,source_url,abstract_text
    FROM jsonb_to_recordset(${JSON.stringify(part)}::jsonb) AS x
      (id text,tenant_id text,hub_key text,batch_id text,source_registry_id text,
       row_number integer,row_sha256 text,raw_fields jsonb,validation_errors jsonb,
       title text,authors text,journal text,publication_year text,doi text,source_url text,abstract_text text)`;
  const canonical = records.filter(record => record.title &&
    !record.validation_errors.some(error => ['DOI_INVALID', 'URL_INVALID'].includes(error)))
    .map(record => ({ id: 'rhcp-' + hash(record.id).slice(0, 40),
      tenant_id: tenantId, hub_key: hubKey, source_record_id: record.id,
      title: record.title, authors: record.authors, journal: record.journal,
      publication_year: record.publication_year, doi: record.doi,
      source_url: record.source_url, abstract_text: record.abstract_text }));
  for (const part of chunks(canonical)) await db.$executeRaw`
    INSERT INTO rh_source.canonical_publication
      (id,tenant_id,hub_key,source_record_id,title,authors,journal,publication_year,doi,source_url,abstract_text)
    SELECT id,tenant_id,hub_key,source_record_id,title,authors,journal,publication_year,doi,source_url,abstract_text
    FROM jsonb_to_recordset(${JSON.stringify(part)}::jsonb) AS x
      (id text,tenant_id text,hub_key text,source_record_id text,title text,authors text,
       journal text,publication_year text,doi text,source_url text,abstract_text text)`;
  const links = canonical.map(item => ({
    id: 'rhcs-' + hash(item.id + ':' + item.source_record_id).slice(0, 40),
    tenant_id: tenantId, hub_key: hubKey, canonical_id: item.id,
    source_record_id: item.source_record_id,
  }));
  for (const part of chunks(links)) await db.$executeRaw`
    INSERT INTO rh_source.canonical_source (id,tenant_id,hub_key,canonical_id,source_record_id)
    SELECT id,tenant_id,hub_key,canonical_id,source_record_id
    FROM jsonb_to_recordset(${JSON.stringify(part)}::jsonb) AS x
      (id text,tenant_id text,hub_key text,canonical_id text,source_record_id text)`;
  return { batchId, inserted: records.length, existing: false, errors: errorCount };
}
