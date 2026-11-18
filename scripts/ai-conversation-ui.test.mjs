import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
assert.match(runtime.ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
after(()=>browser.close());
const out='.tmp/ai-conversation-switch-2026-11-10';mkdirSync(out+'/video',{recursive:true});
async function setup({hasMore=false,longHistory=false,historyItems,initialEmpty=false,holdHistory=false,jobFailure}={}){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',recordVideo:{dir:out+'/video'}});
 const login=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/p003/'},data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}});assert.equal(login.status(),201);
 const stats={history:0,creates:[],messages:0},errors=[];
 let release,releaseHistory;const held=new Promise(resolve=>{release=resolve;}),historyGate=new Promise(resolve=>{releaseHistory=resolve;});const commands=[];
 await ctx.route('**/api/sessions/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.endsWith('/materials'))return route.fulfill({json:{items:[],nextCursor:null}});
  if(url.pathname==='/api/sessions/hub-source/history'){
   stats.history++;if(holdHistory)await historyGate;return route.fulfill({json:{items:historyItems??[{id:'switch-fixture-a',kind:'hub',title:'切换测试会话A'},...(longHistory?Array.from({length:18},(_,i)=>({id:'other-'+i,kind:'hub',title:'其他合成历史会话'+i})):[]),{id:'switch-fixture-b',kind:'hub',title:'切换测试会话B'}],page:1,hasMore}});
  }
  if(url.pathname.endsWith('/commands')){
   if(req.method()==='GET')return route.fulfill({json:{items:commands,paused:false}});
   if(req.method()==='POST'){stats.messages++;const body=req.postDataJSON(),item={id:'command-'+stats.messages,text:body.text,requestKey:body.requestKey,status:'waiting',version:1,createdAt:new Date().toISOString()};commands.push(item);return route.fulfill({json:item});}
  }
  if(url.pathname==='/api/sessions/hub-source'&&req.method()==='POST'){
   stats.creates.push(req.postDataJSON());await held;return route.fulfill({json:{id:'switch-fixture-new'}});
  }
  const match=url.pathname.match(/^\/api\/sessions\/(switch-fixture-(?:a|b|new))\/knowledge-state$/);
  if(match){const id=match[1];return route.fulfill({json:{hubContext:{kind:'hub',sessionId:id},messages:id.endsWith('-new')||initialEmpty&&id.endsWith('-a')?[]:[{id:id+'-message',role:'user',content:id.endsWith('-a')?'旧会话A独有问题':'历史会话B独有问题'}],jobs:jobFailure?[{id:'failed-planning',userMessageId:id+'-message',status:'failed',...jobFailure}]:[],quota:{blocked:false}}});}
  if(req.method()!=='GET'){stats.messages++;return route.abort();}
  return route.continue();
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/pages/ai01/?sessionId=switch-fixture-a');
 if(initialEmpty)await page.getByLabel('研究问题',{exact:true}).waitFor();else await page.getByText('旧会话A独有问题',{exact:true}).waitFor();
 if(!holdHistory){await page.getByRole('link',{name:/切换测试会话B/}).waitFor();await page.waitForLoadState('networkidle');}
 return{ctx,page,stats,errors,release,releaseHistory};
}

test('planning clarification is actionable in the original conversation status, while internal errors are not exposed',async()=>{
 for(const visible of [true,false]){
  const h=await setup({jobFailure:visible?{errorCode:'HUB_LITERATURE_PLAN_CLARIFICATION',errorMessage:'希望限定哪类研究人群？'}:{errorCode:'INTERNAL_ERROR',errorMessage:'private database stack'}});
  try{
   if(visible)await h.page.getByText(/需要补充：希望限定哪类研究人群/).waitFor();else await h.page.getByText(/本次未交付回答；问题已保留/).waitFor();
   assert.equal(await h.page.getByText('private database stack',{exact:false}).count(),0);assert.equal(await h.page.getByLabel('研究问题',{exact:true}).isEnabled(),true);
   assert.equal(h.stats.messages,0);assert.deepEqual(h.errors,[]);await h.page.screenshot({path:'.tmp/ai-natural-task-2026-11-11/'+(visible?'clarification':'private-failure')+'.png'});
  }finally{h.release();await h.ctx.close();}
 }
});

test('history displays exclusive time groups and twelve-character one-line titles without changing navigation',async()=>{
 const today=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T12:00:00+08:00');
 const date=n=>new Date(today.getTime()-n*86400000).toISOString(),long='一二三四五六七八九十一二三四五六七八九';
 const items=[{id:'switch-fixture-a',kind:'hub',title:'切换测试会话A',updatedAt:date(0)},{id:'switch-fixture-b',kind:'hub',title:'切换测试会话B',updatedAt:date(0)},...[1,3,10,40].map(n=>({id:'day-'+n,kind:'hub',title:long,updatedAt:date(n)}))];
 const h=await setup({historyItems:items});try{
  for(const name of ['今天','昨天','7天内','30天内'])await h.page.getByRole('heading',{name,exact:true}).waitFor({timeout:4000});
  const heading=await h.page.locator('.agent-history-group h3').allTextContents();assert.equal(heading.length,5);assert.match(heading[4],/^\d{4}-\d{2}$/);
  const link=h.page.locator('a.conv').filter({has:h.page.locator('b',{hasText:'一二三四五六七八九十一二'})}).first();assert.equal(await link.locator('b').innerText(),'一二三四五六七八九十一二');
  assert((await link.getAttribute('aria-label')).includes(long));const box=await link.locator('b').evaluate(e=>({height:e.getBoundingClientRect().height,line:getComputedStyle(e).lineHeight,whiteSpace:getComputedStyle(e).whiteSpace}));assert.equal(box.whiteSpace,'nowrap');assert(box.height<=parseFloat(box.line)+1);
  const requests=h.stats.history;await h.page.getByRole('link',{name:/切换测试会话B/}).click();await h.page.getByText('历史会话B独有问题',{exact:true}).waitFor();assert.equal(h.stats.history,requests);assert.deepEqual(h.errors,[]);
  await h.page.screenshot({path:'.tmp/ai-history-timeline-2026-11-11/grouped-desktop.png'});await h.page.setViewportSize({width:390,height:844});await h.page.screenshot({path:'.tmp/ai-history-timeline-2026-11-11/grouped-390.png'});
 }finally{h.release();await h.ctx.close();}
});
test('a confirmed first question appears without refetching history and survives an older empty-history response',async()=>{
 const h=await setup({initialEmpty:true,holdHistory:true,historyItems:[{id:'switch-fixture-a',kind:'hub',title:'新对话',hasPrompt:false,updatedAt:'2026-11-10T00:00:00Z'},{id:'switch-fixture-b',kind:'hub',title:'切换测试会话B',hasPrompt:true}]});
 try{
  const input=h.page.getByLabel('研究问题',{exact:true});await input.fill('第一次发送的问题需要显示成标题');await input.press('Enter');await h.page.locator('.thread .agent-pending-message').waitFor();
  const reads=h.stats.history;h.releaseHistory();const link=h.page.getByRole('link',{name:/第一次发送的问题需要显示成标题/});await link.waitFor();assert.equal(await link.locator('b').textContent(),'第一次发送的问题需要显示');assert.equal(h.stats.history,reads);
  await input.fill('第二次发送不能替换首次提问');await input.press('Enter');await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();assert.equal(await h.page.locator('.agent-command-queue li').count(),1);assert.equal(await link.count(),1);assert.equal(h.stats.history,reads);assert.deepEqual(h.errors,[]);
 }finally{h.releaseHistory();h.release();await h.ctx.close();}
});
test('new conversation clears old messages before creation responds and sends a distinct creation key',async()=>{
 const h=await setup();
 try{
  await h.page.getByLabel('研究问题',{exact:true}).fill('留在旧会话的草稿');
  await h.page.getByRole('button',{name:'＋ 新建对话',exact:true}).first().click();
  assert.equal(await h.page.getByLabel('研究问题',{exact:true}).inputValue(),'');
  assert.equal(await h.page.getByText('旧会话A独有问题',{exact:true}).count(),0,'old question remained during new-conversation creation');
  h.release();await h.page.waitForURL('**sessionId=switch-fixture-new');
  assert.equal(await h.page.locator('.agent-message').count(),0);
  assert.match(h.stats.creates[0].conversationKey,/^[a-f0-9-]{36}$/);
  assert.equal(h.stats.messages,0);assert.deepEqual(h.errors,[]);
 }finally{h.release();await h.page.screenshot({path:out+'/controlled-new.png'});await h.ctx.close();}
});

test('history selection retains the document and left list without reloading history',async()=>{
 const h=await setup();
 try{
  const origin=await h.page.evaluate(()=>performance.timeOrigin),reads=h.stats.history;
  await h.page.getByRole('link',{name:/切换测试会话B/}).click();
  await h.page.getByText('历史会话B独有问题',{exact:true}).waitFor();
  assert.equal(await h.page.evaluate(()=>performance.timeOrigin),origin,'history click reloaded the document');
  assert.equal(h.stats.history,reads,'history list reloaded on selection');
  assert.equal(await h.page.getByRole('link',{name:/切换测试会话A/}).count(),1);
  assert.equal(await h.page.getByText('旧会话A独有问题',{exact:true}).count(),0);
  await h.page.goBack();await h.page.getByText('旧会话A独有问题',{exact:true}).waitFor();
  assert.equal(await h.page.evaluate(()=>performance.timeOrigin),origin);
  assert.equal(await h.page.getByRole('link',{name:/切换测试会话B/}).count(),1);
  assert.equal(h.stats.messages,0);assert.deepEqual(h.errors,[]);
 }finally{h.release();await h.page.screenshot({path:out+'/controlled-history.png'});await h.ctx.close();}
});

test('creating from A then choosing A restores A content, not the new empty conversation',async()=>{
 const h=await setup();
 try{
  h.release();await h.page.getByRole('button',{name:'＋ 新建对话',exact:true}).first().click();
  await h.page.waitForURL('**sessionId=switch-fixture-new');
  await h.page.getByRole('link',{name:/切换测试会话A/}).click();
  await h.page.getByText('旧会话A独有问题',{exact:true}).waitFor({timeout:5000});
  assert.equal(new URL(h.page.url()).searchParams.get('sessionId'),'switch-fixture-a');
 }finally{h.release();await h.ctx.close();}
});

test('switching history during delayed pagination leaves load-more usable',async()=>{
 const h=await setup({hasMore:true});let releasePage,started;
 const blocked=new Promise(resolve=>{releasePage=resolve;}),requested=new Promise(resolve=>{started=resolve;});
 try{
  await h.ctx.route('**/api/sessions/hub-source/history?page=2&limit=20',async route=>{started();await blocked;await route.fulfill({json:{items:[],page:2,hasMore:false}}).catch(()=>{});});
  await h.page.getByRole('button',{name:'加载更多会话',exact:true}).click();await requested;
  await h.page.getByRole('link',{name:/切换测试会话B/}).click();await h.page.getByText('历史会话B独有问题',{exact:true}).waitFor();
  assert.equal(await h.page.getByRole('button',{name:'加载更多会话',exact:true}).isEnabled(),true);
 }finally{releasePage();h.release();await h.ctx.close();}
});

test('selecting a history near the bottom preserves left sidebar scroll position',async()=>{
 const h=await setup({longHistory:true});
 try{
  const sidebar=h.page.locator('.conversationList');
  await sidebar.evaluate(e=>{e.scrollTop=e.scrollHeight;});
  const before=await sidebar.evaluate(e=>e.scrollTop);assert(before>50);
  await h.page.getByRole('link',{name:/切换测试会话B/}).click();await h.page.getByText('历史会话B独有问题',{exact:true}).waitFor();
  assert(Math.abs(await sidebar.evaluate(e=>e.scrollTop)-before)<1,'left sidebar jumped to top');
 }finally{h.release();await h.ctx.close();}
});
