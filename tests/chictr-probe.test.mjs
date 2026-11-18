import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const module = await import('../scripts/qiyan-chictr-probe.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

test('entry probe identifies a JavaScript cookie reload as an access check, not trial data', async () => {
  assert.equal(typeof module.probeChictrEntry, 'function', 'entry probe not implemented');
  let calls = 0;
  const result = await module.probeChictrEntry({fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://www.chictr.org.cn/searchproj.html');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers, undefined);
    return new Response('<html><script>document.cookie="private-challenge"; location.reload();</script></html>', {
      status: 200, headers: {'content-type': 'text/html; charset=utf-8', 'set-cookie': 'never-emit-this'},
    });
  }});
  assert.equal(result.classification, 'javascript-access-check');
  assert.equal(result.status, 200);
  assert.equal(result.c01Passed, false);
  assert.equal(calls, 1);
  assert.match(result.responseSha256, /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(result).includes('private-challenge'));
  assert(!JSON.stringify(result).includes('never-emit-this'));
});

test('entry HTML without a check is still not proof of search and detail capability', async () => {
  assert.equal(typeof module.probeChictrEntry, 'function');
  const result = await module.probeChictrEntry({fetchImpl: async () => new Response('<html><table><tr><td>registered trial</td></tr></table></html>', {headers: {'content-type': 'text/html'}})});
  assert.equal(result.classification, 'unverified-html');
  assert.equal(result.c01Passed, false);
});

test('entry probe never follows redirects or retries an HTTP failure', async () => {
  assert.equal(typeof module.probeChictrEntry, 'function');
  let calls = 0;
  const result = await module.probeChictrEntry({fetchImpl: async () => {
    calls++;
    return new Response('not trial data', {status: 302, headers: {location: 'http://127.0.0.1/private'}});
  }});
  assert.equal(result.classification, 'http-error');
  assert.equal(result.status, 302);
  assert.equal(calls, 1);
  assert(!JSON.stringify(result).includes('/private'));
});

test('entry probe closes an oversized body and does not publish its content', async () => {
  assert.equal(typeof module.probeChictrEntry, 'function');
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1));},
    cancel() {cancelled = true;},
  });
  const result = await module.probeChictrEntry({fetchImpl: async () => new Response(body, {headers: {'content-type': 'text/html'}})});
  assert.equal(result.classification, 'response-too-large');
  assert.equal(cancelled, true);
  assert.equal(result.responseSha256, undefined);
});

test('entry probe honours cancellation without sending a request', async () => {
  assert.equal(typeof module.probeChictrEntry, 'function');
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  const result = await module.probeChictrEntry({signal: controller.signal, fetchImpl: async () => {calls++; throw Error('unexpected');}});
  assert.equal(calls, 0);
  assert.equal(result.classification, 'cancelled');
});

test('entry probe does not expose credentials embedded in network errors', async () => {
  const result = await module.probeChictrEntry({fetchImpl: async () => {throw Error('secret-credential-in-error');}});
  assert.equal(result.classification, 'network-error');
  assert(!JSON.stringify(result).includes('secret-credential'));
});

test('entry probe closes a non-HTML response rather than parsing it as a trial', async () => {
  let cancelled = false;
  const body = new ReadableStream({cancel() {cancelled = true;}});
  const result = await module.probeChictrEntry({fetchImpl: async () => new Response(body, {headers: {'content-type': 'application/json'}})});
  assert.equal(result.classification, 'unexpected-content-type');
  assert.equal(cancelled, true);
});

test('CLI requires explicit live intent and does not probe on an ordinary invocation', () => {
  const result = spawnSync(process.execPath, ['scripts/qiyan-chictr-probe.mjs'], {encoding: 'utf8', timeout: 2000});
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--live/);
});
