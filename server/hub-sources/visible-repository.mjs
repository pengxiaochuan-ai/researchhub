import {assertApprovedInTransaction} from '../admission/service.mjs';
import {prepareHubQuery,prepareAgentHubQuery,hubQuerySql,hubQueryRankSql,sql} from './search-projection.mjs';
import {projectClassification,CLASSIFICATION_VERSION} from './publication-classification.mjs';
import {classificationValuesSql,filterSql,facetCountsSql} from './publication-filter-sql.mjs';
import {normalizePublicationFilters} from '../../src/publication-filters.js';
import {agentQuestionError} from '../../src/agent-question.js';
const reject = () => { throw new Error('HUB_SOURCE_SCOPE_REJECTED'); };
const active = (decision, member = false) => decision?.decision === 'approve' && (decision.audience === 'public' || (member && decision.audience === 'tenant')) &&
  (!decision.expiresAt || decision.expiresAt > new Date());

async function assertScope({ db, tenantId, hubKey, principal, requireUser = false, requireMember = false }) {
  if (!db || typeof tenantId !== 'string' || hubKey !== 'lingshu-xinyu' ||
      (principal && principal.tenantId !== tenantId) || ((requireUser || requireMember) && !principal)) reject();
  const context = await db.$queryRaw`SELECT current_setting('app.tenant_id', true) AS tenant`;
  if (context[0]?.tenant !== tenantId) reject();
  if (requireUser || requireMember) {
    const account = await db.account.findFirst({ where: {
      id: principal.accountId, tenantId, status: 'active',
      authVersion: principal.authVersion, tenant: { status: 'active' },
    }, select: { id: true } });
    if (!account) reject();
    await assertApprovedInTransaction(db,principal,hubKey);
    const access = !requireUser || await db.agentAccess.findFirst({ where: {
      tenantId, accountId: principal.accountId, scopeKey: principal.accountId,
      agentId: tenantId + '-kb-research', enabled: true,
      agent: { status: 'active', type: 'research' },
    }, select: { id: true } });
    if (!access) reject();
  }
}

export const assertHubMember = args => assertScope({ ...args, requireMember:true });
export const assertHubAgent = args => assertScope({ ...args, requireUser:true });

