import { assertCurrentReviewer } from './review-service.mjs';
import { isInitialExternalDocument } from './initial-five.mjs';
import { submitRegistryDetailReview } from './registry-detail-service.mjs';
import { submitGuidanceReview } from './guidance-clause-service.mjs';

const fail = code => { throw new Error(code); };
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{4,100}$/.test(value);
const validEvidence = value => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
};

export async function submitExternalReview({ db, principal, tenantId, hubKey, reviewerAccountId, input, recordPublicApproval }) {
  if (!principal || principal.accountId !== reviewerAccountId || principal.tenantId !== tenantId)
    fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  if (!input || !validId(input.documentId) || !validId(input.versionId))
    fail('HUB_SOURCE_SCOPE_REJECTED');
  if (!['bibliographic', 'abstract', 'fulltext', 'registry_details', 'guidance_clauses'].includes(input.fieldKind) ||
      !['display', 'ai_retrieval'].includes(input.purpose) ||
      !['approve', 'revoke'].includes(input.decision) || input.confirmed !== true ||
      !/^(0|[1-9]\d*)$/.test(String(input.expectedVersion)))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  if (!validEvidence(input.evidenceRef)) fail('HUB_SOURCE_EVIDENCE_REQUIRED');
  if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256))
    fail('HUB_SOURCE_VERSION_CONFLICT');

  // Review grants, account deactivation and decisions must share one commit boundary.
  await db.$queryRaw`SELECT rh_source.hold_review_grants_for_commit()`;
  await db.$queryRaw`SELECT a.id FROM account a JOIN tenant t ON t.id = a."tenantId"
    WHERE a.id = ${principal.accountId} AND a."tenantId" = ${tenantId}
    FOR SHARE OF a, t`;
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
    ${tenantId + ':' + hubKey + ':' + input.documentId}, 0))`;
  const documents = await db.$queryRaw`
    SELECT id, document_type AS "documentType", external_key AS "externalKey"
    FROM rh_source.external_document
    WHERE id = ${input.documentId} AND tenant_id = ${tenantId} AND hub_key = ${hubKey}
      AND selection_basis = 'user-selected-initial-data-2026-10-30'
    `;
  if (documents.length !== 1 || !isInitialExternalDocument(documents[0], tenantId, hubKey))
    fail('HUB_SOURCE_SCOPE_REJECTED');
  const versions = await db.$queryRaw`
    SELECT id, content_sha256 AS sha256 FROM rh_source.external_document_version
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey} AND document_id = ${input.documentId}
    ORDER BY version_number DESC LIMIT 1`;
  if (versions[0]?.id !== input.versionId || versions[0]?.sha256 !== input.sha256)
    fail('HUB_SOURCE_VERSION_CONFLICT');
  const unified = await db.$queryRaw`SELECT 1 FROM rh_source.external_review_decision
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${input.versionId}
      AND (evidence_ref LIKE 'evidence://hub-review/%' OR evidence_ref LIKE 'evidence://hub-display/%') LIMIT 1`;
  if(unified.length) fail('HUB_SOURCE_OBJECT_DECISION_REQUIRED');
  if (input.fieldKind === 'registry_details') return submitRegistryDetailReview({ db, tenantId, hubKey,
    principal, input, document: documents[0] });
  if (input.fieldKind === 'guidance_clauses') return submitGuidanceReview({ db, tenantId, hubKey,
    principal, input, document: documents[0] });
  const prior = await db.$queryRaw`
    SELECT decision_version AS version, decision, audience, expires_at AS "expiresAt"
    FROM rh_source.external_review_decision
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey} AND version_id = ${input.versionId}
      AND field_kind = ${input.fieldKind} AND purpose = ${input.purpose}
    ORDER BY decision_version DESC LIMIT 1`;
  const expected = prior[0] ? String(prior[0].version) : '0';
  if (expected !== String(input.expectedVersion)) fail('HUB_SOURCE_VERSION_CONFLICT');
  if (input.decision === 'revoke' &&
      (prior[0]?.decision !== 'approve' || prior[0]?.audience !== 'public'))
    fail('HUB_SOURCE_REVOKE_REJECTED');
  if (input.decision === 'approve' && prior[0]?.decision === 'approve' &&
      prior[0]?.audience === 'public' && (!prior[0]?.expiresAt || prior[0].expiresAt > new Date()))
    fail('HUB_SOURCE_VERSION_CONFLICT');
  const rows = await db.$queryRaw`
    INSERT INTO rh_source.external_review_decision
      (tenant_id, hub_key, version_id, field_kind, purpose, audience, decision,
       evidence_ref, reviewer_id)
    VALUES (${tenantId}, ${hubKey}, ${input.versionId}, ${input.fieldKind},
            ${input.purpose}, 'public', ${input.decision}, ${input.evidenceRef}, ${principal.accountId})
    RETURNING decision_version AS version, created_at AS "createdAt"`;
  if (input.fieldKind === 'bibliographic' && input.purpose === 'display' && input.decision === 'approve') {
    await recordPublicApproval?.(db, {tenantId, hubKey}, {documentId:input.documentId, decisionVersion:rows[0].version, createdAt:rows[0].createdAt});
  }
  return { version: String(rows[0].version), createdAt: rows[0].createdAt.toISOString(),
    documentId: input.documentId, versionId: input.versionId, fieldKind: input.fieldKind,
    purpose: input.purpose, decision: input.decision, audience: 'public' };
}
