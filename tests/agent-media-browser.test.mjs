import test from'node:test';import assert from'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-video-2026-11-16/component-'+Date.now();mkdirSync(out,{recursive:true});
test('video chooser, paused verification, lazy session, current capability and unknown completion use one upload path',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const fresh=async()=>{await page.goto(base+'/scripts/fixtures/agent-media-harness.html');await page.locator('input[data-agent-materials]').waitFor({state:'attached'});};
 const choose=async()=>page.locator('input[data-agent-materials]').setInputFiles({name:'generated.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1500000)});
 try{
  await t.test('one selected MP4 uses initialization/chunks/complete and no document parser',async()=>{
   await fresh();await choose();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   const calls=await page.evaluate(()=>window.mediaHarness.calls);assert.equal(calls.filter(x=>x[0]==='POST'&&x[1].endsWith('/media-uploads')).length,1);assert.equal(calls.filter(x=>x[0]==='CHUNK').length,2);assert.equal(calls.filter(x=>x[0]==='POST'&&x[1].endsWith('/complete')).length,1);assert.equal(calls.filter(x=>x[0]==='POST'&&x[1].endsWith('/materials')).length,0);
   await page.screenshot({path:out+'/archived.png'});
  });
  await t.test('temporary same-identity verification pauses further chunks and then continues once',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.holdInit=true;});await choose();await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseInit));
   await page.evaluate(()=>window.mediaHarness.pause(true));await page.waitForFunction(()=>document.querySelector('#paused')?.textContent==='true');await page.evaluate(()=>window.mediaHarness.releaseInit());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length),0);
   await page.evaluate(()=>window.mediaHarness.pause(false));await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
  });
  await t.test('true account switch rejects late initialization and sends no further chunks',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.holdInit=true;});await choose();await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseInit));
   await page.evaluate(()=>window.mediaHarness.identity('admin'));await page.waitForFunction(()=>document.querySelector('#current')?.textContent.startsWith('admin'));await page.evaluate(()=>window.mediaHarness.releaseInit());await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length),0);assert.equal(await page.getByText('已归档 · 文件检查通过',{exact:true}).count(),0);
  });
  await t.test('lazy conversation creation keeps the first upload',async()=>{
   await fresh();await page.evaluate(()=>window.mediaHarness.switch(null));await page.waitForTimeout(50);await choose();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();assert((await page.locator('#current').innerText()).includes('created-session'));
  });
  await t.test('lost complete response recovers from receipt without another upload',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.unknownComplete=true;});await choose();await page.getByText('视频上传结果尚未确认。',{exact:false}).waitFor();
   const before=await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]!=='GET').length);await page.getByRole('button',{name:'核对视频状态'}).click();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]!=='GET').length),before);
  });
  await t.test('media capability withdrawal stops remaining requests with a visible error',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.holdInit=true;});await choose();await page.waitForFunction(()=>Boolean(window.mediaHarness.releaseInit));await page.evaluate(()=>window.mediaHarness.capability(false));await page.waitForFunction(()=>!document.querySelector('input[data-agent-materials]').accept.includes('.mp4'));await page.evaluate(()=>window.mediaHarness.releaseInit());
   await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length),0);
  });
  await t.test('pending archive receipt keeps the same upload ID and explicitly completes it without re-upload',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.unknownBeforeArchive=true;});await choose();await page.getByRole('alert').waitFor();
   const before=await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK').length);
   await page.getByRole('button',{name:'核对视频状态'}).click();await page.getByRole('button',{name:'继续归档',exact:true}).waitFor({timeout:1500});
   await page.evaluate(()=>{window.mediaHarness.unknownBeforeArchive=false;});await page.getByRole('button',{name:'继续归档',exact:true}).click();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   const calls=await page.evaluate(()=>window.mediaHarness.calls);assert.equal(calls.filter(x=>x[0]==='CHUNK').length,before);assert.equal(calls.filter(x=>x[0]==='POST'&&x[1].endsWith('/media-uploads')).length,1);
  });
  await t.test('a page reload preserves an uncertain completion and its original upload identity',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.unknownBeforeArchive=true;});await choose();await page.getByRole('alert').waitFor();
   const state=await page.evaluate(()=>window.mediaHarness.dump());await page.reload();await page.waitForFunction(()=>Boolean(window.mediaHarness?.restore));await page.evaluate(value=>window.mediaHarness.restore(value),state);
   await page.getByRole('button',{name:'继续归档',exact:true}).click();await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='CHUNK'||x[0]==='POST'&&x[1].endsWith('/media-uploads')).length),0);
  });
  await t.test('resume chooser survives same-identity verification without creating another upload',async()=>{
   await fresh();await page.evaluate(()=>{window.mediaHarness.unknownAfterInit=true;});await choose();await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'核对视频状态'}).click();
   const event=page.waitForEvent('filechooser');await page.getByRole('button',{name:'继续上传',exact:true}).click();const chooser=await event;
   await page.evaluate(()=>window.mediaHarness.pause(true));await page.waitForFunction(()=>document.querySelector('#paused')?.textContent==='true');
   await chooser.setFiles({name:'generated.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(1500000)});await page.evaluate(()=>{window.mediaHarness.unknownAfterInit=false;window.mediaHarness.pause(false);});
   await page.getByText('已归档 · 文件检查通过',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.mediaHarness.calls.filter(x=>x[0]==='POST'&&x[1].endsWith('/media-uploads')).length),1);
  });
  assert.deepEqual(errors,[]);
 }finally{writeFileSync(out+'/result.json',JSON.stringify({errors}));await context.close();await browser.close();console.log(JSON.stringify({evidence:out,errors}));}
});
