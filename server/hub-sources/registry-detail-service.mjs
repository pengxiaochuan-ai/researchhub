import { initialFive } from './initial-five.mjs';
import { registryDetailHash, validateRegistryDetails } from './registry-detail-contract.mjs';

// Caller supplies an already tenant-scoped transaction and an authenticated reviewer
// or a source version which passed the existing public bibliographic gate.
export async function currentRegistryExtraction({ db, tenantId, hubKey, versionId, externalKey, sha256 }) {
  const source = initialFive.find(item => item.documentType === 'clinical_registry' && item.externalKey === externalKey);
  if (!source || source.expectedSha256 !== sha256) return null;
  const [row] = await db.$queryRaw`SELECT id, extraction_version AS "extractionVersion",
      source_sha256 AS "sourceSha256", payload_sha256 AS "payloadSha256", payload
    FROM rh_source.clinical_registry_extraction WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
      AND version_id=${versionId} ORDER BY extraction_version DESC LIMIT 1`;
  if (!row || row.sourceSha256 !== sha256 || registryDetailHash(row.payload) !== row.payloadSha256) return null;
  try { validateRegistryDetails(row.payload, source); } catch { return null; }
  const [review] = await db.$queryRaw`SELECT decision_version AS version, decision, evidence_ref AS "evidenceRef",
      reviewer_id AS "reviewerId", expires_at AS "expiresAt", created_at AS "createdAt"
    FROM rh_source.clinical_registry_detail_review WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
      AND extraction_id=${row.id} ORDER BY decision_version DESC LIMIT 1`;
  return { extractionId: row.id, extractionVersion: row.extractionVersion,
    sourceSha256: row.sourceSha256, payloadSha256: row.payloadSha256, fileName: source.fileName,
    payload: row.payload, review: review ? { ...review, version: String(review.version), audience: 'public',
      fieldKind: 'registry_details', purpose: 'display',
      createdAt: review.createdAt.toISOString(), expiresAt: review.expiresAt?.toISOString() ?? null } : null };
}

export const registryDetailsAreApproved = extraction => extraction?.review?.decision === 'approve' &&
  (!extraction.review.expiresAt || new Date(extraction.review.expiresAt) > new Date());

export async function submitRegistryDetailReview({ db, tenantId, hubKey, principal, input, document }) {
  if (input.purpose !== 'display' || document.documentType !== 'clinical_registry')
    throw new Error('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  const extraction = await currentRegistryExtraction({ db, tenantId, hubKey, versionId: input.versionId,
    externalKey: document.externalKey, sha256: input.sha256 });
  if (!extraction || extraction.extractionId !== input.extractionId || extraction.payloadSha256 !== input.payloadSha256 ||
      (extraction.review?.version || '0') !== String(input.expectedVersion)) throw new Error('HUB_SOURCE_VERSION_CONFLICT');
  if (input.decision === 'approve' && registryDetailsAreApproved(extraction)) throw new Error('HUB_SOURCE_VERSION_CONFLICT');
  if (input.decision === 'revoke' && extraction.review?.decision !== 'approve') throw new Error('HUB_SOURCE_REVOKE_REJECTED');
  const [saved] = await db.$queryRaw`INSERT INTO rh_source.clinical_registry_detail_review
    (tenant_id,hub_key,extraction_id,decision,evidence_ref,reviewer_id)
    VALUES (${tenantId},${hubKey},${extraction.extractionId},${input.decision},${input.evidenceRef},${principal.accountId})
    RETURNING decision_version AS version, created_at AS "createdAt"`;
  return { documentId: input.documentId, versionId: input.versionId, extractionId: extraction.extractionId,
    payloadSha256: extraction.payloadSha256, fieldKind: 'registry_details', purpose: 'display', audience: 'public',
    decision: input.decision, version: String(saved.version), createdAt: saved.createdAt.toISOString() };
}
