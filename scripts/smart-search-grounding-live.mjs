// Explicit single-task business acceptance; no automatic retry or quota change.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertGroundingReceipt} from '../server/ai-agent/smart-search-grounding.mjs';
const kind=process.argv[2],label=process.argv[3];
assert(['nccih','who','catalog-followup'].includes(kind));assert(/^[a-z][a-z0-9-]{2,39}$/.test(label??''));
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/smart-search-grounding-2026-11-12/live';
mkdirSync(out+'/video',{recursive:true});const marker=out+'/'+label+'.json';assert(!existsSync(marker),'Attempt already exists; inspect, never auto-resubmit');
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
const text=kind==='catalog-followup'?'继续说明这些来源：哈佛目录收录WHO资料能证明获得WHO授权吗？请区分事实与AI推论，不新增检索。':kind==='nccih'?'读取 https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety 总结局限及设计建议。':'读取 https://repository.gheli.harvard.edu/repository/14380/ ，目录收录和WHO原始资料有什么区别？能认定WHO授权吗？';
assert(text.length<=100,'Do not silently truncate the intended acceptance question');
const record={kind,label,startedAt:new Date().toISOString(),text},save=()=>writeFileSync(marker,JSON.stringify(record,null,2),{mode:0o600});
const hash=value=>createHash('sha256').update(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v)).digest('hex');
const preserve=async()=>hash({roles:await db.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}),grants:await db.tokenQuotaGrant.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}})}),before=await preserve();
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project},account=kind==='nccih'?'admin':'owner';save();
try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:account+'@example.org',password}})).status(),201);
 const quota=await(await ctx.request.get(base+'/api/knowledge/ai-status',{headers})).json();assert.equal(quota.quota.canStart,true,'Business quota unavailable; no top-up');
 const parent=kind==='catalog-followup'?JSON.parse(readFileSync('.tmp/smart-search-2026-11-12/live/owner-acceptance.json')):null;
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/'+(parent?'?sessionId='+parent.sessionId:''));
 const input=page.getByLabel('研究问题',{exact:true}),toggle=page.getByRole('button',{name:'智能搜索',exact:true});await input.waitFor();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 if(!parent)await toggle.click();await input.fill(text);assert.equal(await input.inputValue(),text,'Actual question must equal acceptance intent');await page.screenshot({path:out+'/'+label+'-before.png'});await input.press('Enter');await page.waitForURL('**sessionId=*');record.sessionId=new URL(page.url()).searchParams.get('sessionId');record.networkEnabled=!parent;save();
 let job;for(let n=0;n<150;n++){
  job=await db.knowledgeChatJob.findFirst({where:{tenantId:ids.tenant,sessionId:record.sessionId,createdAt:{gte:new Date(record.startedAt)}},orderBy:{createdAt:'desc'}});
  if(job){Object.assign(record,{jobId:job.id,status:job.status,errorCode:job.errorCode,errorMessage:job.errorMessage});save();if(['completed','failed','cancelled'].includes(job.status))break;}
  await page.waitForTimeout(1500);
 }
 assert(job);await page.screenshot({path:out+'/'+label+'-terminal.png'});
 // Record known usage even when the task or acceptance fails.
 const traces=readdirSync(root+'.tmp/researchhub-knowledge-local/ai-traces/').filter(f=>f.endsWith('.json')&&!f.endsWith('-runtime.json')).map(f=>JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+f))).filter(t=>t.jobId===job.id);
 record.providerCalls=traces.length;record.actualTokens=traces.reduce((n,t)=>n+(t.usage?.total_tokens??0),0);record.providerUsageKnown=traces.every(t=>t.usage);save();
 writeFileSync(out+'/'+label+'-provider.json',JSON.stringify(traces,null,2),{mode:0o600});
 assert.equal(job.status,'completed',job.errorMessage??'Not completed');
 const evidence=job.payload.hubWebEvidence,message=await db.message.findUnique({where:{id:job.assistantMessageId}}),output=message.meta.provenance.webOutput;
 writeFileSync(out+'/'+label+'-answer.md',message.content);writeFileSync(out+'/'+label+'-evidence.json',JSON.stringify(evidence,null,2));writeFileSync(out+'/'+label+'-grounding.json',JSON.stringify(output,null,2));
 assertGroundingReceipt(output,evidence.sources);assert.equal(output.schema,'hub-smart-answer.v2');assert.notEqual(output.status,'no-supported-claims');
 if(parent){assert.equal(evidence.tools.length,0);assert.equal(job.payload.hubWebContext.parentJobId,parent.jobId);}else assert(evidence.tools.some(t=>t.tool==='hub_public_webfetch'&&t.status==='completed'));
 assert(output.grounding.claims.some(c=>c.status==='delivered'&&c.kind==='source_fact'));
 if(kind==='nccih')assert(output.grounding.claims.some(c=>c.status==='delivered'&&c.kind==='ai_inference'));
 const state=await(await ctx.request.get(base+`/api/sessions/${job.sessionId}/knowledge-state`,{headers})).json(),projected=state.messages.find(m=>m.id===message.id);assert.equal(projected.meta.sourceStatus,'snapshot');assert.equal(projected.content,message.content);
 await page.waitForFunction(()=>[...document.querySelectorAll('.hub-agent-answer')].at(-1)?.textContent.includes('原文事实'),null,{timeout:20000});const visible=await page.locator('.hub-agent-answer').last().innerText();assert(visible.includes('原文依据'));
 await page.screenshot({path:out+'/'+label+'-result.png'});await page.reload();await page.waitForFunction(()=>[...document.querySelectorAll('.hub-agent-answer')].at(-1)?.textContent.includes('原文事实'),null,{timeout:20000});assert.equal(await page.locator('.hub-agent-answer').last().innerText(),visible);assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 record.visibleSourceLinks=await page.locator('.hub-agent-answer a[target="_blank"]').count();assert(record.visibleSourceLinks>0);
 for(const [width,height]of [[1366,768],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:out+`/${label}-${width}.png`});}
 const usages=await db.usageRecord.findMany({where:{tenantId:ids.tenant,messageId:message.id}}),reservation=await db.tokenQuotaReservation.findUnique({where:{tenantId_requestKey:{tenantId:ids.tenant,requestKey:`chat:${job.sessionId}:${job.requestKey}`}}});assert.equal(usages.length,1);assert.equal(usages[0].callCount,traces.length);assert.equal(usages[0].totalTokens,record.actualTokens);assert.equal(reservation.status,'settled');assert.equal(Number(reservation.actualTokens),record.actualTokens);assert.deepEqual(errors,[]);
 Object.assign(record,{validated:true,reservationStatus:reservation.status,usageRecordId:usages[0].id,pageErrors:errors,tools:evidence.tools,claimSummary:output.grounding.claims.map(({kind,status,reason})=>({kind,status,reason}))});save();console.log(JSON.stringify({kind,jobId:job.id,validated:true,providerCalls:record.providerCalls,actualTokens:record.actualTokens,claims:record.claimSummary}));
}catch(error){record.error=error.message;save();console.error(JSON.stringify({kind,jobId:record.jobId,status:record.status,error:record.error}));process.exitCode=1;}
finally{record.authorizationPreserved=before===await preserve();save();await ctx.close();await browser.close();await db.$disconnect();}
