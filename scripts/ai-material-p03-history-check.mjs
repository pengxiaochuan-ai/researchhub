// Real browser check of the two existing paid tasks; POST commands are blocked.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',source='.tmp/ai-file-data-2026-11-12/p03-real-approved-2026-11-13',out=source+'/history-'+Date.now();mkdirSync(out+'/video',{recursive:true,mode:0o700});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project},results=[],errors=[],blocked=[];let passed=false;
try{
 for(const actor of ['owner','admin']){
  const checkpoint=JSON.parse(readFileSync(source+'/'+actor+'-checkpoint.json','utf8')),expected=JSON.parse(readFileSync(source+'/'+actor+'-corrected-view.json','utf8')),previous=JSON.parse(readFileSync(source+'/'+actor+'-state.json','utf8')).messages.find(m=>m.id===checkpoint.answerId);
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
  try{
   assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}})).status(),201);
   await ctx.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==base){blocked.push({actor,path:u.origin});return route.abort();}if(u.pathname.startsWith('/api/')&&r.method()!=='GET'&&!['/api/auth/renew','/api/sessions/knowledge'].includes(u.pathname)){blocked.push({actor,path:u.pathname});return route.abort();}return route.continue();});
   const get=async path=>{const r=await ctx.request.get(base+'/api'+path,{headers});assert.equal(r.status(),200);return r.json();};
   const state=await get('/sessions/'+checkpoint.sessionId+'/knowledge-state?limit=60'),answer=state.messages.find(m=>m.id===checkpoint.answerId);assert.equal(answer.content,expected.text);assert.equal(answer.meta.privateMaterialDisplayPolicy,expected.policy);assert.equal(answer.meta.sourceStatus,'current');
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push({actor,message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({actor,message:m.text().slice(0,300)});});await page.goto(base+'/pages/ai01/?sessionId='+checkpoint.sessionId);await page.locator('.private-material-sources > summary').waitFor();
   if(actor==='admin'){await page.getByText(/需按研究方案确认/).first().waitFor();assert.equal(await page.getByText('不进行均值填补或删除',{exact:false}).count(),0);await page.getByText(/材料已给出上传验证用途/).first().scrollIntoViewIfNeeded();}
   await page.screenshot({path:out+'/'+actor+'-history.png'});await page.locator('.private-material-sources > summary').click();await page.locator('.private-material-sources section').last().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+actor+'-citations.png'});
   const first=await get('/sessions/'+checkpoint.sessionId+'/knowledge-sources/'+checkpoint.answerId+'/1');assert.equal(first.packHash,expected.packHash);
   await page.reload();await page.locator('.private-material-sources > summary').waitFor();assert.equal((await get('/sessions/'+checkpoint.sessionId+'/knowledge-state?limit=60')).messages.find(m=>m.id===checkpoint.answerId).content,expected.text);
   const unchanged=await withFixtureTransaction(env,'direct',async tx=>{const raw=await tx.message.findUnique({where:{id:checkpoint.answerId}}),reservation=await tx.tokenQuotaReservation.findUnique({where:{id:checkpoint.reservationId}}),attempts=await tx.auditLog.count({where:{tenantId:ids.tenant,target:checkpoint.reservationId,action:'hub.token.attempt.started'}});assert.equal(raw.content,previous.content);assert.deepEqual(raw.meta.provenance.privateMaterialOutput,previous.meta.provenance.privateMaterialOutput);assert.equal(reservation.status,'settled');assert.equal(Number(reservation.actualTokens),checkpoint.actualTokens);assert.equal(attempts,1);return true;},{readOnly:true});
   results.push({actor,answerId:answer.id,changedView:expected.changed,originalRecordUnchanged:unchanged,actualTokens:checkpoint.actualTokens,refresh:true,sourceCurrent:true});await page.close();
  }finally{try{await ctx.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});}catch{errors.push({actor,message:'Own diagnostic logout unconfirmed'});}await ctx.close();}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);passed=true;
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({code:e.code??e.name??'HISTORY_CHECK_FAILED',message:String(e.message).split('\n')[0].slice(0,400)},null,2),{mode:0o600});console.error(JSON.stringify({code:e.code??e.name??'HISTORY_CHECK_FAILED',evidence:out}));process.exitCode=1;}
finally{await browser.close();writeFileSync(out+'/result.json',JSON.stringify({passed,results,errors,blocked,newModelCalls:0,newUploads:0},null,2),{mode:0o600});console.log(JSON.stringify({passed,evidence:out,accounts:results.length,newModelCalls:0,errors:errors.length,blocked:blocked.length}));}
