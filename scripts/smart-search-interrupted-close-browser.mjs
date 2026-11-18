// Read-only acceptance after the separately approved one-shot close. No command submission.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/smart-search-grounding-2026-11-12/close',jobId='cmwcw7u280005luyi1na8t4wf',reservationId='cmwcw7utc0008luyicjlle5f9';
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});mkdirSync(out+'/video',{recursive:true});
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project},results=[];
async function preserved(){const j=await db.knowledgeChatJob.findUnique({where:{id:jobId}}),r=await db.tokenQuotaReservation.findUnique({where:{id:reservationId}}),u=await db.usageRecord.findUnique({where:{id:r.reconciliationUsageRecordId}});assert.equal(j.status,'failed');assert.equal(j.assistantMessageId,null);assert.equal(r.status,'settled');assert.equal(r.actualTokens,2273n);assert.deepEqual([u.promptTokens,u.completionTokens,u.totalTokens,u.callCount],[1803,470,2273,1]);return JSON.stringify({j,r,u},(_,v)=>typeof v==='bigint'?String(v):v);}
try{const before=await preserved(),job=await db.knowledgeChatJob.findUnique({where:{id:jobId}});
 for(const role of ['owner','admin']){const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  const errors=[],page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  if(role==='owner'){
   const state=await ctx.request.get(base+`/api/sessions/${job.sessionId}/knowledge-state`,{headers});assert.equal(state.status(),200);const s=await state.json();
   const commands=await ctx.request.get(base+`/api/sessions/${job.sessionId}/commands`,{headers});assert.equal(commands.status(),200);const c=await commands.json();
   assert.equal(s.jobs.find(j=>j.id===jobId)?.status,'failed');assert.equal(c.uncertain,false);assert.equal(c.items.length,0);assert.equal(c.recent.find(i=>i.id===job.userMessageId)?.status,'failed');
   writeFileSync(out+'/owner-api.json',JSON.stringify({state:s,commands:c},null,2),{mode:0o600});
   await page.goto(base+'/pages/ai01/?sessionId='+job.sessionId);await page.locator('.hub-agent-answer').first().waitFor();await page.locator('textarea').first().waitFor();assert.equal(await page.locator('textarea').first().isEnabled(),true);
   await page.screenshot({path:out+'/owner.png'});await page.reload();await page.locator('.hub-agent-answer').first().waitFor();assert.equal(await page.locator('textarea').first().isEnabled(),true);
   results.push({role,status:state.status(),commandStatus:commands.status(),composerEnabled:true,refresh:true,pageErrors:errors});
  }else{
   const response=await ctx.request.get(base+'/api/hub-billing/reconciliations/'+reservationId,{headers});assert.equal(response.status(),200);const d=await response.json();assert.equal(d.status,'settled');assert.equal(Number(d.actualTokens),2273);assert.equal(d.canSettle,false);assert.equal(d.usage.callCount,1);
   await page.goto(base+'/pages/g02/?view=token-reconciliation&record='+reservationId);const dialog=page.getByRole('dialog',{name:'核对模型用量'});await dialog.waitFor();assert((await dialog.innerText()).includes('2,273 Token'));assert((await dialog.innerText()).includes('1,803 / 470 Token'));assert.equal(await dialog.getByRole('button',{name:'确认结算',exact:true}).isDisabled(),true);await page.screenshot({path:out+'/admin.png'});await page.reload();await page.getByRole('dialog',{name:'核对模型用量'}).waitFor();
   results.push({role,status:response.status(),settled:true,actualTokens:2273,canSettle:false,refresh:true,pageErrors:errors});
  }
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}}
 assert.equal(await preserved(),before);
 const traces=readdirSync(root+'.tmp/researchhub-knowledge-local/ai-traces').filter(n=>n.endsWith('.json')).map(n=>JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+n))).filter(t=>t.jobId===jobId);assert.equal(traces.length,1);
 writeFileSync(out+'/browser.json',JSON.stringify({at:new Date().toISOString(),passed:true,newModelCalls:0,targetUnchanged:true,originalProviderCalls:traces.length,results},null,2));console.log(JSON.stringify({passed:true,newModelCalls:0,results}));
}finally{await browser.close();await db.$disconnect();}
