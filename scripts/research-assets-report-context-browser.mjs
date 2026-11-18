import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {reportsUrl} from '../src/formal-reports-session.js';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
assert.deepEqual(process.argv.slice(2),['--before']);
const origin='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url))),
 out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/',import.meta.url).pathname;
mkdirSync(out+'before-video',{recursive:true});
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1075},recordVideo:{dir:out+'before-video'}}),page=await context.newPage();
 page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/**',route=>{const r=route.request();if(!['GET','HEAD'].includes(r.method())&&!new URL(r.url()).pathname.startsWith('/api/auth/'))return route.abort();return route.continue();});
 const target=reportsUrl(c.studyId,{artifactId:c.reportId});await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(target));
 await page.getByLabel('邮箱',{exact:true}).fill('admin@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.waitForURL('**/pages/s10/**');await page.getByRole('heading',{name:'通用合成研究更正后描述统计报告',exact:true}).waitFor();
 await page.screenshot({path:out+'s10-before.png',fullPage:true});
 await page.goto(origin+'/pages/g02/');await page.getByRole('heading',{name:'管理与治理',exact:true}).waitFor();await page.screenshot({path:out+'g02-before.png',fullPage:true});
 await context.close();writeFileSync(out+'before-browser.json',JSON.stringify({passed:true,viewport:{width:1440,height:1075},errors,businessWrites:0},null,2));console.log('REPORT_CONTEXT_BEFORE_BROWSER_PASSED');
}finally{await browser.close();}
