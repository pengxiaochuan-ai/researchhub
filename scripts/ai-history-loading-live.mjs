// Read-only browser/API timing; no message, media or business mutation.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--read-only']);
const root=new URL('../../',import.meta.url).pathname,out=root+'researchhub/.tmp/ai-resumable-2026-11-16/',runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),state=JSON.parse(readFileSync(out+'live/checkpoint.json')),base='http://127.0.0.1:19501';assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const actor of ['owner','admin']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'live'}}),record=state.actors[actor];assert(record.completed);const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}});assert.equal(login.status(),201);
 const page=await context.newPage(),errors=[],events=[];let started=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();if(u.pathname.startsWith('/api/')&&q.method()!=='GET'&&u.pathname!=='/api/auth/renew'){errors.push('Unexpected write '+u.pathname);return route.abort();}return route.continue();});
 page.on('request',r=>{if(r.url().includes('/api/'))events.push({event:'start',path:new URL(r.url()).pathname,at:Math.round(performance.now()-started)});});page.on('response',r=>{if(r.url().includes('/api/'))events.push({event:'response',path:new URL(r.url()).pathname,status:r.status(),at:Math.round(performance.now()-started)});});
 const visible=[];for(let attempt=0;attempt<2;attempt++){
  started=performance.now();await page.goto(base+'/pages/ai01/?sessionId='+record.sessionId);await page.locator('.agent-history-group .conv').first().waitFor();visible.push(Math.round(performance.now()-started));if(!attempt)await page.screenshot({path:out+'live/'+actor+'-history-fast.png'});
  await page.getByRole('button',{name:'上传文件',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.composerTools button')?.disabled);
 }
 const api=[];for(let i=0;i<3;i++){const start=performance.now(),r=await context.request.get(base+'/api/sessions/hub-source/history?page=1&limit=20',{headers:{Origin:base,'X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project}});assert.equal(r.status(),200);assert.equal((await r.json()).items.length,20);api.push(Math.round(performance.now()-start));}
 assert.deepEqual(errors,[]);results.push({actor,historyVisibleMs:visible,historyApiMs:api,events,errors});await context.close();
}}finally{await browser.close();}
writeFileSync(out+'history-waterfall-after.json',JSON.stringify({at:new Date().toISOString(),runtimePid:runtime.pid,results,newMediaWrites:0,newProviderRequests:0},null,2)+'\n',{mode:0o600});console.log(JSON.stringify({passed:true,results:results.map(({actor,historyVisibleMs,historyApiMs})=>({actor,historyVisibleMs,historyApiMs}))}));
