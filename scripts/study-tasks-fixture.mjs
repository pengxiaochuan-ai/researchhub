import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {inspectStudyTaskAdmission} from './study-tasks-preflight.mjs';
import {applyStudyTaskSchema} from './study-tasks-schema.mjs';

export function planStudyTaskFixture(snapshot,runId){
  if(!/^rh-s08-[a-f0-9]{8}$/.test(runId))throw new Error('S08_FIXTURE_RUN_REJECTED');
  const {scope,ids}=snapshot;
  const member=snapshot.groupMemberships.find(m=>m.accountId===ids.owner&&m.studyGroupId===scope.studyGroupId&&m.status==='active');
  const projectMember=snapshot.projectMemberships.find(m=>m.accountId===ids.owner&&m.researchProjectId===scope.researchProjectId&&m.status==='active');
  if(!member||!projectMember||member.role?.tenantId!==scope.tenantId||member.role.status!=='active'||!Array.isArray(member.role.menuPermissions)||!Array.isArray(member.role.buttonPermissions)||typeof member.role.dataScope!=='string')throw new Error('S08_FIXTURE_SOURCE_REJECTED');
  const make=(suffix,permissions)=>({id:runId+'-'+suffix,tenantId:scope.tenantId,key:runId+'-'+suffix,name:'S08合成任务'+(suffix==='executor'?'执行者':'管理者'),builtin:false,status:'active',dataScope:member.role.dataScope,menuPermissions:[...member.role.menuPermissions],buttonPermissions:[...new Set([...member.role.buttonPermissions,...permissions])]});
  return {runId,scope:{...scope},ids:{...ids},maxTasks:8,originalRoleId:member.roleId,ownerGroupMemberId:member.id,ownerProjectMemberId:projectMember.id,
    roles:[make('executor',['study.execute']),make('manager',['study.configure','study.execute','study.review'])],
    project:{id:runId+'-unjoined',tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,code:runId+'-unjoined',name:'S08未入组管理员合成验证研究',status:'active',createdBy:ids.admin},
    taskNames:[runId+'-owner-synthetic',runId+'-admin-unjoined-synthetic']};
}
export function validateStudyTaskFixture(plan,actual){
  try{
    assert.deepEqual(actual.scope,plan.scope);
    assert.deepEqual([...actual.roleIds].sort(),plan.roles.map(r=>r.id).sort());
    assert.equal(actual.projectId,plan.project.id);assert.equal(actual.adminEnabled,true);assert.equal(actual.featureEnabled,true);
    assert.equal(actual.ownerRoleId,plan.roles[1].id);
    assert(Number.isInteger(actual.tasksCreated)&&actual.tasksCreated>=2&&actual.tasksCreated<=plan.maxTasks);
    assert.equal(new Set(actual.taskIds).size,actual.taskIds.length);assert.equal(actual.tasksCreated,actual.taskIds.length);
    return true;
  }catch{throw new Error('S08_FIXTURE_STATE_CHANGED');}
}

const root=fileURLToPath(new URL('../../',import.meta.url));
const purpose='ResearchHub-S08-20261102-task-page';
export function assertStudyTaskFixtureBoundary(manifest,snapshot){
  try{
    assert.equal(manifest.purpose,purpose);assert.equal(manifest.syntheticOnly,true);
    const {plan}=manifest;
    assert(/^rh-s08-[a-f0-9]{8}$/.test(plan.runId));
    assert.deepEqual(plan.scope,snapshot.scope);assert.deepEqual(plan.ids,snapshot.ids);
    assert.equal(plan.maxTasks,8);
    assert.deepEqual(plan.roles.map(r=>r.id),[plan.runId+'-executor',plan.runId+'-manager']);
    assert.equal(plan.project.id,plan.runId+'-unjoined');
    assert.equal(plan.project.tenantId,snapshot.scope.tenantId);assert.equal(plan.project.studyGroupId,snapshot.scope.studyGroupId);
  }catch{throw new Error('S08_FIXTURE_BOUNDARY_REJECTED');}
}
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

