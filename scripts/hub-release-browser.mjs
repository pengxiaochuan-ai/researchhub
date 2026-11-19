// Public, read-only smoke. No passwords, model calls, mail or study mutations.
import fs from 'node:fs';import assert from 'node:assert/strict';import{pathToFileURL}from'node:url';
const {chromium}=await import(pathToFileURL(process.env.HUB_PLAYWRIGHT_MODULE).href);
const base=process.env.HUB_SMOKE_ORIGIN??'https://hub.pengxc.com',out=process.env.HUB_SMOKE_OUTPUT;
assert.equal(new URL(base).origin,base);assert(out);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video',size:{width:1440,height:1000}}}),page=await context.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.name));page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/'))requests.push({path:u.pathname,status:r.status()});});
let passed=false;
try{
 await page.goto(base+'/pages/p003/',{waitUntil:'domcontentloaded'});await page.getByLabel('邮箱',{exact:true}).waitFor();await page.screenshot({path:out+'/login.png',fullPage:true});
 assert.equal((await context.request.get(base+'/api/auth/me')).status(),401);
 const overview=await context.request.get(base+'/api/hubs/lingshu-xinyu/overview');assert.equal(overview.status(),200);assert((await overview.json()).schemaVersion??true);
 await page.goto(base+'/pages/h01/',{waitUntil:'domcontentloaded'});await page.getByText('针灸治疗情志病',{exact:true}).first().waitFor();await page.waitForTimeout(1500);
 assert(requests.some(r=>r.path==='/api/hubs/lingshu-xinyu/overview'&&r.status===200));assert(!requests.some(r=>r.status>=500));assert.equal(errors.length,0);await page.screenshot({path:out+'/domain.png',fullPage:true});passed=true;
}finally{fs.writeFileSync(out+'/result.json',JSON.stringify({passed,checks:['login-form','anonymous-401','database-overview-200','domain-render'],errors,requests,authenticatedLoginTested:false,modelsCalled:false,mailSent:false},null,2));await context.close();await browser.close();}
