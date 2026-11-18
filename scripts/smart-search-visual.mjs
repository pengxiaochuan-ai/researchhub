// Read-only real result/zoom checks. No command submission or model invocation.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/smart-search-2026-11-12/visual',{ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),task=JSON.parse(readFileSync('.tmp/smart-search-2026-11-12/live/followup.json'));
mkdirSync(out+'/video',{recursive:true});const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium??pw.default.chromium,metrics=[],errors=[];
const login=async ctx=>assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/p003/'},data:{tenantSlug:ids.tenant,username:'owner@example.org',password}})).status(),201);
const url=base+'/pages/ai01/?sessionId='+task.sessionId;
const measure=page=>page.evaluate(()=>({viewport:{inner:innerWidth,outer:outerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,scroll:document.documentElement.scrollWidth},input:{font:getComputedStyle(document.querySelector('.composer textarea')).fontSize,line:getComputedStyle(document.querySelector('.composer textarea')).lineHeight},button:{font:getComputedStyle(document.querySelector('.composerTools button[aria-pressed]')).fontSize,line:getComputedStyle(document.querySelector('.composerTools button[aria-pressed]')).lineHeight},reading:{font:getComputedStyle(document.querySelector('.hub-agent-answer p')).fontSize,line:getComputedStyle(document.querySelector('.hub-agent-answer p')).lineHeight},externalSourceLinks:document.querySelectorAll('.hub-agent-answer a[href^="https://"]').length}));
const browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});await login(ctx);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('.hub-agent-answer').last().waitFor();
 for(const [width,height]of [[1440,1000],[1366,768],[390,844]]){
  await page.setViewportSize({width,height});const button=page.getByRole('button',{name:'智能搜索',exact:true});await button.scrollIntoViewIfNeeded();await button.focus();
  const m=await measure(page);assert(m.viewport.scroll<=m.viewport.inner+1);assert.deepEqual(m.input,{font:'14px',line:'22px'});assert.deepEqual(m.button,{font:'14px',line:'22px'});assert.deepEqual(m.reading,{font:'16px',line:'28px'});assert(m.externalSourceLinks>0);metrics.push({width,...m});await page.screenshot({path:out+'/'+width+'.png'});
 }
 await ctx.close();
}finally{await browser.close();}
const profile=mkdtempSync(root+'researchhub/.tmp/smart-search-native-zoom-'),zoom=await chrome.launchPersistentContext(profile,{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'/video',size:{width:1440,height:1000}}});
try{
 const settings=zoom.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');await login(zoom);const page=await zoom.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('.hub-agent-answer').last().waitFor();const button=page.getByRole('button',{name:'智能搜索',exact:true});await button.scrollIntoViewIfNeeded();await button.focus();
 const m=await measure(page);assert.equal(m.viewport.dpr,2);assert.equal(m.viewport.scale,1);assert(m.viewport.inner<m.viewport.outer/2+20);assert(m.viewport.scroll<=m.viewport.inner+1);assert.equal(await button.getAttribute('aria-pressed'),'false');
 assert(await button.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
 metrics.push({nativeChromeZoom:200,...m});const cdp=await zoom.newCDPSession(page),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+'/native200.png',Buffer.from(shot.data,'base64'));await cdp.detach();
}finally{await zoom.close();}
assert.deepEqual(errors,[]);writeFileSync(out+'/result.json',JSON.stringify({passed:true,newModelCalls:0,metrics,errors},null,2));console.log(JSON.stringify({passed:true,newModelCalls:0,viewports:metrics.length,nativeChromeZoom:200}));
