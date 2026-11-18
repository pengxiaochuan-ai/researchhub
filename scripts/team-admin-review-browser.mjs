// Persistent mutations are limited to the named synthetic team and one new
// named synthetic institution. Real team is read-only; no model/cloud calls.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {directoryHash} from '../server/directory/contract.mjs';
import {root,base,runtime,directoryPath} from './directory-runtime.mjs';
import {direct} from '../server/wp02/test-support.mjs';
const run='browser-'+randomUUID(),out=root+'researchhub/docs/testing/evidence/team-admin-review-2026-11-06/'+run+'/',privateDir=root+'.tmp/researchhub-team-admin-review/';
mkdirSync(out,{recursive:true});mkdirSync(privateDir,{recursive:true});
const fixtureFile=privateDir+'fixture.json',snapshotFile=privateDir+'original.json';
const id='rhde-19ccf8f5caa84034b0dea6a897a0b43b',realId='rhde-c334b97521154b98a52f8fba3926afde',path=directoryPath+'team-workspaces/'+id;
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chrome=pw.chromium??pw.default.chromium;
const browser=await chrome.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}}),p=await ctx.newPage();
const checks=[],network=[],errors=[],metrics=[];let original,publicBefore,realBefore,fixture,stage='setup',restored=false;
p.on('dialog',d=>void d.accept());p.on('pageerror',e=>errors.push({stage,message:e.message}));p.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push({stage,type:m.type(),message:m.text()});});
p.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({stage,path:u.pathname,method:r.request().method(),status:r.status()});});
const realShape=w=>({version:w.version,data:w.data,history:w.history,baseRevision:w.baseRevision,savedAt:w.savedAt});
const business=t=>({name:t.name,organization:t.organization,summary:t.summary,geo:t.geo,directions:t.directions,teamType:t.teamType,members:t.members.map(m=>({id:m.id,name:m.name,role:m.role}))});
async function api(url=path,{method='GET',data,status=200,c=ctx}={}){const r=await c.request.fetch(base+url,{method,headers:{Origin:base},...(data?{data}:{})});assert.equal(r.status(),status,(await r.text()).slice(0,500));return r.json();}
async function login(c,role='admin'){assert.equal((await c.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password}})).status(),201);}
async function choose(page=p){await page.getByRole('button',{name:'维护资料：[合成验收] 针灸情志研究团队',exact:true}).click();await page.getByLabel('审核理由',{exact:true}).waitFor();await page.getByRole('button',{name:'审核通过并展示',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.team-submit-actions button:last-child').disabled);}
async function open(){await p.goto(base+'/pages/g02/?view=directory-review');await choose();}
async function shot(name,page=p){await page.screenshot({path:out+name+'.png',fullPage:true});}
async function measure(page,label){const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dpr:devicePixelRatio,controls:[...document.querySelectorAll('.team-workbench input:not([type=checkbox]),.team-workbench select,.team-workbench textarea,.team-workbench button,.team-workbench summary')].filter(e=>e.getClientRects().length&&(!e.closest('details')||[...e.closest('details').querySelectorAll(':scope>summary')].includes(e)||!e.closest('details:not([open])'))).map(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight,height:e.getBoundingClientRect().height,right:e.getBoundingClientRect().right}))}));assert(m.scroll<=m.width+1,label+' overflow');assert(m.controls.every(x=>x.font==='14px'&&x.height>=44&&x.right<=m.width+1),label+' controls');metrics.push({label,...m});}
async function saveData(data){const w=await api();return api(path,{method:'POST',data:{expectedVersion:w.version,baseRevision:w.currentRevision,data,requestKey:randomUUID()}});}
async function reviewApi(){const w=await api(),p=await api(path+'/preview?audience=public');assert(p.canApprove,JSON.stringify(p.issues));return api(path+'/reviews',{method:'POST',data:{expectedVersion:w.version,planHash:p.planHash,audience:'public',reason:'恢复具名合成团队原展示业务资料',requestKey:randomUUID()}});}
async function restore(){
 if(!original)return;
 // Public projection and private draft deliberately differ in the old fixture.
 let w=await api();const current=await api('/api/hubs/lingshu-xinyu/teams/'+id);
 const nonGeo=item=>{const {geo,...rest}=business(item);return rest;};
 if(directoryHash(nonGeo(current.item))!==directoryHash(nonGeo(publicBefore.item))){await saveData({...original.currentData,verificationMethod:'sources'});const preview=await api(path+'/preview?audience=public');if(preview.canApprove)await reviewApi();}
 // City coordinates are source-backed profile data, deliberately not editable
 // in the team form. Restore the exact old synthetic profile via normal APIs.
 const prior=await api(directoryPath+'assertions/'+publicBefore.item.provenance[0].assertionId),head=(await api(directoryPath+'entities/'+id)).facts.find(f=>f.kind==='profile');
 if(directoryHash(prior.payload)!==directoryHash(head.payload)){
  const fact=await api(directoryPath+'entities/'+id+'/assertions',{method:'POST',status:201,data:{kind:'profile',assertionKey:'profile',expectedRevision:head.revision,payload:prior.payload,provenance:prior.provenance,requestKey:randomUUID()}});
  await api(directoryPath+'assertions/'+fact.id+'/decisions',{method:'POST',data:{expectedDecisionVersion:0,assertionHash:fact.hash,decision:'approve',audience:'public',reason:'恢复本轮具名合成夹具原始已审核概况及来源坐标',requestKey:randomUUID()}});
 }
 w=await api();if(directoryHash(w.data)!==directoryHash(original.data))await saveData(original.data);
 const after=await api('/api/hubs/lingshu-xinyu/teams/'+id);assert.deepEqual(business(after.item),business(publicBefore.item));assert.deepEqual((await api()).data,original.data);assert.deepEqual(realShape(await api(directoryPath+'team-workspaces/'+realId)),realShape(realBefore));restored=true;
}
try{
 await login(ctx);original=await api();publicBefore=await api('/api/hubs/lingshu-xinyu/teams/'+id);realBefore=await api(directoryPath+'team-workspaces/'+realId);
 if(existsSync(snapshotFile)){const old=JSON.parse(readFileSync(snapshotFile));original=old.original;publicBefore=old.publicBefore;realBefore=old.realBefore;}else writeFileSync(snapshotFile,JSON.stringify({original,publicBefore,realBefore}),{mode:0o600});
 if(process.argv.includes('--restore-only')){stage='restore-only';await restore();}else{
 const capacity=await direct(async tx=>({entities:await tx.$queryRaw`SELECT kind,count(*)::int AS n FROM rh_directory.entity WHERE tenant_id=${runtime.ids.tenant} GROUP BY kind`,facts:(await tx.$queryRaw`SELECT count(*)::int AS n FROM rh_directory.assertion WHERE tenant_id=${runtime.ids.tenant}`)[0].n}));assert(capacity.facts<=33,'bounded fact capacity before persistent run');assert((await api()).history.length<=85,'bounded draft operations');
 if(existsSync(fixtureFile))fixture=JSON.parse(readFileSync(fixtureFile));else{
  assert.equal(capacity.entities.find(x=>x.kind==='organization').n,2);
  const org=await api(directoryPath+'entities',{method:'POST',status:201,data:{kind:'organization',stableKey:'manual-joint-20261106',requestKey:randomUUID()}});
  fixture={id:org.id,name:'[合成验收] 同页联合核实机构',profileKey:randomUUID()};writeFileSync(fixtureFile,JSON.stringify(fixture),{mode:0o600});
 }
 let org=await api(directoryPath+'entities/'+fixture.id);
 if(!org.facts.length){const choices=await api(directoryPath+'sources'),source=choices.items.find(x=>x.title==='[合成验收] T01目录事实清单');assert(source);await api(directoryPath+'entities/'+fixture.id+'/assertions',{method:'POST',status:201,data:{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name:fixture.name,organizationType:'科研机构',summary:'本机联合审核具名合成机构；不是真实课题组。'},provenance:[{...source.reference,locator:'合成验收机构设定，不代表真实机构资料',fieldNames:['abstract']}],requestKey:fixture.profileKey}});}
 const continuation=process.argv.includes('--continue-existing'),recordsAtStart=(await api()).verifications.length;
 if(continuation){const prior=JSON.parse(readFileSync(root+'researchhub/docs/testing/evidence/team-admin-review-2026-11-06/browser-e9b2d410-b8e4-449d-bca5-e981b13293f3/result.json'));assert(prior.network.some(x=>x.path===path+'/reviews'&&x.method==='POST'&&x.status===200));assert(org.facts.some(f=>f.provenance.some(r=>r.kind==='admin_verification')));await saveData({...original.currentData,verificationMethod:'administrator'});checks.push('prior real joint-approval HTTP 200 and persisted manual institution claim reverified; no repeat institution approval');}
 stage='same-page';await open();assert.equal(await p.getByLabel('资料核实方式',{exact:true}).inputValue(),'administrator');await shot('01-original-sections');
 if(!continuation){await p.getByLabel('团队所属机构',{exact:true}).selectOption(fixture.id);await p.getByLabel('关联机构核对').getByText(fixture.name,{exact:true}).first().waitFor();await p.getByLabel('关联机构核对').getByText(/本次一起审核/).waitFor();await p.getByText('核对机构资料',{exact:true}).last().click();await p.getByText('本机联合审核具名合成机构；不是真实课题组。',{exact:true}).waitFor();}
 await p.getByLabel('团队简介（选填）',{exact:true}).fill('本机同页联合审核验证，仅合成团队；资料由管理员人工核实。');await p.getByLabel('审核理由',{exact:true}).fill('本机具名合成联合审核，不是真实机构或成员的专业批准');
 const reviewResponse=p.waitForResponse(r=>new URL(r.url()).pathname===path+'/reviews'&&r.request().method()==='POST');await p.getByRole('button',{name:'审核通过并展示',exact:true}).click();if(!continuation){await p.getByRole('dialog').waitFor();assert((await p.getByRole('dialog').innerText()).includes(fixture.name));await shot('02-brief-public-confirm');await p.getByRole('button',{name:'确认公开并审核',exact:true}).click();}const r=await reviewResponse;assert.equal(r.status(),200,await r.text());await p.getByText('已按当前审核范围保存并批准展示；未授予任何账号或Study权限。',{exact:true}).waitFor();
 const w=await api();assert.equal(w.verifications.length,recordsAtStart+1);assert(w.data.evidence.every(e=>e.reference.kind!=='admin_verification'));assert.equal((await api(directoryPath+'entities/'+fixture.id)).facts[0].decision.decision,'approve');checks.push('actual-app-role review; one new verification; no newly required external evidence or per-fact selections');
 stage='refresh-and-public-detail';await p.reload();await choose();assert.equal(await p.getByLabel('资料核实方式',{exact:true}).inputValue(),'administrator');await p.getByLabel('审核理由',{exact:true}).fill('只填写理由不应要求先保存');await p.getByText('更多操作',{exact:true}).click();await p.getByText('其他目录维护',{exact:true}).click();await p.getByText('维护共用机构、人物及历史关系。',{exact:true}).waitFor();assert(await p.locator('.team-advanced').getAttribute('open')!==null);await p.getByText('其他目录维护',{exact:true}).click();await shot('03-same-page-complete');checks.push('refresh exact method; reason alone permits advanced maintenance without save');
 const pub=await browser.newContext({viewport:{width:1440,height:900}}),detail=await pub.newPage();await detail.goto(base+'/pages/t02/?team='+id);await detail.getByText('查看审核依据与原始位置',{exact:true}).click();await detail.getByText('管理员人工核实',{exact:false}).first().waitFor();assert(!(await detail.locator('.directory-provenance').innerText()).includes('本机具名合成联合审核'));await shot('04-public-proof',detail);await pub.close();checks.push('unauthenticated T02 real public result shows honest manual proof without private reason');
 stage='viewport';for(const [width,height]of [[1440,900],[1366,768],[1920,1200],[390,844],[320,844]]){await p.setViewportSize({width,height});await p.waitForTimeout(350);await measure(p,'G02-'+width);await shot('layout-'+width);}
 await p.setViewportSize({width:1440,height:900});
 stage='blockers';await p.getByRole('button',{name:'添加人员',exact:true}).click();const n=w.data.members.length+1;await p.getByLabel('审核理由',{exact:true}).fill('合成空成员阻断，不得审批');const beforeReviews=network.filter(x=>x.path.endsWith('/reviews')&&x.method==='POST').length;await p.getByRole('button',{name:'审核通过并展示',exact:true}).click();await p.getByRole('heading',{name:'本次未提交审核',exact:true}).waitFor();assert.equal(await p.getByLabel('审核理由',{exact:true}).inputValue(),'合成空成员阻断，不得审批');assert.equal(network.filter(x=>x.path.endsWith('/reviews')&&x.method==='POST').length,beforeReviews);await shot('05-blocked-input-retained');await p.getByRole('button',{name:'移除人员'+n,exact:true}).click();
 stage='unknown-receipt';await p.getByLabel('团队简介（选填）',{exact:true}).fill('本机人工核实未知响应恢复测试；仅合成资料。');await p.getByLabel('审核理由',{exact:true}).fill('合成未知响应，仅按原回执恢复');let committed;
 await p.route('**'+path+'/reviews',async route=>{const response=await route.fetch();assert.equal(response.status(),200,await response.text());committed=route.request().postDataJSON();await route.abort('failed');},{times:1});
 await p.getByRole('button',{name:'审核通过并展示',exact:true}).click();await p.getByRole('button',{name:'核对原提交结果',exact:true}).waitFor();assert(committed);const stored=await api(path+'/receipts?key='+committed.requestKey);assert.equal(stored.operation,'review');await p.getByRole('button',{name:'核对原提交结果',exact:true}).click();await p.getByText('已核对原提交回执并读取服务器资料，没有重复提交。',{exact:true}).waitFor();assert.equal((await api()).verifications.length,recordsAtStart+2);await shot('06-unknown-recovered');checks.push('real committed review with deliberate response loss; original receipt restores once, no duplicate approval');
 stage='owner';const owner=await browser.newContext();await login(owner,'owner');await api(path,{c:owner,status:403});await owner.close();checks.push('ordinary researcher cannot access admin workspace');
 stage='restore';await restore();checks.push('original public business fields and private draft restored; real team content/version/history unchanged');
 }
}catch(e){await shot('FAILED').catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({stage,message:e.message,stack:e.stack}));throw e;}
finally{if(!restored)await restore().catch(e=>checks.push('RESTORE_FAILED: '+e.message));await ctx.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify({run,checks,network,errors,metrics,restored,fixture:fixture?.id,realBeforeHash:realBefore?directoryHash(realShape(realBefore)):null},null,2));console.log(JSON.stringify({out,checks,errors,restored}));}
