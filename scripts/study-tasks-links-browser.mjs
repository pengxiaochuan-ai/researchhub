import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const [row]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});assert(row?.manifest?.syntheticOnly);const {plan}=row.manifest;
const task=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{...plan.scope,name:plan.runId+'-浏览器编辑已保存'},select:{id:true,version:true}}),{readOnly:true});assert(task);
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/browser-links-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let context=await browser.newContext(),page=await context.newPage(),stage='login';const checks=[],network=[],errors=[];
try{
 await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill('owner@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/p01/');
 const auth=await context.storageState();await context.close();context=await browser.newContext({storageState:auth,viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message.slice(0,160)));page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/study-tasks'))network.push({path:u.pathname,method:r.request().method(),status:r.status()});});
 await page.goto(base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.scope.researchProjectId,taskId:task.id}));
 const picker=page.getByLabel('选择关联记录',{exact:true});await picker.waitFor();await page.waitForFunction(()=>document.querySelector('.s08-context select')?.options.length>=3);
 const ids=await picker.locator('option').evaluateAll(options=>options.map(o=>o.value).filter(v=>v&&v!=='none'));assert(ids.length>=2);
 async function save(value){await picker.selectOption(value);const response=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/study-tasks/'+task.id+'/context');await page.getByRole('button',{name:'确认关联',exact:true}).click();assert.equal((await response).status(),200);await page.waitForFunction(()=>!document.querySelector('.s08-context select')?.disabled);}
 stage='bind';await save(ids[0]);await page.locator('.s08-context').getByText(/固定版本 v/).waitFor();checks.push('native_select_explicit_bind_reads_real_fixed_version_summary');
 for(const width of [1440,1280,390,320]){await page.setViewportSize({width,height:900});if(width<700)await page.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);await page.locator('.s08-context h3').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'bound-'+width+'.png',fullPage:false,animations:'disabled'});}
 assert.equal(await page.getByRole('link',{name:'打开关联访视／记录',exact:true}).count(),0);assert((await page.locator('.s08-context').innerText()).includes('不支持固定版本回链'));checks.push('no_unversioned_or_demo_navigation_claim');
 stage='swap';await save(ids[1]);checks.push('native_context_rebind_saved');
 stage='unlink';await save('none');await page.locator('.s08-context').getByText('尚未关联访视或合成记录。',{exact:true}).waitFor();checks.push('explicit_unlink_saved');
 assert.equal(errors.length,0);assert(network.every(n=>n.status===200));
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks,network,errors,newTasks:0,modelCalls:0,sourceWrites:0,actualChrome:true,fixedVersionBacklink:'not_available_target_current_only_summary_as_approved'},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,newTasks:0,modelCalls:0,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,checks,network,errors,message:e.message.slice(0,240)},null,2));console.error(JSON.stringify({passed:false,stage,message:e.message.slice(0,150),evidence:out}));process.exitCode=1;}
finally{await context.close();await browser.close();}
