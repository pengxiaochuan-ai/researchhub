// Real installed Chrome, approved synthetic scope only. No provider calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {makeCrfMethodAssetUrl,makeCrfMethodReportUrl} from '../src/crf-method-assets-session.js';
import {methodAssetBrowserRisks,methodAssetIdentityRisk} from './crf-method-assets-browser-risks.mjs';
import {methodAssetVisuals} from './crf-method-assets-browser-visual.mjs';
import {verifyReviewReadFailures,verifyReviewTargetAuthorization} from './crf-method-assets-review-browser.mjs';
assert(process.argv.includes('--mode')&&process.argv[process.argv.indexOf('--mode')+1]==='local-synthetic');
const which=process.argv[process.argv.indexOf('--case')+1];assert(['entry-list','detail','end-to-end','visual','identity','read-failures','target-auth'].includes(which));
const root='/Users/mac/aisciencesys/',privateDir=root+'.tmp/researchhub-knowledge-local/',runtime=JSON.parse(readFileSync(privateDir+'runtime.json')),fixtures=JSON.parse(readFileSync(root+'.tmp/researchhub-wp07-crf-methods/report-fixtures.json')),ledger=privateDir+'ai-budget-20261022.json',digest=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=digest(),scope={studyGroupId:runtime.ids.group,researchProjectId:runtime.ids.project},base='http://127.0.0.1:19501',out=root+'docs/test/evidence/2026-10-26-researchhub-wp08-crf-method-assets/browser-'+randomUUID().slice(0,8)+'/';
mkdirSync(out,{recursive:true,mode:0o700});const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium??pw.default.chromium,checks=[],failures=[],errors=[],network=[],consoleMessages=[];
for(const actor of ['owner','admin']){
 const context=await chrome.launchPersistentContext(mkdtempSync(root+'.tmp/wp08-browser-'),{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:900},recordVideo:{dir:out+actor+'-video',size:{width:1440,height:900}}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({actor,path:u.pathname,method:r.request().method(),status:r.status(),at:new Date().toISOString()});});page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleMessages.push({actor,type:m.type(),message:m.text()});});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 try{
  assert.equal((await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}})).status(),201);
  const f=fixtures[actor];await page.goto(base+makeCrfMethodReportUrl(scope,f.planId,f.collectionId,f.runId,f.reportId,1));
  await page.getByRole('region',{name:'真实方法报告草稿',exact:true}).waitFor();
  assert((await page.getByRole('region',{name:'真实方法报告草稿',exact:true}).innerText()).includes('报告 v1'));
  // Explicit history remains read-only; user must deliberately select current head.
  await page.getByRole('button',{name:'核对最新方法报告',exact:true}).click();
  await page.getByRole('button',{name:'形成我的方法资产候选',exact:true}).click();
  await page.waitForURL(u=>u.pathname==='/pages/a02/'&&u.searchParams.has('crfMethodAssets'));
  await page.getByRole('region',{name:'方法资产候选内容',exact:true}).waitFor();
  const assetId=new URL(page.url()).searchParams.get('crfMethodAssetId'),headers={'X-Study-Group-Id':scope.studyGroupId,'X-Research-Project-Id':scope.researchProjectId};
  if(which==='read-failures')await verifyReviewReadFailures({page,checks,actor});
  if(which==='target-auth')await verifyReviewTargetAuthorization({page,context,base,headers,privateDir,scope,checks,actor});
  if(which==='identity')await methodAssetIdentityRisk({page,context,base,runtime,checks,actor});
  if(!['entry-list','visual','identity','read-failures','target-auth'].includes(which)){
   const input=page.getByLabel('方法资产本人复用说明（不改写历史证据）',{exact:true});await input.waitFor();
   const previous=await(await context.request.get(base+'/api/crf-method-asset-drafts/'+assetId,{headers})).json(),notes='WP08浏览器本人复用说明 '+actor+' '+randomUUID();
   await input.fill(notes);await page.getByRole('button',{name:'保存方法资产复用说明',exact:true}).click();await page.getByText('已保存本人说明 v'+(previous.version+1),{exact:false}).waitFor();
   const updated=await(await context.request.get(base+'/api/crf-method-asset-drafts/'+assetId,{headers})).json();assert.equal(updated.notes,notes);assert.equal(updated.snapshotHash,previous.snapshotHash);assert.deepEqual(updated.reuseRecipe,previous.reuseRecipe);
   await page.getByLabel('方法候选历史版本',{exact:true}).selectOption(String(previous.version));await page.getByText('固定候选历史版本，只读核对',{exact:false}).waitFor();assert(await input.isDisabled());
   await page.getByRole('button',{name:'核对最新方法候选',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#method-asset-notes')?.disabled);assert.equal(await input.inputValue(),notes);
   const fonts={reading:await page.locator('.method-reading p').first().evaluate(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight})),input:await input.evaluate(e=>({size:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}))};assert.deepEqual(fonts,{reading:{size:'16px',line:'28px'},input:{size:'14px',line:'22px'}});writeFileSync(out+actor+'-fonts.json',JSON.stringify(fonts));
   const source=page.getByText('核对固定来源、血缘与完整性',{exact:true});await source.focus();await page.keyboard.press('Enter');await page.getByRole('link',{name:'核对原方法报告固定版本',exact:true}).waitFor();await source.focus();await page.keyboard.press('Space');
   await page.getByRole('button',{name:'派生本人新方法候选',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('crfMethodAssetId')!==assetId);await input.waitFor();assert.equal(await input.inputValue(),'');
   const childId=new URL(page.url()).searchParams.get('crfMethodAssetId'),child=await(await context.request.get(base+'/api/crf-method-asset-drafts/'+childId,{headers})).json();assert.equal(child.lineage.at(-1).id,assetId);assert.equal(child.lineage.at(-1).version,updated.version);assert.equal(child.snapshotHash,updated.snapshotHash);
   assert.equal(await page.locator('.qiyan-page-actions button').count(),0,'new family cannot expose legacy dead actions');checks.push(actor+'-notes-history-fixed-lineage-empty-child-keyboard-fonts');
   await methodAssetBrowserRisks({page,context,base,headers,privateDir,checks,out,actor});
   if(which==='end-to-end')await methodAssetIdentityRisk({page,context,base,runtime,checks,actor});
  }
  if(which==='entry-list'){
   const asset=await(await context.request.get(base+'/api/crf-method-asset-drafts/'+assetId,{headers})).json();
   for(let i=0;asset.capacity.count<=20&&i<21;i++){const response=await context.request.post(base+'/api/crf-method-asset-drafts/'+assetId+'/derivations',{headers,data:{baseVersionNo:asset.version,requestKey:'wp08-list-fixture-'+actor+'-'+i}});assert.equal(response.status(),201,'bounded real candidate pagination fixture');}
  }
  await page.screenshot({path:out+actor+'-entry.png',fullPage:true});
  const detailUrl=page.url();
  await page.getByRole('link',{name:'返回我的方法候选列表',exact:true}).click();
  await page.getByRole('heading',{name:'本人本研究方法候选列表',exact:true}).waitFor();
  assert.equal(await page.locator('.qiyan-page-actions button').count(),0,'new list cannot expose legacy dead action');
  assert((await page.locator('.method-assets-workspace').innerText()).includes(actor+'@example.org'));
  assert.equal(await page.getByText('顶栏仍为演示身份',{exact:false}).count(),0);
  if(which==='entry-list'){await page.waitForFunction(()=>document.querySelectorAll('.method-assets-workspace .asset-list>li').length===20);await page.getByRole('button',{name:'加载更多方法候选',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.method-assets-workspace .asset-list>li').length>20);checks.push(actor+'-real-paging-over20');}
  await page.screenshot({path:out+actor+'-list.png',fullPage:true});checks.push(actor+'-entry-real-identity-list');
  if(['end-to-end','visual'].includes(which))await methodAssetVisuals({context,page,chrome,base,root,runtime,actor,detailUrl,checks,out});
 }catch(e){failures.push({actor,message:e.message});await page.screenshot({path:out+actor+'-failure.png',fullPage:true});}finally{await context.close();}
}
assert.equal(digest(),before);assert(!network.some(v=>v.method==='POST'&&/\/(interpretation-jobs|explanation-jobs|knowledge-messages|jobs)$/.test(v.path)),'no paid/model job routes');writeFileSync(out+'result.json',JSON.stringify({passed:!failures.length&&!errors.length,which,checks,failures,errors,network,consoleMessages,newModelCalls:0,ledgerUnchanged:true},null,2));console.log(JSON.stringify({passed:!failures.length&&!errors.length,checks:checks.length,failures,evidence:out,newModelCalls:0}));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
