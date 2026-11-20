function articleTaskContext(key: string | undefined, payload: unknown): boolean {
  if (typeof key !== 'string' || !key.startsWith('hub-article:v1:') || Buffer.byteLength(key) > 768 || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  try {
    const binding = JSON.parse(Buffer.from(key.slice('hub-article:v1:'.length), 'base64url').toString('utf8'));
    const fields = ['recordId', 'articleVersion', 'rawSha256', 'reviewVersion'];
    if (!binding || typeof binding !== 'object' || Array.isArray(binding) || Object.keys(binding).length !== 4 || !fields.every(k => typeof binding[k] === 'string')) return false;
    if (!/^pmc-PMC[1-9][0-9]{0,10}$/.test(binding.recordId) || !new RegExp('^' + binding.recordId.slice(4) + '[.][1-9][0-9]{0,2}$').test(binding.articleVersion) || !/^[a-f0-9]{64}$/.test(binding.rawSha256) || !/^(?:article:)?[1-9][0-9]{0,18}$/.test(binding.reviewVersion)) return false;
    const canonical = JSON.stringify(Object.fromEntries(fields.map(k => [k, binding[k]])));
    if (key !== 'hub-article:v1:' + Buffer.from(canonical).toString('base64url')) return false;
    const input = payload as Record<string, unknown>;
    const pack = input.articleEvidence as {binding?: Record<string, unknown>; source?: Record<string, unknown>; packHash?: string} | undefined;
    if (!pack || !pack.binding || Object.keys(pack.binding).length !== 4 || !fields.every(k => pack.binding![k] === binding[k]) || !/^[a-f0-9]{64}$/.test(pack.packHash ?? '') || !/^[a-f0-9]{64}$/.test(String(input.articleInputHash ?? ''))) return false;
    if (!pack.source || pack.source.pmcRecordId !== binding.recordId || !fields.slice(1).every(k => pack.source![k] === binding[k])) return false;
    return Array.isArray(input.kbIds) && input.kbIds.length === 0 && Array.isArray(input.attachments) && input.attachments.length === 0;
  } catch { return false; }
}
