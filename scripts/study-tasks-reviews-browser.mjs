import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const [row]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});assert(row?.manifest?.syntheticOnly);const {plan,taskIds}=row.manifest,taskId=taskIds[1];
const task=()=>withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{id:taskId,tenantId:plan.scope.tenantId,studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.project.id},select:{id:true,status:true,version:true,reviewStatus:true,reviewedBy:true,reviewNote:true}}),{readOnly:true});
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/browser-reviews/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),stage='login';const checks=[],network=[],errors=[];
try{
 await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill('admin@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/p01/');
 const auth=await context.storageState();await context.close();context=await browser.newContext({storageState:auth,viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});page=await context.newPage();
 page.on('pageerror',error=>errors.push({stage,name:error.name,message:error.message.slice(0,160)}));page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/'))network.push({stage,path:u.pathname,method:r.request().method(),status:r.status()});});
 await page.goto(base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.project.id,taskId}));await page.getByRole('heading',{level:1,name:plan.project.name}).waitFor();
 stage='review';if((await task()).reviewStatus==='pending_review'){
  await page.getByText('任务验收',{exact:true}).click();const form=page.locator('.s08-review-form');await form.getByLabel('任务验收操作',{exact:true}).selectOption('return');await form.getByRole('button',{name:'确认任务验收',exact:true}).click();await form.locator('[role=alert]').waitFor();assert.equal((await task()).reviewStatus,'pending_review');checks.push('empty_return_reason_does_not_mutate_task');
  await form.getByLabel('任务验收操作',{exact:true}).selectOption('accept');await form.getByLabel('验收备注／退回原因',{exact:true}).fill('本机合成自验：本人提交并核对，不作为独立专业复核。');assert((await form.innerText()).includes('不是独立复核'));
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/study-tasks/'+taskId+'/reviews');await form.getByRole('button',{name:'确认任务验收',exact:true}).click();assert.equal((await response).status(),200);
 }
 await page.getByText('同一账号提交与验收，不是独立复核。',{exact:true}).waitFor();const current=await task();assert.equal(current.reviewStatus,'accepted');assert.equal(current.reviewedBy,plan.ids.admin);assert.equal(current.status,'completed');checks.push('native_self_review_real_reviewer_and_explicit_non_independence');
 stage='layout';for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});if(width<700)await page.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByText('同一账号提交与验收，不是独立复核。',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'accepted-'+width+'.png',animations:'disabled',fullPage:false});}checks.push('review_three_viewports_no_horizontal_overflow');
 assert.equal(errors.length,0);assert(!network.some(r=>/jobs|chat|export|approve|lock/.test(r.path)));
 writeFileSync(out+'result-'+randomUUID()+'.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,actualChrome:true,checks,network,errors,taskId,version:current.version,newTasks:0,modelCalls:0,professionalAcceptance:false},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,taskId,version:current.version,newTasks:0,evidence:out}));
}catch(error){writeFileSync(out+'failure-'+randomUUID()+'.json',JSON.stringify({passed:false,stage,checks,network,errors,message:String(error.message).slice(0,300)},null,2)+'\n');console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,200),evidence:out}));process.exitCode=1;}
finally{await context.close();await browser.close();}
