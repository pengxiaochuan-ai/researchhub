import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'researchhub/docs/testing/evidence/p01-closure-2026-11-10/risks-'+Date.now()+'/';mkdirSync(out,{recursive:true});
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:19501',context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out}}),checks=[];
try{
 assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:'owner@example.org',password:rt.password}})).status(),201);
 const first=await(await context.request.get(base+'/api/my-research/overview')).json(),second=await(await context.request.get(base+'/api/my-research/overview?draftPage=2')).json();
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function enter(){await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:first.profile.displayName+'，您好',exact:true}).waitFor();await page.locator('.personal-draft-details summary').click();await page.getByRole('button',{name:'查看全部草稿'}).click();await page.locator('.personal-draft-details').getByText('第 1 页',{exact:true}).waitFor();}
 await enter();
 const pattern='**/api/my-research/overview?draftPage=2';let seen,release;const arrived=new Promise(r=>{seen=r;}),held=new Promise(r=>{release=r;});
 await page.route(pattern,async route=>{seen();await held;try{await route.fulfill({status:200,json:{...second,drafts:second.drafts.map(d=>({...d,title:'迟到请求不得显示'}))}});}catch{}});
 await page.locator('.personal-draft-details').getByRole('button',{name:'下一页'}).click();await arrived;
 await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:first.profile.displayName+'，您好',exact:true}).waitFor();release();await page.unroute(pattern);await page.locator('.personal-draft-details summary').click();await page.waitForTimeout(150);assert.equal(await page.getByText('迟到请求不得显示',{exact:true}).count(),0);checks.push('unmounted-page-ignores-held-previous-response');
 for(const status of [401,403]){
  await enter();await page.route(pattern,route=>route.fulfill({status,json:{code:'CONTROLLED_READ_DENIAL'}}));await page.locator('.personal-draft-details').getByRole('button',{name:'下一页'}).click();await page.getByRole('heading',{name:status===401?'登录后查看我的工作台':'首页数据暂时不可用',exact:true}).waitFor();assert.equal(await page.locator('.project,.record-list li,.personal-report-reading').count(),0);await page.screenshot({path:out+'paging-'+status+'-cleared.png',fullPage:true});await page.unroute(pattern);checks.push('paging-'+status+'-clears-private-overview');
 }
 await enter();await page.route(pattern,route=>route.abort('failed'));await page.locator('.personal-draft-details').getByRole('button',{name:'下一页'}).click();await page.locator('.personal-draft-details').getByRole('alert').waitFor();assert.equal(await page.locator('.project').count()>0,true);assert.equal(await page.getByRole('heading',{name:'登录后查看我的工作台',exact:true}).count(),0);await page.unroute(pattern);await page.locator('.personal-draft-details').getByRole('button',{name:'重新读取',exact:true}).click();await page.locator('.personal-draft-details').getByText('第 2 页',{exact:true}).waitFor();checks.push('network-failure-is-not-logout-and-retry-restores-page');
 const result={passed:errors.length===0,checks,errors,environment:'local-synthetic',controlledFailures:true,businessWrites:0,modelCalls:0};writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:out}));assert.equal(result.passed,true);
}finally{await context.close();await browser.close();}