async function inspectExisting(db,manifest){
  const {plan,taskIds}=manifest;
  const roles=await db.permissionRole.findMany({where:{tenantId:plan.scope.tenantId,key:{startsWith:plan.runId+'-'}},orderBy:{id:'asc'},select:Object.fromEntries(Object.keys(plan.roles[0]).map(k=>[k,true]))});
  assert.deepEqual(roles,plan.roles,'S08_FIXTURE_ROLE_DRIFT');
  const admin=await db.account.findUnique({where:{id:plan.ids.admin},select:{isTenantAdmin:true,authVersion:true}});
  const member=await db.studyGroupMembership.findFirst({where:{id:plan.ownerGroupMemberId,tenantId:plan.scope.tenantId,studyGroupId:plan.scope.studyGroupId,accountId:plan.ids.owner},select:{roleId:true}});
  const projectMember=await db.researchProjectMembership.findFirst({where:{id:plan.ownerProjectMemberId,...plan.scope,accountId:plan.ids.owner},select:{roleKey:true}});
  const feature=await db.tenantFeatureEntitlement.findFirst({where:{tenantId:plan.scope.tenantId,featureKey:'study_operations',enabled:true}});
  const project=await db.researchProject.findUnique({where:{id:plan.project.id},select:{id:true,tenantId:true,studyGroupId:true,status:true}});
  assert(project?.tenantId===plan.scope.tenantId&&project?.studyGroupId===plan.scope.studyGroupId&&project.status==='active','S08_FIXTURE_STUDY_DRIFT');
  assert.equal(await db.researchProjectMembership.count({where:{researchProjectId:plan.project.id,accountId:{in:[plan.ids.owner,plan.ids.admin]}}}),0,'S08_FIXTURE_MEMBERSHIP_DRIFT');
  assert.equal(projectMember?.roleKey,'project_manager','S08_FIXTURE_PROJECT_ROLE_DRIFT');
  const operations=await db.$queryRaw`SELECT task_id FROM rh_study_tasks.operation WHERE tenant_id=${plan.scope.tenantId}
    AND research_project_id=ANY(${[plan.scope.researchProjectId,plan.project.id]}::text[]) AND action='create' ORDER BY task_id`;
  assert(taskIds.every(id=>operations.some(r=>r.task_id===id)),'S08_FIXTURE_TASK_DRIFT');
  const actual={scope:plan.scope,roleIds:roles.map(r=>r.id),projectId:project.id,taskIds:operations.map(r=>r.task_id),tasksCreated:operations.length,
    adminEnabled:admin?.isTenantAdmin===true,ownerRoleId:member?.roleId,featureEnabled:Boolean(feature)};
  validateStudyTaskFixture(plan,actual);
  return actual;
}

