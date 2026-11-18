// Authorized P1: one NEW synthetic team/org/lead only; all pre-existing directory objects read-only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {recoverReviewedTeamIds} from './team-acceptance-guards.mjs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',api='/api/hubs/lingshu-xinyu/directory-admin/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const manifest=root+'.tmp/researchhub-p1-team-20261112.json',resume=process.argv.includes('--resume');
assert(!existsSync(manifest)||resume,'Named fixture already reserved: use explicit --resume, never create another');
let fixture=existsSync(manifest)?JSON.parse(readFileSync(manifest)):null;
const out=root+'researchhub/docs/testing/evidence/governance-p1-team-write-2026-11-12/browser-'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}}),page=await ctx.newPage();
const result={checks:[],network:[],errors:[],unexpectedWrites:[],paidCalls:0,evidence:out};let stage='login';
const persist=()=>writeFileSync(manifest,JSON.stringify(fixture,null,2),{mode:0o600});
const login=async(context,username)=>assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username,password:runtime.password}})).status(),201);
const get=async path=>{const r=await ctx.request.get(base+api+path);assert.equal(r.status(),200,(await r.text()).slice(0,240));return r.json();};
const stored=w=>{const {currentRevision,...rest}=w;return rest;};
const snapshot=async()=>{const data={teams:[],entities:[]};for(const kind of ['team','organization','researcher']){const list=await get('entities?kind='+kind);for(const e of list.items){data.entities.push(await get('entities/'+e.id));if(kind==='team')data.teams.push(stored(await get('team-workspaces/'+e.id)));}}return data;};
const editor=page.locator('dialog.team-workspace-dialog');
const ready=()=>page.waitForFunction(()=>[...document.querySelectorAll('dialog.team-workspace-dialog button')].some(n=>n.textContent==='审核通过并展示'&&!n.disabled));
const save=async()=>{const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===api+'team-workspaces/'+fixture.id);await editor.getByRole('button',{name:'保存草稿',exact:true}).click();assert.equal((await response).status(),200);await editor.getByText('草稿已保存，尚未审核展示。',{exact:true}).waitFor();};
const open=async()=>{await page.goto(base+'/pages/g02/?'+new URLSearchParams({view:'directory-review',team:fixture.id}));
 await Promise.race([editor.locator('[name=teamName]').waitFor(),editor.getByRole('button',{name:'重新读取团队资料',exact:true}).waitFor()]);
 if(await editor.getByRole('button',{name:'重新读取团队资料',exact:true}).isVisible()){result.checks.push('read failed visibly; operator explicitly chose re-read, not a write retry');await editor.getByRole('button',{name:'重新读取团队资料',exact:true}).click();}
 await editor.locator('[name=teamName]').waitFor();};
