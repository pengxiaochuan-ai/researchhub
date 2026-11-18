// Current S08 run only: real HTTP, real guarded synthetic PG; no paid services.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2,5),['--mode','local-synthetic','--step']);
const step=process.argv[5];assert(['read','create-edit','assignments','transitions','reviews','reminders','links','all'].includes(step)&&process.argv.length===6);
const root=fileURLToPath(new URL('../../',import.meta.url));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const [row]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});
assert(row?.manifest?.syntheticOnly);const {plan,taskIds}=row.manifest;
const accounts=await withFixtureTransaction(env,'direct',db=>db.account.findMany({where:{tenantId:runtime.ids.tenant,id:{in:[plan.ids.owner,plan.ids.admin]}},select:{id:true,role:true,authVersion:true}}),{readOnly:true});
const checks=[],requests=[];
const scope=project=>({'X-Study-Group-Id':plan.scope.studyGroupId,'X-Research-Project-Id':project});
async function call(path,cookie,project,expected=200){
 const response=await fetch('http://127.0.0.1:19502/api/study-tasks'+path,{headers:{Host:'127.0.0.1:19502',Cookie:cookie,...(project?scope(project):{})},redirect:'error',signal:AbortSignal.timeout(15000)});
 requests.push({path,status:response.status});assert.equal(response.status,expected,'S08_READ_HTTP_STATUS:'+path+':'+response.status);
 if(expected===200)assert.equal(response.headers.get('cache-control'),'no-store');
 return response.json();
}
async function login(email){
 const r=await fetch('http://127.0.0.1:19502/api/auth/login',{method:'POST',headers:{Origin:'http://127.0.0.1:19501','Content-Type':'application/json'},body:JSON.stringify({tenantSlug:runtime.ids.tenant,username:email,password:runtime.password}),redirect:'error'});
 assert.equal(r.status,201);const cookie=r.headers.get('set-cookie')?.split(';')[0];assert(cookie);return cookie;
}
async function write(path,cookie,body,method,expected=200){
 const response=await fetch('http://127.0.0.1:19502/api/study-tasks'+path,{method,headers:{Origin:'http://127.0.0.1:19501',Cookie:cookie,'Content-Type':'application/json',...scope(plan.scope.researchProjectId)},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
 requests.push({path,method,status:response.status});assert.equal(response.status,expected,'S08_WRITE_HTTP_STATUS:'+path+':'+response.status);return response.json();
}
try{
 const owner=await login('owner@example.org'),admin=await login('admin@example.org');
 if(step==='all'){
  const {runFinalApi}=await import('./study-tasks-final-api.mjs');
  await runFinalApi({root,env,plan,owner,admin,login,write,call});process.exit(0);
 }
 if(step==='links'){
  const {runLinksApi}=await import('./study-tasks-links-api.mjs');
  await runLinksApi({root,env,plan,owner,admin,write,call});process.exit(0);
 }
 if(step==='reminders'){
  const {runRemindersApi}=await import('./study-tasks-reminders-api.mjs');
  await runRemindersApi({root,env,plan,owner,admin,write,call});process.exit(0);
 }
 if(step==='assignments'){
  const {runAssignmentsApi}=await import('./study-tasks-assignments-api.mjs');
  await runAssignmentsApi({root,env,plan,runtime,login,write,call,owner,admin});process.exit(0);
 }
 if(step==='transitions'){
  const {runTransitionsApi}=await import('./study-tasks-transitions-api.mjs');
  await runTransitionsApi({root,env,plan,taskIds,owner,admin,write,call});process.exit(0);
 }
 if(step==='reviews'){
  const {runReviewsApi}=await import('./study-tasks-reviews-api.mjs');
  await runReviewsApi({root,env,plan,taskIds,owner,admin,login,write,call});process.exit(0);
 }
 if(step==='create-edit'){
  const payload={requestKey:plan.runId+'-api-create-edit',name:plan.runId+'-接口创建编辑验证',assigneeAccountId:plan.ids.owner,dueDate:'2026-11-13'};
  const first=await write('',owner,payload,'POST',201),same=await write('',owner,payload,'POST',201);assert.deepEqual(first,same);
  await write('',owner,{...payload,name:'同编号异内容应拒绝'},'POST',409);
  const edit={requestKey:plan.runId+'-api-edit-1',expectedVersion:0,name:plan.runId+'-接口编辑已保存',priority:'high'};
  const edited=await write('/'+first.taskId,owner,edit,'PATCH');assert.equal(edited.version,1);
  assert.deepEqual(await write('/'+first.taskId,owner,edit,'PATCH'),edited);
  await write('/'+first.taskId,owner,{...edit,requestKey:plan.runId+'-api-edit-stale',name:'不能覆盖已保存值'},'PATCH',409);
  const stored=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{id:first.taskId,...plan.scope},select:{name:true,version:true,status:true,dueAt:true}}),{readOnly:true});
  assert.equal(stored.name,edit.name);assert.equal(stored.status,'open');assert.equal(stored.version,1);assert.equal(stored.dueAt.toISOString(),'2026-11-13T15:59:59.999Z');
  const old=await withFixtureTransaction(env,'direct',db=>db.studyTask.findFirst({where:{...plan.scope,id:{notIn:[...taskIds,first.taskId]}},select:{id:true,version:true},orderBy:{createdAt:'asc'}}),{readOnly:true});
  assert(old);await write('/'+old.id,owner,{requestKey:plan.runId+'-old-read-only',expectedVersion:old.version,name:'不能修改历史夹具'},'PATCH',403);
  checks.push('real_create_and_edit_one_receipt_per_key','same_key_different_body_409','version_conflict_preserves_database','historical_tasks_remain_read_only');
  const directory=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/';mkdirSync(directory,{recursive:true});
  const file=directory+'create-edit-api-'+randomUUID()+'.json';writeFileSync(file,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,realHttp:true,checks,requests,taskId:first.taskId,createdTaskCount:1,modelCalls:0},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({passed:true,checks,taskId:first.taskId,createdTaskCount:1,modelCalls:0,evidence:file}));
  process.exit(0);
 }
 const owners=await call('/studies',owner);assert.deepEqual(owners.items.map(p=>p.id),[plan.scope.researchProjectId]);
 const admins=await call('/studies',admin);assert.equal(admins.items.length,2);assert(admins.items.some(p=>p.id===plan.project.id));checks.push('current_study_selection_admin_without_membership');
 const ownerContext=await call('/context',owner,plan.scope.researchProjectId);assert.equal(ownerContext.actor.id,plan.ids.owner);assert.equal(ownerContext.actor.roleLabel,'Study任务管理者');
 const adminContext=await call('/context',admin,plan.project.id);assert.equal(adminContext.actor.id,plan.ids.admin);assert.equal(adminContext.capabilities.canCreate,true);
 await call('/context',owner,plan.project.id,403);checks.push('owner_auxiliary_study_denied');
 const first=await call('?limit=2',owner,plan.scope.researchProjectId);assert.equal(first.items.length,2);assert(first.nextCursor);
 const next=await call('?limit=2&cursor='+encodeURIComponent(first.nextCursor),owner,plan.scope.researchProjectId);assert(next.items.length>=1);assert(!next.items.some(t=>first.items.some(x=>x.id===t.id)));
 await call('?limit=2&cursor='+encodeURIComponent(first.nextCursor),admin,plan.scope.researchProjectId,400);
 await call('?limit=2&cursor='+encodeURIComponent(first.nextCursor+'x'),owner,plan.scope.researchProjectId,400);checks.push('real_keyset_paging_and_actor_signed_cursor');
 const detail=await call('/'+taskIds[0],owner,plan.scope.researchProjectId);assert.equal(detail.item.id,taskIds[0]);assert(detail.item.history.length>0);assert.equal(detail.item.history[0].actor.id,plan.ids.admin);
 const aux=await call('/'+taskIds[1],admin,plan.project.id);assert.equal(aux.item.assignee.id,plan.ids.admin);
 await call('/'+taskIds[1],owner,plan.scope.researchProjectId,403);checks.push('real_database_tasks_and_scoped_detail');
 const people=await call('/participants',admin,plan.project.id);assert.deepEqual(people.items.map(p=>p.id),[plan.ids.admin]);assert(!JSON.stringify(people).includes('example.org'));checks.push('participants_no_email_or_implicit_membership');
 const receipt=await call('/operations/'+plan.runId+'-fixture-0',admin,plan.scope.researchProjectId);assert.equal(receipt.taskId,taskIds[0]);
 await call('/operations/'+plan.runId+'-fixture-0',owner,plan.scope.researchProjectId,404);
 await call('?limit=2&limit=2',owner,plan.scope.researchProjectId,400);await call('?include=password',owner,plan.scope.researchProjectId,400);
 const require=createRequire(root+'app/server/package.json'),{JwtService}=require('@nestjs/jwt');
 const current=accounts.find(a=>a.id===plan.ids.admin),jwt=new JwtService({secret:runtime.secret});
 const token=jwt.sign({accountId:current.id,tenantId:runtime.ids.tenant,role:current.role,authVersion:current.authVersion-1},{expiresIn:'1m'});
 await call('/context',admin.split('=')[0]+'='+token,plan.project.id,401);checks.push('old_auth_version_cookie_rejected');
 const directory=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/';mkdirSync(directory,{recursive:true});
 const file=directory+'read-api-'+randomUUID()+'.json';writeFileSync(file,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,realHttp:true,checks,requests,committedTaskWrites:0,modelCalls:0},null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({passed:true,checks,httpRequests:requests.length,committedTaskWrites:0,modelCalls:0,evidence:file}));
}catch(error){console.error(JSON.stringify({passed:false,checks,requests,code:error.code??error.name,message:/^S08_/.test(error.message)?error.message:'S08_READ_VERIFICATION_FAILED'}));process.exitCode=1;}
