import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/docs/testing/evidence/governance-integration-2026-11-12/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
const context=await chromium.launchPersistentContext(mkdtempSync(root+'.tmp/governance-integrated-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000']});
try{
 const settings=context.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');
 assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 const page=await context.newPage();await page.goto(base+'/pages/g02/?governanceModule=ethics');await page.getByRole('link',{name:/查看方案/}).first().waitFor();
 await page.locator('.governance-items h3').first().scrollIntoViewIfNeeded();
 const dom=await page.locator('.governance-items h3').first().evaluate(e=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport.scale,title:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,right:document.querySelector('.governance-overview').getBoundingClientRect().right}));
 assert.equal(dom.dpr,2);assert.equal(dom.scale,1);assert.equal(dom.title,'14px');assert.equal(dom.line,'22px');assert(dom.right<=dom.width+1);
 await page.screenshot({path:out+'native200-full-page.png',fullPage:true});
 const cdp=await context.newCDPSession(page),layout=await cdp.send('Page.getLayoutMetrics');
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true,clip:{x:0,y:0,width:layout.contentSize.width,height:layout.contentSize.height,scale:1}});
 writeFileSync(out+'native200-cdp-full.png',Buffer.from(shot.data,'base64'));
 writeFileSync(out+'native200-layout.json',JSON.stringify({dom,layout},null,2));console.log(JSON.stringify({passed:true,dom}));
}finally{await context.close();}