// Every consumer uses this exact current-decision projection. Candidate IDs are
// anchored to an explicit approval, while later row or batch revocations win.
async function approvedRows({ db, tenantId, hubKey, query = '', queryPlan, cursor = null,afterRank=0,
  recordId = null, limit = 21, onlyAi = false, member = false,publicationFilters=null,facetStats=false }) {
  const plan=queryPlan===undefined?prepareHubQuery(query):queryPlan;
  const abstract=sql`CASE WHEN ad.decision='approve' AND (ad.audience='public' OR (${member}::boolean AND ad.audience='tenant'))
   AND (ad.expires_at IS NULL OR ad.expires_at>clock_timestamp())
   AND (NOT ${onlyAi}::boolean OR (aa.decision='approve' AND (aa.audience='public' OR (${member}::boolean AND aa.audience='tenant')) AND (aa.expires_at IS NULL OR aa.expires_at>clock_timestamp()))) THEN r.abstract_text ELSE NULL END`;
  const fields=[sql`r.title`,sql`r.authors`,sql`r.journal`,sql`r.doi`,sql`s.source_name`,abstract];
  const predicate=hubQuerySql(plan,fields,[sql`r.doi`]),rank=hubQueryRankSql(plan,fields);
  const values=classificationValuesSql(sql`c.classification`,sql`r.row_sha256`,sql`r.title`,abstract);
  const eligible=sql`
    WITH candidate_ids AS (
      SELECT DISTINCT r.id
      FROM rh_source.review_decision d
      JOIN rh_source.source_record r
        ON r.tenant_id = d.tenant_id AND r.hub_key = d.hub_key
       AND r.source_registry_id = d.source_registry_id
       AND (r.id = d.source_record_id OR (d.source_record_id IS NULL AND r.batch_id = d.batch_id))
      WHERE d.tenant_id = ${tenantId} AND d.hub_key = ${hubKey}
        AND d.field_kind = 'bibliographic' AND d.purpose = 'display'
        AND d.decision = 'approve'
    )
    SELECT ${rank} AS "searchRank",c.classification,${values} AS "facetValues",
           CASE WHEN c.classification->>'extractorVersion'=${CLASSIFICATION_VERSION} AND c.classification->>'sourceHash'=r.row_sha256 THEN c.classification->'dateRange' ELSE NULL END AS "dateRange",
           r.id, r.row_sha256 AS "rowSha256", r.row_number AS "rowNumber",
           r.batch_id AS "batchId", r.title, r.authors, r.journal,
           r.publication_year AS "year", r.doi, r.source_url AS "sourceUrl",
           r.abstract_text AS "abstractText", s.source_name AS "sourceName",
           b.file_name AS "fileName", b.sheet_name AS "sheetName",
           c.version AS "canonicalVersion",
           bd.decision AS "bdDecision", bd.audience AS "bdAudience",
           bd.expires_at AS "bdExpiresAt", bd.decision_version AS "bdVersion",
           ad.decision AS "adDecision", ad.audience AS "adAudience",
           ad.expires_at AS "adExpiresAt", ad.decision_version AS "adVersion",
           ba.decision AS "baDecision", ba.audience AS "baAudience",
           ba.expires_at AS "baExpiresAt", ba.decision_version AS "baVersion",
           aa.decision AS "aaDecision", aa.audience AS "aaAudience",
           aa.expires_at AS "aaExpiresAt", aa.decision_version AS "aaVersion"
    FROM candidate_ids ids
    JOIN rh_source.source_record r ON r.id = ids.id
    JOIN rh_source.source_registry s ON s.id = r.source_registry_id
    JOIN rh_source.import_batch b ON b.id = r.batch_id
    JOIN rh_source.canonical_publication c ON c.source_record_id = r.id
      AND c.tenant_id = r.tenant_id AND c.hub_key = r.hub_key
    LEFT JOIN LATERAL (
      SELECT decision, audience, expires_at, decision_version
      FROM rh_source.review_decision d WHERE d.tenant_id = r.tenant_id
        AND d.hub_key = r.hub_key AND d.source_registry_id = r.source_registry_id
        AND (d.source_record_id = r.id OR (d.source_record_id IS NULL AND d.batch_id = r.batch_id))
        AND d.field_kind = 'bibliographic' AND d.purpose = 'display'
      ORDER BY decision_version DESC LIMIT 1
    ) bd ON true
    LEFT JOIN LATERAL (
      SELECT decision, audience, expires_at, decision_version
      FROM rh_source.review_decision d WHERE d.tenant_id = r.tenant_id
        AND d.hub_key = r.hub_key AND d.source_registry_id = r.source_registry_id
        AND (d.source_record_id = r.id OR (d.source_record_id IS NULL AND d.batch_id = r.batch_id))
        AND d.field_kind = 'abstract' AND d.purpose = 'display'
      ORDER BY decision_version DESC LIMIT 1
    ) ad ON true
    LEFT JOIN LATERAL (
      SELECT decision, audience, expires_at, decision_version
      FROM rh_source.review_decision d WHERE d.tenant_id = r.tenant_id
        AND d.hub_key = r.hub_key AND d.source_registry_id = r.source_registry_id
        AND (d.source_record_id = r.id OR (d.source_record_id IS NULL AND d.batch_id = r.batch_id))
        AND d.field_kind = 'bibliographic' AND d.purpose = 'ai_retrieval'
      ORDER BY decision_version DESC LIMIT 1
    ) ba ON true
    LEFT JOIN LATERAL (
      SELECT decision, audience, expires_at, decision_version
      FROM rh_source.review_decision d WHERE d.tenant_id = r.tenant_id
        AND d.hub_key = r.hub_key AND d.source_registry_id = r.source_registry_id
        AND (d.source_record_id = r.id OR (d.source_record_id IS NULL AND d.batch_id = r.batch_id))
        AND d.field_kind = 'abstract' AND d.purpose = 'ai_retrieval'
      ORDER BY decision_version DESC LIMIT 1
    ) aa ON true
    WHERE r.tenant_id = ${tenantId} AND r.hub_key = ${hubKey}
      AND r.title IS NOT NULL AND r.validation_errors = '[]'::jsonb
      AND (${recordId}::text IS NULL OR r.id = ${recordId})
      AND bd.decision = 'approve' AND (bd.audience = 'public' OR (${member}::boolean AND bd.audience = 'tenant'))
      AND (bd.expires_at IS NULL OR bd.expires_at > clock_timestamp())
      AND (NOT ${onlyAi}::boolean OR (ba.decision = 'approve' AND (ba.audience = 'public' OR (${member}::boolean AND ba.audience = 'tenant'))
        AND (ba.expires_at IS NULL OR ba.expires_at > clock_timestamp())))
      AND ${predicate}`;
  const facetFields={values:sql`e."facetValues"`,year:sql`e.year`,date:sql`e."dateRange"`,readable:sql`false`};
  if(facetStats){const [row]=await db.$queryRaw`WITH eligible AS MATERIALIZED (${eligible}) SELECT ${facetCountsSql(facetFields,publicationFilters??normalizePublicationFilters())} AS facets FROM eligible e`;return row.facets;}
  const condition=filterSql(facetFields,publicationFilters??normalizePublicationFilters());
  const rows=await db.$queryRaw`WITH eligible AS MATERIALIZED (${eligible}),filtered AS (SELECT * FROM eligible e WHERE ${condition})
   SELECT e.*,(SELECT count(*)::integer FROM filtered) AS "totalRecords" FROM filtered e
   WHERE (e."searchRank">${afterRank} OR (e."searchRank"=${afterRank} AND (${cursor}::text IS NULL OR e.id>${cursor})))
   ORDER BY e."searchRank",e.id LIMIT ${limit}`;
  return rows.map(row => ({
    ...row,
    abstractApproved: active({ decision: row.adDecision, audience: row.adAudience,
      expiresAt: row.adExpiresAt }, member),
    aiApproved: active({ decision: row.baDecision, audience: row.baAudience,
      expiresAt: row.baExpiresAt }, member),
    abstractAiApproved: active({ decision: row.aaDecision, audience: row.aaAudience,
      expiresAt: row.aaExpiresAt }, member),
  }));
}

