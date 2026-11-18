import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const out = root + 'docs/test/evidence/2026-10-30-hub-source-first-slice/browser-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser = await (pw.chromium ?? pw.default.chromium).launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const checks = [], errors = [], network = [];
const base = 'http://127.0.0.1:19501';
async function context(actor, viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport, recordVideo: { dir: out + 'video' } });
  const p = await c.newPage();
  p.on('pageerror', error => errors.push(error.message));
  p.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/hub-sources/'))
    network.push({ actor, path: new URL(response.url()).pathname, status: response.status() }); });
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
  await admin.p.getByRole('heading', { name: '来源审核' }).waitFor();
  await admin.p.getByLabel('具体来源').locator('option').first().waitFor({ state: 'attached' });
  await admin.p.getByText('原始行不等于获准数').waitFor();
  assert.equal(await admin.p.getByLabel('权利／内容审核依据链接或受控引用').inputValue(), '');
  await admin.p.screenshot({ path: out + 'g02-admin-desktop.png', fullPage: true });
  checks.push('admin-real-batch-source-review-form-no-evidence-preload');
  await admin.c.close();

  const owner = await context('owner');
  await owner.p.goto(base + '/pages/g02/');
  await owner.p.getByText('当前账号没有此 Hub 的来源审核授权。').waitFor();
  assert.equal(await owner.p.getByRole('button', { name: '记录审核决定' }).count(), 0);
  await owner.p.screenshot({ path: out + 'g02-owner-denied.png', fullPage: true });
  checks.push('owner-review-denied');
  await owner.p.goto(base + '/pages/e01/');
  await owner.p.getByRole('heading', { name: '暂无已获准文献' }).waitFor();
  assert.equal(await owner.p.getByText('15,697').count(), 1);
  assert.equal(await owner.p.getByText('JAMA Psychiatry').count(), 0);
  await owner.p.screenshot({ path: out + 'e01-owner-real-empty.png', fullPage: true });
  checks.push('e01-real-api-empty-not-demo');
  await owner.p.goto(base + '/pages/e02/?recordId=rhsr-' + 'a'.repeat(40));
  await owner.p.getByRole('heading', { name: '暂不可查看此文献' }).waitFor();
  assert.equal(await owner.p.getByText('JAMA Psychiatry').count(), 0);
  await owner.p.screenshot({ path: out + 'e02-owner-not-approved.png', fullPage: true });
  checks.push('e02-unapproved-404-not-demo');
  await owner.c.close();

  const mobile = await context(null, { width: 390, height: 844 });
  await mobile.p.goto(base + '/pages/e01/');
  await mobile.p.getByRole('heading', { name: '暂无已获准文献' }).waitFor();
  const horizontalOverflow = await mobile.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert.equal(horizontalOverflow, false);
  await mobile.p.screenshot({ path: out + 'e01-mobile.png', fullPage: true });
  await mobile.p.getByRole('heading', { name: '暂无已获准文献' }).scrollIntoViewIfNeeded();
  await mobile.p.screenshot({ path: out + 'e01-mobile-empty.png' });
  checks.push('e01-mobile-no-horizontal-overflow');
  await mobile.c.close();
  assert.deepEqual(errors, []);
  assert.ok(network.some(item => item.actor === 'admin' && item.path.endsWith('/review-batches') && item.status === 200));
  assert.ok(network.some(item => item.actor === 'owner' && item.path.endsWith('/review-batches') && item.status === 403));
  assert.ok(network.some(item => item.actor === 'owner' && item.path.endsWith('/publications') && item.status === 200));
  assert.ok(network.some(item => item.actor === 'owner' && item.path.includes('/publications/rhsr-') && item.status === 404));
  writeFileSync(out + 'result.json', JSON.stringify({ checks, errors, network }, null, 2));
  console.log(JSON.stringify({ evidence: out, checks, errors, network }));
} finally { await browser.close(); }
