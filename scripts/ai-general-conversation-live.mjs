import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-general-conversation-2026-11-11';mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}}),results=[],errors=[];
const pendingProof=process.argv.includes('--resume-own-proof'),afterResearch=process.argv.includes('--resume-after-research');
const resume=pendingProof?JSON.parse(readFileSync(out+'/real-failure.json')):afterResearch?JSON.parse(readFileSync(out+'/real-results.json')):null;
let sid;
try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:'admin@example.org',password}})).status(),201);
 const quota=await(await ctx.request.get(base+'/api/knowledge/ai-status',{headers})).json();assert.equal(quota.quota.canStart,true,'normal business Token admission is required; never top up');
 if(resume){assert.equal(resume.results.length,pendingProof?2:3);assert(resume.results.slice(0,2).every(r=>r.provenance.mode==='hub-general-conversation'));sid=resume.sessionId;results.push(...resume.results);}else{const session=await ctx.request.post(base+'/api/sessions/hub-source',{headers,data:{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',conversationKey:crypto.randomUUID()}});assert.equal(session.status(),201);sid=(await session.json()).id;}
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/?sessionId='+sid);const input=page.getByLabel('研究问题',{exact:true});await input.waitFor();await page.waitForLoadState('networkidle');
 const questions=['介绍下你自己，请简短回答','你刚才提到的能力，应该从哪里开始？','只用Hub已审核资料，不联网。检索针灸治疗抑郁的两篇研究，列出来源与局限。','回到刚才的介绍，你能帮我完成哪些研究任务？'];
 for(const [index,text] of questions.entries()){
  if(index<results.length)continue;
  if(pendingProof){
   const commands=await(await ctx.request.get(base+'/api/sessions/'+sid+'/commands',{headers})).json(),item=commands.items.find(i=>i.text===text&&i.status==='paused'&&i.pauseCode==='HUB_SKILL_CLARIFICATION');assert(item,'resume only this own unexecuted clarification, never a failed job');
   const updated=await ctx.request.patch(base+'/api/sessions/'+sid+'/commands/'+item.id,{headers,data:{text,version:item.version}});assert.equal(updated.status(),200);
  }else{await input.fill(text);await input.press('Enter');}let state,job;
  for(let attempt=0;attempt<180;attempt++){
   const response=await ctx.request.get(base+'/api/sessions/'+sid+'/knowledge-state?limit=60',{headers});assert.equal(response.status(),200);state=await response.json();job=state.jobs.find(j=>j.text===text)||state.jobs.find(j=>state.messages.find(m=>m.id===j.userMessageId)?.content===text);
   if(job&&['failed','completed'].includes(job.status))break;
   const commands=await(await ctx.request.get(base+'/api/sessions/'+sid+'/commands',{headers})).json();const paused=commands.items.find(i=>i.text===text&&i.status==='paused');if(paused)throw Error('Business admission stopped: '+paused.errorMessage);
   await page.waitForTimeout(700);
  }
  assert.equal(job?.status,'completed','No automatic retry: '+JSON.stringify(job));
  const answer=state.messages.find(m=>m.id===job.assistantMessageId)||state.messages.filter(m=>m.role==='assistant').at(-1);assert(answer?.content?.length>5);assert.notEqual(answer.meta?.sourceStatus,'restricted');
  const provenance=answer.meta?.provenance;assert.equal(provenance?.runtime,'hub-opencode');
  if(index!==2){assert.equal(provenance?.mode,'hub-general-conversation');assert.equal(provenance.generalRuntime.providerCalls,1);assert.deepEqual(provenance.hubTools,[]);assert.deepEqual(provenance.hubSources,[]);}else{assert.equal(provenance?.mode,'hub-literature-search');assert.equal(provenance.literatureEvidence.external,null);assert(provenance.literatureEvidence.selected.length>0);}
  results.push({question:text,jobId:job.id,answerId:answer.id,text:answer.content,provenance});
  await page.locator('.thread .hub-agent-answer').nth(index).waitFor({timeout:10000});await page.screenshot({path:out+'/real-turn-'+(index+1)+'.png'});console.log(JSON.stringify({turn:index+1,jobId:job.id,status:'completed',mode:provenance.mode}));
 }
 await page.reload();await page.locator('.thread .hub-agent-answer').nth(questions.length-1).waitFor();assert.equal(await page.locator('.thread .hub-agent-answer').count(),questions.length);await page.screenshot({path:out+'/real-refresh.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.composer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/real-390.png'});assert.deepEqual(errors,[]);
 writeFileSync(out+'/real-results.json',JSON.stringify({passed:true,sessionId:sid,results,errors},null,2));
}catch(reason){writeFileSync(out+'/real-failure.json',JSON.stringify({sessionId:sid,results,error:reason.message},null,2));throw reason;}
finally{await ctx.close();await browser.close();}
