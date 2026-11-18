import {createHash} from 'node:crypto';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
// JSONB reorders object properties. Object order must not invalidate a source.
export const materialDigest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const version = value => Number.isSafeInteger(value) && value > 0;
const scopeFields = ['tenantId','accountId','studyGroupId','researchProjectId'];
const fail = (code,status=409) => {throw Object.assign(Error(code),{code,status});};

// Request refs contain identifiers only. Storage paths and authorization facts
// must come from the current server-side records, never from browser input.
export function normalizeMaterialRefs(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) fail('HUB_MATERIAL_REFS_INVALID',400);
  const refs = new Map();
  for (const ref of value) {
    if (!ref || Object.keys(ref).length !== 2 || !Object.hasOwn(ref,'materialId') || !Object.hasOwn(ref,'version') ||
      !id(ref.materialId) || !version(ref.version)) fail('HUB_MATERIAL_REFS_INVALID',400);
    if (refs.has(ref.materialId) && refs.get(ref.materialId) !== ref.version) fail('HUB_MATERIAL_REFS_INVALID',400);
    refs.set(ref.materialId,ref.version);
  }
  return [...refs].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([materialId,version])=>({materialId,version}));
}

// Pure snapshot contract, not an authorization service. The caller must load
// these facts under the current authenticated account, session and RLS scope,
// and revalidate them before every tool call, publication and history read.
export function freezePrivateMaterials({principal,sessionId,refs,records}) {
  if (!scopeFields.every(key=>id(principal?.[key])) || !id(sessionId) || !Array.isArray(records)) fail('HUB_MATERIAL_UNAVAILABLE');
  const selected = normalizeMaterialRefs(refs).map(ref=>{
    const matches = records.filter(row=>row?.id===ref.materialId);
    if (matches.length !== 1) fail('HUB_MATERIAL_UNAVAILABLE');
    const row = matches[0];
    if (!scopeFields.every(key=>row[key]===principal[key]) || row.sessionId!==sessionId || row.version!==ref.version ||
      row.purpose!=='knowledge' || row.state!=='ready' || row.kbVisibility!=='private' ||
      row.kbOwnerAccountId!==principal.accountId || row.kbTenantId!==principal.tenantId ||
      row.kbStudyGroupId!==principal.studyGroupId || row.kbResearchProjectId!==principal.researchProjectId ||
      row.sourceKbId!==row.kbId || row.sourceDocId!==row.docId || row.docKbId!==row.kbId ||
      row.sourceTenantId!==principal.tenantId || row.sourceStudyGroupId!==principal.studyGroupId || row.sourceCreatedBy!==principal.accountId ||
      row.docTenantId!==principal.tenantId || row.docStudyGroupId!==principal.studyGroupId ||
      row.safetyLevel!=='allow' || row.trashedAt!==null || row.deletedAt!==null ||
      !['draft','published'].includes(row.docStatus) || !id(row.kbId) || !id(row.sourceFileId) || !id(row.docId) ||
      !version(row.docVersion) || !sha(row.sourceSha256) || !sha(row.contentSha256)) fail('HUB_MATERIAL_UNAVAILABLE');
    return Object.freeze({materialId:row.id,version:row.version,kbId:row.kbId,sourceFileId:row.sourceFileId,
      sourceSha256:row.sourceSha256,docId:row.docId,docVersion:row.docVersion,contentSha256:row.contentSha256});
  });
  const body = {schema:'hub-private-materials.v1',principal:Object.freeze(Object.fromEntries(scopeFields.map(key=>[key,principal[key]]))),
    sessionId,materials:Object.freeze(selected)};
  return Object.freeze({...body,hash:materialDigest(body)});
}
