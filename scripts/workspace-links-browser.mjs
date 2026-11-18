import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const mode=process.argv[2];assert(['before','after'].includes(mode));
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),base='http://127.0.0.1:19501',dir=fileURLToPath(new URL('../docs/testing/workspace-links-2026-11-18/',import.meta.url));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={mode,at:new Date().toISOString(),pages:[],clicks:[],errors:[],businessPosts:0};
for(const username of(mode==='before'?['admin@example.org']:['admin@example.org','owner@example.org'])){
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:dir+'video'}}),page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&!/\/api\/auth\//.test(r.url()))result.businessPosts++;});
 try{
  assert((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username,password:runtime.password}})).ok());
  for(const path of(mode==='before'?['p01','h01']:username.startsWith('admin')?['p01','h01','c01','a01','g02']:['p01','h01'])){
   await page.goto(base+'/pages/'+path+'/');await page.locator('body[data-platform-header="true"]').waitFor();
   if(path==='p01'){await page.getByRole('link',{name:'个人知识库 →',exact:true}).waitFor();if(mode==='after')await page.getByRole('heading',{name:'正在核验我的工作台数据',exact:true}).waitFor({state:'hidden'});}
   else {await page.locator('main a[href]').first().waitFor();if(path==='h01'&&mode==='after')await page.getByText('正在读取领域数据…',{exact:true}).waitFor({state:'hidden'});}
   await page.waitForTimeout(350);
   const links=await page.locator('main a[href]').evaluateAll(links=>links.filter(a=>a.getClientRects().length&&a.textContent.trim()).slice(0,35).map(a=>{const s=getComputedStyle(a),r=a.getBoundingClientRect();return{text:a.textContent.trim(),href:a.getAttribute('href'),decoration:s.textDecorationLine,color:s.color,font:s.fontSize,x:r.x,y:r.y,width:r.width,height:r.height};}));
   assert(links.length>0);if(mode==='after')assert(links.every(a=>!a.decoration.includes('underline')),path+' has underlined entry');
   result.pages.push({username,path,width:1440,links});await page.screenshot({path:dir+mode+'-'+username.split('@')[0]+'-'+path+'.png'});
   if(path==='p01'&&mode==='after'){
    const link=page.getByRole('link',{name:'个人知识库 →',exact:true});await link.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');const focus=await link.evaluate(a=>({visible:a.matches(':focus-visible'),width:getComputedStyle(a).outlineWidth,decoration:getComputedStyle(a).textDecorationLine}));assert(focus.visible);assert.equal(focus.width,'2px');await link.hover();assert.equal(await link.evaluate(a=>getComputedStyle(a).textDecorationLine),'none');result.focus=focus;
    for(const [name,destination]of[['进入领域研究 →','h01'],['个人知识库 →','k01'],['进入 AI ›','ai01']]){await page.goto(base+'/pages/p01/');await page.getByRole('link',{name,exact:true}).click();await page.waitForURL(u=>u.pathname==='/pages/'+destination+'/');result.clicks.push({username,name,destination});}
    for(const width of[1280,390]){await page.setViewportSize({width,height:1000});await page.goto(base+'/pages/p01/');await page.getByRole('link',{name:'个人知识库 →',exact:true}).waitFor();await page.screenshot({path:dir+'after-'+username.split('@')[0]+'-p01-'+width+'.png'});}await page.setViewportSize({width:1440,height:1000});
   }
  }
 }catch(e){result.failure=String(e.message).replace(/cookie: [^\n]*/gi,'cookie: [redacted]');await page.screenshot({path:dir+'failure.png'}).catch(()=>{});throw Error(result.failure);}
 finally{await context.request.post(base+'/api/auth/logout',{headers:{Origin:base,'X-ResearchHub-Request':'session-v1'},data:{}}).catch(()=>{});await context.close();writeFileSync(dir+mode+'.json',JSON.stringify(result,null,2));}
}
await browser.close();assert.deepEqual(result.errors,[]);assert.equal(result.businessPosts,0);result.passed=true;writeFileSync(dir+mode+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,pages:result.pages.length,clicks:result.clicks.length,businessPosts:0}));