const approve=async()=>{await ready();const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===api+'team-workspaces/'+fixture.id+'/reviews');await editor.getByRole('button',{name:'审核通过并展示',exact:true}).click();const r=await response;assert.equal(r.status(),200,(await r.text()).slice(0,240));await editor.waitFor({state:'detached'});};
page.on('pageerror',e=>result.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/directory-admin/'))result.network.push({path:new URL(r.url()).pathname,method:r.request().method(),status:r.status()});});
try{
 await login(ctx,'admin@example.org');
 if(!fixture){fixture={name:'[合成验收] P1团队联审20261112',organizationName:'[合成验收] P1联审机构20261112',leadName:'[合成验收] P1负责人20261112',before:await snapshot(),syntheticOnly:true};persist();}
 assert(fixture.syntheticOnly);if(resume&&!fixture.id){assert(fixture.createKey,'Stop: missing original create request');fixture.id=(await get('operations/'+fixture.createKey+'?operation=entity_create')).id;persist();}
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;if(['GET','HEAD'].includes(req.method())||path.startsWith('/api/auth/'))return route.continue();
  if(req.method()==='POST'&&path===api+'team-workspaces'&&!fixture.id&&!fixture.createKey){fixture.createKey=req.postDataJSON().requestKey;persist();return route.continue();}
  if(req.method()==='POST'&&fixture.id&&[api+'team-workspaces/'+fixture.id,api+'team-workspaces/'+fixture.id+'/reviews'].includes(path))return route.continue();
  result.unexpectedWrites.push({path,method:req.method()});return route.abort();
 });
 if(!fixture.id){
  stage='create-name-only';await page.goto(base+'/pages/g02/?view=directory-review');await page.getByRole('button',{name:'新建团队',exact:true}).click();await editor.locator('[name=teamName]').fill(fixture.name);
  const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===api+'team-workspaces');await editor.getByRole('button',{name:'保存草稿',exact:true}).click();const r=await response;assert.equal(r.status(),201,(await r.text()).slice(0,240));fixture.id=(await r.json()).id;persist();
  await editor.getByText('草稿已保存，尚未审核展示。',{exact:true}).waitFor();assert(await editor.isVisible());
  const owner=await browser.newContext();await login(owner,'owner@example.org');assert.equal((await owner.request.get(base+'/api/hubs/lingshu-xinyu/member/teams/'+fixture.id)).status(),404);await owner.close();
  result.checks.push('actual name-only draft stays open and private');
 }
 let w=await get('team-workspaces/'+fixture.id);
 if(w.hasPublished&&(!fixture.organizationId||!fixture.leadId)){fixture=recoverReviewedTeamIds(fixture,w);persist();result.checks.push('recovered exact committed organization/lead IDs from original reviewed fixture; no creation or review replay');}
 if(!w.hasPublished){
  const owner=await browser.newContext();await login(owner,'owner@example.org');assert.equal((await owner.request.get(base+'/api/hubs/lingshu-xinyu/member/teams/'+fixture.id)).status(),404);await owner.close();result.checks.push('saved name-only draft is private to admin');
  stage='fill-new-org-and-lead';if(!await editor.count())await open();
  await editor.getByLabel('团队所属机构名称',{exact:true}).fill(fixture.organizationName);await editor.getByLabel('团队简介（选填）',{exact:true}).fill('仅本机合成团队：验证目录保存、机构与负责人联审及展示，不代表真实科研团队。');
  await editor.getByLabel('研究方向（选填，顿号分隔）',{exact:true}).fill('针灸、抑郁');
  await editor.getByLabel('省份（选填）',{exact:true}).selectOption('110000');await editor.getByLabel('城市／地区（选填）',{exact:true}).locator('option[value="110000"]').waitFor({state:'attached'});await editor.getByLabel('城市／地区（选填）',{exact:true}).selectOption('110000');
  await editor.getByRole('button',{name:'添加人员',exact:true}).click();await editor.getByLabel('人员1姓名',{exact:true}).fill(fixture.leadName);await editor.getByLabel('人员1职称（选填）',{exact:true}).fill('合成职称');
  stage='first-joint-review';await approve();w=await get('team-workspaces/'+fixture.id);assert.equal(w.version,w.reviewedVersion);
  fixture.organizationId=w.data.organization.entityId;fixture.leadId=w.data.members[0].entityId;assert(fixture.organizationId&&fixture.leadId);persist();
  assert.equal(w.data.members[0].organization.entityId,fixture.organizationId);assert.equal(w.verifications.length,1);
  result.checks.push('one review auto-saves, creates only new org/lead, defaults institution, atomically approves and closes modal');await page.screenshot({path:out+'approved-list.png'});
 }
 stage='committed-review-response-loss';await open();await editor.getByLabel('团队简介（选填）',{exact:true}).fill('仅本机合成团队：审核实际提交后模拟响应丢失，核对原回执，不重复审核。');await save();await ready();
 let dropped=0;await page.route('**/team-workspaces/'+fixture.id+'/reviews',async route=>{assert.equal(++dropped,1,'Never retry automatically');const r=await route.fetch();assert.equal(r.status(),200);await route.abort();});
 await editor.getByRole('button',{name:'审核通过并展示',exact:true}).click();await editor.getByRole('button',{name:'核对原提交结果',exact:true}).waitFor();w=await get('team-workspaces/'+fixture.id);assert.equal(w.version,w.reviewedVersion);const committed=w.version;
 await page.screenshot({path:out+'review-committed-response-lost.png'});await editor.getByRole('button',{name:'核对原提交结果',exact:true}).click();await editor.waitFor({state:'detached'});assert.equal((await get('team-workspaces/'+fixture.id)).version,committed);assert.equal(dropped,1);await page.unroute('**/team-workspaces/'+fixture.id+'/reviews');result.checks.push('real committed review, response lost, original receipt closes modal without duplicate version');
 stage='real-conflict';await open();w=await get('team-workspaces/'+fixture.id);const local='仅本机合成团队：本地输入在真实409后保留，显式核对再保存审核。';await editor.getByLabel('团队简介（选填）',{exact:true}).fill(local);
 const external=await ctx.request.post(base+api+'team-workspaces/'+fixture.id,{headers:{Origin:base},data:{data:{...w.data,notes:'本轮合成并发更新'},expectedVersion:w.version,baseRevision:w.currentRevision,requestKey:randomUUID()}});assert.equal(external.status(),200);
 const conflict=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===api+'team-workspaces/'+fixture.id&&r.status()===409);await editor.getByRole('button',{name:'保存草稿',exact:true}).click();await conflict;assert.equal(await editor.getByLabel('团队简介（选填）',{exact:true}).inputValue(),local);
 await editor.getByRole('button',{name:'查看最新资料',exact:true}).click();await editor.getByRole('button',{name:'保留我的输入',exact:true}).click();assert.equal(await editor.getByLabel('团队简介（选填）',{exact:true}).inputValue(),local);await save();await approve();result.checks.push('actual concurrent save409 retains local input; explicit compare/retain/save/review recovers');
 stage='owner-projections';w=await get('team-workspaces/'+fixture.id);assert.equal(w.version,w.reviewedVersion);
 const detail=await get('entities/'+fixture.organizationId);assert(detail.facts.some(f=>f.kind==='profile'&&f.decision.decision==='approve'));assert.equal(w.data.organization.name,fixture.organizationName);
 for(const old of fixture.before.teams)assert.deepEqual(stored(await get('team-workspaces/'+old.id)),old);
 for(const old of fixture.before.entities)assert.deepEqual(await get('entities/'+old.item.id),old);
 for(const [kind,total]of [['team',4],['organization',4],['researcher',5]])assert.equal((await get('entities?kind='+kind)).pagination.totalItems,total);
 await open();await editor.getByLabel('团队简介（选填）',{exact:true}).fill('未保存的管理员输入');await login(ctx,'owner@example.org');const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/me'&&r.status()===200);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
 await page.getByRole('alert').filter({hasText:'当前身份没有此目录操作权限'}).waitFor();assert.equal(await editor.count(),0);assert.equal((await ctx.request.get(base+api+'team-workspaces')).status(),403);
 const tenant=await ctx.request.get(base+'/api/hubs/lingshu-xinyu/member/teams/'+fixture.id);assert.equal(tenant.status(),200);const team=(await tenant.json()).item;assert.equal(team.organization.id,fixture.organizationId);assert.equal(team.members[0].id,fixture.leadId);assert.equal(team.name,fixture.name);
 await page.goto(base+'/pages/t01/?'+new URLSearchParams({q:fixture.name}));await page.locator('#team-'+fixture.id).waitFor();assert.equal(await page.getByLabel('研究方向',{exact:true}).count(),1);assert.equal(await page.getByLabel('地区',{exact:true}).count(),1);await page.screenshot({path:out+'owner-t01.png'});
 await page.locator('#team-'+fixture.id).getByRole('button',{name:'查看详情',exact:true}).click();await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor();await page.getByText(fixture.leadName,{exact:true}).first().waitFor();await page.screenshot({path:out+'owner-t02.png'});
 result.checks.push('old teams/orgs/people unchanged; owner403 for admin; tenant T01/T02 same reviewed team/org/lead; existing T01 filters retained');
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+'/api/hubs/lingshu-xinyu/teams/'+fixture.id)).status(),404);await anonymous.close();
 await page.goto(base+'/pages/r01/');await page.getByRole('heading',{name:'此页面暂不可用',exact:true}).waitFor();await page.screenshot({path:out+'r01-existing-pending-gate.png'});result.r01='Existing route remains pending; no researcher directory API. DG10 R01 not completed; no cross-page implementation.';
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.unexpectedWrites,[]);result.passedCore=true;result.fullP1Complete=false;result.fixture={id:fixture.id,organizationId:fixture.organizationId,leadId:fixture.leadId};
}catch(e){result.passedCore=false;result.stage=stage;result.failure=e.message;process.exitCode=1;await page.screenshot({path:out+'failure.png'}).catch(()=>{});}
finally{await ctx.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
