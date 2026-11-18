import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=root+'docs/test/evidence/2026-10-28-researchhub-p01/';
mkdirSync(out,{recursive:true});
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:19501',checks=[],errors=[];
async function check(name,run){try{await run();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:String(error.message).slice(0,280)});}}
async function signed(username,width,video=false){
 const context=await browser.newContext({viewport:{width,height:1000},recordVideo:video?{dir:out,size:{width,height:1000}}:undefined});
 const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username,password:runtime.password}});
 assert.equal(login.status(),201,'synthetic login');
 const page=await context.newPage(),network=[];
 page.on('console',message=>{if(message.type()==='error')errors.push(username+':console:'+message.text().slice(0,150));});
 page.on('pageerror',error=>errors.push(username+':pageerror:'+error.message.slice(0,150)));
 page.on('response',response=>{if(response.url().includes('/api/my-research/overview'))network.push(response.status());});
 await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:new RegExp(username==='owner@example.org'?'合成科研人员':'合成租户管理员')}).waitFor();
 return{context,page,network};
}
try{
 await check('owner-real-pg-overview-and-desktop',async()=>{const{context,page,network}=await signed('owner@example.org',1440,true);try{
  assert.deepEqual(network,[200]);assert.equal(await page.getByRole('heading',{name:'我的课题',exact:true}).count(),1);
  assert.equal(await page.locator('.project').count(),1);
  assert.equal(await page.getByText('王教授',{exact:false}).count(),0);
  assert.equal(await page.getByText('近 14 日完成入组 4 人',{exact:false}).count(),0);
  assert.equal(await page.locator('.record-list li').count()>0,true);
  await page.screenshot({path:out+'owner-desktop.png',fullPage:true});
 }finally{const video=page.video();await context.close();await video?.saveAs(out+'owner-desktop.webm');}});
 await check('admin-sees-only-real-memberships',async()=>{const{context,page,network}=await signed('admin@example.org',1440);try{assert.deepEqual(network,[200]);assert.equal(await page.locator('.project').count(),2);await page.screenshot({path:out+'admin-desktop.png',fullPage:true});}finally{await context.close();}});
 await check('uninvited-account-has-no-private-study',async()=>{const context=await browser.newContext({viewport:{width:390,height:844}});try{const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:'uninvited@example.org',password:runtime.password}});assert.equal(login.status(),201);const page=await context.newPage();await page.goto(base+'/pages/p01/');await page.getByText('尚未加入私有 Study',{exact:false}).first().waitFor();assert.equal(await page.locator('.project').count(),0);assert.equal(await page.getByText('合成针灸研究',{exact:false}).count(),0);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);await page.screenshot({path:out+'uninvited-mobile.png',fullPage:true});}finally{await context.close();}});
 await check('anonymous-never-sees-sample-business-data',async()=>{const context=await browser.newContext();try{const page=await context.newPage();await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:'登录后查看我的工作台'}).waitFor();assert.equal(await page.locator('.project').count(),0);await page.screenshot({path:out+'anonymous.png',fullPage:true});}finally{await context.close();}});
 await check('server-failure-never-restores-demo-content',async()=>{const context=await browser.newContext();try{const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}});assert.equal(login.status(),201);const page=await context.newPage();await page.route('**/api/my-research/overview',route=>route.fulfill({status:503,json:{code:'SYNTHETIC_FAILURE'}}));await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:'首页数据暂时不可用'}).waitFor();assert.equal(await page.locator('.project').count(),0);await page.screenshot({path:out+'error.png',fullPage:true});}finally{await context.close();}});
 await check('focus-recheck-clears-old-private-content-on-revoked-read',async()=>{const{context,page}=await signed('owner@example.org',1024);try{assert.equal(await page.locator('.project').count(),1);await page.route('**/api/my-research/overview',route=>route.fulfill({status:403,json:{code:'SYNTHETIC_REVOKED_READ'}}));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'首页数据暂时不可用'}).waitFor();assert.equal(await page.locator('.project').count(),0);await page.screenshot({path:out+'focus-recheck.png',fullPage:true});const expected=errors.findIndex(x=>x.startsWith('owner@example.org:console:Failed to load resource: the server responded with a status of 403'));assert.notEqual(expected,-1,'expected denied read reached browser');errors.splice(expected,1);}finally{await context.close();}});
 await check('logout-clears-private-overview',async()=>{const{context,page}=await signed('owner@example.org',1024);try{assert.equal(await page.locator('.project').count(),1);await page.getByRole('button',{name:'打开用户菜单'}).click();await page.getByRole('button',{name:'退出当前浏览器会话'}).click();await page.getByRole('heading',{name:'登录后查看我的工作台'}).waitFor();assert.equal(await page.locator('.project').count(),0);}finally{await context.close();}});
 const result={at:new Date().toISOString(),checks,errors,passed:checks.every(x=>x.passed)&&errors.length===0,environment:'local-synthetic-only',newModelCalls:0};
 writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 assert(result.passed,'P01_BROWSER_FAILED');
}finally{await browser.close();}
