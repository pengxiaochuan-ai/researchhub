// Read only: no task submission or provider call. Current round's exact sessions only.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const checking=process.argv.includes('--consistency')||process.argv.includes('--consistency-final');
const root='/Users/mac/aisciencesys/',out=checking?'.tmp/ai-direction-consistency-2026-11-11/'+(process.argv.includes('--consistency-final')?'final':'live'):'.tmp/ai-natural-task-2026-11-11'+(process.argv.includes('--final')?'/final':''),base='http://127.0.0.1:19501';
const state=JSON.parse(readFileSync(out+'/live-state.json')),rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const partial=process.argv.includes('--consistency-final')&&!state.passed;
if(partial){assert(state.preserved&&state.cases.length===1&&state.cases[0].role==='owner'&&state.cases[0].validated);const block=JSON.parse(readFileSync('.tmp/ai-direction-consistency-2026-11-11/admin-quota-readback.json'));assert.equal(block.quota.code,'TOKEN_QUOTA_EXCEEDED');assert.equal(block.quota.canStart,false);}else assert(state.passed);
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const c of state.cases){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
 try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/ai01/'},data:{tenantSlug:rt.ids.tenant,username:c.role+'@example.org',password:rt.password}})).status(),201);
  const page=await ctx.newPage(),posts=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET'&&new URL(r.url()).pathname.startsWith('/api/sessions/'))posts.push(new URL(r.url()).pathname);});
  await page.goto(base+'/pages/ai01/?sessionId='+c.sessionId);const direction=page.getByRole('heading',{name:'候选研究方向（待验证）',exact:true});await direction.waitFor({timeout:25000});
  await page.locator('.hub-agent-answer > b').last().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+c.role+'-answer-top.png'});await direction.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+c.role+'-result.png'});
  const reading=await page.locator('.hub-agent-answer p').first().evaluate(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));assert.deepEqual(reading,{font:'16px',line:'28px'});
  await page.reload();await direction.waitFor({timeout:25000});assert.equal(await page.locator('.hub-agent-answer').count(),1);assert.equal(await page.getByText(c.text,{exact:true}).count(),1);
  await page.setViewportSize({width:390,height:844});await direction.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+c.role+'-direction-390.png'});assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);results.push({role:c.role,sessionId:c.sessionId,reading,newSessionPosts:posts.length,pageErrors:errors});
 }finally{await ctx.close();}
}}finally{await browser.close();}
writeFileSync(out+'/readback.json',JSON.stringify({passed:true,results,modelCalls:0,...(partial?{coverage:'owner-only',remaining:'admin business Token quota blocks final new task; not claimed as dual-account acceptance'}:{})},null,2));console.log(JSON.stringify({passed:true,accounts:results.length,newModelCalls:0,...(partial?{remaining:'admin-token-quota'}:{})}));