function publication(row) {
  return { id: row.id, title: row.title, authors: row.authors,
    journal: row.journal, year: row.year, doi: row.doi,
    sourceUrl: row.sourceUrl, sourceName: row.sourceName,
    abstract: row.abstractApproved ? row.abstractText : null,
    classification:projectClassification(row.classification,{title:row.title,abstract:row.abstractApproved?row.abstractText:null,sourceHash:row.rowSha256}),
    fulltextStatus: 'not_available', sourceRecordId: row.id,
    rowSha256: row.rowSha256, rowNumber: row.rowNumber,
    batchId: row.batchId, fileName: row.fileName, sheetName: row.sheetName,
    canonicalVersion: row.canonicalVersion,
    reviewVersion: String(row.bdVersion), visibility: row.bdAudience };
}

const clamp = value => Number.isSafeInteger(Number(value)) ? Math.min(50, Math.max(1, Number(value))) : 20;
export async function listVisible({ db, tenantId, hubKey, principal = null, filters = {}, queryPlan, cursor = null,afterRank=0, limit = 20, audience = 'public',publicationFilters=null,includeFacets=false }) {
  if (!['public','member'].includes(audience)) reject();
  await assertScope({ db, tenantId, hubKey, principal, requireMember: audience === 'member' });
  const q = String(filters?.q || '').trim().toLocaleLowerCase();
  if (q.length > 100 || (cursor != null && !/^rhsr-[a-f0-9]{40}$/.test(cursor))) reject();
  const size = clamp(limit);
  const plan=queryPlan===undefined?prepareHubQuery(filters.q??''):queryPlan;
  const common={db,tenantId,hubKey,queryPlan:plan,publicationFilters,member:audience==='member'};
  const rows = await approvedRows({...common, cursor,afterRank, limit: size + 1 });
  const countRows=cursor||afterRank>0?await approvedRows({...common,limit:1}):rows;
  const page = rows.slice(0, size);
  return { items: page.map(row=>({...publication(row),searchRank:row.searchRank})), nextCursor: rows.length > size ? page.at(-1).id : null,matchedRecords:countRows[0]?.totalRecords??0,queryPlan:plan,
   ...(includeFacets?{facets:await approvedRows({...common,facetStats:true})}:{}) };
}

// One statement gives the candidate page and count from the same decision
// snapshot. This is a source-record count, never a deduplicated paper metric.
export async function overviewVisible({ db, tenantId, hubKey, limit = 6 }) {
  await assertScope({ db, tenantId, hubKey });
  const rows = await approvedRows({ db, tenantId, hubKey, limit: Math.min(6, clamp(limit)) });
  return { items: rows.map(publication), recordCount: rows[0]?.totalRecords ?? 0 };
}

export async function getVisible({ db, tenantId, hubKey, principal = null, recordId, audience = 'public' }) {
  if (!['public','member'].includes(audience)) reject();
  await assertScope({ db, tenantId, hubKey, principal, requireMember: audience === 'member' });
  if (typeof recordId !== 'string' || !/^rhsr-[a-f0-9]{40}$/.test(recordId)) return null;
  const row = (await approvedRows({ db, tenantId, hubKey, recordId, limit: 1, member: audience === 'member' }))[0];
  return row ? publication(row) : null;
}

