// Reuse only the one P1 fixture created by governance-p1-team-browser. No new entities.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {assertTeamDetailWrites} from './team-acceptance-guards.mjs';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',api='/api/hubs/lingshu-xinyu/directory-admin/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),manifest=root+'.tmp/researchhub-p1-team-20261112.json',fixture=JSON.parse(readFileSync(manifest));
assert(fixture.syntheticOnly&&fixture.id&&fixture.organizationId&&fixture.leadId);
const out=root+'researchhub/docs/testing/evidence/governance-p1-team-write-2026-11-12/details-'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}}),page=await ctx.newPage(),editor=page.locator('dialog.team-workspace-dialog');
const result={checks:[],errors:[],writes:[],evidence:out};let stage='login';
const get=async path=>{const r=await ctx.request.get(base+api+path);assert.equal(r.status(),200);return r.json();};
const stored=w=>{const {currentRevision,...rest}=w;return rest;};
const open=async()=>{await page.goto(base+'/pages/g02/?'+new URLSearchParams({view:'directory-review',team:fixture.id}));await editor.locator('[name=teamName]').waitFor();await editor.getByRole('button',{name:'已审核',exact:true}).waitFor();};
try{
 assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 page.on('pageerror',e=>result.errors.push(e.message));await page.route('**/api/**',route=>{const r=route.request(),path=new URL(r.url()).pathname;if(['GET','HEAD'].includes(r.method())||path.startsWith('/api/auth/'))return route.continue();result.writes.push({path,method:r.method()});if(r.method()==='POST'&&[api+'team-workspaces/'+fixture.id,api+'team-workspaces/'+fixture.id+'/reviews'].includes(path))return route.continue();return route.abort();});
 stage='member-in-app-confirmation';await open();const before=await get('team-workspaces/'+fixture.id);await editor.getByRole('button',{name:'移除：'+fixture.leadName,exact:true}).click();const confirmation=page.getByRole('dialog',{name:'移除团队人员？',exact:true});await confirmation.waitFor();
 await page.keyboard.press('Escape');await confirmation.waitFor({state:'detached'});assert.equal(await editor.getByRole('button',{name:'移除：'+fixture.leadName,exact:true}).count(),1);
 await editor.getByRole('button',{name:'移除：'+fixture.leadName,exact:true}).click();await confirmation.getByRole('button',{name:'移除人员',exact:true}).click();assert.equal(await editor.getByRole('button',{name:'移除：'+fixture.leadName,exact:true}).count(),0);
 await editor.getByRole('button',{name:'关闭审核弹窗',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();assert(await editor.isVisible());
 await editor.getByRole('button',{name:'关闭审核弹窗',exact:true}).click();await page.getByRole('button',{name:'放弃并继续',exact:true}).click();await editor.waitFor({state:'detached'});assert.deepEqual(await get('team-workspaces/'+fixture.id),before);result.checks.push('shared member-removal modal supports Escape; explicit removal is local only; discard cancellation retains input; discard leaves DB unchanged');
 stage='institution-inline-edit';await open();const original=await get('entities/'+fixture.organizationId);const oldProfile=original.facts.find(f=>f.kind==='profile');
 await editor.getByRole('button',{name:'完善机构资料',exact:true}).click();const name=fixture.organizationName+'（原位核对）';
 await editor.getByLabel('团队所属机构正式名称',{exact:true}).fill(name);await editor.getByLabel('团队所属机构简介',{exact:true}).fill('仅本轮合成机构，验证资料就地修订、原版本保留与审核后名称一致。');
 assert((await editor.getByLabel('团队所属机构',{exact:true}).locator('option:checked').textContent()).includes(name));
 const save=page.waitForResponse(r=>new URL(r.url()).pathname===api+'team-workspaces/'+fixture.id&&r.request().method()==='POST');await editor.getByRole('button',{name:'保存草稿',exact:true}).click();assert.equal((await save).status(),200);await editor.getByText('草稿已保存，尚未审核展示。',{exact:true}).waitFor();assert.deepEqual(await get('entities/'+fixture.organizationId),original);result.checks.push('inline institution edit keeps dropdown name consistent; saving does not replace approved institution');
 stage='institution-joint-review';await page.waitForFunction(()=>[...document.querySelectorAll('dialog.team-workspace-dialog button')].some(n=>n.textContent==='审核通过并展示'&&!n.disabled));
 await editor.getByRole('button',{name:'审核通过并展示',exact:true}).click();await editor.waitFor({state:'detached'});const after=await get('entities/'+fixture.organizationId),newProfile=after.facts.find(f=>f.kind==='profile');assert.equal(newProfile.payload.name,name);assert.equal(newProfile.revision,oldProfile.revision+1);assert.equal(newProfile.decision.decision,'approve');
 fixture.organizationName=name;writeFileSync(manifest,JSON.stringify(fixture,null,2),{mode:0o600});
 const w=await get('team-workspaces/'+fixture.id);assert.equal(w.version,w.reviewedVersion);assert.equal(w.data.organization.name,name);await page.screenshot({path:out+'institution-joint-reviewed-list.png'});
 for(const old of fixture.before.teams)assert.deepEqual(stored(await get('team-workspaces/'+old.id)),old);for(const old of fixture.before.entities)assert.deepEqual(await get('entities/'+old.item.id),old);
 await open();await editor.getByRole('button',{name:'完善机构资料',exact:true}).click();assert.equal(await editor.getByLabel('团队所属机构正式名称',{exact:true}).inputValue(),name);assert((await editor.getByLabel('团队所属机构',{exact:true}).locator('option:checked').textContent()).includes(name));await page.screenshot({path:out+'institution-name-consistent.png'});
 result.checks.push('one review revises only own new institution, closes modal, rereads matching names; original teams/orgs/people unchanged');assert.deepEqual(result.errors,[]);assertTeamDetailWrites(result.writes,fixture.id);result.passed=true;
}catch(e){result.passed=false;result.stage=stage;result.failure=e.message;process.exitCode=1;await page.screenshot({path:out+'failure.png'}).catch(()=>{});}
finally{await ctx.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
