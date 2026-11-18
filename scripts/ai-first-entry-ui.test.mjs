import test,{after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdirSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-first-entry-2026-11-11';mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});after(()=>browser.close());
async function setup(){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/p003/'},data:{tenantSlug:ids.tenant,username:'admin@example.org',password}})).status(),201);
 const stats={creates:[],posts:[],items:[]},errors=[];let releaseCreate,failCreate=false;
 const gate=new Promise(r=>releaseCreate=r);
 await ctx.route('**/api/sessions/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  if(p.endsWith('/materials'))return route.fulfill({json:{items:[],nextCursor:null}});
  if(p==='/api/sessions/hub-source/history')return route.fulfill({json:{items:stats.creates.length?[{id:'first-entry-session',kind:'hub',title:'新对话',hasPrompt:false,updatedAt:new Date().toISOString()}]:[],page:1,hasMore:false}});
  if(p==='/api/sessions/hub-source'&&req.method()==='POST'){
   stats.creates.push(req.postDataJSON());await gate;if(failCreate){failCreate=false;return route.abort();}return route.fulfill({json:{id:'first-entry-session'}});
  }
  if(p==='/api/sessions/first-entry-session/commands'){
   if(req.method()==='GET')return route.fulfill({json:{items:stats.items,paused:false}});
   const body=req.postDataJSON();stats.posts.push(body);const row={id:'first-command',...body,status:'waiting',version:1,createdAt:new Date().toISOString()};stats.items=[row];return route.fulfill({json:row});
  }
  if(p.endsWith('/knowledge-state'))return route.fulfill({json:{hubContext:{kind:'hub',sessionId:'first-entry-session'},messages:[],jobs:[],quota:{blocked:false}}});
  return route.continue();
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/');await page.getByLabel('研究问题',{exact:true}).waitFor();await page.waitForLoadState('networkidle');
 return{ctx,page,stats,errors,releaseCreate,failCreate:()=>{failCreate=true;}};
}
test('first entry permits typing without creating a session; first Enter creates once and preserves newer input across the URL update',async()=>{
 const h=await setup();try{
  const input=h.page.getByLabel('研究问题',{exact:true});assert.equal(await input.isEnabled(),true);await input.fill('第一次进入直接提问');assert.equal(h.stats.creates.length,0);
  await input.press('Enter');await input.press('Enter');await h.page.waitForFunction(()=>document.querySelector('button[type="submit"]').textContent.includes('确认'));
  await input.fill('创建期间继续写的下一条草稿');h.releaseCreate();await h.page.waitForURL('**sessionId=first-entry-session');await h.page.locator('.thread .agent-pending-message').waitFor();assert.equal(await h.page.locator('.agent-command-queue').count(),0);
  assert.equal(h.stats.creates.length,1);assert.equal(h.stats.posts.length,1);assert.equal(h.stats.posts[0].text,'第一次进入直接提问');assert.equal(await input.inputValue(),'创建期间继续写的下一条草稿');
  assert.equal(await h.page.getByRole('link',{name:/第一次进入直接提问/}).count(),1);assert.equal(await h.page.locator('.contextRail').count(),0);assert.deepEqual(h.errors,[]);
  await h.page.screenshot({path:out+'/first-send-preserved.png'});
 }finally{h.releaseCreate();await h.ctx.close();}
});
test('unknown initial creation retains the question and retries only explicitly with the same creation key',async()=>{
 const h=await setup();try{
  const input=h.page.getByLabel('研究问题',{exact:true});assert.equal(await input.isEnabled(),true);h.failCreate();h.releaseCreate();await input.fill('首次建立超时的问题');await input.press('Enter');
  await h.page.getByRole('button',{name:'用原编号重试',exact:true}).waitFor();assert.equal(h.stats.posts.length,0);assert.equal(await input.inputValue(),'首次建立超时的问题');
  await h.page.getByRole('button',{name:'用原编号重试',exact:true}).click();await h.page.locator('.thread .agent-pending-message').waitFor();
  assert.equal(h.stats.creates.length,2);assert.equal(h.stats.creates[0].conversationKey,h.stats.creates[1].conversationKey);assert.equal(h.stats.posts.length,1);assert.equal(await input.inputValue(),'');assert.deepEqual(h.errors,[]);
 }finally{h.releaseCreate();await h.ctx.close();}
});
test('existing history still waits for its real ownership check and denial cannot create a replacement conversation',async()=>{
 const h=await setup();let release;const gate=new Promise(r=>release=r);try{
  await h.ctx.route('**/api/sessions/first-entry-session/knowledge-state**',async route=>{await gate;return route.fulfill({status:403,json:{message:'该历史会话无权读取。'}});});
  await h.page.goto(base+'/pages/ai01/?sessionId=first-entry-session');await h.page.getByLabel('研究问题',{exact:true}).waitFor();await h.page.getByText('正在加载会话…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await h.page.getByLabel('研究问题',{exact:true}).isDisabled(),true);release();await h.page.getByText('当前账号没有此会话的使用权限。',{exact:true}).waitFor();
  assert.equal(await h.page.getByLabel('研究问题',{exact:true}).isDisabled(),true);assert.equal(h.stats.creates.length,0);assert.equal(h.stats.posts.length,0);assert.deepEqual(h.errors,[]);
 }finally{release();h.releaseCreate();await h.ctx.close();}
});
