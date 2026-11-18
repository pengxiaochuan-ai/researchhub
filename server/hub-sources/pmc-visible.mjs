import {assertApprovedInTransaction} from '../admission/service.mjs';
import {prepareHubQuery,prepareAgentHubQuery,matchesHubQuery,matchingQueryTerm,publicationRank} from './search-projection.mjs';
import {projectClassification} from './publication-classification.mjs';
const deny = () => { throw new Error('HUB_SOURCE_SCOPE_REJECTED'); };
const idPattern = /^pmc-(PMC[1-9][0-9]{0,10})$/;

async function scope({ db, tenantId, hubKey, principal, requireUser = false, requireTenantUser = false }) {
  if (!db || !tenantId || hubKey !== 'lingshu-xinyu' ||
      (principal && principal.tenantId !== tenantId) || ((requireUser || requireTenantUser) && !principal)) deny();
  const [context] = await db.$queryRaw`SELECT current_setting('app.tenant_id', true) AS tenant`;
  if (context?.tenant !== tenantId) deny();
  if (requireUser || requireTenantUser) {
    const account = await db.account.findFirst({ where: { id: principal.accountId,
      tenantId, status: 'active', authVersion: principal.authVersion,
      tenant: { status: 'active' } }, select: { id: true } });
    const access = requireUser && account && await db.agentAccess.findFirst({ where: {
      tenantId, accountId: principal.accountId, scopeKey: principal.accountId,
      agentId: tenantId + '-kb-research', enabled: true,
      agent: { status: 'active', type: 'research' },
    }, select: { id: true } });
    if (!account || (requireUser && !access)) deny();
    await assertApprovedInTransaction(db,principal,hubKey);
  }
}

function allowed(decisions, fieldKind, purpose, assetId = null) {
  const latest = decisions.findLast(value => value.fieldKind === fieldKind &&
    value.purpose === purpose && value.audience === 'public' && value.assetId === assetId);
  return latest?.decision === 'approve' &&
    (!latest.expiresAt || latest.expiresAt > new Date()) ? latest : null;
}

async function versions({ db, tenantId, hubKey, pmcid = null }) {
  return db.$queryRaw`
    SELECT c.pmcid, v.id AS "versionId", v.article_version AS "articleVersion",
      v.raw_sha256 AS "rawSha256", v.classification, v.title, v.journal, v.doi,
      v.publication_year AS year, v.authors, v.abstract_text AS abstract,
      v.body_text AS body, v.tables_json AS tables, v.media_refs AS "mediaRefs",
      v.license_uri AS "licenseUri",
      v.staged_at AS "stagedAt"
    FROM rh_source.pmc_candidate c
    JOIN LATERAL (
      SELECT * FROM rh_source.pmc_candidate_version v
      WHERE v.candidate_id=c.id AND v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key
      ORDER BY v.staged_at DESC, v.id DESC LIMIT 1
    ) v ON true
    WHERE c.tenant_id=${tenantId} AND c.hub_key=${hubKey}
      AND c.campaign_key='pmc-first-2026-10-31'
      AND (${pmcid}::text IS NULL OR c.pmcid=${pmcid})
    ORDER BY c.selected_rank LIMIT 20`;
}

