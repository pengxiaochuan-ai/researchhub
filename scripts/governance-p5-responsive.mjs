import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.match(runtime.ids.tenant,/^rh-kb-local-/);
const out=root+'researchhub/docs/testing/evidence/governance-p5-2026-11-13/responsive/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={time:new Date().toISOString(),layouts:[],errors:[],businessWrites:[],modelCalls:0};
async function login(c,role){assert.equal((await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}})).status(),201);}
async function ready(p){await p.locator('.ga-list>li').first().waitFor();}
async function measure(p){return p.evaluate(()=>{
 const main=document.querySelector('.ga-page'),aside=document.querySelector('.qiyan-platform-sidebar'),input=main.querySelector('input'),nav=document.querySelector('.qiyan-context-nav');
 const r=main.getBoundingClientRect(),s=aside.getBoundingClientRect(),f=input.getBoundingClientRect(),hit=document.elementFromPoint(f.x+f.width/2,f.y+Math.min(f.height/2,20));
 return{width:innerWidth,height:innerHeight,rootWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,sidebarRight:s.right,inputUncovered:hit===input||input.contains(hit),navWidth:nav.clientWidth,navScroll:nav.scrollWidth,navOverflow:getComputedStyle(nav).overflowX,inputTop:f.top,inputBottom:f.bottom,font:getComputedStyle(main).fontSize,line:getComputedStyle(main.querySelector('.wf-content')).lineHeight,dpr:devicePixelRatio,scale:visualViewport.scale,hubMode:document.body.dataset.hubSourceReal};
 });}
try{
 const c=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});await login(c,'admin');const p=await c.newPage();
 p.on('pageerror',e=>result.errors.push(e.message));p.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')&&!['GET','OPTIONS'].includes(r.method())&&!path.startsWith('/api/auth/'))result.businessWrites.push({path,method:r.method()});});
 await p.goto(base+'/pages/g04/');await ready(p);
 for(const width of [1440,1366,1920,390,320]){
  await p.setViewportSize({width,height:900});await p.waitForTimeout(240);await ready(p);
  const m=await measure(p);result.layouts.push(m);await p.screenshot({path:out+'admin-'+width+'.png',animations:'disabled'});
  assert.equal(m.font,'14px');assert.equal(m.line,'22px');assert(m.rootWidth<=width+1);assert(m.right<=width+1);
  if(width>900){assert.equal(m.left,220);assert.equal(m.sidebarRight,220);assert.equal(await p.locator('.qiyan-hub-nav-toggle').isVisible(),false);}
  else{
   assert(m.sidebarRight<=1,'G04_SIDEBAR_OCCLUDES_CONTENT');assert(m.inputUncovered,'G04_INPUT_IS_OCCLUDED');assert(m.navScroll>m.navWidth,'G04_TABS_NOT_SCROLLABLE');assert.equal(await p.locator('.qiyan-workflow-nav-toggle').count(),0);
   const toggle=p.locator('.qiyan-hub-nav-toggle');await toggle.click();await p.getByRole('dialog',{name:'平台导航',exact:true}).waitFor();assert.equal(await p.locator('.ga-page').evaluate(e=>e.inert),true);
   await p.keyboard.press('Tab');const focusInside=await p.evaluate(()=>!!document.activeElement.closest('.qiyan-platform-sidebar,.qiyan-hub-nav-toggle'));assert(focusInside);
   await p.screenshot({path:out+'menu-'+width+'.png',animations:'disabled'});await p.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('.ga-page').evaluate(e=>e.inert),false);
  }
 }
 await login(c,'owner');await p.goto(base+'/pages/g04/');await p.getByRole('alert').waitFor();assert.equal(await p.locator('.ga-list').count(),0);await p.screenshot({path:out+'owner-320.png'});result.ownerStillRestricted=true;await c.close();
 const zoom=await chromium.launchPersistentContext(mkdtempSync(root+'.tmp/p5-responsive-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000']});
 try{const settings=zoom.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await login(zoom,'admin');const p=await zoom.newPage();await p.goto(base+'/pages/g04/');await ready(p);await p.getByLabel('对象标识',{exact:true}).scrollIntoViewIfNeeded();result.native200=await measure(p);assert.equal(result.native200.dpr,2);assert.equal(result.native200.scale,1);assert(result.native200.sidebarRight<=1);assert(result.native200.inputUncovered);assert.equal(result.native200.navOverflow,'auto');assert(result.native200.navScroll>=result.native200.navWidth);await p.screenshot({path:out+'native200.png'});}finally{await zoom.close();}
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
}catch(e){result.passed=false;result.error=e.message;process.exitCode=1;}
finally{await browser.close();writeFileSync(out+(result.passed?'result.json':'failure-'+Date.now()+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
