import {assertApprovedInTransaction} from '../admission/service.mjs';
import { initialFive, initialDocumentId } from './initial-five.mjs';
import { registryDetailHash, validateRegistryDetails } from './registry-detail-contract.mjs';
import { checkedGuidancePayload } from './guidance-clause-service.mjs';
import {prepareHubQuery,prepareAgentHubQuery,hubQuerySql,sql,matchesHubQuery,publicationRank} from './search-projection.mjs';
import {agentQuestionError} from '../../src/agent-question.js';

const reject = () => { throw new Error('HUB_SOURCE_SCOPE_REJECTED'); };
const capped = value => Number.isSafeInteger(Number(value)) ? Math.min(20, Math.max(1, Number(value))) : 10;

async function scopeCheck({ db, tenantId, hubKey, principal, forAi = false, audience = 'public' }) {
  if (!db || typeof tenantId !== 'string' || hubKey !== 'lingshu-xinyu' ||
      !['public','member'].includes(audience) || (principal && principal.tenantId !== tenantId) || ((forAi || audience === 'member') && !principal)) reject();
  const context = await db.$queryRaw`SELECT current_setting('app.tenant_id', true) AS tenant`;
  if (context[0]?.tenant !== tenantId) reject();
  if (!forAi && audience !== 'member') return;
  const account = await db.account.findFirst({ where: {
    id: principal.accountId, tenantId, status: 'active', authVersion: principal.authVersion,
    tenant: { status: 'active' },
  }, select: { id: true } });
  if (!account) reject();
  await assertApprovedInTransaction(db,principal,hubKey);
  const access = !forAi || await db.agentAccess.findFirst({ where: {
    tenantId, accountId: principal.accountId, scopeKey: principal.accountId,
    agentId: tenantId + '-kb-research', enabled: true,
    agent: { status: 'active', type: 'research' },
  }, select: { id: true } });
  if (!access) reject();
}

