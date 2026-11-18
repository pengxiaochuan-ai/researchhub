// Local read-only diagnosis; DOM probes exist only in this isolated browser.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out='docs/testing/evidence/k01-dom-stability-'+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const rows=[],checks=[],errors=[],writes=[],contexts=[];let stage='setup',actor='';
async function readOnly(ctx,role){
 await ctx.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(['http:','https:'].includes(u.protocol)&&u.host!=='127.0.0.1:19501')return route.abort();if(u.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method())){writes.push({actor:role,stage,path:u.pathname,method:r.method()});return route.abort();}if(u.pathname==='/api/auth/me'&&r.frame()?.parentFrame())await new Promise(resolve=>setTimeout(resolve,250));return route.continue();});
}
async function login(ctx,role){assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}})).status(),201);}
async function measure(page,label){
 const geometry=await page.evaluate(()=>{const rect=s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}:null;};return{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport.scale,scroll:document.documentElement.scrollWidth,header:rect('.global-platform-header'),sidebar:rect('.qiyan-platform-sidebar'),main:rect('main'),frame:rect('iframe'),title:rect('.qiyan-page-title'),toolbar:rect('.knowledge-host-toolbar')};});
 rows.push({actor,stage:label,geometry});await page.screenshot({path:out+'/'+actor+'-'+label+'.png',fullPage:true});return geometry;
}
try{
 for(actor of ['owner','admin']){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video/'+actor}});contexts.push(ctx);
  await login(ctx,actor);await readOnly(ctx,actor);
  await ctx.addInitScript(()=>{
   window.__domFailures=[];
   const original=Node.prototype.removeChild;
   Node.prototype.removeChild=function(child){
    if(child.parentNode!==this){const node=n=>n?{tag:n.nodeName,class:n.className??'',slot:n.getAttribute?.('data-platform-header-slot'),sidebar:n.getAttribute?.('data-platform-sidebar-slot')}:null;
     window.__domFailures.push({url:location.pathname,parent:node(this),child:node(child),actualParent:node(child.parentNode),document:child.ownerDocument?.URL,at:performance.now(),stack:new Error('DOM_OWNERSHIP_MISMATCH').stack});}
    return original.call(this,child);
   };
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push({actor,stage,message:e.message,stack:e.stack}));
  for(const mode of ['read','manage']){
   if(actor==='owner'&&mode==='manage')continue;
   stage=mode+'-initial';await page.goto(base+'/pages/k01/'+(mode==='manage'?'?mode=manage':''),{waitUntil:'networkidle'});
   await page.locator('.global-platform-header').waitFor();await page.screenshot({path:out+'/'+actor+'-'+mode+'-before.png',fullPage:true});
   const before=await page.evaluate(()=>({headerSlot:!!document.querySelector('[data-platform-header-slot]'),sidebarSlot:!!document.querySelector('[data-platform-sidebar-slot]'),legacySidebar:!!document.querySelector('aside.platform-side'),headers:document.querySelectorAll('.global-platform-header').length,sidebars:document.querySelectorAll('.qiyan-platform-sidebar').length}));
   rows.push({actor,stage,before});
   if(mode==='read'&&process.argv.includes('--refresh')){
    const search=page.frameLocator('iframe').getByPlaceholder(/搜索当前知识库内容/);
    await search.fill('稳定性核对');
    const originalFrame=await page.locator('iframe').elementHandle();
    for(const type of ['Header','Sidebar'])for(let iteration=0;iteration<3;iteration++){
     stage=type+'-forced-refresh-'+iteration;
     await page.evaluate(async({type,iteration})=>{
     const runtime=(await import('/@react-refresh')).default;
     const previous=await import('/pages/shared/Shell.jsx');
     // Same family id as the served Vite transform, new signature forces a remount.
     const Component=previous[type];
     function Remounted(props){return Component(props);}
     runtime.setSignature(Remounted,'k01-'+type+'-remount-probe-'+iteration,true);
     runtime.register(Remounted,'/Users/mac/aisciencesys/researchhub/pages/shared/Shell.jsx '+type);
     runtime.performReactRefresh();
     },{type,iteration}).catch(e=>errors.push({actor,stage,message:e.message,stack:e.stack}));
     if(process.argv.includes('--verify')){
      await page.locator('[data-platform-header-slot] > .global-platform-header').waitFor();
      await page.locator('[data-platform-sidebar-slot] > .qiyan-platform-sidebar').waitFor();
      assert.equal(await page.locator('.global-platform-header').count(),1);
      assert.equal(await page.locator('.qiyan-platform-sidebar').count(),1);
      assert.equal(await originalFrame.evaluate(e=>e===document.querySelector('iframe')),true,'shell refresh must not replace knowledge frame');
      assert.equal(await search.inputValue(),'稳定性核对','shell refresh must not discard current input');
      checks.push({actor,stage,oneHeader:true,oneSidebar:true,sameFrame:true,inputPreserved:true});
     }
    }
    const failures=await page.evaluate(()=>window.__domFailures);rows.push({actor,stage,failures});
    await page.screenshot({path:out+'/'+actor+'-refresh-after.png',fullPage:true});
    if(process.argv.includes('--verify')){
     stage='public-controls-after-refresh';
     await page.getByRole('button',{name:'打开用户菜单',exact:true}).click();
     assert.equal(await page.locator('dialog[open]').count(),1);
     await page.getByRole('button',{name:'关闭',exact:true}).click();
     if(actor==='admin'){
      stage='admin-mode-switch';await page.getByRole('button',{name:'知识库治理',exact:true}).click();
      await page.frameLocator('iframe').getByText('治理模式',{exact:false}).waitFor();
      assert.match(await page.locator('iframe').getAttribute('src'),/mode=manage/);
      await page.getByRole('button',{name:'返回资料模式',exact:true}).click();
      await page.frameLocator('iframe').getByText('资料模式',{exact:false}).waitFor();
      await page.waitForLoadState('networkidle');
     }else assert.equal(await page.getByRole('button',{name:'知识库治理',exact:true}).count(),0);
     checks.push({actor,stage:'menu-and-original-mode-controls',passed:true});
    }
   }
   if(process.argv.includes('--visual'))for(const [width,height]of [[1440,900],[1366,768],[1920,1200]]){
    await page.setViewportSize({width,height});await page.locator('iframe').waitFor();
    const m=await measure(page,mode+'-'+width);assert.equal(m.header.height,64);assert.equal(m.sidebar.width,220);assert.equal(m.main.x,220);assert.equal(m.toolbar.font,'14px');assert(m.scroll<=m.width+1);
   }
  }
  await ctx.close();
  if(process.argv.includes('--visual')){
   stage='native200';const zoom=await(pw.chromium??pw.default.chromium).launchPersistentContext(mkdtempSync(root+'.tmp/k01-dom-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'/video/'+actor+'-zoom'}});contexts.push(zoom);
   const settings=zoom.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');
   await login(zoom,actor);await readOnly(zoom,actor);const p=await zoom.newPage();p.on('pageerror',e=>errors.push({actor,stage,message:e.message,stack:e.stack}));
   await p.goto(base+'/pages/k01/',{waitUntil:'networkidle'});await p.frameLocator('iframe').getByPlaceholder(/搜索当前知识库内容/).waitFor();const m=await measure(p,'native200');assert.equal(m.dpr,2);assert.equal(m.scale,1);
   await p.frameLocator('iframe').getByPlaceholder(/搜索当前知识库内容/).fill('缩放核对');
   const cdp=await zoom.newCDPSession(p),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+'/'+actor+'-native200-viewport.png',Buffer.from(shot.data,'base64'));await cdp.detach();await zoom.close();
  }
 }
 if(process.argv.includes('--verify')){
  assert.equal(rows.flatMap(r=>r.failures??[]).length,0,'React-owned shell nodes must remain attached during remount');
  assert.equal(errors.length,0,'Knowledge page must survive shell component remount');
 }
}catch(e){errors.push({actor,stage,message:e.message,stack:e.stack});process.exitCode=1;}
finally{writeFileSync(out+'/result.json',JSON.stringify({rows,checks,errors,blockedWrites:writes,providerCalls:0,businessWrites:0,at:new Date().toISOString()},null,2));for(const c of contexts)await c.close();await browser.close();console.log(JSON.stringify({evidence:out,rows:rows.length,checks:checks.length,errors:errors.length,domFailures:rows.flatMap(r=>r.failures??[]).length}));}
