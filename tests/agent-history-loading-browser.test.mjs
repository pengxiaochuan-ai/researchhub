import test from 'node:test';import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19613',out='.tmp/ai-resumable-2026-11-16/history-'+Date.now();mkdirSync(out,{recursive:true});
test('history loads independently of a slow conversation and clears private titles on denied pagination',async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out}}),page=await context.newPage(),errors=[];let releaseState,deny=false,historyCalls=0;
 const user={accountId:'owner',tenantId:'tenant',username:'owner@example.org',displayName:'合成科研人员',authVersion:5,studyGroups:[{id:'group',name:'合成组',researchProjects:[{id:'project',name:'合成研究'}]}]};page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();const p=u.pathname;let value;
  if(q.method()!=='GET'){errors.push('Unexpected write');return route.abort();}
  if(p==='/api/auth/me')value=user;else if(p==='/api/agents')value=[{id:'research',type:'research'}];else if(p==='/api/knowledge/ai-status')value={quota:{blocked:false}};
  else if(p.endsWith('/knowledge-state')){await new Promise(resolve=>{releaseState=resolve;});value={hubContext:{kind:'hub',sessionId:'slow-session'},messages:[],jobs:[],nextCursor:null,quota:{blocked:false}};}
  else if(p.endsWith('/history')){historyCalls++;if(deny)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'当前无权查看会话'})});value={items:[{id:'slow-session',title:'本人历史问题',hasPrompt:true,kind:'hub',updatedAt:new Date().toISOString()}],page:1,hasMore:true};}
  else value={items:[],nextCursor:null};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 });
 try{
  await page.goto(base+'/scripts/fixtures/upload-focus-harness.html?sessionId=slow-session');await page.waitForFunction(()=>document.querySelector('.thread')?.textContent.includes('正在加载会话'));
  await page.getByRole('link',{name:'本人历史问题 · Hub 问答',exact:true}).waitFor({timeout:1500});assert(historyCalls>0);assert.equal(await page.getByRole('button',{name:'上传文件',exact:true}).isEnabled(),false);await page.screenshot({path:out+'/history-before-conversation.png'});
  releaseState();await page.getByRole('button',{name:'发送',exact:true}).waitFor();deny=true;await page.getByRole('button',{name:'加载更多会话',exact:true}).click();await page.getByText('暂时无法读取会话。',{exact:false}).waitFor();assert.equal(await page.locator('.agent-history-group .conv').count(),0);await page.screenshot({path:out+'/access-denied.png'});assert.deepEqual(errors,[]);
 }catch(error){await page.screenshot({path:out+'/failure.png'});throw error;}finally{releaseState?.();await context.close();await browser.close();}
});
test('SPA cached history still revalidates the exact Hub authority when Agent listing itself remains available',async()=>{
 const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext(),page=await context.newPage();let deny=false,calls=0;
 const user={accountId:'owner',tenantId:'tenant',username:'owner@example.org',displayName:'合成科研人员',studyGroups:[{id:'g',name:'合成组',researchProjects:[{id:'p',name:'合成研究'}]}]};
 await context.route('**/api/**',async r=>{const u=new URL(r.request().url()),p=u.pathname;let v;if(p==='/api/auth/me')v=user;else if(p==='/api/agents')v=[{id:'research',type:'research'}];else if(p==='/api/knowledge/ai-status')v={quota:{blocked:false}};else if(p.endsWith('/history')){calls++;if(deny)return r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'当前Hub授权已失效'})});v={items:['first-session','next-session'].map(id=>({id,title:id,kind:'hub',hasPrompt:true,updatedAt:new Date().toISOString()})),page:1,hasMore:false};}else if(p.endsWith('/knowledge-state'))v={hubContext:{kind:'hub',sessionId:p.split('/')[3]},messages:[],jobs:[],nextCursor:null,quota:{blocked:false}};else v={items:[],nextCursor:null};return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(v)});});
 try{await page.goto(base+'/scripts/fixtures/upload-focus-harness.html?sessionId=first-session');await page.getByRole('link',{name:'next-session · Hub 问答',exact:true}).waitFor();const before=calls;deny=true;await page.getByRole('link',{name:'next-session · Hub 问答',exact:true}).click();await page.getByText('暂时无法读取会话。',{exact:false}).waitFor({timeout:1800});assert(calls>before);assert.equal(await page.locator('.agent-history-group .conv').count(),0);}finally{await context.close();await browser.close();}
});
