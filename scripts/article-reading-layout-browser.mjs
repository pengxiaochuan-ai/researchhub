// Read existing authorized answers and exercise local input only. Never send AI.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const baseline=process.argv.includes('--baseline');
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const article='pmc-PMC13522945';
const url=base+'/pages/ai01/?'+new URLSearchParams({articleId:article,requestKey:'article-427fdb2e-8abd-4125-9ed6-06eb2b57f888',inputHash:'8a45932fdc5939bc7d8e76722882da17e959e989d4f4d39a902ca130e1980be5'});
const out='docs/testing/evidence/article-reading-layout-'+(baseline?'before-':'after-')+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],checks=[],errors=[],writes=[],consoleErrors=[];
let page;
const measure=async p=>p.locator('.article-workspace').evaluate(el=>{
 const rect=s=>{const e=el.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return{top:r.top,bottom:r.bottom,width:r.width,height:r.height,font:c.fontSize,line:c.lineHeight,scroll:e.scrollHeight,client:e.clientHeight,overflow:c.overflowY};};
 return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},thread:rect('.thread'),composer:rect('.composer'),input:rect('textarea'),answer:rect('.hub-agent-answer'),banner:!!document.querySelector('[data-demo-capability]'),horizontal:document.documentElement.scrollWidth>innerWidth+1};
});
const settle=p=>p.locator('textarea').evaluate(e=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(e.clientHeight)))));
try{
 for(const username of baseline?['admin@example.org']:['admin@example.org','owner@example.org']){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});contexts.push(ctx);
  const login=await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username,password:rt.password}});assert.equal(login.status(),201);
  await ctx.route('**/api/**',route=>{if(!['GET','HEAD'].includes(route.request().method())){writes.push(new URL(route.request().url()).pathname);return route.abort();}return route.continue();});
  page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  const admin=username.startsWith('admin');await page.goto(admin?url:base+'/pages/ai01/?articleId='+article);
  await page.locator('.article-workspace').waitFor();const box=page.getByLabel('本篇研究问题（2–100字）');await box.waitFor({state:'visible'});
  if(admin)await page.locator('.hub-agent-answer').waitFor();
  else await page.getByRole('status').filter({hasText:'尚未发送'}).waitFor();
  await box.fill('核对本篇');await settle(page);
  const short=admin?await measure(page):null;
  await page.screenshot({path:out+'/'+(admin?'admin':'owner')+'-1440-short.png',fullPage:true});
  await box.fill('研究类型\n主要发现\n方法局限\n参考价值');await settle(page);const tall=await box.evaluate(e=>e.getBoundingClientRect().height);
  await box.fill(Array.from({length:12},(_,i)=>'第'+(i+1)+'行').join('\n'));await settle(page);
  const capped=await box.evaluate(e=>({height:e.getBoundingClientRect().height,client:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY}));
  await page.screenshot({path:out+'/'+(admin?'admin':'owner')+'-1440-multiline.png',fullPage:true});
  await box.fill('核对本篇');await box.press('Enter');await box.press('Shift+Enter');await settle(page);assert.equal(await box.inputValue(),'核对本篇\n\n');
  await box.fill('核对本篇');await settle(page);const shrunk=await box.evaluate(e=>e.getBoundingClientRect().height);
  checks.push({username,short,tall,capped,shrunk});
  if(!baseline){assert.equal(await page.locator('[data-demo-capability]').count(),0);assert.equal(shrunk,60);assert(tall>shrunk);assert(capped.height<=148&&capped.scroll>capped.client);assert.equal(capped.overflow,'auto');assert.equal(await box.getAttribute('maxlength'),'100');
   if(admin){assert.equal(short.answer.font,'16px');assert.equal(short.answer.line,'28px');assert(short.composer.height<190);assert(short.thread.height>350);}
   await box.focus();assert.notEqual(await box.evaluate(e=>getComputedStyle(e).outlineStyle),'none');await box.press('Tab');assert.equal(await page.locator(':focus').innerText(),'发送本篇问题');
  }
  if(admin&&!baseline){
   await page.setViewportSize({width:1920,height:1200});await box.fill('请核对研究类型与局限。'.repeat(5));await settle(page);const wide=await box.evaluate(e=>e.clientHeight);
   await page.setViewportSize({width:320,height:844});await settle(page);const narrow=await box.evaluate(e=>({height:e.clientHeight,value:e.value}));assert(narrow.height>wide);assert.equal(narrow.value,'请核对研究类型与局限。'.repeat(5));
   await page.setViewportSize({width:1920,height:1200});await settle(page);assert.equal(await box.evaluate(e=>e.clientHeight),wide);checks.push('same-controlled-value-reflows-and-shrinks-on-column-width-change_without-input');
  }
  if(admin)for(const [width,height]of [[1366,768],[1920,1200],[390,844],[320,844]]){
   await page.setViewportSize({width,height});await settle(page);await box.fill('请核对研究类型、主要发现与方法局限。');await settle(page);
   const m=await measure(page);checks.push({width,height,...m});
   await page.getByRole('button',{name:'发送本篇问题',exact:true}).scrollIntoViewIfNeeded();
   if(!baseline)assert(await page.getByRole('button',{name:'发送本篇问题',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
   await page.screenshot({path:out+'/admin-'+width+'x'+height+'.png',fullPage:true});
   if(!baseline){assert(!m.banner);assert(!m.horizontal);assert.equal(m.input.font,'14px');assert.equal(m.input.line,'22px');assert(m.thread.bottom<=m.composer.top+1);}
  }
  if(admin&&!baseline){await page.setViewportSize({width:1440,height:900});await page.reload();await page.locator('.hub-agent-answer').waitFor();await settle(page);checks.push({refresh:await measure(page)});assert((await box.inputValue()).length>0);assert.equal(await page.locator('[data-demo-capability]').count(),0);
   const last=page.locator('.hub-agent-answer p').last();await last.scrollIntoViewIfNeeded();assert(await last.evaluate(e=>{const r=e.getBoundingClientRect(),t=e.closest('.thread').getBoundingClientRect();return r.top>=t.top&&r.bottom<=t.bottom+1;}));await page.screenshot({path:out+'/admin-reading-bottom.png',fullPage:true});
   await page.goto(base+'/pages/ai01/');await page.getByRole('heading',{name:'Hub 已审核来源问答',exact:true}).waitFor();assert.equal(await page.locator('[data-demo-capability]').count(),0);
   await page.goto(base+'/pages/p01/');await page.locator('[data-demo-capability]').waitFor();checks.push('AI01-general-also-no-development-banner_P01-banner-unchanged');
  }
 }
 if(!baseline){
  const demo=await browser.newContext({viewport:{width:1440,height:900}});contexts.push(demo);await demo.addInitScript(()=>sessionStorage.setItem('lingshu-demo-mode','true'));
  const dp=await demo.newPage();await dp.goto(base+'/pages/ai01/');await dp.locator('[data-demo-capability]').waitFor();assert.equal(await dp.locator('.real-ai-workspace').count(),0);checks.push('explicit-demo-keeps-demo-banner');
  const zoom=await(pw.chromium??pw.default.chromium).launchPersistentContext(mkdtempSync(root+'.tmp/article-reading-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'/zoom-video'}});contexts.push(zoom);
  await zoom.pages()[0].goto('chrome://settings/appearance');await zoom.pages()[0].locator('#zoomLevel').selectOption('2');assert.equal((await zoom.request.post(base+'/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}})).status(),201);
  await zoom.route('**/api/**',route=>{if(!['GET','HEAD'].includes(route.request().method())){writes.push(new URL(route.request().url()).pathname);return route.abort();}return route.continue();});
  page=await zoom.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('.hub-agent-answer').waitFor();const box=page.getByLabel('本篇研究问题（2–100字）');await box.fill('第一行\n第二行\n第三行\n第四行');await settle(page);await box.scrollIntoViewIfNeeded();
  const m=await measure(page),scale=await page.evaluate(()=>visualViewport.scale);assert.equal(m.viewport.dpr,2);assert.equal(scale,1);assert(!m.horizontal);assert(!m.banner);assert.equal(m.input.font,'14px');assert(m.input.height>60);assert(m.input.height<=Math.max(60,m.viewport.height*.2)+1);checks.push({native200:m,scale});
  await box.focus();await box.press('Tab');assert.equal(await page.locator(':focus').innerText(),'发送本篇问题');assert(await page.locator(':focus').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=64&&r.bottom<=innerHeight+1&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));checks.push('native200-send-button-reachable-by-keyboard-without-submitting');
  await page.screenshot({path:out+'/native200-viewport.png'});const cdp=await zoom.newCDPSession(page),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+'/native200.png',Buffer.from(shot.data,'base64'));await cdp.detach();
 }
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 assert.deepEqual(consoleErrors,[]);
 writeFileSync(out+'/result.json',JSON.stringify({passed:!baseline,baselineOnly:baseline,checks,errors,consoleErrors,blockedWriteAttempts:writes,providerCalls:0,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:!baseline,baselineOnly:baseline,evidence:out,checks}));
}catch(e){await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});writeFileSync(out+'/failure.json',JSON.stringify({error:e.message,checks,errors,writes},null,2));console.error(JSON.stringify({passed:false,error:e.message,evidence:out}));process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();}
