import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const stage=process.argv[2];assert(['before','after'].includes(stage));
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.match(rt.ids.tenant,/^rh-kb-local-/);
const out=root+'researchhub/docs/testing/evidence/governance-loading-2026-11-16/'+stage+'-'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={stage,time:new Date().toISOString(),pid:rt.pid,samples:[],pageErrors:[],businessWrites:[],out};let c,p;
try{
 c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video'}});c.on('page',page=>page.on('pageerror',e=>result.pageErrors.push(e.message)));await c.route('**/api/**',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())&&!new URL(r.request().url()).pathname.startsWith('/api/auth/')){result.businessWrites.push(new URL(r.request().url()).pathname);return r.abort();}return r.continue();});assert.equal((await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}})).status(),201);
 for(let i=0;i<3;i++){
  p=await c.newPage();const sample={index:i+1,requests:[]},start=Date.now(),responses=[];
  p.on('response',r=>{if(!r.url().startsWith(base+'/api/'))return;const req=r.request(),u=new URL(r.url()),entry={path:u.pathname,query:u.search,status:r.status(),at:Date.now()-start};sample.requests.push(entry);responses.push((async()=>{await r.finished();entry.doneAt=Date.now()-start;if(req.method()==='GET'&&(/review-queue|protocol-reviews|team-workspaces|reconciliations|governance-users\/studies|member-invitations/.test(u.pathname))){const b=await r.json().catch(()=>null);entry.items=b?.items?.length;entry.total=b?.total??b?.pagination?.totalItems;entry.scope=req.headers()['x-research-project-id'];}})());});
  await p.goto(base+'/pages/g02/');
  const first=p.locator('.governance-overview > section').first().locator('.governance-items li').first().waitFor({timeout:35000}).then(()=>Date.now()-start).catch(()=>null);
  await p.waitForFunction(()=>document.querySelector('.governance-queue')?.getAttribute('aria-busy')==='false',{},{timeout:35000});sample.queueSettledMs=Date.now()-start;sample.firstItemMs=await first;sample.pendingRows=await p.locator('.governance-overview > section').first().locator('.governance-items li').count();sample.finalText=await p.locator('.governance-overview > section').first().innerText();await Promise.all(responses);sample.apiRequests=sample.requests.length;
  const invitation=sample.requests.filter(x=>x.path==='/api/member-invitations');sample.invitationRequests=invitation.length;sample.invitationSpanMs=invitation.length?Math.max(...invitation.map(x=>x.doneAt))-Math.min(...invitation.map(x=>x.at)):0;
  await p.screenshot({path:out+'sample-'+(i+1)+'.png'});result.samples.push(sample);await p.close();p=null;
 }
 assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.businessWrites,[]);result.passed=true;
 const median=key=>result.samples.map(s=>s[key]).filter(x=>x!==null).sort((a,b)=>a-b)[1];result.median={firstItemMs:median('firstItemMs'),queueSettledMs:median('queueSettledMs'),apiRequests:median('apiRequests'),invitationSpanMs:median('invitationSpanMs')};
}catch(e){result.passed=false;result.error=e.message;await p?.screenshot({path:out+'failure.png'}).catch(()=>{});process.exitCode=1;}
finally{await c?.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error,median:result.median,out}));}
