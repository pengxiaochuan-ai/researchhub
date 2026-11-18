import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'docs/test/evidence/2026-10-23-researchhub-wp02/form/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),checks=[];
try{
 await page.goto('http://127.0.0.1:19501/pages/p004/');assert.equal(await page.getByRole('button',{name:'发送验证邮件',exact:true}).count(),1);
 assert.equal(await page.getByRole('alert').count(),0);await page.getByRole('button',{name:'发送验证邮件',exact:true}).click();await page.locator('#wp02-error-email').waitFor();await page.waitForFunction(()=>document.activeElement?.id==='wp02-email');checks.push('empty-submit-focuses-inline-email-error');
 await page.route('**/api/account-access/registrations',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'WP02_UNAVAILABLE'})}));
 await page.getByLabel('邮箱',{exact:true}).fill('form-check@example.test');await page.getByRole('button',{name:'发送验证邮件',exact:true}).click();await page.getByText('账号服务暂时不可用，请稍后核对再重试。',{exact:true}).waitFor();assert.equal(await page.getByLabel('邮箱',{exact:true}).inputValue(),'form-check@example.test');checks.push('503-does-not-claim-delivery-and-keeps-email');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const style=await page.getByLabel('邮箱',{exact:true}).evaluate(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));assert.deepEqual(style,{size:'16px',line:'24px'});await page.screenshot({path:out+'registration-'+width+'.png'});}checks.push('portal-font-16-24-three-viewports');
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualChrome:true,networkFailureFixture:true,notRealRegistrationAcceptance:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await context.close();await browser.close();}
