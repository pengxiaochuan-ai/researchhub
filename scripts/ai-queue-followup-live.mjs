import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',out='.tmp/ai-queue-followup-2026-11-11';
mkdirSync(out+'/video',{recursive:true});
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.match(ids.tenant,/^rh-kb-local-[a-f0-9]{8}-tenant$/);
const headers={Origin:base,Referer:base+'/pages/ai01/','X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const role of ['owner','admin']){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
 try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers,data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);
  const r=await ctx.request.post(base+'/api/sessions/hub-source',{headers,data:{agentId:ids.tenant+'-kb-research',hubKey:'lingshu-xinyu',conversationKey:crypto.randomUUID()}});assert.equal(r.status(),201);const sid=(await r.json()).id;
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/pages/ai01/?sessionId='+sid);
  const input=page.getByLabel('研究问题',{exact:true});await input.waitFor();await page.waitForLoadState('networkidle');
  let blocked=false;
  // Explicit ambiguous scientific tasks stay free admission checks even now
  // that greetings and ordinary conversation correctly call the model.
  for(const [n,text] of ['解读报告','整理科研报告'].entries()){
   await input.fill(text);await input.press('Enter');
   await page.waitForFunction(n=>document.querySelectorAll('.agent-command-queue li').length===n,n+1);
   let current;
   for(let attempt=0;attempt<30;attempt++){current=await(await ctx.request.get(base+'/api/sessions/'+sid+'/commands',{headers})).json();if(current.items?.[n]?.status==='paused')break;await page.waitForTimeout(500);}
   assert.equal(current.items?.[n]?.status,'paused');
   if(current.items[n].pauseCode!=='HUB_SKILL_CLARIFICATION'){
    assert.match(current.items[n].errorMessage,/Token.*额度不足/);blocked=true;await page.getByText('已暂停',{exact:true}).waitFor();break;
   }
   await page.getByText('需要补充',{exact:true}).nth(n).waitFor({timeout:15000});
  }
  const v=await(await ctx.request.get(base+'/api/sessions/'+sid+'/commands',{headers})).json();assert.equal(v.paused,blocked);assert.equal(v.items.length,blocked?1:2);if(!blocked)assert(v.items.every(i=>i.pauseCode==='HUB_SKILL_CLARIFICATION'));
  assert.equal(await page.getByRole('button',{name:'加入队列',exact:true}).count(),0);await page.getByRole('button',{name:'发送',exact:true}).waitFor();
  await page.screenshot({path:out+'/'+role+'-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('.composer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+role+'-390.png'});
  for(let n=v.items.length;n>0;n--){await page.getByRole('button',{name:'删除',exact:true}).first().click();await page.waitForFunction(n=>document.querySelectorAll('.agent-command-queue li').length===n,n-1);}
  const state=await(await ctx.request.get(base+'/api/sessions/'+sid+'/knowledge-state?limit=60',{headers})).json();assert.deepEqual(state.jobs,[]);assert.deepEqual(errors,[]);
  results.push({role,sessionId:sid,clarifications:blocked?0:2,blocked,newJobs:0,pageErrors:errors});
 }finally{await ctx.close();}
}}finally{await browser.close();}
writeFileSync(out+'/results.json',JSON.stringify({passed:true,results,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,accounts:2,modelCalls:0}));
