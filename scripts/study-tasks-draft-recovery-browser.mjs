// Reuses an existing S08 task; never creates a ninth task or calls a model.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
process.umask(0o077);
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const [fixture]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});const {plan}=fixture.manifest;assert(fixture.manifest.syntheticOnly);
const [existing]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT t.id FROM study_task t JOIN rh_study_tasks.operation o ON o.task_id=t.id AND o.action='create' WHERE o.tenant_id=${plan.scope.tenantId} AND o.research_project_id=${plan.scope.researchProjectId} AND t.status IN ('open','in_progress','blocked') ORDER BY t.id LIMIT 1`,{readOnly:true});assert(existing);
const taskId=existing.id,headers={'X-Study-Group-Id':plan.scope.studyGroupId,'X-Research-Project-Id':plan.scope.researchProjectId,Origin:base};
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/draft-recovery-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=[],checks=[],requests=[],errors=[];let page,original,owner,admin,release,stage='setup';
async function signed(role){const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'videos'}});contexts.push(context);assert.equal((await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}})).status(),201);return context;}
async function read(){const r=await owner.request.get(base+'/api/study-tasks/'+taskId,{headers});assert.equal(r.status(),200);return (await r.json()).item;}
async function patch(context,input){const r=await context.request.patch(base+'/api/study-tasks/'+taskId,{headers,data:{requestKey:plan.runId+'-draft-'+randomUUID(),...input}});requests.push({method:'PATCH',status:r.status()});assert.equal(r.status(),200);return r.json();}
const row=()=>page.locator('.s08-task-item').filter({has:page.locator(':scope > div > strong',{hasText:original.name})}).first();
async function visit(){await page.goto(base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.scope.researchProjectId,taskId}));await page.locator('.s08-task-detail').waitFor();}
try{
 owner=await signed('owner');admin=await signed('admin');original=await read();page=await owner.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
 await visit();
 stage='conflict-keeps-edit';await page.getByRole('button',{name:'编辑任务',exact:true}).click();
 const draft=original.name.slice(0,95)+'-保留草稿-'+randomUUID().slice(0,6);await page.getByLabel('任务标题',{exact:true}).fill(draft);
 const before=await read();await patch(admin,{expectedVersion:before.version,priority:before.priority==='high'?'normal':'high'});
 const rejected=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith('/api/study-tasks/'+taskId));await page.getByRole('button',{name:'保存修改',exact:true}).click();assert.equal((await rejected).status(),409);assert.equal(await page.getByLabel('任务标题',{exact:true}).inputValue(),draft);
 await page.getByRole('button',{name:'确认保留修改并按最新版本提交',exact:true}).waitFor();
 await page.getByRole('button',{name:'刷新任务',exact:true}).click();assert.equal(await page.getByLabel('任务标题',{exact:true}).inputValue(),draft);
 const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith('/api/study-tasks/'+taskId));await page.getByRole('button',{name:'确认保留修改并按最新版本提交',exact:true}).click();assert.equal((await saved).status(),200);await page.getByText(/已保存到服务端/).waitFor();assert.equal((await read()).name,draft);checks.push('real_second_account_conflict_preserves_draft_explicit_compare_and_cas_resubmit');
 // Restore only this run's edits before testing detail drafts.
 let value=await read();await patch(owner,{expectedVersion:value.version,name:original.name,priority:original.priority});await visit();
 stage='same-id-protection';await page.getByText('执行与状态操作',{exact:true}).click();const form=page.locator('.s08-transition-form');await form.getByLabel('任务状态操作',{exact:true}).selectOption('blocked');await form.getByLabel('受阻说明',{exact:true}).fill('重复查看时必须保留的未保存说明');
 value=await read();await patch(admin,{expectedVersion:value.version,priority:value.priority==='high'?'normal':'high'});
 const dialog=page.waitForEvent('dialog');const click=page.locator('.s08-task-item').filter({has:page.locator('.s08-task-detail')}).getByRole('button',{name:'查看详情',exact:true}).click();const shown=await dialog;await shown.dismiss();await click;assert.equal(await form.getByLabel('受阻说明',{exact:true}).inputValue(),'重复查看时必须保留的未保存说明');checks.push('same_task_repeat_view_requires_explicit_discard_and_preserves_detail_draft');
 stage='draft-entered-during-read';await visit();await page.getByText('执行与状态操作',{exact:true}).click();const nextForm=page.locator('.s08-transition-form');await nextForm.getByLabel('任务状态操作',{exact:true}).selectOption('blocked');await nextForm.getByLabel('受阻说明',{exact:true}).fill('请求开始前的草稿');
 value=await read();await patch(admin,{expectedVersion:value.version,priority:value.priority==='high'?'normal':'high'});
 let began;const started=new Promise(ok=>{began=ok;}),held=new Promise(ok=>{release=ok;});let first=true;
 await page.route('**/api/study-tasks/'+taskId,async route=>{if(first&&route.request().method()==='GET'){first=false;const response=await route.fetch();began();await held;await route.fulfill({response});}else await route.continue();});
 page.once('dialog',d=>d.accept());await page.locator('.s08-task-item').filter({has:page.locator('.s08-task-detail')}).getByRole('button',{name:'查看详情',exact:true}).click();await started;await nextForm.getByLabel('受阻说明',{exact:true}).fill('请求在途期间继续输入的新草稿');release();await page.getByText('读取期间产生了新修改，已保留草稿；请先保存或取消后再刷新详情。',{exact:true}).waitFor();assert.equal(await nextForm.getByLabel('受阻说明',{exact:true}).inputValue(),'请求在途期间继续输入的新草稿');checks.push('actual_held_200_never_remounts_draft_edited_after_request_start');
 await page.screenshot({path:out+'draft-preserved.png',fullPage:true});assert.equal(errors.length,0);
 writeFileSync(out+'result.json',JSON.stringify({passed:true,syntheticOnly:true,taskId,newTasks:0,modelCalls:0,checks,requests,errors,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,checks,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,checks,requests,message:e.message.slice(0,500)},null,2));await page?.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,message:e.message.slice(0,220),evidence:out}));process.exitCode=1;}
finally{release?.();if(original&&owner){const current=await read();if(current.name!==original.name||current.priority!==original.priority)await patch(owner,{expectedVersion:current.version,name:original.name,priority:original.priority});}for(const c of contexts)await c.close();await browser.close();}
