import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Read-only admission policy. It does not grant roles or enable a feature.
const taskPermissions=['study.configure','study.execute','study.review'];
export function evaluateStudyTaskAdmission(s) {
  if(s?.databaseName!=='wp01_test_full_baseline'||s.syntheticOnly!==true)throw new Error('S08_TARGET_REJECTED');
  if(!s.scope?.tenantId||!s.scope.studyGroupId||!s.scope.researchProjectId||!s.ids?.owner||!s.ids.admin||s.ids.owner===s.ids.admin)throw new Error('S08_SCOPE_REJECTED');
  for(const id of [s.ids.owner,s.ids.admin]){
    const rows=s.accounts.filter(a=>a.id===id);
    if(rows.length!==1||rows[0].tenantId!==s.scope.tenantId||rows[0].status!=='active')throw new Error('S08_ACCOUNT_REJECTED');
  }
  const outsideWriteGains=[];
  for(const project of s.projectMemberships){
    if(project.accountId!==s.ids.owner||project.researchProjectId===s.scope.researchProjectId||project.status!=='active'||project.researchProject?.status!=='active')continue;
    const member=s.groupMemberships.find(g=>g.accountId===project.accountId&&g.studyGroupId===project.studyGroupId&&g.status==='active'&&g.studyGroup?.status==='active'&&g.role?.status==='active');
    if(!member?.role.menuPermissions.includes('workbench'))continue;
    const before=new Set(member.role.buttonPermissions);
    const after=new Set(before);
    if(project.studyGroupId===s.scope.studyGroupId)for(const permission of taskPermissions)after.add(permission);
    const gains=taskPermissions.filter(permission=>after.has(permission)&&(!s.featureEnabled||!before.has(permission))&&(permission==='study.execute'||project.roleKey==='project_manager'));
    if(gains.length)outsideWriteGains.push({accountId:project.accountId,researchProjectId:project.researchProjectId,permissions:gains});
  }
  outsideWriteGains.sort((a,b)=>a.researchProjectId.localeCompare(b.researchProjectId));
  return {allowed:outsideWriteGains.length===0,outsideWriteGains};
}

const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const root=fileURLToPath(new URL('../../',import.meta.url));
const expected={tenant:'rh-kb-local-b0e2af9d-tenant',group:'rh-kb-local-b0e2af9d-group',project:'rh-kb-local-b0e2af9d-project',owner:'rh-kb-local-b0e2af9d-owner',admin:'rh-kb-local-b0e2af9d-admin'};

export async function inspectStudyTaskAdmission(env,ids) {
  const {assertFixtureTarget,withFixtureTransaction,validateFixtureConfig}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
  if(validateFixtureConfig(env).databaseName!=='wp01_test_full_baseline')throw new Error('S08_TARGET_REJECTED');
  for(const [key,value] of Object.entries(expected))assert.equal(ids[key],value,'S08_SCOPE_REJECTED');
  const target=await assertFixtureTarget(env);
  const assembly=readFileSync(new URL('./local-knowledge.mjs',import.meta.url),'utf8');
  const controllers=assembly.match(/Module\(\{controllers:\[([\s\S]*?)\],providers:/)?.[1];
  if(!controllers)throw new Error('S08_ASSEMBLY_UNKNOWN');
  const scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project};
  return withFixtureTransaction(env,'direct',async db=>{
    const readOnly=await db.$queryRaw`SHOW transaction_read_only`;
    assert.equal(readOnly[0].transaction_read_only,'on','S08_READ_ONLY_REQUIRED');
    const accounts=await db.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.owner,ids.admin]}},select:{id:true,tenantId:true,role:true,status:true,isTenantAdmin:true,authVersion:true},orderBy:{id:'asc'}});
    const groupMemberships=await db.studyGroupMembership.findMany({where:{tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]}},include:{studyGroup:{select:{id:true,status:true}},role:{select:{id:true,tenantId:true,key:true,name:true,dataScope:true,status:true,menuPermissions:true,buttonPermissions:true}}},orderBy:{id:'asc'}});
    const projectMemberships=await db.researchProjectMembership.findMany({where:{tenantId:ids.tenant,accountId:{in:[ids.owner,ids.admin]}},include:{researchProject:{select:{id:true,name:true,status:true}}},orderBy:{id:'asc'}});
    const feature=await db.tenantFeatureEntitlement.findFirst({where:{tenantId:ids.tenant,featureKey:'study_operations'},select:{id:true,enabled:true}});
    assert.equal(await db.tenant.count({where:{id:ids.tenant,status:'active'}}),1,'S08_TENANT_REJECTED');
    assert.equal(await db.researchProject.count({where:{id:ids.project,tenantId:ids.tenant,studyGroupId:ids.group,status:'active'}}),1,'S08_PROJECT_REJECTED');
    const snapshot={databaseName:target.databaseName,syntheticOnly:true,scope,ids:{owner:ids.owner,admin:ids.admin},accounts,groupMemberships,projectMemberships,featureEnabled:feature?.enabled===true};
    const assessment=evaluateStudyTaskAdmission(snapshot);
    const preserved={};
    for(const model of ['researchArtifact','researchArtifactVersion','researchArtifactSource','studyTask']){
      const rows=await db[model].findMany({where:scope,orderBy:{id:'asc'}});
      preserved[model]={count:rows.length,sha256:hash(rows)};
    }
    const roles=await db.permissionRole.findMany({where:{tenantId:ids.tenant},orderBy:{id:'asc'}});
    preserved.authorizationSha256=hash({accounts,groupMemberships,projectMemberships,roles,feature});
    preserved.aiBudgetSha256=hash(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json','utf8'));
    return {checkedAt:new Date().toISOString(),readOnly:true,snapshot,assessment,preserved,
      assembly:{path:'scripts/local-knowledge.mjs',sha256:hash(assembly),controllers,sourceAuditOnly:true},
      newFixtureBudget:{maxTasks:8,maxAuxiliaryStudies:1,maxRoles:2,createdTasks:0,createdStudies:0,createdRoles:0},
      newModelCalls:0,authorizationWrites:0};
  },{readOnly:true});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic'],'S08_ARGUMENTS_REJECTED');
    const {loadFixtureInput}=await import('../../app/server/scripts/wp01/local-config.mjs');
    const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
    const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
    const result=await inspectStudyTaskAdmission(env,ids);
    const dir=root+'researchhub/.superpowers/sdd/implementation-plan-study-tasks-s08-2026-11-02/';
    mkdirSync(dir,{recursive:true,mode:0o700});
    const evidence=dir+'preflight-'+randomUUID()+'.json';
    writeFileSync(evidence,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
    console.log(JSON.stringify({allowed:result.assessment.allowed,outsideWriteGains:result.assessment.outsideWriteGains,database:result.snapshot.databaseName,accounts:result.snapshot.accounts,projectMembershipCount:result.snapshot.projectMemberships.length,readOnly:true,authorizationWrites:0,newModelCalls:0,evidence}));
    if(!result.assessment.allowed)process.exitCode=2;
  }catch(error){console.error(JSON.stringify({allowed:false,code:/^(?:S08_|WP01_)/.test(error.message)?error.message:'S08_PREFLIGHT_UNAVAILABLE'}));process.exitCode=1;}
}
