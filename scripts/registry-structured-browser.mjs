import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { verifiedInitialFiles, initialDocumentId } from '../server/hub-sources/initial-five.mjs';
import { extractRegistryDetails, registryDetailHash } from '../server/hub-sources/registry-detail-contract.mjs';

const root = '/Users/mac/aisciencesys/';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const base = 'http://127.0.0.1:19501';
const action = process.argv[2];
assert.ok(['approve', 'verify'].includes(action), 'Use approve|verify');
const evidenceRef = 'https://app.notion.com/p/40a56479ab5881108043f4bb0150897a?pvs=204';
const sources = verifiedInitialFiles().filter(item => item.documentType === 'clinical_registry').map(item => ({
  ...item, documentId: initialDocumentId(runtime.ids.tenant, 'lingshu-xinyu', item),
  details: extractRegistryDetails(item.bytes, item),
}));
const out = root + 'docs/test/evidence/2026-10-31-registry-structured/' + action + '-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const playwright = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chromium = playwright.chromium ?? playwright.default.chromium;
const options = { headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' };
const browser = await chromium.launch(options);
const errors = [], checks = [], network = [], measurements = [], decisions = [];
async function login(context, actor) {
  const r = await context.request.post(base + '/api/auth/login', { data: { tenantSlug: runtime.ids.tenant,
    username: actor + '@example.org', password: runtime.password } });
  assert.equal(r.status(), 201);
}
async function preview(context) {
  const r = await context.request.get(base + '/api/hub-sources/external-review-items');
  assert.equal(r.status(), 200); assert.equal(r.headers()['cache-control'], 'no-store');
  const { items } = await r.json(); assert.equal(items.length, 5); return items;
}
function listen(page, name) {
  page.on('pageerror', error => errors.push({ name, message: error.message }));
  page.on('response', r => { if (new URL(r.url()).pathname.startsWith('/api/hub-sources/'))
    network.push({ name, path: new URL(r.url()).pathname, status: r.status() }); });
}
async function screenshot(page, name) {
  if (name.includes('native200')) {
    const cdp = await page.context().newCDPSession(page);
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
    writeFileSync(out + name + '.png', Buffer.from(capture.data, 'base64')); await cdp.detach();
  } else await page.screenshot({ path: out + name + '.png' });
}
async function noOverflow(page, name) {
  const metric = await page.evaluate(() => {
    const main = document.querySelector('.platform-main');
    const field = document.querySelector('.registry-field__value');
    return { width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      mainWidth: main.clientWidth, mainScroll: main.scrollWidth,
      font: field && getComputedStyle(field).fontSize, lineHeight: field && getComputedStyle(field).lineHeight,
      clips: [...document.querySelectorAll('.registry-structured p,.registry-field__source blockquote')]
        .filter(el => el.getClientRects().length).flatMap(el => {
          const range = document.createRange(); range.selectNodeContents(el); const a=range.getBoundingClientRect(), b=el.getBoundingClientRect();
          return a.width && (a.left < b.left - 1 || a.right > b.right + 1) ? [el.textContent.slice(0, 80)] : [];
        }) };
  });
  measurements.push({ name, ...metric });
  assert.ok(metric.documentWidth <= metric.width + 1 && metric.mainScroll <= metric.mainWidth + 1, name + JSON.stringify(metric));
  if (metric.font) { assert.equal(metric.font, '16px'); assert.equal(metric.lineHeight, '28px'); }
  assert.deepEqual(metric.clips, [], name + ': text clipping');
}
async function verifyDetail(page, source, name) {
  const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === '/api/hub-sources/clinical-registries/' + source.documentId);
  await page.goto(base + '/pages/c03/?documentId=' + source.documentId);
  const response = await responsePromise; assert.equal(response.status(), 200);
  assert.equal(response.headers()['cache-control'], 'no-store');
  const { item } = await response.json();
  assert.equal(item.structuredDetailsStatus, 'approved');
  const { extractionId, extractionVersion, fileName, sourceSha256, payloadSha256, reviewVersion, ...payload } = item.structuredDetails;
  assert.deepEqual(payload, source.details); assert.equal(payloadSha256, registryDetailHash(source.details));
  assert.equal(sourceSha256, source.expectedSha256); assert.ok(reviewVersion && extractionId && extractionVersion === 1 && fileName === source.fileName);
  await page.getByRole('region', { name: '研究设计', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-user-name]')?.textContent?.includes('合成'));
  assert.equal(await page.locator('.registry-structured__arms article').count(), source.details.arms.length);
  assert.equal(await page.locator('.registry-structured__outcomes article').count(), source.details.outcomes.length);
  assert.equal(await page.locator('.registry-field__missing').count(), 1 + 2 * source.details.outcomes.length);
  if (source.externalKey === 'ChiCTR2300073486') {
    assert.equal(await page.getByText('response rate/remission rate', { exact: true }).count(), 2); // field + collapsed original quote
    assert.ok(await page.getByText('来源含中文同名结局', { exact: false }).count());
  } else assert.ok(await page.getByText('轻度认知障碍', { exact: true }).count());
  await page.getByRole('region', { name: '研究设计', exact: true }).scrollIntoViewIfNeeded();
  const designSource = page.locator('summary[aria-label="研究设计：核对原始位置"]');
  await designSource.focus(); await page.keyboard.press('Enter');
  const designDetails = designSource.locator('..');
  assert.equal(await designDetails.getAttribute('open'), '');
  assert.ok(await designDetails.getByText('解码 HTML · 表 4 / 行 16 / 单元格 2；第 777 行，第 33 列', { exact: true }).isVisible());
  assert.ok(await designSource.evaluate(el => el.getBoundingClientRect().height >= 44));
  await noOverflow(page, name + '-design'); await screenshot(page, name + '-design');
  await page.getByRole('region', { name: '分组与干预', exact: true }).scrollIntoViewIfNeeded();
  await screenshot(page, name + '-arms');
  const outcomes = page.getByRole('region', { name: '登记结局', exact: true });
  await outcomes.scrollIntoViewIfNeeded();
  const timeSource = outcomes.locator('summary[aria-label="测量时间点：核对原始位置"]').first();
  await timeSource.click(); assert.ok(await timeSource.locator('..').getByText('（原单元格为空）', { exact: true }).isVisible());
  await noOverflow(page, name + '-outcomes'); await screenshot(page, name + '-outcomes');
  await outcomes.locator('article').last().scrollIntoViewIfNeeded();
  const lastSource = outcomes.locator('summary[aria-label="测量方法：核对原始位置"]').last();
  await lastSource.scrollIntoViewIfNeeded();
  assert.ok(await lastSource.evaluate(el => { const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return hit === el || el.contains(hit); }), name + ': last source obscured');
  await lastSource.click(); await noOverflow(page, name + '-last');
  await screenshot(page, name + '-last');
  checks.push(name + ': real PG/API fields, SHA, missing values, keyboard sources, Reading16/28, reflow and last control');
}
let zoom;
try {
  if (action === 'approve') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: out + 'video' } });
    await login(context, 'admin'); const before = await preview(context); const page = await context.newPage(); listen(page, 'admin-approve');
    await page.goto(base + '/pages/g02/'); await page.locator('.hub-external-item').first().waitFor();
    for (const source of sources) {
      const item = (await preview(context)).find(value => value.id === source.documentId);
      assert.equal(item.structuredExtraction.payloadSha256, registryDetailHash(source.details));
      const prior = item.structuredExtraction.review;
      if (prior?.decision === 'approve') {
        assert.equal(prior.reviewerId, runtime.ids.admin); assert.equal(prior.evidenceRef, evidenceRef);
        decisions.push({ documentId: item.id, action: 'already-approved', version: prior.version }); continue;
      }
      const detail = await context.request.get(base + '/api/hub-sources/clinical-registries/' + item.id);
      const pending = (await detail.json()).item; assert.ok(!pending.structuredDetails); assert.equal(pending.structuredDetailsStatus, 'pending_review');
      const card = page.locator('.hub-external-item').filter({ has: page.getByRole('heading', { name: source.title, exact: true }) });
      await card.locator('.hub-external-structured-preview > summary').click();
      assert.equal(await card.locator('.registry-structured__outcomes article').count(), source.details.outcomes.length);
      await noOverflow(page, 'admin-preview-' + source.externalKey);
      await card.getByLabel('核验字段').selectOption('registry_details');
      assert.equal(await card.getByLabel('允许用途').inputValue(), 'display'); assert.ok(await card.getByLabel('允许用途').isDisabled());
      await card.getByLabel('决定').selectOption('approve');
      await card.getByLabel('权利与内容审核依据').fill(evidenceRef); await card.getByRole('checkbox').check();
      await screenshot(page, 'admin-before-' + source.externalKey);
      const saved = page.waitForResponse(r => r.url().endsWith('/api/hub-sources/external-reviews') && r.request().method() === 'POST');
      await card.getByRole('button', { name: '记录本项批准' }).click();
      const r = await saved; assert.equal(r.status(), 201); decisions.push((await r.json()).review);
      await page.getByText('审核决定已保存，当前状态已刷新。', { exact: true }).waitFor();
    }
    const after = await preview(context);
    for (const item of after) {
      const original = before.find(value => value.id === item.id);
      assert.deepEqual(item.decisions.filter(value => value.fieldKind !== 'registry_details'), original.decisions.filter(value => value.fieldKind !== 'registry_details'));
    }
    writeFileSync(out + 'receipt.json', JSON.stringify({ action, evidenceRef, decisions, before, after, errors, measurements }, null, 2));
    assert.deepEqual(errors, []); await context.close();
  } else {
    const audit = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: out + 'video' } });
    await login(audit, 'admin'); const current = await preview(audit);
    for (const source of sources) {
      const item = current.find(value => value.id === source.documentId);
      assert.equal(item.structuredExtraction.review?.decision, 'approve'); assert.equal(item.structuredExtraction.review.reviewerId, runtime.ids.admin);
      assert.equal(item.structuredExtraction.review.evidenceRef, evidenceRef);
    }
    const auditPage = await audit.newPage(); listen(auditPage, 'admin-review');
    for (const width of [1440, 390]) {
      await auditPage.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await auditPage.goto(base + '/pages/g02/'); await auditPage.locator('.hub-external-item').first().waitFor();
      const card = auditPage.locator('.hub-external-item').filter({ hasText: 'ChiCTR2300073486' });
      await card.locator('.hub-external-structured-preview > summary').click();
      await card.getByLabel('核验字段').selectOption('registry_details');
      assert.ok(await card.locator('.hub-external-current').filter({ hasText: '已批准' }).count());
      await card.locator('.registry-structured__outcomes article').first().scrollIntoViewIfNeeded();
      await noOverflow(auditPage, 'admin-review-' + width); await screenshot(auditPage, 'admin-review-' + width);
      checks.push('admin G02 ' + width + ': actual approved extraction and sources preview');
    }
    await audit.close();
    for (const actor of ['owner', 'admin']) for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile390', 390, 844], ['mobile320', 320, 700]]) {
      const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out + 'video' } });
      await login(context, actor); const page = await context.newPage(); listen(page, name + '-' + actor);
      for (const source of sources) await verifyDetail(page, source, name + '-' + actor + '-' + source.externalKey);
      await page.getByRole('link', { name: /返回临床注册列表/ }).click(); await page.locator('.real-registry__card').first().waitFor();
      assert.equal(await page.locator('.real-registry__card').count(), 2);
      await page.getByRole('link', { name: '查看详情', exact: true }).first().click(); await page.getByRole('region', { name: '研究设计', exact: true }).waitFor();
      await context.close();
    }
    zoom = await chromium.launchPersistentContext(mkdtempSync(root + '.tmp/registry-structured-zoom-'), { ...options,
      viewport: null, args: ['--window-size=1440,1000'], recordVideo: { dir: out + 'video', size: { width: 1440, height: 1000 } } });
    const settings = zoom.pages()[0]; await settings.goto('chrome://settings/appearance'); await settings.locator('#zoomLevel').selectOption('2');
    const page = await zoom.newPage(); listen(page, 'native200');
    for (const actor of ['owner', 'admin']) {
      await login(zoom, actor);
      for (const source of sources) await verifyDetail(page, source, 'native200-' + actor + '-' + source.externalKey);
      assert.equal(await page.evaluate(() => devicePixelRatio), 2);
    }
    await zoom.close(); zoom = null;
    // UI-only fault contracts, explicitly separate from real PG approval/revocation tests.
    const contract = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out + 'video' } });
    await login(contract, 'owner'); const contractPage = await contract.newPage(); let failures = 1;
    await contract.route('**/api/hub-sources/clinical-registries/' + sources[0].documentId, route => failures-- > 0
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '合成契约故障' }) }) : route.continue());
    await contractPage.goto(base + '/pages/c03/?documentId=' + sources[0].documentId);
    await contractPage.getByRole('heading', { name: '暂时无法读取来源' }).waitFor(); assert.equal(await contractPage.locator('.registry-structured').count(), 0);
    await contractPage.getByRole('button', { name: '重试' }).click(); await contractPage.getByRole('region', { name: '研究设计', exact: true }).waitFor();
    await contract.unroute('**/api/hub-sources/clinical-registries/' + sources[0].documentId);
    await contract.route('**/api/hub-sources/clinical-registries/' + sources[0].documentId, async route => {
      const response = await route.fetch(); const body = await response.json(); delete body.item.structuredDetails; body.item.structuredDetailsStatus = 'pending_review';
      await route.fulfill({ response, json: body });
    });
    await contractPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await contractPage.getByRole('heading', { name: '结构化详情尚未获准展示' }).waitFor();
    assert.equal(await contractPage.locator('.registry-structured').count(), 0);
    await screenshot(contractPage, 'contract-only-focus-withdrawal'); await contract.close();
    checks.push('UI-only contract: 503 clear/retry to real API; focus refresh removes no-longer-delivered structured content');
    assert.deepEqual(errors, []);
    assert.ok(network.filter(value => value.path.includes('/clinical-registries/')).every(value => value.status === 200));
    writeFileSync(out + 'result.json', JSON.stringify({ checks, errors, network, measurements }, null, 2));
  }
  console.log(JSON.stringify({ action, evidence: out, checks: checks.length, decisions: decisions.length }));
} catch (error) {
  writeFileSync(out + 'failure.json', JSON.stringify({ message: error.message, stack: error.stack, checks, errors, network, measurements, decisions }, null, 2));
  throw error;
} finally { await zoom?.close().catch(() => {}); await browser.close(); }
