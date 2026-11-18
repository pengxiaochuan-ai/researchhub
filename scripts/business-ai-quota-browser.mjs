// Real browser/API readback by default. --send-one runs one deliberate smoke task,
// not a product limit; it never changes grants, existing reservations or old ledgers.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',sendOne=process.argv[2]==='--send-one';
assert(process.argv.length===2||sendOne&&process.argv.length===3);
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out='docs/testing/evidence/business-ai-quota-browser-'+randomUUID();mkdirSync(out,{recursive:true});
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),ledgerBefore=sha(ledger);
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],requests=[],errors=[],contexts=[],headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};let page,stage='initial',paidResult;
const savedFiles={owner:'docs/testing/evidence/article-ai-real-acceptance-6d497178-5479-4500-9ce7-5a1ff731663d/owner-result.json',admin:'docs/testing/evidence/article-ai-real-acceptance-e6d04532-d6e1-4eca-b101-9955e7b6ec8d/admin-result.json'};
const parse=async(response,status=200)=>{assert.equal(response.status(),status);return response.json();};
try{
 for(const role of ['owner','admin']){
  stage=role+'-real-readback';const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}});contexts.push(ctx);
  await parse(await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:role+'@example.org',password}}),201);
  const status=await parse(await ctx.request.get(base+'/api/knowledge/ai-status',{headers}));assert.equal(Object.hasOwn(status,'budget'),false);assert.equal(status.quota.requiredTokens,'12288');
  writeFileSync(out+'/'+role+'-quota.json',JSON.stringify(status,null,2));
  const fixed=await parse(await ctx.request.get(base+'/api/hub-sources/article-context/pmc-PMC13672493',{headers}));
  assert.equal(fixed.execution.canStart,status.quota.canStart);assert.equal(fixed.execution.code,status.quota.code);assert.equal(Object.hasOwn(fixed.execution,'approvalHash'),false);
  // Only the explicit owner smoke task below may create a new model job.
  await ctx.route('**/api/**',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
  const saved=JSON.parse(readFileSync(savedFiles[role])),target=base+'/pages/ai01/?'+new URLSearchParams({articleId:'pmc-'+saved.pmcid,requestKey:saved.task.requestKey,inputHash:saved.task.inputHash});
  page=await ctx.newPage();page.on('pageerror',e=>errors.push({stage,message:e.message}));page.on('response',r=>{if(r.url().startsWith(base+'/api/'))requests.push({role,path:new URL(r.url()).pathname,method:r.request().method(),status:r.status()});});
  await page.goto(target);await page.locator('.hub-agent-answer').waitFor();assert.equal((await page.locator('.hub-agent-answer').innerText()).includes(saved.answer.content.split('\n').find(t=>t&&!t.startsWith('#'))),true);
  assert.equal(await page.getByRole('button',{name:'发送本篇问题',exact:true}).isEnabled(),status.quota.canStart);
  assert(!(await page.locator('.article-workspace').innerText()).includes('本轮费用守门'));
  assert(!(await page.locator('.article-workspace').innerText()).includes('报价已过期'));
  await page.screenshot({path:out+'/'+role+'-1440.png'});
  await page.getByLabel('本篇研究问题（2–100字）').fill('本人未发送的业务额度核对问题');await page.getByRole('button',{name:'查看状态',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.thread .ui-button')?.disabled);
  assert.equal(await page.getByLabel('本篇研究问题（2–100字）').inputValue(),'本人未发送的业务额度核对问题');
  await page.reload();await page.locator('.hub-agent-answer').waitFor();
  const metrics=await page.locator('.hub-agent-answer p').first().evaluate(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));assert.deepEqual(metrics,{font:'16px',line:'28px'});
  await page.setViewportSize({width:390,height:1000});await page.locator('.hub-agent-answer').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+role+'-390.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // UI-only insufficient-quota response double; real DB boundaries are tested separately.
  const limited={...status.quota,canStart:false,blocked:true,code:'TOKEN_QUOTA_EXCEEDED',message:'当前可用 Token 不足以预留本次任务，请联系租户管理员。'};
  const restrict=async route=>{const r=await route.fetch(),body=await r.json();if(body.execution)body.execution={canStart:false,code:limited.code,message:limited.message,quota:limited};if(body.articleContext?.execution)body.articleContext.execution={canStart:false,code:limited.code,message:limited.message,quota:limited};body.quota=limited;await route.fulfill({response:r,json:body});};
  await ctx.route('**/api/hub-sources/article-context/**',restrict);await ctx.route('**/api/sessions/*/knowledge-state*',restrict);
  await page.reload();await page.locator('.hub-agent-answer').waitFor();await page.getByText(limited.message,{exact:true}).waitFor();assert(await page.getByRole('button',{name:'发送本篇问题',exact:true}).isDisabled());await page.screenshot({path:out+'/'+role+'-insufficient-ui-only.png',fullPage:true});
  await ctx.unroute('**/api/hub-sources/article-context/**',restrict);await ctx.unroute('**/api/sessions/*/knowledge-state*',restrict);
  await page.reload();await page.locator('.hub-agent-answer').waitFor();assert.equal(await page.getByRole('button',{name:'发送本篇问题',exact:true}).isEnabled(),status.quota.canStart);
  // The other person's private request must not become readable after fee whitelist removal.
  const other=JSON.parse(readFileSync(savedFiles[role==='owner'?'admin':'owner']));const forbidden=await ctx.request.get(base+'/api/sessions/'+other.sessionId+'/knowledge-state?limit=60',{headers});assert([403,404].includes(forbidden.status()),'private session must be denied or undiscoverable');
  checks.push({role,realQuota:status.quota,historyRestored:true,unsentDraftPreserved:true,insufficientUiDouble:true,otherPersonDenied:true,metrics});
  if(sendOne&&role==='owner'){
   stage='owner-one-real-send';assert.equal(status.quota.canStart,true);
   await ctx.unroute('**/api/**');await page.setViewportSize({width:1440,height:1000});
   await page.getByLabel('本篇研究问题（2–100字）').fill('请仅据本篇选段作定性解读，说明研究类型、作者观察、测量与因果局限和研究参考价值；保留残余症状，不复述数字，不把治疗结束写成停药。');
   const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/knowledge-messages'));
   await page.getByRole('button',{name:'发送本篇问题',exact:true}).click();const queued=await parse(await responsePromise,201);
   let state;for(let n=0;n<80;n++){state=await parse(await ctx.request.get(base+'/api/sessions/'+fixed.existingSessionId+'/knowledge-state?limit=60',{headers}));const j=state.jobs.find(j=>j.id===queued.id);if(['completed','failed'].includes(j?.status))break;await new Promise(r=>setTimeout(r,1000));}
   const job=state.jobs.find(j=>j.id===queued.id),answer=state.messages.find(m=>m.id===job?.assistantMessageId);
   paidResult={job,answer,quota:state.quota};writeFileSync(out+'/real-result.json',JSON.stringify(paidResult,null,2));
   assert.equal(job?.status,'completed',job?.errorCode??'Task did not complete');assert.equal(answer?.meta?.usedMock,false);assert(answer.meta.usage.totalTokens>0);assert.equal(answer.meta.sourceStatus,'current');
   await page.getByRole('button',{name:'查看状态',exact:true}).click();await page.locator('.hub-agent-answer').waitFor();await page.screenshot({path:out+'/owner-real-new-result.png'});
   checks.push({newRealTaskId:job.id,usage:answer.meta.usage,actualProvider:true});
  }
 }
 assert.deepEqual(errors,[]);assert.equal(sha(ledger),ledgerBefore);
 writeFileSync(out+'/result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,requests,errors,legacyLedgerUnchanged:true,realSmokeRequested:sendOne,newProviderTasks:paidResult?1:0},null,2));console.log(JSON.stringify({passed:true,evidence:out,checks:checks.map(c=>({role:c.role,historyRestored:c.historyRestored,newRealTaskId:c.newRealTaskId}))}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({stage,message:e.message,checks,requests,errors,paidResult},null,2));await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,message:e.message.slice(0,700),evidence:out}));process.exitCode=1;}
finally{for(const ctx of contexts)await ctx.close();await browser.close();}
