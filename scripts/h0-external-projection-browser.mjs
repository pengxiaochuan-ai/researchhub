import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const out = root + 'docs/test/evidence/2026-10-31-h0-external-projection/browser-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser = await (pw.chromium ?? pw.default.chromium).launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const checks = [], warnings = [], errors = [], network = [];
const base = 'http://127.0.0.1:19501';
const currentResponse = await fetch(base + '/api/hub-sources/external-documents');
assert.equal(currentResponse.status, 200);
const currentItems = (await currentResponse.json()).items;
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, recordVideo: { dir: out + 'video' } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (new URL(response.url()).pathname === '/api/hub-sources/external-documents')
        network.push({ viewport: name, status: response.status() });
    });
    await page.goto(base + '/pages/h01/?hubKey=lingshu-xinyu');
    await page.getByRole('heading', { name: '临床注册、标准与指南' }).waitFor();
    if (currentItems.length) {
      await page.locator('.real-hub-external .real-hub-sources li').first().waitFor();
      assert.equal(await page.locator('.real-hub-external .real-hub-sources li').count(), currentItems.length);
      for (const item of currentItems) assert.ok(await page.getByText(item.title, { exact: true }).count() > 0);
    } else await page.getByText(/暂无获准公开的临床注册、标准或指南/).waitFor();
    assert.equal(await page.getByText('版权专有').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    if (name === 'mobile') {
      const contentWidth = await page.locator('.real-hub').evaluate(element => element.getBoundingClientRect().width);
      if (contentWidth < 300) warnings.push(`mobile-shell-content-width-${Math.round(contentWidth)}px`);
    }
    await page.screenshot({ path: out + `h01-${name}-current.png`, fullPage: true });
    checks.push(`h01-${name}-real-api-${currentItems.length}-records-and-no-horizontal-overflow`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.equal(network.length, 2);
  assert.ok(network.every(item => item.status === 200));
  writeFileSync(out + 'result.json', JSON.stringify({ checks, warnings, errors, network }, null, 2));
  console.log(JSON.stringify({ evidence: out, checks, warnings, network }));
} finally { await browser.close(); }
