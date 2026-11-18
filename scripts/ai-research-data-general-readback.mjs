// Read-only recovery of the existing named live verification objects.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const source=process.argv[2];assert.match(source??'',/^\.tmp\/ai-file-data-2026-11-12\/p06-general-browser-\d+\/result.json$/);
const original=JSON.parse(readFileSync(source,'utf8')),root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',{ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),out=source.replace('/result.json','')+'/readback';mkdirSync(out+'/video',{recursive:true,mode:0o700});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),errors=[],blocked=[],views=[];let passed=false,context;
try{
 for(const actor of ['owner','admin']){
  context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}})).status(),201);
  await context.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==base||u.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(q.method())&&u.pathname!=='/api/auth/renew'){blocked.push({method:q.method(),path:u.pathname});return r.abort();}return r.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/?sessionId='+original.actors[actor].sessionId);await page.locator('.research-data-import[aria-busy="false"]').waitFor();
  await page.locator('.research-data-preview details>summary').click();await page.getByText('单位：g；数值；已记录2项，空值1项',{exact:true}).waitFor();
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});await page.locator('.research-data-preview table').scrollIntoViewIfNeeded();
   const m=await page.locator('.research-data-preview table').evaluate(t=>{const b=t.getBoundingClientRect(),host=t.closest('.conversationList'),h=host?.getBoundingClientRect();return{width:innerWidth,pageWidth:document.documentElement.scrollWidth,table:{x:b.x,y:b.y,width:b.width,height:b.height},messageViewport:h?{x:h.x,y:h.y,height:h.height}:null};});
   assert(m.pageWidth<=width+1);views.push({actor,...m});await page.screenshot({path:out+'/'+actor+'-'+width+'.png'});
  }
  await context.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});await context.close();context=null;
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);passed=true;
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({message:e.message},null,2));process.exitCode=1;}
finally{await context?.close();await browser.close();writeFileSync(out+'/result.json',JSON.stringify({passed,views,errors,blocked,providerCalls:0,businessWrites:0},null,2));console.log(JSON.stringify({passed,evidence:out,views:views.length,errors,blocked,providerCalls:0}));}
