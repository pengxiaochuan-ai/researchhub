import { initialFive } from './initial-five.mjs';
import { guidanceHash, validateGuidancePayload } from './guidance-clause-contract.mjs';

export function checkedGuidancePayload(payload, externalKey, sourceSha256, payloadSha256) {
  const source = initialFive.find(x => x.mimeType === 'application/pdf' && x.externalKey === externalKey);
  if (!source || sourceSha256 !== source.expectedSha256 || guidanceHash(payload) !== payloadSha256) return null;
  try { validateGuidancePayload(payload, source); } catch { return null; }
  return payload;
}
export async function currentGuidanceExtraction({ db, tenantId, hubKey, versionId, externalKey, sha256 }) {
  const [row] = await db.$queryRaw`SELECT e.id,e.extraction_version AS "extractionVersion",e.source_sha256 AS "sourceSha256",
      e.payload_sha256 AS "payloadSha256",e.payload,r.decision_version AS version,r.decision,
      r.evidence_ref AS "evidenceRef",r.reviewer_id AS "reviewerId",r.expires_at AS "expiresAt",r.created_at AS "createdAt"
    FROM rh_source.guidance_clause_extraction e LEFT JOIN LATERAL (
      SELECT decision_version,decision,evidence_ref,reviewer_id,expires_at,created_at FROM rh_source.guidance_clause_review
      WHERE tenant_id=e.tenant_id AND hub_key=e.hub_key AND extraction_id=e.id ORDER BY decision_version DESC LIMIT 1
    ) r ON true WHERE e.tenant_id=${tenantId} AND e.hub_key=${hubKey} AND e.version_id=${versionId}
    ORDER BY e.extraction_version DESC LIMIT 1`;
  if (!row || row.sourceSha256 !== sha256 || !checkedGuidancePayload(row.payload, externalKey, sha256, row.payloadSha256)) return null;
  return { extractionId: row.id, extractionVersion: row.extractionVersion, sourceSha256: row.sourceSha256,
    payloadSha256: row.payloadSha256, payload: row.payload,
    fileName: initialFive.find(x => x.externalKey === externalKey).fileName,
    review: row.version ? { version: String(row.version), decision: row.decision, audience: 'public',
      fieldKind: 'guidance_clauses', purpose: 'display', evidenceRef: row.evidenceRef, reviewerId: row.reviewerId,
      expiresAt: row.expiresAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() } : null };
}
export async function submitGuidanceReview({ db, tenantId, hubKey, principal, input, document }) {
  if (input.purpose !== 'display' || !['research_standard', 'clinical_guideline'].includes(document.documentType))
    throw new Error('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  const e = await currentGuidanceExtraction({ db, tenantId, hubKey, versionId: input.versionId,
    externalKey: document.externalKey, sha256: input.sha256 });
  if (!e || e.extractionId !== input.extractionId || e.payloadSha256 !== input.payloadSha256 ||
    (e.review?.version || '0') !== String(input.expectedVersion)) throw new Error('HUB_SOURCE_VERSION_CONFLICT');
  const active = e.review?.decision === 'approve' && (!e.review.expiresAt || new Date(e.review.expiresAt) > new Date());
  if (input.decision === 'approve' && active) throw new Error('HUB_SOURCE_VERSION_CONFLICT');
  if (input.decision === 'revoke' && e.review?.decision !== 'approve') throw new Error('HUB_SOURCE_REVOKE_REJECTED');
  const [r] = await db.$queryRaw`INSERT INTO rh_source.guidance_clause_review
    (tenant_id,hub_key,extraction_id,decision,evidence_ref,reviewer_id)
    VALUES (${tenantId},${hubKey},${e.extractionId},${input.decision},${input.evidenceRef},${principal.accountId})
    RETURNING decision_version AS version,created_at AS "createdAt"`;
  return { documentId: input.documentId, versionId: input.versionId, extractionId: e.extractionId, payloadSha256: e.payloadSha256,
    fieldKind: 'guidance_clauses', purpose: 'display', audience: 'public', decision: input.decision,
    version: String(r.version), createdAt: r.createdAt.toISOString() };
}
