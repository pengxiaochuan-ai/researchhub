import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-video-feedback-2026-11-16/browser-'+Date.now();mkdirSync(out,{recursive:true});
test('current video name is readable during upload, never persisted and isolated across scopes',async t=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const name='合成视频_仅供测试_'+('long-name-'.repeat(14))+'<b>literal.mp4',file={name,mimeType:'video/mp4',buffer:Buffer.alloc(128)};
 const start=async()=>{await page.goto(base+'/scripts/fixtures/agent-media-harness.html');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});await page.evaluate(()=>{window.mediaHarness.holdChunk=true;});await page.locator('input[data-agent-materials]').setInputFiles(file);await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseChunk));};
 try{
  await t.test('name remains plain text at narrow width, survives same identity checking and clears on completion',async()=>{
   await start();const label=page.locator('[data-media-upload-name]');await label.waitFor({timeout:1500});assert.equal(await label.textContent(),name);assert.equal(await label.locator('b').count(),0);
   await page.setViewportSize({width:390,height:900});assert(await label.evaluate(e=>e.getBoundingClientRect().right<=innerWidth));await page.screenshot({path:out+'/filename-390.png'});
   assert.equal(await page.evaluate(n=>Object.values(sessionStorage).some(v=>v.includes(n)),name),false);
   await page.evaluate(()=>window.mediaHarness.pause(true));await label.waitFor({state:'detached'});await page.evaluate(()=>window.mediaHarness.pause(false));await label.waitFor();
   await page.evaluate(()=>{window.mediaHarness.holdChunk=false;window.mediaHarness.releaseChunk();});await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();assert.equal(await label.count(),0);assert.equal(await page.getByText(name,{exact:true}).count(),0);
  });
  await t.test('the first upload keeps its name when lazy session creation reaches props after the upload starts',async()=>{
   await page.goto(base+'/scripts/fixtures/agent-media-harness.html');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});
   await page.evaluate(()=>{window.mediaHarness.switch(null);window.mediaHarness.deferSessionCommit=true;window.mediaHarness.holdChunk=true;});
   await page.waitForFunction(()=>document.querySelector('#current')?.textContent.includes('未建会话'));
   await page.locator('input[data-agent-materials]').setInputFiles(file);await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseChunk));
   await page.evaluate(()=>window.mediaHarness.commitCreatedSession());const label=page.locator('[data-media-upload-name]');await label.waitFor({timeout:1500});assert.equal(await label.textContent(),name);
   await page.screenshot({path:out+'/filename-lazy-session.png'});await page.evaluate(()=>{window.mediaHarness.holdChunk=false;window.mediaHarness.releaseChunk();});await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();assert.equal(await label.count(),0);
  });
  await t.test('a new account never displays the previous in-flight name or late response',async()=>{
   await start();await page.locator('[data-media-upload-name]').waitFor({timeout:1500});await page.evaluate(()=>window.mediaHarness.identity('admin'));await page.waitForFunction(()=>document.querySelector('#current')?.textContent.startsWith('admin'));assert.equal(await page.locator('[data-media-upload-name]').count(),0);
   await page.evaluate(()=>window.mediaHarness.releaseChunk());await page.waitForTimeout(60);assert.equal(await page.getByText(name,{exact:true}).count(),0);
  });
  await t.test('switching sessions drops an in-flight name without exposing it in the new conversation',async()=>{
   await start();await page.locator('[data-media-upload-name]').waitFor({timeout:1500});await page.evaluate(()=>window.mediaHarness.switch('session-B'));await page.waitForFunction(()=>document.querySelector('#current')?.textContent.includes('session-B'));assert.equal(await page.locator('[data-media-upload-name]').count(),0);await page.evaluate(()=>window.mediaHarness.releaseChunk());
  });
  await t.test('unavailable registration remains explicit while the original upload and playback controls still work',async()=>{
   await page.goto(base+'/scripts/fixtures/agent-media-harness.html');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});
   await page.evaluate(()=>window.mediaHarness.registration('unavailable'));
   await page.locator('input[data-agent-materials]').setInputFiles(file);await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   await page.getByText('视频仍可播放，登记暂不可用。',{exact:true}).waitFor();
   await page.getByRole('button',{name:'播放',exact:true}).click();await page.locator('.agent-media-player video').waitFor();
   assert.equal(await page.getByRole('button',{name:'确认关联并登记',exact:true}).count(),0);await page.screenshot({path:out+'/registration-unavailable-playback.png'});
  });assert.deepEqual(errors,[]);
 }finally{await context.close();await browser.close();}
});