async function currentRows({ db, tenantId, hubKey, documentId = null, query = '', queryPlan,
  limit = 20, forAi = false, audience = 'public', includeRegistryDetails = false, includeGuidanceDetails = false }) {
  const ids = initialFive.map(item => initialDocumentId(tenantId, hubKey, item));
  const plan=queryPlan===undefined?prepareHubQuery(query):queryPlan;
  const registry=sql`CASE WHEN ${forAi}::boolean AND ai.evidence_ref LIKE 'evidence://hub-review/%' AND registry.decision='approve' AND registry.evidence_ref=ai.evidence_ref AND (registry.expires_at IS NULL OR registry.expires_at>clock_timestamp()) THEN (registry.payload - 'registration')::text END`;
  const guidance=sql`CASE WHEN ${forAi}::boolean AND ai.evidence_ref LIKE 'evidence://hub-review/%' AND guidance.decision='approve' AND guidance.evidence_ref=ai.evidence_ref AND (guidance.expires_at IS NULL OR guidance.expires_at>clock_timestamp()) THEN guidance.payload::text END`;
  const predicate=hubQuerySql(plan,[sql`d.title`,sql`d.external_key`,sql`d.source_target_condition`,sql`s.source_name`,registry,guidance],[sql`d.external_key`]);
  const rows = await db.$queryRaw`
    SELECT d.id AS "documentId", d.document_type AS "documentType",
      d.external_key AS "externalKey", d.title,
      d.source_target_condition AS "sourceTargetCondition", d.hub_topic AS "hubTopic",
      s.source_name AS "sourceName", v.source_url AS "sourceUrl", v.source_updated_on AS "sourceUpdatedOn",
      v.id AS "versionId", v.version_number AS "versionNumber",
      v.content_sha256 AS "contentSha256",
      display.decision_version AS "reviewVersion",
      display.audience AS visibility, display.evidence_ref AS "displayEvidenceRef", ai.evidence_ref AS "aiEvidenceRef",
      ai.decision_version AS "aiReviewVersion",
      registry.id AS "registryExtractionId", registry.extraction_version AS "registryExtractionVersion",
      registry.source_sha256 AS "registrySourceSha256", registry.payload_sha256 AS "registryPayloadSha256",
      registry.payload AS "registryPayload", registry.decision_version AS "registryReviewVersion",
      registry.decision AS "registryDecision", registry.expires_at AS "registryExpiresAt",
      registry.evidence_ref AS "registryEvidenceRef",
      guidance.id AS "guidanceExtractionId",guidance.extraction_version AS "guidanceExtractionVersion",
      guidance.source_sha256 AS "guidanceSourceSha256",guidance.payload_sha256 AS "guidancePayloadSha256",
      guidance.payload AS "guidancePayload",guidance.decision_version AS "guidanceReviewVersion",
      guidance.decision AS "guidanceDecision",guidance.expires_at AS "guidanceExpiresAt"
      ,guidance.evidence_ref AS "guidanceEvidenceRef"
    FROM rh_source.external_document d
    JOIN rh_hub.hub h ON h.tenant_id = d.tenant_id AND h.hub_key = d.hub_key
      AND h.status = 'active'
    JOIN rh_source.source_registry s ON s.id = d.source_registry_id
      AND s.tenant_id = d.tenant_id AND s.hub_key = d.hub_key
    JOIN LATERAL (
      SELECT id, version_number, content_sha256, source_url, source_updated_on
      FROM rh_source.external_document_version
      WHERE tenant_id = d.tenant_id AND hub_key = d.hub_key AND document_id = d.id
      ORDER BY version_number DESC LIMIT 1
    ) v ON true
    LEFT JOIN LATERAL (
      SELECT decision_version, decision, audience, expires_at, evidence_ref
      FROM rh_source.external_review_decision
      WHERE tenant_id = d.tenant_id AND hub_key = d.hub_key AND version_id = v.id
        AND field_kind = 'bibliographic' AND purpose = 'display'
      ORDER BY decision_version DESC LIMIT 1
    ) display ON true
    LEFT JOIN LATERAL (
      SELECT decision_version, decision, audience, expires_at, evidence_ref
      FROM rh_source.external_review_decision
      WHERE tenant_id = d.tenant_id AND hub_key = d.hub_key AND version_id = v.id
        AND field_kind = 'bibliographic' AND purpose = 'ai_retrieval'
      ORDER BY decision_version DESC LIMIT 1
    ) ai ON true
    LEFT JOIN LATERAL (
      SELECT e.id, e.extraction_version, e.source_sha256, e.payload_sha256, e.payload,
             r.decision_version, r.decision, r.expires_at, r.evidence_ref
      FROM rh_source.clinical_registry_extraction e
      LEFT JOIN LATERAL (
        SELECT decision_version, decision, expires_at, evidence_ref FROM rh_source.clinical_registry_detail_review
        WHERE tenant_id=e.tenant_id AND hub_key=e.hub_key AND extraction_id=e.id
        ORDER BY decision_version DESC LIMIT 1
      ) r ON true
      WHERE ${includeRegistryDetails || forAi}::boolean AND e.tenant_id=d.tenant_id AND e.hub_key=d.hub_key
        AND e.version_id=v.id AND d.document_type='clinical_registry'
      ORDER BY e.extraction_version DESC LIMIT 1
    ) registry ON true
    LEFT JOIN LATERAL (
      SELECT e.id,e.extraction_version,e.source_sha256,e.payload_sha256,e.payload,r.decision_version,r.decision,r.expires_at,r.evidence_ref
      FROM rh_source.guidance_clause_extraction e LEFT JOIN LATERAL (
        SELECT decision_version,decision,expires_at,evidence_ref FROM rh_source.guidance_clause_review
        WHERE tenant_id=e.tenant_id AND hub_key=e.hub_key AND extraction_id=e.id ORDER BY decision_version DESC LIMIT 1
      ) r ON true WHERE ${includeGuidanceDetails || forAi}::boolean AND e.tenant_id=d.tenant_id AND e.hub_key=d.hub_key
        AND e.version_id=v.id AND d.document_type IN ('research_standard','clinical_guideline')
      ORDER BY e.extraction_version DESC LIMIT 1
    ) guidance ON true
    WHERE d.tenant_id = ${tenantId} AND d.hub_key = ${hubKey}
      AND d.selection_basis = 'user-selected-initial-data-2026-10-30'
      AND d.id = ANY(${ids}::text[])
      AND v.version_number = 1
      AND (${documentId}::text IS NULL OR d.id = ${documentId})
      AND display.decision = 'approve' AND (display.audience = 'public' OR (${audience === 'member' || forAi}::boolean AND display.audience='tenant'))
      AND (display.expires_at IS NULL OR display.expires_at > clock_timestamp())
      AND (NOT ${forAi}::boolean OR (ai.decision = 'approve' AND (ai.audience = 'public' OR ai.audience='tenant')
        AND (ai.expires_at IS NULL OR ai.expires_at > clock_timestamp())))
      AND ${predicate}
    ORDER BY d.document_type, d.external_key LIMIT ${limit}`;
  // This pilot has only the imported v1 metadata snapshot. A later file version
  // must not reuse document-level title/condition fields without a reviewed,
  // versioned metadata extraction contract.
  return rows.filter(row => initialFive.some(item =>
    row.documentId === initialDocumentId(tenantId, hubKey, item) &&
    row.contentSha256 === item.expectedSha256 &&
    row.documentType === item.documentType && row.externalKey === item.externalKey &&
    row.title === item.title && row.sourceTargetCondition === item.sourceTargetCondition &&
    row.hubTopic === item.hubTopic && row.sourceName === item.sourceName &&
    row.sourceUrl === item.sourceUrl));
}

