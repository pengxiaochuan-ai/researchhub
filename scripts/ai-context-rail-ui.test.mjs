import test,{after} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-context-rail-2026-11-11';
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);mkdirSync(out+'/video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});after(()=>browser.close());
const records=[];
async function setup(role){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}}),headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
 const page=await ctx.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET'&&/\/api\/(sessions|hub-sources)/.test(r.url()))writes.push(r.url());});
 return {ctx,page,headers,errors,writes};
}
const columns=page=>page.locator('.workspace').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
for(const role of ['owner','admin'])test(role+' real ordinary and article views show only actual evidence, retaining sources and input',async()=>{
 const h=await setup(role);try{
  await h.page.goto(base+'/pages/ai01/');await h.page.waitForLoadState('networkidle');
  assert.equal(await h.page.locator('.contextRail').count(),0);assert.equal(await columns(h.page),2);
  for(const text of ['当前研究上下文','可用能力','参考范围与不确定性'])assert.equal(await h.page.getByText(text,{exact:true}).count(),0);
  const desktop=await h.page.locator('.chat').boundingBox();assert(desktop.width>850);assert.equal((await h.page.locator('.conversationList').boundingBox()).width,248);
  await h.page.screenshot({path:out+'/'+role+'-ordinary-1440.png'});
  for(const width of [1024,768,390,320]){
   await h.page.setViewportSize({width,height:900});await h.page.locator('.chat').scrollIntoViewIfNeeded();
   const overflow=await h.page.locator('.chat').evaluate(e=>e.scrollWidth-e.clientWidth);assert(overflow<=1,'chat horizontal overflow '+width);
   await h.page.screenshot({path:out+'/'+role+'-ordinary-'+width+'.png'});
  }
  await h.page.setViewportSize({width:1440,height:1000});
  await h.page.goto(base+'/pages/ai01/?articleId=pmc-PMC13672493');await h.page.getByRole('region',{name:'固定文章与证据'}).waitFor({timeout:20000});
  assert.equal(await h.page.locator('.contextRail').count(),1);assert.equal(await columns(h.page),3);
  await h.page.getByText('核对原文与选段',{exact:true}).click();await h.page.locator('.contextRail .article-fragment').first().waitFor();
  assert(await h.page.locator('.contextRail .article-fragment').count()>0);assert.match(await h.page.getByRole('link',{name:'返回这篇原文',exact:true}).getAttribute('href'),/recordId=pmc-PMC13672493/);
  await h.page.screenshot({path:out+'/'+role+'-article-1440.png'});
  for(const width of [1024,768,390,320]){
   await h.page.setViewportSize({width,height:900});await h.page.locator('.contextRail').scrollIntoViewIfNeeded();
   assert(await h.page.getByText('核对原文与选段',{exact:true}).isVisible());
   const overflow=await h.page.locator('.contextRail').evaluate(e=>e.scrollWidth-e.clientWidth);assert(overflow<=1,'rail horizontal overflow '+width);
   await h.page.screenshot({path:out+'/'+role+'-article-'+width+'.png'});
  }
  await h.page.setViewportSize({width:1440,height:1000});await h.page.reload();await h.page.locator('.contextRail .article-context').waitFor();
  await h.page.getByRole('link',{name:'＋ Hub 问答',exact:true}).click();await h.page.getByLabel('研究问题',{exact:true}).waitFor();await h.page.waitForLoadState('networkidle');
  assert.equal(await h.page.locator('.contextRail').count(),0);assert.equal(await columns(h.page),2);assert.equal(await h.page.locator('.thread').getByText(/Sjögren/).count(),0);
  assert.deepEqual(h.errors,[]);assert.deepEqual(h.writes,[]);records.push({role,chatWidth:desktop.width,viewports:[1440,1024,768,390,320],article:'pmc-PMC13672493',modelCalls:0,pageErrors:h.errors});
 }finally{await h.ctx.close();}
});
test('delayed article responses cannot restore a rail after returning to ordinary chat; denied article remains empty',async()=>{
 const h=await setup('admin');let release;const gate=new Promise(r=>release=r);let started;const requested=new Promise(r=>started=r);
 try{
  await h.ctx.route('**/api/hub-sources/article-context/pmc-PMC13672493*',async route=>{const response=await route.fetch();started();await gate;await route.fulfill({response}).catch(()=>{});});
  await h.page.goto(base+'/pages/ai01/?articleId=pmc-PMC13672493');await requested;
  assert.equal(await h.page.locator('.contextRail').count(),0);const origin=await h.page.evaluate(()=>performance.timeOrigin);
  await h.page.locator('a.conv[href*="sessionId="]').first().click();release();
  await h.page.getByLabel('研究问题',{exact:true}).waitFor();await h.page.waitForLoadState('networkidle');assert.equal(await h.page.locator('.contextRail').count(),0);assert.equal(await h.page.evaluate(()=>performance.timeOrigin),origin);
  await h.ctx.unroute('**/api/hub-sources/article-context/pmc-PMC13672493*');
  await h.ctx.route('**/api/hub-sources/article-context/pmc-PMC13672493*',route=>route.fulfill({status:403,json:{message:'当前文章来源已失效，请返回原文重新核对。'}}));
  await h.page.goto(base+'/pages/ai01/?articleId=pmc-PMC13672493');await h.page.getByRole('alert').filter({hasText:'来源已失效'}).waitFor();
  assert.equal(await h.page.locator('.contextRail').count(),0);assert.equal(await columns(h.page),2);assert.deepEqual(h.errors,[]);assert.deepEqual(h.writes,[]);
  await h.page.screenshot({path:out+'/denied-article.png'});
 }finally{release();await h.ctx.close();}
});
after(()=>{if(records.length)writeFileSync(out+'/real-results.json',JSON.stringify({accounts:records,modelCalls:0},null,2));});
