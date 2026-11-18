// Explicit, resumable execution of the approved local C1 matrix. No model,
// shared/public release, old-row mutation or fixture cleanup.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readBusinessAssetAdmission,readBusinessSourceProtection} from './research-assets-business-preflight.mjs';
import {makeCatalogAssetUrl} from '../src/research-assets-catalog-session.js';
import {isBusinessAssetId} from './research-assets-business-identity.mjs';

assert.deepEqual(process.argv.slice(2),['--approved-c1']);
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
for(const key of ['tenant','group','project','owner','admin'])assert.equal(runtime.ids[key],ids[key]);
assert.equal(runtime.ready,true);
const base='http://127.0.0.1:19501',directory=fileURLToPath(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/browser-c1/',import.meta.url));
mkdirSync(directory,{recursive:true});const resultFile=directory+'result.json';
const result=existsSync(resultFile)?JSON.parse(readFileSync(resultFile)):{schemaVersion:'rh-business-browser-c1.v1',startedAt:new Date().toISOString(),assets:[],events:[],checks:[],pageErrors:[],networkErrors:[],modelCalls:0};
assert.equal(result.schemaVersion,'rh-business-browser-c1.v1');assert(result.assets.length<=8);assert(result.events.length<=48);
if(result.failure){result.attempts??=[];result.attempts.push({at:result.failedAt,failure:result.failure,assets:result.assets.length,events:result.events.length,pageErrors:result.pageErrors,networkErrors:result.networkErrors,ownerDialog:result.ownerDialog,adminDialog:result.adminDialog});for(const key of ['failure','failedAt','ownerDialog','adminDialog'])delete result[key];result.pageErrors=[];result.networkErrors=[];}
const save=()=>writeFileSync(resultFile,JSON.stringify(result,null,2));
const snapshot=()=>withFixtureTransaction(env,'direct',async tx=>{await bindCatalogContext(tx,ids,ids.admin);return{admission:await readBusinessAssetAdmission(tx,ids),sources:await readBusinessSourceProtection(tx,ids)};},{readOnly:true});
const before=await snapshot(),baseline=JSON.parse(readFileSync(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/business-preflight.json',import.meta.url)));
assert.equal(before.admission.protectionHash,baseline.protectionHash);
const playwright=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=playwright.chromium??playwright.default.chromium;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const clients={};
const scope=project=>({studyGroupId:ids.group,researchProjectId:project});
const body=(actor,label,slot)=>({kind:'protocol',metadata:{title:`C1合成方案 ${actor} ${label} ${slot}`,summary:'原创合成方案，用于核对资产整理、固定版本与私有审核。',purpose:'整理研究方案，并由研究者核对需要完善的内容。',limitations:'仅合成材料，不含临床数据；不共享、发布或供AI使用。',author:actor==='owner'?'合成科研人员':'合成管理员',domains:['合成科研']},sourceKind:'author',sourceBindings:[],policy:{rightsEvidence:'本人原创合成材料，允许本机登记、修订和私有审核；不授权共享、发布或AI使用。',discoveryRecipients:[ids[actor]]},contentMd:'# 合成研究方案\n\n## 研究目标\n\n演练方案资产的整理与固定版本核对。\n\n## 待研究者确认\n\n目标人群、干预和结局均未确认。',requestKey:`business-c1-browser-${actor}-${label.toLowerCase()}-${slot}`});
function track(receipt,actor,project){
 assert.equal(receipt.status,'committed');assert(isBusinessAssetId(receipt.assetId));
 if(!result.events.some(e=>e.assetId===receipt.assetId&&e.revision===receipt.revision)){
  assert(result.events.length<48);result.events.push({...receipt,actor,project});save();
 }
}
async function api(actor,project,path,input){
 assert(/^\/research-assets(?:\/|$)/.test(path));
 const c=clients[actor],headers={Origin:base,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':project,'X-ResearchHub-Actor':ids[actor],'X-ResearchHub-Auth-Version':String(c.user.authVersion),...(input?{'X-ResearchHub-Request':'asset-catalog-v1'}:{})};
 const response=input?await c.context.request.post(base+'/api'+path,{headers,data:input}):await c.context.request.get(base+'/api'+path,{headers});
 const value=await response.json();assert(response.ok(),`HTTP ${response.status()} ${path} ${value.code??''}`);
 if(input)track(value,actor,project);return value;
}
async function pageAt(actor,project,selected,tab='list'){
 const p=clients[actor].page,q=new URLSearchParams({...scope(project),pageSize:'50',tab,...(selected?{selectedAssetId:selected.id,selectedVersion:String(selected.version)}:{})});
 await p.goto(base+'/pages/a01/?'+q);await p.locator('.research-asset-catalog .real-asset-table').first().waitFor();
 if(tab==='list')await p.locator('.asset-catalog-name').first().waitFor();
 await p.getByRole('button',{name:'重新读取',exact:true}).first().waitFor({state:'hidden'});
 if(selected)await p.getByRole('heading',{name:selected.title,exact:true}).waitFor();
 return p;
}
async function actionResponse(page,path,click,actor,project){
 const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api'+path&&r.request().method()==='POST');
 await click();const response=await pending,value=await response.json();
 assert(response.ok(),`UI HTTP ${response.status()} ${path} ${value.code??''}`);track(value,actor,project);return value;
}
async function uiRegister(actor,project,input){
 const p=await pageAt(actor,project);await p.getByRole('button',{name:'上传资产',exact:true}).click();
 const dialog=p.getByRole('dialog',{name:'登记资产',exact:true});await dialog.locator('[name="title"]').waitFor();
 assert.equal(await dialog.locator('[name="sourceId"]').inputValue(),'manual');
 for(const [key,value]of Object.entries(input.metadata).filter(([key])=>key!=='domains'))await dialog.locator('[name="'+key+'"]').fill(value);
 await dialog.locator('[name="domains"]').fill('合成科研');await dialog.locator('[name="contentMd"]').fill(input.contentMd);await dialog.locator('[name="rightsEvidence"]').fill(input.policy.rightsEvidence);
 const receipt=await actionResponse(p,'/research-assets',()=>dialog.getByRole('button',{name:'保存草稿',exact:true}).click(),actor,project);
 await dialog.getByText('已保存为私有草稿；尚未提交审核。',{exact:true}).waitFor();await dialog.getByRole('button',{name:'完成',exact:true}).click();return receipt;
}
async function uiRevise(asset,input){
 const {actor,project,id,title}=asset,p=await pageAt(actor,project,{id,title,version:1});
 await p.getByRole('button',{name:'更多操作',exact:true}).click();await p.getByRole('button',{name:'修订内容',exact:true}).click();
 const dialog=p.getByRole('dialog',{name:'修订资产',exact:true});await dialog.locator('[name="contentMd"]').fill(input.contentMd);
 const receipt=await actionResponse(p,'/research-assets/'+id+'/versions',()=>dialog.getByRole('button',{name:'保存新版本',exact:true}).click(),actor,project);
 await dialog.getByRole('button',{name:'完成',exact:true}).click();return receipt;
}
async function uiLifecycle(asset,action){
 const {actor,project,id,title}=asset,p=await pageAt(actor,project,action==='trash'?{id,title,version:2}:null,action==='trash'?'list':'trash');
 if(action==='trash'){await p.getByRole('button',{name:'更多操作',exact:true}).click();await p.getByRole('button',{name:'移入回收站',exact:true}).click();}
 else await p.getByRole('row').filter({hasText:title}).getByRole('button',{name:'恢复资产',exact:true}).click();
 const label=action==='trash'?'移入回收站':'恢复资产',dialog=p.getByRole('dialog',{name:label,exact:true});await dialog.getByLabel(/^处理理由/).fill('核对本人合成草稿的回收与恢复。');
 const receipt=await actionResponse(p,'/research-assets/'+id+'/'+(action==='trash'?'trash':'restores'),()=>dialog.getByRole('button',{name:label,exact:true}).click(),actor,project);
 await dialog.getByRole('button',{name:'完成',exact:true}).click();return receipt;
}
async function uiGovernance(asset,action){
 const actor=action==='review'?'admin':asset.actor,project=asset.project,p=await pageAt(actor,project,{id:asset.id,title:asset.title,version:2});
 await p.getByRole('button',{name:'更多操作',exact:true}).click();const label=action==='review'?'审核资产':'提交审核';await p.getByRole('button',{name:label,exact:true}).click();
 const dialog=p.getByRole('dialog',{name:label,exact:true});
 if(action==='review'){await dialog.getByLabel('已核对本固定版内容',{exact:true}).check();await dialog.getByLabel('已核对来源与允许用途',{exact:true}).check();if(asset.actor==='admin')await dialog.getByLabel('本次为本人内容审核，将明确记录',{exact:true}).check();await dialog.locator('[name="governanceReason"]').fill('已核对原创合成材料及本次私有用途，非临床结论。');}
 const receipt=await actionResponse(p,'/research-assets/'+asset.id+'/'+(action==='review'?'reviews':'submissions'),()=>dialog.getByRole('button',{name:label,exact:true}).click(),actor,project);
 await dialog.getByRole('button',{name:'完成',exact:true}).click();return receipt;
}
try{
 for(const actor of ['owner','admin']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:directory+'video/',size:{width:1440,height:1000}}});
  const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});
  assert(login.ok(),'synthetic login failed');const me=await context.request.get(base+'/api/auth/me'),user=await me.json();assert.equal(user.accountId,ids[actor]);
  const page=await context.newPage();page.on('pageerror',e=>{result.pageErrors.push({actor,message:e.message.slice(0,300)});save();});
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===base){result.networkErrors.push({actor,status:r.status(),path:new URL(r.url()).pathname});save();}});
  await page.route('**/api/**',route=>{const req=route.request(),u=new URL(req.url());if(req.method()==='POST'&&/\/ai-(?:jobs|decisions)|\/sessions\//.test(u.pathname))return route.abort();return route.continue();});
  clients[actor]={context,page,user};
  assert.equal((await api(actor,ids.project,'/research-assets/registrable-sources')).schemaVersion,'rh-asset-registration-options.v2','API has not loaded the new C1 service');
  if(actor==='owner'){
   let release,reached;const gate=new Promise(r=>release=r),entered=new Promise(r=>reached=r),pattern='**/api/research-assets/overview?*';
   const hold=async route=>{reached();await gate;await route.continue();};await page.route(pattern,hold);
   await page.goto(base+'/pages/a01/?pageSize=50');await entered;
   await page.waitForFunction(()=>[...document.querySelectorAll('.qiyan-page-actions button')].some(b=>b.textContent.trim()==='上传资产'&&b.disabled));assert.equal(await page.locator('dialog[open]').count(),0);
   await page.screenshot({path:directory+'owner-loading-entry.png'});release();await page.locator('.asset-catalog-name').first().waitFor();
   assert.equal(await page.getByRole('button',{name:'上传资产',exact:true}).isDisabled(),false);await page.unroute(pattern,hold);
   result.loadingEntry={disabledWhilePending:true,enabledAfterRead:true,falseEmptyDialog:false};save();
  }
 }
 for(const actor of ['owner','admin'])for(const [label,project]of [['A',ids.project],['B','rh-asset-detail-20261113-study-b']])for(const slot of [1,2]){
  const input=body(actor,label,slot),ui=slot===1&&(actor==='owner'&&label==='A'||actor==='admin'&&label==='B');
  let asset=result.assets.find(a=>a.actor===actor&&a.project===project&&a.slot===slot);
  if(!asset){const receipt=ui?await uiRegister(actor,project,input):await api(actor,project,'/research-assets',input);asset={id:receipt.assetId,actor,project,slot,label,title:input.metadata.title};result.assets.push(asset);save();}
  let detail=await api(actor,project,'/research-assets/catalog/'+asset.id);
  if(detail.currentVersion===1){const revised={...input,contentMd:input.contentMd+'\n\n## 修订说明\n\n研究者补充了需确认的方案条件；不新增科研数值。',baseVersion:1,expectedRevision:detail.revision,requestKey:input.requestKey+'-revise'};if(ui)await uiRevise(asset,revised);else await api(actor,project,'/research-assets/'+asset.id+'/versions',revised);}
  detail=await api(actor,project,'/research-assets/catalog/'+asset.id);
  assert.equal(detail.currentVersion,2);
  for(const action of ['trash','restore','submit','review']){
   const required={trash:2,restore:3,submit:4,review:5}[action];
   const current=await api(action==='restore'?actor:'admin',project,'/research-assets/'+asset.id+'/'+(action==='restore'?'lifecycle':'governance')+'?version=2');
   if(current.expectedRevision>required)continue;assert.equal(current.expectedRevision,required);
   if(ui){if(['trash','restore'].includes(action))await uiLifecycle(asset,action);else await uiGovernance(asset,action);}
   else{
    const who=action==='review'?'admin':actor,o=await api(who,project,'/research-assets/'+asset.id+'/'+(['trash','restore'].includes(action)?'lifecycle':'governance')+'?version=2');
    const payload={action,version:2,expectedRevision:o.expectedRevision,identityRevision:o.identityRevision,contentHash:o.contentHash,policyHash:o.policyHash,requestKey:input.requestKey+'-'+action,...(action==='submit'?{}:{reason:'核对本轮具名合成资产，保持私有未发布。'}),...(action==='review'?{conclusion:'approved',contentChecked:true,rightsChecked:true,selfReviewAcknowledged:true}:{})};
    await api(who,project,'/research-assets/'+asset.id+'/'+({trash:'trash',restore:'restores',submit:'submissions',review:'reviews'}[action]),payload);
   }
  }
  const final=await api(actor,project,'/research-assets/catalog/'+asset.id+'/versions/2'),historical=await api(actor,project,'/research-assets/catalog/'+asset.id+'/versions/1');
  assert.equal(final.state,'approved');assert.equal(final.revision,6);assert.equal(historical.contentMd,input.contentMd);assert(!final.canActions.some(a=>['share','release','cite'].includes(a)));
 }
 for(const actor of ['owner','admin']){
  const p=clients[actor].page;await p.goto(base+'/pages/a01/?pageSize=50');await p.locator('.research-asset-catalog .asset-catalog-name').first().waitFor();
  const r=await clients[actor].context.request.get(base+'/api/research-assets/overview?pageSize=50',{headers:{'X-ResearchHub-Actor':ids[actor],'X-ResearchHub-Auth-Version':String(clients[actor].user.authVersion)}}),overview=await r.json();assert(r.ok());assert.equal(overview.catalog.stats.all,actor==='admin'?35:20);
  for(const tab of ['graph','contributions','collaborations','trash']){await p.goto(base+'/pages/a01/?pageSize=50&tab='+tab);await p.locator(({graph:'.asset-graph-view',contributions:'[aria-label="本人贡献记录，可横向滚动"]',collaborations:'[aria-label="用途申请与许可，可横向滚动"]',trash:'[aria-label="资产回收站，可横向滚动"]'})[tab]).waitFor();await p.screenshot({path:directory+actor+'-'+tab+'.png',fullPage:true});}
  await p.goto(base+'/pages/a01/?pageSize=50');await p.locator('.asset-catalog-name').first().waitFor();await p.screenshot({path:directory+actor+'-a01-1440.png',fullPage:true});
  const operationStyle=await p.locator('.asset-catalog-search button').evaluate(n=>({font:getComputedStyle(n).fontSize,lineHeight:getComputedStyle(n).lineHeight}));
  const asset=result.assets.find(a=>a.actor===actor&&a.slot===1&&a.label===(actor==='admin'?'B':'A'));await p.goto(base+makeCatalogAssetUrl(scope(asset.project),asset.id,2));const reading=p.locator('.research-asset-reading[aria-label="资产正文"]');await reading.waitFor();assert((await reading.innerText()).includes('演练方案资产的整理与固定版本核对'));await p.screenshot({path:directory+actor+'-a02-v2.png',fullPage:true});
  const readingStyle=await reading.locator('p').first().evaluate(n=>({font:getComputedStyle(n).fontSize,lineHeight:getComputedStyle(n).lineHeight}));assert.deepEqual(readingStyle,{font:'16px',lineHeight:'28px'});
  await p.getByRole('button',{name:'版本历史',exact:true}).click();await p.getByRole('button',{name:'比较版本',exact:true}).click();const comparison=p.getByLabel('固定版本差异',{exact:true});await comparison.waitFor();assert((await comparison.innerText()).includes('修订说明'));await p.screenshot({path:directory+actor+'-a02-comparison.png',fullPage:true});
  await p.getByRole('button',{name:'变更记录',exact:true}).click();const activity=p.getByLabel('固定版本真实变更记录',{exact:true});await activity.getByText('审核通过',{exact:true}).waitFor();assert((await activity.innerText()).includes('共5条记录'));await p.screenshot({path:directory+actor+'-a02-activity.png',fullPage:true});
  result.checks=result.checks.filter(c=>c.actor!==actor);result.checks.push({actor,globalTotal:overview.catalog.stats.all,newObjects:result.assets.filter(a=>a.actor===actor).length,readingStyle,operationStyle,fixedComparison:true,storedReviewReason:true});save();
 }
 const after=await snapshot();assert.equal(after.admission.protectionHash,before.admission.protectionHash);assert.deepEqual(after.sources,before.sources);assert.equal(after.admission.ddlFingerprint,before.admission.ddlFingerprint);
 assert.equal(result.assets.length,8);assert.equal(result.events.length,48);assert.deepEqual(result.pageErrors,[]);
 result.passed=true;result.completedAt=new Date().toISOString();result.protectedOldFacts=true;result.modelCalls=0;save();
 console.log(JSON.stringify({passed:true,assets:result.assets.length,events:result.events.length,checks:result.checks,pageErrors:result.pageErrors,networkErrors:result.networkErrors,oldFactsPreserved:true,modelCalls:0}));
}catch(e){result.passed=false;result.failedAt=new Date().toISOString();result.failure=e.message.slice(0,500);for(const[actor,c]of Object.entries(clients)){await c.page.screenshot({path:directory+actor+'-failure-'+Date.now()+'.png',fullPage:true}).catch(()=>{});result[actor+'Dialog']=await c.page.locator('dialog[open]').innerText().catch(()=>null);}save();throw e;}
finally{for(const c of Object.values(clients))await c.context.close();await browser.close();}
