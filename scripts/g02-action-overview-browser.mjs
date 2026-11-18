import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out=root+'researchhub/docs/testing/evidence/g02-action-overview-2026-11-11/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium??pw.default.chromium;
const browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],metrics=[],network=[],errors=[],consoleMessages=[],businessWrites=[];let context;
const api=/\/api\/(hub-sources\/review-queue|hubs\/lingshu-xinyu\/directory-admin\/team-workspaces(?:\?|$)|hub-billing\/reconciliations)/;
async function login(ctx,actor){const r=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(r.status(),201);}
async function loaded(p){await p.waitForFunction(()=>{const b=[...document.querySelectorAll('.governance-overview button')].find(e=>e.textContent==='刷新待办');return b&&!b.disabled&&!document.querySelector('.governance-queue[aria-busy="true"]');});}
try{
 context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});await login(context,'admin');
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(['error','warning'].includes(e.type()))consoleMessages.push({type:e.type(),message:e.text()});});p.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')&&!path.startsWith('/api/auth/')&&r.method()!=='GET')businessWrites.push({path,method:r.method()});});p.on('response',r=>{if(api.test(r.url()))network.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});});
 await p.goto(base+'/pages/g02/');await loaded(p);await p.getByRole('navigation',{name:'常用管理',exact:true}).waitFor();
 assert.equal(await p.locator('.g02-stat,.g02-chart-row,.g02-middle-row,.g02-bottom-row').count(),0);
 assert.equal(await p.getByRole('button',{name:/下载治理报告|日期范围/}).count(),0);
 assert.equal(await p.locator('.qiyan-context-nav button').count(),8);
 assert.equal(await p.locator('.governance-history').getAttribute('open'),null);
 assert.equal(network.filter(x=>x.path.includes('reconciliations')&&x.status===200).length,1);
 const queue=(await context.request.get(base+'/api/hub-sources/review-queue')).status();assert.equal(queue,200);
 for(const width of [1440,1366,1920,390,320]){
  await p.setViewportSize({width,height:900});
  const measure=await p.locator('.governance-overview').evaluate(e=>({width:innerWidth,scroll:document.documentElement.scrollWidth,box:e.getBoundingClientRect().toJSON(),font:getComputedStyle(e.querySelector('h3')??e.querySelector('p')).fontSize,line:getComputedStyle(e.querySelector('h3')??e.querySelector('p')).lineHeight,nav:getComputedStyle(document.querySelector('.qiyan-context-nav')).overflowX}));
  metrics.push(measure);assert(measure.box.right<=width+1);assert.equal(measure.font,'14px');
  await p.screenshot({path:out+'admin-'+width+'.png'});
  if(width===1440){await p.locator('.governance-history').scrollIntoViewIfNeeded();await p.screenshot({path:out+'admin-management-and-history.png'});await p.locator('.platform-main').evaluate(e=>e.scrollTop=0);}
 }
 checks.push('real admin, three regions, eight unchanged tabs, lazy history, five actual viewport captures');
 await p.setViewportSize({width:1440,height:900});
 const source=await p.locator('.governance-items a[href*="reviewKey="]').first().getAttribute('href').catch(()=>null);
 if(source){await p.goto(base+source);await p.locator('.hub-review-detail-heading h3').waitFor();assert.equal(await p.locator('.hub-review-detail-heading h3').count(),1);await p.screenshot({path:out+'source-target.png'});checks.push('source row opens selected authorized source');}
 await p.goto(base+'/pages/g02/');await loaded(p);
 const team=await p.locator('.governance-items a[href*="team="]').first().getAttribute('href').catch(()=>null);
 if(team){await p.goto(base+team);await p.getByRole('dialog').waitFor();await p.locator('input[name="teamName"]').waitFor();await p.screenshot({path:out+'team-target.png'});await p.keyboard.press('Escape');checks.push('team row opens actual editor without saving or reviewing');}
 await p.goto(base+'/pages/g02/');await loaded(p);await p.getByLabel('事项类型',{exact:true}).selectOption('billing');
 const bill=await p.locator('.governance-items a[href*="record="]').first().getAttribute('href');
 await p.goto(base+bill);await p.getByRole('dialog').waitFor();await p.screenshot({path:out+'billing-target.png'});await p.keyboard.press('Escape');checks.push('billing row opens exact original record, no settlement');
 await p.goto(base+'/pages/g02/');await loaded(p);await p.locator('.governance-history summary').click();await loaded(p);await p.locator('.governance-history .governance-items').waitFor();await p.screenshot({path:out+'processed.png'});checks.push('processed history loads on demand and offers existing object links');
 await p.getByLabel('记录类型',{exact:true}).selectOption('teams');
 const processedTeam=await p.locator('.governance-history a[href*="team="]').first().getAttribute('href');
 await p.goto(base+processedTeam);await p.getByRole('dialog').waitFor();await p.locator('input[name="teamName"]').waitFor();await p.screenshot({path:out+'team-target.png'});await p.keyboard.press('Escape');checks.push('processed team row opens the exact existing team with original edit/review controls');
 await p.goto(base+'/pages/g02/?view=source-review&reviewKey=external:missing-entry');await p.getByText('指定来源当前不存在或无权访问，请从审核队列重新选择。',{exact:true}).waitFor();assert.equal(await p.locator('.hub-review-detail-heading h3').count(),0);await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api/hub-sources/review-queue')&&r.status()===200),p.evaluate(()=>window.dispatchEvent(new Event('focus')))]);await p.getByText('指定来源当前不存在或无权访问，请从审核队列重新选择。',{exact:true}).waitFor();assert.equal(await p.locator('.hub-review-detail-heading h3').count(),0);checks.push('unknown deep link stays unselected across focus refresh');
 await p.route('**/api/hub-sources/review-queue',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'UI-only fault'})}));
 await p.goto(base+'/pages/g02/');await loaded(p);await p.getByRole('alert').filter({hasText:'来源审核暂时读取失败'}).waitFor();assert.equal(await p.getByText('当前暂无待处理事项。',{exact:true}).count(),0);await p.screenshot({path:out+'partial-failure.png'});
 await p.unroute('**/api/hub-sources/review-queue');await Promise.all([p.waitForResponse(r=>r.url().endsWith('/api/hub-sources/review-queue')&&r.status()===200),p.getByRole('button',{name:'重新读取',exact:true}).click()]);await p.getByRole('alert').waitFor({state:'detached'});await loaded(p);checks.push('UI-only 503 stays distinct from empty; explicit retry returns to real data');
 await p.route('**/api/hub-sources/review-queue',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
 await p.route('**/api/hubs/lingshu-xinyu/directory-admin/team-workspaces*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],pagination:{page:1,pageSize:20,totalItems:0,totalPages:0}})}));
 await p.route('**/api/hub-billing/reconciliations*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],page:1,pageSize:20,total:0})}));
 await p.goto(base+'/pages/g02/');await loaded(p);await p.getByText('当前暂无待处理事项。',{exact:true}).waitFor();await p.screenshot({path:out+'ui-only-empty.png'});
 await p.unroute('**/api/hub-sources/review-queue');await p.unroute('**/api/hubs/lingshu-xinyu/directory-admin/team-workspaces*');await p.unroute('**/api/hub-billing/reconciliations*');
 await p.goto(base+'/pages/g02/');await loaded(p);await p.getByLabel('事项类型',{exact:true}).focus();await p.keyboard.press('Tab');assert.equal(await p.getByRole('button',{name:'刷新待办',exact:true}).evaluate(e=>e===document.activeElement),true);checks.push('UI-only successful zero lists show empty; keyboard reaches refresh');
 const original=await context.request.get(base+'/api/hub-sources/review-queue');const originalItems=(await original.json()).items;
 let release,seen,holdOnce=true;const held=new Promise(r=>release=r),started=new Promise(r=>seen=r);
 await p.route('**/api/hub-sources/review-queue',async r=>{if(!holdOnce)return r.continue();holdOnce=false;const response=await r.fetch();seen();await held;await r.fulfill({response}).catch(()=>{});});
 await p.getByRole('button',{name:'刷新待办',exact:true}).click();await started;await login(context,'owner');await p.evaluate(()=>window.dispatchEvent(new Event('qiyan:auth-refresh')));await p.getByText('当前账号没有所选管理事项的查看或处理权限。',{exact:true}).waitFor();release();await p.unroute('**/api/hub-sources/review-queue');
 assert.equal(await p.locator('.governance-items li').count(),0);assert.equal(await p.locator('.governance-shortcuts a').count(),0);await p.screenshot({path:out+'owner-denied.png'});checks.push('real owner denied; late real admin response cannot repopulate a different identity');
 await context.close();context=null;
 const zoom=await chrome.launchPersistentContext(mkdtempSync(root+'.tmp/g02-action-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'zoom-video'}});
 try{const settings=zoom.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await login(zoom,'admin');const z=await zoom.newPage();await z.goto(base+'/pages/g02/');await loaded(z);const m=await z.evaluate(()=>({inner:innerWidth,outer:outerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,right:document.querySelector('.governance-overview').getBoundingClientRect().right}));assert.equal(m.dpr,2);assert.equal(m.scale,1);assert(m.right<=m.inner+1);metrics.push({native200:m});await z.screenshot({path:out+'native200.png',fullPage:true});checks.push('native isolated Chrome 200 percent and preserved content');}finally{await zoom.close();}
 assert.deepEqual(errors,[]);assert.equal(network.filter(x=>x.method!=='GET').length,0);assert.deepEqual(businessWrites,[]);
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,metrics,network,errors,consoleMessages,sourceCount:originalItems.length,businessWrites,paidCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,out}));
}catch(e){console.error(e.stack);writeFileSync(out+'failure.json',JSON.stringify({checks,metrics,network,errors},null,2));await context?.pages()[0]?.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{await context?.close();await browser.close();}
