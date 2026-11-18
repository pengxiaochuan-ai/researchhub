// Read-only admission. Local input edits are discarded; every directory write is rejected.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',api='/api/hubs/lingshu-xinyu/directory-admin/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out=root+'researchhub/docs/testing/evidence/governance-p1-team-admission-2026-11-12/'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video'}}),page=await ctx.newPage(),result={evidence:out,checks:[],writes:[],errors:[],network:[],requestFailures:[]};
const login=async username=>{assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username,password:runtime.password}})).status(),201);};
try{
 await login('admin@example.org');page.on('pageerror',e=>result.errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/directory-admin/'))result.network.push({path:new URL(r.url()).pathname,query:new URL(r.url()).search,status:r.status()});});
 page.on('requestfailed',r=>{if(r.url().includes('/directory-admin/'))result.requestFailures.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText});});
 await page.route('**/directory-admin/**',async route=>{if(route.request().method()!=='GET'){result.writes.push({method:route.request().method(),path:new URL(route.request().url()).pathname});return route.abort();}return route.continue();});
 const list=await ctx.request.get(base+api+'team-workspaces');assert.equal(list.status(),200);const listing=await list.json();assert(listing.items.length);
 const item=listing.items.find(x=>x.hasPublished)||listing.items[0],url=base+'/pages/g02/?'+new URLSearchParams({view:'directory-review',team:item.id});
 const before=await(await ctx.request.get(base+api+'team-workspaces/'+item.id)).json();
 await page.goto(url);const dialog=page.locator('dialog.team-workspace-dialog');await dialog.waitFor();const name=dialog.locator('[name=teamName]');await name.waitFor();
 assert.equal(await name.inputValue(),before.data.name);await page.screenshot({path:out+'editor-1440.png'});
 result.list={total:listing.pagination.totalItems,keys:Object.keys(listing.items[0])};
 result.listControls=await page.locator('.team-search-toolbar').locator('input,select,button').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,label:n.getAttribute('aria-label')||n.textContent||n.getAttribute('placeholder')})));
 const edited=before.data.name+'（本地未保存验证）';await name.fill(edited);
 const identity=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/me'&&r.status()===200);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await identity;assert.equal(await name.inputValue(),edited);
 await dialog.getByRole('button',{name:'关闭审核弹窗'}).click();const confirmation=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'放弃当前修改？'})});await confirmation.waitFor();await confirmation.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await name.inputValue(),edited);
 await dialog.getByRole('button',{name:'关闭审核弹窗'}).click();await page.getByRole('button',{name:'放弃并继续',exact:true}).click();await dialog.waitFor({state:'detached'});
 result.checks.push('actual team/draft loaded; focus retains local input; in-app discard cancellation retains input; explicit discard returns to list');await page.screenshot({path:out+'list-1440.png'});
 const after=await(await ctx.request.get(base+api+'team-workspaces/'+item.id)).json();assert.deepEqual(after,before);
 await login('owner@example.org');const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/me'&&r.status()===200);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
 await page.getByRole('alert').filter({hasText:'当前身份没有此目录操作权限'}).waitFor();assert.equal(await page.locator('[name=teamName]').count(),0);assert.equal((await ctx.request.get(base+api+'team-workspaces')).status(),403);
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+api+'team-workspaces')).status(),401);await anonymous.close();
 result.checks.push('real owner switch clears admin editor; owner403 and anonymous401 unchanged');assert.deepEqual(result.writes,[]);assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1;await page.screenshot({path:out+'failure.png'}).catch(()=>{});}
finally{await ctx.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
