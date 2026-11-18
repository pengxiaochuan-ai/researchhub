// B05 free UI acceptance: real HTTP/PG preview; separately labelled recovery response doubles.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {articleAiHref,articleEvidenceHref} from '../src/article-ai-session.js';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const {ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const out='docs/testing/evidence/article-ai-browser-'+randomUUID();mkdirSync(out,{recursive:true});
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',hash=v=>createHash('sha256').update(v).digest('hex'),budgetBefore=hash(readFileSync(ledger));
const counters=()=>withFixtureTransaction(env,'direct',async db=>({sessions:await db.session.count({where:{tenantId:ids.tenant}}),jobs:await db.knowledgeChatJob.count({where:{tenantId:ids.tenant}}),active:await db.knowledgeChatJob.count({where:{tenantId:ids.tenant,status:{in:['queued','processing']}}})}),{readOnly:true});
const before=await counters();assert.equal(before.active,0);
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],checks=[],network=[],errors=[],mutations=[],styles=[];let page;
const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
const ctxOptions={viewport:{width:1440,height:1000},recordVideo:{dir:out+'/video'}};
function observe(page,label){page.on('pageerror',e=>errors.push({label,message:e.message}));page.on('response',r=>{if(r.url().startsWith(base+'/api/'))network.push({label,path:new URL(r.url()).pathname,status:r.status(),method:r.request().method(),at:new Date().toISOString()});});}
async function readonly(ctx){await ctx.route('**/api/**',rt=>{if(!['GET','HEAD'].includes(rt.request().method())){mutations.push(new URL(rt.request().url()).pathname);return rt.abort();}return rt.continue();});}
try{
  for(const role of ['owner','admin']){
    const ctx=await browser.newContext(ctxOptions);contexts.push(ctx);
    assert.equal((await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:role+'@example.org',password}})).status(),201);await readonly(ctx);
    page=await ctx.newPage();observe(page,role);
    const response=await ctx.request.get(base+'/api/hub-sources/article-context/pmc-PMC13672493',{headers});assert.equal(response.status(),200);assert.equal(response.headers()['cache-control'],'no-store');const fixed=await response.json();assert(fixed.evidence.fragments.length);assert.equal(fixed.execution.canStart,false);
    await page.goto(base+'/pages/e02/?recordId=pmc-PMC13672493');await page.getByRole('heading',{name:fixed.title,exact:true}).waitFor();
    const button=page.getByRole('button',{name:'岐研 AI 解读',exact:true});assert(await button.isEnabled());await page.screenshot({path:out+'/'+role+'-e02-1440.png'});await button.click();
    await page.waitForURL('**/pages/ai01/?articleId=pmc-PMC13672493');await page.getByRole('heading',{name:fixed.title,exact:true}).waitFor();
    assert.equal(await page.locator('.workspace>.conversationList').count(),1);assert.equal(await page.locator('.workspace>.chat').count(),1);assert.equal(await page.locator('.workspace>.contextRail').count(),1);
    assert(await page.getByRole('button',{name:'发送本篇问题',exact:true}).isDisabled());await page.getByText(fixed.execution.message,{exact:true}).waitFor();
    await page.getByText('核对原文与选段',{exact:true}).click();await page.locator('.article-fragment').first().waitFor();
    assert.equal(await page.locator('.article-fragment').count(),fixed.evidence.fragments.length);
    assert.equal(await page.locator('.article-fragment .article-reading').first().innerText(),fixed.evidence.fragments[0].text);
    styles.push({role,...await page.locator('.article-fragment .article-reading').first().evaluate(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}))});assert.equal(styles.at(-1).font,'16px');assert.equal(styles.at(-1).line,'28px');
    await page.screenshot({path:out+'/'+role+'-ai01-1440.png'});
    const first=page.getByRole('link',{name:'核对这段原文',exact:true}).first(),expected=articleEvidenceHref(fixed.binding,fixed.evidence.fragments[0]);assert.equal(await first.getAttribute('href'),expected);
    await first.click();await page.locator('.article-evidence-mark').waitFor();assert.equal((await page.locator('.article-evidence-mark').innerText()).replace(/\s+/g,' ').trim(),fixed.evidence.fragments[0].text);
    await page.screenshot({path:out+'/'+role+'-source-backlink.png'});
    await page.goto(base+articleAiHref(fixed.binding.recordId));await page.getByRole('heading',{name:fixed.title,exact:true}).waitFor();await page.getByLabel('本篇研究问题（2–100字）').fill('本人尚未发送的核对问题');
    await page.getByRole('button',{name:'查看状态',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.thread .ui-button')?.disabled);assert.equal(await page.getByLabel('本篇研究问题（2–100字）').inputValue(),'本人尚未发送的核对问题');
    await page.reload();await page.getByRole('heading',{name:fixed.title,exact:true}).waitFor();assert.equal(await page.locator('.hub-agent-answer').count(),0);
    await page.setViewportSize({width:390,height:1000});await page.getByText('核对原文与选段',{exact:true}).click();await page.screenshot({path:out+'/'+role+'-ai01-390.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.setViewportSize({width:320,height:1000});await page.screenshot({path:out+'/'+role+'-ai01-320.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    checks.push(role+'_real_E02_original_button_AI01_fixed_preview_sources_refresh_no_POST_1440_390');
    await page.goto(base+'/pages/ai01/?articleId=pmc-PMC999999999');await page.getByText('返回论文列表重新核对',{exact:true}).waitFor();assert.equal(await page.locator('.article-fragment').count(),0);assert.equal(await page.locator('.hub-agent-answer').count(),0);
    await page.goto(base+'/pages/ai01/?articleId=pmc-PMC13672493&tenantId=forged');await page.getByText('单篇文章入口参数无效，请返回论文列表重新进入。',{exact:true}).waitFor();assert.equal(await page.locator('.hub-agent-answer').count(),0);
    await page.goto(base+articleEvidenceHref({...fixed.binding,reviewVersion:'article:999999'}));await page.getByText('文章版本或审核决定已变化，不能用新版冒充本次引用。请返回论文列表重新核对。',{exact:true}).waitFor();assert.equal(await page.locator('.real-evidence-approved-body').count(),0);
    await page.goto(base+'/pages/ai01/');await page.getByRole('heading',{name:'Hub 已审核来源问答',exact:true}).waitFor();checks.push(role+'_unknown_source_invalid_route_stale_version_fail_closed_generic_Hub_unchanged');
    await page.goto(base+'/pages/e01/?q='+encodeURIComponent('针灸'));await page.getByText('已按中英文关键词检索',{exact:true}).waitFor();await page.getByText('已按中英文关键词检索',{exact:true}).click();assert((await page.getByLabel('本次检索规则').innerText()).includes('acupuncture'));await page.screenshot({path:out+'/'+role+'-query-plan.png'});checks.push(role+'_real_queryPlan_feedback_with_actual_applied_English_terms');
  }
  const anon=await browser.newContext(ctxOptions);contexts.push(anon);page=await anon.newPage();observe(page,'anonymous');await readonly(anon);
  await page.goto(base+articleAiHref('pmc-PMC13672493'));const login=page.getByRole('link',{name:'前往登录',exact:true});await login.waitFor();const url=new URL(await login.getAttribute('href'),base);assert.equal(url.searchParams.get('returnTo'),articleAiHref('pmc-PMC13672493'));assert.equal(await page.locator('.article-fragment').count(),0);await page.screenshot({path:out+'/anonymous.png'});
  await login.click();assert.equal(new URL(page.url()).searchParams.get('returnTo'),articleAiHref('pmc-PMC13672493'));
  await anon.route('**/api/auth/login',rt=>rt.continue());await page.getByLabel('邮箱',{exact:true}).fill('owner@example.org');await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/ai01/?articleId=pmc-PMC13672493');await page.getByRole('heading',{name:'单篇文章 AI 解读',exact:true}).waitFor();await page.locator('.article-context h3').waitFor();checks.push('anonymous_no_preview_safe_bounded_article_actual_browser_login_return');
  // A browser response double proves presentation/reload states, NOT real Provider execution.
  const simulated=await browser.newContext(ctxOptions);contexts.push(simulated);await simulated.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:'owner@example.org',password}});await readonly(simulated);
  const real=await(await simulated.request.get(base+'/api/hub-sources/article-context/pmc-PMC13672493',{headers})).json();
  const requestKey='b05-free-ui-recovery',inputHash='f'.repeat(64),job={id:'b05-free-job',status:'processing',requestKey,inputHash};
  await simulated.route('**/api/hub-sources/article-context/**',rt=>rt.fulfill({json:{...real,existingSessionId:'b05-free-session',latestTask:job}}));
  await simulated.route('**/api/sessions/b05-free-session/knowledge-state*',rt=>rt.fulfill({json:{articleContext:{binding:real.binding},jobs:[job],messages:[{id:'old-answer',role:'assistant',content:'THIS OLD ANSWER MUST NOT APPEAR'}]}}));
  page=await simulated.newPage();observe(page,'free-response-double');await page.goto(base+articleAiHref(real.binding.recordId,{requestKey,inputHash}));await page.getByText('正在执行',{exact:true}).waitFor();assert.equal(await page.locator('.hub-agent-answer').count(),0);await page.reload();await page.getByText('正在执行',{exact:true}).waitFor();await page.getByRole('button',{name:'查看状态',exact:true}).click();assert.equal(await page.locator('.hub-agent-answer').count(),0);await page.screenshot({path:out+'/free-response-double-running.png'});checks.push('FREE_BROWSER_RESPONSE_DOUBLE_running_refresh_GET_only_no_old_answer_not_Provider_acceptance');
  const zoom=await(pw.chromium??pw.default.chromium).launchPersistentContext(mkdtempSync(root+'.tmp/b05-native200-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'/zoom-video'}});contexts.push(zoom);
  await zoom.pages()[0].goto('chrome://settings/appearance');await zoom.pages()[0].locator('#zoomLevel').selectOption('2');await zoom.request.post(base+'/api/auth/login',{data:{tenantSlug:ids.tenant,username:'owner@example.org',password}});await readonly(zoom);
  page=await zoom.newPage();observe(page,'native200');await page.goto(base+articleAiHref(real.binding.recordId));await page.locator('.article-context h3').waitFor();await page.getByText('核对原文与选段',{exact:true}).click();await page.locator('.article-fragment').first().waitFor();
  const metrics=await page.evaluate(()=>({outer:outerWidth,inner:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,scroll:document.documentElement.scrollWidth}));assert.equal(metrics.dpr,2);assert.equal(metrics.scale,1);assert(metrics.inner<metrics.outer/2+20);assert(metrics.scroll<=metrics.inner+1);writeFileSync(out+'/native200.json',JSON.stringify(metrics,null,2));
  const cdp=await zoom.newCDPSession(page),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+'/native200.png',Buffer.from(shot.data,'base64'));await cdp.detach();checks.push('actual_native_Chrome_200_fixed_preview_no_horizontal_page_overflow');
  assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);const after=await counters();assert.deepEqual(after,before);assert.equal(hash(readFileSync(ledger)),budgetBefore);
  writeFileSync(out+'/result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,network,errors,mutations,styles,counters:{before,after},budgetUnchanged:true,modelCalls:0,newPersistentTasks:0,scope:'B05 real preview and UI only; recovery double explicitly separated; no B07 paid Provider or B08 review claim'},null,2));console.log(JSON.stringify({passed:true,checks,evidence:out}));
}catch(e){writeFileSync(out+'/failure.json',JSON.stringify({message:e.message,network,checks,errors},null,2));await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}
finally{for(const ctx of contexts)await ctx.close();await browser.close();}
