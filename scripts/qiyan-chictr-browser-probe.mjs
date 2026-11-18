import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export async function loadChictrProbeChromium() {
  // Explicit local verification dependency only; no install or legacy writes.
  const playwright = await import(pathToFileURL('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'));
  return playwright.chromium ?? playwright.default.chromium;
}

export function permittedRequest(value, method) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.chictr.org.cn' &&
      !url.port && !url.username && !url.password &&
      (method === 'GET' || method === 'POST' && url.pathname === '/searchproj.html');
  } catch {return false;}
}

export function classifyBrowserPage({status, body}) {
  if ([401, 403, 405, 429].includes(status) || /验证码|访问频繁|访问被阻断|Access Denied|captcha/i.test(body)) return 'access-restricted';
  return status === 200 ? 'unverified-browser-html' : 'http-error';
}

// Local C01 diagnostic, not an enabled Agent transport. Never uses a persistent
// profile, storageState, credentials, proxy, stealth patches or challenge solving.
export async function withChictrBrowser({chromium, executablePath, signal, headless = true}, visit) {
  signal?.throwIfAborted();
  let browser, context;
  const cancel = () => {void browser?.close().catch(() => {});};
  try {
    browser = await chromium.launch({headless, executablePath, chromiumSandbox: true});
    signal?.throwIfAborted();
    signal?.addEventListener('abort', cancel, {once: true});
    context = await browser.newContext({serviceWorkers: 'block', acceptDownloads: false,
      viewport: {width: 1440, height: 1000}});
    await context.route('**/*', route => permittedRequest(route.request().url(), route.request().method())
      ? route.continue() : route.abort('blockedbyclient'));
    await context.routeWebSocket?.('**/*', socket => socket.close());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    signal?.throwIfAborted();
    return await visit(page, context);
  } finally {
    signal?.removeEventListener('abort', cancel);
    try {await context?.close();} finally {await browser?.close();}
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--live') {
    console.error('Usage: node scripts/qiyan-chictr-browser-probe.mjs --live');
    process.exitCode = 2;
  } else {
    const startedAt = new Date().toISOString();
    try {
      const chromium = await loadChictrProbeChromium();
      const result = await withChictrBrowser({chromium,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        signal: AbortSignal.timeout(45000)}, async page => {
        const response = await page.goto('https://www.chictr.org.cn/searchproj.html', {waitUntil: 'domcontentloaded', timeout: 15000});
        const body = await page.locator('body').innerText();
        return {status: response?.status(), url: page.url(), title: await page.title(),
          c01Passed: false, classification: classifyBrowserPage({status: response?.status(), body}),
          controls: await page.locator('input,select,button').evaluateAll(elements => elements.map(element => ({
            tag: element.tagName, type: element.getAttribute('type'), name: element.getAttribute('name'),
            id: element.id, placeholder: element.getAttribute('placeholder'), text: element.tagName === 'INPUT' ? '' : element.textContent?.trim().slice(0, 120),
          })).filter(element => !['hidden', 'password'].includes(element.type))),
          bodySummary: body.slice(0, 1600)};
      });
      console.log(JSON.stringify({startedAt, ...result, endedAt: new Date().toISOString()}, null, 2));
      process.exitCode = 3;
    } catch (error) {
      console.log(JSON.stringify({startedAt, c01Passed: false, classification: error.name === 'TimeoutError' ? 'timeout' : 'browser-failed', endedAt: new Date().toISOString()}));
      process.exitCode = 3;
    }
  }
}
