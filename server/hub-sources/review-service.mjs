const fail = code => { throw new Error(code); };
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{4,100}$/.test(value);

export async function assertCurrentReviewer({ db, principal, tenantId, hubKey }) {
  if (!principal || principal.tenantId !== tenantId || !validId(principal.accountId)) fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  const account = await db.account.findFirst({ where: {
    id: principal.accountId, tenantId, status: 'active', authVersion: principal.authVersion,
    tenant: { status: 'active' },
  }, select: { id: true } });
  if (!account) fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  const grants = await db.$queryRaw`
    SELECT decision FROM rh_source.review_grant_event
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND account_id = ${principal.accountId} AND capability = 'source.review'
    ORDER BY event_version DESC LIMIT 1`;
  if (grants[0]?.decision !== 'grant') fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  return account;
}

export async function listReviewBatches({ db, principal, tenantId, hubKey }) {
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  const rows = await db.$queryRaw`
    SELECT b.id, b.file_name AS "fileName", b.sheet_name AS "sheetName",
           b.scope_key AS "scopeKey", b.row_count AS "rowCount",
           b.error_count AS "errorCount", b.status, b.created_at AS "createdAt"
    FROM rh_source.import_batch b
    WHERE b.tenant_id = ${tenantId} AND b.hub_key = ${hubKey}
    ORDER BY b.created_at DESC, b.id DESC LIMIT 50`;
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function listBatchSources({ db, principal, tenantId, hubKey, batchId }) {
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  if (!validId(batchId)) fail('HUB_SOURCE_SCOPE_REJECTED');
  const batch = await db.$queryRaw`SELECT id FROM rh_source.import_batch
    WHERE id = ${batchId} AND tenant_id = ${tenantId} AND hub_key = ${hubKey}`;
  if (!batch.length) fail('HUB_SOURCE_SCOPE_REJECTED');
  return db.$queryRaw`
    SELECT s.id AS "sourceRegistryId", s.source_name AS "sourceName",
      count(*)::integer AS "rowCount",
      count(*) FILTER (WHERE r.validation_errors <> '[]'::jsonb)::integer AS "invalidCount",
      count(*) FILTER (WHERE r.validation_errors = '[]'::jsonb AND r.title IS NOT NULL)::integer AS "eligibleBibliographic",
      count(*) FILTER (WHERE r.validation_errors = '[]'::jsonb AND r.abstract_text IS NOT NULL)::integer AS "eligibleAbstract"
    FROM rh_source.source_record r JOIN rh_source.source_registry s ON s.id = r.source_registry_id
    WHERE r.tenant_id = ${tenantId} AND r.hub_key = ${hubKey} AND r.batch_id = ${batchId}
    GROUP BY s.id, s.source_name ORDER BY s.source_name, s.id`;
}

export async function listReviewRows({ db, principal, tenantId, hubKey, batchId, sourceRegistryId, cursor = 0 }) {
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  if (!validId(batchId) || !validId(sourceRegistryId) || !Number.isSafeInteger(Number(cursor)) || Number(cursor) < 0)
    fail('HUB_SOURCE_SCOPE_REJECTED');
  const rows = await db.$queryRaw`
    SELECT id, row_number AS "rowNumber", title, authors, journal,
      publication_year AS "year", doi, source_url AS "sourceUrl",
      abstract_text AS "abstract", validation_errors AS errors
    FROM rh_source.source_record
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND batch_id = ${batchId} AND source_registry_id = ${sourceRegistryId}
      AND row_number > ${Number(cursor)}
    ORDER BY row_number LIMIT 31`;
  const items = rows.slice(0, 30);
  return { items, nextCursor: rows.length > 30 ? items.at(-1).rowNumber : null };
}

export async function listReviewHistory({ db, principal, tenantId, hubKey, sourceRegistryId, batchId = null }) {
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  if (!validId(sourceRegistryId) || (batchId != null && !validId(batchId))) fail('HUB_SOURCE_SCOPE_REJECTED');
  const rows = await db.$queryRaw`
    SELECT decision_version AS version, batch_id AS "batchId",
           source_record_id AS "sourceRecordId", field_kind AS "fieldKind",
           purpose, decision, audience, expires_at AS "expiresAt",
           evidence_ref AS "evidenceRef", reviewer_id AS "reviewerId",
           confirmed_count AS "confirmedCount", created_at AS "createdAt"
    FROM rh_source.review_decision
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND source_registry_id = ${sourceRegistryId}
      AND (${batchId}::text IS NULL OR batch_id=${batchId} OR source_record_id IN (
        SELECT id FROM rh_source.source_record WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
          AND batch_id=${batchId} AND source_registry_id=${sourceRegistryId}))
    ORDER BY decision_version DESC LIMIT 200`;
  return rows.reverse().map(row => ({ ...row, version: String(row.version),
    expiresAt: row.expiresAt?.toISOString() || null, createdAt: row.createdAt.toISOString() }));
}

export async function reviewSource({ db, principal, tenantId, hubKey, input }) {
  // Serialize a grant event and account/tenant deactivation with this commit.
  // A revoker that wins first makes the current check fail; one that arrives
  // later waits until this bounded review transaction has committed.
  await db.$queryRaw`SELECT rh_source.hold_review_grants_for_commit()`;
  if (!principal || !validId(principal.accountId)) fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  await db.$queryRaw`SELECT a.id FROM account a JOIN tenant t ON t.id = a."tenantId"
    WHERE a.id = ${principal.accountId} AND a."tenantId" = ${tenantId}
    FOR SHARE OF a, t`;
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  if (!input || !validId(input.batchId) || !validId(input.sourceRegistryId) ||
      (input.sourceRecordId != null && !validId(input.sourceRecordId))) fail('HUB_SOURCE_SCOPE_REJECTED');
  if (!['bibliographic', 'abstract'].includes(input.fieldKind) ||
      !['display', 'ai_retrieval'].includes(input.purpose) ||
      !['approve', 'revoke'].includes(input.decision)) fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  const audience = input.audience ?? 'tenant';
  if (!['tenant', 'public'].includes(audience)) fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  const expiresAt = input.expiresAt == null ? null : new Date(input.expiresAt);
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  if (typeof input.evidenceRef !== 'string' || input.evidenceRef.length > 2048 ||
      !/^(https:\/\/|evidence:\/\/)[^\s]+$/i.test(input.evidenceRef)) fail('HUB_SOURCE_EVIDENCE_REQUIRED');
  if (!Number.isSafeInteger(input.confirmedCount) || input.confirmedCount <= 0 ||
      !Number.isSafeInteger(input.excludedCount) || input.excludedCount < 0 ||
      !/^(0|[1-9]\d*)$/.test(String(input.expectedVersion))) fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  if (!input.sourceRecordId && input.homogeneousRightsConfirmed !== true)
    fail('HUB_SOURCE_HOMOGENEOUS_CONFIRMATION_REQUIRED');
  const batch = await db.$queryRaw`
    SELECT id FROM rh_source.import_batch
    WHERE id = ${input.batchId} AND tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND status = 'staged'`;
  if (!batch.length) fail('HUB_SOURCE_SCOPE_REJECTED');
  // Lock the source row to serialize competing decisions and their version checks.
  const sources = await db.$queryRaw`
    SELECT id FROM rh_source.source_registry
    WHERE id = ${input.sourceRegistryId} AND tenant_id = ${tenantId} AND hub_key = ${hubKey}
    FOR UPDATE`;
  if (!sources.length) fail('HUB_SOURCE_SCOPE_REJECTED');
  const unified = await db.$queryRaw`SELECT 1 FROM rh_source.review_decision d
    WHERE d.tenant_id=${tenantId} AND d.hub_key=${hubKey} AND d.source_registry_id=${input.sourceRegistryId}
      AND d.evidence_ref LIKE 'evidence://hub-review/%'
      AND ((d.source_record_id IS NULL AND d.batch_id=${input.batchId}) OR d.source_record_id IN (
        SELECT id FROM rh_source.source_record WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
          AND batch_id=${input.batchId} AND source_registry_id=${input.sourceRegistryId}
          AND (${input.sourceRecordId ?? null}::text IS NULL OR id=${input.sourceRecordId ?? null}))) LIMIT 1`;
  if(unified.length) fail('HUB_SOURCE_OBJECT_DECISION_REQUIRED');
  const rows = input.sourceRecordId ? await db.$queryRaw`
    SELECT id, validation_errors AS errors, title, abstract_text AS abstract
    FROM rh_source.source_record
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND batch_id = ${input.batchId} AND source_registry_id = ${input.sourceRegistryId}
      AND id = ${input.sourceRecordId}` : await db.$queryRaw`
    SELECT id, validation_errors AS errors, title, abstract_text AS abstract
    FROM rh_source.source_record
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND batch_id = ${input.batchId} AND source_registry_id = ${input.sourceRegistryId}`;
  if (!rows.length) fail('HUB_SOURCE_SCOPE_REJECTED');
  const valid = row => Array.isArray(row.errors) && row.errors.length === 0 &&
    Boolean(input.fieldKind === 'abstract' ? row.abstract : row.title);
  const eligible = rows.filter(valid);
  if (input.sourceRecordId && eligible.length !== 1) fail('HUB_SOURCE_RECORD_INVALID');
  if (input.confirmedCount !== eligible.length || input.excludedCount !== rows.length - eligible.length)
    fail('HUB_SOURCE_COUNT_MISMATCH');
  const scopeBatch = input.sourceRecordId ? null : input.batchId;
  const scopeRecord = input.sourceRecordId || null;
  const prior = await db.$queryRaw`
    SELECT decision_version AS version, decision FROM rh_source.review_decision
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND source_registry_id = ${input.sourceRegistryId}
      AND batch_id IS NOT DISTINCT FROM ${scopeBatch}
      AND source_record_id IS NOT DISTINCT FROM ${scopeRecord}
      AND field_kind = ${input.fieldKind} AND purpose = ${input.purpose}
    ORDER BY decision_version DESC LIMIT 1`;
  const version = prior[0] ? String(prior[0].version) : '0';
  if (version !== String(input.expectedVersion)) fail('HUB_SOURCE_VERSION_CONFLICT');
  if (input.decision === 'revoke') {
    const effective = input.sourceRecordId ? await db.$queryRaw`
      SELECT decision FROM rh_source.review_decision
      WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}
        AND source_registry_id = ${input.sourceRegistryId}
        AND (source_record_id = ${input.sourceRecordId}
             OR (source_record_id IS NULL AND batch_id = ${input.batchId}))
        AND field_kind = ${input.fieldKind} AND purpose = ${input.purpose}
      ORDER BY decision_version DESC LIMIT 1` : prior;
    if (effective[0]?.decision !== 'approve') fail('HUB_SOURCE_REVOKE_REJECTED');
  }
  const appended = await db.$queryRaw`
    INSERT INTO rh_source.review_decision
      (tenant_id,hub_key,source_registry_id,batch_id,source_record_id,
       field_kind,purpose,decision,audience,expires_at,evidence_ref,reviewer_id,confirmed_count)
    VALUES (${tenantId},${hubKey},${input.sourceRegistryId},${scopeBatch},${scopeRecord},
            ${input.fieldKind},${input.purpose},${input.decision},${audience},${expiresAt},${input.evidenceRef},
            ${principal.accountId},${eligible.length})
    RETURNING decision_version AS version, created_at AS "createdAt"`;
  return { version: String(appended[0].version), createdAt: appended[0].createdAt.toISOString(),
    confirmedCount: eligible.length, excludedCount: rows.length - eligible.length,
    decision: input.decision, fieldKind: input.fieldKind, purpose: input.purpose };
}
