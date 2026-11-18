import { assertCurrentReviewer } from './review-service.mjs';
import { createHash } from 'node:crypto';

const fail = code => { throw new Error(code); };
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{4,100}$/.test(value);
const assetEntries = assets => assets.filter(asset => ['image', 'supplement'].includes(asset.assetKind))
  .map(asset => ({ id: asset.id, sha256: asset.sha256 })).sort((a, b) => a.id.localeCompare(b.id));
const assetFingerprint = entries => createHash('sha256').update(JSON.stringify(entries)).digest('hex');
const validEvidence = value => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.hash;
  } catch { return false; }
};

export function assertNamedReviewer(principal, tenantId, reviewerAccountId) {
  if (principal?.tenantId !== tenantId || principal?.accountId !== reviewerAccountId ||
      !validId(principal?.accountId)) fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
}

export async function listPmcReviewItems({ db, principal, tenantId, hubKey, reviewerAccountId }) {
  assertNamedReviewer(principal, tenantId, reviewerAccountId);
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  const rows = await db.$queryRaw`
    SELECT c.id AS "candidateId", c.pmcid, c.selected_rank AS "selectedRank",
      v.id AS "versionId", v.article_version AS "articleVersion", v.raw_sha256 AS "rawSha256",
      v.title, v.journal, v.doi, v.publication_year AS "year", v.authors,
      v.abstract_text AS "abstract", v.body_text AS "body",
      v.tables_json AS tables, v.media_refs AS "mediaRefs",
      v.license_uri AS "licenseUri", v.expected_asset_count AS "expectedAssetCount", v.cloud_manifest AS "componentManifest",
      (SELECT count(*)::integer FROM rh_source.pmc_asset a WHERE a.tenant_id=c.tenant_id
         AND a.hub_key=c.hub_key AND a.version_id=v.id) AS "stagedAssetCount"
    FROM rh_source.pmc_candidate c
    LEFT JOIN LATERAL (
      SELECT * FROM rh_source.pmc_candidate_version v
      WHERE v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key AND v.candidate_id=c.id
      ORDER BY v.staged_at DESC, v.id DESC LIMIT 1
    ) v ON true
    WHERE c.tenant_id=${tenantId} AND c.hub_key=${hubKey}
      AND c.campaign_key='pmc-first-2026-10-31'
    ORDER BY c.selected_rank LIMIT 20`;
  return Promise.all(rows.map(async row => {
    if (!row.versionId) return { ...row, assets: [], decisions: [] };
    const [assets, decisions, articleDecisions] = await Promise.all([
      db.$queryRaw`
        SELECT id, component_ref AS "componentRef", asset_kind AS "assetKind",
          official_url AS "officialUrl", object_sha256 AS "sha256",
          object_md5 AS md5, byte_count AS "byteCount", rights_uri AS "rightsUri",
          attribution, third_party_rights AS "thirdPartyRights", parsed_text IS NOT NULL AS "hasParsedText"
        FROM rh_source.pmc_asset WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
          AND version_id=${row.versionId} ORDER BY asset_kind, component_ref LIMIT 260`,
      db.$queryRaw`
        SELECT decision_version AS version, asset_id AS "assetId", field_kind AS "fieldKind",
          purpose, audience, decision, evidence_ref AS "evidenceRef",
          reviewer_id AS "reviewerId", expires_at AS "expiresAt", created_at AS "createdAt"
        FROM rh_source.pmc_review_decision
        WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${row.versionId}
        ORDER BY decision_version LIMIT 1000`,
      db.$queryRaw`
        SELECT decision_version AS version, visibility, asset_snapshot AS "assetSnapshot", reviewer_id AS "reviewerId",
          created_at AS "createdAt"
        FROM rh_source.pmc_article_decision
        WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${row.versionId}
        ORDER BY decision_version DESC LIMIT 1`,
    ]);
    return { ...row, assets: assets.map(asset => ({ ...asset, byteCount: Number(asset.byteCount) })),
      assetFingerprint: assetFingerprint(assetEntries(assets)),
      articleDecision: articleDecisions[0] ? { ...articleDecisions[0],
        version: String(articleDecisions[0].version),
        createdAt: articleDecisions[0].createdAt.toISOString() } : null,
      decisions: decisions.map(item => ({ ...item, version: String(item.version),
        createdAt: item.createdAt.toISOString(), expiresAt: item.expiresAt?.toISOString() ?? null })) };
  }));
}

