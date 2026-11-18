import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-resumable-2026-11-16/new-file-'+Date.now();mkdirSync(out,{recursive:true});
test('the upload-file entry accepts another video while keeping an unresolved different original',async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),page=await context.newPage();
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 try{
  await page.goto(base+'/scripts/fixtures/agent-media-harness.html');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});await page.evaluate(()=>{window.mediaHarness.failBeforeInit=true;});
  await page.locator('input[data-agent-materials]').setInputFiles({name:'original.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1500000)});await page.getByRole('alert').waitFor();
  const old=await page.evaluate(()=>window.mediaHarness.initializationKeys[0]);await page.evaluate(()=>{window.mediaHarness.failBeforeInit=false;});
  await page.locator('input[data-agent-materials]').setInputFiles({name:'other.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(2100000)});await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor({timeout:2000});
  const keys=await page.evaluate(()=>window.mediaHarness.initializationKeys);assert.equal(keys.length,2);assert.notEqual(keys[1],old);
  const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('rh-media-pending:owner:session-A')));assert.equal(pending.length,1);assert.equal(pending[0].requestKey,old);assert.equal(pending[0].byteSize,1500000);
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();await(await chooser).setFiles({name:'other.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(2100000)});await page.getByRole('alert').filter({hasText:'格式和大小需与原记录一致'}).waitFor();assert.equal((await page.evaluate(()=>window.mediaHarness.initializationKeys)).length,2);await page.screenshot({path:out+'/other-file-keeps-original.png'});
 }catch(error){await page.screenshot({path:out+'/failure.png'});throw error;}finally{await context.close();await browser.close();}
});
test('a lost successful completion followed by selecting the same original from upload-file does not archive a duplicate',async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage();
 try{await page.goto(base+'/scripts/fixtures/agent-media-harness.html');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});await page.evaluate(()=>{window.mediaHarness.unknownComplete=true;});
  const file={name:'original.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1500000)};await page.locator('input[data-agent-materials]').setInputFiles(file);await page.getByRole('alert').waitFor();
  await page.locator('input[data-agent-materials]').setInputFiles(file);await page.getByRole('alert').waitFor({state:'detached'});assert.equal((await page.evaluate(()=>window.mediaHarness.initializationKeys)).length,1);assert.equal(await page.getByRole('button',{name:'继续上传',exact:true}).count(),0);
 }finally{await page.close();await browser.close();}
});
