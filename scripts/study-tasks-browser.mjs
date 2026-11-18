// Scoped real Chrome UI verification; no recording of credentials or auth storage.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2,5),['--mode','local-synthetic','--step']);
assert(['create-edit','assignments','transitions','reviews','reminders','links','all'].includes(process.argv[5])&&process.argv.length===6);
if(process.argv[5]==='all'){await import('./study-tasks-final-browser.mjs');process.exit(process.exitCode??0);}
if(process.argv[5]==='links'){await import('./study-tasks-links-browser.mjs');process.exit(process.exitCode??0);}
if(process.argv[5]==='reminders'){await import('./study-tasks-reminders-browser.mjs');process.exit(process.exitCode??0);}
if(process.argv[5]==='assignments'){await import('./study-tasks-assignments-browser.mjs');process.exit(process.exitCode??0);}
if(process.argv[5]==='transitions'){await import('./study-tasks-transitions-browser.mjs');process.exit(process.exitCode??0);}
if(process.argv[5]==='reviews'){await import('./study-tasks-reviews-browser.mjs');process.exit(process.exitCode??0);}
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const [row]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});
assert(row?.manifest?.syntheticOnly);const {plan}=row.manifest;
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/browser-create-edit/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),stage='login';
const checks=[],network=[],errors=[];
const name=plan.runId+'-浏览器创建验证',editedName=plan.runId+'-浏览器编辑已保存';
let createdTaskId;
try{
 await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill('owner@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/p01/');checks.push('native_login_reaches_my_research');
 const auth=await context.storageState();await context.close();
 context=await browser.newContext({storageState:auth,viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});page=await context.newPage();
 page.on('pageerror',error=>errors.push({stage,name:error.name,message:error.message.slice(0,180)}));
 page.on('response',async response=>{const u=new URL(response.url());if(u.origin===base&&u.pathname.startsWith('/api/'))network.push({stage,path:u.pathname,status:response.status(),method:response.request().method()});});
 stage='page-read';await page.goto(base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.scope.researchProjectId}));
 const create=page.getByRole('button',{name:'创建任务',exact:true});await create.waitFor();await page.waitForFunction(()=>!document.querySelector('.s08-task-form button[type="submit"]')?.disabled);
 assert.equal(await page.locator('.s08-tasks>.wf-panel').count(),2);assert.equal(await page.getByText('保存演示任务',{exact:true}).count(),0);await page.getByRole('heading',{level:1,name:/针灸|研究|Study/}).waitFor();
 assert.equal(await page.locator('.s08-task-form [role=alert]').count(),0);await page.screenshot({path:out+'initial-1440.png',fullPage:true});
 stage='validation';await create.click();await page.locator('.s08-task-form [role=alert]').waitFor();assert.equal(await page.locator('.s08-task-form [role=alert]').evaluate(e=>document.activeElement===e),true);checks.push('empty_submit_focuses_error_summary_with_inline_errors');
 const existing=await withFixtureTransaction(env,'direct',db=>db.studyTask.findMany({where:{...plan.scope,name:{in:[name,editedName]}},select:{id:true,name:true}}),{readOnly:true});assert(existing.length<=1,'S08_BROWSER_DUPLICATE_FIXTURE');
 if(!existing.length){
  await page.getByLabel('任务标题',{exact:true}).fill(name);await page.getByLabel('负责人',{exact:true}).selectOption(plan.ids.owner);await page.getByLabel('截止日期',{exact:true}).fill('2026-11-13');
  let failOnce=true;await page.route('**/api/study-tasks',async route=>{if(route.request().method()==='POST'&&failOnce){failOnce=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'STUDY_TASK_UNAVAILABLE'})});}return route.continue();});
  stage='unknown-submit';await create.click();await page.getByRole('button',{name:'核对原提交回执',exact:true}).waitFor();assert.equal(await page.getByLabel('任务标题',{exact:true}).inputValue(),name);
  await page.getByRole('button',{name:'核对原提交回执',exact:true}).click();await page.getByRole('button',{name:'使用同一编号重试',exact:true}).waitFor();
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/study-tasks'&&r.status()===201);
  await page.getByRole('button',{name:'使用同一编号重试',exact:true}).click();createdTaskId=(await(await response).json()).taskId;
  writeFileSync(out+'create-receipt.json',JSON.stringify({taskId:createdTaskId,at:new Date().toISOString()}),{mode:0o600});
  checks.push('503_preserves_input_no_auto_retry_then_same_key_explicit_recovery');
 }else{createdTaskId=existing[0].id;checks.push('existing_named_browser_fixture_reused_without_new_task');await page.goto(base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.scope.researchProjectId,taskId:createdTaskId}));}
 stage='edit';await page.getByRole('button',{name:'编辑任务',exact:true}).waitFor();await page.getByRole('button',{name:'编辑任务',exact:true}).click();await page.getByLabel('任务标题',{exact:true}).fill(editedName);
 const save=page.getByRole('button',{name:'保存修改',exact:true});if(await save.isEnabled()){
  const response=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/study-tasks/'+createdTaskId);
  await save.click();assert.equal((await response).status(),200);await page.getByRole('button',{name:'创建任务',exact:true}).waitFor();
 }
 const stored=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{id:createdTaskId,...plan.scope},select:{name:true,status:true,version:true}}),{readOnly:true});assert.equal(stored.name,editedName);assert.equal(stored.status,'open');checks.push('native_form_create_edit_and_database_match');
 stage='layout';for(const width of [1440,1280,390,320]){
  await page.setViewportSize({width,height:900});
  if(width<=700)await page.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);
  await page.mouse.move(width-24,400);await page.mouse.wheel(0,-10000);
  await page.waitForFunction(()=>document.querySelector('main.platform-main').scrollTop===0);
  const metrics=await page.locator('.s08-task-form').evaluate(form=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,columns:getComputedStyle(form).gridTemplateColumns,inputs:[...form.querySelectorAll('input,select,button')].map(e=>({tag:e.tagName,font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,appearance:getComputedStyle(e).appearance,height:e.getBoundingClientRect().height})),panels:[...document.querySelectorAll('.s08-tasks>.wf-panel')].map(e=>({left:e.getBoundingClientRect().left,width:e.getBoundingClientRect().width}))}));
  metrics.frame=await page.evaluate(()=>['#root','main.platform-main','[data-page-context="s08"]','.s08-tasks'].map(selector=>{const e=document.querySelector(selector),s=getComputedStyle(e),r=e.getBoundingClientRect();return{selector,top:r.top,left:r.left,width:r.width,height:r.height,scrollTop:e.scrollTop,display:s.display,margin:s.margin,padding:s.padding,justifyContent:s.justifyContent};}));
  writeFileSync(out+'metrics-'+width+'.json',JSON.stringify(metrics,null,2)+'\n');
  assert(metrics.scrollWidth<=width+1,'S08_LAYOUT_OVERFLOW:'+width);
  // Chrome native SELECT computes normal even with explicit 22px declaration.
  // Preserve native interaction; verify 14px + >=40px actual box, not a blanket exemption.
  assert(metrics.inputs.every(e=>e.font==='14px'&&(e.line==='22px'||e.tag==='SELECT'&&e.line==='normal'&&e.appearance==='auto'&&e.height>=40)),'S08_TYPOGRAPHY:'+width);
  checks.push({name:'layout-'+width,...metrics});await page.screenshot({path:out+'saved-'+width+'-viewport.png',fullPage:false,animations:'disabled'});await page.screenshot({path:out+'saved-'+width+'.png',fullPage:true,animations:'disabled'});
 }
 assert.equal(errors.length,0);assert(!network.some(r=>/jobs|chat|export|approve|lock/.test(r.path)));
 writeFileSync(out+'result-'+randomUUID()+'.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,actualChrome:true,stage,checks,network,errors,taskId:createdTaskId,noAiCall:true,nativeZoomPending:true,fullS08Acceptance:false},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks:checks.length,taskId:createdTaskId,realBrowser:true,fullS08Acceptance:false,evidence:out}));
}catch(error){writeFileSync(out+'failure-'+randomUUID()+'.json',JSON.stringify({passed:false,stage,checks,network,errors,message:String(error.message).slice(0,300),taskId:createdTaskId},null,2)+'\n');await page.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,180),taskId:createdTaskId,evidence:out}));process.exitCode=1;}
finally{await context.close();await browser.close();}