async function project({ db, tenantId, hubKey, row, forAi = false, audience = 'public' }) {
  const [articleDecision] = await db.$queryRaw`
    SELECT decision_version AS version, visibility, asset_snapshot AS "assetSnapshot" FROM rh_source.pmc_article_decision
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${row.versionId}
    ORDER BY decision_version DESC LIMIT 1`;
  // Keep the new sequence distinct from legacy component decision versions in saved AI citations.
  const article = articleDecision && { ...articleDecision, version: `article:${articleDecision.version}` };
  if (article && (article.visibility === 'withheld' ||
      (!forAi && article.visibility !== audience))) return null;
  const decisions = await db.$queryRaw`
    SELECT asset_id AS "assetId", field_kind AS "fieldKind", purpose, audience,
      decision, decision_version AS version, expires_at AS "expiresAt"
    FROM rh_source.pmc_review_decision
    WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND version_id=${row.versionId}
    ORDER BY decision_version`;
  const permitted = (field, purpose, assetId = null) => article || allowed(decisions, field, purpose, assetId);
  const bibliographic = permitted('bibliographic', 'display');
  const aiBibliographic = permitted('bibliographic', 'ai_retrieval');
  if (!bibliographic || (forAi && !aiBibliographic)) return null;
  const has = field => permitted(field, 'display') &&
    (!forAi || permitted(field, 'ai_retrieval'));
  const abstract = has('abstract') ? row.abstract : null;
  const body = has('body') ? row.body : null;
  const tables = has('table') ? row.tables : null;
  const assets = forAi ? [] : await db.$queryRaw`
    SELECT id, asset_kind AS "assetKind", component_ref AS "componentRef",
      official_url AS "officialUrl", object_sha256 AS "sha256",
      rights_uri AS "rightsUri", attribution
    FROM rh_source.pmc_asset WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
      AND version_id=${row.versionId} AND asset_kind IN ('image','supplement')
    ORDER BY component_ref LIMIT 260`;
  // A public official-object link is a download path. Require both grants.
  const approvedAssets = assets.filter(asset =>
    (!article || article.assetSnapshot?.some(entry => entry.id === asset.id && entry.sha256 === asset.sha256)) &&
    permitted(asset.assetKind, 'display', asset.id) &&
    permitted(asset.assetKind, 'download', asset.id)).map(asset => {
      const figureOrder = asset.assetKind === 'image' && Array.isArray(row.mediaRefs)
        ? row.mediaRefs.findIndex(ref => ref.kind === 'image' &&
          String(ref.href || '').split('/').at(-1) === asset.componentRef) : -1;
      const figure = figureOrder >= 0 ? row.mediaRefs[figureOrder] : null;
      return { ...asset, visibility: article?.visibility || 'public',
        figureOrder: figureOrder >= 0 ? figureOrder : null,
        label: figure?.label || null, caption: figure?.caption || null };
    }).sort((a, b) => (a.figureOrder ?? 10000) - (b.figureOrder ?? 10000) ||
      a.componentRef.localeCompare(b.componentRef));
  return { id: `pmc-${row.pmcid}`, title: row.title,
    authors: Array.isArray(row.authors) ? row.authors.join(', ') : '',
    journal: row.journal, year: row.year, doi: row.doi,
    sourceUrl: `https://pmc.ncbi.nlm.nih.gov/articles/${row.pmcid}/`, sourceName: 'PubMed Central',
    abstract, body, tables, assets: approvedAssets,
    classification:projectClassification(row.classification,{title:row.title,abstract,sourceHash:row.rawSha256}),
    fulltextStatus: body || tables?.length || approvedAssets.length ? 'partially_approved' : 'not_approved',
    articleVersion: row.articleVersion, canonicalVersion: row.articleVersion,
    rawSha256: row.rawSha256, licenseUri: row.licenseUri,
    reviewVersion: String(bibliographic.version), aiReviewVersion: aiBibliographic && String(aiBibliographic.version),
    visibility: article?.visibility || 'public',
    abstractDisplayVersion: row.abstract ? permitted('abstract', 'display')?.version?.toString() ?? null : null,
    abstractAiReviewVersion: row.abstract ? permitted('abstract', 'ai_retrieval')?.version?.toString() ?? null : null,
    bodyDisplayVersion: row.body ? permitted('body', 'display')?.version?.toString() ?? null : null,
    bodyAiReviewVersion: row.body ? permitted('body', 'ai_retrieval')?.version?.toString() ?? null : null,
    tableDisplayVersion: row.tables?.length ? permitted('table', 'display')?.version?.toString() ?? null : null,
    tableAiReviewVersion: row.tables?.length ? permitted('table', 'ai_retrieval')?.version?.toString() ?? null : null,
  };
}

export async function getVisiblePmc({ db, tenantId, hubKey, principal = null, recordId, audience = 'public' }) {
  await scope({ db, tenantId, hubKey, principal, requireTenantUser: audience === 'tenant' });
  const pmcid = idPattern.exec(recordId || '')?.[1];
  if (!pmcid) return null;
  const row = (await versions({ db, tenantId, hubKey, pmcid }))[0];
  return row ? project({ db, tenantId, hubKey, row, audience }) : null;
}

