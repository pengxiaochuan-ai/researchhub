import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const phase=process.argv[2]||'green',out=root+'researchhub/docs/testing/evidence/governance-source-position-2026-11-12/';
mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={phase,checks:[],geometry:[],errors:[],harnessWarnings:[],businessWrites:[]};let context;
const title='循证针灸临床实践指南：抑郁症（修订版）';
async function geometry(page){return page.locator('.hub-review-queue').evaluate(panel=>{
 const list=panel.querySelector('ul'),selected=panel.querySelector('[aria-current=true]'),heading=selected?.querySelector('strong');
 const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height};};
 return{list:rect(list),selected:rect(selected),heading:rect(heading),scrollTop:list.scrollTop,visible:heading.getBoundingClientRect().top>=list.getBoundingClientRect().top&&heading.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom,title:heading.textContent};
});}
async function ready(page){await page.locator('.hub-review-detail-heading h3').filter({hasText:title}).waitFor();await page.waitForFunction(()=>document.querySelector('.hub-review-queue ul')?.clientHeight>0&&![...document.querySelector('.hub-review-workspace').children].some(n=>n.textContent==='正在读取当前审核队列…'));}
async function gatedReread(page,trigger){
 let release,arrive;const gate=new Promise(resolve=>release=resolve),arrived=new Promise(resolve=>arrive=resolve);
 const handler=async route=>{const response=await route.fetch();arrive();await gate;await route.fulfill({response});};
 await page.route('**/api/hub-sources/review-queue',handler);
 try{await trigger();await arrived;await page.getByText('正在读取当前审核队列…',{exact:true}).waitFor();release();await ready(page);}
 finally{release();await page.unroute('**/api/hub-sources/review-queue',handler);}
}
async function overviewReady(page){await page.waitForFunction(()=>{const b=[...document.querySelectorAll('.governance-overview button')].find(e=>e.textContent==='刷新待办');return b&&!b.disabled&&!document.querySelector('.governance-queue[aria-busy="true"]');});}
try{
 context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});
 const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}});assert.equal(login.status(),201);
 context.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')&&!path.startsWith('/api/auth/')&&r.method()!=='GET')result.businessWrites.push({path,method:r.method()});});
 const p=await context.newPage();p.on('pageerror',e=>result.errors.push(e.message));p.on('console',e=>{if(e.type()==='error')result.errors.push(e.text());});
 const response=await context.request.get(base+'/api/hub-sources/review-queue');assert.equal(response.status(),200);const queue=await response.json();
 const item=queue.items.find(x=>x.title===title);assert(item,'actual guideline must exist');
 result.source={key:item.key,title:item.title,state:item.state,decisions:item.detail.decisions.map(d=>({fieldKind:d.fieldKind,purpose:d.purpose,decision:d.decision,audience:d.audience,expiresAt:d.expiresAt,createdAt:d.createdAt,version:d.version,evidenceRef:d.evidenceRef})),guidanceExtraction:item.detail.guidanceExtraction?{extractionId:item.detail.guidanceExtraction.extractionId,review:item.detail.guidanceExtraction.review}:null};
 const protocols=[];let cursor=null;do{const r=await context.request.get(base+'/api/research-studies/protocol-reviews?'+new URLSearchParams({status:'pending_review',limit:'20',...(cursor?{cursor}:{})}));assert.equal(r.status(),200);const body=await r.json();protocols.push(...body.items);cursor=body.nextCursor;}while(cursor);
 result.protocols=protocols.map(x=>({studyId:x.studyId,studyTitle:x.studyTitle,protocol:x.protocol,href:x.href}));
 await p.goto(base+'/pages/g02/?governanceModule=data');
 await overviewReady(p);
 let row=p.locator('.governance-items li').filter({has:p.getByRole('heading',{name:title,exact:true})});
 while(!await row.count()){const next=p.getByRole('button',{name:'下一页',exact:true});assert(await next.isEnabled());await next.click();await overviewReady(p);}
 await row.getByRole('link',{name:/审核/}).click();await ready(p);
 const url=p.url();result.geometry.push({stage:'entry',...await geometry(p)});await p.screenshot({path:out+phase+'-entry.png'});
 assert.equal(result.geometry.at(-1).visible,true,'deep-linked source title must be visible in left queue');result.checks.push('actual overview audit link reveals selected left title and corresponding right detail');
 await p.reload();await ready(p);assert.equal((await geometry(p)).visible,true);result.checks.push('reload retains and reveals requested article');
 await gatedReread(p,()=>p.getByRole('button',{name:'重新核对',exact:true}).click());assert.equal((await geometry(p)).visible,true);result.checks.push('real explicit refresh held in loading then released to ready reveals same selected article');
 for(const width of [1366,1920,1024]){await p.setViewportSize({width,height:900});await p.goto(url);await ready(p);const g=await geometry(p);result.geometry.push({stage:'width-'+width,...g});assert(g.visible);await p.screenshot({path:out+phase+'-'+width+'.png'});}
 for(const width of [390,320]){
  await p.setViewportSize({width,height:844});await p.goto(url);await p.locator('.hub-review-detail-heading h3').filter({hasText:title}).waitFor();assert.equal(await p.locator('.hub-review-queue').isVisible(),false);
  await p.getByRole('button',{name:'返回审核队列',exact:true}).click();const chosen=p.locator('.hub-review-queue [aria-current=true] strong');await chosen.waitFor();assert.equal(await chosen.textContent(),title);await assert.doesNotReject(()=>chosen.click({trial:true,timeout:3000}));
  const visible=await chosen.evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=64&&r.bottom<=innerHeight;});assert(visible,'return to mobile queue reveals current title');await p.screenshot({path:out+phase+'-'+width+'.png'});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 result.checks.push('desktop widths preserve queue visibility; narrow detail→queue reveals selection without horizontal overflow');
 const component=await context.newPage();
 component.on('pageerror',e=>result.errors.push('component: '+e.message));component.on('console',e=>{if(e.type()==='error'){
  if(/WebSocket connection|\[vite\] failed to connect to websocket/.test(e.text()))result.harnessWarnings.push(e.text());else result.errors.push('component console: '+e.text());
 }});
 await component.route('**/__source-position-test**',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div><script type="module">import RefreshRuntime from"/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;import React from"/node_modules/.vite/deps/react.js";import ReactDOM from"/node_modules/.vite/deps/react-dom_client.js";const{default:Workbench}=await import("/pages/shared/HubSourceWorkbench.jsx");ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Workbench,{embedded:true}));</script>'}));
 await component.goto(base+'/__source-position-test?reviewKey='+encodeURIComponent(item.key));await ready(component);
 await component.locator('.hub-review-queue ul').hover();await component.mouse.wheel(0,-180);
 await component.waitForFunction(()=>{const list=document.querySelector('.hub-review-queue ul'),button=list.querySelector('[aria-current=true]');return button.getBoundingClientRect().top>list.getBoundingClientRect().top+50;});
 const beforeRefresh=await component.locator('.hub-review-queue ul').evaluate(n=>n.scrollTop);
 // Isolated real component + real GET; excludes the global shell's separate identity recheck.
 await gatedReread(component,()=>component.evaluate(()=>window.dispatchEvent(new Event('focus'))));
 assert.equal(await component.locator('.hub-review-queue ul').evaluate(n=>n.scrollTop),beforeRefresh,'background read must not override manual queue scrolling');
 result.checks.push('isolated real workbench background GET preserves manual queue scroll; not a global identity-refresh assertion');await component.close();
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.businessWrites,[]);result.checks.push('no page errors or business writes across both pages; isolated harness HMR warnings separately retained');result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;const active=context?.pages().at(-1);if(active){result.lastPage={url:active.url(),body:(await active.locator('body').innerText()).slice(0,1200)};await active.screenshot({path:out+phase+'-failure.png'});}process.exitCode=1;}
finally{await context?.close();await browser.close();writeFileSync(out+phase+'-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({phase,passed:result.passed,checks:result.checks,failure:result.failure,errors:result.errors,lastPage:result.lastPage,geometry:result.geometry},null,2));}
