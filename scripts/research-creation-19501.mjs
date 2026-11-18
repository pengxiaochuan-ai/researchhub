// Explicit synthetic-only acceptance of the shared local site. Never seeds accounts or changes roles.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {fixtureEnvironment,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();await assertFixtureTarget(env);
const state=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'));
assert(state.ready&&state.key.startsWith('rh-kb-local-'));
const base='http://127.0.0.1:19501',root=workspaceRoot+'researchhub/docs/testing/evidence/research-creation-19501-2026-11-11/';
const out=root+'acceptance-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
const checks=[],network=[],errors=[],cookies=new Map(),contexts=[];
const pre=JSON.parse(readFileSync(root+'preflight.json'));
const oldCookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json'));
let stage='preflight',browser,page,project,study;
async function request(role,path,{method='GET',body,status=200,raw,origin=base}={}){
 const response=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies.get(role)??oldCookies[role]??'',...(method!=='GET'?{Origin:origin,'Content-Type':'application/json'}:{}),'x-study-group-id':state.ids.group,'x-research-project-id':state.ids.project},...(method!=='GET'?{body:raw??JSON.stringify(body??{})}:{})});
 network.push({role,path,method,status:response.status,at:new Date().toISOString()});
 const value=await response.json();assert.equal(response.status,status,JSON.stringify({role,path,expected:status,actual:response.status,code:value.code}));return value;
}
async function login(role){
 const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:state.ids.tenant,username:role+'@example.org',password:state.password})});
 assert.equal(r.status,201);cookies.set(role,r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '));
 assert.equal((await r.json()).user.accountId,state.ids[role]);
}
const hash=value=>createHash('sha256').update(value).digest('hex');
const unchanged=()=>withFixtureTransaction(env,'direct',async db=>({
 oldProject:await db.researchProject.findUnique({where:{id:state.ids.project},select:{id:true,name:true,status:true}}),
 roles:await db.permissionRole.findMany({where:{tenantId:state.ids.tenant},select:{id:true,menuPermissions:true,buttonPermissions:true,dataScope:true},orderBy:{id:'asc'}}),
 hubRoles:await db.$queryRaw`SELECT hub_key,account_id,study_group_id,role,status,version FROM rh_research.hub_role WHERE tenant_id=${state.ids.tenant} ORDER BY hub_key,account_id`
}),{readOnly:true});
try{
 assert.deepEqual(state.ids,pre.ids);assert.equal(hash(state.secret),pre.secretHash);assert.equal(hash(state.password),pre.passwordHash);
 for(const role of ['owner','admin']){assert.equal((await request(role,'/auth/me')).accountId,state.ids[role]);await request(role,'/research-projects/context');}
 checks.push('existing_identity_password_signing_secret_and_pre_reload_cookies_preserved');
 const before=await unchanged();
 for(const role of ['owner','admin','viewer','uninvited'])await login(role);
 const ownerScope=await request('owner','/research-projects/context');assert.equal(ownerScope.creationGroups.length,1);assert.equal(ownerScope.creationGroups[0].id,state.ids.group);
 assert.equal((await request('viewer','/research-projects/context')).creationGroups.length,0);
 for(const path of ['/knowledge/bases','/my-research/overview'])await request('owner',path);
 checks.push('existing_scoped_knowledge_and_workspace_reads_and_current_creation_permissions');
 stage='http-contract';
 await request('owner','/research-projects',{method:'POST',raw:'{',status:400});
 await request('owner','/research-projects',{method:'POST',raw:JSON.stringify({requestKey:randomUUID(),title:'x'.repeat(270000)}),status:413});
 await request('owner','/research-projects',{method:'POST',body:{requestKey:randomUUID(),title:'不得由其他来源创建'},origin:'http://127.0.0.1:19611',status:403});
 const large={requestKey:randomUUID(),title:'合成19501请求体验证 '+randomUUID().slice(0,8),question:'合'.repeat(20000),pico:Object.fromEntries(['p','i','c','o'].map(k=>[k,'成'.repeat(10000)]))};
 assert(Buffer.byteLength(JSON.stringify(large))>100*1024);
 const saved=await request('owner','/research-projects',{method:'POST',body:large,status:201});
 assert.deepEqual(await request('owner','/research-projects',{method:'POST',body:large,status:201}),saved);
 await request('uninvited','/research-projects/'+saved.item.id,{status:404});
 await request('owner','/research-projects/'+saved.item.id,{method:'PATCH',body:{requestKey:randomUUID(),expectedVersion:999,title:'过期版本'},status:409});
 const blocked=await request('viewer','/research-projects',{method:'POST',body:{requestKey:randomUUID(),title:'合成19501无研究创建权限草稿'},status:201});
 await request('viewer','/research-projects/'+blocked.item.id+'/studies',{method:'POST',body:{requestKey:randomUUID(),expectedVersion:1},status:403});
 const foreign=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-creation/rh-create-39ca8c05/accepted.json')).project;
 await request('owner','/research-projects/'+foreign.id,{status:404});
 checks.push('actual_json_400_size_413_origin_403_valid_180kb_idempotence_cas_and_private_scope_denials');
 stage='browser';
 const pw=await import(workspaceRoot+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
 browser=await (pw.chromium??pw.default.chromium).launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 async function signed(role){const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video/',size:{width:1440,height:900}}});contexts.push(context);
  await context.addCookies(cookies.get(role).split('; ').map(c=>({name:c.slice(0,c.indexOf('=')),value:c.slice(c.indexOf('=')+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'})));
  const current=await context.newPage();current.setDefaultTimeout(20000);current.on('pageerror',e=>errors.push(e.message));current.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({role,browser:true,path,method:r.request().method(),status:r.status(),at:new Date().toISOString()});});return{context,page:current};}
 const owner=await signed('owner'),admin=await signed('admin');page=owner.page;
 await page.goto(base+'/pages/q02/');await page.getByRole('button',{name:'新建课题',exact:true}).waitFor();
 await page.screenshot({path:out+'q02-entry.png'});await page.getByRole('button',{name:'新建课题',exact:true}).click();
 await page.locator('#research-project-title').waitFor();assert.equal(await page.locator('#research-project-title').inputValue(),'');
 const title='合成19501统一入口验收 '+randomUUID().slice(0,8);
 await page.locator('#research-project-title').fill(title);await page.locator('#research-project-question').fill('只验证软件流程，不含真实受试者资料。');
 const saving=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/research-projects');
 await page.getByRole('button',{name:'保存课题',exact:true}).click();assert.equal((await saving).status(),201);
 await page.waitForURL(url=>url.searchParams.has('projectIntentId'));project=(await request('owner','/research-projects/'+new URL(page.url()).searchParams.get('projectIntentId'))).item;
 await page.getByRole('button',{name:'建立研究',exact:true}).waitFor();stage='browser-refresh';await page.reload();await page.getByRole('button',{name:'建立研究',exact:true}).waitFor();assert.equal(await page.locator('#research-project-title').inputValue(),title);
 await page.screenshot({path:out+'q01-saved.png'});
 stage='browser-establish';const establishing=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/research-projects/'+project.id+'/studies');
 await page.getByRole('button',{name:'建立研究',exact:true}).click();assert.equal((await establishing).status(),200);
 await page.waitForURL('**/pages/s01/?researchStudy=1&studyId=*');project=(await request('owner','/research-projects/'+project.id)).item;study=project.study;assert.equal(new URL(page.url()).searchParams.get('studyId'),study.id);await page.locator('.rh-study-summary').getByText(title,{exact:true}).waitFor();
 assert.equal(await page.locator('.rh-study-overview .metric-card').filter({hasText:'受试者'}).locator('.metric-value').innerText(),'0');
 await page.getByText('建立研究不代表方案已批准或研究已启动。',{exact:true}).waitFor();
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await page.waitForTimeout(250);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'s01-'+width+'.png'});}
 checks.push('actual_chrome_default_q02_blank_create_save_refresh_establish_zero_counts_three_viewports');
 await page.setViewportSize({width:1440,height:900});
 await owner.context.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});await login('owner');
 await owner.context.addCookies(cookies.get('owner').split('; ').map(c=>({name:c.slice(0,c.indexOf('=')),value:c.slice(c.indexOf('=')+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'})));
 await page.goto(base+'/pages/q02/');await page.getByRole('link',{name:'查看已保存课题',exact:true}).click();
 const row=page.locator('li[data-project-intent-id="'+project.id+'"]');await row.waitFor();await row.getByRole('link',{name:'进入研究概览',exact:true}).click();await page.locator('.rh-study-summary').getByText(title,{exact:true}).waitFor();
 await admin.page.goto(base+'/pages/s01/?researchStudy=1&studyId='+study.id);await admin.page.locator('.rh-study-summary').getByText(title,{exact:true}).waitFor();await admin.page.screenshot({path:out+'admin-s01.png'});
 await request('viewer','/research-studies/'+study.id,{status:404});
 checks.push('relogin_saved_list_continue_and_current_admin_without_project_membership');
 stage='postgres';const persisted=await withFixtureTransaction(env,'direct',async db=>({
  binding:await db.$queryRaw`SELECT b.id,b.execution_project_id,i.status,i.version FROM rh_research.study_binding b JOIN rh_research.project_intent i ON i.id=b.project_intent_id AND i.tenant_id=b.tenant_id WHERE b.id=${study.id} AND b.tenant_id=${state.ids.tenant}`,
  source:await db.researchProject.findUnique({where:{id:study.executionProjectId},select:{id:true,studyGroupId:true,name:true,status:true}}),
  members:await db.researchProjectMembership.findMany({where:{researchProjectId:study.executionProjectId},select:{accountId:true,roleKey:true}}),
  audit:await db.auditLog.count({where:{target:study.executionProjectId}})
 }),{readOnly:true});assert.equal(persisted.binding.length,1);assert.equal(persisted.source.studyGroupId,state.ids.group);assert.equal(persisted.source.name,title);assert.deepEqual(persisted.members.map(m=>m.accountId),[state.ids.owner]);assert(persisted.audit>0);
 const overview=await request('owner','/research-studies/'+study.id);assert.equal(overview.item.counts.protocols,0);assert.equal(overview.item.preparation.canStartCollection,false);
 assert.deepEqual(await unchanged(),before);assert.equal(errors.length,0,JSON.stringify(errors));
 checks.push('actual_postgres_atomic_binding_creator_membership_audit_and_old_project_roles_unchanged');
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),base,syntheticOnly:true,actualChrome:true,modelCalls:0,checks,network,errors,projectId:project.id,studyId:study.id,persisted,professionalAcceptance:false},null,2));
 console.log(JSON.stringify({passed:true,checks,evidence:out}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,message:error.message,checks,network,errors},null,2));await page?.screenshot({path:out+'failure.png'}).catch(()=>{});console.error(JSON.stringify({passed:false,stage,message:error.message.slice(0,700),evidence:out}));process.exitCode=1;}
finally{for(const context of contexts)await context.close().catch(()=>{});await browser?.close();}
