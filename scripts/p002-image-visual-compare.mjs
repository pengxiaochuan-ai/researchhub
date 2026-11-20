import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const origin='http://127.0.0.1:19501';
const out=`docs/testing/evidence/p002-image-performance-2026-11-20/visual-${Date.now()}`;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const snapshots={},writes=[],errors=[];
try{
 for(const mode of['reconstructed-before','after']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
  if(mode==='reconstructed-before'){
   const replacements=new Map(await Promise.all(['app.js','crop-image.js','styles.css'].map(async name=>[name,await fs.readFile(`.tmp/p002-image-performance-2026-11-20/before-${name}`,'utf8')])));
   await context.route('**/pages/p002/**',async route=>{
    const pathname=new URL(route.request().url()).pathname,name=pathname.split('/').at(-1);
    if(replacements.has(name))return route.fulfill({status:200,contentType:name.endsWith('.css')?'text/css':'application/javascript',body:replacements.get(name)});
    if(pathname==='/pages/p002/'||pathname==='/pages/p002/index.html'){
     const response=await route.fetch();const html=(await response.text()).replace(/data-portal-wheel\b/,'src="assets/hero-wheel-transparent.png" data-portal-wheel');
     return route.fulfill({response,body:html});
    }
    return route.continue();
   });
  }
  const page=await context.newPage();page.on('pageerror',error=>errors.push({mode,message:error.message}));page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push({mode,method:request.method(),url:request.url()});});
  await page.goto(origin+'/pages/p002/',{waitUntil:'networkidle'});
  await page.locator('#process-cards button').first().waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-academic-activities] [role="status"]'));
  snapshots[mode]=[];
  for(const id of['home','process','assets','community','growth','audience','join']){
   await page.locator('#'+id).scrollIntoViewIfNeeded();await page.waitForLoadState('networkidle');
   await page.waitForFunction(()=>[...document.querySelectorAll('.source-crop')].filter(frame=>{const r=frame.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).every(frame=>{const image=frame.querySelector('img');return image?.complete&&image.naturalWidth>0;}));
   await page.locator('#'+id).evaluate(async section=>{
    await Promise.all([...section.querySelectorAll('img')].map(image=>image.decode()));
    await Promise.all(section.getAnimations({subtree:true}).filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   });
   await page.evaluate(()=>document.fonts.ready);
   const geometry=await page.evaluate(()=>{
    const rect=node=>{const r=node.getBoundingClientRect(),style=getComputedStyle(node);return{x:r.x,y:r.y,width:r.width,height:r.height,font:style.fontSize,line:style.lineHeight};};
    return{width:innerWidth,height:innerHeight,scrollY,scrollWidth:document.documentElement.scrollWidth,
     sections:[...document.querySelectorAll('section.section')].map(node=>({id:node.id,...rect(node)})),
     frames:[...document.querySelectorAll('.source-crop')].map(rect),
     copy:[...document.querySelectorAll('main h1,main h2,main h3,main p:not([data-academic-activities] p),.button')].filter(node=>!node.closest('[data-academic-activities]')).map(node=>({text:node.textContent,...rect(node)}))};
   });
   await page.screenshot({path:path.join(out,mode+'-'+id+'.png')});snapshots[mode].push({id,...geometry});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 assert.deepEqual(snapshots.after,snapshots['reconstructed-before'],'all seven screens preserve section/frame/copy geometry and text');
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,scope:'1440x1000 real Chrome, reduced motion; before reconstructed only through exact inverse source responses, not a historical screenshot; no cache claims from routed context',screens:7,geometryIdentical:true,writes,errors,snapshots},null,2));
 console.log(JSON.stringify({passed:true,evidence:out,screens:7,geometryIdentical:true}));
}catch(error){await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,writes,errors,snapshots},null,2));console.error(error.stack);process.exitCode=1;}
finally{await browser.close();}
