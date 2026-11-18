// Read-only route/copy inventory. Auth login is the only allowed POST.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {makeDesignWorkspaceUrl} from '../src/research-design-session.js';
import {makePreparationUrl} from '../src/research-execution-preparation-session.js';
import {makeSyntheticEdcUrl} from '../src/synthetic-edc-session.js';
import {makeCrfMethodsUrl} from '../src/crf-methods-session.js';
import {makeCrfMethodAssetUrl,makeCrfMethodReportUrl} from '../src/crf-method-assets-session.js';
import {makeAssetApplicabilityUrl} from '../src/asset-applicability-session.js';
const baseline=process.argv.includes('--baseline'),root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const manifest=JSON.parse(readFileSync('platform-pages.json')).pages;
const reports=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/report-fixtures.json'));
const assets=JSON.parse(readFileSync(root+'.tmp/researchhub-wp08-crf-method-assets/api-fixtures.json'));
const applicability=JSON.parse(readFileSync(root+'.tmp/researchhub-wp09-asset-applicability/fixtures.json'));
const scope={studyGroupId:rt.ids.group,researchProjectId:rt.ids.project};
const pattern=/本轮|布局还原|(?:尚未|已|未)接(?:入|通)|(?:前端|后端|接口|数据库记录|原系统|旧算子|SMTP|Provider|Mock)|本机专用|不展示演示|不使用演示|不回退演示|服务端.*(?:核验|草稿|确认)/;
const out='docs/testing/evidence/page-copy-browser-'+(baseline?'before-':'after-')+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],rows=[],writes=[],pageErrors=[],httpErrors=[];
async function navigateReadOnly(page,url){
 for(let attempt=0;attempt<3;attempt++){
  try{return await page.goto(url,{waitUntil:'domcontentloaded'});}catch(error){
   if(!/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET/.test(error.message)||attempt===2)throw error;
   // Local runtime may reload independently. Retry navigation only, never a write.
   for(let wait=0;wait<20;wait++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    try{if((await page.request.get(base+'/pages/p003/',{timeout:1500})).ok())break;}catch{}
   }
  }
 }
}
function extras(actor){const f=reports[actor];return [
 '/pages/s01/?'+new URLSearchParams(scope),'/pages/s08/?'+new URLSearchParams(scope),'/pages/s11/?'+new URLSearchParams({members:'1',...scope}),
 makeDesignWorkspaceUrl('q02',scope),makeDesignWorkspaceUrl('s02',scope),makeDesignWorkspaceUrl('s07',scope,f.planId),makeDesignWorkspaceUrl('q01',scope,f.planId),
 makePreparationUrl(scope,f.planId),...['s03','s04','s05'].map(p=>makeSyntheticEdcUrl(p,scope,f.planId,f.collectionId)),
 makeCrfMethodsUrl(scope,f.planId,f.collectionId,f.runId),makeCrfMethodReportUrl(scope,f.planId,f.collectionId,f.runId,f.reportId,2),
 makeCrfMethodAssetUrl('a01',scope),makeCrfMethodAssetUrl('a02',scope,assets[actor].assetId,2),makeAssetApplicabilityUrl(scope,applicability[actor].assetId),
 '/pages/g02/?view=source-review','/pages/g02/?view=directory-review','/pages/e02/?recordId=pmc-PMC13522945','/pages/ai01/?articleId=pmc-PMC13522945',
 ...['start','account','draft','asset','ai','team'].map(article=>'/pages/p009/?article='+article),
 ];}
