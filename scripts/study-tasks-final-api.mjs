import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export async function runFinalApi({root,env,plan,owner,admin,login,write,call}){
 const checks=[],key=plan.runId+'-final-cas',requests=[];
 const created=await write('',owner,{requestKey:key,name:plan.runId+'-最终并发及撤权验证',assigneeAccountId:plan.ids.owner,dueDate:'2026-11-13'},'POST',201);
 const createdTaskId=created.taskId;let taskId=createdTaskId;
 const attempt=key+'-'+randomUUID().slice(0,8);
 async function send(cookie,body,path='/'+taskId,method='PATCH'){
  const response=await fetch('http://127.0.0.1:19502/api/study-tasks'+path,{method,headers:{Origin:'http://127.0.0.1:19501','Content-Type':'application/json',Cookie:cookie,'X-Study-Group-Id':plan.scope.studyGroupId,'X-Research-Project-Id':plan.scope.researchProjectId},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
  const data=await response.json();requests.push({path,method,status:response.status,requestKey:body.requestKey});return {status:response.status,data};
 }
 let current=(await call('/'+taskId,owner,plan.scope.researchProjectId)).item;
 let originalPriority;
 if(current.status==='cancelled'){
  const [active]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT o.task_id FROM rh_study_tasks.operation o JOIN study_task t ON t.id=o.task_id
   WHERE o.tenant_id=${plan.scope.tenantId} AND o.research_project_id=${plan.scope.researchProjectId} AND o.action='create' AND t.status IN ('open','in_progress','blocked') ORDER BY o.task_id LIMIT 1`,{readOnly:true});
  assert(active,'S08_NO_EXISTING_ACTIVE_PROBE_TASK');taskId=active.task_id;current=(await call('/'+taskId,owner,plan.scope.researchProjectId)).item;originalPriority=current.priority;
 }
 if(!['completed','cancelled'].includes(current.status)){
  const initial=current.version;
  const pair=await Promise.all([send(owner,{requestKey:attempt+'-race-owner',expectedVersion:initial,priority:'high'}),send(admin,{requestKey:attempt+'-race-admin',expectedVersion:initial,priority:'urgent'})]);
  assert.deepEqual(pair.map(v=>v.status).sort(),[200,409]);assert.equal(pair.find(v=>v.status===200).data.version,initial+1);
  current=(await call('/'+taskId,owner,plan.scope.researchProjectId)).item;assert.equal(current.version,initial+1);checks.push('two_real_accounts_same_version_exactly_one_atomic_edit');
 }
 if(current.status!=='cancelled'){
  const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
  const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
  const before=await withFixtureTransaction(env,'direct',db=>db.account.findFirst({where:{id:plan.ids.admin,tenantId:plan.scope.tenantId,status:'active',role:'tenant_admin',isTenantAdmin:true},select:{authVersion:true}}),{readOnly:true});assert(before);
  const version=current.version;let revokedVersion,pending,lockWaitObserved=false;
  try{
   await withFixtureTransaction(env,'direct',async db=>{
    await lockAuthorizationMutation(db,plan.scope.tenantId);
    pending=send(admin,{requestKey:attempt+'-inflight-revoked',expectedVersion:version,name:plan.runId+'-此撤权提交不得成功'});pending.catch(()=>{});
    const lockName='wp01:tenant:'+plan.scope.tenantId;
    for(let i=0;i<60;i++){
     const [waiting]=await withFixtureTransaction(env,'direct',probe=>probe.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_locks
      WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())
      AND classid=((hashtextextended(${lockName},0)>>32)&4294967295)::oid
      AND objid=(hashtextextended(${lockName},0)&4294967295)::oid) waiting`,{readOnly:true});
     if(waiting.waiting){lockWaitObserved=true;break;}await new Promise(ok=>setTimeout(ok,25));
    }
    assert(lockWaitObserved,'S08_HTTP_AUTHORIZATION_WAIT_NOT_OBSERVED');
    assert.equal((await db.account.updateMany({where:{id:plan.ids.admin,tenantId:plan.scope.tenantId,isTenantAdmin:true,authVersion:before.authVersion},data:{isTenantAdmin:false,authVersion:{increment:1}}})).count,1);
    revokedVersion=before.authVersion+1;
    await db.auditLog.create({data:{...plan.scope,accountId:plan.ids.admin,action:'researchhub_s08_admin_probe',target:plan.ids.admin,meta:{actorKind:'approved_local_synthetic_revocation_test',enabled:false,authVersion:revokedVersion,requestKey:attempt+'-inflight-revoked'}}});
   });
   const actual=await pending;assert.equal(actual.status,403,'S08_INFLIGHT_REVOKED_NOT_REJECTED_AFTER_LOCK');
   await call('/context',admin,plan.scope.researchProjectId,401);
   assert.equal((await call('/'+taskId,owner,plan.scope.researchProjectId)).item.version,version);
   const [op]=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT count(*) n FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId} AND request_key=${attempt+'-inflight-revoked'}`,{readOnly:true});assert.equal(Number(op.n),0);
   checks.push('real_http_held_at_authorization_lock_then_revoked_cannot_commit');
  }finally{
   if(revokedVersion)await withFixtureTransaction(env,'direct',async db=>{
    await lockAuthorizationMutation(db,plan.scope.tenantId);
    const account=await db.account.findFirst({where:{id:plan.ids.admin,tenantId:plan.scope.tenantId,status:'active',role:'tenant_admin'},select:{isTenantAdmin:true,authVersion:true}});assert(account);
    if(account.isTenantAdmin&&account.authVersion===before.authVersion)return;
    assert.equal(account.isTenantAdmin,false);assert.equal(account.authVersion,revokedVersion);
    assert.equal((await db.account.updateMany({where:{id:plan.ids.admin,tenantId:plan.scope.tenantId,isTenantAdmin:false,authVersion:revokedVersion},data:{isTenantAdmin:true,authVersion:{increment:1}}})).count,1);
    await db.auditLog.create({data:{...plan.scope,accountId:plan.ids.admin,action:'researchhub_s08_admin_probe',target:plan.ids.admin,meta:{actorKind:'approved_local_synthetic_revocation_test',enabled:true,authVersion:revokedVersion+1}}});
   });
   if(pending)await pending.catch(()=>{});
  }
  admin=await login('admin@example.org');assert.equal((await call('/context',admin,plan.project.id)).capabilities.canCreate,true);checks.push('admin_restored_via_cas_fresh_login_unjoined_study_still_authorized');
  if(taskId===createdTaskId)await write('/'+taskId+'/transitions',owner,{requestKey:attempt+'-cancel',expectedVersion:version,status:'cancelled',reason:'本轮具名合成并发及撤权验证完成，保留任务与全部历史。'},'POST');
  else{
   await write('/'+taskId,owner,{requestKey:attempt+'-restore-priority',expectedVersion:version,priority:originalPriority},'PATCH');
   assert.equal((await call('/'+taskId,owner,plan.scope.researchProjectId)).item.priority,originalPriority);checks.push('existing_named_fixture_priority_restored_no_ninth_task');
  }
 }else checks.push('prior_named_final_task_and_receipts_reused_read_only');
 const validationTaskId=taskId;taskId=createdTaskId;
 current=(await call('/'+taskId,owner,plan.scope.researchProjectId)).item;assert.equal(current.status,'cancelled');
 await write('/'+taskId+'/transitions',owner,{requestKey:key+'-cannot-reopen',expectedVersion:current.version,status:'in_progress'},'POST',409);
 await call('/context',owner,plan.project.id,403);await call('/context',admin,'not-an-authorized-study',403);checks.push('terminal_task_never_reopens_and_false_scope_denied');
 const out=root+'researchhub/docs/testing/evidence/study-tasks-s08-2026-11-02/'+plan.runId+'/';mkdirSync(out,{recursive:true});const evidence=out+'final-api-'+randomUUID()+'.json';
 writeFileSync(evidence,JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,realHttp:true,checks,requests,taskId,validationTaskId,attempt,finalStatus:current.status,modelCalls:0,externalMessages:0,professionalAcceptance:false},null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({passed:true,checks,taskId,modelCalls:0,evidence}));
}
