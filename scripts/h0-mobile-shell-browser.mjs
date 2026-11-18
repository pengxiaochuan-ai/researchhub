import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';

const root = '/Users/mac/aisciencesys/';
const out = root + 'docs/test/evidence/2026-10-31-h0-mobile-shell/browser-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chrome = pw.chromium ?? pw.default.chromium;
const browser = await chrome.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const base = 'http://127.0.0.1:19501';
const checks = [], errors = [], measurements = [];

async function measure(page, name, route, expectedWidth) {
  await page.goto(base + '/pages/' + route + '/?hubKey=lingshu-xinyu');
  await page.locator('.qiyan-page-context').waitFor();
  await page.locator('.qiyan-platform-sidebar').waitFor({ state: 'attached' });
  await page.locator('.qiyan-hub-nav-toggle').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.querySelector('.qiyan-platform-sidebar')?.inert === true, null,
    { timeout: 2000 }).catch(async () => {
    const state = await page.evaluate(() => ({ width: innerWidth, marker: document.body.dataset.hubSourceReal,
      page: document.body.dataset.platformPage, toggle: Boolean(document.querySelector('.qiyan-hub-nav-toggle')),
      inert: document.querySelector('.qiyan-platform-sidebar')?.inert,
      open: document.body.classList.contains('qiyan-hub-mobile-menu-open'),
      mobile: matchMedia('(max-width:900px)').matches }));
    throw new Error(`${name}/${route}: sidebar did not become inert ${JSON.stringify(state)}`);
  });
  const value = await page.evaluate(() => {
    const main = document.querySelector('.platform-main');
    const sidebar = document.querySelector('.qiyan-platform-sidebar');
    const content = document.querySelector('.real-hub') ?? main;
    const mainRect = main.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const brand = document.querySelector('.qiyan-header-brand')?.getBoundingClientRect();
    const user = document.querySelector('.qiyan-user-trigger')?.getBoundingClientRect();
    const nav = document.querySelector('.qiyan-context-nav');
    const navElements = [...(nav?.querySelectorAll(':scope > button') ?? [])];
    const navButtons = navElements.map(button => button.getBoundingClientRect());
    return { innerWidth, outerWidth, dpr: devicePixelRatio, scale: visualViewport.scale,
      documentWidth: document.documentElement.scrollWidth, mainLeft: mainRect.left,
      mainWidth: mainRect.width, contentWidth: contentRect.width,
      sidebarDisplay: getComputedStyle(sidebar).display,
      sidebarRight: sidebar.getBoundingClientRect().right,
      sidebarInert: sidebar.inert,
      headerOverlap: Boolean(brand && user && brand.right > user.left),
      brandRight: brand?.right ?? null, userLeft: user?.left ?? null, userRight: user?.right ?? null,
      userDisplay: getComputedStyle(document.querySelector('.qiyan-user-trigger')).display,
      navButtonOverlap: navButtons.some((rect, index) => index > 0 && rect.left < navButtons[index - 1].right - 1),
      navTextClipped: navElements.some(button => button.scrollWidth > button.clientWidth + 1),
      navScrollWidth: nav?.scrollWidth ?? null, navClientWidth: nav?.clientWidth ?? null };
  });
  measurements.push({ name, route, ...value });
  await page.screenshot({ path: out + `${name}-${route}.png`, fullPage: true });
  assert.ok(value.documentWidth <= value.innerWidth + 1, `${name}/${route}: root overflow ${JSON.stringify(value)}`);
  assert.ok(value.mainLeft <= 8, `${name}/${route}: main starts after fixed sidebar ${JSON.stringify(value)}`);
  assert.ok(value.mainWidth >= expectedWidth - 16, `${name}/${route}: main too narrow ${JSON.stringify(value)}`);
  assert.ok(value.contentWidth >= expectedWidth - 16, `${name}/${route}: content too narrow ${JSON.stringify(value)}`);
  assert.ok(value.sidebarRight <= 1 && value.sidebarInert,
    `${name}/${route}: closed sidebar visible or focusable ${JSON.stringify(value)}`);
  assert.equal(value.headerOverlap, false, `${name}/${route}: header brand overlaps account`);
  assert.ok(value.userLeft >= 0 && value.userRight <= value.innerWidth + 1,
    `${name}/${route}: account entry outside viewport ${JSON.stringify(value)}`);
  assert.equal(value.navButtonOverlap, false, `${name}/${route}: context navigation buttons overlap`);
  assert.equal(value.navTextClipped, false, `${name}/${route}: context navigation text spills into adjacent tab`);
  if (route === 'h01') {
    const lastTab = page.locator('.qiyan-context-nav > button').last();
    await lastTab.focus();
    await lastTab.scrollIntoViewIfNeeded();
    const reachable = await page.evaluate(() => {
      const nav = document.querySelector('.qiyan-context-nav');
      const tab = nav.querySelector('button:last-of-type');
      const navRect = nav.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      return { focused: document.activeElement === tab,
        visible: tabRect.left >= navRect.left - 1 && tabRect.right <= navRect.right + 1,
        scrollLeft: nav.scrollLeft };
    });
    assert.equal(reachable.focused, true, `${name}/${route}: last tab not keyboard-focusable`);
    assert.equal(reachable.visible, true, `${name}/${route}: last tab cannot scroll into view ${JSON.stringify(reachable)}`);
  }
  checks.push(name + '-' + route + '-mobile-shell-reflow');
}

