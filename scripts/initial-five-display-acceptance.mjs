import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { initialFive, initialDocumentId, verifiedInitialFiles } from '../server/hub-sources/initial-five.mjs';

const root = '/Users/mac/aisciencesys/';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const base = 'http://127.0.0.1:19501';
const action = process.argv[2];
assert.ok(['approve', 'verify'].includes(action), 'Use approve|verify');
const evidenceRef = process.argv.find(value => value.startsWith('--evidence='))?.slice(11);
if (action === 'approve') assert.equal(evidenceRef,
  'https://app.notion.com/p/40a56479ab5881efa557d090e0eb0f9f?pvs=204', 'Use the recorded user authorization only');
verifiedInitialFiles();
const out = root + 'docs/test/evidence/2026-10-31-initial-five-display/' + action + '-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chrome = pw.chromium ?? pw.default.chromium;
const browser = await chrome.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [], checks = [], network = [], measurements = [], decisions = [];

async function login(context, actor) {
  const response = await context.request.post(base + '/api/auth/login', { data: {
    tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password,
  } });
  assert.equal(response.status(), 201);
}
async function preview(context) {
  const response = await context.request.get(base + '/api/hub-sources/external-review-items');
  assert.equal(response.status(), 200);
  const { items } = await response.json();
  assert.equal(items.length, 5);
  for (const source of initialFive) {
    const item = items.find(value => value.id === initialDocumentId(runtime.ids.tenant, 'lingshu-xinyu', source));
    assert.ok(item && item.versionNumber === 1 && item.sha256 === source.expectedSha256 &&
      item.title === source.title && item.externalKey === source.externalKey && item.documentType === source.documentType);
  }
  return items;
}
async function verifyPage(page, name, pageId, search = '') {
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/pages/' + pageId + '/' + search);
  const rows = pageId === 'h01' ? page.locator('.real-hub-sources li').filter({ has: page.locator('strong') })
    : pageId === 'c03' ? page.locator('section[aria-label="来源详情"]') : page.locator('.real-registry__card');
  const expected = pageId === 'h01' ? 5 : pageId === 'c01' ? 2 : pageId === 'h06' ? 3 : 1;
  await rows.first().waitFor();
  assert.equal(await rows.count(), expected);
  await page.waitForFunction(() => document.querySelector('[data-user-name]')?.textContent !== '正在核验身份');
  const metric = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector('.platform-main').clientWidth,
    mainScrollWidth: document.querySelector('.platform-main').scrollWidth,
    bodyFont: getComputedStyle(document.querySelector('.real-registry__card dd, .real-hub-sources span')).fontSize }));
  measurements.push({ name, pageId, ...metric });
  assert.ok(metric.documentWidth <= metric.width + 1 && metric.mainScrollWidth <= metric.mainWidth + 1,
    `${name}/${pageId}: horizontal overflow ${JSON.stringify(metric)}`);
  assert.ok(parseFloat(metric.bodyFont) >= 14);
  const textClips = await rows.evaluateAll(elements => elements.flatMap(element => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll('strong, span, small, dd, h3')].flatMap(text => {
      const range = document.createRange(); range.selectNodeContents(text);
      const rect = range.getBoundingClientRect();
      return rect.width && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)
        ? [{ text: text.textContent, left: rect.left, right: rect.right, bounds: [bounds.left, bounds.right] }] : [];
    });
  }));
  assert.deepEqual(textClips, [], `${name}/${pageId}: clipped text`);
  if (pageId === 'h01') {
    for (const item of initialFive) assert.ok(await page.getByText(item.title, { exact: true }).count() > 0);
  }
  if (pageId === 'c01') {
    await page.getByRole('searchbox').fill('ChiCTR2300077209');
    assert.equal(await rows.count(), 1);
    await page.getByRole('searchbox').fill('');
  }
  await rows.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + `${name}-${pageId}-first.png`, fullPage: true });
  await rows.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + `${name}-${pageId}-last.png`, fullPage: true });
  if (name.startsWith('native200')) {
    await page.screenshot({ path: out + `${name}-${pageId}-css.png`, scale: 'css' });
    const cdp = await page.context().newCDPSession(page);
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
    writeFileSync(out + `${name}-${pageId}-viewport.png`, Buffer.from(capture.data, 'base64'));
    await cdp.detach();
  }
  for (const link of await rows.locator('a').all()) {
    await link.scrollIntoViewIfNeeded();
    const hit = await link.evaluate(element => {
      const main = document.querySelector('.platform-main').getBoundingClientRect();
      const lines = [...element.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      const hits = lines.map(rect => {
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { reachable: Boolean(target && (element === target || element.contains(target))),
          inMain: rect.top >= Math.max(main.top, 64) && rect.bottom <= main.bottom + 1,
          top: rect.top, bottom: rect.bottom, mainBottom: main.bottom, target: target?.className };
      });
      return { reachable: hits.some(value => value.reachable && value.inMain), inMain: hits.some(value => value.inMain),
        text: element.textContent, hits };
    });
    assert.ok(hit.reachable && hit.inMain, `${name}/${pageId}: link obscured ${JSON.stringify(hit)}`);
  }
  if (pageId === 'c01') {
    await page.getByRole('link', { name: '查看详情', exact: true }).first().click();
    await page.locator('section[aria-label="来源详情"]').waitFor();
    await page.getByRole('link', { name: /返回临床注册列表/ }).click();
    await page.locator('.real-registry__card').first().waitFor();
    assert.equal(await page.locator('.real-registry__card').count(), 2);
  }
  checks.push(`${name}/${pageId}: actual ${expected} records, typography, reflow and scroll`);
}

