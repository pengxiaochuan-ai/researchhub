// Four explicit UI stages; never automatically retries a business write.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {reportsUrl} from '../src/formal-reports-session.js';
import {reportAssetReviewUrl,reportAssetDetailUrl,reportAssetListUrl} from '../src/report-asset-context.js';
import {REPORT_CONTEXT as c} from './research-assets-report-context.mjs';
assert(process.argv.length===3&&['create','return','revise','approve','readonly'].includes(process.argv[2]));const stage=process.argv[2];
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
async function row(){return withFixtureTransaction(env,'direct',async tx=>{await bindCatalogContext(tx,ids,ids.admin);return(await tx.$queryRawUnsafe('SELECT working_version_no,working_state,revision,release_state FROM rh_asset.asset_registry WHERE asset_id=$1',c.assetId))[0]??null;},{readOnly:true});}
const before=await row(),expected={create:null,return:[1,'draft',1],revise:[1,'changes_requested',3],approve:[2,'draft',4],readonly:[2,'approved',6]}[stage];
if(!expected)assert.equal(before,null,'Do not repeat create; inspect original receipt and database state.');else assert.deepEqual([before?.working_version_no,before?.working_state,before?.revision],expected,'Stage already changed; inspect instead of replaying writes.');
const origin='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url))),out=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/report-context-20261116/',import.meta.url).pathname;
mkdirSync(out+'video-'+stage,{recursive:true});
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const trace={stage,before,posts:[],errors:[],checks:[]};let context,page;
async function checkpoint(name){trace.checks.push(name);await page.screenshot({path:out+stage+'-'+name+'.png',fullPage:true});writeFileSync(out+'live-'+stage+'.json',JSON.stringify(trace,null,2));}
async function login(actor,target){
 await page.goto(origin+'/pages/p003/?returnTo='+encodeURIComponent(target));await page.getByLabel('邮箱',{exact:true}).fill(actor+'@example.org');await page.getByLabel('密码',{exact:true}).fill(runtime.password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL(url=>url.pathname===new URL(target,origin).pathname);
}
async function finishGovernance(){const d=page.getByRole('dialog');await d.getByText('操作结论已保存，请以重新读取的资产状态为准。',{exact:true}).waitFor();await d.getByRole('button',{name:'完成',exact:true}).click();}
async function submit(){await page.getByRole('button',{name:'提交审核',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'提交审核',exact:true}).click();await finishGovernance();await page.getByRole('button',{name:'审核资产',exact:true}).waitFor();}
async function review(decision,reason){
 await page.getByRole('button',{name:'审核资产',exact:true}).click();const d=page.getByRole('dialog');await d.locator('select[name="conclusion"]').selectOption(decision);
 if(decision==='approved'){const boxes=d.getByRole('checkbox');assert.equal(await boxes.count(),3,'Current self-review must be acknowledged');for(const box of await boxes.all())await box.check();}
 await d.locator('textarea[name="governanceReason"]').fill(reason);await d.getByRole('button',{name:'审核资产',exact:true}).click();await finishGovernance();
}
try{
 context=await browser.newContext({viewport:{width:1440,height:1075},recordVideo:{dir:out+'video-'+stage}});page=await context.newPage();page.setDefaultTimeout(35000);page.on('pageerror',e=>trace.errors.push(e.message));
 let interrupted=false;
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(['GET','HEAD'].includes(req.method())||path.startsWith('/api/auth/'))return route.continue();
  const allowed=stage==='create'?path==='/api/research-assets/report-context-registrations':stage==='revise'?path==='/api/research-assets/report-context-revisions':['return','approve'].includes(stage)&&new RegExp('^/api/research-assets/'+c.assetId+'/(submissions|reviews)$').test(path);
  assert(allowed,'Unexpected non-auth business write: '+path);trace.posts.push({path,body:req.postDataJSON()});
  if(stage==='create'&&!interrupted){interrupted=true;const response=await route.fetch({maxRetries:0});trace.originalCreate={status:response.status(),body:await response.json()};assert.equal(response.status(),201);return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'连接暂不可用，请核对原提交。'})});}
  return route.continue();
 });
 if(stage==='create'||stage==='revise'){
  await login('admin',reportsUrl(c.studyId,{artifactId:c.reportId}));await page.getByRole('button',{name:'登记为科研资产',exact:true}).click();const d=page.getByRole('dialog');
  if(stage==='create'){
   await d.getByLabel('材料使用依据',{exact:true}).fill('本人原创合成研究材料，仅限本Study私有登记及资产审核，不开放共享与AI。');
   await d.getByRole('button',{name:'登记资产',exact:true}).click();await d.getByRole('button',{name:'核对原操作结果',exact:true}).waitFor();await checkpoint('unknown-create');
   await d.getByRole('button',{name:'核对原操作结果',exact:true}).click();
  }else{
   await d.getByLabel('使用限制',{exact:true}).fill('补充：仅保留合成研究的历史结果，不复制原始数据，不作为新研究结论；来源变化时重新核对。');
   await d.getByRole('button',{name:'保存资产说明',exact:true}).click();
  }
  await d.getByText('资产已保存；审核结果以治理页面为准。',{exact:true}).waitFor();await checkpoint('saved');await d.getByRole('button',{name:'前往资产审核',exact:true}).click();await page.waitForURL('**/pages/g02/**');
 }else if(stage==='return'||stage==='approve'){
  await login('admin',reportAssetReviewUrl());await submit();await review(stage==='return'?'changes_requested':'approved',stage==='return'?'请补充历史结果的使用范围与限制，原方法报告无需修改。':'已核对固定报告、来源及合成材料用途；本人审核事实确认，批准后保持私有未发布。');
 }else{
  await login('admin',reportAssetDetailUrl(2));await page.getByRole('heading',{name:'通用合成研究更正后描述统计报告',exact:true}).first().waitFor();
  await page.getByRole('link',{name:'查看原方法报告 · 第1版',exact:true}).waitFor();await checkpoint('a02-current');
  await page.getByText('变更记录',{exact:true}).click();await page.getByText('已核对固定报告、来源及合成材料用途；本人审核事实确认，批准后保持私有未发布。',{exact:true}).waitFor();await checkpoint('a02-history');
  await page.goto(origin+reportAssetListUrl(2));await page.getByText('通用合成研究更正后描述统计报告',{exact:true}).first().waitFor();await checkpoint('a01');
 }
 if(stage!=='readonly'){await page.getByRole('heading',{name:'科研资产审核',exact:true}).waitFor();const state={create:/第1版.*待提交/,return:/第1版.*退回修订/,revise:/第2版.*待提交/,approve:/第2版.*已审核，未发布/}[stage];await page.getByText(state).waitFor();await checkpoint('g02');}
 trace.after=await row();assert.equal(trace.errors.length,0);assert.equal(trace.posts.length,['create','revise'].includes(stage)?1:['return','approve'].includes(stage)?2:0);
 trace.passed=true;writeFileSync(out+'live-'+stage+'.json',JSON.stringify(trace,null,2));await context.close();context=null;console.log('REPORT_CONTEXT_LIVE_'+stage.toUpperCase()+'_PASSED');
}catch(e){trace.failure=e.message;trace.after=await row();writeFileSync(out+'live-'+stage+'-failure.json',JSON.stringify(trace,null,2));throw e;}
finally{await context?.close();await browser.close();}
