// Real Chrome input verification; model/queue writes are blocked on product pages.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',phase=process.argv[2]??'final',out='.tmp/ai-question-length-2026-11-12/browser-'+phase+'-'+Date.now();
assert(['red','final'].includes(phase));mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const question='请读取以下来源并区分原文事实与AI推论。'+('保留研究类型、随访与证据缺口的限定，不新增计算。\n').repeat(8)+'https://www.who.int/news-room/fact-sheets/detail/anxiety-disorders',results=[],errors=[],blockedWrites=[];
try{for(const actor of ['owner','admin']){const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}})).status(),201);
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push({actor,message:e.message}));
 await page.route('**/api/**',route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!['/api/auth/renew'].includes(new URL(r.url()).pathname)){blockedWrites.push({actor,path:new URL(r.url()).pathname});return route.abort();}return route.continue();});
 const history=await ctx.request.get(base+'/api/sessions/hub-source/history?page=1&limit=50',{headers:{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project}}).then(r=>r.json());
 for(const kind of ['hub','article']){
  const item=history.items.find(x=>x.kind===kind)??(kind==='article'?{recordId:'pmc-PMC13672493'}:null);assert(item,kind+' history fixture');
  const url=kind==='hub'?'/pages/ai01/?sessionId='+item.id:'/pages/ai01/?'+new URLSearchParams({articleId:item.recordId,...(item.recovery?{requestKey:item.recovery.requestKey,inputHash:item.recovery.inputHash}:{})});
  await page.goto(base+url);const box=page.locator(kind==='hub'?'#hub-agent-question':'#article-ai-question');await box.waitFor();await page.waitForFunction(selector=>!document.querySelector(selector)?.disabled,kind==='hub'?'#hub-agent-question':'#article-ai-question');
  await box.fill('');await box.focus();await page.keyboard.insertText(question);const actual=await box.inputValue();await page.screenshot({path:out+'/'+actor+'-'+kind+'-input.png'});assert.equal(actual,question,'entire question and final URL must be retained');
  const metrics=await box.evaluate(el=>({height:el.getBoundingClientRect().height,overflow:getComputedStyle(el).overflowY,font:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight,maxLength:el.maxLength}));assert.equal(metrics.maxLength,-1);
  const viewports=[];for(const viewport of [{width:1366,height:768},{width:1920,height:1200},{width:1440,height:900}]){await page.setViewportSize(viewport);await box.fill(question);const m=await box.evaluate(el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight,overflow:getComputedStyle(el).overflowY}));assert.equal(m.font,'14px');assert.equal(m.line,'22px');assert(m.height<=148&&m.height<=viewport.height*.2+1);assert.equal(await box.inputValue(),question);await page.screenshot({path:out+'/'+actor+'-'+kind+'-'+viewport.width+'.png'});viewports.push({viewport,metrics:m});}
  await box.fill('🧪'.repeat(4000));assert.equal(await box.inputValue(),'🧪'.repeat(4000));
  await box.fill('🧪'.repeat(4001));assert.equal(await box.inputValue(),'🧪'.repeat(4001));const form=box.locator('..');await page.getByRole('alert').filter({hasText:'4000'}).waitFor();assert.equal(await form.getByRole('button',{name:'发送',exact:true}).isDisabled(),true);await box.press('Enter');assert.equal(await box.inputValue(),'🧪'.repeat(4001));await page.screenshot({path:out+'/'+actor+'-'+kind+'-over-limit.png'});
  await box.fill(question);assert.equal(await page.getByRole('alert').filter({hasText:'4000'}).count(),0);await box.fill('');assert.equal(await box.evaluate(el=>el.getBoundingClientRect().height),60);
  results.push({actor,kind,fullQuestion:true,characters:[...question].length,fullUrl:true,unicode4000:true,overLimitRetained:true,enterBlocked:true,recovers:true,metrics,viewports});
 }
}finally{await ctx.close();}}
assert.deepEqual(errors,[]);assert.deepEqual(blockedWrites,[]);
if(phase==='final'){
 const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});try{
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push({actor:'harness',message:e.message}));await page.goto(base+'/scripts/fixtures/agent-question-length-harness.html');const box=page.locator('#hub-agent-question');await box.waitFor();
  await box.fill(question);await box.press('Enter');await page.waitForFunction(()=>window.questionLengthHarness.writes.length===1);let writes=await page.evaluate(()=>window.questionLengthHarness.writes);assert.equal(writes[0].body.text,question);assert.equal(await box.inputValue(),'');
  await page.getByRole('button',{name:'编辑',exact:true}).click();const edit=page.getByRole('textbox',{name:'修改待执行指令'});await edit.fill('🧪'.repeat(4001));await page.getByRole('alert').filter({hasText:'4000'}).waitFor();assert(await page.getByRole('button',{name:'保存修改',exact:true}).isDisabled());assert.equal((await page.evaluate(()=>window.questionLengthHarness.writes)).length,1);await page.screenshot({path:out+'/edit-over-limit.png'});
  await edit.fill(question+'不改变后半段限定。');await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.waitForFunction(()=>window.questionLengthHarness.writes.length===2);writes=await page.evaluate(()=>window.questionLengthHarness.writes);assert.equal(writes[1].method,'PATCH');assert.equal(writes[1].body.text,question+'不改变后半段限定。');
  await box.fill('🧪'.repeat(4001));await box.press('Enter');assert.equal(await box.inputValue(),'🧪'.repeat(4001));assert.equal((await page.evaluate(()=>window.questionLengthHarness.writes)).length,2);await box.fill('第一行');await box.press('Shift+Enter');await page.keyboard.insertText('第二行');assert.equal(await box.inputValue(),'第一行\n第二行');await page.screenshot({path:out+'/edit-and-send.png'});
  results.push({kind:'isolated-composer-fixture',postFullQuestion:true,editFullQuestion:true,overLimitNoMutation:true,shiftEnter:true,realApiWrites:0});
 }finally{await ctx.close();}
}
}finally{writeFileSync(out+'/result.json',JSON.stringify({passed:results.length===5&&errors.length===0&&blockedWrites.length===0,phase,results,errors,blockedWrites,newModelCalls:0},null,2));await browser.close();}
console.log(JSON.stringify({passed:true,evidence:out,results,newModelCalls:0}));
