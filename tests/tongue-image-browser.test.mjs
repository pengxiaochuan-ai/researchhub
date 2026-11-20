import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19501',out='docs/testing/evidence/tongue-image-ingestion-2026-11-19/isolated-browser-'+Date.now();
const pixels={png:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4sWAdAASqAjc1+K/dAAAAAElFTkSuQmCC','base64'),jpeg:Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDt6KKKzPfP/9k=','base64')};
const posts=p=>p.evaluate(()=>window.tongueHarness.data.calls.filter(x=>x.method==='POST'));
async function setup(browser,name){
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/'+name}}),page=await context.newPage();
 page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{if(route.request().method()==='GET'&&route.request().url().endsWith('/content')){const extension=await page.evaluate(()=>window.tongueHarness?.data?.items?.[0]?.extension??'png');return route.fulfill({status:200,contentType:extension==='png'?'image/png':'image/jpeg',headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:pixels[extension==='png'?'png':'jpeg']});}return route.abort();});
 await page.goto(base+'/scripts/fixtures/tongue-image-harness.html');await page.getByRole('button',{name:'上传文件',exact:true}).waitFor();
 return{context,page,errors};
}
async function selectImage(p,extension='png'){
 await p.locator('input[data-agent-materials]').setInputFiles({name:'合成舌图.'+extension,mimeType:extension==='png'?'image/png':'image/jpeg',buffer:pixels[extension==='png'?'png':'jpeg']});
 await p.getByRole('button',{name:'确认关联并登记',exact:true}).waitFor({timeout:5000});
}
async function register(p){await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.getByText('登记成功',{exact:true}).waitFor();}
test('isolated actual image UI preserves visit ownership, original viewing and recovery without image understanding',async t=>{
 mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),checks=[];
 try{
  for(const extension of ['png','jpg','jpeg'])await t.test(extension+' can preview and register once then return to its same visit',async()=>{
   const{context,page:p,errors}=await setup(browser,extension);try{
    await selectImage(p,extension);assert.equal(await p.getByLabel('关联访视',{exact:true}).inputValue(),'visit');
    await p.locator('.agent-media').getByRole('button',{name:/查看原图|查看图片|预览原图|预览图片/}).click();await p.waitForFunction(()=>[...document.querySelectorAll('.agent-media img')].some(x=>x.complete&&x.naturalWidth===1&&x.naturalHeight===1));assert.equal(await p.locator('.agent-media video').count(),0);
    await register(p);const link=p.getByRole('link',{name:'查看本次访视',exact:true});assert.equal(await link.getAttribute('href'),'/pages/s09/?formalCapture=1&studyId=study&visitId=visit#capture-files');
    let calls=await posts(p);assert.equal(calls.length,4);assert.equal(calls.find(x=>x.path.endsWith('/ingests')).body.subjectVisitId,'visit');assert.equal(calls.filter(x=>x.path.includes('content-runs')).length,0);
    await p.reload();await p.getByText('登记成功',{exact:true}).waitFor();assert.equal((await posts(p)).length,4);const list=p.locator('#registered');await list.getByRole('button',{name:/查看原图|查看图片|预览原图|预览图片/}).click();await p.waitForFunction(()=>[...document.querySelectorAll('#registered img')].some(x=>x.complete&&x.naturalWidth===1));assert.equal(await list.locator('img').getAttribute('src'),'/api/research-studies/study/subjects/subject/session-media-ingests/binding-owner/content');await list.getByRole('button',{name:/查看登记记录|查看回执/}).click();await list.getByText(/登记时文件检查：.*1.*1/).waitFor();
    await p.screenshot({path:out+'/'+extension+'-registered.png',fullPage:true});if(extension==='png'){await p.setViewportSize({width:390,height:900});await p.screenshot({path:out+'/image-390.png',fullPage:true});}
    assert.deepEqual(errors,[]);checks.push({case:extension,passed:true,posts:4});
   }finally{await context.close();}
  });
  await t.test('unsupported image format and image larger than 25MiB are rejected before creating any upload',async()=>{
   const{context,page:p}=await setup(browser,'invalid');try{
    await p.locator('input[data-agent-materials]').setInputFiles({name:'wrong.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await p.getByRole('alert').waitFor();assert.equal((await posts(p)).length,0);
    await p.locator('input[data-agent-materials]').setInputFiles({name:'oversize.png',mimeType:'image/png',buffer:Buffer.alloc(25*1024*1024+1)});await p.getByRole('alert').waitFor();assert.equal((await posts(p)).length,0);await p.screenshot({path:out+'/rejected-size.png'});checks.push({case:'format-and-size',passed:true,posts:0});
   }finally{await context.close();}
  });
  await t.test('lost confirmation response is recovered with its original key and no repeated confirm',async()=>{
   const{context,page:p}=await setup(browser,'unknown');try{await selectImage(p);await p.evaluate(()=>window.tongueHarness.loseConfirm=true);await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.getByRole('button',{name:'核对登记',exact:true}).waitFor();await p.getByRole('button',{name:'核对登记',exact:true}).click();await p.getByText('登记成功',{exact:true}).waitFor();assert.equal((await posts(p)).length,4);await p.reload();await p.getByText('登记成功',{exact:true}).waitFor();assert.equal((await posts(p)).length,4);await p.screenshot({path:out+'/unknown-recovered.png'});checks.push({case:'unknown-recovery',passed:true,posts:4});}finally{await context.close();}
  });
  await t.test('permission loss removes the displayed registered image, receipt and playback control',async()=>{
   const{context,page:p}=await setup(browser,'permission');try{await selectImage(p);await register(p);await p.evaluate(()=>window.tongueHarness.refresh());const list=p.locator('#registered');await list.getByRole('button',{name:/查看原图|查看图片|预览原图|预览图片/}).click();await list.locator('img').waitFor();await p.evaluate(()=>{window.tongueHarness.denied=true;window.dispatchEvent(new Event('focus'));});await list.getByRole('alert').waitFor();assert.equal(await list.locator('img').count(),0);assert.equal(await list.getByRole('button',{name:/查看登记记录|查看回执/}).count(),0);await p.evaluate(()=>window.tongueHarness.pause(true));assert.equal(await p.locator('img').count(),0);checks.push({case:'permission-loss',passed:true});}finally{await context.close();}
  });
  await t.test('an image response error hides the broken image and retries the original with no new write',async()=>{
   const{context,page:p}=await setup(browser,'preview-retry');try{await selectImage(p);let attempts=0;await p.route('**/api/sessions/session/media/image/content',route=>{attempts++;return attempts===1?route.fulfill({status:503,contentType:'text/plain',body:'Synthetic temporary original-read failure'}):route.fulfill({status:200,contentType:'image/png',headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:pixels.png});});await p.locator('.agent-media').getByRole('button',{name:/查看原图|查看图片|预览原图|预览图片/}).click();await p.getByRole('button',{name:'重新加载原图',exact:true}).waitFor();assert.equal(await p.locator('.agent-media img').count(),0);const before=await posts(p);await p.screenshot({path:out+'/preview-error-hidden.png'});await p.getByRole('button',{name:'重新加载原图',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('.agent-media img')].some(x=>x.complete&&x.naturalWidth===1));assert.equal(attempts,2);assert.deepEqual(await posts(p),before);assert.equal(before.length,2);await p.screenshot({path:out+'/preview-retry-restored.png'});checks.push({case:'preview-retry',passed:true,originalReads:2,extraWrites:0});}finally{await context.close();}
  });
  await t.test('late image preparation cannot confirm after the current identity changes',async()=>{
   const{context,page:p}=await setup(browser,'identity');try{await selectImage(p);await p.evaluate(()=>window.tongueHarness.delayPrepare=true);await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.waitForFunction(()=>window.tongueHarness.releasePrepare);await p.evaluate(()=>window.tongueHarness.identity('other'));await p.locator('#actor').filter({hasText:'other'}).waitFor();await p.evaluate(()=>window.tongueHarness.releasePrepare());await p.waitForTimeout(50);assert.equal((await posts(p)).filter(x=>x.path.endsWith('/confirm')).length,0);assert.equal(await p.locator('img').count(),0);checks.push({case:'identity-change',passed:true});}finally{await context.close();}
  });
 }finally{await browser.close();writeFileSync(out+'/result.json',JSON.stringify({at:new Date().toISOString(),passed:checks.length===8,scope:'isolated real React components with synthetic PNG/JPEG and harness services; not production or real backend acceptance',checks},null,2)+'\n');}
});
