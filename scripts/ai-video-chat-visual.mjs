import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
import {readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',dir=root+'researchhub/.tmp/ai-video-chat-2026-11-17/',r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),s=JSON.parse(readFileSync(dir+'live-scope.json'));
if(existsSync(dir+'final-visual.json')&&!existsSync(dir+'visual-before-scroll.json'))copyFileSync(dir+'final-visual.json',dir+'visual-before-scroll.json');
const b=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),report=[];
try{for(const actor of ['owner','admin'])for(const width of [1440,390]){
 const c=await b.newContext({viewport:{width,height:1000},recordVideo:{dir}});
 try{
  const headers={Origin:base,'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project};
  assert.equal((await c.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}})).status(),201);
  const blocked=[],errors=[];await c.route('**/api/**',route=>{const q=route.request();if(q.method()!=='GET'&&!q.url().endsWith('/auth/renew')){blocked.push(q.url());return route.abort();}return route.continue();});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/pages/ai01/?sessionId='+s.actors[actor].sessionId);
  const answer=p.locator('article[aria-label="科研 Agent 回答"]');await answer.waitFor();const prose=await answer.innerText();assert(prose.includes('绿色'));assert(!prose.includes('Skill'));assert(!prose.includes('【待'));if(actor==='admin')assert(prose.includes('红色')&&prose.includes('蓝色'));
  await answer.getByRole('heading',{name:'AI解释',exact:true}).scrollIntoViewIfNeeded();await p.screenshot({path:dir+actor+'-prose-'+width+'.png'});
  await answer.locator('.video-chat-sources summary').click();await answer.getByRole('button',{name:'回放来源V3 0:05.8',exact:true}).click();
  await p.waitForFunction(()=>{const v=document.querySelector('video');if(!v||v.readyState<2)return false;const b=v.getBoundingClientRect();return v.currentTime>=5.8&&v.currentTime<8&&b.top>=0&&b.bottom<=innerHeight;});
  const visible=await p.locator('video').evaluate(v=>{v.pause();const b=v.getBoundingClientRect();return{time:v.currentTime,top:b.top,bottom:b.bottom,viewHeight:innerHeight};});
  await p.screenshot({path:dir+actor+'-time-'+width+'.png'});assert.equal(blocked.length,0);assert.deepEqual(errors,[]);report.push({actor,width,visible,playerInViewport:true,noDeveloperCopy:true,errors});
 }finally{await c.close();}
}writeFileSync(dir+'final-visual.json',JSON.stringify({passed:true,providerCalls:0,report},null,2));console.log(JSON.stringify({passed:true,providerCalls:0,cases:report.length,playerInViewport:true}));
}finally{await b.close();}
