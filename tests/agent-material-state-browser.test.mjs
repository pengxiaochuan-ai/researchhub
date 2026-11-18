import test from 'node:test';import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const module=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chromium=module.chromium??module.default.chromium,base=process.env.RH_UPLOAD_TEST_BASE??'http://127.0.0.1:19501';
const out='.tmp/ai-file-data-2026-11-12/state-browser-'+Date.now();mkdirSync(out,{recursive:true});
test('real hook isolates delayed material reads and uploads across session changes',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  await t.test('old pending read cannot prevent the new session from loading',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   try{
    await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?deferRead');
    await page.waitForFunction(()=>window.materialHarness?.resolveRead);
    await page.evaluate(()=>window.materialHarness.switch('session-B'));
    await page.evaluate(()=>window.materialHarness.resolveRead());
    await page.getByText('session-B资料',{exact:true}).waitFor({timeout:4000});
    assert.equal(await page.getByText('session-A资料',{exact:true}).count(),0);
    await page.screenshot({path:out+'/read-switch.png'});
   }finally{await page.close();}
  });
  await t.test('late upload stays in the original session instead of appearing in the new one',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   try{
    await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html');
    await page.getByText('session-A资料',{exact:true}).waitFor();
    await page.locator('input[data-agent-materials]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic only')});
    await page.waitForFunction(()=>window.materialHarness?.resolveUpload);
    await page.evaluate(()=>window.materialHarness.switch('session-B'));
    await page.getByText('session-B资料',{exact:true}).waitFor();
    await page.evaluate(()=>window.materialHarness.resolveUpload());
    await page.getByText('正在上传资料…',{exact:true}).waitFor({state:'detached'});
    assert.equal(await page.getByText('A的私人资料',{exact:true}).count(),0);
    await page.screenshot({path:out+'/upload-switch.png'});
   }finally{await page.close();}
  });
  await t.test('identity recheck during a delayed read requests fresh state, and unread or unknown materials block analysis',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   try{
    await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?deferRead&empty&unknown');
    await page.waitForFunction(()=>window.materialHarness?.resolveRead);
    assert.equal(await page.locator('#analysis-blocked').innerText(),'true');
    await page.evaluate(()=>window.materialHarness.pause(true));
    await page.waitForFunction(()=>!document.querySelector('[aria-label="本会话资料"]'));
    await page.evaluate(()=>window.materialHarness.pause(false));
    // Flush the pause/resume effects before completing the old response.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>window.materialHarness.resolveRead());
    await page.waitForFunction(()=>document.querySelector('#analysis-blocked')?.textContent==='false');
    assert((await page.evaluate(()=>window.materialHarness.reads))>=2);
    await page.locator('input[data-agent-materials]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic only')});
    await page.getByRole('button',{name:'核对上传',exact:true}).waitFor();
    assert.equal(await page.locator('#analysis-blocked').innerText(),'true');
    await page.getByRole('button',{name:'核对上传',exact:true}).click();
    assert.equal(await page.locator('#analysis-blocked').innerText(),'true');
    assert.equal(await page.evaluate(()=>window.materialHarness.uploads),1);
    await page.screenshot({path:out+'/unknown-upload.png'});
   }finally{await page.close();}
  });
  await t.test('failed initial material read does not enable an unbound question',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   try{
    await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?empty&readFail');
    await page.getByRole('alert').waitFor();assert.equal(await page.locator('#analysis-blocked').innerText(),'true');
   }finally{await page.close();}
  });
  await t.test('first upload can lazily create its own conversation without treating it as an unrelated switch',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   try{
    await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?newSession&empty');
    await page.locator('input[data-agent-materials]').waitFor({state:'attached'});
    await page.locator('input[data-agent-materials]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic only')});
    await page.waitForFunction(()=>window.materialHarness?.resolveUpload);
    assert.equal(await page.locator('#current-session').innerText(),'created-session');
    await page.evaluate(()=>window.materialHarness.resolveUpload());
    await page.getByText('A的私人资料',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.materialHarness.uploads),1);
   }finally{await page.close();}
  });
  await t.test('a successful original receipt restores an unknown upload without posting again',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   try{
    await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?empty&unknown&receiptReady');
    await page.waitForFunction(()=>document.querySelector('#analysis-blocked')?.textContent==='false');
    await page.locator('input[data-agent-materials]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic only')});
    await page.getByRole('button',{name:'核对上传',exact:true}).click();
    await page.getByText('原上传资料',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'核对上传',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>window.materialHarness.uploads),1);
    await page.reload();await page.waitForFunction(()=>window.materialHarness?.reads>0);
    assert.equal(await page.evaluate(()=>window.materialHarness.uploads),0);
   }finally{await page.close();}
  });
  await t.test('unavailable browser recovery storage stops before uploading, not after losing the request key',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('synthetic denied storage');};});
   try{
    await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?empty&unknown');
    await page.waitForFunction(()=>document.querySelector('#analysis-blocked')?.textContent==='false');
    await page.locator('input[data-agent-materials]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic only')});
    await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.materialHarness.uploads),0);
    assert((await page.getByRole('alert').innerText()).includes('本次未上传'));
   }finally{await page.close();}
  });
  await t.test('selection made during revalidation is discarded if the conversation changes',async()=>{
   const page=await browser.newPage();await page.route('**/api/**',r=>r.abort());
   try{await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?empty');await page.waitForFunction(()=>document.querySelector('#analysis-blocked')?.textContent==='false');await page.evaluate(()=>window.materialHarness.pause(true));await page.waitForFunction(()=>document.querySelector('#analysis-blocked')?.textContent==='true');await page.locator('input[data-agent-materials]').setInputFiles({name:'synthetic-selection.txt',mimeType:'text/plain',buffer:Buffer.from('synthetic pending file')});assert.equal(await page.evaluate(()=>window.materialHarness.uploads),0);await page.evaluate(()=>window.materialHarness.switch('session-B'));await page.getByText('session-B',{exact:true}).waitFor();await page.evaluate(()=>window.materialHarness.pause(false));await page.waitForFunction(()=>document.querySelector('#analysis-blocked')?.textContent==='false');assert.equal(await page.evaluate(()=>window.materialHarness.uploads),0);await page.screenshot({path:out+'/discard-changed-selection.png'});}finally{await page.close();}
  });
 }finally{await browser.close();}
});
