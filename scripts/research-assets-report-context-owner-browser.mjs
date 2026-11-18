// Real authorized reads, two original identities, actual logout and delayed original 200. No asset mutation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
import {reportsUrl} from '../src/formal-reports-session.js';
import {reportAssetDetailUrl,reportAssetReviewUrl} from '../src/report-asset-context.js';
const origin='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url))),out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/',import.meta.url).pathname;
mkdirSync(out+'video-owner-final',{recursive:true});
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const trace={at:new Date().toISOString(),checks:[],errors:[],sourceReads:[],businessWrites:0,geometry:[]};let context,page,release,held,hold=false;const heldSignal=new Promise(r=>held=r);
async function login(actor,target){await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(target));await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL(url=>url.pathname===new URL(target,origin).pathname);}
async function snap(name){await page.screenshot({path:out+'readonly-final-'+name+'.png',fullPage:true});trace.checks.push(name);}
try{
 context=await browser.newContext({viewport:{width:1440,height:1075},recordVideo:{dir:out+'video-owner-final'}});page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>trace.errors.push(e.message));
 await context.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;assert(['GET','HEAD'].includes(req.method())||path.startsWith('/api/auth/'),'Only auth writes permitted');
  if(hold&&path==='/api/research-assets/report-context-source'){const res=await route.fetch({maxRetries:0});trace.delayedSourceStatus=res.status();assert.equal(res.status(),200);held();await new Promise(r=>release=r);try{await route.fulfill({response:res});trace.late200Released=true;}catch(e){trace.lateReadCanceled=e.message;}return;}
  return route.continue();});
 const target=reportsUrl(c.studyId,{artifactId:c.reportId});
 page.on('response',res=>{const path=new URL(res.url()).pathname;if(path.startsWith('/api/'))trace.sourceReads.push({path,status:res.status()});});
 const denied=page.waitForResponse(res=>new URL(res.url()).pathname.includes(c.studyId)&&res.status()===403);
 await login('owner',target);await denied;await page.getByText('当前状态尚未核对，正文与文件暂不展示。',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'登记为科研资产',exact:true}).count(),0);await snap('owner-denied-settled');
 assert.equal(trace.errors.length,0);trace.passed=true;writeFileSync(out+'owner-browser-final.json',JSON.stringify(trace,null,2));console.log('REPORT_CONTEXT_READONLY_BROWSER_FINAL_PASSED');
}catch(e){trace.failure=e.message;writeFileSync(out+'owner-browser-final-failure.json',JSON.stringify(trace,null,2));throw e;}finally{release?.();await context?.close();await browser.close();}
