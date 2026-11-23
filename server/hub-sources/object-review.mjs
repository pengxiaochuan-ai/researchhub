import { createHash } from 'node:crypto';
import { assertCurrentReviewer, listReviewBatches, listBatchSources, listReviewRows } from './review-service.mjs';
import { listExternalReviewItems } from './external-preview.mjs';
import { listPmcReviewItems } from './pmc-review-service.mjs';

const fail = code => { throw new Error(code); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{4,100}$/.test(value);
const actionRef = /^evidence:\/\/hub-review\/[a-f0-9-]{36}\/[a-f0-9]{64}$/;
const displayRef = /^evidence:\/\/hub-display\/[a-f0-9-]{36}\/[a-f0-9]{64}$/;
const names = { pending: '待审核', partial: '待统一核对', public: '公开页面与AI', tenant: '仅租户内页面与AI',
  withheld: '暂不放行', changed: '新增内容待核对', unavailable: '待补齐内容' };
const slotKey = x => `${x.fieldKind}:${x.purpose}`;

export function objectReviewState(decisions, fields = ['bibliographic']) {
  if (!decisions.length) return { status: 'pending', label: names.pending };
  const expected = fields.flatMap(fieldKind => ['registry_details', 'guidance_clauses'].includes(fieldKind)
    ? [`${fieldKind}:display`] : [`${fieldKind}:display`, `${fieldKind}:ai_retrieval`]);
  const slots = expected.map(key => decisions.find(x => slotKey(x) === key));
  const reference = slots[0]?.evidenceRef;
  let status = 'partial';
  if (reference && actionRef.test(reference) && slots.every(x => x && x.evidenceRef === reference)) {
    if (slots.every(x => x.decision === 'revoke')) status = 'withheld';
    else if (slots.every(x => x.decision === 'approve' && (!x.expiresAt || new Date(x.expiresAt) > new Date()))) {
      const bibliographic = slots.filter(x => x.fieldKind === 'bibliographic');
      if (bibliographic.every(x => x.audience === 'public')) status = 'public';
      if (bibliographic.every(x => x.audience === 'tenant')) status = 'tenant';
    }
  }
  return { status, label: names[status], ...(status !== 'partial' ? { reference } : {}) };
}

export function externalReviewFingerprint(item) {
  const extraction = value => value ? [value.extractionId, value.payloadSha256, value.sourceSha256] : null;
  return hash({ id: item.id, versionId: item.versionId, sha256: item.sha256, title: item.title,
    externalKey: item.externalKey, sourceName: item.sourceName, sourceUrl: item.sourceUrl,
    structured: extraction(item.structuredExtraction), guidance: extraction(item.guidanceExtraction),
    decisions: [...item.decisions].sort((a, b) => slotKey(a).localeCompare(slotKey(b))).map(x =>
      [slotKey(x), x.version, x.decision, x.audience, x.expiresAt, x.evidenceRef]) });
}
const externalFields = item => ['bibliographic', ...(item.structuredExtraction ? ['registry_details'] : []),
  ...(item.guidanceExtraction ? ['guidance_clauses'] : [])];
const effective = d => d?.decision === 'approve' && (!d.expiresAt || new Date(d.expiresAt) > new Date());
const clinicalDisplayScope = item => item.documentType === 'clinical_registry' &&
  ['ChiCTR2300073486','ChiCTR2300077209'].includes(item.externalKey) && item.versionNumber === 1 &&
  item.structuredExtraction?.extractionVersion === 2 && item.structuredExtraction.payload.schemaVersion === 2;
const aiApproved = item => item.decisions.some(d => d.fieldKind === 'bibliographic' &&
  d.purpose === 'ai_retrieval' && ['public','tenant'].includes(d.audience) && effective(d));
function externalState(item) {
  const display=item.decisions.find(d=>d.fieldKind==='bibliographic'&&d.purpose==='display');
  const detail=item.structuredExtraction?.review;
  if(clinicalDisplayScope(item)&&!aiApproved(item)&&effective(display)&&display.audience==='public'&&
    effective(detail)&&displayRef.test(display.evidenceRef)&&detail.evidenceRef===display.evidenceRef)
    return {status:'public_display',label:'公开展示；AI未获准',reference:display.evidenceRef};
  return objectReviewState(item.decisions,externalFields(item));
}

async function namedReviewer(args, lock = false) {
  const { db, principal, tenantId, reviewerAccountId } = args;
  if (!principal || principal.accountId !== reviewerAccountId || principal.tenantId !== tenantId)
    fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');
  if (lock) {
    await db.$queryRaw`SELECT rh_source.hold_review_grants_for_commit()`;
    await db.$queryRaw`SELECT a.id FROM account a JOIN tenant t ON t.id=a."tenantId"
      WHERE a.id=${principal.accountId} AND a."tenantId"=${tenantId} FOR SHARE OF a,t`;
  }
  await assertCurrentReviewer(args);
}

export async function workbookReviewScope(args) {
  await namedReviewer(args);
  const { db, tenantId, hubKey, batchId, sourceRegistryId, sourceRecordId = null } = args;
  if (!validId(batchId) || !validId(sourceRegistryId) || (sourceRecordId != null && !validId(sourceRecordId)))
    fail('HUB_SOURCE_SCOPE_REJECTED');
  const [summary] = await db.$queryRaw`
    SELECT b.id AS "batchId",b.file_name AS "fileName",b.file_sha256 AS "fileSha256",
      s.id AS "sourceRegistryId",s.source_name AS "sourceName",
      count(*)::integer AS "rowCount",
      count(*) FILTER (WHERE r.validation_errors='[]'::jsonb AND r.title IS NOT NULL)::integer AS "eligibleBibliographic",
      count(*) FILTER (WHERE r.validation_errors='[]'::jsonb AND r.title IS NOT NULL AND r.abstract_text IS NOT NULL)::integer AS "eligibleAbstract",
      encode(sha256(convert_to(string_agg(encode(sha256(convert_to(jsonb_build_array(
        r.id,r.row_sha256,r.validation_errors,r.title,r.authors,r.journal,r.publication_year,r.doi,r.source_url,r.abstract_text
      )::text,'UTF8')),'hex'),'|' ORDER BY r.id),'UTF8')),'hex') AS "contentFingerprint"
    FROM rh_source.source_record r JOIN rh_source.import_batch b ON b.id=r.batch_id AND b.tenant_id=r.tenant_id AND b.hub_key=r.hub_key
    JOIN rh_source.source_registry s ON s.id=r.source_registry_id AND s.tenant_id=r.tenant_id AND s.hub_key=r.hub_key
    WHERE r.tenant_id=${tenantId} AND r.hub_key=${hubKey} AND r.batch_id=${batchId}
      AND r.source_registry_id=${sourceRegistryId} AND b.status='staged'
      AND (${sourceRecordId}::text IS NULL OR r.id=${sourceRecordId})
    GROUP BY b.id,s.id`;
  if (!summary) fail('HUB_SOURCE_SCOPE_REJECTED');
  const decisions = await db.$queryRaw`
    SELECT DISTINCT ON (d.field_kind,d.purpose) d.field_kind AS "fieldKind",d.purpose,d.decision,d.audience,
      d.decision_version AS version,d.evidence_ref AS "evidenceRef",d.expires_at AS "expiresAt",d.created_at AS "createdAt",
      d.reviewer_id AS "reviewerId"
    FROM rh_source.review_decision d WHERE d.tenant_id=${tenantId} AND d.hub_key=${hubKey}
      AND d.source_registry_id=${sourceRegistryId}
      AND ((d.source_record_id IS NULL AND d.batch_id=${batchId}) OR
        (${sourceRecordId}::text IS NOT NULL AND d.source_record_id=${sourceRecordId}))
    ORDER BY d.field_kind,d.purpose,d.decision_version DESC`;
  const [overlap] = await db.$queryRaw`
    SELECT coalesce(max(d.decision_version),0)::text AS version
    FROM rh_source.review_decision d WHERE d.tenant_id=${tenantId} AND d.hub_key=${hubKey}
      AND d.source_registry_id=${sourceRegistryId} AND d.source_record_id IN (
        SELECT id FROM rh_source.source_record WHERE tenant_id=${tenantId} AND hub_key=${hubKey}
          AND batch_id=${batchId} AND source_registry_id=${sourceRegistryId}
          AND (${sourceRecordId}::text IS NULL OR id=${sourceRecordId}))`;
  const fields = ['bibliographic', ...(summary.eligibleAbstract ? ['abstract'] : [])];
  const serialized = decisions.map(x => ({ ...x, version: String(x.version),
    expiresAt: x.expiresAt?.toISOString() ?? null, createdAt: x.createdAt.toISOString() }));
  let state = objectReviewState(serialized, fields);
  if (!sourceRecordId && BigInt(overlap.version) > BigInt(decisions.reduce((min, x) =>
    BigInt(x.version) < min ? BigInt(x.version) : min, decisions.length ? BigInt(decisions[0].version) : 0n)))
    state = { status: 'partial', label: '含单行决定，待统一核对' };
  if (!summary.eligibleBibliographic) state = { status: 'unavailable', label: '没有合格记录' };
  const fingerprint = hash({ ...summary, sourceRecordId, decisions: serialized, rowReviewVersion: overlap.version });
  return { ...summary, sourceRecordId, fingerprint, state, decisions: serialized,
    excludedCount: summary.rowCount - summary.eligibleBibliographic };
}

export async function listObjectReviewQueue(args) {
  await namedReviewer(args);
  const [pmc, external, batches] = await Promise.all([
    listPmcReviewItems(args), listExternalReviewItems(args), listReviewBatches(args),
  ]);
  const workbooks = [];
  for (const batch of batches) {
    const sources = await listBatchSources({ ...args, batchId: batch.id });
    for (const source of sources) workbooks.push(await workbookReviewScope({ ...args,
      batchId: batch.id, sourceRegistryId: source.sourceRegistryId }));
  }
  return [
    ...pmc.map(item => {
      const changed = item.articleDecision && item.articleDecision.visibility !== 'withheld' && item.assets.some(asset =>
        ['image','supplement'].includes(asset.assetKind) && !item.articleDecision.assetSnapshot?.some(x => x.id === asset.id && x.sha256 === asset.sha256));
      const status = !item.versionId ? 'unavailable' : changed ? 'changed' : item.articleDecision?.visibility || 'pending';
      return { key: `pmc:${item.candidateId}`, kind: 'pmc', title: item.title || item.pmcid,
        subtitle: item.pmcid, state: { status, label: names[status] }, detail: item };
    }),
    ...external.map(item => ({ key: `external:${item.id}`, kind: 'external', title: item.title,
      subtitle: item.externalKey, state: externalState(item),
      canUpdateDisplayOnly: clinicalDisplayScope(item) && !aiApproved(item),
      fingerprint: externalReviewFingerprint(item), detail: item })),
    ...workbooks.map(item => ({ key: `workbook:${item.batchId}:${item.sourceRegistryId}`, kind: 'workbook',
      title: item.sourceName, subtitle: `${item.fileName} · ${item.rowCount.toLocaleString()} 行`, state: item.state,
      fingerprint: item.fingerprint, detail: item })),
  ];
}

export async function submitObjectReview(args) {
  const { db, principal, tenantId, hubKey, input } = args;
  await namedReviewer(args, true);
  if (!input || !['external','workbook'].includes(input.kind) ||
      (input.mode !== undefined && input.mode !== 'display_only') ||
      (input.mode === 'display_only' && (input.kind !== 'external' || input.visibility !== 'public')) ||
      !['public','tenant','withheld'].includes(input.visibility) ||
      !/^[a-f0-9]{64}$/.test(input.expectedFingerprint ?? '') ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.operationId ?? ''))
    fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
  const displayOnly=input.mode==='display_only';
  const reference = `evidence://${displayOnly?'hub-display':'hub-review'}/${input.operationId}/${input.expectedFingerprint}`;
  const decision = input.visibility === 'withheld' ? 'revoke' : 'approve';
  const audience = input.visibility === 'public' ? 'public' : 'tenant';
  if (input.kind === 'external') {
    if (!validId(input.documentId)) fail('HUB_SOURCE_SCOPE_REJECTED');
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ':' + hubKey + ':' + input.documentId},0))`;
    const item = (await listExternalReviewItems(args)).find(x => x.id === input.documentId);
    if (!item) fail('HUB_SOURCE_SCOPE_REJECTED');
    if(displayOnly&&!clinicalDisplayScope(item))fail('HUB_SOURCE_SCOPE_REJECTED');
    const state = externalState(item);
    if (state.reference === reference && state.status === (displayOnly?'public_display':input.visibility)) return { visibility: state.status, replayed: true };
    if (externalReviewFingerprint(item) !== input.expectedFingerprint) fail('HUB_SOURCE_VERSION_CONFLICT');
    // Never migrate an existing AI authorization to a new extraction implicitly.
    // A fully current unified approval needs no write; all other active-AI cases stop.
    if(displayOnly&&aiApproved(item)) {
      if(state.status==='public')return {visibility:'public',replayed:true};
      fail('HUB_SOURCE_DISPLAY_AI_REVIEW_REQUIRED');
    }
    let displayDecision;
    for (const purpose of displayOnly?['display']:['display','ai_retrieval']) {
      const [recorded] = await db.$queryRaw`
      INSERT INTO rh_source.external_review_decision
        (tenant_id,hub_key,version_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id)
      VALUES (${tenantId},${hubKey},${item.versionId},'bibliographic',${purpose},${audience},${decision},${reference},${principal.accountId})
      RETURNING decision_version, created_at AS "createdAt"`;
      if (purpose === 'display') displayDecision = recorded;
    }
    if (item.structuredExtraction) await db.$queryRaw`
      INSERT INTO rh_source.clinical_registry_detail_review (tenant_id,hub_key,extraction_id,decision,evidence_ref,reviewer_id)
      VALUES (${tenantId},${hubKey},${item.structuredExtraction.extractionId},${decision},${reference},${principal.accountId}) RETURNING decision_version`;
    if (item.guidanceExtraction) await db.$queryRaw`
      INSERT INTO rh_source.guidance_clause_review (tenant_id,hub_key,extraction_id,decision,evidence_ref,reviewer_id)
      VALUES (${tenantId},${hubKey},${item.guidanceExtraction.extractionId},${decision},${reference},${principal.accountId}) RETURNING decision_version`;
    if (input.visibility === 'public' && args.recordPublicApproval) {
      await args.recordPublicApproval(db, {tenantId, hubKey}, {documentId:item.id, decisionVersion:displayDecision.decision_version, createdAt:displayDecision.createdAt});
    }
    return { visibility: input.visibility, documentId: item.id, confirmedCount: 1 };
  }
  if (!validId(input.sourceRegistryId)) fail('HUB_SOURCE_SCOPE_REJECTED');
  await db.$queryRaw`SELECT id FROM rh_source.source_registry WHERE id=${input.sourceRegistryId}
    AND tenant_id=${tenantId} AND hub_key=${hubKey} FOR UPDATE`;
  const scope = await workbookReviewScope({ ...args, batchId: input.batchId,
    sourceRegistryId: input.sourceRegistryId, sourceRecordId: input.sourceRecordId ?? null });
  if (scope.state.reference === reference && scope.state.status === input.visibility) return { visibility: input.visibility, replayed: true };
  if (scope.fingerprint !== input.expectedFingerprint) fail('HUB_SOURCE_VERSION_CONFLICT');
  if (!scope.eligibleBibliographic) fail('HUB_SOURCE_RECORD_INVALID');
  for (const fieldKind of ['bibliographic', ...(scope.eligibleAbstract ? ['abstract'] : [])]) {
    for (const purpose of ['display','ai_retrieval']) await db.$queryRaw`
      INSERT INTO rh_source.review_decision
        (tenant_id,hub_key,source_registry_id,batch_id,source_record_id,field_kind,purpose,decision,audience,evidence_ref,reviewer_id,confirmed_count)
      VALUES (${tenantId},${hubKey},${input.sourceRegistryId},${scope.sourceRecordId ? null : input.batchId},${scope.sourceRecordId},
        ${fieldKind},${purpose},${decision},${audience},${reference},${principal.accountId},${fieldKind === 'abstract' ? scope.eligibleAbstract : scope.eligibleBibliographic})
      RETURNING decision_version`;
  }
  return { visibility: input.visibility, confirmedCount: scope.eligibleBibliographic, excludedCount: scope.excludedCount };
}

export async function getWorkbookReviewDetail(args) {
  const scope = await workbookReviewScope(args);
  const page = await listReviewRows(args);
  return { scope, ...page };
}
