import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {myResearchDraftLink} from '../src/my-research-draft-route.js';
import {myResearchReportPath} from '../src/my-research-report-preview.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=root+'researchhub/docs/testing/evidence/p01-closure-2026-11-10/'+Date.now()+'/';
mkdirSync(out,{recursive:true});
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:19501',checks=[],errors=[];
try{
 for(const role of ['owner','admin']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}}});
  try{
   const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:role+'@example.org',password:rt.password}});assert.equal(login.status(),201);
   const response=await context.request.get(base+'/api/my-research/overview');assert.equal(response.status(),200);assert.match(response.headers()['cache-control'],/no-store/);const first=await response.json();
   for(const suffix of ['?draftPage=0','?taskPage=1.5','?draftPage=1&draftPage=2','?accountId=other'])assert.equal((await context.request.get(base+'/api/my-research/overview'+suffix)).status(),400);
   const secondResponse=await context.request.get(base+'/api/my-research/overview?draftPage=2');assert.equal(secondResponse.status(),200);const second=await secondResponse.json();assert.equal(second.pagination.drafts.page,2);assert.equal(second.drafts.some(d=>first.drafts.some(f=>f.id===d.id)),false);
   const empty=await(await context.request.get(base+'/api/my-research/overview?draftPage=100000')).json();assert.equal(empty.drafts.length,0);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:first.profile.displayName+'，您好',exact:true}).waitFor();await page.screenshot({path:out+role+'-collapsed.png',fullPage:true});
   await page.locator('.personal-draft-details summary').click();const drafts=page.locator('.personal-draft-details');assert.equal(await drafts.locator('li').count(),first.drafts.length);
   if(first.pagination.drafts.hasNext){await drafts.getByRole('button',{name:'查看全部草稿'}).click();await drafts.getByRole('button',{name:'下一页'}).waitFor();await drafts.getByRole('button',{name:'下一页'}).click();await drafts.getByText('第 2 页',{exact:true}).waitFor();for(const d of second.drafts)assert.equal(await drafts.getByText(d.title,{exact:true}).count()>0,true);await page.screenshot({path:out+role+'-draft-page2.png',fullPage:true});await drafts.getByRole('button',{name:'上一页'}).click();await drafts.getByText('第 1 页',{exact:true}).waitFor();
    const failure='**/api/my-research/overview?draftPage=2';await page.route(failure,r=>r.fulfill({status:503,json:{}}));await drafts.getByRole('button',{name:'下一页'}).click();await drafts.getByRole('alert').waitFor();assert.equal(await drafts.locator('li').count(),0);await page.unroute(failure);await drafts.getByRole('button',{name:'重新读取',exact:true}).click();await drafts.getByText('第 2 页',{exact:true}).waitFor();
   }
   const previews={},families=new Set(),destinations={};
   for(let index=1;index<=Math.ceil(first.summary.ownDraftCount/5);index++){
    const overview=await(await context.request.get(base+'/api/my-research/overview?draftPage='+index)).json();
    for(const d of overview.drafts){const link=myResearchDraftLink(d);if(link){const kind=d.workspace?.kind??'plan';families.add(kind);if(!destinations[kind]){const w=d.workspace,readPath=kind==='plan'?'/research-plan-drafts/'+d.id:kind==='applicability'?'/asset-applicability-drafts/'+d.id:kind==='method-asset'?'/crf-method-asset-drafts/'+d.id:kind==='asset'?'/research-asset-drafts/'+d.id:kind==='trial-report'?'/research-plan-drafts/'+w.planId:kind==='collection'||kind==='edc-report'?'/research-plan-drafts/'+w.planId+'/synthetic-collections/'+(kind==='collection'?d.id:w.collectionId):myResearchReportPath(d);const response=await context.request.get(base+'/api'+readPath,{headers:{'X-Study-Group-Id':d.studyGroupId,'X-Research-Project-Id':d.researchProjectId}});if(response.ok()&&(await response.json()).sourceStatus!=='restricted')destinations[kind]={href:link.href,readPath};}}
     const path=myResearchReportPath(d);if(!path||previews[d.workspace.kind])continue;
     const response=await context.request.get(base+'/api'+path,{headers:{'X-Study-Group-Id':d.studyGroupId,'X-Research-Project-Id':d.researchProjectId}});if(response.ok()){const report=await response.json();if(report.id===d.id&&['current','stale'].includes(report.sourceStatus))previews[d.workspace.kind]={page:index,draft:d};}
    }
   }
   const destinationChecks=[];
   for(const [kind,target] of Object.entries(destinations)){const expected=page.waitForResponse(r=>r.url()===base+'/api'+target.readPath&&r.status()===200,{timeout:15000});await page.goto(base+target.href);await expected;await page.screenshot({path:out+role+'-'+kind+'-workspace.png',fullPage:true});destinationChecks.push(kind);}
   assert.equal(destinationChecks.length,8,role+' eight available workspace families with current applicability authority');
   assert(families.has('applicability'));
   for(const kind of ['trial-report','edc-report','method-report'])assert(previews[kind],role+' readable '+kind+' fixture');
   for(const [kind,fixture] of Object.entries(previews)){
    await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:first.profile.displayName+'，您好',exact:true}).waitFor();await page.locator('.personal-draft-details summary').click();const list=page.locator('.personal-draft-details');
    if(fixture.page>1){await list.getByRole('button',{name:'查看全部草稿'}).click();await list.getByRole('button',{name:'下一页'}).waitFor();for(let n=2;n<=fixture.page;n++){await list.getByRole('button',{name:'下一页'}).click();await list.getByText('第 '+n+' 页',{exact:true}).waitFor();}}
    const row=list.locator('li').filter({has:page.locator('a[href="'+myResearchDraftLink(fixture.draft).href+'"]')}).first();await row.getByRole('button',{name:'阅读报告',exact:true}).click();await row.getByRole('region',{name:'报告草稿只读预览'}).locator('.personal-report-reading').waitFor();await page.screenshot({path:out+role+'-'+kind+'-preview.png',fullPage:true});
    if(kind==='method-report'){
     await page.setViewportSize({width:390,height:844});await row.getByRole('button',{name:'收起报告'}).scrollIntoViewIfNeeded();await page.screenshot({path:out+role+'-report-390.png'});assert.equal(await row.locator('.personal-report-reading').evaluate(node=>node.scrollWidth>node.clientWidth+1),false);const fonts=await row.locator('.personal-report-reading h1,.personal-report-reading h2,.personal-report-reading h3,.personal-report-reading h4,.personal-report-reading h5,.personal-report-reading h6').evaluateAll(nodes=>nodes.map(n=>parseFloat(getComputedStyle(n).fontSize)));assert(fonts.every(n=>n>=16));await page.setViewportSize({width:1440,height:1000});
    }
    await row.getByRole('button',{name:'收起报告'}).click();assert.equal(await row.locator('.personal-report-reading').count(),0);
    if(kind==='method-report'){
     const path=myResearchReportPath(fixture.draft),pattern='**/api'+path;let arrived,release;const seen=new Promise(r=>{arrived=r;}),held=new Promise(r=>{release=r;}),response=await context.request.get(base+'/api'+path,{headers:{'X-Study-Group-Id':fixture.draft.studyGroupId,'X-Research-Project-Id':fixture.draft.researchProjectId}}),body=await response.json();
     await page.route(pattern,async route=>{arrived();await held;try{await route.fulfill({status:200,json:body});}catch{}});await row.getByRole('button',{name:'阅读报告',exact:true}).click();await seen;await row.getByRole('button',{name:'收起报告'}).click();release();await page.unroute(pattern);await page.waitForTimeout(150);assert.equal(await row.locator('.personal-report-reading').count(),0);
     await page.route(pattern,r=>r.fulfill({status:403,json:{code:'CONTROLLED_SOURCE_DENIAL'}}));await row.getByRole('button',{name:'阅读报告',exact:true}).click();await row.getByRole('alert').waitFor();assert.equal(await page.locator('.project').count()>0,true);assert.equal(await row.locator('.personal-report-reading').count(),0);await page.unroute(pattern);await row.getByRole('button',{name:'重新读取报告'}).click();await row.locator('.personal-report-reading').waitFor();
     await row.getByRole('button',{name:'收起报告'}).click();await page.route(pattern,r=>r.fulfill({status:401,json:{code:'CONTROLLED_SESSION_EXPIRY'}}));await row.getByRole('button',{name:'阅读报告',exact:true}).click();await page.getByRole('heading',{name:'登录后查看我的工作台',exact:true}).waitFor();assert.equal(await page.locator('.project,.record-list li,.personal-report-reading').count(),0);await page.unroute(pattern);
    }
   }
   await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:first.profile.displayName+'，您好',exact:true}).waitFor();
   await page.locator('.personal-task-details summary').click();const tasks=page.locator('.personal-task-details');
   if(first.tasks.length){const task=first.tasks[0],link=tasks.getByRole('link',{name:'处理任务 →'}).first();assert.equal(new URL(await link.getAttribute('href'),base).searchParams.get('taskId'),task.id);await link.click();await page.getByRole('heading',{name:'任务详情',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('taskId'),task.id);await page.screenshot({path:out+role+'-task-detail.png',fullPage:true});}
   await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:first.profile.displayName+'，您好',exact:true}).waitFor();
   for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.screenshot({path:out+role+'-'+width+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
   checks.push({role,passed:true,drafts:first.summary.ownDraftCount,tasks:first.summary.myOpenTaskCount,pagination:true,taskDeepLink:true,workspaceKinds:[...families],destinationChecks,previews:Object.keys(previews)});
  }finally{await context.close();}
 }
 const result={at:new Date().toISOString(),checks,errors,passed:checks.length===2&&errors.length===0,environment:'local-synthetic',businessWrites:0,modelCalls:0,scope:'task links, pagination, workspace family mapping and specialized read-only report previews'};writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:out}));assert.equal(result.passed,true);
}finally{await browser.close();}