async function mobileNavigation(page, name, route) {
  const toggle = page.locator('.qiyan-hub-nav-toggle');
  const sidebar = page.locator('.qiyan-platform-sidebar');
  await toggle.waitFor({ state: 'visible', timeout: 1500 });
  assert.equal(await toggle.innerText(), '平台导航');
  assert.equal(await sidebar.evaluate(element => element.inert), true);
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await sidebar.evaluate(element => element.inert), false);
  assert.equal(await sidebar.locator('nav[aria-label="平台主导航"] > button').count(), 5);
  assert.equal(await sidebar.locator('.qiyan-nav-item').first().evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('.platform-main').evaluate(element => element.inert), true, `${name}/${route}: covered main is focusable`);
  assert.equal(await page.locator('header.global-platform-header').evaluate(element => element.inert), true, `${name}/${route}: covered header is focusable`);
  await sidebar.locator('button:not([disabled])').last().focus();
  await page.keyboard.press('Tab');
  assert.equal(await toggle.evaluate(element => element === document.activeElement), true, `${name}/${route}: Tab escaped drawer`);
  await page.keyboard.press('Tab');
  assert.equal(await sidebar.locator('.qiyan-nav-item').first().evaluate(element => element === document.activeElement), true, `${name}/${route}: Tab did not wrap to first item`);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await toggle.evaluate(element => element === document.activeElement), true, `${name}/${route}: Shift+Tab escaped drawer`);
  await page.waitForFunction(() => Math.abs(document.querySelector('.qiyan-platform-sidebar')?.getBoundingClientRect().left ?? -999) <= 1);
  await page.screenshot({ path: out + `${name}-${route}-menu-open.png` });
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await sidebar.evaluate(element => element.inert), true);
  assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('.platform-main').evaluate(element => element.inert), false);
  assert.equal(await page.locator('header.global-platform-header').evaluate(element => element.inert), false);
  await toggle.click();
  await page.locator('.qiyan-hub-nav-backdrop').click({ position: { x: 300, y: 100 } });
  assert.equal(await sidebar.evaluate(element => element.inert), true);
  await toggle.click();
  await toggle.click();
  assert.equal(await sidebar.evaluate(element => element.inert), true);
  if (name === 'mobile390' && route === 'h01') {
    await toggle.click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.platform-main')?.inert === false &&
      document.querySelector('.qiyan-platform-sidebar')?.inert === false);
    assert.equal(await page.locator('.platform-main').evaluate(element => element.inert), false, 'wide main remained inert');
    assert.equal(await page.locator('header.global-platform-header').evaluate(element => element.inert), false, 'wide header remained inert');
    assert.equal(await sidebar.evaluate(element => element.inert), false, 'wide sidebar remained inert');
    assert.equal(await toggle.isVisible(), false, 'wide mobile toggle remained visible');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.qiyan-platform-sidebar')?.inert === true);
    assert.equal(await sidebar.evaluate(element => element.inert), true, 'closed mobile sidebar became focusable');
  }
  if (route === 'h05') {
    await toggle.click();
    await sidebar.getByRole('button', { name: '领域研究' }).click();
    await page.waitForURL('**/pages/h01/**');
  }
  checks.push(name + '-' + route + '-five-primary-navigation-and-focus');
}

