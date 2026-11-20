import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const out=`docs/testing/evidence/p002-image-performance-2026-11-20/responsive-${Date.now()}`;
await fs.mkdir(out,{recursive:true});
const profile=await fs.mkdtemp('.tmp/p002-image-zoom-'),checks=[],errors=[],writes=[];
let browser,native;
async function inspect(context,name){
 const page=await context.newPage();page.on('pageerror',error=>errors.push({name,message:error.message}));page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push({name,method:request.method(),url:request.url()});});
 await page.goto('http://127.0.0.1:19501/pages/p002/',{waitUntil:'networkidle'});await page.locator('#process-cards button').first().waitFor();
 for(const id of['home','process','assets','community','growth','audience','join']){
  await page.locator('#'+id).evaluate(section=>section.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForLoadState('networkidle');
  await page.waitForFunction(id=>[...document.querySelectorAll('#'+id+' .source-crop img')].every(image=>image.complete&&image.naturalWidth>0),id);
  await page.locator('#'+id).evaluate(section=>Promise.all([...section.querySelectorAll('img')].map(image=>image.decode())));
  const measure=await page.locator('#'+id).evaluate(section=>({id:section.id,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,dpr:devicePixelRatio,scale:visualViewport.scale,
   crops:[...section.querySelectorAll('.source-crop')].map(frame=>({width:frame.clientWidth,scrollWidth:frame.scrollWidth,state:frame.dataset.imageState,naturalWidth:frame.querySelector('img').naturalWidth})),
   photos:[...section.querySelectorAll('.audience-photo img')].map(image=>({naturalWidth:image.naturalWidth,loaded:image.complete})),
   overflow:[...section.querySelectorAll('.audience-card,h1,h2,h3,p,li')].filter(node=>node.clientWidth&&node.scrollWidth>node.clientWidth+1).map(node=>({tag:node.tagName,class:node.className})),
   wheel:section.querySelector('[data-portal-wheel]')?{naturalWidth:section.querySelector('[data-portal-wheel]').naturalWidth,loaded:section.querySelector('[data-portal-wheel]').complete}:null,
  }));
  assert.equal(measure.width,name==='390'?390:720);assert(measure.scrollWidth<=measure.width+1);assert.deepEqual(measure.overflow,[]);assert(measure.crops.every(crop=>crop.naturalWidth>0&&crop.state==='loaded'&&crop.scrollWidth<=crop.width+1));
  if(measure.wheel)assert(measure.wheel.loaded&&measure.wheel.naturalWidth>0);
  if(name==='native200'){assert.equal(measure.dpr,2);assert.equal(measure.scale,1);const cdp=await context.newCDPSession(page),image=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});await fs.writeFile(path.join(out,name+'-'+id+'.png'),Buffer.from(image.data,'base64'));await cdp.detach();}
  else await page.screenshot({path:path.join(out,name+'-'+id+'.png')});
  checks.push({name,...measure});
 }
 await page.close();
}
try{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const narrow=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await inspect(narrow,'390');await narrow.close();await browser.close();browser=null;
 native=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:null,reducedMotion:'reduce',args:['--window-size=1440,1000']});
 const settings=native.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await inspect(native,'native200');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,checks,errors,writes,nativeZoom:'Chrome settings #zoomLevel=2; 720 CSSpx, DPR2, visualViewport.scale1; physical surface screenshots'},null,2));console.log(JSON.stringify({passed:true,evidence:out,checks:checks.length}));
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,errors,writes},null,2));console.error(error.stack);process.exitCode=1;}
finally{await browser?.close();await native?.close();await fs.rm(profile,{recursive:true,force:true});}
