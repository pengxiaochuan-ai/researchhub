import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {makeAssetApplicabilityUrl} from '../src/asset-applicability-session.js';
import {makeCrfMethodAssetUrl} from '../src/crf-method-assets-session.js';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root=fileURLToPath(new URL('../../',import.meta.url)),rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),scope={studyGroupId:rt.ids.group,researchProjectId:rt.ids.project};
const out=root+'researchhub/docs/testing/evidence/applicability-current-2026-11-11/browser-'+Date.now()+'/';mkdirSync(out,{recursive:true});
const checkpointPath=root+'researchhub/docs/testing/evidence/applicability-current-2026-11-11/browser-fixtures.json',fixtures=JSON.parse(readFileSync(checkpointPath));
const pw=(await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js')).default;
const browser=await pw.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),base='http://127.0.0.1:19501',checks=[],created=[],errors=[];
try{
 for(const role of ['owner','admin']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}},extraHTTPHeaders:{Origin:base,'X-Study-Group-Id':scope.studyGroupId,'X-Research-Project-Id':scope.researchProjectId}});
  try{
   const request=async(path,data)=>{const r=data?await context.request.post(base+'/api'+path,{data}):await context.request.get(base+'/api'+path);const b=await r.json();assert(r.ok(),path+' '+r.status()+' '+JSON.stringify(b));return b;};
   const login=await context.request.post(base+'/api/auth/login',{data:{tenantSlug:rt.ids.tenant,username:role+'@example.org',password:rt.password}});assert.equal(login.status(),201);
   const list=await request('/asset-applicability-drafts?limit=20');const previous=list.items.find(r=>r.sourceStatus==='current');assert(previous);
   const existing=await request('/asset-applicability-drafts/'+previous.id);assert(existing.canOpinions&&existing.canReadHistory);assert.equal(existing.sourceStatus,'current');
   const source=await request('/crf-method-asset-drafts/'+previous.assetId),target=await request('/research-plan-drafts/'+previous.targetPlanId);assert(source.canDerive);
   const fixture=fixtures[role]??={};if(!fixture.assetId){const derived=await request('/crf-method-asset-drafts/'+source.id+'/derivations',{baseVersionNo:source.version,requestKey:'current-access-20261111-'+role+'-derive'});fixture.assetId=derived.asset.id;writeFileSync(checkpointPath,JSON.stringify(fixtures,null,2));}created.push({role,kind:'asset',id:fixture.assetId});
   const child=await request('/crf-method-asset-drafts/'+fixture.assetId);assert(child.lineage.length>0);assert.equal(child.sourceStatus,'current');
   if(!fixture.recordId){const made=await request('/asset-applicability-drafts',{assetId:child.id,assetVersionNo:child.version,targetPlanId:target.id,targetVersionNo:target.version,requestKey:'current-access-20261111-'+role+'-record'});fixture.recordId=made.record.id;writeFileSync(checkpointPath,JSON.stringify(fixtures,null,2));}const record=await request('/asset-applicability-drafts/'+fixture.recordId);created.push({role,kind:'applicability',id:record.id});
   // A new owned pair is accepted without adding it to the expired fixture file.
   assert(record.canOpinions&&record.canReadHistory);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let nativeDialogs=0,jobRequests=0;
   page.on('dialog',async d=>{nativeDialogs++;await d.dismiss();});
   await page.route('**/api/asset-applicability-drafts/*/jobs',r=>{jobRequests++;return r.abort();});
   await page.goto(base+makeAssetApplicabilityUrl(scope,record.id));const section=page.getByRole('region',{name:'本人资产核对内容'});await section.waitFor();
   const opinion=page.locator('#opinion-question'),reason=page.locator('#reason-question');await opinion.selectOption('reference');const text='本机权限恢复验收：仅记录本人复用建议，固定来源仍需人工核对。';await reason.fill(text+' 取消测试');
   const discard=page.getByRole('button',{name:'核对最新记录／放弃未保存意见',exact:true});await discard.click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await reason.inputValue(),text+' 取消测试');assert(await discard.evaluate(e=>document.activeElement===e));await reason.fill(text);
   if(record.opinions.question?.reason!==text){const saveResponse=page.waitForResponse(r=>r.url().endsWith('/'+record.id+'/opinions')&&r.request().method()==='POST');await page.getByRole('button',{name:'保存本人核对意见',exact:true}).click();const savedResponse=await saveResponse;assert(savedResponse.ok());const saved=await savedResponse.json();assert.equal(saved.record.version,record.version+1);}
   await page.reload();await section.waitFor();assert.equal(await reason.inputValue(),text);await page.screenshot({path:out+role+'-saved.png',fullPage:true});
   if(record.canAi){const ai=page.getByRole('button',{name:'请求新的AI核对（计费）',exact:true});await ai.click();await page.getByRole('dialog',{name:'开始AI核对？'}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert(await ai.evaluate(e=>document.activeElement===e));assert.equal(jobRequests,0);}
   await reason.fill(text+' 未保存');await page.locator('#applicability-version').selectOption('1');await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'放弃并继续',exact:true}).click();await page.getByText('固定历史只读；不会跳到当前版本或提交意见。',{exact:true}).waitFor();assert(await reason.isDisabled());
   await page.getByRole('button',{name:'核对最新记录／放弃未保存意见',exact:true}).click();await page.waitForFunction(expected=>{const el=document.querySelector('#reason-question');return el&&!el.disabled&&el.value===expected;},text);assert.equal(await reason.inputValue(),text);
   await reason.fill(text+' 离开测试');await page.getByRole('link',{name:'返回本人核对列表',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await reason.inputValue(),text+' 离开测试');
   await page.getByRole('link',{name:'返回本人核对列表',exact:true}).click();await page.getByRole('button',{name:'放弃并离开',exact:true}).click();await page.waitForURL(u=>!u.searchParams.has('applicabilityId'));assert.equal(nativeDialogs,0);assert.equal(jobRequests,0);
   await page.goto(base+makeCrfMethodAssetUrl('a02',scope,child.id));await page.getByRole('region',{name:'方法资产候选内容'}).waitFor();assert.equal(await page.getByRole('button',{name:'派生本人新方法候选',exact:true}).isEnabled(),true);await page.screenshot({path:out+role+'-derived.png',fullPage:true});
   const foreign=fixtures[role==='owner'?'admin':'owner'];if(foreign?.recordId)assert.equal((await context.request.get(base+'/api/asset-applicability-drafts/'+foreign.recordId)).status(),403);
   assert.equal((await context.request.get(base+'/api/asset-applicability-drafts/'+record.id,{headers:{'X-Research-Project-Id':'other-study'}})).status(),403);
   await page.goto(base+'/pages/p01/');await page.getByRole('heading',{name:/，您好$/}).waitFor();await page.locator('.personal-draft-details summary').click();const row=page.locator('.personal-draft-details li').filter({has:page.locator('a[href="'+makeAssetApplicabilityUrl(scope,record.id)+'"]')});await row.waitFor();await row.locator('a').click();await section.waitFor();
   for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.waitForFunction(()=>{const nav=document.querySelector('.qiyan-platform-sidebar');return !nav||nav.getBoundingClientRect().right<=0;});await page.screenshot({path:out+role+'-'+width+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
   checks.push({role,existingRead:true,newOwnedPair:true,derived:true,editedAndReloaded:true,history:true,dialogCancelEscapeFocus:true,leaveConfirmedOnce:true,p01Entry:true,nativeDialogs,modelCalls:0,canAi:record.canAi,quota:record.quota});
  }finally{await context.close();}
 }
 assert.equal(errors.length,0);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,created,errors,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks,created,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({message:e.message,checks,created,errors,modelCalls:0},null,2));console.error(JSON.stringify({failed:true,message:e.message,evidence:out}));throw e;}finally{await browser.close();}
