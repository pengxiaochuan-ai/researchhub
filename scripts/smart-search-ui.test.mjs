import test,{after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdirSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/smart-search-2026-11-12';mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});after(()=>browser.close());
async function setup(){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/p003/'},data:{tenantSlug:ids.tenant,username:'owner@example.org',password}})).status(),201);
 const posts=[],errors=[];let items=[],fail=false;
 await ctx.route('**/api/sessions/**',async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  if(p.endsWith('/history'))return route.fulfill({json:{items:[],page:1,hasMore:false}});
  if(p==='/api/sessions/hub-source'&&req.method()==='POST')return route.fulfill({json:{id:'smart-ui-session'}});
  if(p.endsWith('/knowledge-state'))return route.fulfill({json:{hubContext:{kind:'hub',sessionId:'smart-ui-session'},messages:[],jobs:[{id:'active',status:'processing'}],quota:{blocked:false}}});
  if(p==='/api/sessions/smart-ui-session/commands'){
   if(req.method()==='GET')return route.fulfill({json:{items,paused:false}});
   const body=req.postDataJSON();posts.push(body);if(fail)return route.abort();const item={...body,id:'cmd-'+posts.length,version:1,status:'waiting'};items.push(item);return route.fulfill({json:item});
  }
  const edit=p.match(/\/commands\/(cmd-\d+)$/);if(edit&&req.method()==='PATCH'){const item=items.find(i=>i.id===edit[1]);item.text=req.postDataJSON().text;item.version++;return route.fulfill({json:item});}
  return route.continue();
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/');await page.getByLabel('研究问题',{exact:true}).waitFor();await page.waitForLoadState('networkidle');
 return{ctx,page,posts,errors,setFail:v=>{fail=v;}};
}
test('smart search defaults off, freezes queued intent, keeps it on text edit and resets on new/refresh',async()=>{
 const h=await setup();try{
  await h.page.screenshot({path:out+'/composer-baseline-or-current.png'});
  const toggle=h.page.getByRole('button',{name:'智能搜索',exact:true}),input=h.page.getByLabel('研究问题',{exact:true});
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');await toggle.focus();await toggle.press('Space');assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  await h.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await h.page.waitForFunction(()=>document.querySelector('.real-ai-workspace')?.getAttribute('aria-busy')==='false');assert.equal(await toggle.getAttribute('aria-pressed'),'true','same-identity revalidation must not silently clear composer consent');
  await input.fill('查询针灸抑郁公开研究');await input.press('Enter');await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();
  assert.equal(h.posts[0].networkIntent.enabled,true);assert.equal(await toggle.getAttribute('aria-pressed'),'true');await toggle.click();
  await h.page.getByRole('button',{name:'编辑',exact:true}).click();await h.page.getByLabel('修改待执行指令').fill('查询针灸失眠公开研究');await h.page.getByRole('button',{name:'保存修改',exact:true}).click();
  assert.equal(await h.page.locator('.agent-command-queue').getByText('智能搜索',{exact:true}).count(),1);
  await input.fill('只用Hub已审核资料');await input.press('Enter');await h.page.waitForTimeout(100);assert.equal(h.posts[1].networkIntent.enabled,false);
  await toggle.click();await h.page.getByRole('button',{name:'＋ 新建对话',exact:true}).click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await toggle.click();await h.page.reload();await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.deepEqual(h.errors,[]);
  await h.page.screenshot({path:out+'/composer-off.png'});
 }finally{await h.ctx.close();}
});
test('unknown submission explicit retry reuses original network flag and key after toggle changes',async()=>{
 const h=await setup();try{
  const toggle=h.page.getByRole('button',{name:'智能搜索',exact:true}),input=h.page.getByLabel('研究问题',{exact:true});await toggle.click();h.setFail(true);await input.fill('查询世界卫生组织抑郁资料');await input.press('Enter');
  await h.page.getByRole('button',{name:'用原编号重试',exact:true}).waitFor();await toggle.click();h.setFail(false);await h.page.getByRole('button',{name:'用原编号重试',exact:true}).click();await h.page.getByRole('button',{name:'编辑',exact:true}).waitFor();
  assert.equal(h.posts.length,2);assert.deepEqual(h.posts[0],h.posts[1]);assert.equal(h.posts[1].networkIntent.enabled,true);assert.deepEqual(h.errors,[]);
 }finally{await h.ctx.close();}
});
test('partial and candidate-only deliveries never announce a full body interpretation',async()=>{
 const h=await setup();try{
  const messages=[{id:'u',role:'user',content:'合成验证问题'},{id:'a',role:'assistant',content:'合成验证候选范围',meta:{sourceStatus:'snapshot',provenance:{webOutput:{status:'candidate-only'}}}}],jobs=[{id:'j',userMessageId:'u',assistantMessageId:'a',status:'completed'}];
  await h.ctx.route('**/api/sessions/smart-ui-session/knowledge-state**',route=>route.fulfill({json:{hubContext:{kind:'hub',sessionId:'smart-ui-session'},messages,jobs,quota:{blocked:false}}}));
  await h.page.goto(base+'/pages/ai01/?sessionId=smart-ui-session');await h.page.getByText('本次仅提供检索候选，未完成正文解读。',{exact:true}).waitFor();assert.equal(await h.page.getByText('本次回答已完成。',{exact:true}).count(),0);
  messages[1].meta.provenance.webOutput.status='partial';await h.page.reload();await h.page.getByText('已交付可读取部分，未读取范围请核对回答。',{exact:true}).waitFor();assert.deepEqual(h.errors,[]);
 }finally{await h.ctx.close();}
});
test('only backend-projected snapshot links are clickable; other model URLs and images stay disabled',async()=>{
 const h=await setup();try{
  const messages=[{id:'a',role:'assistant',content:'[真实来源](https://example.org/actual) [伪造链接](https://forged.invalid/) ![外站图片](https://forged.invalid/image.png)',meta:{sourceStatus:'snapshot',provenance:{webEvidence:{sources:[{url:'https://example.org/actual'}],tools:[]}}}}];
  await h.ctx.route('**/api/sessions/smart-ui-session/knowledge-state**',route=>route.fulfill({json:{hubContext:{kind:'hub',sessionId:'smart-ui-session'},messages,jobs:[],quota:{blocked:false}}}));await h.page.goto(base+'/pages/ai01/?sessionId=smart-ui-session');await h.page.locator('.hub-agent-answer').waitFor();
  assert.equal(await h.page.getByRole('link',{name:'真实来源',exact:true}).count(),1);assert.equal(await h.page.getByRole('link',{name:'伪造链接',exact:true}).count(),0);assert.equal(await h.page.locator('.hub-agent-answer img').count(),0);assert.deepEqual(h.errors,[]);
  messages[0].meta.sourceStatus='restricted';await h.page.reload();await h.page.locator('.hub-agent-answer').waitFor();assert.equal(await h.page.getByRole('link',{name:'真实来源',exact:true}).count(),0,'restricted projection must not retain clickable evidence');
 }finally{await h.ctx.close();}
});