let zoom;
try {
  if (action === 'approve') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: out + 'video' } });
    await login(context, 'admin');
    const before = await preview(context);
    const page = await context.newPage();
    await page.goto(base + '/pages/g02/');
    await page.getByRole('heading', { name: '首批外部来源 · 逐项审核' }).waitFor();
    for (const source of initialFive) {
      const current = (await preview(context)).find(item => item.externalKey === source.externalKey);
      const prior = current.decisions.find(item => item.fieldKind === 'bibliographic' && item.purpose === 'display');
      if (prior?.decision === 'approve' && prior.audience === 'public') {
        assert.equal(prior.reviewerId, runtime.ids.admin);
        decisions.push({ documentId: current.id, externalKey: current.externalKey, action: 'already-approved', version: prior.version });
        continue;
      }
      const card = page.locator('.hub-external-item').filter({ has: page.getByRole('heading', { name: source.title, exact: true }) });
      await card.getByLabel('核验字段').selectOption('bibliographic');
      await card.getByLabel('允许用途').selectOption('display');
      await card.getByLabel('决定').selectOption('approve');
      await card.getByLabel('权利与内容审核依据').fill(evidenceRef);
      await card.getByRole('checkbox').check();
      const saved = page.waitForResponse(response => response.url().endsWith('/api/hub-sources/external-reviews') && response.request().method() === 'POST');
      await card.getByRole('button', { name: '记录本项批准' }).click();
      const response = await saved;
      assert.equal(response.status(), 201);
      const body = await response.json();
      decisions.push({ ...body.review, externalKey: source.externalKey });
      await page.getByText('审核决定已保存，当前状态已刷新。', { exact: true }).waitFor();
    }
    const after = await preview(context);
    for (const item of after) {
      const active = item.decisions.find(value => value.fieldKind === 'bibliographic' && value.purpose === 'display');
      assert.equal(active?.decision, 'approve');
      assert.equal(active?.reviewerId, runtime.ids.admin);
      const previous = before.find(value => value.id === item.id);
      assert.deepEqual(item.decisions.filter(value => value.fieldKind !== 'bibliographic' || value.purpose !== 'display'),
        previous.decisions.filter(value => value.fieldKind !== 'bibliographic' || value.purpose !== 'display'));
    }
    await page.screenshot({ path: out + 'admin-current-approval.png', fullPage: true });
    writeFileSync(out + 'receipt.json', JSON.stringify({ action, evidenceRef, decisions, before, after }, null, 2));
    await context.close();
  } else {
    const audit = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: out + 'video' } });
    await login(audit, 'admin');
    for (const item of await preview(audit)) {
      assert.equal(item.reviewDecisionCount, 1, 'Only one persistent display decision per source is authorized');
      const additional = item.decisions.filter(value => value.fieldKind !== 'bibliographic');
      assert.ok(additional.every(value => ['registry_details', 'guidance_clauses'].includes(value.fieldKind) && value.purpose === 'display' &&
        value.decision === 'approve' && value.reviewerId === runtime.ids.admin && value.version ===
        (value.fieldKind === 'registry_details' ? item.structuredExtraction?.review?.version : item.guidanceExtraction?.review?.version)),
        'Only separately reviewed named extraction display decisions may be additional');
      assert.equal(item.decisions.filter(value => value.fieldKind === 'bibliographic').length, 1);
      assert.equal(item.decisions[0].fieldKind, 'bibliographic');
      assert.equal(item.decisions[0].purpose, 'display');
      assert.equal(item.decisions[0].decision, 'approve');
      assert.equal(item.decisions[0].reviewerId, runtime.ids.admin);
    }
    const auditPage = await audit.newPage();
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile390', 390, 844]]) {
      await auditPage.setViewportSize({ width, height });
      await auditPage.goto(base + '/pages/g02/');
      await auditPage.locator('.hub-external-item').first().waitFor();
      assert.equal(await auditPage.locator('.hub-external-item').count(), 5);
      assert.equal(await auditPage.locator('.hub-external-current').filter({ hasText: '已批准' }).count(), 5);
      assert.ok(await auditPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await auditPage.locator('.hub-external-item').first().scrollIntoViewIfNeeded();
      await auditPage.screenshot({ path: out + `admin-${name}-current.png`, fullPage: true });
      checks.push(`admin/${name}: five current bibliographic display approvals`);
    }
    await audit.close();
    for (const [name, width, height, actor] of [['desktop-owner', 1440, 1000, 'owner'], ['mobile390-admin', 390, 844, 'admin'], ['mobile320-owner', 320, 700, 'owner']]) {
      const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out + 'video' } });
      await login(context, actor);
      const page = await context.newPage();
      page.on('response', response => {
        if (new URL(response.url()).pathname.startsWith('/api/hub-sources/')) network.push({ name, path: new URL(response.url()).pathname, status: response.status() });
      });
      for (const id of ['h01', 'c01', 'h06']) await verifyPage(page, name, id);
      for (const source of initialFive.filter(item => item.documentType === 'clinical_registry'))
        await verifyPage(page, name + '-' + source.externalKey, 'c03', '?documentId=' + initialDocumentId(runtime.ids.tenant, 'lingshu-xinyu', source));
      await context.close();
    }
    zoom = await chrome.launchPersistentContext(mkdtempSync(root + '.tmp/initial-five-display-zoom-'), {
      headless: true, viewport: null, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--window-size=1440,1000'], recordVideo: { dir: out + 'video', size: { width: 1440, height: 1000 } },
    });
    await login(zoom, 'owner');
    await zoom.pages()[0].goto('chrome://settings/appearance');
    await zoom.pages()[0].locator('#zoomLevel').selectOption('2');
    const page = await zoom.newPage();
    for (const id of ['h01', 'c01', 'h06']) await verifyPage(page, 'native200-owner', id);
    for (const source of initialFive.filter(item => item.documentType === 'clinical_registry'))
      await verifyPage(page, 'native200-' + source.externalKey, 'c03', '?documentId=' + initialDocumentId(runtime.ids.tenant, 'lingshu-xinyu', source));
    assert.equal(await page.evaluate(() => devicePixelRatio), 2);
    await zoom.close();
    assert.deepEqual(errors, []);
    assert.ok(network.every(item => item.status === 200));
    writeFileSync(out + 'result.json', JSON.stringify({ checks, errors, measurements, network }, null, 2));
  }
  console.log(JSON.stringify({ action, evidence: out, checks: checks.length, decisions: decisions.length }));
} finally { await zoom?.close().catch(() => {}); await browser.close(); }
