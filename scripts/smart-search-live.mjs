// Explicit one-shot real business acceptance. Existing Token quotas only.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/smart-search-2026-11-12/live',role=process.argv[2];assert(['owner','admin','pubmed','followup'].includes(role));mkdirSync(out+'/video',{recursive:true});
const label=process.argv[3]??role;assert(/^[a-z0-9-]{1,40}$/.test(label));
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
const marker=out+'/'+label+'.json';assert(!existsSync(marker),'Already attempted; inspect saved task, never auto-resubmit');
const record={role,startedAt:new Date().toISOString()},save=()=>writeFileSync(marker,JSON.stringify(record,null,2),{mode:0o600}),hash=v=>createHash('sha256').update(JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v)).digest('hex');
const preserve=async()=>hash({roles:await db.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}),grants:await db.tokenQuotaGrant.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}})});const before=await preserve();
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});
const account=role==='admin'?'admin':'owner',headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};save();
try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:account+'@example.org',password}})).status(),201);
 const quota=await(await ctx.request.get(base+'/api/knowledge/ai-status',{headers})).json();assert.equal(quota.quota.canStart,true,'Business quota unavailable; do not top up');
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const parent=role==='followup'?JSON.parse(readFileSync(out+'/owner-fixed.json')):null;
 await page.goto(base+'/pages/ai01/'+(parent?'?sessionId='+parent.sessionId:''));const input=page.getByLabel('研究问题',{exact:true}),toggle=page.getByRole('button',{name:'智能搜索',exact:true});await input.waitFor();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 if(role!=='followup')await toggle.click();
 const text=role==='owner'?(label==='owner-acceptance'?'查询WHO焦虑障碍的官方介绍，读取官网并概括科研背景，不推断疗效':'联网查询WHO关于抑郁障碍的官方介绍，读取官网并概括科研背景，不推断疗效'):role==='admin'?'读取 https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety 概括证据局限':role==='pubmed'?'用PubMed检索针灸治疗失眠的论文，概括摘要局限':'继续解释这些来源的适用范围，不新增检索';
 record.text=text;save();await input.fill(text);await page.screenshot({path:out+'/'+label+'-before.png'});await input.press('Enter');if(!parent)await page.waitForURL('**sessionId=*');record.sessionId=new URL(page.url()).searchParams.get('sessionId');save();
 let job;for(let n=0;n<180;n++){
  job=await db.knowledgeChatJob.findFirst({where:{tenantId:ids.tenant,sessionId:record.sessionId,...(parent?{NOT:{id:parent.jobId}}:{})},orderBy:{createdAt:'desc'}});
  if(job){Object.assign(record,{jobId:job.id,status:job.status,errorCode:job.errorCode,errorMessage:job.errorMessage});save();if(['completed','failed','cancelled'].includes(job.status))break;}await page.waitForTimeout(1500);
 }
 assert(job,'No real job');await page.screenshot({path:out+'/'+label+'-terminal.png'});assert.equal(job.status,'completed',job.errorMessage??'Not completed');
 const message=await db.message.findUnique({where:{id:job.assistantMessageId}}),e=job.payload.hubWebEvidence;
 if(role!=='pubmed'){assert(e);assert.equal(e.runtime.runtime,'hub-opencode');assert(e.sources.length);if(role==='followup')assert.equal(e.tools.length,0);else{assert(e.tools.some(t=>t.tool==='hub_public_webfetch'));if(role==='owner')assert(e.tools.some(t=>t.tool==='websearch'));}}
 const traces=readdirSync(root+'.tmp/researchhub-knowledge-local/ai-traces/').filter(f=>f.endsWith('.json')&&!f.endsWith('-runtime.json')).map(f=>JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+f))).filter(t=>t.jobId===job.id);
 assert(traces.length&&traces.every(t=>t.httpStatus===200&&t.usage));
 const usage=await db.usageRecord.findMany({where:{tenantId:ids.tenant,sessionId:record.sessionId,...(parent?{createdAt:{gte:new Date(record.startedAt)}}:{})}}),actual=traces.reduce((n,t)=>n+t.usage.total_tokens,0);assert.equal(usage.length,1);assert.equal(Number(usage[0].totalTokens),actual);
 const needle=message.content.split('\n').find(line=>line.trim()&&!/^\s*[#>*-]/.test(line)).replace(/[*_`]/g,'').slice(0,32);
 await page.waitForFunction(needle=>[...document.querySelectorAll('.hub-agent-answer')].at(-1)?.textContent.includes(needle),needle,{timeout:20000});const visible=await page.locator('.hub-agent-answer').last().innerText();assert(!visible.includes('当前无法交付'));await page.screenshot({path:out+'/'+label+'-result.png'});
 const state=await(await ctx.request.get(base+`/api/sessions/${record.sessionId}/knowledge-state`,{headers})).json();assert.equal(state.messages.find(m=>m.id===message.id)?.content,message.content);assert.notEqual(state.messages.find(m=>m.id===message.id)?.meta.sourceStatus,'restricted');
 await page.reload();await page.locator('.hub-agent-answer').last().waitFor({timeout:20000});assert.equal(await page.locator('.hub-agent-answer').last().innerText(),visible);assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 for(const [width,height]of [[1366,768],[390,844]]){await page.setViewportSize({width,height});await page.locator('.composer').scrollIntoViewIfNeeded();await page.screenshot({path:out+`/${label}-${width}.png`});}
 assert.deepEqual(errors,[]);Object.assign(record,{validated:true,actualRequests:traces.length,actualTokens:actual,usageRecordId:usage[0].id,tools:e?.tools??job.payload.hubLiteratureEvidence?.tools,sources:e?.sources.map(({id,url,title,coverage,retrievedAt})=>({id,url,title,coverage,retrievedAt})),pageErrors:errors});writeFileSync(out+'/'+label+'-answer.md',message.content);writeFileSync(out+'/'+label+'-evidence.json',JSON.stringify(e??job.payload.hubLiteratureEvidence,null,2));save();console.log(JSON.stringify({role,validated:true,jobId:job.id,actualRequests:traces.length,actualTokens:actual}));
}catch(error){record.error=error.message;save();console.error(JSON.stringify({role,status:record.status,error:record.error,jobId:record.jobId}));process.exitCode=1;}
finally{record.authorizationPreserved=before===await preserve();save();await ctx.close();await browser.close();await db.$disconnect();}