export async function submitPmcArticleReview({ db, principal, tenantId, hubKey, reviewerAccountId, input }) {
  assertNamedReviewer(principal, tenantId, reviewerAccountId);
  if (!input || !validId(input.versionId) || !/^[a-f0-9]{64}$/.test(input.rawSha256 ?? '') ||
      !['public','tenant','withheld'].includes(input.visibility) ||
      !/^(0|[1-9]\d*)$/.test(String(input.expectedVersion)) ||
      (input.visibility !== 'withheld' && !/^[a-f0-9]{64}$/.test(input.expectedAssetFingerprint ?? '')))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  await db.$queryRaw`SELECT rh_source.hold_review_grants_for_commit()`;
  await db.$queryRaw`SELECT a.id FROM account a JOIN tenant t ON t.id=a."tenantId"
    WHERE a.id=${principal.accountId} AND a."tenantId"=${tenantId} FOR SHARE OF a, t`;
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  const [version] = await db.$queryRaw`
    SELECT v.raw_sha256 AS "rawSha256", c.id AS "candidateId"
    FROM rh_source.pmc_candidate_version v JOIN rh_source.pmc_candidate c
      ON c.id=v.candidate_id AND c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key
    WHERE v.id=${input.versionId} AND v.tenant_id=${tenantId} AND v.hub_key=${hubKey}
      AND c.campaign_key='pmc-first-2026-10-31'`;
  if (!version) fail('HUB_SOURCE_SCOPE_REJECTED');
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
    ${tenantId + ':' + hubKey + ':' + input.versionId}, 0))`;
  const [current] = await db.$queryRaw`
    SELECT id FROM rh_source.pmc_candidate_version
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND candidate_id=${version.candidateId}
    ORDER BY staged_at DESC, id DESC LIMIT 1`;
  if (version.rawSha256 !== input.rawSha256 || current?.id !== input.versionId)
    fail('HUB_SOURCE_VERSION_CONFLICT');
  const assets = await db.$queryRaw`
    SELECT id, asset_kind AS "assetKind", object_sha256 AS sha256 FROM rh_source.pmc_asset
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${input.versionId}
      AND asset_kind IN ('image','supplement') ORDER BY id LIMIT 261`;
  if (input.visibility !== 'withheld' && assets.length > 260) fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  const assetSnapshot = input.visibility === 'withheld' ? [] : assetEntries(assets);
  if (input.visibility !== 'withheld' && assetFingerprint(assetSnapshot) !== input.expectedAssetFingerprint)
    fail('HUB_SOURCE_VERSION_CONFLICT');
  const [prior] = await db.$queryRaw`
    SELECT decision_version AS version, visibility, asset_snapshot AS "assetSnapshot" FROM rh_source.pmc_article_decision
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${input.versionId}
    ORDER BY decision_version DESC LIMIT 1`;
  if (String(prior?.version ?? '0') !== String(input.expectedVersion) ||
      (prior?.visibility === input.visibility &&
        JSON.stringify(prior.assetSnapshot) === JSON.stringify(assetSnapshot))) fail('HUB_SOURCE_VERSION_CONFLICT');
  const [saved] = await db.$queryRaw`
    INSERT INTO rh_source.pmc_article_decision
      (tenant_id,hub_key,version_id,visibility,asset_snapshot,reviewer_id)
    VALUES (${tenantId},${hubKey},${input.versionId},${input.visibility},${JSON.stringify(assetSnapshot)}::jsonb,${principal.accountId})
    RETURNING decision_version AS version, created_at AS "createdAt"`;
  return { version: String(saved.version), versionId: input.versionId,
    visibility: input.visibility, reviewerId: principal.accountId,
    createdAt: saved.createdAt.toISOString() };
}

export async function getReviewablePmcImage({ db, principal, tenantId, hubKey, reviewerAccountId, assetId }) {
  assertNamedReviewer(principal, tenantId, reviewerAccountId);
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  if (typeof assetId !== 'string' || !/^[a-f0-9-]{36}$/.test(assetId)) return null;
  const [asset] = await db.$queryRaw`
    SELECT a.id, a.object_sha256 AS sha256, a.byte_count AS "byteCount",
      a.local_object_key AS "localObjectKey"
    FROM rh_source.pmc_asset a
    JOIN rh_source.pmc_candidate_version v ON v.id=a.version_id
      AND v.tenant_id=a.tenant_id AND v.hub_key=a.hub_key
    JOIN rh_source.pmc_candidate c ON c.id=v.candidate_id
      AND c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key
    WHERE a.id=${assetId} AND a.tenant_id=${tenantId} AND a.hub_key=${hubKey}
      AND a.asset_kind='image' AND c.campaign_key='pmc-first-2026-10-31'
      AND v.id=(SELECT latest.id FROM rh_source.pmc_candidate_version latest
        WHERE latest.candidate_id=c.id AND latest.tenant_id=c.tenant_id AND latest.hub_key=c.hub_key
        ORDER BY latest.staged_at DESC, latest.id DESC LIMIT 1)`;
  if (!asset || !/^objects\/[a-f0-9]{64}$/.test(asset.localObjectKey) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) || asset.localObjectKey.slice(8) !== asset.sha256 ||
      asset.byteCount < 1n || asset.byteCount > 67108864n) return null;
  return { ...asset, byteCount: Number(asset.byteCount) };
}

export async function submitPmcReview({ db, principal, tenantId, hubKey, reviewerAccountId, input }) {
  assertNamedReviewer(principal, tenantId, reviewerAccountId);
  if (!input || !validId(input.versionId) || !/^[a-f0-9]{64}$/.test(input.rawSha256 ?? ''))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  if (!['bibliographic','abstract','body','table','image','supplement'].includes(input.fieldKind) ||
      !['display','download','ai_retrieval'].includes(input.purpose) ||
      !['public','tenant'].includes(input.audience) ||
      !['approve','revoke'].includes(input.decision) || input.confirmed !== true ||
      !/^(0|[1-9]\d*)$/.test(String(input.expectedVersion)))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  if (!validEvidence(input.evidenceRef)) fail('HUB_SOURCE_EVIDENCE_REQUIRED');
  const assetKind = ['image','supplement'].includes(input.fieldKind);
  if (assetKind !== Boolean(input.assetId) ||
      (input.assetId && (!validId(input.assetId) || !/^[a-f0-9]{64}$/.test(input.componentSha256 ?? ''))) ||
      (input.purpose === 'download' && !assetKind) ||
      (input.purpose === 'ai_retrieval' && input.fieldKind === 'image'))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');

  await db.$queryRaw`SELECT rh_source.hold_review_grants_for_commit()`;
  await db.$queryRaw`SELECT a.id FROM account a JOIN tenant t ON t.id=a."tenantId"
    WHERE a.id=${principal.accountId} AND a."tenantId"=${tenantId}
    FOR SHARE OF a, t`;
  await assertCurrentReviewer({ db, principal, tenantId, hubKey });
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
    ${tenantId + ':' + hubKey + ':' + input.versionId}, 0))`;
  const versions = await db.$queryRaw`
    SELECT v.id, v.raw_sha256 AS "rawSha256", v.abstract_text AS "abstract",
      v.body_text AS "body", v.tables_json AS tables,
      c.id AS "candidateId"
    FROM rh_source.pmc_candidate_version v JOIN rh_source.pmc_candidate c
      ON c.id=v.candidate_id AND c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key
    WHERE v.id=${input.versionId} AND v.tenant_id=${tenantId} AND v.hub_key=${hubKey}
      AND c.campaign_key='pmc-first-2026-10-31'`;
  const version = versions[0];
  if (!version) fail('HUB_SOURCE_SCOPE_REJECTED');
  const [current] = await db.$queryRaw`
    SELECT id FROM rh_source.pmc_candidate_version
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND candidate_id=${version.candidateId}
    ORDER BY staged_at DESC, id DESC LIMIT 1`;
  if (version.rawSha256 !== input.rawSha256 || current?.id !== input.versionId)
    fail('HUB_SOURCE_VERSION_CONFLICT');
  const [articleDecision] = await db.$queryRaw`
    SELECT decision_version FROM rh_source.pmc_article_decision
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${input.versionId}
    ORDER BY decision_version DESC LIMIT 1`;
  if (articleDecision) fail('HUB_SOURCE_ARTICLE_DECISION_REQUIRED');
  if ((input.fieldKind === 'abstract' && !version.abstract) ||
      (input.fieldKind === 'body' && !version.body) ||
      (input.fieldKind === 'table' && !version.tables?.length))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  if (assetKind) {
    const assets = await db.$queryRaw`
      SELECT asset_kind AS "assetKind", object_sha256 AS sha256,
        third_party_rights AS "thirdPartyRights", parsed_text AS "parsedText"
      FROM rh_source.pmc_asset WHERE id=${input.assetId} AND tenant_id=${tenantId}
        AND hub_key=${hubKey} AND version_id=${input.versionId}`;
    const asset = assets[0];
    if (!asset || asset.assetKind !== input.fieldKind || asset.sha256 !== input.componentSha256)
      fail('HUB_SOURCE_VERSION_CONFLICT');
    if (input.purpose === 'ai_retrieval' && !asset.parsedText) fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
    if (input.decision === 'approve' && asset.thirdPartyRights && input.thirdPartyRightsConfirmed !== true)
      fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  }
  const prior = await db.$queryRaw`
    SELECT decision_version AS version, decision, expires_at AS "expiresAt"
    FROM rh_source.pmc_review_decision WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
      AND version_id=${input.versionId} AND asset_id IS NOT DISTINCT FROM ${input.assetId ?? null}
      AND field_kind=${input.fieldKind} AND purpose=${input.purpose} AND audience=${input.audience}
    ORDER BY decision_version DESC LIMIT 1`;
  if ((prior[0] ? String(prior[0].version) : '0') !== String(input.expectedVersion))
    fail('HUB_SOURCE_VERSION_CONFLICT');
  if (input.decision === 'revoke' && prior[0]?.decision !== 'approve')
    fail('HUB_SOURCE_REVOKE_REJECTED');
  if (input.decision === 'approve' && prior[0]?.decision === 'approve' &&
      (!prior[0].expiresAt || prior[0].expiresAt > new Date())) fail('HUB_SOURCE_VERSION_CONFLICT');
  const [saved] = await db.$queryRaw`
    INSERT INTO rh_source.pmc_review_decision
      (tenant_id,hub_key,version_id,asset_id,field_kind,purpose,audience,
       decision,evidence_ref,reviewer_id)
    VALUES (${tenantId},${hubKey},${input.versionId},${input.assetId ?? null},
      ${input.fieldKind},${input.purpose},${input.audience},${input.decision},
      ${input.evidenceRef},${principal.accountId})
    RETURNING decision_version AS version, created_at AS "createdAt"`;
  return { version: String(saved.version), versionId: input.versionId,
    assetId: input.assetId ?? null, fieldKind: input.fieldKind, purpose: input.purpose,
    audience: input.audience, decision: input.decision,
    createdAt: saved.createdAt.toISOString() };
}
