import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const [row]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});assert(row?.manifest?.syntheticOnly);const {plan,taskIds}=row.manifest;
const target=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{...plan.scope,name:plan.runId+'-浏览器编辑已保存'},include:{collaborators:true,dependencies:true}}),{readOnly:true});assert(target,'S08_BROWSER_CREATE_EDIT_REQUIRED');assert.equal(target.status,'open','S08_ASSIGNMENT_PHASE_ALREADY_ADVANCED');
const parent=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{id:taskIds[0],...plan.scope},select:{id:true,name:true}}),{readOnly:true});assert(parent);
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/browser-assignments/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),stage='login';const checks=[],network=[],errors=[];
try{
 await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill('owner@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/p01/');
 const auth=await context.storageState();await context.close();context=await browser.newContext({storageState:auth,viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});page=await context.newPage();
 page.on('pageerror',error=>errors.push({stage,name:error.name,message:error.message.slice(0,160)}));page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/'))network.push({stage,path:u.pathname,method:r.request().method(),status:r.status()});});
 stage='assignment';await page.goto(base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.scope.researchProjectId,taskId:target.id}));await page.getByText('调整分派与依赖',{exact:true}).click();
 const form=page.locator('.s08-assignments');await form.getByLabel('分派负责人',{exact:true}).selectOption(plan.ids.admin);
 const ownerName=await form.locator('option[value="'+plan.ids.owner+'"]').textContent();await form.getByLabel('协作者：'+ownerName,{exact:true}).check();await form.getByLabel('前置任务：'+parent.name,{exact:true}).check();
 const needsChange=target.assigneeAccountId!==plan.ids.admin||!target.collaborators.some(c=>c.accountId===plan.ids.owner)||!target.dependencies.some(d=>d.dependsOnTaskId===parent.id);
 if(needsChange){const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/study-tasks/'+target.id+'/assignments');await form.getByRole('button',{name:'保存分派',exact:true}).click();assert.equal((await response).status(),200);await page.getByRole('status').filter({hasText:'已保存到服务端'}).waitFor();}
 const current=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{id:target.id,...plan.scope},include:{collaborators:true,dependencies:true}}),{readOnly:true});assert.equal(current.assigneeAccountId,plan.ids.admin);assert(current.collaborators.some(c=>c.accountId===plan.ids.owner));assert(current.dependencies.some(d=>d.dependsOnTaskId===parent.id));checks.push('native_inline_assignment_collaborator_and_dependency_match_real_pg');
 // Re-open a fresh authoritative version; no task or role creation here.
 await page.reload();await page.getByText('调整分派与依赖',{exact:true}).click();assert.equal(await page.locator('.s08-assignments').getByLabel('分派负责人',{exact:true}).inputValue(),plan.ids.admin);checks.push('reload_reads_saved_assignment');
 stage='layout';for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});if(width<700)await page.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.s08-assignments').getByRole('button',{name:'保存分派',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'assignment-'+width+'.png',animations:'disabled',fullPage:false});}checks.push('assignment_1440_390_320_no_horizontal_overflow');
 assert.equal(errors.length,0);assert(!network.some(r=>/jobs|chat|export|approve|lock/.test(r.path)));
 writeFileSync(out+'result-'+randomUUID()+'.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,actualChrome:true,checks,network,errors,taskId:target.id,newTasks:0,modelCalls:0},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,taskId:target.id,newTasks:0,evidence:out}));
}catch(error){writeFileSync(out+'failure-'+randomUUID()+'.json',JSON.stringify({passed:false,stage,checks,network,errors,message:String(error.message).slice(0,300)},null,2)+'\n');console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,200),evidence:out}));process.exitCode=1;}
finally{await context.close();await browser.close();}
