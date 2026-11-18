// Native existing data only in --native. --faults explicitly injects UI-only content/failures, never forwards business writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {reportAssetDetailUrl,reportAssetScope} from '../src/report-asset-context.js';
import {makeCatalogAssetUrl} from '../src/research-assets-catalog-session.js';
import {REPORT_CONTEXT as rc} from './research-assets-report-context.mjs';
const stage=process.argv[2];assert(process.argv.length===3&&['--native','--faults'].includes(stage));
const origin='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url))),out=new URL('../docs/planning/research-assets-a02-reading-2026-11-16/evidence/',import.meta.url).pathname;
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
mkdirSync(out+'video-'+stage.slice(2),{recursive:true});const trace={at:new Date().toISOString(),stage,checks:[],rows:[],reads:[],errors:[],businessWrites:0,uiOnly:stage==='--faults'};let context,page,failDetail=false,wideFixture=false,hold=false,heldResolve,release;
const detailPath='/api/research-assets/catalog/'+rc.assetId+'/versions/2',held=new Promise(r=>heldResolve=r);
async function login(actor,target){await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(target));await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL(url=>url.pathname===new URL(target,origin).pathname);}
async function ready(){await page.locator('.asset-preview-container').waitFor();}
async function snap(name){await page.screenshot({path:out+stage.slice(2)+'-'+name+'.png',fullPage:true});trace.checks.push(name);}
async function geometry(){return page.locator('.asset-preview').evaluate(el=>{const r=el.querySelector('.research-asset-reading'),c=getComputedStyle(r),a=getComputedStyle(el),p=r.querySelector('p'),s=p&&getComputedStyle(p),outer=el.closest('.two-col'),side=outer?.children[1];return{viewport:innerWidth,previewWidth:el.getBoundingClientRect().width,grid:a.gridTemplateColumns,readingBox:r.getBoundingClientRect().width,textWidth:r.clientWidth-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight),font:s?.fontSize,lineHeight:s?.lineHeight,sideWidth:side?.getBoundingClientRect().width,scrollWidth:document.documentElement.scrollWidth};});}
async function nativeJson(path,scope){const me=await(await context.request.get(origin+'/api/auth/me')).json(),res=await context.request.get(origin+'/api'+path,{headers:{'X-Study-Group-Id':scope.studyGroupId,'X-Research-Project-Id':scope.researchProjectId,'X-ResearchHub-Actor':me.accountId,'X-ResearchHub-Auth-Version':String(me.authVersion)}});assert.equal(res.status(),200);return res.json();}
try{
 context=await browser.newContext({viewport:{width:1280,height:1075},recordVideo:{dir:out+'video-'+stage.slice(2)}});page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>trace.errors.push(e.message));
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;assert(['GET','HEAD'].includes(req.method())||path.startsWith('/api/auth/'),'No business writes allowed');
  if(path===detailPath){
   if(failDetail)return route.fulfill({status:503,json:{message:'暂不可核对当前资产，请稍后重新读取。'}});
   if(wideFixture){const response=await route.fetch({maxRetries:0});assert.equal(response.status(),200);const value=await response.json();trace.nativeSourceHash=value.contentHash;value.contentMd='# 受控界面表格验证\n\n'+Array.from({length:14},(_,i)=>'列'+i+'（数值单位kg）').join(' | ')+'\n'+Array(14).fill('---').join(' | ')+'\n'+Array(14).fill('1234567890.123 kg').join(' | ')+'\n\n最后一段界面验证文字';value.metadata={...value.metadata,purpose:'用途原文'.repeat(300),limitations:'适用限制原文'.repeat(280)};return route.fulfill({response,json:value});}
   if(hold){const response=await route.fetch({maxRetries:0});trace.delayedStatus=response.status();assert.equal(response.status(),200);heldResolve();await new Promise(r=>release=r);try{await route.fulfill({response});trace.lateReleased=true;}catch(e){trace.lateCanceled=e.message;}return;}
  }
  return route.continue();
 });
 if(stage==='--native'){
  await login('admin',reportAssetDetailUrl(2));await ready();
  const native=await nativeJson('/research-assets/catalog/'+rc.assetId+'/versions/2',reportAssetScope);
  for(const width of [1280,1440,1920]){
   await page.setViewportSize({width,height:1075});await ready();const row=await geometry();trace.rows.push(row);assert.equal(row.font,'16px');assert.equal(row.lineHeight,'28px');assert.equal(row.sideWidth,500);assert.equal(row.scrollWidth,width);assert(row.textWidth>=(width===1280?440:width===1440?570:720));assert(row.textWidth<=768);assert.equal(row.grid.split(' ').length,width<1920?1:2);
   for(const value of [native.metadata.purpose,native.metadata.limitations])assert.equal(await page.getByText(value,{exact:true}).count(),1);
   assert(await page.locator('.asset-preview-use-conditions').evaluate(el=>el.getBoundingClientRect().top<el.closest('.asset-preview-container').querySelector('.research-asset-reading').getBoundingClientRect().top));await snap('report-'+width);
  }
  for(const name of ['版本历史','引用与复用','相关研究','评论与讨论','文件附件','变更记录','内容概览']){await page.getByRole('button',{name,exact:true}).click();await page.waitForURL(url=>name==='内容概览'?url.searchParams.get('assetDetailTab')==='0':url.searchParams.has('assetDetailTab'));assert.equal(await page.locator('.ui-tabs button').count(),7);}await ready();await snap('tabs-return');
  await context.close();context=null;
  const f=JSON.parse(readFileSync(new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q02/fixtures.json',import.meta.url))),scope={studyGroupId:runtime.ids.group,researchProjectId:runtime.ids.project};
  for(const actor of ['owner','admin']){
   context=await browser.newContext({viewport:{width:1280,height:1075},recordVideo:{dir:out+'video-native'}});await context.route('**/api/**',route=>{const q=route.request();assert(['GET','HEAD'].includes(q.method())||new URL(q.url()).pathname.startsWith('/api/auth/'));return route.continue();});page=await context.newPage();page.on('pageerror',e=>trace.errors.push(e.message));
   const rows=f.results.filter(x=>x.actor===actor);await login(actor,makeCatalogAssetUrl(scope,rows[0].id,rows[0].version));
   for(const asset of rows){const value=await nativeJson('/research-assets/catalog/'+asset.id,scope);await page.goto(origin+makeCatalogAssetUrl(scope,asset.id,value.version));await ready();const row=await geometry();assert(row.textWidth>=440);assert.equal(value.kind,asset.kind);assert.equal(await page.getByRole('heading',{name:value.metadata.title,exact:true}).count(),1);trace.reads.push({actor,id:asset.id,kind:asset.kind,version:value.version,bodyAccess:value.bodyAccess});await snap(actor+'-'+asset.kind);}
   await context.close();context=null;
  }
 }else{
  wideFixture=true;await login('admin',reportAssetDetailUrl(2));await ready();await page.getByText('最后一段界面验证文字',{exact:true}).waitFor();const region=page.getByRole('region',{name:'资产表格1',exact:true});await region.waitFor();
  const table=await region.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,tabIndex:el.tabIndex,font:getComputedStyle(el.querySelector('th')).fontSize,lineHeight:getComputedStyle(el.querySelector('th')).lineHeight,vertical:el.scrollHeight-el.clientHeight,doc:document.documentElement.scrollWidth}));assert(table.scroll>table.client);assert.equal(table.doc,1280);assert.equal(table.tabIndex,0);assert.equal(table.font,'14px');assert.equal(table.lineHeight,'22px');await region.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('[aria-label="资产表格1"]').scrollLeft>0);trace.table=table;
  assert.equal(await page.locator('.asset-preview-use-conditions dd').first().textContent(),'用途原文'.repeat(300));assert.equal(await page.locator('.asset-preview-use-conditions dd').last().textContent(),'适用限制原文'.repeat(280));await snap('wide-table-keyboard-long-conditions');
  wideFixture=false;failDetail=true;const unavailable=page.waitForResponse(r=>new URL(r.url()).pathname===detailPath&&r.status()===503);await page.reload();await unavailable;await page.locator('.research-assets-detail [role=alert]').first().waitFor();trace.failureMessage=await page.locator('.research-assets-detail [role=alert]').first().innerText();assert.equal(await page.locator('.research-asset-reading').count(),0);await snap('503-private-cleared');failDetail=false;await page.reload();await ready();await page.getByRole('link',{name:'查看原方法报告 · 第1版',exact:true}).waitFor();await snap('503-recovered');
  hold=true;await page.reload();await held;const other=await context.newPage();await other.goto(origin+'/pages/p003/');await other.getByRole('button',{name:'退出登录',exact:true}).click();const expired=page.waitForResponse(res=>new URL(res.url()).pathname==='/api/auth/me'&&res.status()===401);await page.bringToFront();await expired;release();release=null;await page.waitForFunction(()=>!document.querySelector('.research-asset-reading'));await snap('late200-after-logout');await other.close();
 }
 assert.equal(trace.errors.length,0);trace.passed=true;writeFileSync(out+stage.slice(2)+'.json',JSON.stringify(trace,null,2));console.log('A02_READING_'+stage.slice(2).toUpperCase()+'_PASSED');
}catch(e){trace.failure=e.message;writeFileSync(out+stage.slice(2)+'-failure.json',JSON.stringify(trace,null,2));throw e;}finally{release?.();await context?.close();await browser.close();}
