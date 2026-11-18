import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const out = root + 'docs/test/evidence/2026-10-31-guidance-source/browser-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chrome = pw.chromium ?? pw.default.chromium;
const browser = await chrome.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const base = 'http://127.0.0.1:19501';
const currentResponse = await fetch(base + '/api/hub-sources/guidance-documents');
assert.equal(currentResponse.status, 200);
const currentItems = (await currentResponse.json()).items;
const checks = [], responses = [], errors = [];
const items = [
  { documentId: 'rhed-' + 'a'.repeat(40), documentType: 'research_standard', externalKey: 'SYN-STANDARD',
    title: '合成研究标准契约样例', sourceTargetCondition: null, sourceName: '合成标准来源', sourceUrl: null, reviewVersion: '1' },
  { documentId: 'rhed-' + 'b'.repeat(40), documentType: 'clinical_guideline', externalKey: 'SYN-GUIDE',
    title: '合成临床指南契约样例', sourceTargetCondition: '合成条件', sourceName: '合成指南来源', sourceUrl: null, reviewVersion: '1' },
];

async function real(page, name, width) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().endsWith('/api/hub-sources/guidance-documents'))
    responses.push({ name, status: response.status(), contractOnly: response.headers()['x-synthetic-contract'] === 'true' }); });
  await page.goto(base + '/pages/h06/');
  if (currentItems.length) {
    await page.locator('.real-registry__card').first().waitFor();
    assert.equal(await page.locator('.real-registry__card').count(), currentItems.length);
  } else await page.getByRole('heading', { name: '暂无已审核指南或研究标准' }).waitFor();
  assert.equal(await page.getByText(`当前可见 ${currentItems.length} 条指南与研究标准来源`).count(), 1);
  const metric = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    font: getComputedStyle(document.querySelector('.real-registry__card dd, .real-registry__state p')).fontSize }));
  assert.ok(metric.scroll <= metric.width + 1, `${name} overflow: ${JSON.stringify(metric)}`);
  assert.ok(parseFloat(metric.font) >= 14);
  if (width <= 900) {
    await page.getByRole('button', { name: '平台导航' }).click();
    assert.equal(await page.locator('.qiyan-platform-sidebar').getAttribute('aria-modal'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.qiyan-platform-sidebar').evaluate(el => el.inert), true);
  }
  await page.screenshot({ path: out + `${name}-h06-current.png`, fullPage: true });
  checks.push(`${name} H06 real ${currentItems.length} approved sources and shell`);
}

let zoom;
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile390', 390, 844], ['mobile320', 320, 700]]) {
    const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out + 'video' } });
    await real(await context.newPage(), name, width);
    await context.close();
  }
  zoom = await chrome.launchPersistentContext(mkdtempSync(root + '.tmp/guidance-source-zoom-'), {
    headless: true, viewport: null, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--window-size=1440,900'], recordVideo: { dir: out + 'video', size: { width: 1440, height: 900 } },
  });
  const settings = zoom.pages()[0];
  await settings.goto('chrome://settings/appearance');
  await settings.locator('#zoomLevel').selectOption('2');
  const zoomPage = await zoom.newPage();
  await real(zoomPage, 'native200', 720);
  assert.equal(await zoomPage.evaluate(() => devicePixelRatio), 2);
  await zoom.route('**/api/hub-sources/guidance-documents', route => route.fulfill({ status: 200,
    contentType: 'application/json', headers: { 'x-synthetic-contract': 'true' }, body: JSON.stringify({ items }) }));
  await zoomPage.goto(base + '/pages/h06/');
  await zoomPage.getByRole('heading', { name: items[1].title }).waitFor();
  assert.ok(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await zoomPage.getByText('SYN-GUIDE').scrollIntoViewIfNeeded();
  await zoomPage.screenshot({ path: out + 'contract-only-native200-h06.png', fullPage: true });
  checks.push('contract-only native 200% nonempty guidance reflow');
  await zoom.close();

  const contract = await browser.newContext({ viewport: { width: 320, height: 700 }, recordVideo: { dir: out + 'video' } });
  let failures = 1;
  await contract.route('**/api/hub-sources/guidance-documents', route => {
    const failed = failures-- > 0;
    return route.fulfill({ status: failed ? 503 : 200,
      contentType: 'application/json', body: JSON.stringify(failed
        ? { code: 'SYNTHETIC_FAILURE', message: '合成契约故障' } : { items }) });
  });
  const page = await contract.newPage();
  await page.goto(base + '/pages/h06/');
  await page.getByRole('heading', { name: '暂时无法读取来源' }).waitFor();
  await page.getByRole('button', { name: '重试' }).click();
  await page.getByRole('heading', { name: '合成研究标准契约样例' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: '合成临床指南契约样例' }).count(), 1);
  assert.equal(await page.getByRole('link', { name: '来源网站' }).count(), 0);
  await page.getByRole('searchbox').fill('SYN-GUIDE');
  assert.equal(await page.getByRole('heading', { name: '合成研究标准契约样例' }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: out + 'contract-only-mobile320-h06.png', fullPage: true });
  checks.push('contract-only H06 503 retry/type cards/search/no PDF link; not real approval');
  await contract.close();

  assert.deepEqual(errors, []);
  assert.equal(responses.filter(value => !value.contractOnly).length, 4);
  assert.ok(responses.every(value => value.status === 200));
  writeFileSync(out + 'result.json', JSON.stringify({ checks, responses, errors }, null, 2));
  console.log(JSON.stringify({ out, checks: checks.length, responses }));
} finally { await zoom?.close().catch(() => {}); await browser.close(); }
