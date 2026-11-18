// Real PG proof: all fixture writes live in one transaction and are rolled back.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {inspectStudyTaskAdmission} from './study-tasks-preflight.mjs';

assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root=fileURLToPath(new URL('../../',import.meta.url));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
await assertFixtureTarget(env);
const admission=await inspectStudyTaskAdmission(env,ids);assert.equal(admission.assessment.allowed,true,'S08_ADMISSION_BLOCKED');
const require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {StudyOperationsService}=require(root+'app/server/src/study-operations/study-operations.service.ts');
const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
const runId='rh-s08-core-'+randomUUID().slice(0,8),projectId=runId+'-project';
const scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:projectId};
const rollback=new Error('S08_CORE_EXPECTED_OUTER_ROLLBACK');
const checks=[],createdTaskIds=[];let nestedTransactions=0,caseId;
const service=new StudyOperationsService({withTenantTransaction(){nestedTransactions++;throw new Error('S08_NESTED_TRANSACTION');}});
const errorCode=e=>e?.getResponse?.()?.code;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
try{
  try{
    await withFixtureTransaction(env,'direct',async db=>{
      await lockAuthorizationMutation(db,ids.tenant);
      const account=await db.account.update({where:{id:ids.admin},data:{isTenantAdmin:true,authVersion:{increment:1}},select:{id:true,tenantId:true,role:true,isTenantAdmin:true,authVersion:true}});
      const principal={accountId:account.id,tenantId:account.tenantId,role:account.role,isTenantAdmin:false,authVersion:account.authVersion,username:'synthetic-admin'};
      await db.tenantFeatureEntitlement.upsert({where:{tenantId_featureKey:{tenantId:ids.tenant,featureKey:'study_operations'}},create:{tenantId:ids.tenant,featureKey:'study_operations',enabled:true,updatedBy:ids.admin},update:{enabled:true}});
      await db.researchProject.create({data:{id:projectId,tenantId:ids.tenant,studyGroupId:ids.group,code:runId,name:'S08事务回滚合成研究',createdBy:ids.admin}});
      assert.equal(await db.researchProjectMembership.count({where:{researchProjectId:projectId}}),0);
      const command=(action,input,extra={})=>service.executeHubTaskCommandInTransaction(db,principal,scope,{action,taskId:createdTaskIds[0],input,...extra});
      const created=await command('create',{taskType:'custom',name:runId+'-task',assigneeAccountId:ids.admin,dueAt:'2026-11-04T15:59:59.999Z'});
      createdTaskIds.push(created.id);assert.equal(created.requiresReview,true);assert.equal(created.reviewStatus,'not_submitted');
      assert.equal(created.createdBy,ids.admin);assert.equal(created.source,'manual');
      checks.push('current_db_admin_without_study_membership_can_create');
      const repair=await db.remediationCase.create({data:{...scope,code:'S08_SYNTHETIC_REPAIR',severity:'LOW',sourceType:'study_task',sourceId:created.id,sourceHash:digest(runId),inputHash:digest(runId),affectedResource:{type:'task',id:created.id},ownerRole:'project_manager',status:'assigned',executorVersion:'s08-core-proof-v1',studyTaskId:created.id,createdBy:ids.admin}});
      caseId=repair.id;
      const auditCount=await db.auditLog.count({where:{tenantId:ids.tenant,target:{in:[created.id,caseId]}}});
      await db.$executeRawUnsafe('SAVEPOINT s08_core_before_transition');
      const started=await command('transition',{status:'in_progress',expectedVersion:0});
      assert.equal(started.version,1);
      assert.equal((await db.remediationCase.findUnique({where:{id:caseId}})).status,'repairing');
      assert.equal(await db.remediationEvent.count({where:{remediationCaseId:caseId}}),1);
      await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT s08_core_before_transition');
      const resetTask=await db.studyTask.findUnique({where:{id:created.id}});
      const resetCase=await db.remediationCase.findUnique({where:{id:caseId}});
      assert.equal(resetTask.status,'open');assert.equal(resetTask.version,0);
      assert.equal(resetCase.status,'assigned');assert.equal(resetCase.version,0);
      assert.equal(await db.remediationEvent.count({where:{remediationCaseId:caseId}}),0);
      assert.equal(await db.auditLog.count({where:{tenantId:ids.tenant,target:{in:[created.id,caseId]}}}),auditCount);
      checks.push('task_core_rollback_preserves_remediation_and_audit');
      await command('transition',{status:'in_progress',expectedVersion:0});
      const completed=await command('transition',{status:'completed',expectedVersion:1,completionNote:'仅合成任务的确定性测试说明，不涉及临床结果'});
      assert.equal(completed.reviewStatus,'pending_review');
      const accepted=await command('review',{decision:'accept',expectedVersion:2,note:'合成同人验收，非独立复核'});
      assert.equal(accepted.reviewStatus,'accepted');assert.equal(accepted.version,3);
      assert.equal((await db.remediationCase.findUnique({where:{id:caseId}})).status,'ready_to_retry');
      const audits=await db.auditLog.findMany({where:{tenantId:ids.tenant,target:created.id},select:{accountId:true}});
      assert(audits.length>=4&&audits.every(a=>a.accountId===ids.admin));
      checks.push('real_completion_review_and_remediation_keep_actor');
      await db.account.update({where:{id:ids.admin},data:{isTenantAdmin:false,authVersion:{increment:1}}});
      await assert.rejects(()=>command('review',{decision:'accept',expectedVersion:3}),e=>errorCode(e)==='STUDY_TASK_AUTH_STALE');
      principal.authVersion++;
      await assert.rejects(()=>command('review',{decision:'accept',expectedVersion:3}),e=>errorCode(e)==='STUDY_TASK_AUTH_REQUIRED');
      assert.equal((await db.studyTask.findUnique({where:{id:created.id}})).version,3);
      checks.push('revoked_admin_and_stale_identity_cannot_commit');
      throw rollback;
    });
  }catch(error){if(error!==rollback)throw error;}
  assert.equal(nestedTransactions,0);
  await withFixtureTransaction(env,'direct',async db=>{
    assert.equal(await db.researchProject.count({where:{id:projectId}}),0);
    assert.equal(await db.studyTask.count({where:{id:{in:createdTaskIds}}}),0);
    assert.equal(await db.remediationCase.count({where:{id:caseId}}),0);
  },{readOnly:true});
  const after=await inspectStudyTaskAdmission(env,ids);
  assert.deepEqual(after.snapshot,admission.snapshot);assert.deepEqual(after.preserved,admission.preserved);
  const evidence=root+'researchhub/.superpowers/sdd/implementation-plan-study-tasks-s08-2026-11-02/'+runId+'.json';
  const result={passed:true,checkedAt:new Date().toISOString(),runId,database:'wp01_test_full_baseline',checks,createdTaskIds,rolledBackStudyId:projectId,caseId,nestedTransactions,outerRolledBack:true,committedAuthorizationWrites:0,newModelCalls:0,beforeHash:digest(admission.preserved),afterHash:digest(after.preserved)};
  writeFileSync(evidence,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({...result,evidence}));
}catch(error){console.error(JSON.stringify({passed:false,code:errorCode(error)||error.code||error.message,runId,createdTaskIds,nestedTransactions}));process.exitCode=1;}
