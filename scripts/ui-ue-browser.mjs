import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const phase = process.argv.includes('--baseline') ? 'before' : 'after';
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.UI_BASE_URL || 'http://localhost:5173';
const evidence = path.resolve('docs/testing/ui-ue-validation-2026-10-20', phase);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.UI_CHROMIUM_PATH || chromium.executablePath() });
const errors = [];
const metrics = [];
const formMetrics = [];
const checks = [];
async function check(name, action) {
  try { await action(); checks.push({ name, status: 'pass' }); }
  catch (error) { checks.push({ name, status: 'fail', reason: error.message }); }
}
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: evidence, size: { width: 1440, height: 900 } }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1920, height: 1200 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/pages/e02/`);
    await page.locator('.detail-abstract p').first().waitFor();
    await page.locator('.qiyan-platform-sidebar').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).marginLeft === '220px');
    const sample = await page.locator('.detail-abstract p').first().evaluate(element => {
      const style = getComputedStyle(element);
      return { fontSize: style.fontSize, lineHeight: style.lineHeight, width: element.getBoundingClientRect().width, text: element.textContent.slice(0, 40) };
    });
    const layout = await page.locator('.detail-board').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
    metrics.push({ page: 'e02', viewport, sample, layout });
    await page.screenshot({ path: path.join(evidence, `e02-${viewport.width}.png`) });
    await page.locator('.detail-abstract').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidence, `e02-reading-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/pages/q01/`);
  await page.getByLabel('研究课题名称', { exact: false }).waitFor();
  await page.locator('.qiyan-platform-sidebar').waitFor();
  await page.screenshot({ path: path.join(evidence, 'q01-1440.png') });
  if (phase === 'after') {
    for (const viewport of [{width:1366,height:768},{width:1920,height:1200},{width:1440,height:900}]) {
      await page.setViewportSize(viewport);
      formMetrics.push(await page.locator('.q01-project').evaluate((el,viewport)=>({viewport,width:el.clientWidth,scrollWidth:el.scrollWidth,input:(()=>{const s=getComputedStyle(el.querySelector('input'));return{font:s.fontSize,line:s.lineHeight};})()}),viewport));
      await page.screenshot({path:path.join(evidence,`q01-${viewport.width}.png`)});
    }
    await check('Q01 三种桌面视口不横向溢出且输入保持14/22',()=>{
      for (const sample of formMetrics) {assert.equal(sample.input.font,'14px');assert.equal(sample.input.line,'22px');assert.ok(sample.scrollWidth<=sample.width+1);}
    });
  }
  await check('阅读正文 16/28 且宽屏行宽不超过 768px', async () => {
    for (const { sample } of metrics) {
      assert.equal(sample.fontSize, '16px'); assert.equal(sample.lineHeight, '28px');
      assert.ok(sample.width <= 768, `reading width ${sample.width}`);
    }
  });
  await page.goto(`${baseURL}/pages/e02/`);
  await page.locator('.qiyan-platform-sidebar').waitFor();
  await check('引用真实写入剪贴板并标出演示未核验', async () => {
    await page.evaluate(() => navigator.clipboard.writeText('ui-test-sentinel'));
    await page.getByRole('button', { name: /^(引用|复制演示引用)$/ }).click();
    await page.waitForTimeout(150);
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /固定演示.*未核验/s);
  });
  await page.evaluate(() => {
    window.uiOriginalClipboardWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async () => { throw new DOMException('Test denied', 'NotAllowedError'); };
  });
  const trigger = page.getByRole('button', { name: '岐研 AI 解读', exact: true });
  await trigger.click();
  await check('抽屉打开进入焦点且 Tab 循环、Escape 归还触发点', async () => {
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'focus did not enter dialog');
    const last = dialog.getByRole('button', { name: '复制内容', exact: true });
    await last.focus(); await page.keyboard.press('Tab');
    assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'focus escaped dialog');
    await dialog.getByRole('button',{name:'关闭',exact:true}).focus(); await page.keyboard.press('Shift+Tab');
    assert.equal(await last.evaluate(el => el === document.activeElement),true,'reverse tab did not cycle');
    await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'focus did not return');
    assert.equal(await page.locator('[inert]').count(),0,'background inert not restored');
    await trigger.click();
  });
  // Open even when the previous assertion failed, so independent checks still run.
  if (!await page.getByRole('dialog').count()) await trigger.click();
  await check('复制失败不会提示已复制，提供手动复制路径', async () => {
    await page.getByRole('dialog').getByRole('button', { name: '复制内容', exact: true }).click();
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('button', { name: '已复制', exact: true }).count(), 0);
    assert.match(await page.getByRole('alert').innerText({ timeout: 1000 }), /复制失败/);
    assert.ok(await page.getByLabel('手动复制解读内容').isVisible());
  });
  await check('AI 固定演示不宣称实际生成', async () => {
    assert.match(await page.getByRole('dialog').innerText(), /固定演示.*未调用.*AI/s);
    assert.equal(await page.getByRole('button', { name: '生成结果摘要', exact: true }).count(), 0);
  });
  await check('E02 实际语义标签和评级文字不使用低对比度浅灰/浅绿', async () => {
    const measured=await page.locator('.ai-metrics small, .ai-two p small').evaluateAll(elements=>elements.map(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el.closest('.ai-card')||el.parentElement).backgroundColor})));
    assert.ok(measured.length>0);
    assert.ok(measured.every(({color})=>color==='rgb(95, 111, 137)'),JSON.stringify(measured));
  });
  await page.screenshot({ path: path.join(evidence, 'e02-ai-copy-failure.png') });
  if (phase === 'after') {
    await check('复制失败后恢复重试，不把错误提示混入内容', async () => {
      await page.evaluate(() => { navigator.clipboard.writeText = window.uiOriginalClipboardWrite; });
      await page.getByRole('dialog').getByRole('button', {name:'复制内容',exact:true}).click();
      const text = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(text,/固定演示/); assert.ok(!text.includes('复制失败')); assert.ok(!text.includes('手动复制解读内容'));
      assert.equal(await page.getByRole('dialog').getByRole('alert').count(),0);
    });
    await check('慢复制期间不切换内容，避免旧结果挂到新页签', async () => {
      await page.evaluate(() => { navigator.clipboard.writeText = text => new Promise(resolve => { window.uiResolveCopy = () => window.uiOriginalClipboardWrite(text).then(resolve); }); });
      await page.getByRole('dialog').getByRole('button',{name:'复制内容',exact:true}).click();
      const nextTab = page.getByRole('dialog').getByRole('button',{name:'研究局限',exact:true});
      assert.equal(await nextTab.isDisabled(),true);
      await page.evaluate(() => window.uiResolveCopy());
      await page.getByRole('dialog').getByRole('status').waitFor();
      assert.equal(await nextTab.isEnabled(),true);
      assert.match(await page.evaluate(() => navigator.clipboard.readText()),/核心解读/);
      await nextTab.click(); assert.equal(await page.getByRole('dialog').getByRole('status').count(),0);
      await page.evaluate(() => { navigator.clipboard.writeText = window.uiOriginalClipboardWrite; });
    });
    await page.keyboard.press('Escape');
    await page.goto(`${baseURL}/pages/q01/`);
    await page.locator('#q01-title').waitFor();
    const save = () => page.locator('.q01-actions').getByRole('button', { name: '保存草稿', exact: true });
    const next = () => page.locator('.q01-actions').getByRole('button', { name: '下一步：生成研究方案 →', exact: true });
    await check('首次未编辑不报错也不阻止离开', async () => {
      assert.equal(await page.locator('.q01-field-error').count(), 0);
      let dialog = false;
      const handler = async d => { dialog = true; await d.dismiss(); };
      page.on('dialog', handler);
      await page.locator('.q01-actions').getByRole('button', { name: '取消', exact: true }).click();
      await page.waitForURL('**/pages/o02/**');
      page.off('dialog', handler); assert.equal(dialog, false);
      await page.goto(`${baseURL}/pages/q01/`);
    });
    await check('字段错误定位、14px 错误及输入保留', async () => {
      for (const id of ['q01-title','q01-core-question','q01-population','q01-intervention','q01-comparator','q01-outcomes']) await page.locator(`#${id}`).fill('');
      await next().click();
      await page.waitForFunction(() => document.activeElement.id === 'q01-title');
      assert.equal(await page.locator('[aria-invalid="true"]').count(), 6);
      assert.equal(await page.locator('.q01-field-error').first().evaluate(el => getComputedStyle(el).fontSize), '14px');
      await page.locator('#q01-title').fill('UI 合成验收课题（非真实研究）');
      await next().click(); await page.waitForFunction(() => document.activeElement.id === 'q01-core-question');
      assert.equal(await page.locator('#q01-title').inputValue(), 'UI 合成验收课题（非真实研究）');
      await page.screenshot({ path: path.join(evidence, 'q01-validation.png') });
    });
    await check('仅真实编辑触发离开保护，取消离开保留输入', async () => {
      const dialogPromise = page.waitForEvent('dialog');
      const action = page.locator('.q01-actions').getByRole('button', { name: '取消', exact: true }).click();
      const dialog = await dialogPromise;
      assert.equal(dialog.type(), 'beforeunload'); await dialog.dismiss(); await action;
      assert.match(page.url(), /\/q01\//);
      assert.equal(await page.locator('#q01-title').inputValue(), 'UI 合成验收课题（非真实研究）');
    });
    await check('保存成功、刷新恢复、不误弹离开确认', async () => {
      await save().click();
      assert.equal(await page.locator('.q01-save-state').getAttribute('data-save-state'), 'saved');
      let dialogs = 0; const handler = async d => { dialogs++; await d.dismiss(); };
      page.on('dialog', handler); await page.reload();
      assert.equal(await page.locator('#q01-title').inputValue(), 'UI 合成验收课题（非真实研究）');
      assert.equal(await page.locator('.q01-save-state').getAttribute('data-save-state'), 'saved');
      page.off('dialog', handler); assert.equal(dialogs, 0);
    });
    await check('真实存储写入失败不丢输入，恢复后可重试', async () => {
      await page.locator('#q01-title').fill('UI 写入失败后重试（非真实研究）');
      await page.evaluate(() => {
        window.uiOriginalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'lingshu-research-demo-v1') throw new DOMException('Synthetic quota failure','QuotaExceededError');
          return window.uiOriginalSetItem.call(this,key,value);
        };
      });
      await save().click();
      assert.equal(await page.locator('.q01-save-state').getAttribute('data-save-state'), 'failed');
      assert.match(await page.locator('.q01-error-summary').innerText(), /保存失败/);
      assert.equal(await page.locator('#q01-title').inputValue(), 'UI 写入失败后重试（非真实研究）');
      await page.screenshot({ path: path.join(evidence, 'q01-save-failure.png') });
      await page.evaluate(() => { Storage.prototype.setItem = window.uiOriginalSetItem; });
      await save().click();
      assert.equal(await page.locator('.q01-save-state').getAttribute('data-save-state'), 'saved');
    });
    await check('修正 PICO 后进入同一课题方案，不误报 AI 已执行', async () => {
      await page.locator('#q01-core-question').fill('合成样例干预是否改善结局？');
      for (const [id,value] of [['q01-population','合成人群'],['q01-intervention','合成干预'],['q01-comparator','合成对照'],['q01-outcomes','合成结局']]) await page.locator(`#${id}`).fill(value);
      const projectId = new URL(page.url()).searchParams.get('projectId');
      await page.screenshot({ path: path.join(evidence, 'q01-corrected.png') });
      await next().click(); await page.waitForURL('**/pages/s07/**');
      assert.equal(new URL(page.url()).searchParams.get('projectId'),projectId);
      assert.ok(new URL(page.url()).searchParams.get('protocolId'));
      await page.screenshot({ path: path.join(evidence, 'q01-to-s07.png') });
    });
    await page.goto(`${baseURL}/tests/fixtures/shared-button.html`);
    await check('共享 Button 原生提交、鼠标/键盘防重、错误恢复', async () => {
      const normal = page.getByRole('button', { name: '普通操作', exact: true });
      await normal.click(); assert.equal(await page.locator('#submits').innerText(),'0');
      await page.getByRole('button', {name:'提交操作',exact:true}).click();
      assert.equal(await page.locator('#submits').innerText(),'1');
      const busy = page.getByRole('button', {name:'异步操作',exact:true});
      await busy.click(); assert.equal(await busy.getAttribute('aria-busy'),'true'); assert.equal(await busy.isDisabled(),true);
      // Native disabled buttons must ignore pointer and keyboard activation, not only direct handlers.
      for (const name of ['异步操作','禁止操作']) {
        const button = page.getByRole('button',{name,exact:true}); const box = await button.boundingBox();
        await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
        await button.press('Enter'); await button.press('Space');
      }
      assert.equal(await page.locator('#clicks').innerText(),'2');
      await page.getByRole('button',{name:'模拟失败恢复'}).click(); assert.equal(await busy.isEnabled(),true);
      await page.getByRole('button',{name:'切换独立禁用'}).click();
      await page.getByRole('button',{name:'模拟失败恢复'}).click(); assert.equal(await busy.isDisabled(),true);
      await page.screenshot({path:path.join(evidence,'shared-button-contract.png')});
    });
  }
  await check('无浏览器运行错误', () => assert.deepEqual(errors, []));
  await writeFile(path.join(evidence, 'metrics.json'), JSON.stringify({ phase, browser: browser.version(), devicePixelRatio: await page.evaluate(() => devicePixelRatio), videoPath: await page.video().path(), metrics, formMetrics, checks, consoleErrors: errors, scope: 'synthetic/demo UI only; no backend or clinical acceptance' }, null, 2));
  assert.equal(checks.filter(check => check.status === 'fail').length, 0, JSON.stringify(checks));
} finally {
  await context.close();
  await browser.close();
}
