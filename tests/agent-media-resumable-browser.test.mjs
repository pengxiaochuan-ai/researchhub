import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-resumable-2026-11-16/component-'+Date.now();mkdirSync(out,{recursive:true});
test('returning to a video skips verified chunks, rejects a substituted original and preserves the same identity',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const file={name:'synthetic.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(5*1024*1024+31)};
 try{
  await page.goto(base+'/scripts/fixtures/agent-media-harness.html?resumable');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});await page.evaluate(()=>{window.mediaHarness.failIndexes=[1,2];});
  await page.locator('input[data-agent-materials]').setInputFiles(file);await page.getByRole('alert').waitFor();
  const saved=await page.evaluate(()=>window.mediaHarness.dump()),received=saved.parts[0][1].map(x=>x.index);assert(received.length>0);assert(received.length<6);
  await page.screenshot({path:out+'/interrupted.png'});await page.goto('about:blank');
  await page.goto(base+'/scripts/fixtures/agent-media-harness.html?resumable');await page.waitForFunction(()=>Boolean(window.mediaHarness));await page.evaluate(s=>window.mediaHarness.restore(s),saved);
  const resume=page.getByRole('button',{name:'继续上传',exact:true});await resume.waitFor();
  const wrong={...file,buffer:Buffer.from(file.buffer)};wrong.buffer[0]=17;await page.locator('input[data-media-resume]').setInputFiles(wrong); // no chooser selection: must be visibly rejected
  await page.getByRole('alert').waitFor();
  const pick=page.waitForEvent('filechooser');await resume.click();await(await pick).setFiles(wrong);await page.getByText('所选文件与原视频内容不同，请重新选择原视频。',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length),0);
  const again=page.waitForEvent('filechooser');await resume.click();await(await again).setFiles(file);await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
  const calls=await page.evaluate(()=>window.mediaHarness.calls),sent=calls.filter(x=>x[0]==='CHUNK').map(x=>Number(x[1].split('/').at(-1)));
  assert.deepEqual(sent.sort(),[0,1,2,3,4,5].filter(x=>!received.includes(x)));assert.equal(new Set((await page.evaluate(()=>window.mediaHarness.initializationKeys))).size,1);
  await page.screenshot({path:out+'/resumed.png'});assert.deepEqual(errors,[]);writeFileSync(out+'/result.json',JSON.stringify({received,sent,errors}));
 }finally{await context.close();await browser.close();console.log(JSON.stringify({evidence:out}));}
});
