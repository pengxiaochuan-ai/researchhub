import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const out = root + 'docs/test/evidence/2026-10-30-hub-source-first-slice/native-zoom-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chrome = pw.chromium ?? pw.default.chromium;
const base = 'http://127.0.0.1:19501';
const checks = [];
for (const actor of ['admin', 'owner']) {
  const context = await chrome.launchPersistentContext(mkdtempSync(root + '.tmp/hub-source-zoom-'), {
    headless: true, viewport: null, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--window-size=1440,1000'], recordVideo: { dir: out + 'video' },
  });
  try {
    const settings = context.pages()[0];
    await settings.goto('chrome://settings/appearance');
    await settings.locator('#zoomLevel').selectOption('2');
    assert.equal((await context.request.post(base + '/api/auth/login', { data: {
      tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password,
    } })).status(), 201);
    const page = await context.newPage();
    const path = actor === 'admin' ? '/pages/g02/' : '/pages/e01/';
    await page.goto(base + path);
    await page.getByRole('heading', { name: actor === 'admin' ? '来源审核' : '暂无已获准文献' }).first().waitFor();
    const metrics = await page.evaluate(() => ({ outer: outerWidth, inner: innerWidth,
      dpr: devicePixelRatio, scale: visualViewport.scale, scroll: document.documentElement.scrollWidth }));
    assert.equal(metrics.dpr, 2); assert.equal(metrics.scale, 1);
    assert.ok(metrics.inner < metrics.outer / 2 + 20);
    assert.ok(metrics.scroll <= metrics.inner + 1);
    if (actor === 'owner') {
      await page.getByLabel('检索标题、作者、期刊或 DOI').fill('针灸');
      await page.getByLabel('检索标题、作者、期刊或 DOI').press('Enter');
      await page.getByRole('heading', { name: '暂无已获准文献' }).waitFor();
    } else {
      await page.getByLabel('导入批次').focus();
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'SELECT');
    }
    const cdp = await context.newCDPSession(page);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
    writeFileSync(out + actor + '-200.png', Buffer.from(shot.data, 'base64'));
    await cdp.detach();
    checks.push({ actor, page: path, metrics, keyboard: true });
    if (actor === 'owner') {
      await page.goto(base + '/pages/e02/?recordId=rhsr-' + 'a'.repeat(40));
      await page.getByRole('heading', { name: '暂不可查看此文献' }).waitFor();
      const detail = await page.evaluate(() => ({ outer: outerWidth, inner: innerWidth,
        dpr: devicePixelRatio, scroll: document.documentElement.scrollWidth }));
      assert.equal(detail.dpr, 2); assert.ok(detail.scroll <= detail.inner + 1);
      await page.screenshot({ path: out + 'owner-e02-200.png' });
      checks.push({ actor, page: '/pages/e02/', metrics: detail, keyboard: false });
    }
  } finally { await context.close(); }
}
writeFileSync(out + 'result.json', JSON.stringify({ checks, paidCalls: 0 }, null, 2));
console.log(JSON.stringify({ checks, evidence: out }));