const visible = row => ({ documentId: row.documentId, documentType: row.documentType,
  externalKey: row.externalKey, title: row.title,
  sourceTargetCondition: row.sourceTargetCondition, hubTopic: row.hubTopic,
  sourceName: row.sourceName, sourceUrl: row.sourceUrl,
  reviewVersion: String(row.reviewVersion), visibility: row.visibility });

function aiHit(row) {
  const metadata = [row.title,row.externalKey,row.sourceTargetCondition,row.sourceName].filter(Boolean).join(' · ');
  const approved = (kind) => row[`${kind}Decision`] === 'approve' &&
    (!row[`${kind}ExpiresAt`] || row[`${kind}ExpiresAt`] > new Date()) &&
    row.aiEvidenceRef?.startsWith('evidence://hub-review/') && row.aiEvidenceRef === row[`${kind}EvidenceRef`];
  const guidance = approved('guidance') && row.guidanceSourceSha256 === row.contentSha256 &&
    checkedGuidancePayload(row.guidancePayload,row.externalKey,row.guidanceSourceSha256,row.guidancePayloadSha256);
  let registry = approved('registry') && row.registrySourceSha256 === row.contentSha256 &&
    registryDetailHash(row.registryPayload) === row.registryPayloadSha256 && row.registryPayload;
  if (registry) try { validateRegistryDetails(registry,initialFive.find(x=>x.externalKey===row.externalKey)); } catch { registry=null; }
  const text = guidance ? guidance.clauses.map(x=>`${x.heading}（PDF第${x.pdfPage}页）：${x.quote}`).join('\n')
    : registry ? [...registry.design,...registry.arms.flatMap(x=>[x.name,x.sampleSize,x.intervention]),
      ...registry.outcomes.flatMap(x=>[x.name,x.englishName,x.type,x.timepoint,x.method])].filter(x=>x.value).map(x=>`${x.label}：${x.value}`).join('\n') : '';
  return { ...visible(row), versionId: row.versionId,
  versionNumber: row.versionNumber, contentSha256: row.contentSha256,
    aiReviewVersion: String(row.aiReviewVersion), snippetField: guidance ? 'guidance_clauses' : registry ? 'registry_details' : 'bibliographic',
    snippet: text ? metadata+'\n'+text : metadata };
}

export async function listVisibleExternal({ db, tenantId, hubKey, principal = null, limit = 20, audience = 'public' }) {
  await scopeCheck({ db, tenantId, hubKey, principal, audience });
  return (await currentRows({ db, tenantId, hubKey, audience, limit: capped(limit) })).map(visible);
}

