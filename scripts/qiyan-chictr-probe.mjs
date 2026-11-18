import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const ENTRY = 'https://www.chictr.org.cn/searchproj.html';
const MAX_BYTES = 8 * 1024 * 1024;

// Entry diagnostics only: this never executes site scripts, copies cookies,
// resolves trial IDs or declares the complete search/detail gate passed.
export async function probeChictrEntry({fetchImpl = fetch, signal} = {}) {
  const startedAt = new Date().toISOString();
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const base = {url: ENTRY, startedAt, c01Passed: false};
  let status;
  const result = values => ({...base, ...values, endedAt: new Date().toISOString()});
  try {
    requestSignal.throwIfAborted();
    const response = await fetchImpl(ENTRY, {redirect: 'manual', signal: requestSignal});
    status = response.status;
    const contentType = response.headers.get('content-type') ?? '';
    if (status !== 200) {
      await response.body?.cancel();
      return result({status, classification: 'http-error'});
    }
    if (!/^text\/html(?:;|$)/i.test(contentType)) {
      await response.body?.cancel();
      return result({status, classification: 'unexpected-content-type'});
    }
    const reader = response.body?.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      if (reader) for (;;) {
        requestSignal.throwIfAborted();
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          return result({status, classification: 'response-too-large'});
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader?.releaseLock();
    }
    requestSignal.throwIfAborted();
    const body = Buffer.concat(chunks);
    const html = body.toString('utf8');
    const check = /<script\b/i.test(html) && /document\.cookie|setCookie\s*\(/i.test(html) && /location\b|reload\s*\(/i.test(html);
    return result({status, contentType, bytes, responseSha256: createHash('sha256').update(body).digest('hex'),
      classification: check ? 'javascript-access-check' : 'unverified-html'});
  } catch {
    return result({...(status === undefined ? {} : {status}),
      classification: signal?.aborted ? 'cancelled' : timeout.aborted ? 'timeout' : 'network-error'});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--live') {
    console.error('Usage: node scripts/qiyan-chictr-probe.mjs --live (one public GET; no cookies, redirects or retries)');
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify(await probeChictrEntry(), null, 2));
    process.exitCode = 3; // An entry probe alone cannot pass the C01 capability gate.
  }
}
