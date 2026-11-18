import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const out = root + 'docs/test/evidence/2026-10-31-pmc-first-run/browser-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser = await (pw.chromium ?? pw.default.chromium).launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const checks = [], errors = [], network = [];
const base = 'http://127.0.0.1:19501';
let active;
async function context(actor, viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport, recordVideo: { dir: out + 'video' } });
  const p = await c.newPage(); active = p;
  p.on('pageerror', error => errors.push(error.message));
  p.on('response', response => { const path = new URL(response.url()).pathname;
    if (path.startsWith('/api/hub-sources/')) network.push({ actor, path, status: response.status() }); });
  if (actor) {
    const response = await c.request.post(base + '/api/auth/login', { data: {
      tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password,
    } });
    assert.equal(response.status(), 201);
  }
  return { c, p };
}
try {
  const admin = await context('admin');
  await admin.p.goto(base + '/pages/g02/');
  await admin.p.getByRole('heading', { name: /PMC 首批候选/ }).waitFor();
  await admin.p.getByLabel('选择候选文章').locator('option').first().waitFor({ state: 'attached' });
  const reviewItems = await (await admin.c.request.get(base + '/api/hub-sources/pmc-review-items')).json();
  const firstAssetId = reviewItems.items.flatMap(item => item.assets || []).find(asset =>
    ['image', 'supplement'].includes(asset.assetKind))?.id;
  assert.ok(firstAssetId);
  const figureArticle = reviewItems.items.find(item => item.pmcid === 'PMC13691533');
  const firstFigure = figureArticle?.assets.find(asset => asset.componentRef.endsWith('g001.webp'));
  assert.ok(firstFigure);
  assert.equal(await admin.p.getByLabel('权利／内容审核依据 HTTPS 链接').inputValue(), '');
  assert.equal(await admin.p.locator('.hub-pmc-review').getByRole('button', { name: '记录本项批准' }).isDisabled(), true);
  await admin.p.screenshot({ path: out + 'g02-admin-1440.png', fullPage: true });
  await admin.p.locator('.hub-pmc-review').getByRole('button', { name: '记录本项批准' }).scrollIntoViewIfNeeded();
  await admin.p.screenshot({ path: out + 'g02-admin-decision-1440.png' });
  checks.push('admin sees real PMC candidate and explicit review gate');
  await admin.p.getByLabel('选择候选文章').selectOption(figureArticle.candidateId);
  await admin.p.getByText('核对表格文字与逐件媒体／附件').click();
  const preview = admin.p.locator('.hub-pmc-figure img').first();
  await preview.scrollIntoViewIfNeeded();
  await assert.doesNotReject(async () => preview.evaluate(img => img.decode()));
  assert.ok(await preview.evaluate(img => img.naturalWidth > 100 && img.naturalHeight > 100));
  assert.match(await admin.p.locator('.hub-pmc-figure figcaption').first().textContent(), /FIGURE 1.*Overall experimental process/);
  const previewResponse = await admin.c.request.get(base + '/api/hub-sources/pmc-review-images/' + firstFigure.id);
  assert.equal(previewResponse.status(), 200);
  assert.equal(previewResponse.headers()['content-type'], 'image/webp');
  await admin.p.screenshot({ path: out + 'g02-admin-pmc13691533-figure1.png' });
  await admin.p.locator('.hub-pmc-figure').first().screenshot({ path: out + 'g02-admin-pmc13691533-figure1-only.png' });
  checks.push('admin previews real stored Figure 1 with original caption and safe image bytes');
  const tableCandidate = reviewItems.items.find(item => item.pmcid === 'PMC13550132');
  if (tableCandidate?.tables?.length) {
    await admin.p.getByLabel('选择候选文章').selectOption(tableCandidate.candidateId);
    await admin.p.getByText('核对表格文字与逐件媒体／附件').click();
    const spannedCell = admin.p.locator('.hub-pmc-table td[rowspan]:not([rowspan="1"]), .hub-pmc-table td[colspan]:not([colspan="1"])');
    assert.ok(await spannedCell.count() > 0);
    await spannedCell.first().scrollIntoViewIfNeeded();
    await admin.p.screenshot({ path: out + 'g02-admin-table-spans-1440.png' });
    checks.push('admin preview preserves JATS table row and column spans');
  }
  await admin.c.close();

  const adminMobile = await context('admin', { width: 390, height: 844 });
  await adminMobile.p.goto(base + '/pages/g02/');
  await adminMobile.p.getByRole('heading', { name: /PMC 首批候选/ }).waitFor();
  await adminMobile.p.getByLabel('选择候选文章').locator('option').first().waitFor({ state: 'attached' });
  await adminMobile.p.locator('.hub-pmc-review').getByRole('button', { name: '记录本项批准' }).waitFor();
  await adminMobile.p.getByLabel('选择候选文章').selectOption(figureArticle.candidateId);
  await adminMobile.p.getByText('核对表格文字与逐件媒体／附件').click();
  const mobileFigure = adminMobile.p.locator('.hub-pmc-figure img').first();
  await mobileFigure.scrollIntoViewIfNeeded();
  await mobileFigure.evaluate(img => img.decode());
  assert.ok(await mobileFigure.evaluate(img => img.naturalWidth > 100));
  const [fullSizeTab] = await Promise.all([
    adminMobile.c.waitForEvent('page'),
    adminMobile.p.getByRole('link', { name: '原尺寸查看这张图' }).first().click(),
  ]);
  await fullSizeTab.waitForLoadState();
  assert.match(fullSizeTab.url(), /\/api\/hub-sources\/pmc-review-images\//);
  assert.ok(await fullSizeTab.locator('img').evaluate(img => img.naturalWidth > 800));
  await fullSizeTab.close();
  assert.equal(await adminMobile.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await adminMobile.p.locator('.hub-pmc-figure').first().screenshot({ path: out + 'g02-admin-pmc13691533-figure1-390.png' });
  await adminMobile.p.locator('.hub-pmc-review').getByRole('button', { name: '记录本项批准' }).scrollIntoViewIfNeeded();
  await adminMobile.p.screenshot({ path: out + 'g02-admin-390.png' });
  checks.push('admin mobile PMC review has no horizontal overflow');
  await adminMobile.c.close();

  const owner = await context('owner');
  await owner.p.goto(base + '/pages/g02/');
  await owner.p.getByText('当前账号没有此 Hub 的来源审核授权。').waitFor();
  const denied = await owner.c.request.get(base + '/api/hub-sources/pmc-review-items');
  network.push({ actor: 'owner', path: '/api/hub-sources/pmc-review-items', status: denied.status() });
  assert.equal(denied.status(), 403);
  const deniedPreview = await owner.c.request.get(base + '/api/hub-sources/pmc-review-images/' + firstFigure.id);
  assert.equal(deniedPreview.status(), 403);
  assert.equal(await owner.p.locator('.hub-pmc-review').getByRole('button', { name: '记录本项批准' }).count(), 0);
  await owner.p.screenshot({ path: out + 'g02-owner-denied.png', fullPage: true });
  checks.push('researcher cannot open PMC review');
  await owner.p.goto(base + '/pages/e01/');
  await owner.p.getByText('PMC 暂存候选').waitFor();
  await owner.p.getByText('PMC 获准展示').locator('..').locator('dd').getByText('0', { exact: true }).waitFor();
  assert.equal(await owner.p.getByText('PMC 获准展示').locator('..').locator('dd').textContent(), '0');
  assert.equal(await owner.p.locator('a[href^="/pages/e02/?recordId=pmc-"]').count(), 0);
  await owner.p.screenshot({ path: out + 'e01-owner-unapproved-1440.png', fullPage: true });
  checks.push('E01 reads real DB candidate count but exposes no unapproved PMC article');
  await owner.p.goto(base + '/pages/e02/?recordId=pmc-PMC13691533');
  await owner.p.getByRole('heading', { name: '暂不可查看此文献' }).waitFor();
  await owner.p.screenshot({ path: out + 'e02-owner-unapproved.png', fullPage: true });
  checks.push('E02 unapproved PMC detail returns 404');
  const deniedAsset = await owner.c.request.get(base + '/api/hub-sources/pmc-assets/' + firstAssetId);
  network.push({ actor: 'owner', path: '/api/hub-sources/pmc-assets/' + firstAssetId,
    status: deniedAsset.status() });
  assert.equal(deniedAsset.status(), 404);
  const deniedInline = await owner.c.request.get(base + '/api/hub-sources/pmc-images/' + firstFigure.id);
  assert.equal(deniedInline.status(), 404);
  checks.push('unapproved original asset cannot be downloaded');
  await owner.c.close();

  const mobile = await context(null, { width: 390, height: 844 });
  await mobile.p.goto(base + '/pages/e01/');
  await mobile.p.getByText('PMC 暂存候选').waitFor();
  await mobile.p.getByText('PMC 暂存候选').locator('..').locator('dd').getByText('20', { exact: true }).waitFor();
  assert.equal(await mobile.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await mobile.p.screenshot({ path: out + 'e01-anonymous-390.png', fullPage: true });
  checks.push('anonymous mobile E01 has no horizontal overflow');
  await mobile.c.close();

  assert.deepEqual(errors, []);
  assert.ok(network.some(item => item.actor === 'admin' && item.path.endsWith('/pmc-review-items') && item.status === 200));
  assert.ok(network.some(item => item.actor === 'owner' && item.path.endsWith('/pmc-review-items') && item.status === 403));
  assert.ok(network.some(item => item.actor === 'owner' && item.path.endsWith('/publications') && item.status === 200));
  assert.ok(network.some(item => item.actor === 'owner' && item.path.endsWith('/publications/pmc-PMC13691533') && item.status === 404));
  writeFileSync(out + 'result.json', JSON.stringify({ passed: true, checks, errors, network }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, evidence: out }));
} catch (error) {
  await active?.screenshot({ path: out + 'failure.png', fullPage: true }).catch(() => {});
  writeFileSync(out + 'failure.json', JSON.stringify({ message: error.message, checks, errors, network }, null, 2));
  console.error(JSON.stringify({ passed: false, message: error.message, evidence: out }));
  process.exitCode = 1;
} finally { await browser.close(); }
