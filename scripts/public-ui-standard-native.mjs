import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/testing/evidence/public-ui-standard-2026-11-19/';
const baseline=JSON.parse(await fs.readFile(out+'before.json','utf8'));
const profile=await fs.mkdtemp('.tmp/public-ui-native-');
const c=await pw.chromium.launchPersistentContext(profile,{headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:null,args:['--window-size=1440,1000'],recordVideo:{dir:out+'native-video',size:{width:1440,height:1000}}});
const checks=[],errors=[],writes=[];
try{
 const p=c.pages()[0];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
 const settings=await c.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await p.bringToFront();
 const cd=await c.newCDPSession(p);
 for(const [key,url,ready] of baseline.cases){
  await p.goto('http://127.0.0.1:19501'+url);await p.locator(ready).first().waitFor();await p.locator('main img').evaluateAll(es=>Promise.all(es.map(e=>e.decode().catch(()=>{}))));
  const m=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dpr:devicePixelRatio,scale:visualViewport.scale,title:[...document.querySelectorAll('main h1')].map(e=>getComputedStyle(e).fontSize),controls:[...document.querySelectorAll('main input,main button')].map(e=>getComputedStyle(e).fontSize),overflow:[...document.querySelectorAll('main p,main h1,main h2,main h3,main a,main input,main button')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1).map(e=>e.className)}));
  assert.equal(m.width,720);assert.equal(m.scroll,720);assert.equal(m.dpr,2);assert.equal(m.scale,1);assert.deepEqual(m.overflow,[]);assert(m.controls.every(x=>x==='16px'));
  const data=await cd.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});await fs.writeFile(out+'native200-'+key+'.png',Buffer.from(data.data,'base64'));checks.push({key,...m});
 }
 await p.goto('http://127.0.0.1:19501/pages/p008/');await p.getByPlaceholder('搜索注册、课题、访视、文献或资产').fill('课题');assert(await p.locator('.ls-help-card').count()>0);await p.getByRole('button',{name:'全部',exact:true}).press('Tab');assert(await p.evaluate(()=>document.activeElement.tagName==='BUTTON'));
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await fs.writeFile(out+'native200.json',JSON.stringify({passed:true,checks,keyboardAndSearch:true,errors,writes},null,2));console.log(JSON.stringify({passed:true,cases:checks.length,actualWidth:720,dpr:2}));
}finally{await c.close();await fs.rm(profile,{recursive:true,force:true});}
