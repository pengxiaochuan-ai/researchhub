import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const base = 'http://127.0.0.1:19501';
const out = root + 'docs/test/evidence/2026-11-01-researchhub-g02-governance/' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser = await (pw.chromium ?? pw.default.chromium).launch({ headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const checks = [];
const errors = [];
const network = [];
const layout = [];

async function session(actor, viewport) {
  const context = await browser.newContext({ viewport, recordVideo: { dir: out + 'video' } });
  const login = await context.request.post(base + '/api/auth/login', { data: {
    tenantSlug: runtime.ids.tenant, username: `${actor}@example.org`, password: runtime.password,
  } });
  assert.equal(login.status(), 201);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (path.endsWith('/review-batches')) network.push({ actor, path, status: response.status() });
  });
  await page.goto(base + '/pages/g02/');
  return { context, page };
}

try {
  for (const [actor, viewport] of [
    ['admin', { width: 1440, height: 900 }], ['owner', { width: 390, height: 844 }],
    ['admin', { width: 320, height: 740 }],
  ]) {
    const caseName = `${actor}-${viewport.width}`;
    const { context, page } = await session(actor, viewport);
    await page.getByRole('heading', { name: '管理与治理', exact: true }).waitFor();
    await page.locator('[data-user-trigger][data-authenticated="true"]').waitFor();
    assert.equal(await page.getByRole('heading', { name: '来源审核', exact: true }).count(), 0);
    assert.equal(await page.locator('.g02-stat').count(), 6);
    assert.deepEqual(await page.locator('.g02-stat strong').allTextContents(), Array(6).fill('—'));
    assert.equal(await page.getByText('2024-09-15', { exact: false }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '下载治理报告（未接通）' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '日期范围（未接通）' }).isDisabled(), true);
    const geometry = await page.evaluate(() => {
      const box = selector => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect && { x: rect.x, right: rect.right, width: rect.width };
      };
      return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        stat: box('.g02-stat'), chart: box('.g02-chart-row .ui-card'),
        nav: box('.qiyan-context-nav'), navScrollWidth: document.querySelector('.qiyan-context-nav')?.scrollWidth,
        navClientWidth: document.querySelector('.qiyan-context-nav')?.clientWidth };
    });
    layout.push({ caseName, ...geometry });
    if (viewport.width <= 390) {
      assert.ok(geometry.stat.width >= (viewport.width - 80) / 2, JSON.stringify(geometry));
      assert.ok(geometry.chart.width >= viewport.width - 70, JSON.stringify(geometry));
      assert.ok(geometry.navScrollWidth > geometry.navClientWidth, JSON.stringify(geometry));
      assert.ok(geometry.documentWidth <= viewport.width + 1, JSON.stringify(geometry));
    }
    await page.screenshot({ path: out + `${caseName}-overview.png`, fullPage: true });
    if (viewport.width <= 390) {
      await page.locator('.g02-chart-row').scrollIntoViewIfNeeded();
      await page.screenshot({ path: out + `${caseName}-overview-cards.png` });
    }
    await page.getByRole('navigation', { name: '管理与治理上下文导航' }).getByRole('button', { name: '数据治理' }).click();
    await page.getByRole('heading', { name: '来源审核', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('view'), 'source-review');
    await page.getByRole('navigation', { name: '管理与治理上下文导航' }).getByRole('button', { name: '总览' }).click();
    await page.locator('.g02-stat').first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('view'), null);
    await page.getByRole('button', { name: '来源审核', exact: true }).click();
    await page.getByRole('heading', { name: '来源审核', exact: true }).waitFor();
    if (actor === 'admin') {
      const picker = page.getByLabel('选择候选文章');
      await picker.waitFor();
      assert.equal(await picker.locator('option').count(), 20);
      if (viewport.width <= 390) {
        await picker.scrollIntoViewIfNeeded();
        const pickerBox = await picker.boundingBox();
        assert.ok(pickerBox && pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= viewport.width + 1,
          JSON.stringify(pickerBox));
        layout.push({ caseName, sourcePicker: pickerBox });
        await page.screenshot({ path: out + `${caseName}-source-picker.png` });
      }
    }
    else await page.getByText('当前账号没有此 Hub 的来源审核授权。').waitFor();
    await page.screenshot({ path: out + `${caseName}-source-review.png`, fullPage: true });
    await page.getByRole('button', { name: '返回治理总览' }).click();
    await page.getByRole('heading', { name: '管理与治理', exact: true }).waitFor();
    checks.push(`${caseName}-governance-overview-source-subfunction-return`);
    await context.close();
  }
  const { context: otherContext, page: otherPage } = await session('admin', { width: 1440, height: 900 });
  await otherPage.evaluate(() => sessionStorage.setItem('lingshu-demo-mode', 'true'));
  await otherPage.goto(base + '/pages/g03/');
  await otherPage.getByRole('navigation', { name: '管理与治理上下文导航' }).getByRole('button', { name: '数据治理' }).click();
  assert.equal(new URL(otherPage.url()).pathname, '/pages/g05/');
  checks.push('other-governance-page-navigation-unchanged');
  await otherPage.goto(base + '/pages/o02/');
  await otherPage.getByRole('navigation', { name: '领域研究上下文导航' }).getByRole('button', { name: '形成研究课题' }).click();
  assert.equal(new URL(otherPage.url()).pathname, '/pages/q01/');
  checks.push('shared-nav-action-navigation-unchanged');
  await otherContext.close();
  const { context: crossContext, page: crossPage } = await session('admin', { width: 1440, height: 900 });
  await crossPage.goto(base + '/pages/g02/?view=source-review');
  await crossPage.getByRole('button', { name: '知识库治理' }).click();
  assert.equal(new URL(crossPage.url()).pathname, '/pages/k01/');
  assert.equal(new URL(crossPage.url()).searchParams.has('view'), false);
  checks.push('source-review-view-not-carried-to-other-page');
  await crossContext.close();
  assert.deepEqual(errors, []);
  assert.ok(network.some(item => item.actor === 'admin' && item.status === 200));
  assert.ok(network.some(item => item.actor === 'owner' && item.status === 403));
  writeFileSync(out + 'result.json', JSON.stringify({ passed: true, checks, errors, network, layout }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, evidence: out }));
} finally { await browser.close(); }
