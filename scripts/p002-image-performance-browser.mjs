import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const origin=process.env.P002_IMAGE_ORIGIN??'http://127.0.0.1:19501';
const out=process.env.P002_IMAGE_EVIDENCE??`docs/testing/evidence/p002-image-performance-2026-11-20/browser-${Date.now()}`;
// The original audit's routed copy was preserved when its cold filename was
// reused for the after measurement. Require the actual old seven PNG sheets.
const beforePath='.tmp/p002-image-audit-2026-11-20/routed-desktop-cold.json';
const before=JSON.parse(await fs.readFile(beforePath,'utf8'));
assert.equal(new Set(before.network.filter(row=>/\/reference-[1-7]\.png(?:\?|$)/.test(row.url)).map(row=>row.url)).size,7,'original baseline contains all seven old reference sheets');
const ids=['home','process','assets','community','growth','audience','join'];
await fs.mkdir(path.join(out,'video'),{recursive:true});
await fs.copyFile(beforePath,path.join(out,'original-baseline.json'));
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',recordVideo:{dir:path.join(out,'video'),size:{width:1440,height:1000}}});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
await cdp.send('Network.enable');
const errors=[],writes=[],failed=[],network=new Map(),stages=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push({method:request.method(),url:request.url()});});
page.on('requestfailed',request=>failed.push({url:request.url(),type:request.resourceType(),message:request.failure()?.errorText}));
cdp.on('Network.requestWillBeSent',event=>network.set(event.requestId,{url:event.request.url,type:event.type,start:event.timestamp}));
cdp.on('Network.responseReceived',event=>{const row=network.get(event.requestId);if(row)Object.assign(row,{status:event.response.status,mime:event.response.mimeType,cache:!!(row.cache||event.response.fromDiskCache||event.response.fromPrefetchCache),cacheControl:event.response.headers['Cache-Control']??event.response.headers['cache-control']});});
cdp.on('Network.requestServedFromCache',event=>{const row=network.get(event.requestId);if(row)row.cache=true;});
cdp.on('Network.loadingFinished',event=>{const row=network.get(event.requestId);if(row)Object.assign(row,{encodedBytes:event.encodedDataLength,end:event.timestamp});});

async function ready(){
 await page.locator('#process-cards button').first().waitFor();
 await page.waitForLoadState('networkidle');
 await page.waitForFunction(()=>!document.querySelector('[data-academic-activities] [role="status"]'));
 await page.waitForFunction(()=>[...document.querySelectorAll('.source-crop')].filter(frame=>{const r=frame.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}).every(frame=>{const image=frame.querySelector('img');return image?.complete&&image.naturalWidth>0;}));
 await page.evaluate(()=>document.fonts.ready);
}
async function snapshot(name){
 const dom=await page.evaluate(()=>({
  viewport:{width:innerWidth,height:innerHeight},scrollY,scrollWidth:document.documentElement.scrollWidth,
  sections:[...document.querySelectorAll('section.section')].map(section=>{const r=section.getBoundingClientRect();return{id:section.id,top:r.top,bottom:r.bottom,height:r.height,background:getComputedStyle(section).backgroundImage,after:getComputedStyle(section,'::after').backgroundImage};}),
  crops:[...document.querySelectorAll('.source-crop')].map(frame=>{const r=frame.getBoundingClientRect(),s=frame.closest('section'),sr=s?.getBoundingClientRect()??r,image=frame.querySelector('img');return{section:s?.id??'outside',src:image?.currentSrc??'',setSrc:image?.getAttribute('src'),naturalWidth:image?.naturalWidth??0,complete:image?.complete??false,state:frame.dataset.imageState,visible:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight,sectionNear:sr.top<=innerHeight+240&&sr.bottom>=-240};}),
  resources:performance.getEntriesByType('resource').filter(row=>/\.(png|webp)(?:\?|$)/.test(row.name)).map(row=>({url:row.name,transfer:row.transferSize,encoded:row.encodedBodySize,duration:row.duration,initiator:row.initiatorType})),
  headings:[...document.querySelectorAll('main h1,main h2')].map(node=>({text:node.textContent,font:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight})),
 }));
 const images=[...network.values()].filter(row=>row.type==='Image');
 const value={name,...dom,network:images,totalImageBytes:images.reduce((sum,row)=>sum+(row.encodedBytes??0),0),uniqueImages:images.length};
 stages.push(value);await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(value,null,2));await page.screenshot({path:path.join(out,name+'.png')});return value;
}
function noLegacyImages(stage){
 assert(stage.network.every(row=>row.status===200),'every requested image/background actually returned HTTP 200');
 assert(!stage.network.some(row=>/\/reference-[1-7]\.png(?:\?|$)/.test(row.url)),'reference sheets must not be requested');
 assert(!stage.network.some(row=>/\/(?:hero-background|section-background|join-background|hero-wheel-transparent)\.png(?:\?|$)/.test(row.url)),'optimized backgrounds/wheel must replace old PNG requests');
 assert(stage.crops.filter(crop=>crop.visible).every(crop=>crop.naturalWidth>0&&crop.state==='loaded'),'visible crop windows have actually loaded images');
 assert(stage.scrollWidth<=stage.viewport.width+1,'page horizontal geometry preserved');
}

