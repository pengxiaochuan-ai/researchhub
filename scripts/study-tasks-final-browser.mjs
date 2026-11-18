// Full S08 path; at most ONE new named task, within the original eight-task cap.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
process.umask(0o077);
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const [manifest]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});assert(manifest?.manifest?.syntheticOnly);const {plan}=manifest.manifest;
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/browser-final-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium??pw.default.chromium;
const browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],checks=[],network=[],errors=[],warnings=[];let stage='login',taskId,active,releaseHeld,chainWrites=0;
const name=(plan.runId+'-全链验收-'+('针灸情志研究任务'.repeat(20))).slice(0,120);
const scopeHeaders={'X-Study-Group-Id':plan.scope.studyGroupId,'X-Research-Project-Id':plan.scope.researchProjectId};
const url=id=>base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.scope.researchProjectId,...(id?{taskId:id}:{})});
async function signed(role){
 const c=await browser.newContext();assert.equal((await c.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}})).status(),201);
 const auth=await c.storageState();await c.close();const context=await browser.newContext({storageState:auth,viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});contexts.push(context);
 const page=await context.newPage();page.on('pageerror',e=>errors.push({role,stage,message:e.message.slice(0,160)}));page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push({role,stage,type:m.type(),text:m.text().slice(0,160)});});
 page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/study-tasks'))network.push({role,stage,path:u.pathname,query:u.search,method:r.request().method(),status:r.status()});});
 return {context,page};
}
async function read(context){const response=await context.request.get(base+'/api/study-tasks/'+taskId,{headers:scopeHeaders});assert.equal(response.status(),200);return (await response.json()).item;}
async function visit(page){active=page;await page.bringToFront();await page.goto(url(taskId));await page.locator('.s08-task-detail').waitFor();}
async function versionVisible(page,version){await page.waitForFunction(({name,version})=>{const row=[...document.querySelectorAll('.s08-task-item')].find(e=>e.querySelector(':scope>div>strong')?.textContent===name);return new RegExp(' · v'+version+'(?: ·|$)').test(row?.querySelector(':scope>div>small')?.textContent??'');},{name,version});}
async function transition(page,status){
 await visit(page);await page.getByText('执行与状态操作',{exact:true}).click();const form=page.locator('.s08-transition-form');await form.getByLabel('任务状态操作',{exact:true}).selectOption(status);
 if(status==='blocked')await form.getByLabel('受阻说明',{exact:true}).fill('本机合成演练：等待人工字段核对，不修改任何科研原数据。');
 if(status==='completed')await form.getByLabel('完成说明',{exact:true}).fill('本机合成演练：已按任务要求核对字段与固定来源；提交任务验收，不代表临床或方法学批准。');
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/study-tasks/'+taskId+'/transitions');await form.getByRole('button',{name:'确认状态变更',exact:true}).click();const actual=await response;assert.equal(actual.status(),200);chainWrites++;await versionVisible(page,(await actual.json()).version);
}
async function review(page,decision){
 await visit(page);await page.getByText('任务验收',{exact:true}).click();const form=page.locator('.s08-review-form');await form.getByLabel('任务验收操作',{exact:true}).selectOption(decision);
 await form.getByLabel('验收备注／退回原因',{exact:true}).fill(decision==='return'?'本机合成退回：请补充一次字段复核说明。':'本机合成任务已核对，不代表临床批准或用户专业验收。');
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/study-tasks/'+taskId+'/reviews');await form.getByRole('button',{name:'确认任务验收',exact:true}).click();const actual=await response;assert.equal(actual.status(),200);chainWrites++;await versionVisible(page,(await actual.json()).version);
}
try{
 const owner=await signed('owner'),admin=await signed('admin');active=owner.page;
 const existing=await withFixtureTransaction(env,'direct',db=>db.studyTask.findMany({where:{...plan.scope,name},select:{id:true}}),{readOnly:true});assert(existing.length<=1);
 if(!existing.length){
  stage='create-with-real-context';await owner.page.goto(url());await owner.page.getByRole('button',{name:'创建任务',exact:true}).waitFor();
  const form=owner.page.locator('.s08-task-form');await form.getByLabel('任务标题',{exact:true}).fill(name);await form.getByLabel('负责人',{exact:true}).selectOption(plan.ids.owner);await form.getByLabel('截止日期',{exact:true}).fill('2026-11-13');await form.getByText('更多任务设置',{exact:true}).click();
  await form.getByLabel('协作者：合成租户管理员',{exact:true}).check();
  await form.getByRole('button',{name:'读取可关联记录',exact:true}).click();await owner.page.waitForFunction(()=>document.querySelector('#s08-create-context')?.options.length>1);
  const option=await form.getByLabel('创建时关联记录（可选）',{exact:true}).locator('option').nth(1).getAttribute('value');await form.getByLabel('创建时关联记录（可选）',{exact:true}).selectOption(option);
  const response=owner.page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/study-tasks');await form.getByRole('button',{name:'创建任务',exact:true}).click();const actual=await response;assert.equal(actual.status(),201);const receipt=await actual.json();taskId=receipt.taskId;writeFileSync(out+'create-receipt.json',JSON.stringify(receipt,null,2));
  await versionVisible(owner.page,receipt.version);checks.push('native_create_long_title_collaborator_and_fixed_context_one_transaction');
 }else{taskId=existing[0].id;checks.push('existing_named_full_chain_task_reused_no_extra_creation');}
 stage='filters-and-pagination';await visit(owner.page);await owner.page.getByLabel('每页条数',{exact:true}).selectOption('2');await owner.page.getByRole('button',{name:'应用任务筛选',exact:true}).click();
 await owner.page.waitForFunction(()=>document.querySelectorAll('.s08-task-item').length===2);await owner.page.getByRole('button',{name:'下一页',exact:true}).click();await owner.page.getByRole('navigation',{name:'任务分页',exact:true}).getByText('第2页',{exact:true}).waitFor();
 await owner.page.getByRole('button',{name:'查看详情',exact:true}).first().click();await owner.page.locator('.s08-task-detail').waitFor();await owner.page.reload();await owner.page.getByRole('navigation',{name:'任务分页',exact:true}).getByText('第2页',{exact:true}).waitFor();assert.equal(await owner.page.getByLabel('每页条数',{exact:true}).inputValue(),'2');checks.push('real_keyset_pagination_selection_reload_preserves_filters_and_cursor');
 await owner.page.getByLabel('搜索任务',{exact:true}).fill(name);await owner.page.getByLabel('每页条数',{exact:true}).selectOption('20');await owner.page.getByRole('button',{name:'应用任务筛选',exact:true}).click();await owner.page.waitForFunction(()=>document.querySelectorAll('.s08-task-item').length===1);await owner.page.getByRole('button',{name:'查看详情',exact:true}).click();
 stage='reminder';let current=await read(owner.context);
 if(!current.history.some(h=>h.action==='remind')){await visit(admin.page);const response=admin.page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/reminders'));await admin.page.getByRole('button',{name:'记录站内提醒',exact:true}).click();assert.equal((await response).status(),200);}
 await visit(owner.page);await owner.page.getByRole('heading',{name:'站内提醒记录',exact:true}).waitFor();checks.push('second_actual_account_reminds_and_current_recipient_reads');
 stage='post-commit-lost-response';
 const [lostTarget]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT o.task_id FROM rh_study_tasks.operation o JOIN study_task t ON t.id=o.task_id
  WHERE o.tenant_id=${plan.scope.tenantId} AND o.research_project_id=${plan.scope.researchProjectId} AND o.action='create' AND t.status<>'cancelled'
  AND NOT EXISTS(SELECT 1 FROM rh_study_tasks.operation r WHERE r.task_id=o.task_id AND r.action='remind' AND r.created_at>clock_timestamp()-interval '60 seconds') ORDER BY o.task_id LIMIT 1`,{readOnly:true});assert(lostTarget,'S08_NO_FREE_NAMED_REMINDER_TARGET');
 await owner.page.goto(url(lostTarget.task_id));await owner.page.getByRole('button',{name:'记录站内提醒',exact:true}).waitFor();let committed,writes=0;
 await owner.page.route('**/api/study-tasks/'+lostTarget.task_id+'/reminders',async route=>{writes++;const actual=await route.fetch();assert.equal(actual.status(),200);committed=await actual.json();writeFileSync(out+'lost-response-receipt.json',JSON.stringify(committed,null,2));return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'STUDY_TASK_UNAVAILABLE'})});});
 await owner.page.getByRole('button',{name:'记录站内提醒',exact:true}).click();await owner.page.getByRole('button',{name:'核对原提交回执',exact:true}).waitFor();assert(committed);assert.equal(writes,1);
 await owner.page.getByRole('button',{name:'核对原提交回执',exact:true}).click();await owner.page.getByText(/原提交已核对成功/).waitFor();const recovered=await owner.context.request.get(base+'/api/study-tasks/'+lostTarget.task_id,{headers:scopeHeaders});assert.equal((await recovered.json()).item.version,committed.version);assert.equal(writes,1);assert.equal(await owner.page.locator('[data-task-error]').count(),0,'S08_RECOVERED_SUCCESS_STILL_SHOWS_UNKNOWN_ERROR');
 await owner.page.unroute('**/api/study-tasks/'+lostTarget.task_id+'/reminders');checks.push('actual_committed_reminder_lost_ack_get_receipt_recovers_without_second_write');
 stage='full-state-chain';current=await read(owner.context);
 if(current.status==='open')await transition(owner.page,'in_progress');
 current=await read(owner.context);if(current.status==='in_progress'&&!current.history.some(h=>h.toStatus==='blocked'))await transition(owner.page,'blocked');
 current=await read(owner.context);if(current.status==='blocked')await transition(owner.page,'in_progress');
 current=await read(owner.context);if(current.status==='in_progress'&&current.reviewStatus!=='returned')await transition(owner.page,'completed');
 current=await read(owner.context);if(current.reviewStatus==='pending_review'&&!current.history.some(h=>h.reviewDecision==='return'))await review(admin.page,'return');
 current=await read(owner.context);if(current.reviewStatus==='returned')await transition(owner.page,'completed');
 current=await read(owner.context);if(current.reviewStatus==='pending_review')await review(admin.page,'accept');
 current=await read(owner.context);assert.equal(current.status,'completed');assert.equal(current.reviewStatus,'accepted');assert.equal(current.reviewer.id,plan.ids.admin);assert.equal(current.submission.actor.id,plan.ids.owner);assert.equal(current.context.status,'current');
 checks.push(chainWrites?'native_start_block_resume_submit_return_resubmit_accept_real_actors':'existing_successful_full_chain_readback_real_actors_original_trace_retained');
 stage='idle-current-authorization';await visit(owner.page);const before=network.filter(n=>n.role==='owner'&&n.path==='/api/study-tasks/context').length;await new Promise(ok=>setTimeout(ok,3700));assert(network.filter(n=>n.role==='owner'&&n.path==='/api/study-tasks/context').length>before);checks.push('visible_idle_page_rechecks_current_authorization_without_writes');
 stage='viewports-keyboard';for(const width of [1440,1280,390,320]){
  await owner.page.setViewportSize({width,height:900});if(width<700)await owner.page.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);
  const apply=owner.page.getByRole('button',{name:'应用任务筛选',exact:true});await apply.focus();await apply.scrollIntoViewIfNeeded();assert(await apply.evaluate(e=>e===document.activeElement));
  const metrics=await owner.page.evaluate(()=>({inner:innerWidth,scroll:document.documentElement.scrollWidth,panels:[...document.querySelectorAll('.s08-tasks>.wf-panel>h2')].map(e=>e.textContent),rows:[...document.querySelectorAll('.s08-task-item')].map(e=>({row:e.clientWidth,title:e.firstElementChild.getBoundingClientRect().width})),inputs:[...document.querySelectorAll('.s08-task-form input,.s08-task-form select,.s08-task-filters input,.s08-task-filters select')].map(e=>({tag:e.tagName,font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,height:e.getBoundingClientRect().height}))}));
  assert(metrics.scroll<=width+1);assert.deepEqual(metrics.panels,['执行任务与进度','受试者与访视']);assert(metrics.inputs.every(e=>e.font==='14px'));if(width<=390)assert(metrics.rows.every(e=>e.title>=e.row*.9),'MOBILE_TASK_TITLE_MUST_NOT_COLLAPSE_TO_VERTICAL_LETTERS');writeFileSync(out+'metrics-'+width+'.json',JSON.stringify(metrics,null,2));await owner.page.screenshot({path:out+'final-'+width+'.png',fullPage:false,animations:'disabled'});
 }
 checks.push('four_viewports_original_panels_readable_long_title_and_keyboard_focus');
 stage='actual-late-owner-body-after-identity-switch';await owner.page.setViewportSize({width:1440,height:900});await visit(owner.page);const oldHash=(await read(owner.context)).context.sourceHash;assert(oldHash);
 let observed,delivered;const started=new Promise(ok=>{observed=ok;}),finished=new Promise(ok=>{delivered=ok;}),held=new Promise(ok=>{releaseHeld=ok;});let intercept=true;
 await owner.page.route('**/api/study-tasks/'+taskId,async route=>{if(intercept&&route.request().method()==='GET'){intercept=false;const actual=await route.fetch();assert.equal(actual.status(),200);observed();await held;await route.fulfill({response:actual});delivered();}else await route.continue();});
 await owner.page.getByRole('button',{name:'刷新任务',exact:true}).click();await started;
 assert.equal((await owner.context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 await owner.page.evaluate(()=>window.dispatchEvent(new Event('qiyan:auth-changed')));await owner.page.locator('.s08-context').getByText('关联来源当前不可读或已变化，请重新核对；不交付旧摘要。',{exact:true}).waitFor();releaseHeld();await finished;await owner.page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));assert(!(await owner.page.locator('.s08-tasks').innerText()).includes(oldHash));checks.push('held_actual_owner_200_after_real_cookie_switch_never_restores_private_source');
 stage='native-200';const zoom=await chrome.launchPersistentContext(mkdtempSync(root+'.tmp/s08-native-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'zoom-video',size:{width:1440,height:1000}}});contexts.push(zoom);
 const settings=zoom.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');assert.equal((await zoom.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}})).status(),201);
 const zp=active=await zoom.newPage();await zp.goto(url(taskId));await zp.locator('.s08-task-detail').waitFor();await zp.getByLabel('任务标题',{exact:true}).scrollIntoViewIfNeeded();const metrics=await zp.evaluate(()=>({outer:outerWidth,inner:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,scroll:document.documentElement.scrollWidth}));assert.equal(metrics.dpr,2);assert.equal(metrics.scale,1);assert(metrics.inner<metrics.outer/2+20&&metrics.scroll<=metrics.inner+1);writeFileSync(out+'native200.json',JSON.stringify(metrics,null,2));const cdp=await zoom.newCDPSession(zp),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+'native200.png',Buffer.from(shot.data,'base64'));await cdp.detach();checks.push('actual_native_chrome_200_not_viewport_simulation');
 assert.equal(errors.length,0);assert(!network.some(n=>/jobs|chat|export|approve|lock/.test(n.path)));
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,actualChrome:true,checks,network,errors,warnings,taskId,newTasks:existing.length?0:1,modelCalls:0,professionalAcceptance:false},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,taskId,newTasks:existing.length?0:1,modelCalls:0,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,taskId,checks,network,errors,warnings,message:e.message.slice(0,500)},null,2));await active?.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,taskId,message:e.message.slice(0,220),evidence:out}));process.exitCode=1;}
finally{releaseHeld?.();for(const context of contexts)await context.close().catch(()=>{});await browser.close();}
