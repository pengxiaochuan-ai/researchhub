// MV03 read/play-only after the exact six uploads. Isolated Chrome profile, real browser zoom.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--approved-mv03']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',out=root+'researchhub/.tmp/ai-video-2026-11-16/live/';
const checkpoint=JSON.parse(readFileSync(out+'checkpoint.json')),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.equal(checkpoint.scope,'MV03-six-synthetic-videos-20261116');assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
const actor=checkpoint.actors.owner;assert.equal(Object.values(actor.files).filter(x=>x.completed).length,3);
const {default:pw}=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const profile=await mkdtemp(join(tmpdir(),'rh-mv03-native-zoom-'));mkdirSync(out+'native-zoom',{recursive:true});let context;
try{
 context=await pw.chromium.launchPersistentContext(profile,{headless:false,viewport:null,args:['--window-size=1440,1000'],recordVideo:{dir:out+'native-zoom'},executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const r=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}});assert.equal(r.status(),201);
 const page=context.pages()[0],writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route(base+'/api/**',route=>{const q=route.request();if(q.method()!=='GET'&&!q.url().endsWith('/auth/renew')){writes.push(new URL(q.url()).pathname);return route.abort();}return route.continue();});
 await page.goto(base+'/pages/ai01/?sessionId='+actor.sessionId);await page.getByText('本会话视频 · 3份',{exact:true}).waitFor();
 const metrics=()=>page.evaluate(()=>({innerWidth,outerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,visualWidth:visualViewport.width,visualHeight:visualViewport.height,mediaTop:document.querySelector('.agent-media').getBoundingClientRect().top,scrollWidth:document.documentElement.scrollWidth,mediaWidth:document.querySelector('.agent-media').getBoundingClientRect().width}));
 const before=await metrics();await page.screenshot({path:out+'native-zoom/100.png'});
 const settings=await context.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('select#zoomLevel').selectOption('2');assert.equal(await settings.locator('select#zoomLevel').inputValue(),'2');
 await page.bringToFront();await page.reload();await page.getByText('本会话视频 · 3份',{exact:true}).waitFor();const after=await metrics();assert.equal(after.dpr,before.dpr*2);assert.equal(after.innerWidth,before.innerWidth/2);
 const play=page.locator('.agent-media').getByRole('button',{name:'播放',exact:true}).first();await play.scrollIntoViewIfNeeded();await play.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>{const v=document.querySelector('.agent-media-player video');return v?.readyState>=2&&v.currentTime>0;});
 await page.locator('.agent-media-player video').scrollIntoViewIfNeeded();await page.waitForTimeout(150);const cdp=await context.newCDPSession(page);const layout=await cdp.send('Page.getLayoutMetrics');writeFileSync(out+'native-zoom/cdp-layout.json',JSON.stringify(layout,null,2)+'\n',{mode:0o600});const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false});writeFileSync(out+'native-zoom/200-browser-view.png',Buffer.from(shot.data,'base64'));await cdp.detach();await page.locator('.agent-media').screenshot({path:out+'native-zoom/200-media.png',scale:'css'});await page.screenshot({path:out+'native-zoom/200.png',fullPage:true,scale:'css'});assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 const result={passed:true,at:new Date().toISOString(),method:'Chrome isolated profile settings Page zoom 200%; no CSS zoom or viewport emulation',before,after,keyboardPlay:true,newUploadRequests:0,errors,existingShellHorizontalOverflow:after.scrollWidth>after.innerWidth};
 writeFileSync(out+'native-zoom/result.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
