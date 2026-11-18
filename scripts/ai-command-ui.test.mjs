import test,{after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdirSync} from 'node:fs';
const base='http://127.0.0.1:19501',root='/Users/mac/aisciencesys/',out='.tmp/ai-conversation-acceptance-2026-11-10';mkdirSync(out+'/video',{recursive:true});
const statusOut='.tmp/ai-send-status-2026-11-11';mkdirSync(statusOut,{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});after(()=>browser.close());
async function setup(running=false){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/p003/'},data:{tenantSlug:ids.tenant,username:'owner@example.org',password}})).status(),201);
 let items=[],hold=false,abortPost=false,denied=false,conflict=false,conflictText=false,release=()=>{},postCount=0,renderedMessages=[],activeJob={id:'active',status:'processing'};const errors=[];
 await ctx.route('**/api/**',async route=>{const req=route.request(),p=new URL(req.url()).pathname;
  if(p==='/api/knowledge/ai-status')return route.fulfill({json:{quota:{blocked:false,canStart:true}}});
  if(denied&&(p.endsWith('/knowledge-state')||p.endsWith('/commands')))return route.fulfill({status:403,json:{message:'当前授权已变化。'}});
  if(p.endsWith('/history'))return route.fulfill({json:{items:[{id:'command-ui-session',kind:'hub',title:'命令队列合成会话'}],page:1,hasMore:false}});
  if(p.endsWith('/knowledge-state'))return route.fulfill({json:{hubContext:{kind:'hub',sessionId:'command-ui-session'},messages:renderedMessages,jobs:running?[activeJob]:[],quota:{blocked:false}}});
  if(p==='/api/sessions/command-ui-session/commands'){
   if(req.method()==='GET')return route.fulfill({json:{items,paused:items.some(i=>i.status==='paused'&&i.pauseCode!=='HUB_SKILL_CLARIFICATION')} });
   const body=req.postDataJSON();postCount++;
   const i={id:'cmd-'+postCount,text:body.text,status:'waiting',version:1,requestKey:body.requestKey};items.push(i);if(hold)await new Promise(r=>release=r);if(abortPost)return route.abort();return route.fulfill({json:i});
  }
  const m=p.match(/\/commands\/(cmd-\d+)(\/cancellation)?$/);
  if(m){const i=items.find(i=>i.id===m[1]);if(conflict){conflict=false;i.status='paused';i.version++;if(conflictText)i.text='另一个窗口修改后的指令';return route.fulfill({status:409,json:{message:'状态已变化'}});}assert.equal(req.postDataJSON().version,i.version);if(m[2])items=items.filter(x=>x!==i);else{i.text=req.postDataJSON().text;i.version++;}return route.fulfill({json:i});}
  if(req.method()==='POST'&&p.endsWith('/knowledge-messages'))throw Error('Legacy model path must not be used in this test');
  return route.continue();
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/?sessionId=command-ui-session');await page.getByLabel('研究问题',{exact:true}).waitFor();await page.waitForLoadState('networkidle');
 return{ctx,page,errors,hold:()=>{hold=true;},release:()=>release(),abortPost:()=>{abortPost=true;release();},deny:()=>{denied=true;},conflict:(textChanged=false)=>{conflict=true;conflictText=textChanged;},count:()=>postCount,setItems:v=>{items=v;},setRunning:v=>{running=v;},setTranscript:(messages,job)=>{renderedMessages=messages;activeJob=job;},close:async()=>{release();await ctx.close();}};
}
test('Enter sends once, Shift+Enter makes a newline, IME and empty Enter never submit',async()=>{
 const h=await setup(true);try{
  const input=h.page.getByLabel('研究问题',{exact:true});await input.fill('检索针灸研究');
  assert.equal(await h.page.getByRole('button',{name:'加入队列',exact:true}).count(),0);
  await h.page.getByRole('button',{name:'发送',exact:true}).waitFor();
  await input.press('Shift+Enter');assert.equal(h.count(),0);assert((await input.inputValue()).includes('\n'));
  await input.dispatchEvent('compositionstart');await input.press('Enter');await input.dispatchEvent('compositionend');assert.equal(h.count(),0);
  await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',keyCode:229});assert.equal(h.count(),0);
  await input.press('Enter');await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();assert.equal(h.count(),1);
  await input.press('Enter');assert.equal(h.count(),1);
  await input.fill('比较上述两篇论文');await input.press('Enter');await h.page.waitForFunction(()=>document.querySelectorAll('.agent-command-queue li').length===2);assert.equal(h.count(),2);
  await h.page.screenshot({path:out+'/enter-autoqueue.png'});assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
test('new conversation body does not contain static capability or session-ready copy',async()=>{
 const h=await setup();try{for(const text of ['Hub 文献检索与问答','当前Hub会话已建立；每次回答分别标明实际来源与阅读范围。'])assert.equal(await h.page.locator('.thread').getByText(text,{exact:true}).count(),0);assert.equal(await h.page.getByRole('button',{name:'查看状态',exact:true}).count(),0);}finally{await h.close();}
});
test('clarification is not counted as waiting and normal idle sending stays in the conversation without a queue card',async()=>{
 const h=await setup(true);try{
  h.setItems([{id:'clarify',text:'需要补充研究对象',status:'paused',pauseCode:'HUB_SKILL_CLARIFICATION',version:1},{id:'wait',text:'明确的下一个问题',status:'waiting',version:1}]);
  await h.page.getByText('需要补充 · 1',{exact:true}).waitFor({timeout:5000});await h.page.getByText('等待执行 · 1',{exact:true}).waitFor();
  assert.equal(await h.page.getByText('待执行 · 2',{exact:true}).count(),0);
  h.setItems([{id:'clarify',text:'需要补充研究对象',status:'paused',pauseCode:'HUB_SKILL_CLARIFICATION',version:1}]);
  await h.page.getByText('等待执行 · 1',{exact:true}).waitFor({state:'hidden'});await h.page.getByText('需要补充 · 1',{exact:true}).waitFor();
 }finally{await h.close();}
 const idle=await setup();try{
  await idle.page.getByLabel('研究问题',{exact:true}).fill('介绍下你自己');await idle.page.getByRole('button',{name:'发送',exact:true}).click();
  await idle.page.locator('.thread .agent-pending-message').filter({hasText:'介绍下你自己'}).waitFor({timeout:4000});assert.equal(await idle.page.locator('.agent-command-queue').count(),0);assert.equal(await idle.page.getByText('正在处理…',{exact:true}).count(),1);
  await idle.page.screenshot({path:statusOut+'/normal-pending-desktop.png'});await idle.page.setViewportSize({width:390,height:844});await idle.page.locator('.thread').scrollIntoViewIfNeeded();await idle.page.screenshot({path:statusOut+'/normal-pending-390.png'});
 }finally{await idle.close();}
});
test('processing allows typing and queue edit/delete; late submission never erases newer input',async()=>{
 const h=await setup(true);try{
  const input=h.page.getByLabel('研究问题',{exact:true});assert(await input.isEnabled());h.hold();await input.fill('比较上述两篇论文');await h.page.getByRole('button',{name:'发送',exact:true}).click();
  await input.fill('后续准备输入的问题');h.release();await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();assert.equal(await input.inputValue(),'后续准备输入的问题');
  await h.page.getByRole('button',{name:'编辑',exact:true}).click();await h.page.getByLabel('修改待执行指令').fill('解读上述第一篇论文');await h.page.getByRole('button',{name:'保存修改',exact:true}).click();
  await h.page.getByText('解读上述第一篇论文',{exact:true}).waitFor();await h.page.reload();await h.page.getByText('解读上述第一篇论文',{exact:true}).waitFor();
  await h.page.screenshot({path:out+'/queue-desktop.png'});await h.page.setViewportSize({width:390,height:844});await h.page.screenshot({path:out+'/queue-390.png'});
  await h.page.getByRole('button',{name:'删除',exact:true}).click();await h.page.getByText('解读上述第一篇论文',{exact:true}).waitFor({state:'hidden'});assert.equal(h.count(),1);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
test('the normal question is not duplicated when dispatched and has only one processing line before completion',async()=>{
 const h=await setup();try{
  await h.page.getByLabel('研究问题',{exact:true}).fill('核对发送状态不重复');await h.page.getByRole('button',{name:'发送',exact:true}).click();await h.page.locator('.thread .agent-pending-message').waitFor();
  const question={id:'cmd-1',role:'user',content:'核对发送状态不重复'};
  h.setTranscript([question],{id:'active',status:'processing',userMessageId:'cmd-1'});h.setRunning(true);h.setItems([{id:'cmd-1',status:'processing',version:2}]);
  await h.page.locator('.agent-pending-message').waitFor({state:'hidden'});await h.page.getByText('正在处理，完成后自动显示回答；可继续输入下一条指令。',{exact:true}).waitFor();
  assert.equal(await h.page.locator('.thread').getByText(/正在处理/).count(),1);assert.equal(await h.page.getByText(question.content,{exact:true}).count(),1);assert.equal(await h.page.locator('.agent-command-queue').count(),0);
  h.setTranscript([question,{id:'reply',role:'assistant',content:'受控状态验证完成，不是科研结果。'}]);h.setRunning(false);h.setItems([]);await h.page.getByText('受控状态验证完成，不是科研结果。',{exact:true}).waitFor();
  assert.equal(await h.page.locator('.thread').getByText(/正在处理/).count(),0);assert.deepEqual(h.errors,[]);
 }finally{await h.close();}
});
test('article first submission shows a single normal processing state, not a queue card or unsent status',async()=>{
 const ctx=await browser.newContext();try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/p003/'},data:{tenantSlug:ids.tenant,username:'owner@example.org',password}})).status(),201);
  const source=await ctx.request.get(base+'/api/hub-sources/article-context/pmc-PMC13672493',{headers:{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project}});assert.equal(source.status(),200);
  const article={...await source.json(),existingSessionId:null,latestTask:null};let items=[];
  await ctx.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;
   if(p==='/api/hub-sources/article-context/pmc-PMC13672493'){
    return route.fulfill({json:article});
   }
   if(p==='/api/sessions/hub-source'&&req.method()==='POST')return route.fulfill({json:{id:'article-send-status'}});
   if(p==='/api/sessions/article-send-status/commands'){
    if(req.method()==='GET')return route.fulfill({json:{items,paused:false}});
    const body=req.postDataJSON(),row={id:'article-question',...body,status:'waiting',version:1,createdAt:new Date().toISOString()};items=[row];return route.fulfill({json:row});
   }
   if(p==='/api/sessions/article-send-status/knowledge-state')return route.fulfill({json:{articleContext:article,messages:[],jobs:[]}});
   return route.continue();
  });
  const page=await ctx.newPage();await page.goto(base+'/pages/ai01/?articleId=pmc-PMC13672493');await page.getByRole('region',{name:'固定文章与证据'}).waitFor();
  const input=page.getByLabel('本篇研究问题',{exact:true});await input.fill('核对本篇已选片段的研究局限');await input.press('Enter');await page.locator('.thread .agent-pending-message').waitFor({timeout:5000});
  assert.equal(await page.locator('.agent-command-queue').count(),0);assert.equal(await page.getByText('尚未发送',{exact:true}).count(),0);assert.equal(await page.getByText('正在处理…',{exact:true}).count(),1);assert.equal(await page.locator('.contextRail').count(),1);
  await page.screenshot({path:statusOut+'/article-pending.png'});
  items=[{...items[0],status:'paused',pauseCode:'HUB_SKILL_CLARIFICATION',version:2,errorMessage:'请补充明确的结局指标。'}];
  await page.getByText('请补充明确的结局指标。',{exact:true}).waitFor();assert.equal(await page.getByText('尚未发送',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'编辑',exact:true}).count(),1);
  await page.screenshot({path:statusOut+'/article-clarification.png'});
 }finally{await ctx.unrouteAll({behavior:'wait'});await ctx.close();}
});
test('GET-confirmed submission cannot be locked again by a later failed POST response',async()=>{
 const h=await setup(true);try{
  h.hold();const input=h.page.getByLabel('研究问题',{exact:true});await input.fill('比较上述两篇论文');await h.page.getByRole('button',{name:'发送',exact:true}).click();
  await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();assert.equal(await input.inputValue(),'');h.abortPost();
  await h.page.waitForTimeout(200);await input.fill('再检索针灸治疗失眠');assert(await h.page.getByRole('button',{name:'发送',exact:true}).isEnabled());assert.equal(h.count(),1);
 }finally{await h.close();}
});
test('first article session ensure timeout retries its resolver before sending the same command',async()=>{
 const ctx=await browser.newContext();try{
  const page=await ctx.newPage();await page.goto(base+'/scripts/fixtures/command-composer-harness.html');
  await page.getByLabel('研究问题',{exact:true}).fill('解读本篇研究的局限');await page.getByRole('button',{name:'发送',exact:true}).click();
  await page.getByRole('button',{name:'用原编号重试',exact:true}).click();await page.waitForFunction(()=>window.commandHarness.posts.length>0);
  const state=await page.evaluate(()=>window.commandHarness);assert.equal(state.ensureCalls,2);assert.equal(state.posts[0].path,'/sessions/harness-session/commands');
 }finally{await ctx.close();}
});
test('revoked command read clears the waiting list and pauses input rather than retaining stale access',async()=>{
 const h=await setup(true);try{
  await h.page.getByLabel('研究问题',{exact:true}).fill('比较上述两篇论文');await h.page.getByRole('button',{name:'发送',exact:true}).click();await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();h.deny();
  await h.page.getByText('当前授权已变化。',{exact:false}).first().waitFor();assert.equal(await h.page.getByRole('button',{name:'编辑',exact:true}).count(),0);assert.equal(await h.page.getByLabel('研究问题',{exact:true}).isEnabled(),false);
 }finally{await h.close();}
});
test('automatic pause without text change does not make an explicit pending deletion require a second click',async()=>{
 const h=await setup(true);try{
  await h.page.getByLabel('研究问题',{exact:true}).fill('比较上述两篇论文');await h.page.getByRole('button',{name:'发送',exact:true}).click();await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();h.conflict();
  await h.page.getByRole('button',{name:'删除',exact:true}).click();await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor({state:'hidden',timeout:5000});assert.equal(h.count(),1);
 }finally{await h.close();}
});
test('a concurrent text edit never gets silently deleted by the status-only conflict retry',async()=>{
 const h=await setup(true);try{
  await h.page.getByLabel('研究问题',{exact:true}).fill('比较上述两篇论文');await h.page.getByRole('button',{name:'发送',exact:true}).click();await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();h.conflict(true);
  await h.page.getByRole('button',{name:'删除',exact:true}).click();await h.page.getByText('另一个窗口修改后的指令',{exact:true}).waitFor();assert.equal(await h.page.getByRole('button',{name:'编辑',exact:true}).count(),1);
 }finally{await h.close();}
});
