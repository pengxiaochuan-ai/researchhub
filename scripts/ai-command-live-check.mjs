import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-conversation-acceptance-2026-11-10';
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
mkdirSync(out+'/live-video',{recursive:true});const results=[];
async function waitPaused(ctx,sid){for(let i=0;i<20;i++){const r=await ctx.request.get(base+'/api/sessions/'+sid+'/commands',{headers});assert.equal(r.status(),200);const v=await r.json();if(v.paused)return v;await new Promise(r=>setTimeout(r,500));}throw Error('Command did not pause without creating model work');}
try{for(const role of ['owner','admin']){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/live-video'}});let page;
 try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  const created=await ctx.request.post(base+'/api/sessions/hub-source',{headers,data:{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',conversationKey:crypto.randomUUID()}});assert.equal(created.status(),201);const sid=(await created.json()).id;
  page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let legacyPosts=0;
  page.on('response',async r=>{if(r.url().includes('/commands')&&r.status()>=400){const v=await r.json().catch(()=>({}));console.log(JSON.stringify({status:r.status(),code:v.code,message:v.message}));}});
  await ctx.route('**/api/sessions/*/knowledge-messages',r=>{legacyPosts++;return r.abort();});
  await page.goto(base+'/pages/ai01/?sessionId='+sid);const input=page.getByLabel('研究问题',{exact:true});await input.waitFor();await page.waitForLoadState('networkidle');assert(await input.isEnabled());
  assert.equal(await page.locator('.thread').getByText('Hub 文献检索与问答',{exact:true}).count(),0);
  await input.fill('订阅针灸研究');await page.getByRole('button',{name:'发送',exact:true}).click();
  const paused=await waitPaused(ctx,sid),command=paused.items.find(i=>i.status==='paused');assert(command);
  await page.getByText('已暂停',{exact:true}).waitFor();await page.getByRole('button',{name:'编辑',exact:true}).click();
  await page.getByLabel('修改待执行指令').fill('订阅抑郁最新研究');assert.equal(await page.getByLabel('修改待执行指令').inputValue(),'订阅抑郁最新研究');
  const patch=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().includes('/commands/'),{timeout:5000});await page.getByRole('button',{name:'保存修改',exact:true}).click();const edited=await patch;assert.equal(edited.status(),200);console.log(JSON.stringify({role,edited:await edited.json()}));
  await page.getByText('订阅抑郁最新研究',{exact:true}).waitFor();await page.reload();await page.getByText('订阅抑郁最新研究',{exact:true}).waitFor();await waitPaused(ctx,sid);
  await page.screenshot({path:out+'/'+role+'-live-queue.png'});await page.setViewportSize({width:390,height:844});await page.locator('.composer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+role+'-live-390.png'});
  await page.getByRole('button',{name:'删除',exact:true}).click();await page.getByText('订阅抑郁最新研究',{exact:true}).waitFor({state:'hidden'});
  const list=await(await ctx.request.get(base+'/api/sessions/'+sid+'/commands',{headers})).json();assert.equal(list.items.length,0);
  const state=await(await ctx.request.get(base+'/api/sessions/'+sid+'/knowledge-state?limit=60',{headers})).json();assert.deepEqual(state.messages,[]);assert.deepEqual(state.jobs,[]);assert.equal(legacyPosts,0);assert.deepEqual(errors,[]);
  if(results.length){const forbidden=await ctx.request.get(base+'/api/sessions/'+results[0].sessionId+'/commands',{headers});assert.equal(forbidden.status(),404);}
  results.push({role,sessionId:sid,commandId:command.id,persisted:true,edited:true,cancelled:true,newJobs:0,legacyPosts,pageErrors:errors});
 }finally{await page?.screenshot({path:out+'/'+role+'-last-state.png'}).catch(()=>{});await ctx.close();}
}
const articleContext=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/live-video'}});let articlePage;
try{
 assert.equal((await articleContext.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:'owner@example.org',password}})).status(),201);
 const record='pmc-PMC13672493',contextResponse=await articleContext.request.get(base+'/api/hub-sources/article-context/'+record,{headers});assert.equal(contextResponse.status(),200);const article=await contextResponse.json();
 const ensured=await articleContext.request.post(base+'/api/sessions/hub-source',{headers,data:{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',articleBinding:article.binding}});assert.equal(ensured.status(),201);const sid=(await ensured.json()).id;
 articlePage=await articleContext.newPage();const errors=[];articlePage.on('pageerror',e=>errors.push(e.message));await articlePage.goto(base+'/pages/ai01/?articleId='+record);
 const input=articlePage.getByLabel('本篇研究问题（2–100字）',{exact:true});await input.waitFor();await articlePage.waitForLoadState('networkidle');assert(await input.isEnabled());
 const before=await(await articleContext.request.get(base+'/api/sessions/'+sid+'/knowledge-state?limit=60',{headers})).json();
 await input.fill('订阅针灸研究');await articlePage.getByRole('button',{name:'发送',exact:true}).click();await waitPaused(articleContext,sid);await articlePage.getByText('已暂停',{exact:true}).waitFor();
 await articlePage.screenshot({path:out+'/article-live-queue.png'});await articlePage.setViewportSize({width:390,height:844});await articlePage.locator('.composer').scrollIntoViewIfNeeded();await articlePage.screenshot({path:out+'/article-live-390.png'});
 await articlePage.getByRole('button',{name:'删除',exact:true}).click();await articlePage.getByText('订阅针灸研究',{exact:true}).waitFor({state:'hidden'});
 const after=await(await articleContext.request.get(base+'/api/sessions/'+sid+'/knowledge-state?limit=60',{headers})).json();assert.deepEqual(after.jobs.map(j=>j.id),before.jobs.map(j=>j.id));assert.deepEqual(errors,[]);
 results.push({role:'owner-article',sessionId:sid,fixedArticle:record,queuePaused:true,cancelled:true,newJobs:0,pageErrors:errors});
}finally{await articlePage?.screenshot({path:out+'/article-last-state.png'}).catch(()=>{});await articleContext.close();}
writeFileSync(out+'/live-commands-result.json',JSON.stringify({passed:true,syntheticOnly:true,paidCalls:0,results},null,2));console.log(JSON.stringify({passed:true,accounts:2,articleChecked:true,paidCalls:0}));}finally{await browser.close();}
