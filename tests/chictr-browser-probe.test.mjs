import test from 'node:test';
import assert from 'node:assert/strict';

const implementation = await import('../scripts/qiyan-chictr-browser-probe.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});

// Catches accidental access to another domain, local service, credentials or write API.
test('browser probe permits only fixed official HTTPS read resources and search form submission', () => {
  assert.equal(typeof implementation.permittedRequest, 'function', 'browser request policy missing');
  for (const [url, method, expected] of [
    ['https://www.chictr.org.cn/searchproj.html', 'GET', true],
    ['https://www.chictr.org.cn/js/main.js', 'GET', true],
    ['https://www.chictr.org.cn/searchproj.html', 'POST', true],
    ['https://www.chictr.org.cn/admin/delete', 'POST', false],
    ['https://www.chictr.org.cn/searchproj.html', 'DELETE', false],
    ['http://www.chictr.org.cn/searchproj.html', 'GET', false],
    ['https://www.chictr.org.cn:8443/searchproj.html', 'GET', false],
    ['https://secret@www.chictr.org.cn/searchproj.html', 'GET', false],
    ['https://www.chictr.org.cn.attacker.test/', 'GET', false],
    ['http://127.0.0.1:19501/', 'GET', false],
    ['file:///etc/hosts', 'GET', false],
  ]) assert.equal(implementation.permittedRequest(url, method), expected, `${method} ${url}`);
});

function harness({failure = false} = {}) {
  const events = [];
  const page = {
    setDefaultTimeout() {},
    async goto(url) {events.push(['goto', url]); if (failure) throw Error('private-cookie-in-error');},
  };
  const context = {
    async route(pattern, handler) {events.push(['route', pattern]);},
    async newPage() {return page;},
    async close() {events.push(['close-context']);},
  };
  const browser = {
    async newContext(options) {events.push(['context', options]); return context;},
    async close() {events.push(['close-browser']);},
  };
  return {events, chromium: {async launch(options) {events.push(['launch', options]); return browser;}}};
}

// Catches persistent profile reuse or resource leaks after real network failure.
test('isolated browser lifecycle closes context and browser even when navigation fails', async () => {
  assert.equal(typeof implementation.withChictrBrowser, 'function', 'isolated browser lifecycle missing');
  const h = harness({failure: true});
  await assert.rejects(implementation.withChictrBrowser({chromium: h.chromium, executablePath: '/test/chrome'}, async page => {
    await page.goto('https://www.chictr.org.cn/searchproj.html');
  }), /private-cookie-in-error/);
  const options = h.events.find(x => x[0] === 'context')[1];
  assert.equal(options.storageState, undefined);
  assert.equal(options.serviceWorkers, 'block');
  assert.equal(options.acceptDownloads, false);
  assert.deepEqual(h.events.slice(-2), [['close-context'], ['close-browser']]);
});

test('pre-cancelled browser probe never launches a browser', async () => {
  assert.equal(typeof implementation.withChictrBrowser, 'function');
  const h = harness();
  await assert.rejects(implementation.withChictrBrowser({chromium: h.chromium, signal: AbortSignal.abort()}, async () => {}));
  assert.equal(h.events.length, 0);
});

test('diagnostic can compare a visible native browser without altering the isolation policy', async () => {
  const h = harness();
  await implementation.withChictrBrowser({chromium: h.chromium, executablePath: '/test/chrome', headless: false}, async () => {});
  const options = h.events.find(x => x[0] === 'launch')[1];
  assert.equal(options.headless, false);
  assert.equal(options.chromiumSandbox, true);
  assert.equal(options.args, undefined);
  assert.equal(options.proxy, undefined);
  assert.deepEqual(h.events.slice(-2), [['close-context'], ['close-browser']]);
});

test('local verification loads a usable Chromium launcher from the installed Playwright module', async () => {
  assert.equal(typeof implementation.loadChictrProbeChromium, 'function', 'local module binding missing');
  const chromium = await implementation.loadChictrProbeChromium();
  assert.equal(typeof chromium.launch, 'function');
});

// Catches a WAF denial being presented as an ordinary page or an empty result.
test('source 405 denial and a 200 captcha page remain explicit access failures', () => {
  assert.equal(typeof implementation.classifyBrowserPage, 'function', 'browser response classification missing');
  assert.equal(implementation.classifyBrowserPage({status: 405, body: '很抱歉，您的访问被阻断。'}), 'access-restricted');
  assert.equal(implementation.classifyBrowserPage({status: 200, body: '请输入验证码'}), 'access-restricted');
  assert.equal(implementation.classifyBrowserPage({status: 200, body: '注册题目 正式科学名'}), 'unverified-browser-html');
  assert.equal(implementation.classifyBrowserPage({status: 500, body: 'server failed'}), 'http-error');
});