let zoom;
try {
  for (const [name, width, height] of [['mobile390', 390, 844], ['mobile320', 320, 700]]) {
    const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: out + 'video' } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['h01', 'h05']) {
      await measure(page, name, route, width);
      await mobileNavigation(page, name, route);
    }
    await context.close();
  }
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out + 'video' } });
  const page = await desktop.newPage();
  for (const route of ['h01', 'h05']) {
    await page.goto(base + '/pages/' + route + '/?hubKey=lingshu-xinyu');
    await page.locator('.qiyan-platform-sidebar').waitFor();
    const desktopMetric = await page.evaluate(() => ({
      sidebarWidth: document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().width,
      sidebarDisplay: getComputedStyle(document.querySelector('.qiyan-platform-sidebar')).display,
      mainLeft: document.querySelector('.platform-main').getBoundingClientRect().left,
    }));
    assert.equal(desktopMetric.sidebarDisplay, 'flex');
    assert.equal(await page.getByRole('button', { name: '平台导航' }).count(), 0);
    assert.ok(Math.abs(desktopMetric.sidebarWidth - 220) <= 1);
    assert.ok(Math.abs(desktopMetric.mainLeft - 228) <= 1, JSON.stringify(desktopMetric));
    await page.screenshot({ path: out + `desktop1440-${route}.png`, fullPage: true });
    checks.push(`desktop1440-${route}-frozen-shell-unchanged`);
  }
  await desktop.close();

  zoom = await chrome.launchPersistentContext(mkdtempSync(root + '.tmp/h0-mobile-zoom-'), {
    headless: true, viewport: null, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--window-size=1440,900'], recordVideo: { dir: out + 'video', size: { width: 1440, height: 900 } },
  });
  const settings = zoom.pages()[0];
  await settings.goto('chrome://settings/appearance');
  await settings.locator('#zoomLevel').selectOption('2');
  const zoomPage = await zoom.newPage();
  zoomPage.on('pageerror', error => errors.push(error.message));
  await measure(zoomPage, 'native200', 'h01', 720);
  await mobileNavigation(zoomPage, 'native200', 'h01');
  const zoomMetric = measurements.at(-1);
  assert.equal(zoomMetric.dpr, 2);
  assert.equal(zoomMetric.scale, 1);
  assert.ok(zoomMetric.innerWidth < zoomMetric.outerWidth / 2 + 20);
  const cdp = await zoom.newCDPSession(zoomPage);
  const capture = await cdp.send('Page.captureScreenshot', {
    format: 'png', fromSurface: false, captureBeyondViewport: false,
  });
  writeFileSync(out + 'native200-h01-cdp.png', Buffer.from(capture.data, 'base64'));
  await cdp.detach();
  await measure(zoomPage, 'native200', 'h05', 720);
  await mobileNavigation(zoomPage, 'native200', 'h05');
  checks.push('chrome-native-200-percent-confirmed');

  const demo = await browser.newContext({ viewport: { width: 320, height: 700 } });
  await demo.addInitScript(() => sessionStorage.setItem('lingshu-demo-mode', 'true'));
  const demoPage = await demo.newPage();
  await demoPage.goto(base + '/pages/h01/');
  await demoPage.locator('.qiyan-page-context').waitFor();
  assert.equal(await demoPage.evaluate(() => document.body.dataset.hubSourceReal ?? null), null);
  assert.equal(await demoPage.locator('.qiyan-hub-nav-toggle').count(), 0);
  await demoPage.screenshot({ path: out + 'demo320-h01-existing-layout.png', fullPage: true });
  checks.push('explicit-demo-not-opted-into-real-mobile-shell');
  await demo.close();

  const manifest = JSON.parse(readFileSync(root + 'researchhub/platform-pages.json', 'utf8'));
  const smoke = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const smokePage = await smoke.newPage();
  const shellPages = [];
  smokePage.on('pageerror', error => errors.push(error.message));
  for (const entry of manifest.pages) {
    const response = await smokePage.goto(base + entry.route);
    assert.equal(response.status(), 200, entry.id);
    await smokePage.waitForTimeout(180);
    const shell = await smokePage.evaluate(() => ({
      headers: document.querySelectorAll('header.global-platform-header').length,
      sidebars: document.querySelectorAll('.qiyan-platform-sidebar').length,
      text: document.body.innerText.length,
    }));
    assert.ok(shell.headers <= 1 && shell.sidebars <= 1 && shell.text > 0, `${entry.id}: ${JSON.stringify(shell)}`);
    shellPages.push(entry.id);
  }
  assert.equal(shellPages.length, manifest.pages.length);
  writeFileSync(out + 'shell-pages.json', JSON.stringify(shellPages, null, 2));
  checks.push(`manifest-${shellPages.length}-page-desktop-shell-smoke`);
  await smoke.close();

  assert.deepEqual(errors, []);
  writeFileSync(out + 'result.json', JSON.stringify({ passed: true, checks, measurements, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, evidence: out, checks: checks.length }));
} catch (error) {
  writeFileSync(out + 'result.json', JSON.stringify({ passed: false, checks, measurements, errors, failure: error.message }, null, 2));
  console.error(JSON.stringify({ passed: false, evidence: out, checks: checks.length, failure: error.message }));
  process.exitCode = 1;
} finally {
  await zoom?.close();
  await browser.close();
}
