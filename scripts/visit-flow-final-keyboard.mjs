// Current synthetic pages only; confirmation is cancelled, all business writes blocked.
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {openHarness} from './full-study-runtime.mjs';
import {base,workspace,repo,json,save,loginBrowserContext} from './visit-workflow-qa.mjs';
assert.equal(process.env.VISIT_FLOW_FINAL_QA_WINDOW,'explicit');
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--read-only']);
process.env.VISIT_WORKFLOW_QA_WINDOW='explicit';
const purpose='visit-flow-final-acceptance-2026-11-17',privateDir=workspace+'.tmp/'+purpose+'/',out=repo+'docs/testing/evidence/'+purpose+'/keyboard/';
mkdirSync(out,{recursive:true});
const cp=json(privateDir+'checkpoint.json'),f=json(workspace+'.tmp/visit-capture-review-flow-2026-11-16/fixture.json');
assert.equal(cp.purpose,purpose);assert.equal(cp.browser?.state,'completed','MAIN_ACCEPTANCE_REQUIRED');
const h=await openHarness({privateOutputDir:privateDir+'keyboard-auth/'}),identity={id:h.actor.id,username:h.actor.username,password:h.runtime.password};
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright'),profile=mkdtempSync('/tmp/rh-visit-keyboard-');
const context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:1000},args:['--window-size=1440,1000'],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
const blocked=[],network=[],checks=[],errors=[];
try{
 await loginBrowserContext(context,{tenantSlug:h.runtime.ids.tenant,username:identity.username,password:identity.password,expectedActorId:identity.id});
 await context.route('**/api/**',route=>{const r=route.request(),p=new URL(r.url()).pathname;network.push({method:r.method(),path:p});if(r.method()==='GET'||r.method()==='POST'&&p==='/api/auth/renew')return route.continue();blocked.push({method:r.method(),path:p});return route.abort('blockedbyclient');});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const path=base+'/pages/s09/?'+new URLSearchParams({formalCapture:'1',studyId:f.study.id,visitId:cp.cases.SITE.baseline,assignmentId:cp.query.assignmentId});
 await page.goto(path);const details=page.locator('.fc-assignment details.fc-review');await details.locator('summary').click();
 const reason=details.locator('textarea');await reason.fill('合成键盘验证：仅打开并取消，不执行解锁');
 const trigger=page.getByRole('button',{name:'解锁表单',exact:true});await trigger.waitFor();
 for(const width of [1440,1920,1366,390,320]){
  await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>setTimeout(r,400));});
  await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  const entry=await dialog.evaluate(n=>({containsFocus:n.contains(document.activeElement),font:getComputedStyle(n.querySelector('button')).fontSize,line:getComputedStyle(n.querySelector('button')).lineHeight,bodyWidth:document.documentElement.scrollWidth,innerWidth}));
  assert(entry.containsFocus);assert.equal(entry.font,'14px');assert.equal(entry.line,'22px');assert(entry.bodyWidth<=entry.innerWidth+1);
  await page.keyboard.press('Shift+Tab');assert(await dialog.evaluate(n=>n.contains(document.activeElement)));
  await page.keyboard.press('Tab');assert(await dialog.evaluate(n=>n.contains(document.activeElement)));
  await page.screenshot({path:out+'unlock-dialog-'+width+'.png'});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await trigger.evaluate(n=>document.activeElement===n));
  checks.push({width,...entry,escapeCloses:true,focusRestored:true,tabTrapped:true});
 }
 await reason.fill('');await page.goto(base+'/pages/s05/?'+new URLSearchParams({formalCapture:'1',studyId:f.study.id,assignmentId:cp.query.assignmentId}));
 const scroll=page.getByRole('region',{name:'数据问题表格，可横向滚动',exact:true});await scroll.waitFor();await page.setViewportSize({width:320,height:900});await scroll.scrollIntoViewIfNeeded();await scroll.focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.fc-query-scroll')?.scrollLeft>0);
 const table=await scroll.evaluate(n=>({width:n.clientWidth,scrollWidth:n.scrollWidth,scrollLeft:n.scrollLeft,tabIndex:n.tabIndex,documentWidth:document.documentElement.scrollWidth,innerWidth}));assert(table.scrollWidth>table.width);assert.equal(table.tabIndex,0);assert(table.documentWidth<=table.innerWidth+1);await page.screenshot({path:out+'s05-local-table-320.png'});checks.push({table});
 assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);save(out+'result.json',{at:new Date().toISOString(),passed:true,checks,blocked,errors,network,businessWrites:0,clinicalValidation:false,productionDeployment:false});
 console.log(JSON.stringify({passed:true,widths:5,dialogBusinessWrites:0,tableLocalScroll:true,evidence:out+'result.json'}));
}catch(e){save(out+'failure.json',{at:new Date().toISOString(),message:e.message,blocked,network,checks,errors});throw e;}
finally{await context.close();rmSync(profile,{recursive:true,force:true});}
