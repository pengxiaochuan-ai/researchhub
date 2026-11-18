import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(rt.ids.tenant,/^rh-kb-local-/);
const out=root+'researchhub/docs/testing/evidence/governance-loading-2026-11-16/browser-'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={checks:[],pageErrors:[],businessWrites:[]};let c,p;
const login=async username=>assert.equal((await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username,password:rt.password}})).status(),201);
const queue=()=>p.locator('.governance-overview > section').first().locator('.governance-queue');
const settled=()=>p.waitForFunction(()=>document.querySelector('.governance-queue')?.getAttribute('aria-busy')==='false',{},{timeout:30000});
const rows=()=>queue().locator('.governance-items li');
async function fresh(){await c?.close();c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video'}});await c.route('**/api/**',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())&&!new URL(r.request().url()).pathname.startsWith('/api/auth/')){result.businessWrites.push(r.request().url());return r.abort();}return r.continue();});p=await c.newPage();p.on('pageerror',e=>result.pageErrors.push(e.message));await login('admin@example.org');}
try{
 await fresh();let release;const gate=new Promise(r=>release=r);let held=0;
 await p.route('**/api/member-invitations?*',async r=>{held++;await gate;await r.continue().catch(()=>{});});
 await p.goto(base+'/pages/g02/');await rows().first().waitFor({timeout:15000});assert(held>0);assert.equal(await queue().getAttribute('aria-busy'),'true');await queue().getByText('正在读取其余事项…',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'下一页',exact:true}).isDisabled(),true);await p.screenshot({path:out+'progressive.png'});
 await p.getByLabel('所属模块',{exact:true}).selectOption('system');await settled();assert.equal(await p.getByRole('button',{name:'刷新待办',exact:true}).isDisabled(),true);
 await p.getByLabel('所属模块',{exact:true}).selectOption('all');assert.equal(await queue().getAttribute('aria-busy'),'true');release();await settled();await p.getByRole('button',{name:'下一页',exact:true}).click();const page2=await rows().allTextContents();assert(page2.length>0);assert.match(await queue().innerText(),/第2／/);await p.screenshot({path:out+'page2.png'});
 result.checks.push('slow invitation does not block ready categories; loading/filter/paging accurate');
 await p.unroute('**/api/member-invitations?*');await p.reload();await settled();assert.deepEqual(await rows().allTextContents(),page2);result.checks.push('page2 exact return retained after complete reload');
 for(const status of [503,403]){
  await fresh();await p.route('**/api/member-invitations?*',r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify({code:'BROWSER_CONTROLLED_READ_FAILURE',message:'controlled read failure'})}));await p.goto(base+'/pages/g02/');await settled();assert(await rows().count()>0);
  if(status===503)await p.getByRole('alert').filter({hasText:'邀请异常暂时读取失败'}).waitFor();else await p.getByText('仅展示当前账号有权访问的管理事项。',{exact:true}).first().waitFor();
  await p.screenshot({path:out+'invitation-'+status+'.png'});result.checks.push('controlled invitation '+status+' preserves other categories and explicit failure/denial');
 }
 await fresh();let releaseOld;const oldGate=new Promise(r=>releaseOld=r);let captured=false;
 await p.route('**/api/hub-sources/review-queue**',async r=>{const response=await r.fetch();captured=true;await oldGate;await r.fulfill({response}).catch(()=>{});});
 await p.goto(base+'/pages/g02/');await p.waitForFunction(()=>document.querySelector('.governance-overview'));for(let i=0;i<100&&!captured;i++)await new Promise(r=>setTimeout(r,50));assert(captured,'old admin source response held');
 const previousId=await p.evaluate(async()=>{const m=await import('/src/platform-user.js');return m.getPlatformUser().accountId??m.getPlatformUser().id;});await login('owner@example.org');await p.evaluate(()=>window.dispatchEvent(new Event('qiyan:auth-changed')));await p.waitForFunction(async old=>{const m=await import('/src/platform-user.js'),u=m.getPlatformUser();return u.authenticated&&(u.accountId??u.id)!==old;},previousId,{timeout:15000});releaseOld();await settled();await p.getByText('仅展示当前账号有权访问的管理事项。',{exact:true}).first().waitFor();assert.equal(await queue().locator('a[href*="source-review"]').count(),0);assert.equal(await rows().count(),2);await p.screenshot({path:out+'identity-changed.png'});result.checks.push('real account switch during held admin response clears previous view');
 await fresh();await p.goto(base+'/pages/g02/');await settled();await p.setViewportSize({width:320,height:900});await p.screenshot({path:out+'320.png'});result.checks.push('original narrow layout retained');
 assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
}catch(error){result.passed=false;result.error=error.message;process.exitCode=1;await p?.screenshot({path:out+'failure.png'}).catch(()=>{});}
finally{await c?.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,out}));}
