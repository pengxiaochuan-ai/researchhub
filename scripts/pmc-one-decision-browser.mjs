import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const out = root + 'researchhub/docs/testing/evidence/pmc-one-decision-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser = await (pw.chromium ?? pw.default.chromium).launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const base = 'http://127.0.0.1:19501';
const checks = [], errors = [], requests = [];

async function context(actor, viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport, recordVideo: { dir: out + 'video' } });
  const p = await c.newPage();
  p.on('pageerror', error => errors.push(error.message));
  p.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/api/hub-sources/')) requests.push({ actor: actor || 'anonymous', path, status: response.status() });
  });
  if (actor) {
    const login = await c.request.post(base + '/api/auth/login', { data: {
      tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password,
    } });
    assert.equal(login.status(), 201);
  }
  return { c, p };
}

try {
  const admin = await context('admin');
  await admin.p.goto(base + '/pages/g02/');
  await admin.p.getByRole('heading', { name: 'PMC 首批候选 · 按篇审核' }).waitFor();
  await admin.p.getByLabel('选择候选文章').locator('option').first().waitFor({ state: 'attached' });
  assert.equal(await admin.p.locator('.hub-pmc-decision-actions button').count(), 3);
  assert.equal(await admin.p.getByLabel('权利／内容审核依据 HTTPS 链接').count(), 0);
  assert.equal(await admin.p.getByLabel('核验字段／组件').count(), 0);
  await admin.p.screenshot({ path: out + 'g02-admin-desktop.png', fullPage: true });
  checks.push('named admin sees three one-click article decisions without per-field/evidence form');
  await admin.c.close();

  const mobile = await context('admin', { width: 390, height: 844 });
  await mobile.p.goto(base + '/pages/g02/');
  await mobile.p.getByRole('heading', { name: 'PMC 首批候选 · 按篇审核' }).waitFor();
  await mobile.p.locator('.hub-pmc-decision-actions button').first().scrollIntoViewIfNeeded();
  assert.equal(await mobile.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await mobile.p.screenshot({ path: out + 'g02-admin-mobile.png', fullPage: true });
  checks.push('390px admin decision has no page-level overflow');
  await mobile.c.close();

  const owner = await context('owner');
  await owner.p.goto(base + '/pages/g02/');
  await owner.p.getByText('当前账号没有此 Hub 的来源审核授权。').waitFor();
  assert.equal(await owner.p.locator('.hub-pmc-decision-actions button').count(), 0);
  const tenant = await owner.c.request.get(base + '/api/hub-sources/tenant-pmc-publications');
  assert.equal(tenant.status(), 200);
  assert.deepEqual((await tenant.json()).items, []);
  await owner.p.goto(base + '/pages/e01/');
  await owner.p.getByText('PMC 仅租户内').waitFor();
  await owner.p.screenshot({ path: out + 'e01-owner-empty.png', fullPage: true });
  await owner.p.goto(base + '/pages/e02/?recordId=pmc-PMC13691533');
  await owner.p.getByRole('heading', { name: '暂不可查看此文献' }).waitFor();
  await owner.p.screenshot({ path: out + 'e02-owner-unapproved.png', fullPage: true });
  checks.push('researcher cannot review and current unapproved PMC stays hidden');
  await owner.c.close();

  const anonymous = await context(null);
  const denied = await anonymous.c.request.get(base + '/api/hub-sources/tenant-pmc-publications');
  assert.ok([401, 403].includes(denied.status()));
  await anonymous.c.close();
  checks.push('anonymous tenant-only API denied');
  assert.deepEqual(errors, []);
  writeFileSync(out + 'result.json', JSON.stringify({ checks, requests, errors }, null, 2));
  process.stdout.write(JSON.stringify({ out, checks, errors }) + '\n');
} finally { await browser.close(); }
