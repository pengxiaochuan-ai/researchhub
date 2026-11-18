// Read-only P1 native Chrome 200% check. No source review writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/docs/testing/evidence/governance-p1-source-2026-11-12/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const context=await chromium.launchPersistentContext(mkdtempSync(root+'.tmp/p1-source-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
const result={errors:[],businessWrites:[]};
try{
 const settings=context.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');
 assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 context.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')&&!path.startsWith('/api/auth/')&&r.method()!=='GET')result.businessWrites.push({path,method:r.method()});});
 const response=await context.request.get(base+'/api/hub-sources/review-queue');assert.equal(response.status(),200);const queue=await response.json(),item=queue.items.find(x=>x.kind==='external'&&x.state.status!=='unavailable');assert(item);
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));await page.goto(base+'/pages/g02/?'+new URLSearchParams({view:'source-review',reviewKey:item.key}));
 const select=page.getByLabel('本次可见范围',{exact:true});await select.waitFor();await select.scrollIntoViewIfNeeded();
 result.dom=await select.evaluate(n=>({width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,scroll:document.documentElement.scrollWidth,font:getComputedStyle(n).fontSize,rect:n.getBoundingClientRect().toJSON()}));
 assert.equal(result.dom.dpr,2);assert.equal(result.dom.scale,1);assert.equal(result.dom.font,'14px');assert(result.dom.scroll<=result.dom.width+1);assert(result.dom.rect.width>150);
 await page.screenshot({path:out+'native200.png'});
 const cdp=await context.newCDPSession(page),layout=await cdp.send('Page.getLayoutMetrics');
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true,clip:{x:0,y:0,width:layout.contentSize.width,height:layout.contentSize.height,scale:1}});
 writeFileSync(out+'native200-full.png',Buffer.from(shot.data,'base64'));
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1;}
finally{await context.close();writeFileSync(out+'native200-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