export async function initializeStudyTaskFixture(env,ids){
  await assertFixtureTarget(env);
  const before=await inspectStudyTaskAdmission(env,ids);assert.equal(before.assessment.allowed,true,'S08_ADMISSION_BLOCKED');
  await applyStudyTaskSchema(env);
  const require=createRequire(root+'app/server/package.json');
  require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
  const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
  const {StudyOperationsService}=require(root+'app/server/src/study-operations/study-operations.service.ts');
  const service=new StudyOperationsService({withTenantTransaction(){throw new Error('S08_NESTED_TRANSACTION');}});
  return withFixtureTransaction(env,'direct',async db=>{
    await lockAuthorizationMutation(db,ids.tenant);
    const previous=await db.$queryRaw`SELECT run_id,manifest FROM wp01_meta.fixture_run WHERE manifest->>'purpose'=${purpose}`;
    assert(previous.length<=1,'S08_FIXTURE_MANIFEST_CONFLICT');
    if(previous.length){const manifest=previous[0].manifest;assertStudyTaskFixtureBoundary(manifest,before.snapshot);const actual=await inspectExisting(db,manifest);return {created:false,manifest,actual};}
    const plan=planStudyTaskFixture(before.snapshot,'rh-s08-'+randomUUID().slice(0,8));
    const sourceRole=await db.permissionRole.findUnique({where:{id:plan.originalRoleId}});
    const sourceMember=before.snapshot.groupMemberships.find(m=>m.id===plan.ownerGroupMemberId);
    for(const [key,value] of Object.entries(sourceMember.role))assert.deepEqual(sourceRole[key],value,'S08_FIXTURE_SOURCE_CHANGED');
    const sourceTasks=await db.studyTask.findMany({where:plan.scope,orderBy:{id:'asc'}});
    assert.equal(digest(sourceTasks),before.preserved.studyTask.sha256,'S08_FIXTURE_TASK_BASELINE_CHANGED');
    await db.permissionRole.createMany({data:plan.roles});
    await db.researchProject.create({data:plan.project});
    for(const id of [ids.owner,ids.admin]){
      const account=before.snapshot.accounts.find(a=>a.id===id);
      assert.equal(account.isTenantAdmin,false,'S08_FIXTURE_IDENTITY_CHANGED');
      const updated=await db.account.updateMany({where:{id,tenantId:ids.tenant,status:'active',authVersion:account.authVersion,isTenantAdmin:false},data:{authVersion:{increment:1},...(id===ids.admin?{isTenantAdmin:true}:{})}});
      assert.equal(updated.count,1,'S08_FIXTURE_IDENTITY_CHANGED');
    }
    const memberChange=await db.studyGroupMembership.updateMany({where:{id:plan.ownerGroupMemberId,tenantId:ids.tenant,studyGroupId:ids.group,accountId:ids.owner,roleId:plan.originalRoleId,status:'active'},data:{roleId:plan.roles[1].id}});
    const projectChange=await db.researchProjectMembership.updateMany({where:{id:plan.ownerProjectMemberId,...plan.scope,accountId:ids.owner,status:'active',roleKey:before.snapshot.projectMemberships.find(m=>m.id===plan.ownerProjectMemberId).roleKey},data:{roleKey:'project_manager'}});
    assert.equal(memberChange.count,1,'S08_FIXTURE_MEMBERSHIP_CHANGED');assert.equal(projectChange.count,1,'S08_FIXTURE_MEMBERSHIP_CHANGED');
    await db.tenantFeatureEntitlement.upsert({where:{tenantId_featureKey:{tenantId:ids.tenant,featureKey:'study_operations'}},create:{tenantId:ids.tenant,featureKey:'study_operations',enabled:true,enabledAt:new Date(),updatedBy:ids.admin},update:{enabled:true,enabledAt:new Date(),disabledAt:null,updatedBy:ids.admin}});
    const current=await db.account.findUnique({where:{id:ids.admin},select:{role:true,authVersion:true}});
    const principal={accountId:ids.admin,tenantId:ids.tenant,role:current.role,isTenantAdmin:true,authVersion:current.authVersion,username:'synthetic-admin'};
    const taskIds=[];
    for(let i=0;i<2;i++){
      const scope={...plan.scope,researchProjectId:i===0?ids.project:plan.project.id};
      const input={taskType:'custom',name:plan.taskNames[i],assigneeAccountId:i===0?ids.owner:ids.admin,dueAt:'2026-11-13T15:59:59.999Z'};
      const task=await service.executeHubTaskCommandInTransaction(db,principal,scope,{action:'create',input});
      taskIds.push(task.id);
      const operationId=randomUUID(),requestKey=plan.runId+'-fixture-'+i;
      const receipt={operationId,taskId:task.id,version:task.version};
      await db.$executeRaw`INSERT INTO rh_study_tasks.operation(id,tenant_id,study_group_id,research_project_id,actor_account_id,request_key,request_hash,action,task_id,result_version,receipt)
        VALUES(${operationId},${scope.tenantId},${scope.studyGroupId},${scope.researchProjectId},${ids.admin},${requestKey},${digest(input)},'create',${task.id},${task.version},${JSON.stringify(receipt)}::jsonb)`;
    }
    assert.deepEqual(await db.permissionRole.findUnique({where:{id:plan.originalRoleId}}),sourceRole,'S08_ORIGINAL_ROLE_CHANGED');
    assert.equal(digest(await db.studyTask.findMany({where:{id:{in:sourceTasks.map(t=>t.id)}},orderBy:{id:'asc'}})),digest(sourceTasks),'S08_OLD_TASK_CHANGED');
    await db.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,action:'researchhub_s08_fixture_enable',target:plan.runId,meta:{actorKind:'authorized_local_synthetic_fixture',approval:'user-confirmed-S08-plan-2026-11-02',scope:plan.scope,roleIds:plan.roles.map(r=>r.id),studyId:plan.project.id,taskIds}}});
    const manifest={purpose,syntheticOnly:true,plan,taskIds,initializedAt:new Date().toISOString(),baseline:before.preserved,originalRoleHash:digest(sourceRole)};
    await db.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${plan.runId},${JSON.stringify(manifest)}::jsonb)`;
    return {created:true,manifest,actual:await inspectExisting(db,manifest)};
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic','--approved-s08']);
    const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
    const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
    const result=await initializeStudyTaskFixture(env,ids);
    const output=root+'researchhub/.superpowers/sdd/implementation-plan-study-tasks-s08-2026-11-02/fixture-'+result.manifest.plan.runId+'-'+randomUUID().slice(0,8)+'.json';
    writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
    console.log(JSON.stringify({passed:true,created:result.created,runId:result.manifest.plan.runId,tasks:result.actual.tasksCreated,roleIds:result.actual.roleIds,auxiliaryStudy:result.actual.projectId,evidence:output}));
  }catch(error){console.error(JSON.stringify({passed:false,code:/^(?:S08_|WP01_)/.test(error.message)?error.message:'S08_FIXTURE_UNAVAILABLE'}));process.exitCode=1;}
}
