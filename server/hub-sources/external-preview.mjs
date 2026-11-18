import { assertCurrentReviewer } from './review-service.mjs';
import { initialExternalKeys, isInitialExternalDocument } from './initial-five.mjs';
import { currentRegistryExtraction } from './registry-detail-service.mjs';
import { currentGuidanceExtraction } from './guidance-clause-service.mjs';

export async function listExternalReviewItems({ db, principal, tenantId, hubKey, reviewerAccountId }) {
  if (principal?.accountId !== reviewerAccountId || principal?.tenantId !== tenantId)
    throw new Error('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  const rows = await db.$queryRaw`
    SELECT d.id, d.document_type AS "documentType", d.external_key AS "externalKey",
           d.title, d.source_target_condition AS "sourceTargetCondition",
           d.hub_topic AS "hubTopic", d.selection_status AS "selectionStatus",
           s.source_name AS "sourceName", s.rights_status AS "rightsStatus",
           v.id AS "versionId", v.version_number AS "versionNumber", v.file_name AS "fileName",
           v.content_sha256 AS sha256,
           v.source_url AS "sourceUrl", v.source_updated_on AS "sourceUpdatedOn",
           (SELECT count(*)::integer FROM rh_source.external_review_decision r
            WHERE r.tenant_id = v.tenant_id AND r.hub_key = v.hub_key
              AND r.version_id = v.id) AS "reviewDecisionCount"
    FROM rh_source.external_document d
    JOIN rh_source.source_registry s
      ON s.tenant_id = d.tenant_id AND s.hub_key = d.hub_key AND s.id = d.source_registry_id
    JOIN LATERAL (
      SELECT version_number, file_name, content_sha256, source_url, source_updated_on,
             id, tenant_id, hub_key
      FROM rh_source.external_document_version
      WHERE tenant_id = d.tenant_id AND hub_key = d.hub_key AND document_id = d.id
      ORDER BY version_number DESC LIMIT 1
    ) v ON true
    WHERE d.tenant_id = ${tenantId} AND d.hub_key = ${hubKey}
      AND d.selection_basis = 'user-selected-initial-data-2026-10-30'
      AND d.external_key = ANY(${initialExternalKeys}::text[])
    ORDER BY d.document_type, d.external_key LIMIT 20`;
  return Promise.all(rows.filter(row => isInitialExternalDocument(row, tenantId, hubKey)).map(async row => {
    const decisions = await db.$queryRaw`
      SELECT DISTINCT ON (field_kind, purpose)
        field_kind AS "fieldKind", purpose, decision, audience,
        decision_version AS version, evidence_ref AS "evidenceRef",
        reviewer_id AS "reviewerId", created_at AS "createdAt", expires_at AS "expiresAt"
      FROM rh_source.external_review_decision
      WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey} AND version_id = ${row.versionId}
      ORDER BY field_kind, purpose, decision_version DESC`;
    const structuredExtraction = row.documentType === 'clinical_registry'
      ? await currentRegistryExtraction({ db, tenantId, hubKey, versionId: row.versionId,
        externalKey: row.externalKey, sha256: row.sha256 }) : null;
    const guidanceExtraction = ['research_standard', 'clinical_guideline'].includes(row.documentType)
      ? await currentGuidanceExtraction({ db, tenantId, hubKey, versionId: row.versionId, externalKey: row.externalKey, sha256: row.sha256 }) : null;
    return { ...row, structuredExtraction, guidanceExtraction, sourceUpdatedOn: row.sourceUpdatedOn?.toISOString().slice(0, 10) ?? null,
      decisions: decisions.map(decision => ({ ...decision, version: String(decision.version),
        createdAt: decision.createdAt.toISOString(),
        expiresAt: decision.expiresAt?.toISOString() ?? null })).concat(structuredExtraction?.review ? [structuredExtraction.review] : [],
        guidanceExtraction?.review ? [guidanceExtraction.review] : []) };
  }));
}