export async function getDownloadablePmcAsset({ db, tenantId, hubKey, principal = null, assetId, audience = 'public' }) {
  await scope({ db, tenantId, hubKey, principal, requireTenantUser: audience === 'tenant' });
  if (typeof assetId !== 'string' || !/^[a-f0-9-]{36}$/.test(assetId)) return null;
  const [asset] = await db.$queryRaw`
    SELECT a.id, a.asset_kind AS "assetKind", a.version_id AS "versionId", a.object_sha256 AS sha256,
      a.byte_count AS "byteCount", a.local_object_key AS "localObjectKey",
      a.mime_type AS "mimeType", c.pmcid
    FROM rh_source.pmc_asset a
    JOIN rh_source.pmc_candidate_version v ON v.id=a.version_id
      AND v.tenant_id=a.tenant_id AND v.hub_key=a.hub_key
    JOIN rh_source.pmc_candidate c ON c.id=v.candidate_id
      AND c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key
    WHERE a.id=${assetId} AND a.tenant_id=${tenantId} AND a.hub_key=${hubKey}
      AND a.asset_kind IN ('image','supplement') AND c.campaign_key='pmc-first-2026-10-31'`;
  if (!asset) return null;
  const row = (await versions({ db, tenantId, hubKey, pmcid: asset.pmcid }))[0];
  if (!row || row.versionId !== asset.versionId) return null;
  const visible = await project({ db, tenantId, hubKey, row, audience });
  if (!visible?.assets.some(value => value.id === assetId)) return null;
  if (!/^objects\/[a-f0-9]{64}$/.test(asset.localObjectKey) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      asset.localObjectKey.slice(8) !== asset.sha256 ||
      asset.byteCount < 1n || asset.byteCount > 67108864n) return null;
  return { ...asset, byteCount: Number(asset.byteCount) };
}

export async function listVisiblePmc({ db, tenantId, hubKey, principal = null, query = '', queryPlan, audience = 'public' }) {
  await scope({ db, tenantId, hubKey, principal, requireTenantUser: audience === 'tenant' });
  const plan=queryPlan===undefined?prepareHubQuery(query):queryPlan;
  const rows = await versions({ db, tenantId, hubKey });
  const items = (await Promise.all(rows.map(row => project({ db, tenantId, hubKey, row, audience }))))
    .filter(Boolean);
  return items.filter(item=>matchesHubQuery(plan,[item.id,item.title,item.authors,item.journal,item.doi,item.abstract,item.body,JSON.stringify(item.tables||[])],[item.id.slice(4),item.doi]));
}

export async function retrievePmcForAi({ db, tenantId, hubKey, principal, query, queryPlan, limit = 6 }) {
  await scope({ db, tenantId, hubKey, principal, requireUser: true });
  const plan=queryPlan===undefined?prepareAgentHubQuery(query):queryPlan;if(!plan)deny();
  const rows = await versions({ db, tenantId, hubKey });
  const items = (await Promise.all(rows.map(row => project({ db, tenantId, hubKey, row, forAi: true }))))
    .filter(Boolean).filter(item=>matchesHubQuery(plan,[item.title,item.authors,item.journal,item.doi,item.abstract,item.body,JSON.stringify(item.tables||[])],[item.id.slice(4),item.doi]))
    .map(item=>({...item,searchRank:publicationRank(plan,[item.title,item.authors,item.journal,item.doi,item.abstract,item.body,JSON.stringify(item.tables||[])])})).sort((a,b)=>a.searchRank-b.searchRank||(a.id<b.id?-1:a.id>b.id?1:0));
  return items.slice(0, Math.max(1, Math.min(20, limit))).map(item => {
    const snippetField = matchingQueryTerm(plan,item.abstract) ? 'abstract'
      : matchingQueryTerm(plan,item.body) ? 'body'
      : matchingQueryTerm(plan,JSON.stringify(item.tables || [])) ? 'table' : 'title';
    const snippet = snippetField === 'abstract' ? item.abstract
      : snippetField === 'body' ? item.body
      : snippetField === 'table' ? JSON.stringify(item.tables) : item.title;
    const normalized = String(snippet).replace(/\s+/g, ' ');
    const term=matchingQueryTerm(plan,normalized),match=term?normalized.toLowerCase().indexOf(term.toLowerCase()):-1;
    const snippetOffset = Math.max(0, match < 0 ? 0 : match - 200);
    return { ...item, snippetField, snippetOffset,
      snippet: normalized.slice(snippetOffset, snippetOffset + 1200) };
  });
}

export async function getCurrentPmcAiHit({ db, tenantId, hubKey, principal, recordId }) {
  await scope({ db, tenantId, hubKey, principal, requireUser: true });
  const pmcid = idPattern.exec(recordId || '')?.[1];
  if (!pmcid) deny();
  const row = (await versions({ db, tenantId, hubKey, pmcid }))[0];
  return row ? project({ db, tenantId, hubKey, row, forAi: true }) : null;
}