export async function listVisibleClinicalRegistries({ db, tenantId, hubKey, principal = null, audience = 'public' }) {
  await scopeCheck({ db, tenantId, hubKey, principal, audience });
  return (await currentRows({ db, tenantId, hubKey, audience, limit: initialFive.length, includeRegistryDetails: true }))
    .filter(row => row.documentType === 'clinical_registry').map(row=>{
      const {structuredDetails:detail,structuredDetailsStatus}=registryProjection(row);
      // This is reviewed source-version metadata, not registration, ingestion or capture time.
      // Never fill a missing/drifted database value from the pinned pilot manifest.
      const updatedOn=row.sourceUpdatedOn?.toISOString().slice(0,10)??null;
      const sourceUpdatedOn=updatedOn===initialFive.find(x=>x.externalKey===row.externalKey)?.sourceUpdatedOn?updatedOn:null;
      return {...visible(row),sourceUpdatedOn,studySummaryStatus:structuredDetailsStatus,...(detail?{studySummary:{
        studyType:detail.design.find(x=>x.key==='studyType'),
        interventions:detail.arms.map(x=>({id:x.id,intervention:x.intervention})),
        ...(detail.registration?{leadInstitution:detail.registration.find(x=>x.key==='leadInstitution'),
          registeredOn:detail.registration.find(x=>x.key==='registeredOn')}:{}),
        extractionId:detail.extractionId,extractionVersion:detail.extractionVersion,
        payloadSha256:detail.payloadSha256,reviewVersion:detail.reviewVersion,
      }}:{})};
    });
}

export async function getVisibleClinicalRegistry({ db, tenantId, hubKey, documentId, principal = null, audience = 'public' }) {
  await scopeCheck({ db, tenantId, hubKey, principal, audience });
  if (typeof documentId !== 'string' || !/^rhed-[a-f0-9]{40}$/.test(documentId)) return null;
  // Source head, bibliographic decision, extraction head and detail decision are
  // read in one statement snapshot. No stale approval can bridge separate queries.
  const row = (await currentRows({ db, tenantId, hubKey, documentId, audience, limit: 1, includeRegistryDetails: true }))[0];
  if (row?.documentType !== 'clinical_registry') return null;
  return {...visible(row),...registryProjection(row)};
}

