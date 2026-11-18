// One explicit browser acceptance per synthetic account; never retries a model task.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,fixtureClient} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {buildDirectionFacts,DIRECTION_POLICY_VERSION} from '../server/ai-agent/direction-consistency.mjs';
const checking=process.argv.includes('--consistency')||process.argv.includes('--consistency-final');
const root='/Users/mac/aisciencesys/',out=checking?'.tmp/ai-direction-consistency-2026-11-11/'+(process.argv.includes('--consistency-final')?'final':'live'):'.tmp/ai-natural-task-2026-11-11'+(process.argv.includes('--final')?'/final':''),base='http://127.0.0.1:19501',hash=v=>createHash('sha256').update(JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v)).digest('hex');
mkdirSync(out+'/video',{recursive:true});
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')), {ids,password}=rt;
assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const db=fixtureClient(env.WP01_TEST_DIRECT_URL);
if(process.argv[2]==='preflight'){
 try{const processing=await db.knowledgeChatJob.count({where:{tenantId:ids.tenant,status:'processing'}});assert.equal(processing,0,'Do not restart an active synthetic task');console.log(JSON.stringify({safeToRestart:true,processing}));}finally{await db.$disconnect();}
}else{
 assert(!existsSync(out+'/live-state.json'),'Acceptance already started: read back existing tasks, do not resubmit');
 const state={startedAt:new Date().toISOString(),cases:[]},save=()=>writeFileSync(out+'/live-state.json',JSON.stringify(state,null,2),{mode:0o600});
 const preserved=async()=>({roles:hash(await db.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}})),grants:hash(await db.tokenQuotaGrant.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}}))});
 const before=await preserved();save();
 const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
 const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const cases=checking?[['owner','检索近一年针灸改善失眠的论文，区分研究类型和已报告随访，提出需要验证的研究方向'],['admin','查询近一年正念干预职业倦怠的论文，核对研究类型及随访，再提出有依据的研究方向']]:[['owner','查询近1年关于 针灸治疗情志病领域相关的研究报告，论文，并总结新的研究方向'],['admin','查询近一年正念干预职业倦怠的论文，并概括未来研究方向']];
 try{for(const [role,text]of cases){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}}),headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
  try{
   const login=await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}});assert.equal(login.status(),201);
   const quota=await(await ctx.request.get(base+'/api/knowledge/ai-status',{headers})).json();assert.equal(quota.quota.canStart,true,'Normal business Token quota unavailable; never top up');
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/pages/ai01/');const input=page.getByLabel('研究问题',{exact:true});await input.waitFor();await input.fill(text);await page.screenshot({path:out+'/'+role+'-before.png'});await input.press('Enter');await page.waitForURL('**sessionId=*');
   const sessionId=new URL(page.url()).searchParams.get('sessionId'),record={role,text,sessionId,status:'submitted'};state.cases.push(record);save();console.log(JSON.stringify({role,sessionId,status:'submitted'}));
   let job;
   for(let i=0;i<150;i++){
    job=await db.knowledgeChatJob.findFirst({where:{tenantId:ids.tenant,sessionId},orderBy:{createdAt:'desc'}});
    if(job){record.jobId=job.id;record.status=job.status;save();if(['completed','failed','cancelled'].includes(job.status))break;}
    await page.waitForTimeout(2000);
   }
   assert(job,'No actual job created');record.status=job.status;record.errorCode=job.errorCode;record.errorMessage=job.errorMessage;save();
   await page.screenshot({path:out+'/'+role+'-db-terminal.png',fullPage:true});
   assert.equal(job.status,'completed',job.errorMessage??'Task did not finish');
   const plan=job.payload.hubNaturalPlan,e=job.payload.hubLiteratureEvidence;assert(plan);assert.equal(plan.plan.requestHash,job.payload.hubSkillRoute.decision.taskPlan.hash);assert(plan.plan.outputs.includes('directions'));assert(plan.plan.date.includes('2025/11/11'));
   const traces=readdirSync(root+'.tmp/researchhub-knowledge-local/ai-traces/').filter(f=>f.endsWith('.json')&&!f.endsWith('-runtime.json')).map(f=>JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-traces/'+f))).filter(t=>t.jobId===job.id);
   assert.equal(traces.length,2);assert(traces.every(t=>t.httpStatus===200&&t.usage));
   if(checking){
    const synthesis=traces.find(t=>t.request.messages.some(m=>m.role==='user'&&JSON.parse(m.content).directionFacts));assert(synthesis,'Actual Provider input must contain server fixed-source cues');
    const input=JSON.parse(synthesis.request.messages.find(m=>m.role==='user').content);assert.equal(input.directionFacts.version,DIRECTION_POLICY_VERSION);assert.deepEqual(input.directionFacts,buildDirectionFacts(e.selected));
    const {acceptLiteratureOutput}=await import('../server/ai-agent/literature-output.mjs');const accepted=acceptLiteratureOutput(synthesis.response[0].message.content,e);assert.equal(accepted.validation.directionPolicyVersion,DIRECTION_POLICY_VERSION);
    writeFileSync(out+'/'+role+'-validation.json',JSON.stringify(accepted.validation,null,2));
   }
   const message=await db.message.findUnique({where:{id:job.assistantMessageId}});assert(message.content.includes('候选研究方向'));assert(message.content.includes('待验证'));assert.equal(message.meta.provenance.literatureRuntime.runtime,'hub-opencode');
   if(checking)assert.deepEqual(message.meta.provenance.literatureOutput,JSON.parse(readFileSync(out+'/'+role+'-validation.json')),'Persisted receipt must equal actual raw-output acceptance');
   const usage=await db.usageRecord.findMany({where:{tenantId:ids.tenant,sessionId}}),actual=traces.reduce((n,t)=>n+t.usage.total_tokens,0);assert.equal(usage.length,1);assert.equal(Number(usage[0].totalTokens),actual);
   await page.getByText('候选研究方向（待验证）',{exact:false}).first().waitFor({timeout:15000});const visible=await page.locator('.hub-agent-answer').last().innerText();
   await page.getByText('候选研究方向（待验证）',{exact:false}).first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+role+'-result.png'});
   await page.reload();await page.getByText('候选研究方向（待验证）',{exact:false}).first().waitFor({timeout:20000});assert.equal(await page.locator('.hub-agent-answer').last().innerText(),visible);
   await input.fill('这一句仅保留为未发送草稿');await page.setViewportSize({width:390,height:844});await page.locator('.composer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+role+'-390.png'});assert.equal(await input.inputValue(),'这一句仅保留为未发送草稿');assert.deepEqual(errors,[]);
   Object.assign(record,{validated:true,actualRequests:traces.length,actualTokens:actual,query:plan.plan.pubmedQuery,sourceIds:e.selected.map(s=>({id:s.id,pmid:s.pmid,title:s.title,url:s.sourceUrl})),toolCalls:e.tools.map(t=>({tool:t.tool,args:t.args,status:t.status,startedAt:t.startedAt})),usageRecordId:usage[0].id,pageErrors:errors});
   writeFileSync(out+'/'+role+'-answer.md',message.content);save();console.log(JSON.stringify({role,validated:true,actualRequests:traces.length,actualTokens:actual}));
  }finally{await ctx.close();}
 }}finally{await browser.close();const after=await preserved();state.preserved=hash(before)===hash(after);save();await db.$disconnect();}
 assert(state.preserved);state.passed=state.cases.length===2&&state.cases.every(c=>c.validated);save();assert(state.passed);
}