try{
 await page.goto(origin+'/pages/p002/',{waitUntil:'networkidle'});await ready();
 const cold=await snapshot('desktop-cold');noLegacyImages(cold);
 assert.equal(cold.crops.length,47,'all original crop elements remain');
 assert(cold.crops.filter(crop=>!crop.sectionNear).every(crop=>!crop.setSrc),'far sections have no image src before approaching them');
 assert(cold.crops.some(crop=>!crop.sectionNear),'deferred sections exist in the first-screen fixture');
 assert(cold.totalImageBytes<before.totalImageBytes*.25,'first-screen transferred images must be substantially smaller than the original');
 checks.push({kind:'cold-first-screen',beforeBytes:before.totalImageBytes,afterBytes:cold.totalImageBytes,legacyReferencesRequested:0,deferredCrops:cold.crops.filter(crop=>!crop.setSrc).length});

 for(const id of ids.slice(1)){
  await page.locator('#'+id).scrollIntoViewIfNeeded();await ready();
  const stage=await snapshot('scroll-'+id);noLegacyImages(stage);
  const inSection=stage.crops.filter(crop=>crop.section===id);
  assert(inSection.length>0,id+' has crop windows');assert(inSection.every(crop=>crop.naturalWidth>0&&crop.state==='loaded'),id+' loads its complete crop set when approached');
  checks.push({kind:'section-load',id,loaded:inSection.length,imageRequests:stage.uniqueImages,totalImageBytes:stage.totalImageBytes});
 }
 await page.locator('footer').scrollIntoViewIfNeeded();await ready();
 const full=await snapshot('scroll-footer');noLegacyImages(full);
 assert(full.crops.every(crop=>crop.naturalWidth>0),'visiting all seven sections and footer loads all original crop elements');
 assert(full.totalImageBytes<before.totalImageBytes*.5,'whole-page image transfer must stay below half the original first-screen total');
 checks.push({kind:'footer-and-all-crops',loaded:full.crops.length,totalImageBytes:full.totalImageBytes});
 const requestedBeforeReturn=network.size;
 await page.locator('#home').scrollIntoViewIfNeeded();await ready();
 assert.equal(network.size,requestedBeforeReturn,'returning to an already loaded section makes no extra requests');
 checks.push({kind:'scroll-back-no-refetch'});
 await page.screenshot({path:path.join(out,'desktop-return-home.png')});

 network.clear();await page.goto(origin+'/pages/p002/',{waitUntil:'networkidle'});await ready();
 const revisit=await snapshot('desktop-revisit');noLegacyImages(revisit);
 const derivative=revisit.network.filter(row=>/\/assets\/(?:crops|optimized)\//.test(row.url));
 assert(derivative.length>0,'real hashed derivative requests were observed');
 if(process.env.P002_IMAGE_EXPECT_IMMUTABLE==='1'){
  assert(derivative.every(row=>row.cacheControl==='public, max-age=31536000, immutable'),'actual production static process exposes immutable only on hash derivatives');
  assert(derivative.every(row=>row.cache),'second navigation uses actual browser cache');
 }
 checks.push({kind:'second-navigation-cache-observed',immutableExpected:process.env.P002_IMAGE_EXPECT_IMMUTABLE==='1',derivativeImages:derivative.length,fromCache:derivative.filter(row=>row.cache).length,transferBytes:revisit.totalImageBytes});
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 // The existing activity loader deliberately aborts its first GET on pageshow
 // before loading the current one. Keep those observed cancellations in evidence.
 const expectedActivityCancellations=failed.filter(row=>row.type==='fetch'&&row.message==='net::ERR_ABORTED'&&new URL(row.url).pathname==='/api/public/hubs/lingshu-xinyu/academic-content');
 assert.deepEqual(failed.filter(row=>!expectedActivityCancellations.includes(row)),[],'no image or unexpected request failure');
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,at:new Date().toISOString(),origin,scope:'Read-only public P002 Chrome; no authentication, business writes, deploy or restart',viewport:{width:1440,height:1000},checks,errors,writes,failed,expectedActivityCancellations,stages:stages.map(({crops,network,resources,...summary})=>summary)},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,coldBytes:cold.totalImageBytes,fullBytes:full.totalImageBytes,beforeBytes:before.totalImageBytes}));
}catch(error){
 await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
 await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,errors,writes,failed},null,2));
 console.error(error.stack);process.exitCode=1;
}finally{await context.close();await browser.close();}