function registryProjection(row){
  const source = initialFive.find(item => item.externalKey === row.externalKey);
  let valid = row.registryExtractionId && row.registrySourceSha256 === row.contentSha256 &&
    registryDetailHash(row.registryPayload) === row.registryPayloadSha256;
  if (valid) try { validateRegistryDetails(row.registryPayload, source); } catch { valid = false; }
  const approved = valid && row.registryDecision === 'approve' &&
    (!/^evidence:\/\/hub-(review|display)\//.test(row.displayEvidenceRef||'') || row.registryEvidenceRef===row.displayEvidenceRef) &&
    (!row.registryExpiresAt || row.registryExpiresAt > new Date());
  return { structuredDetailsStatus: !valid ? 'unavailable' : approved ? 'approved' : 'pending_review',
    ...(approved ? { structuredDetails: {
      ...row.registryPayload, extractionId: row.registryExtractionId, extractionVersion: row.registryExtractionVersion,
      fileName: source.fileName, sourceSha256: row.registrySourceSha256, payloadSha256: row.registryPayloadSha256,
      reviewVersion: String(row.registryReviewVersion) } } : {}) };
}

export async function listVisibleClinicalRegistrySummaries({db,tenantId,hubKey,principal=null}){
  await scopeCheck({db,tenantId,hubKey,principal,audience:'public'});
  const rows=await currentRows({db,tenantId,hubKey,audience:'public',limit:initialFive.length,includeRegistryDetails:true});
  return rows.filter(row=>row.documentType==='clinical_registry').map(row=>{
    const {structuredDetails:details,structuredDetailsStatus}=registryProjection(row);
    const registration=details?.registration;
    return {...visible(row),registrationSummaryStatus:registration?'approved':structuredDetailsStatus==='approved'?'not_extracted':structuredDetailsStatus,
      ...(details?{statisticsFields:{status:'approved',design:details.design.find(field=>field.key==='design'),interventions:details.arms.map(arm=>arm.intervention),reviewVersion:details.reviewVersion,extractionVersion:details.extractionVersion,payloadSha256:details.payloadSha256}}:{}),
      ...(registration?{registrationSummary:{registeredOn:registration[0],leadInstitution:registration[1],registrationStatus:registration[2],researchStatus:'not_reported',
        snapshotDate:details.snapshotDate,fileName:details.fileName,sourceSha256:details.sourceSha256,payloadSha256:details.payloadSha256,
        extractionId:details.extractionId,extractionVersion:details.extractionVersion,reviewVersion:details.reviewVersion}}:{})};
  });
}

export async function listVisibleGuidanceDocuments({ db, tenantId, hubKey, principal = null, audience = 'public' }) {
  await scopeCheck({ db, tenantId, hubKey, principal, audience });
  return (await currentRows({ db, tenantId, hubKey, audience, limit: initialFive.length }))
    .filter(row => row.documentType === 'research_standard' || row.documentType === 'clinical_guideline')
    .map(visible);
}

export async function getVisibleGuidanceDocument({ db, tenantId, hubKey, documentId, principal = null, audience = 'public' }) {
  await scopeCheck({ db, tenantId, hubKey, principal, audience });
  if (typeof documentId !== 'string' || !/^rhed-[a-f0-9]{40}$/.test(documentId)) return null;
  const [row] = await currentRows({ db, tenantId, hubKey, documentId, audience, limit: 1, includeGuidanceDetails: true });
  if (!row || !['research_standard', 'clinical_guideline'].includes(row.documentType)) return null;
  const payload = row.guidanceExtractionId && row.guidanceSourceSha256 === row.contentSha256 &&
    checkedGuidancePayload(row.guidancePayload, row.externalKey, row.guidanceSourceSha256, row.guidancePayloadSha256);
  const approved = payload && row.guidanceDecision === 'approve' &&
    (!row.displayEvidenceRef?.startsWith('evidence://hub-review/') || row.guidanceEvidenceRef===row.displayEvidenceRef) &&
    (!row.guidanceExpiresAt || row.guidanceExpiresAt > new Date());
  return { ...visible(row), clausesStatus: !payload ? 'unavailable' : approved ? 'approved' : 'pending_review',
    ...(approved ? { clauseDetails: { ...payload, fileName: initialFive.find(s => s.externalKey === row.externalKey).fileName,
      extractionId: row.guidanceExtractionId, extractionVersion: row.guidanceExtractionVersion,
      sourceSha256: row.guidanceSourceSha256, payloadSha256: row.guidancePayloadSha256,
      reviewVersion: String(row.guidanceReviewVersion) } } : {}) };
}

export async function getCurrentExternalAiHit({ db, tenantId, hubKey, principal, documentId }) {
  await scopeCheck({ db, tenantId, hubKey, principal, forAi: true });
  if (typeof documentId !== 'string' || !/^rhed-[a-f0-9]{40}$/.test(documentId)) reject();
  const rows = await currentRows({ db, tenantId, hubKey, documentId, forAi: true, limit: 1 });
  return rows[0] ? aiHit(rows[0]) : null;
}

export async function retrieveExternalForAi({ db, tenantId, hubKey, principal, query, queryPlan, limit = 10 }) {
  await scopeCheck({ db, tenantId, hubKey, principal, forAi: true });
  const q = String(query || '').trim().toLocaleLowerCase();
  if (agentQuestionError(query)) reject();
  const plan=queryPlan===undefined?prepareAgentHubQuery(query):queryPlan;
  return (await currentRows({ db, tenantId, hubKey, query: q,queryPlan:plan, limit: initialFive.length, forAi: true })).map(aiHit)
    .filter(hit=>matchesHubQuery(plan,[hit.snippet],[hit.externalKey])).map(hit=>({...hit,searchRank:publicationRank(plan,[hit.snippet])})).sort((a,b)=>a.searchRank-b.searchRank||(a.documentId<b.documentId?-1:a.documentId>b.documentId?1:0)).slice(0,capped(limit));
}
