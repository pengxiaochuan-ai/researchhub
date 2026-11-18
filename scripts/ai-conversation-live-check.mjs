import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-conversation-switch-2026-11-10';
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
mkdirSync(out+'/live-video',{recursive:true});
const results=[];
try{
 for(const role of ['owner','admin']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/live-video'}});
  try{
   const login=await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}});assert.equal(login.status(),201);
   const history=await ctx.request.get(base+'/api/sessions/hub-source/history?page=1&limit=20',{headers});assert.equal(history.status(),200);
   const initial=await history.json(),old=initial.items.find(item=>item.kind==='hub');assert(old,'existing Hub history required for real regression');
   const p=await ctx.newPage(),errors=[],requests={history:0,model:0,creates:0};
   await ctx.route('**/api/sessions/*/knowledge-messages',route=>{requests.model++;return route.abort();});
   p.on('pageerror',e=>errors.push(e.message));
   p.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/api/sessions/hub-source/history')requests.history++;if(path==='/api/sessions/hub-source'&&req.method()==='POST')requests.creates++;});
   await p.goto(base+'/pages/ai01/?sessionId='+old.id);
   await p.getByRole('button',{name:'查看状态',exact:true}).waitFor();
   await p.locator('.conversationList a.conv').first().waitFor();
   const documentOrigin=await p.evaluate(()=>performance.timeOrigin),created=[];
   for(let n=0;n<2;n++){
    const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/sessions/hub-source'&&r.request().method()==='POST');
    await p.getByRole('button',{name:'＋ 新建对话',exact:true}).first().click();
    const r=await response;assert.equal(r.status(),201);
    const value=await r.json(),body=r.request().postDataJSON();assert.match(body.conversationKey,/^[a-f0-9-]{36}$/);
    await p.waitForURL('**sessionId='+value.id);await p.getByRole('button',{name:'查看状态',exact:true}).waitFor();await p.waitForLoadState('networkidle');
    assert.equal(await p.locator('.agent-message').count(),0);assert.notEqual(value.id,old.id);
    const replay=await ctx.request.post(base+'/api/sessions/hub-source',{headers,data:body});assert.equal(replay.status(),201);assert.equal((await replay.json()).id,value.id);
    const state=await ctx.request.get(base+'/api/sessions/'+value.id+'/knowledge-state?limit=60',{headers});assert.equal(state.status(),200);
    const saved=await state.json();assert.deepEqual(saved.messages,[]);assert.deepEqual(saved.jobs,[]);created.push(value.id);
   }
   assert.notEqual(created[0],created[1]);
   const list=await ctx.request.get(base+'/api/sessions/hub-source/history?page=1&limit=20',{headers});const items=(await list.json()).items;
   assert(created.every(id=>items.some(item=>item.id===id&&item.kind==='hub')));assert(items.some(item=>item.id===old.id));
   const stayedOnNew=documentOrigin===await p.evaluate(()=>performance.timeOrigin);assert(stayedOnNew);
   await p.reload();await p.getByRole('button',{name:'查看状态',exact:true}).waitFor();await p.waitForLoadState('networkidle');assert.equal(await p.locator('.agent-message').count(),0);
   const beforeSwitch=await p.evaluate(()=>performance.timeOrigin),reads=requests.history;
   await p.locator('.conversationList a[href="/pages/ai01/?sessionId='+old.id+'"]').click();
   await p.waitForURL('**sessionId='+old.id);await p.getByRole('button',{name:'查看状态',exact:true}).waitFor();
   assert.equal(await p.evaluate(()=>performance.timeOrigin),beforeSwitch);assert.equal(requests.history,reads);
   assert.equal(await p.locator('.conversationList a.conv').count(),items.length);
   await p.screenshot({path:out+'/'+role+'-history.png'});
   await p.locator('.conversationList a[href="/pages/ai01/?sessionId='+created[0]+'"]').click();
   await p.waitForURL('**sessionId='+created[0]);await p.getByRole('button',{name:'查看状态',exact:true}).waitFor();await p.waitForLoadState('networkidle');
   assert.equal(await p.locator('.agent-message').count(),0);
   await p.screenshot({path:out+'/'+role+'-new.png'});
   await p.setViewportSize({width:390,height:844});await p.screenshot({path:out+'/'+role+'-390.png'});
   assert.equal(requests.creates,2);assert.equal(requests.model,0);assert.deepEqual(errors,[]);
   if(results.length){const cross=await ctx.request.get(base+'/api/sessions/'+results[0].created[0]+'/knowledge-state?limit=60',{headers});assert.equal(cross.status(),404);}
   results.push({role,created,oldSession:old.id,requests,pageErrors:errors,documentStayedOnNew:stayedOnNew});
  }finally{await ctx.close();}
 }
 writeFileSync(out+'/live-result.json',JSON.stringify({passed:true,syntheticOnly:true,modelRequests:0,results},null,2));console.log(JSON.stringify({passed:true,accounts:results.length,newEmptyConversations:results.flatMap(r=>r.created).length,modelRequests:0}));
}finally{await browser.close();}