try{
 for(const actor of baseline?['admin','demo']:['admin','owner','demo','anonymous']){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video/'+actor}});contexts.push(ctx);
  if(['owner','admin'].includes(actor))assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:actor+'@example.org',password:rt.password}})).status(),201);
  if(actor==='demo')await ctx.addInitScript(()=>{try{sessionStorage.setItem('lingshu-demo-mode','true');}catch{}});
  await ctx.route('**/*',route=>{const request=route.request(),u=new URL(request.url());if(u.protocol==='http:'&&u.host!=='127.0.0.1:19501')return route.abort();if(u.protocol==='https:')return route.abort();if(u.pathname.startsWith('/api/')&&!['GET','HEAD'].includes(request.method())){writes.push({actor,path:u.pathname,method:request.method()});return route.abort();}return route.continue();});
  const page=await ctx.newPage();let path='';page.on('pageerror',e=>pageErrors.push({actor,path,error:e.message,stack:e.stack}));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname.startsWith('/api/'))httpErrors.push({actor,path,url:new URL(r.url()).pathname,status:r.status()});});
  const pages=actor==='anonymous'?manifest.filter(p=>/^p00[2345789]$/.test(p.id)||p.id==='p010'):manifest;
  const allRoutes=[...pages.map(p=>'/pages/'+p.id+'/'),...(['admin','owner'].includes(actor)?extras(actor):[])];
  const routes=process.argv.includes('--probe')?(['admin','owner'].includes(actor)?Array.from({length:12},(_,i)=>i%3===2?'/pages/p01/':'/pages/k01/'):[]):process.argv.includes('--supplement')?allRoutes.filter(path=>/^\/pages\/(?:p01|p002|c03|e02|s01|s07|q01|q02|s05|s06|a01|a02|s08|g05)\//.test(path)):allRoutes;
  for(let i=0;i<routes.length;i++){
   path=routes[i];try{
    await navigateReadOnly(page,base+path);await page.locator('body').waitFor({state:'attached'});await page.waitForLoadState('networkidle',{timeout:3000}).catch(()=>{});
    await page.waitForFunction(()=>document.body.innerText.trim().length>20,null,{timeout:5000});
    const frames=[];for(const frame of page.frames()){if(!frame.url().startsWith(base))continue;const data=await frame.evaluate(()=>{const main=document.querySelector('.qiyan-real-gate')??document.querySelector('main')??document.body;const text=main.innerText;return{gated:main.classList.contains('qiyan-real-gate'),title:main.querySelector('h1,h2')?.textContent,lines:text.split('\n').map(t=>t.trim()).filter(Boolean),controls:[...main.querySelectorAll('button,input,textarea,select')].map(e=>({tag:e.tagName,id:e.id,type:e.getAttribute('type'),disabled:e.disabled})),links:[...main.querySelectorAll('a[href]')].map(e=>e.getAttribute('href')),horizontal:document.documentElement.scrollWidth>innerWidth+1,font:getComputedStyle(main).fontSize};});frames.push({...data,url:frame.url().replace(base,''),candidates:data.lines.filter(t=>pattern.test(t)).slice(0,40)});}
    const slug=actor+'-'+String(i).padStart(3,'0');await page.screenshot({path:out+'/'+slug+'.png',fullPage:true});rows.push({actor,path,screenshot:slug+'.png',frames});
   }catch(e){rows.push({actor,path,error:e.message});console.error(JSON.stringify({actor,path,error:e.message.slice(0,240)}));await page.screenshot({path:out+'/'+actor+'-'+i+'-failure.png'}).catch(()=>{});}
   if((i+1)%10===0)console.log(JSON.stringify({actor,progress:i+1,evidence:out}));
   writeFileSync(out+'/partial.json',JSON.stringify({rows,blockedWriteAttempts:writes,pageErrors,httpErrors},null,2));
  }
  console.log(JSON.stringify({actor,routes:routes.length,completed:rows.filter(r=>r.actor===actor&&!r.error).length,candidates:rows.filter(r=>r.actor===actor).reduce((n,r)=>n+(r.frames??[]).reduce((s,f)=>s+f.candidates.length,0),0),evidence:out}));
 }
 writeFileSync(out+'/result.json',JSON.stringify({baselineOnly:baseline,rows,blockedWriteAttempts:writes,pageErrors,httpErrors,providerCalls:0,newBusinessWrites:0,at:new Date().toISOString()},null,2));
 // Knowledge's existing mount requests an empty session. Block and record it;
 // this copy-only task neither enables that write nor changes its behavior.
 assert(writes.every(w=>w.path==='/api/sessions/knowledge'),'UNEXPECTED_WRITE_ATTEMPT');assert(rows.every(r=>!r.error),'ROUTE_RENDER_ERRORS');
 console.log(JSON.stringify({completed:true,evidence:out,routes:rows.length,renderErrors:rows.filter(r=>r.error).length,pageErrors:pageErrors.length,httpErrors:httpErrors.length}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({error:e.message,rows,writes,pageErrors,httpErrors},null,2));console.error(JSON.stringify({completed:false,error:e.message,evidence:out}));process.exitCode=1;}
finally{for(const ctx of contexts)await ctx.close();await browser.close();}
