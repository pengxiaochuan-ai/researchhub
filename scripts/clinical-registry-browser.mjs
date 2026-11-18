import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const out = root + 'docs/test/evidence/2026-10-31-clinical-registry/browser-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chrome = pw.chromium ?? pw.default.chromium;
const browser = await chrome.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const base = 'http://127.0.0.1:19501';
const currentResponse = await fetch(base + '/api/hub-sources/clinical-registries');
assert.equal(currentResponse.status, 200);
const currentItems = (await currentResponse.json()).items;
const checks = [], errors = [], requests = [];
const synthetic = { documentId: 'rhed-' + 'a'.repeat(40), documentType: 'clinical_registry',
  title: '合成注册来源契约样例', externalKey: 'SYN-001', sourceTargetCondition: '合成条件',
  sourceName: '合成来源', sourceUrl: 'https://example.org/synthetic', reviewVersion: '1' };

async function verify(page, name, width) {
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  page.on('response', response => { if (response.url().includes('/api/hub-sources/clinical-registries')) requests.push({ name, url: response.url(), status: response.status() }); });
  await page.goto(base + '/pages/c01/');
  if (currentItems.length) {
    await page.locator('.real-registry__card').first().waitFor();
    assert.equal(await page.locator('.real-registry__card').count(), currentItems.length);
  } else await page.getByRole('heading', { name: '暂无已审核注册来源' }).waitFor();
  assert.equal(await page.getByText(`当前可见 ${currentItems.length} 条注册来源`).count(), 1);
  assert.equal(await page.getByText('NCT04567890').count(), 0);
  await page.locator('.qiyan-platform-sidebar').waitFor({ state: 'attached' });
  if (width <= 900) await page.getByRole('button', { name: '平台导航' }).waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('button', { name: '平台导航' }).count(), width <= 900 ? 1 : 0);
  const metric = await page.evaluate(() => ({ inner: innerWidth, document: document.documentElement.scrollWidth,
    font: getComputedStyle(document.querySelector('.real-registry__card dd, .real-registry__state p')).fontSize }));
  assert.ok(metric.document <= metric.inner + 1, `${name} C01 overflow: ${JSON.stringify(metric)}`);
  assert.ok(parseFloat(metric.font) >= 14, `${name} C01 small text: ${JSON.stringify(metric)}`);
  if (width <= 900) {
    await page.getByRole('button', { name: '平台导航' }).click();
    assert.equal(await page.locator('.qiyan-platform-sidebar').getAttribute('aria-modal'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.qiyan-platform-sidebar').evaluate(el => el.inert), true);
  }
  await page.screenshot({ path: out + `${name}-c01-current.png`, fullPage: true });
  checks.push(`${name} C01 current ${currentItems.length} approved records and mobile nav`);

  await page.goto(base + '/pages/c03/?documentId=rhed-' + '0'.repeat(40));
  await page.getByRole('heading', { name: '该注册来源不可见' }).waitFor();
  assert.equal(await page.getByText('NCT04567890').count(), 0);
  assert.equal(await page.getByRole('link', { name: /返回临床注册列表/ }).count(), 1);
  await page.screenshot({ path: out + `${name}-c03-unavailable.png`, fullPage: true });
  checks.push(`${name} C03 unavailable`);
  await page.goto(base + '/pages/c03/?documentId=invalid');
  await page.getByRole('heading', { name: '该注册来源不可见' }).waitFor();
  checks.push(`${name} C03 invalid ID rejected locally`);
}

let zoom;
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile390', 390, 844], ['mobile320', 320, 700]]) {
    const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out + 'video' } });
    await verify(await context.newPage(), name, width);
    await context.close();
  }
  zoom = await chrome.launchPersistentContext(mkdtempSync(root + '.tmp/clinical-registry-zoom-'), {
    headless: true, viewport: null, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--window-size=1440,900'], recordVideo: { dir: out + 'video', size: { width: 1440, height: 900 } },
  });
  const settings = zoom.pages()[0];
  await settings.goto('chrome://settings/appearance');
  await settings.locator('#zoomLevel').selectOption('2');
  const zoomPage = await zoom.newPage();
  await verify(zoomPage, 'native200', 720);
  assert.equal(await zoomPage.evaluate(() => devicePixelRatio), 2);
  await zoom.route('**/api/hub-sources/clinical-registries**', route => route.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify(route.request().url().endsWith('/clinical-registries')
      ? { items: [synthetic] } : { item: synthetic }) }));
  await zoomPage.goto(base + '/pages/c03/?documentId=' + synthetic.documentId);
  await zoomPage.getByRole('heading', { name: synthetic.title }).waitFor();
  assert.ok(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await zoomPage.screenshot({ path: out + 'contract-only-native200-c03.png', fullPage: true });
  checks.push('contract-only native 200% nonempty detail reflow');
  await zoom.close();
  const contract = await browser.newContext({ viewport: { width: 320, height: 700 }, recordVideo: { dir: out + 'video' } });
  let listFailures = 1, detailApproved = true;
  await contract.route('**/api/hub-sources/clinical-registries**', route => {
    const list = route.request().url().endsWith('/clinical-registries');
    const status = list && listFailures-- > 0 ? 503 : !list && !detailApproved ? 404 : 200;
    return route.fulfill({ status, contentType: 'application/json',
      body: JSON.stringify(status === 200 ? list ? { items: [synthetic] } : { item: synthetic }
        : { code: 'SYNTHETIC_CONTRACT_FAILURE', message: '合成契约故障' }) });
  });
  const contractPage = await contract.newPage();
  await contractPage.goto(base + '/pages/c01/');
  await contractPage.getByRole('heading', { name: '暂时无法读取注册来源' }).waitFor();
  await contractPage.getByRole('button', { name: '重试' }).click();
  await contractPage.getByRole('heading', { name: synthetic.title }).waitFor();
  assert.ok(await contractPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await contractPage.screenshot({ path: out + 'contract-only-mobile320-c01.png', fullPage: true });
  await contractPage.getByRole('searchbox').fill('无匹配');
  await contractPage.getByRole('heading', { name: '没有符合条件的来源' }).waitFor();
  await contractPage.getByRole('searchbox').fill('SYN-001');
  await contractPage.getByRole('link', { name: '查看详情' }).click();
  await contractPage.getByRole('heading', { name: synthetic.title }).waitFor();
  assert.ok(await contractPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const sourceLink = contractPage.getByRole('link', { name: '在来源网站查看原始记录' });
  assert.equal(await sourceLink.getAttribute('rel'), 'noopener noreferrer');
  await sourceLink.scrollIntoViewIfNeeded();
  const sourceBox = await sourceLink.boundingBox();
  assert.ok(sourceBox.y >= 0 && sourceBox.y + sourceBox.height <= 700, `source link not reachable: ${JSON.stringify(sourceBox)}`);
  await contractPage.screenshot({ path: out + 'contract-only-c03-synthetic.png', fullPage: true });
  detailApproved = false;
  await contractPage.reload();
  await contractPage.getByRole('heading', { name: '该注册来源不可见' }).waitFor();
  assert.equal(await contractPage.getByText(synthetic.title).count(), 0);
  checks.push('contract-only 503 retry, mobile320 search/detail, revocation reload; not a real approval');
  await contract.close();
  assert.deepEqual(errors, []);
  assert.ok(requests.some(item => item.url.endsWith('/clinical-registries') && item.status === 200));
  assert.ok(requests.some(item => item.url.includes('/clinical-registries/rhed-') && item.status === 404));
  writeFileSync(out + 'result.json', JSON.stringify({ checks, errors, requests }, null, 2));
  console.log(JSON.stringify({ out, checks: checks.length, requests }));
} finally { await zoom?.close().catch(() => {}); await browser.close(); }
