import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const phase=process.argv[2]||'final',out=root+'researchhub/docs/testing/evidence/governance-source-copy-2026-11-12/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={phase,checks:[],errors:[],consoleErrors:[],businessWrites:[],geometry:[]};let context,page;
const title='循证针灸临床实践指南：抑郁症（修订版）',summary='页面展示已批准（公开）；AI检索尚未授权。';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function login(ctx,who){const r=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:who+'@example.org',password:runtime.password}});assert.equal(r.status(),201);}
async function source(ctx){const r=await ctx.request.get(base+'/api/hub-sources/review-queue');assert.equal(r.status(),200);const body=await r.json();return body.items.find(x=>x.title===title);}
async function overviewReady(p){await p.waitForFunction(()=>{const b=[...document.querySelectorAll('.governance-overview button')].find(n=>n.textContent==='刷新待办');return b&&!b.disabled&&!document.querySelector('.governance-queue[aria-busy="true"]');});}
async function details(p){await p.locator('.hub-review-detail-heading h3').filter({hasText:title}).waitFor();await p.waitForFunction(()=>![...document.querySelector('.hub-review-workspace').children].some(n=>n.textContent==='正在读取当前审核队列…'));}
try{
 context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});await login(context,'admin');
 context.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')&&!path.startsWith('/api/auth/')&&r.method()!=='GET')result.businessWrites.push({path,method:r.method()});});
 page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')result.consoleErrors.push(e.text());});
 const before=await source(context);assert(before);result.sourceBefore=hash(before);result.rawStatus=before.state.status;
 await page.goto(base+'/pages/g02/?governanceModule=data');await overviewReady(page);
 const row=page.locator('.governance-items li').filter({has:page.getByRole('heading',{name:title,exact:true})});
 while(!await row.count()){const next=page.getByRole('button',{name:'下一页',exact:true});assert(await next.isEnabled());await next.click();await overviewReady(page);}
 result.overviewText=await row.innerText();await page.screenshot({path:out+phase+'-overview.png'});assert(result.overviewText.includes(summary),'overview must state existing display approval separately from missing AI authorization');
 const href=await row.getByRole('link',{name:/审核/}).getAttribute('href');await row.getByRole('link',{name:/审核/}).click();await details(page);
 const decision=page.locator('.hub-review-decision');assert((await decision.innerText()).includes(summary));assert.equal(await decision.getByText(/当前状态：/).count(),0);
 const selected=page.locator('.hub-review-queue [aria-current=true]');assert.match(await selected.innerText(),/展示已批准.*AI未授权/);
 assert.match(await page.locator('.hub-review-reading-actions').innerText(),/展示已批准.*AI未授权/);
 assert.equal(await decision.locator('select').count(),1);assert.equal(await decision.locator('select').inputValue(),'');assert.equal(await decision.getByRole('button',{name:'确认保存',exact:true}).isDisabled(),true);
 assert.equal(await decision.locator('option').count(),4);result.checks.push('real overview, selected queue, detail and reading status explain approved display versus unapproved AI; original range select remains unselected and save disabled');
 await page.screenshot({path:out+phase+'-detail.png'});await page.reload();await details(page);assert((await decision.innerText()).includes(summary));result.checks.push('reload preserves truthful copy and source selection');
 for(const width of [1366,1920,390,320]){
  await page.setViewportSize({width,height:900});await page.goto(base+href);await details(page);assert((await decision.innerText()).includes(summary));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  result.geometry.push(await page.evaluate(()=>({width:innerWidth,bodyWidth:document.documentElement.scrollWidth,detailWidth:document.querySelector('.hub-review-detail').getBoundingClientRect().width,bodyFont:getComputedStyle(document.querySelector('.hub-review-decision p')).fontSize})));
  await page.screenshot({path:out+phase+'-'+width+'.png'});
  if(width<960){await page.getByRole('button',{name:'返回审核队列',exact:true}).click();assert.match(await selected.innerText(),/展示已批准.*AI未授权/);await page.screenshot({path:out+phase+'-queue-'+width+'.png'});}
 }
 result.checks.push('original desktop columns and narrow detail/back flow remain usable, 14px body and no horizontal overflow');
 const after=await source(context);result.sourceAfter=hash(after);assert.equal(result.sourceAfter,result.sourceBefore);assert.equal(after.state.status,'partial');result.checks.push('original source decisions, fingerprint and raw partial status are unchanged');
 const owner=await browser.newContext();await login(owner,'owner');const denied=await owner.request.get(base+'/api/hub-sources/review-queue');assert.equal(denied.status(),403);await owner.close();result.checks.push('original researcher remains forbidden from source review; no new permissions');
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1;}
finally{await context?.close();await browser.close();writeFileSync(out+phase+'-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
