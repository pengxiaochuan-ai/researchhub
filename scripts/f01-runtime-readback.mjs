// Read-only business proof against the owned 19501 runtime. Auth retains its normal writes.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function run(){
 const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),base='http://127.0.0.1:19501',pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium??pw.default.chromium;
 const browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),out=root+'researchhub/docs/testing/evidence/f01-admission-2026-11-17/',report={pid:runtime.pid,syntheticOnly:true,actors:[],errors:[],businessWrites:0};
 try{for(const username of ['admin@example.org','owner@example.org']){
  const c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'runtime-video'}});try{
   const response=await c.request.post(base+'/api/auth/login',{headers:{Origin:base,'X-ResearchHub-Request':'session-v1'},data:{tenantSlug:runtime.ids.tenant,username,password:runtime.password}});assert.equal(response.status(),201);
   const me=await(await c.request.get(base+'/api/auth/me')).json(),own=await(await c.request.get(base+'/api/hubs/lingshu-xinyu/admission')).json();assert.equal(own.accountId,me.accountId);assert.equal(own.status,'approved');assert.equal(own.source,'legacy_confirmed');
   const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET'&&!new URL(r.url()).pathname.startsWith('/api/auth/'))report.businessWrites++;});
   await p.goto(base+'/pages/p004/');await p.waitForURL('**/pages/p01/');assert.equal((await c.request.get(base+'/api/research-projects/context')).status(),200);
   const admin=me.role==='tenant_admin'&&me.isTenantAdmin===true;
   assert.equal((await c.request.get(base+'/api/hubs/lingshu-xinyu/admissions')).status(),admin?200:403);
   if(admin){await p.goto(base+'/pages/g03/');await p.getByRole('heading',{name:'加入审核',exact:true}).waitFor();await p.getByRole('combobox').first().focus();await p.keyboard.press('Tab');assert.equal(await p.locator(':focus').getAttribute('maxLength'),'200');await p.getByRole('combobox').first().selectOption('approved');await p.getByRole('button',{name:'查看申请',exact:true}).first().click();await p.getByRole('region',{name:'加入申请详情'}).waitFor();assert.equal(await p.locator(':focus').getAttribute('aria-label'),'加入申请详情');await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);await p.getByRole('region',{name:'加入申请详情'}).scrollIntoViewIfNeeded();await p.screenshot({path:out+'runtime-admin-detail390.png'});}
   report.actors.push({accountId:me.accountId,approved:true,legacy:true,admin,existingJoinRoute:true});
  }finally{await c.close();}
 }assert.equal(report.businessWrites,0);assert.deepEqual(report.errors,[]);report.passed=true;return report;
 }finally{await browser.close();writeFileSync(out+'runtime-readback.json',JSON.stringify(report,null,2));}
}
if(process.argv[1]===fileURLToPath(import.meta.url))run().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});
