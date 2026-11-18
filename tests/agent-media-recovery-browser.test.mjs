import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-video-recovery-2026-11-16/browser-'+Date.now();mkdirSync(out,{recursive:true});
const file={name:'RECOVERY-SYNTHETIC.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1500000)};
test('video recovery actions explain unresolved receipts and never swallow a rejected resume',async t=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const fresh=async()=>{await page.goto(base+'/scripts/fixtures/agent-media-harness.html');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});};
 try{
  await t.test('manual check shows progress and a useful result when initialization created no receipt',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.failBeforeInit=true;});await page.locator('input[data-agent-materials]').setInputFiles(file);await page.getByRole('alert').waitFor();
   await page.evaluate(()=>{window.mediaHarness.holdReceipt=true;});await page.getByRole('button',{name:'核对上传',exact:true}).click();await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseReceipt));
   assert.equal(await page.getByRole('button',{name:'核对上传',exact:true}).getAttribute('aria-busy'),'true');
   await page.getByText('正在核对上传状态…',{exact:false}).waitFor({timeout:1200});
   await page.evaluate(()=>{window.mediaHarness.holdReceipt=false;window.mediaHarness.releaseReceipt();});await page.getByText('暂未查到这次上传记录，请选择原视频继续上传。',{exact:false}).waitFor({timeout:1200});
   assert.equal(await page.getByRole('button',{name:'继续上传',exact:true}).count(),1);await page.screenshot({path:out+'/receipt-not-found.png'});
   await page.evaluate(()=>{window.mediaHarness.failBeforeInit=false;});const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await picker).setFiles(file);await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   const initializations=await page.evaluate(()=>window.mediaHarness.initializationKeys);assert.equal(initializations.length,2);assert.equal(new Set(initializations).size,1);
  });
  await t.test('selecting a resume while the original request is in flight explains the rejection and keeps that write owned',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.holdInit=true;});await page.locator('input[data-agent-materials]').setInputFiles(file);await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseInit));
   await page.evaluate(()=>window.mediaHarness.switch('session-B'));await page.getByText('owner · session-B',{exact:true}).waitFor();await page.evaluate(()=>window.mediaHarness.switch('session-A'));await page.getByRole('button',{name:'继续上传',exact:true}).waitFor();
   const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await picker).setFiles(file);
   await page.getByRole('alert').filter({hasText:'原视频上传仍在处理中，请稍后核对上传状态。'}).waitFor({timeout:1200});
   assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='POST').length),1);await page.screenshot({path:out+'/resume-busy.png'});
   const again=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await again).setFiles(file);
   await page.getByRole('alert').filter({hasText:'原视频上传仍在处理中'}).waitFor();assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length),0);
   await page.evaluate(async()=>{window.mediaHarness.holdInit=false;window.mediaHarness.releaseInit();await new Promise(requestAnimationFrame);});
   const retry=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await retry).setFiles(file);await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.mediaHarness.initializationKeys.length),1);
  });
  await t.test('resuming from the original upload button invalidates a slow check without leaving recovery busy',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.failBeforeInit=true;});await page.locator('input[data-agent-materials]').setInputFiles(file);await page.getByRole('alert').waitFor();
   await page.evaluate(()=>{window.mediaHarness.holdNextReceipt=true;});await page.getByRole('button',{name:'核对上传',exact:true}).click();await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseReceipt));
   await page.evaluate(()=>{window.mediaHarness.failBeforeInit=false;});await page.locator('input[data-agent-materials]').setInputFiles(file);await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.mediaHarness.mediaState.checkingUploads),false);
   await page.evaluate(async()=>{window.mediaHarness.releaseReceipt();await new Promise(requestAnimationFrame);});assert.equal(await page.evaluate(()=>window.mediaHarness.mediaState.checkingUploads),false);
  });
  await t.test('a receipt started during transfer cannot downgrade completing or force another file transfer',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.holdChunk=true;window.mediaHarness.unknownBeforeArchive=true;});await page.locator('input[data-agent-materials]').setInputFiles({...file,buffer:Buffer.alloc(1024)});await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseChunk));
   await page.evaluate(()=>window.mediaHarness.pause(true));await page.locator('#paused').filter({hasText:'true'}).waitFor();
   await page.evaluate(()=>{window.mediaHarness.holdNextReceipt=true;window.mediaHarness.pause(false);});await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseReceipt));
   await page.evaluate(()=>{window.mediaHarness.holdChunk=false;window.mediaHarness.releaseChunk();});await page.getByRole('alert').waitFor();
   await page.evaluate(async()=>{window.mediaHarness.releaseReceipt();await new Promise(requestAnimationFrame);});await page.getByRole('button',{name:'继续归档',exact:true}).waitFor({timeout:1200});
   const before=await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length);await page.evaluate(()=>{window.mediaHarness.unknownBeforeArchive=false;});await page.getByRole('button',{name:'继续归档',exact:true}).click();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length),before);assert.equal(await page.evaluate(()=>window.mediaHarness.initializationKeys.length),1);
  });
  assert.deepEqual(errors,[]);
 }finally{writeFileSync(out+'/result.json',JSON.stringify({errors}));await context.close();await browser.close();console.log(JSON.stringify({evidence:out,errors}));}
});
