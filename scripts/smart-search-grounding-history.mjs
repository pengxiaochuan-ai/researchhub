// Read-only legacy task/API/Chrome verification; never creates a model command.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/smart-search-grounding-2026-11-12/history';mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project},hash=v=>createHash('sha256').update(JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v)).digest('hex');
try{for(const label of ['admin','owner-acceptance']){
 const saved=JSON.parse(readFileSync('.tmp/smart-search-2026-11-12/live/'+label+'.json')),job=await db.knowledgeChatJob.findUnique({where:{id:saved.jobId}});assert.equal(job.tenantId,ids.tenant);assert.equal(job.status,'completed');const message=await db.message.findUnique({where:{id:job.assistantMessageId}}),before=hash({job,message});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:(label==='admin'?'admin':'owner')+'@example.org',password}})).status(),201);
  const response=await ctx.request.get(base+`/api/sessions/${job.sessionId}/knowledge-state`,{headers});assert.equal(response.status(),200);const state=await response.json(),projected=state.messages.find(m=>m.id===message.id);assert.equal(projected.meta.sourceStatus,'snapshot');assert.equal(projected.content,message.content);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/?sessionId='+job.sessionId);await page.locator('.hub-agent-answer').waitFor();const text=await page.locator('.hub-agent-answer').last().innerText();assert(!text.includes('当前无法交付'));await page.screenshot({path:out+'/'+label+'.png'});await page.reload();await page.locator('.hub-agent-answer').waitFor();assert.equal(await page.locator('.hub-agent-answer').last().innerText(),text);assert.deepEqual(errors,[]);
  const after=hash({job:await db.knowledgeChatJob.findUnique({where:{id:job.id}}),message:await db.message.findUnique({where:{id:message.id}})});assert.equal(after,before);results.push({label,jobId:job.id,sourceStatus:projected.meta.sourceStatus,immutable:true,passed:true,pageErrors:errors});
 }finally{await ctx.close();}
}}finally{writeFileSync(out+'/result.json',JSON.stringify({at:new Date().toISOString(),newModelCalls:0,results},null,2));await browser.close();await db.$disconnect();}
console.log(JSON.stringify({passed:results.length===2,newModelCalls:0,results}));
