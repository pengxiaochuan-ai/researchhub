// Controlled browser fault injection only: all asset writes are intercepted, never forwarded.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
import {reportsUrl} from '../src/formal-reports-session.js';
const origin='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url))),out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/',import.meta.url).pathname;
mkdirSync(out+'video-ui-faults',{recursive:true});
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const trace={at:new Date().toISOString(),mode:'controlled UI faults, actual source reads; no business write reaches server',checks:[],posts:[],errors:[]};let context,page,failSource=false,sourceFailures=0,releasePost,postStarted,postSignal=new Promise(r=>postStarted=r),receiptReads=0;
const target=reportsUrl(c.studyId,{artifactId:c.reportId}),field='输入保留验证：仅当前页面，绝不提交真实资产';
async function snap(name){await page.screenshot({path:out+'ui-faults-'+name+'.png',fullPage:true});trace.checks.push(name);}
try{
 context=await browser.newContext({viewport:{width:1440,height:1075},recordVideo:{dir:out+'video-ui-faults'}});page=await context.newPage();page.setDefaultTimeout(35000);page.on('pageerror',e=>trace.errors.push(e.message));
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()==='GET'&&path.includes('/reports')&&failSource){sourceFailures++;return route.fulfill({status:503,json:{message:'暂不可核对来源，请稍后重试。'}});}
  if(req.method()==='GET'&&path==='/api/research-assets/report-context-source'){
   const res=await route.fetch({maxRetries:0});assert.equal(res.status(),200);const body=await res.json();assert.equal(body.reportId,c.reportId);body.existing=null;trace.previewInjected=true;
   return route.fulfill({response:res,json:body});
  }
  if(req.method()==='GET'&&path.startsWith('/api/research-assets/operations/')){receiptReads++;return route.fulfill({json:{status:'not_found'}});}
  if(['GET','HEAD'].includes(req.method())||path.startsWith('/api/auth/'))return route.continue();
  assert.equal(path,'/api/research-assets/report-context-registrations');trace.posts.push({path,body:req.postDataJSON()});postStarted();
  if(trace.posts.length===1)await new Promise(resolve=>releasePost=resolve);
  return route.fulfill({status:503,json:{message:'受控UI断线，不向后台提交。'}});
 });
 await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(target));await page.getByLabel('邮箱',{exact:true}).fill('admin@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/s10/**');
 const button=page.getByRole('button',{name:'登记为科研资产',exact:true}),d=page.getByRole('dialog',{name:'登记科研资产',exact:true});
 await button.click();await d.getByLabel('使用目的',{exact:true}).fill(field);await d.getByLabel('材料使用依据',{exact:true}).fill('只用于浏览器故障恢复验证，不提交真实业务。');
 // The normal background source/auth polling remains active. Its 503 must hide private UI without resetting it.
 failSource=true;await page.getByText('当前状态尚未核对，正文与文件暂不展示。',{exact:true}).waitFor();await d.waitFor({state:'hidden'});assert(sourceFailures>0);await snap('source503-private-hidden');
 failSource=false;await page.getByRole('button',{name:'重新核对报告与来源',exact:true}).click();await d.waitFor();assert.equal(await d.getByLabel('使用目的',{exact:true}).inputValue(),field);await snap('input-restored');
 await page.keyboard.press('Escape');await d.waitFor({state:'hidden'});await button.focus();await button.press('Enter');await d.waitFor();assert.equal(await d.getByLabel('使用目的',{exact:true}).inputValue(),field);await snap('escape-reopen');
 await d.getByRole('button',{name:'登记资产',exact:true}).click();await postSignal;
 failSource=true;await page.getByText('当前状态尚未核对，正文与文件暂不展示。',{exact:true}).waitFor();await d.waitFor({state:'hidden'});releasePost();releasePost=null;
 failSource=false;await page.getByRole('button',{name:'重新核对报告与来源',exact:true}).click();await d.getByRole('button',{name:'核对原操作结果',exact:true}).waitFor();assert.equal(await d.getByLabel('使用目的',{exact:true}).inputValue(),field);
 await d.getByRole('button',{name:'核对原操作结果',exact:true}).click();await d.getByRole('button',{name:'沿用原输入重试',exact:true}).waitFor();assert.equal(receiptReads,1);await d.getByRole('button',{name:'沿用原输入重试',exact:true}).click();await d.getByRole('button',{name:'核对原操作结果',exact:true}).waitFor();assert.equal(trace.posts.length,2);assert.deepEqual(trace.posts[1].body,trace.posts[0].body);await snap('original-key-body-preserved');
 // True identity change clears the draft and ignores any late asset response; no public or source DOM may remain.
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('qiyan:user-change',{detail:{authenticated:false}})));await d.waitFor({state:'hidden'});assert.equal(await button.count(),0);await snap('identity-cleared');
 assert.equal(trace.errors.length,0);trace.businessWritesForwarded=0;trace.passed=true;writeFileSync(out+'ui-faults.json',JSON.stringify(trace,null,2));console.log('REPORT_CONTEXT_UI_FAULTS_PASSED');
}catch(e){trace.failure=e.message;writeFileSync(out+'ui-faults-failure.json',JSON.stringify(trace,null,2));throw e;}
finally{releasePost?.();await context?.close();await browser.close();}