function aiHit(row) {
  return { sourceRecordId: row.id, rowSha256: row.rowSha256,searchRank:row.searchRank,
    canonicalVersion: row.canonicalVersion, reviewVersion: String(row.bdVersion),
    aiReviewVersion: String(row.baVersion),
    abstractDisplayVersion: row.adVersion == null ? null : String(row.adVersion),
    abstractAiReviewVersion: row.aaVersion == null ? null : String(row.aaVersion),
    title: row.title, doi: row.doi,
    sourceUrl: row.sourceUrl, sourceName: row.sourceName,
    snippet: row.abstractApproved && row.abstractAiApproved && row.abstractText
      ? row.abstractText : row.title,
    snippetField: row.abstractApproved && row.abstractAiApproved && row.abstractText
      ? 'abstract' : 'title', rowNumber: row.rowNumber,
    batchId: row.batchId, fileName: row.fileName, sheetName: row.sheetName };
}

export async function getCurrentAiHit({ db, tenantId, hubKey, principal, recordId }) {
  await assertScope({ db, tenantId, hubKey, principal, requireUser: true });
  if (typeof recordId !== 'string' || !/^rhsr-[a-f0-9]{40}$/.test(recordId)) reject();
  const row = (await approvedRows({ db, tenantId, hubKey, recordId, limit: 1, onlyAi: true, member: true }))[0];
  return row ? aiHit(row) : null;
}

export async function retrieveForAi({ db, tenantId, hubKey, principal, query, queryPlan, limit = 10 }) {
  await assertScope({ db, tenantId, hubKey, principal, requireUser: true });
  const q = String(query || '').trim().toLocaleLowerCase();
  if (agentQuestionError(query)) reject();
  return (await approvedRows({ db, tenantId, hubKey, query: q,queryPlan:queryPlan===undefined?prepareAgentHubQuery(query):queryPlan,
    limit: Math.min(20, clamp(limit)), onlyAi: true, member: true }))
    .map(aiHit);
}

export async function visibleCounts({ db, tenantId, hubKey }) {
  await assertScope({ db, tenantId, hubKey });
  const count = await db.$queryRaw`
    SELECT count(*)::integer AS total FROM rh_source.source_record
    WHERE tenant_id = ${tenantId} AND hub_key = ${hubKey}`;
  const [approved] = await db.$queryRaw`
    WITH candidate_ids AS (
      SELECT DISTINCT r.id FROM rh_source.review_decision d
      JOIN rh_source.source_record r ON r.tenant_id = d.tenant_id AND r.hub_key = d.hub_key
        AND r.source_registry_id = d.source_registry_id
        AND (r.id = d.source_record_id OR (d.source_record_id IS NULL AND r.batch_id = d.batch_id))
      WHERE d.tenant_id = ${tenantId} AND d.hub_key = ${hubKey}
        AND d.field_kind = 'bibliographic' AND d.purpose = 'display' AND d.decision = 'approve'
    )
    SELECT count(*)::integer AS display,
      count(*) FILTER (WHERE ba.decision = 'approve' AND ba.audience = 'public'
        AND (ba.expires_at IS NULL OR ba.expires_at > clock_timestamp()))::integer AS ai
    FROM candidate_ids ids JOIN rh_source.source_record r ON r.id = ids.id
    JOIN rh_source.canonical_publication c ON c.source_record_id = r.id
      AND c.tenant_id = r.tenant_id AND c.hub_key = r.hub_key
    LEFT JOIN LATERAL (
      SELECT decision, audience, expires_at FROM rh_source.review_decision d
      WHERE d.tenant_id = r.tenant_id AND d.hub_key = r.hub_key
        AND d.source_registry_id = r.source_registry_id
        AND (d.source_record_id = r.id OR (d.source_record_id IS NULL AND d.batch_id = r.batch_id))
        AND d.field_kind = 'bibliographic' AND d.purpose = 'display'
      ORDER BY decision_version DESC LIMIT 1
    ) bd ON true
    LEFT JOIN LATERAL (
      SELECT decision, audience, expires_at FROM rh_source.review_decision d
      WHERE d.tenant_id = r.tenant_id AND d.hub_key = r.hub_key
        AND d.source_registry_id = r.source_registry_id
        AND (d.source_record_id = r.id OR (d.source_record_id IS NULL AND d.batch_id = r.batch_id))
        AND d.field_kind = 'bibliographic' AND d.purpose = 'ai_retrieval'
      ORDER BY decision_version DESC LIMIT 1
    ) ba ON true
    WHERE r.tenant_id = ${tenantId} AND r.hub_key = ${hubKey}
      AND r.title IS NOT NULL AND r.validation_errors = '[]'::jsonb
      AND bd.decision = 'approve' AND bd.audience = 'public'
      AND (bd.expires_at IS NULL OR bd.expires_at > clock_timestamp())`;
  return { stagedRows: count[0].total, approvedDisplayRecords: approved.display,
    approvedAiRecords: approved.ai };
}
