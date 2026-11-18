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
const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/browser-reminders-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],network=[],errors=[];let stage='login';
try{
 for(const role of ['admin','owner']){
  let context=await browser.newContext(),page=await context.newPage();
  await page.goto(base+'/pages/p003/');await page.getByLabel('邮箱',{exact:true}).fill(role+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/pages/p01/');
  const auth=await context.storageState();await context.close();context=await browser.newContext({storageState:auth,viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});page=await context.newPage();
  try{
   page.on('pageerror',e=>errors.push({role,message:e.message.slice(0,120)}));page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/study-tasks'))network.push({role,path:u.pathname,method:r.request().method(),status:r.status()});});
   stage=role+'-read';await page.goto(base+'/pages/s08/?'+new URLSearchParams({studyGroupId:plan.scope.studyGroupId,researchProjectId:plan.scope.researchProjectId,taskId:task.id}));
   const button=page.getByRole('button',{name:'记录站内提醒',exact:true});await button.waitFor();
   if(role==='admin'){
    const old=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT id FROM rh_study_tasks.operation WHERE task_id=${task.id} AND action='remind' AND actor_account_id=${plan.ids.admin}`,{readOnly:true});
    if(!old.length){const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/study-tasks/'+task.id+'/reminders'&&r.request().method()==='POST');await button.click();assert.equal((await response).status(),200);await page.getByRole('heading',{name:'站内提醒记录',exact:true}).waitFor();checks.push('admin_explicit_native_reminder_saved');}
    else checks.push('existing_named_reminder_reused_no_duplicate_write');
   }
   await page.getByRole('heading',{name:'站内提醒记录',exact:true}).waitFor();await page.getByText('任务提醒：请核对当前任务及待办状态。',{exact:false}).first().waitFor();
   checks.push(role+'_current_recipient_reads_real_record_without_delivery_claim');
   for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:900});if(width<700)await page.waitForFunction(()=>document.querySelector('.qiyan-platform-sidebar').getBoundingClientRect().right<=1);
    await page.getByRole('heading',{name:'站内提醒记录',exact:true}).scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:out+role+'-'+width+'.png',fullPage:false,animations:'disabled'});
   }
  }finally{await context.close();}
 }
 assert.equal(errors.length,0);assert(network.every(n=>n.status===200));
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,actualChrome:true,checks,network,errors,newTasks:0,modelCalls:0,externalMessages:0},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,newTasks:0,modelCalls:0,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,checks,network,errors,message:e.message.slice(0,180)},null,2));console.error(JSON.stringify({passed:false,stage,message:e.message.slice(0,180),evidence:out}));process.exitCode=1;}
finally{await browser.close();}
