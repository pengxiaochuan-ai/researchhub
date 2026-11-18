// P1 DG06–10 read-only checks: never create or change a directory object.
// A broken responsive modal, lost Escape/focus recovery, or extra list filters fails this test.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',api='/api/hubs/lingshu-xinyu/directory-admin/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out=root+'researchhub/docs/testing/evidence/governance-p1-team-visual-2026-11-12/'+Date.now()+'/';
mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={checks:[],errors:[],businessWrites:[],views:[],evidence:out};let activePage;
const login=async ctx=>assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
const get=async(ctx,path)=>{const r=await ctx.request.get(base+api+path);assert.equal(r.status(),200);return r.json();};
function protect(ctx){ctx.on('page',page=>page.on('pageerror',e=>result.errors.push(e.message)));return ctx.route('**/api/**',route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 if(!path.startsWith('/api/auth/')&&!['GET','HEAD'].includes(req.method())){result.businessWrites.push({path,method:req.method()});return route.abort();}
 return route.continue();
});}
async function geometry(page,label,selector){const dom=await page.locator(selector).evaluate(n=>({
 width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,documentWidth:document.documentElement.scrollWidth,
 clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,rect:n.getBoundingClientRect().toJSON(),font:getComputedStyle(n).fontSize
}));result.views.push({label,...dom});assert(dom.documentWidth<=dom.width+1,label+' page overflow');assert(dom.rect.left>=-1&&dom.rect.right<=dom.width+1,label+' container clipped');assert(dom.scrollWidth<=dom.clientWidth+1,label+' inner overflow');return dom;}
async function check(page,ctx,label){
 activePage=page;await page.goto(base+'/pages/g02/?view=directory-review');
 const list=page.getByRole('table',{name:'团队维护列表'});await list.waitFor();
 const toolbar=page.locator('.team-search-toolbar');assert.equal(await toolbar.locator('select').count(),0);
 const search=toolbar.getByRole('searchbox',{name:'查找团队',exact:true});await search.fill(fixture.name);
 const found=page.waitForResponse(r=>new URL(r.url()).pathname===api+'team-workspaces'&&new URL(r.url()).searchParams.get('q')===fixture.name&&r.status()===200);
 await toolbar.getByRole('button',{name:'查找团队',exact:true}).click();await found;
 await page.waitForFunction(()=>document.querySelectorAll('table[aria-label="团队维护列表"] tbody tr').length===1);
 const trigger=page.getByRole('button',{name:'审核：'+fixture.name,exact:true});await trigger.waitFor();
 await geometry(page,label+' list','.team-workbench');await page.screenshot({path:out+label+'-list.png'});
 await trigger.click();const dialog=page.locator('dialog.team-workspace-dialog');await dialog.waitFor();
 const name=dialog.locator('[name=teamName]');await name.waitFor();assert.equal(await name.inputValue(),before.data.name);
 await dialog.getByRole('button',{name:'已审核',exact:true}).waitFor();
 await page.waitForFunction(()=>![...document.querySelectorAll('dialog.team-workspace-dialog [role=status]')].some(n=>/正在读取机构|正在加载省市|正在查找/.test(n.textContent)));
 const dom=await geometry(page,label+' modal','dialog.team-workspace-dialog');
 assert.equal(await name.evaluate(n=>getComputedStyle(n).fontSize),'14px');
 await page.screenshot({path:out+label+'-modal.png'});
 await name.focus();await page.keyboard.press('Tab');assert(await dialog.evaluate(n=>n.contains(document.activeElement)),'Tab stays inside modal');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-team-review-id')===id,fixture.id);
 assert.deepEqual(await get(ctx,'team-workspaces/'+fixture.id),before);
 result.checks.push(label+': name-only list; actual draft; 14px input; no horizontal clipping; Tab/Escape/focus return; unchanged snapshot');
 return dom;
}
let fixture,before;
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video'}});await protect(ctx);await login(ctx);
 const list=await get(ctx,'team-workspaces'),wanted=process.argv.find(x=>x.startsWith('--team='))?.slice(7);fixture=wanted?list.items.find(x=>x.id===wanted):list.items.find(x=>x.hasPublished)||list.items[0];assert(fixture);before=await get(ctx,'team-workspaces/'+fixture.id);
 const page=await ctx.newPage();for(const width of [1920,1440,1366,390,320]){await page.setViewportSize({width,height:1000});await check(page,ctx,String(width));}
 await ctx.close();await browser.close();
 const zoom=await chromium.launchPersistentContext(mkdtempSync(root+'.tmp/p1-team-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
 try{
  await protect(zoom);const settings=zoom.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await login(zoom);
  const page=await zoom.newPage(),dom=await check(page,zoom,'native200');assert.equal(dom.dpr,2);assert.equal(dom.scale,1);
  const trigger=page.getByRole('button',{name:'审核：'+fixture.name,exact:true});await trigger.click();await page.locator('dialog.team-workspace-dialog').getByRole('button',{name:'已审核',exact:true}).waitFor();
  await page.waitForFunction(()=>![...document.querySelectorAll('dialog.team-workspace-dialog [role=status]')].some(n=>/正在读取机构|正在加载省市|正在查找/.test(n.textContent)));
  const cdp=await zoom.newCDPSession(page),layout=await cdp.send('Page.getLayoutMetrics'),shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true,clip:{x:0,y:0,width:layout.contentSize.width,height:layout.contentSize.height,scale:1}});
  writeFileSync(out+'native200-modal-full.png',Buffer.from(shot.data,'base64'));
 }finally{await zoom.close();}
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1;await activePage?.screenshot({path:out+'failure.png'}).catch(()=>{});}
finally{await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
