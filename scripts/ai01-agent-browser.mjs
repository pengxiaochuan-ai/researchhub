import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:19501',rt=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json'));
const out='docs/testing/evidence/ai01-agent-browser-'+randomUUID();mkdirSync(out,{recursive:true});
const pw=await import('../../app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[],errors=[],writes=[],contexts=[],headers={'X-Study-Group-Id':rt.ids.group,'X-Research-Project-Id':rt.ids.project};
let adminSession;
try{
 for(const actor of ['admin','owner']){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'},reducedMotion:'reduce'});contexts.push(ctx);
  const login=await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:actor+'@example.org',password:rt.password}});assert(login.ok());
  const historyResponse=await ctx.request.get(base+'/api/sessions/hub-source/history?page=1&limit=50',{headers});assert.equal(historyResponse.status(),200);
  const list=await historyResponse.json();assert(list.items.length>0);assert(list.items.some(s=>s.kind==='article'));
  const hub=list.items.find(s=>s.kind==='hub');assert(hub);
  if(actor==='admin')adminSession=list.items.find(s=>s.kind==='article');else{assert(!list.items.some(s=>s.id===adminSession.id));const cross=await ctx.request.get(base+`/api/sessions/cmw4onvzf001cluraslwaq1kb/knowledge-state?limit=60`,{headers});assert([403,404].includes(cross.status()));}
  const invalid=await ctx.request.get(base+'/api/sessions/hub-source/history?page=0&limit=50',{headers});assert.equal(invalid.status(),400);
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push({actor,message:e.message}));
  await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(!['http:','https:'].includes(u.protocol))return route.continue();if(u.origin!==base)return route.abort();if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!['/api/auth/renew'].includes(u.pathname)){writes.push({actor,path:u.pathname});return route.abort();}return route.continue();});
  await page.goto(base+'/pages/ai01/?sessionId='+hub.id);await page.locator('.conversationList a.conv').first().waitFor();await page.locator('#hub-agent-question').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#hub-agent-question')?.disabled,{timeout:30000});
  async function fit(selector,label){const box=page.locator(selector),sizes=[];for(const value of ['核对当前资料',Array.from({length:10},(_,i)=>'问题第'+i+'行').join('\n'),'']){await box.fill(value);await page.waitForTimeout(100);const m=await box.evaluate(el=>({height:el.getBoundingClientRect().height,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY,value:el.value,disabled:el.disabled}));assert.equal(m.value,value);assert.equal(m.disabled,false);sizes.push(m);}assert.equal(sizes[0].height,60);assert(sizes[1].height>sizes[0].height&&sizes[1].height<=148);assert.equal(sizes[1].overflow,'auto');assert.equal(sizes[2].height,60);return{label,sizes};}
  const genericFit=await fit('#hub-agent-question','Hub');await page.screenshot({path:out+'/'+actor+'-hub.png'});
  if(actor==='admin'){
   const original=await ctx.request.get(base+`/api/sessions/${hub.id}/knowledge-state?limit=60`,{headers}).then(r=>r.json());
   await page.locator('#hub-agent-question').fill('权限核对时保留的草稿');
   let release;const held=new Promise(r=>{release=r;}),pattern='**/api/sessions/'+hub.id+'/knowledge-state?*';let calls=0;
   await page.route(pattern,async route=>{calls++;if(calls===1){await held;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...original,messages:[{id:'late',role:'assistant',content:'LATE_RESULT_MUST_NOT_RETURN'}]})});}else await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'当前会话授权不可用'})});});
   await page.getByRole('button',{name:'查看状态',exact:true}).click();await page.waitForFunction(()=>true);
   for(let n=0;n<100&&calls<1;n++)await page.waitForTimeout(20);assert(calls>=1,'delayed GET not observed');
   await page.getByRole('button',{name:'查看状态',exact:true}).click();await page.getByText('当前会话授权不可用',{exact:true}).waitFor();release();await page.waitForTimeout(150);
   assert.equal(await page.locator('.agent-message').count(),0);assert.equal(await page.locator('#hub-agent-question').inputValue(),'权限核对时保留的草稿');assert(await page.locator('#hub-agent-question').isDisabled());assert(!await page.getByText('LATE_RESULT_MUST_NOT_RETURN').count());await page.screenshot({path:out+'/admin-revoked-and-late.png'});await page.unroute(pattern);
  }
  await page.reload();await page.locator('.conversationList a.conv[aria-current="page"]').waitFor();assert(page.url().includes(hub.id));
  const article=actor==='admin'?list.items.find(s=>s.recovery):list.items.find(s=>s.kind==='article'&&s.recovery);assert(article);
  const link=page.locator('.conversationList a.conv').filter({hasText:article.title}).first();
  // It can be beyond page one; the known authorized same-origin route remains exact.
  const articleUrl='/pages/ai01/?'+new URLSearchParams({articleId:article.recordId,requestKey:article.recovery.requestKey,inputHash:article.recovery.inputHash});
  if(await link.count()){await link.click();}else await page.goto(base+articleUrl);
  await page.locator('#article-ai-question').waitFor();await page.waitForFunction(()=>!document.querySelector('#article-ai-question')?.disabled,{timeout:30000});
  await page.screenshot({path:out+'/'+actor+'-article-enter.png'});
  try{await page.locator('.agent-message').first().waitFor({timeout:15000});}catch(e){writeFileSync(out+'/'+actor+'-failure.txt',await page.locator('main').innerText());throw e;}
  const articleFit=await fit('#article-ai-question','article');await page.screenshot({path:out+'/'+actor+'-article.png'});
  if(await page.locator('.hub-agent-answer').count()){
   const answerBox=await page.locator('.hub-agent-answer').last().boundingBox(),threadBox=await page.locator('.thread').boundingBox();assert(answerBox.y<threadBox.y+threadBox.height&&answerBox.y+answerBox.height>threadBox.y,'latest answer must be visible after restoring history');
  }
  const count=await page.locator('.agent-message').count();await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.agent-message').length>0);assert.equal(await page.locator('.agent-message').count(),count);
  // A network failure keeps the typed question; a reload never posts or replays.
  await page.locator('#article-ai-question').fill('保留这个未发送问题');await page.route('**/api/hub-sources/article-context/**',route=>route.abort());await page.getByRole('button',{name:'查看状态',exact:true}).click();await page.getByRole('alert').first().waitFor();assert.equal(await page.locator('#article-ai-question').inputValue(),'保留这个未发送问题');await page.unroute('**/api/hub-sources/article-context/**');
  await page.setViewportSize({width:1024,height:768});await page.screenshot({path:out+'/'+actor+'-narrow.png'});
  results.push({actor,historyCount:list.items.length,hubRestored:true,articleRestored:true,threadMessages:count,genericFit,articleFit,networkRetainsDraft:true,crossAccountDenied:actor==='owner',businessWrites:0});
 }
 assert.equal(errors.length,0);assert.equal(writes.length,0);
}catch(reason){
 for(const [i,c]of contexts.entries())for(const p of c.pages()){await p.screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});writeFileSync(out+'/failure-'+i+'.txt',await p.locator('main').innerText().catch(()=>''));writeFileSync(out+'/failure-'+i+'-metrics.json',JSON.stringify(await p.locator('.thread').evaluate(el=>({top:el.scrollTop,height:el.clientHeight,scrollHeight:el.scrollHeight,messages:[...el.querySelectorAll('.agent-message')].map(m=>({id:m.getAttribute('aria-label'),top:m.getBoundingClientRect().top,height:m.clientHeight})),style:{overflow:getComputedStyle(el).overflowY}})).catch(()=>null),null,2));}
 throw reason;
}finally{
 for(const ctx of contexts)await ctx.close();await browser.close();
 writeFileSync(out+'/result.json',JSON.stringify({passed:results.length===2&&errors.length===0&&writes.length===0,results,errors,writes,realProviderCalls:0,at:new Date().toISOString()},null,2));console.log(JSON.stringify({evidence:out,completed:results.length,errors,writes}));
}
