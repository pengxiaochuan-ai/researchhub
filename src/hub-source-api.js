export function isHubSourceRealMode() {
  if (!import.meta.env.VITE_AUTH_TENANT_SLUG) return false;
  try { return sessionStorage.getItem('lingshu-demo-mode') !== 'true'; }
  catch { return true; }
}

export async function hubSourceRequest(path, options = {}) {
  const response = await fetch(`/api/hub-sources/${path}`, {
    credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || `请求失败（${response.status}）`);
    error.status = response.status; error.code = body.code;
    throw error;
  }
  return response.json();
}

// Member projection contains public and same-tenant content. Anonymous readers
// fall back only after an authentication denial, never after a source failure.
export async function hubVisibleRequest(path,options={}) {
  try { return await hubSourceRequest(`member/${path}`,options); }
  catch(error) { if(![401,403].includes(error.status)) throw error; }
  return hubSourceRequest(path,options);
}

export function latestReviewVersion(history, { batchId, sourceRecordId = null, fieldKind, purpose }) {
  const matching = history.filter(item => item.batchId === (sourceRecordId ? null : batchId) &&
    item.sourceRecordId === sourceRecordId && item.fieldKind === fieldKind && item.purpose === purpose);
  return matching.at(-1)?.version || '0';
}

export function reviewPayload({ batchId, sourceRegistryId, sourceRecordId = null,
  fieldKind, purpose, decision, audience, evidenceRef, homogeneousRightsConfirmed,
  eligibleCount, rowCount, expectedVersion }) {
  return { batchId, sourceRegistryId, sourceRecordId, fieldKind, purpose, decision,
    audience, evidenceRef: evidenceRef.trim(), confirmedCount: sourceRecordId ? 1 : eligibleCount,
    excludedCount: sourceRecordId ? 0 : rowCount - eligibleCount,
    homogeneousRightsConfirmed: sourceRecordId ? false : homogeneousRightsConfirmed,
    expectedVersion };
}

export function publicationHref(recordId) {
  if (typeof recordId !== 'string' || !(/^(rhsr-[a-f0-9]{40}|pmc-PMC[1-9][0-9]{0,10})$/.test(recordId)))
    throw new Error('HUB_SOURCE_RECORD_ID_REJECTED');
  return `/pages/e02/?recordId=${recordId}`;
}

export function clinicalRegistryHref(documentId) {
  if (typeof documentId !== 'string' || !/^rhed-[a-f0-9]{40}$/.test(documentId))
    throw new Error('HUB_REGISTRY_DOCUMENT_ID_REJECTED');
  return `/pages/c03/?documentId=${documentId}`;
}
