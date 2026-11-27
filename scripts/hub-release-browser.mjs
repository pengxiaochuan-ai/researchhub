// Public, read-only smoke. No passwords, model calls, mail or study mutations.
import fs from 'node:fs';import assert from 'node:assert/strict';import{pathToFileURL}from'node:url';
const {chromium}=await import(pathToFileURL(process.env.HUB_PLAYWRIGHT_MODULE).href);
const base=process.env.HUB_SMOKE_ORIGIN??'https://hub.pengxc.com',out=process.env.HUB_SMOKE_OUTPUT;
assert.equal(new URL(base).origin,base);assert(out);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video',size:{width:1440,height:1000}}}),page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.name));page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/'))requests.push({path:u.pathname,status:r.status()});});
let passed=false;
const checks=['login-form','anonymous-401','database-overview-200','domain-render'];
try{
 await page.goto(base+'/pages/p003/',{waitUntil:'domcontentloaded'});await page.getByLabel('邮箱',{exact:true}).waitFor();await page.screenshot({path:out+'/login.png',fullPage:true});
 assert.equal((await context.request.get(base+'/api/auth/me')).status(),401);
 const overview=await context.request.get(base+'/api/hubs/lingshu-xinyu/overview');assert.equal(overview.status(),200);const data=await overview.json();assert.equal(data.hub?.key,'lingshu-xinyu');assert(Array.isArray(data.clinicalRegistries)&&data.clinicalRegistries.length>0,'Approved registry rows are missing');
 await page.goto(base+'/pages/h01/',{waitUntil:'domcontentloaded'});await page.getByText('针灸治疗情志病',{exact:true}).first().waitFor();await page.waitForTimeout(1500);
 assert(requests.some(r=>r.path==='/api/hubs/lingshu-xinyu/overview'&&r.status===200));assert(!requests.some(r=>r.status>=500));assert.equal(errors.length,0);await page.screenshot({path:out+'/domain.png',fullPage:true});
 if(process.env.HUB_REGISTRATION_MAIL_SMOKE==='true'){
  await page.goto(base+'/pages/p004/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'加入灵枢心域',exact:true}).waitFor();
  await page.getByRole('button',{name:'发送验证邮件',exact:true}).waitFor();
  const headers={'X-ResearchHub-Request':'session-v1',Origin:base};
  const registration=await context.request.post(base+'/api/account-access/registrations',{headers,data:{}});
  assert.equal(registration.status(),400);
  assert.equal((await registration.json()).code,'WP02_INVALID_FIELDS');
  const confirmation=await context.request.post(base+'/api/account-access/registration-confirmations',{headers,data:{}});
  assert.equal(confirmation.status(),400);
  assert.equal((await confirmation.json()).code,'WP02_INVALID_FIELDS');
  const reset=await context.request.post(base+'/api/account-access/password-resets',{headers,data:{}});
  assert.equal(reset.status(),503);
  assert.equal((await reset.json()).code,'HUB_MAIL_NOT_CONFIGURED');
  assert.equal(errors.length,0);
  await page.screenshot({path:out+'/registration.png',fullPage:true});
  checks.push('registration-and-confirmation-wired','password-reset-still-disabled');
 }
 passed=true;
}finally{fs.writeFileSync(out+'/result.json',JSON.stringify({passed,checks,errors,requests,authenticatedLoginTested:false,modelsCalled:false,mailSent:false},null,2));await context.close();await browser.close();}
