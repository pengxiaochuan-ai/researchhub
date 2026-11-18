// Q01 admission only: real existing versions, no new UI/business actions or fault rearming.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeCatalogAssetUrl} from '../src/research-assets-catalog-session.js';
assert.deepEqual(process.argv.slice(2),['--verify'],'EXPLICIT_A02_Q01_BROWSER_REQUIRED');
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const ids=runtime.ids;assert.equal(ids.tenant,'rh-kb-local-b0e2af9d-tenant');
const out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q01/',import.meta.url).pathname;
const admission=JSON.parse(readFileSync(out+'preflight.json'));assert.equal(admission.passed,true);
mkdirSync(out,{recursive:true});const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const origin='http://127.0.0.1:19501',scope={studyGroupId:ids.group,researchProjectId:ids.project},contexts=[],results=[],errors=[],blocked=[],responses=[];
let stage='setup';
try{
 for(const actor of ['owner','admin']){
  const context=await browser.newContext({viewport:{width:1910,height:1075},recordVideo:{dir:out+'video',size:{width:1910,height:1075}}});contexts.push(context);
  await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(['about:','data:','blob:'].includes(u.protocol))return route.continue();if(u.origin!==origin){blocked.push({actor,path:u.origin,type:'external'});return route.abort();}
   if(!['GET','HEAD'].includes(r.method())&&!['/api/auth/login','/api/auth/logout','/api/auth/activity','/api/auth/renew'].includes(u.pathname)){blocked.push({actor,path:u.pathname,type:'business_write'});return route.abort();}return route.continue();});
  const page=await context.newPage(),video=page.video();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push({actor,message:String(e.message).replaceAll(runtime.password,'[redacted]').slice(0,240)}));
  page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/research-assets/'))responses.push({actor,path:u.pathname,status:r.status()});});
  const owned=admission.http.filter(x=>x.actor===actor),first=owned.find(x=>x.kind==='protocol');
  stage=actor+':login';await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(makeCatalogAssetUrl(scope,first.id,first.version)));
  await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/a02/**');
  const readings=[];
  for(const item of owned){
   stage=actor+':'+item.kind;await page.goto(origin+makeCatalogAssetUrl(scope,item.id,item.version));await page.locator('.hero-detail-card h2').waitFor();await page.locator('.research-asset-reading').waitFor();
   const geometry=await page.locator('.research-assets-detail .two-col').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,gap:getComputedStyle(el).columnGap,rootOverflow:document.documentElement.scrollWidth>innerWidth,readingSize:getComputedStyle(document.querySelector('.research-asset-reading p')).fontSize,readingLine:getComputedStyle(document.querySelector('.research-asset-reading p')).lineHeight}));
   // A02's mother layout has a 9px outer two-col gap; its inner preview uses 16px.
   assert.match(geometry.columns,/500px$/);assert.equal(geometry.gap,'9px');assert.equal(geometry.readingSize,'16px');assert.equal(geometry.readingLine,'28px');assert.equal(geometry.rootOverflow,false);
   await page.screenshot({path:out+actor+'-'+item.kind+'.png'});readings.push({kind:item.kind,id:item.id,version:item.version,geometry});
  }
  stage=actor+':seven-tabs';await page.goto(origin+makeCatalogAssetUrl(scope,first.id,first.version));await page.locator('.hero-detail-card h2').waitFor();
  const tabs=['内容概览','版本历史','引用与复用','相关研究','评论与讨论','文件附件','变更记录'];for(const name of tabs){await page.getByRole('button',{name,exact:true}).click();if(name==='版本历史')await page.getByLabel('查看固定版本').waitFor();else if(name==='变更记录')await page.getByLabel('查看固定版本').waitFor();}
  await page.getByRole('button',{name:'内容概览',exact:true}).click();await page.screenshot({path:out+actor+'-overview.png'});
  if(first.version>1){stage=actor+':history';await page.goto(origin+makeCatalogAssetUrl(scope,first.id,1));await page.locator('.hero-detail-card h2').waitFor();await page.locator('.hero-detail-card').getByText('v1 · 历史版本',{exact:true}).waitFor();await page.screenshot({path:out+actor+'-history.png'});}
  results.push({actor,readings,sevenTabsPresent:true,fullA02ActionsImplemented:false,knownPlaceholders:['引用与复用','相关研究','评论与讨论','文件附件'],changeTabStillVersionList:true});
  await context.close();contexts.splice(contexts.indexOf(context),1);await video.saveAs(out+actor+'-admission.webm');
 }
 assert.equal(blocked.filter(x=>x.type==='business_write').length,0);assert.equal(errors.length,0);assert(responses.length>=10);assert(responses.every(x=>x.status===200));
 writeFileSync(out+'browser.json',JSON.stringify({passed:true,at:new Date().toISOString(),ownedPid:runtime.pid,stage:'Q01_existing_read_admission_only',results,responses,errors,blocked,newBusinessWrites:0,modelCalls:0,newUiFunctionsVerified:false,recording:'real-time Playwright Chrome recordVideo'},null,2));console.log(JSON.stringify({passed:true,actors:results.length,readings:results.reduce((n,x)=>n+x.readings.length,0),newBusinessWrites:0}));
}catch(e){writeFileSync(out+'browser-failure.json',JSON.stringify({passed:false,stage,message:String(e.message).replaceAll(runtime.password,'[redacted]').slice(0,1200),results,responses,blocked,errors},null,2));console.error('A02_Q01_BROWSER_FAILED: '+stage);process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
