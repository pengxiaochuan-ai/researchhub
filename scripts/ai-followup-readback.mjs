// Real Chrome: first actual unchanged history, then a clearly recorded test-only
// response projection of the free replay. No command, model call or DB write.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',out='.tmp/ai-followup-fix-2026-11-11',base='http://127.0.0.1:19501';
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const replay=JSON.parse(readFileSync(out+'/browser-projection.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
mkdirSync(out+'/video',{recursive:true});
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
try{for(const projection of [false,true]){
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});
 try{
  assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base,Referer:base+'/pages/ai01/'},data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}})).status(),201);
  let projected=0;const mutations=[],errors=[],warnings=[];
  await ctx.route('**/api/sessions/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(req.method()!=='GET'){mutations.push({method:req.method(),path});return route.abort();}
   if(projection&&path===`/api/sessions/${replay.sessionId}/knowledge-state`){
    const response=await route.fetch();assert.equal(response.status(),200);const state=await response.json();
    const message=state.messages.find(m=>m.id===replay.messageId);assert(message);assert.equal(message.content,replay.oldContent);
    // Browser response only; never persisted or claimed as an actual worker run.
    message.content=replay.accepted.text;
    message.meta.provenance.literatureOutput=replay.accepted.validation;projected++;
    return route.fulfill({response,json:state});
   }
   return route.continue();
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push(m.text());});
  await page.goto(base+'/pages/ai01/?sessionId='+replay.sessionId);
  const heading=page.getByRole('heading',{name:'候选研究方向（待验证）',exact:true});await heading.waitFor({timeout:25000});
  const answer=page.locator('.hub-agent-answer').last();
  if(!projection){assert((await answer.innerText()).includes('且未提及随访时间'));assert((await answer.innerText()).includes('未报告倦怠结局，未提及随访'));}
  else{
   assert(!(await answer.innerText()).includes('且未提及随访时间'));
   assert(!(await answer.innerText()).includes('未报告倦怠结局，未提及随访'));
   assert((await answer.innerText()).includes('were invited to complete an online survey 1 week before the workshop and 3 months afterwards'));
   assert((await answer.innerText()).includes('Perceived stress, measured with the 10-item Perceived Stress Scale, decreased significantly from baseline to 1 and 3 months ( P < .001)'));
   assert((await answer.innerText()).includes('评估时点不等于干预结束后的随访'));
   for(const pmid of ['42767797','41566560'])assert(await answer.locator(`a[href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/"]`).count()>0);
  }
  const reading=await answer.locator('p').first().evaluate(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));assert.deepEqual(reading,{font:'16px',line:'28px'});
  const label=projection?'test-projection':'actual-history';
  if(projection)await page.getByRole('heading',{name:'原文核对提示',exact:true}).scrollIntoViewIfNeeded();else await heading.scrollIntoViewIfNeeded();
  await page.screenshot({path:out+'/'+label+'-1440.png'});
  if(projection)for(const [id,quote]of [['P2','were invited to complete an online survey'],['P6','Perceived stress, measured with the 10-item Perceived Stress Scale']]){
   await answer.locator('li').filter({hasText:quote}).first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+label+'-'+id+'-1440.png'});
  }
  const visible=await answer.innerText();await page.reload();await heading.waitFor({timeout:25000});assert.equal(await answer.innerText(),visible);
  await page.setViewportSize({width:390,height:844});
  if(projection)await page.getByRole('heading',{name:'原文核对提示',exact:true}).scrollIntoViewIfNeeded();else await heading.scrollIntoViewIfNeeded();
  await page.screenshot({path:out+'/'+label+'-390.png'});
  if(projection)for(const [id,quote]of [['P2','were invited to complete an online survey'],['P6','Perceived stress, measured with the 10-item Perceived Stress Scale']]){
   await answer.locator('li').filter({hasText:quote}).first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+label+'-'+id+'-390.png'});
  }
  assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
  results.push({mode:label,projectedResponses:projected,newSessionWrites:mutations.length,reading,pageErrors:errors,consoleWarnings:warnings,refreshPreserved:true});
 }finally{await ctx.close();}
}}finally{await browser.close();}
writeFileSync(out+'/readback.json',JSON.stringify({passed:true,modelCalls:0,results,coverage:'Actual authenticated unchanged old history, plus read-only browser test response projection; not new model execution or persistence'},null,2));
console.log(JSON.stringify({passed:true,modelCalls:0,results}));
