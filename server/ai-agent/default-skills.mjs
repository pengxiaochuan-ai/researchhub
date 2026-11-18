import {assertApprovedInTransaction} from '../admission/service.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {SKILL_DEFINITIONS} from './skill-catalog.mjs';

export const DEFAULT_SKILL_POLICY='hub-medical-defaults.v1';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const identity=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);

function release(skill,tenantId,agentId){
 const id='hub-skill-'+createHash('sha256').update([tenantId,agentId,skill.key,'1'].join(':')).digest('hex').slice(0,32);
 return{id,tenantId,key:skill.key,name:skill.name,kind:'literature',version:1,
  intent:`${skill.name}。根据当前医疗科研任务按需执行；只使用当前授权资料，原文事实与AI解释分开，缺失信息不编造。科研数值计算交给确定性程序。能力不可用必须明确阻断或如实说明实际范围。`,
  backend:{engine:'hub-opencode',adapter:DEFAULT_SKILL_POLICY,sourceSnapshotHash:skill.snapshotHash,sourcePath:skill.sourcePath,runtimeState:'pending-runtime'},
  ioContract:{task:'current-authorized-conversation',sources:'version-bound',output:'hub-conversation-or-owned-draft',requiredTools:skill.requiredTools},
  rules:{policy:DEFAULT_SKILL_POLICY,scope:'hub-agent',sourceRights:skill.rights.status,adaptation:skill.adaptation,numericalComputation:'deterministic'},
  onViolation:{authorization:'stop',sourceVersion:'stop',runtimeUnavailable:'stop',unknownFacts:'mark-missing'},
 };
}

// The transaction and existing authorization lock are supplied by the Hub deployment.
// No registration hook or shared-kernel change is necessary: '*' also covers future accounts.
export function createHubDefaultSkills({scope,tenantId,agentId,catalog,transaction,lockAuthorization,resolveEffectiveSkillCatalog}){
 if(scope?.product!=='researchhub'||!scope.allowedTenantIds?.includes(tenantId)||!identity(tenantId)||!identity(agentId))fail('HUB_SKILL_DEPLOYMENT_REQUIRED');
 const keys=new Set(SKILL_DEFINITIONS.map(s=>s.key));
 if(catalog?.skills?.length!==9||new Set(catalog.skills.map(s=>s.key)).size!==9||catalog.skills.some(s=>!keys.has(s.key)||!/^[a-f0-9]{64}$/.test(s.snapshotHash)))fail('HUB_SKILL_CATALOG_INVALID');
 if([transaction,lockAuthorization,resolveEffectiveSkillCatalog].some(fn=>typeof fn!=='function'))fail('HUB_SKILL_DEPENDENCIES_REQUIRED');
 const releases=catalog.skills.map(s=>release(s,tenantId,agentId));
 async function authorized(tx,user,admin=false){
  if(!user||user.tenantId!==tenantId||!identity(user.accountId))fail('HUB_SKILL_ACCESS_DENIED');
  const [tenant,agent,account]=await Promise.all([
   tx.tenant.findFirst({where:{id:tenantId,status:'active'}}),
   tx.agent.findFirst({where:{id:agentId,tenantId,type:'research',status:'active'}}),
   tx.account.findFirst({where:{id:user.accountId,tenantId,status:'active'}}),
  ]);
  if(!tenant||tenant.status!=='active'||!agent||agent.status!=='active'||!account||account.status!=='active'||account.authVersion!==user.authVersion)fail('HUB_SKILL_ACCESS_DENIED');
  if(admin&&(account.role!=='tenant_admin'||account.isTenantAdmin!==true))fail('HUB_SKILL_ADMIN_REQUIRED');
  await assertApprovedInTransaction(tx,user);
  return account;
 }
 function assertRelease(actual,expected){
  if(actual.status!=='published'||!actual.reviewedBy||Object.entries(expected).some(([key,value])=>!isDeepStrictEqual(actual[key],value)))fail('HUB_SKILL_RELEASE_CHANGED');
 }
 async function listInTransaction(tx,user){
  await lockAuthorization(tx,tenantId);await authorized(tx,user);
  const assignments=await tx.skillAssignment.findMany({where:{tenantId,agentId,scopeKey:{in:['*',user.accountId]},skill:{status:'published'}},include:{skill:true}});
  const current=assignments.filter(row=>releases.some(expected=>expected.id===row.skillId));
  for(const row of current)assertRelease(row.skill,releases.find(s=>s.id===row.skillId));
  return{policy:DEFAULT_SKILL_POLICY,items:resolveEffectiveSkillCatalog(current,user.accountId).map(({id,key,name,kind,version})=>({id,key,name,kind,version,equipped:true,executionReady:false})),defaultCount:9};
 }
 return{
  listInTransaction,
  async install(user){return transaction(async tx=>{
   await lockAuthorization(tx,tenantId);await authorized(tx,user,true);
   let created=0,equipped=0;
   for(const expected of releases){
    let skill=await tx.skill.findFirst({where:{tenantId,key:expected.key,version:1}});
    if(skill)assertRelease(skill,expected);
    else{
     skill=await tx.skill.create({data:{...expected,status:'published',author:user.accountId,reviewedBy:user.accountId}});created++;
     await tx.auditLog.createMany({data:{tenantId,accountId:user.accountId,action:'publish_skill',target:skill.id,meta:{policy:DEFAULT_SKILL_POLICY,approval:'2026-11-07-user-hub-all-account-defaults',runtimeReady:false,sourceSnapshotHash:expected.backend.sourceSnapshotHash}}});
    }
    const prior=await tx.skillAssignment.findFirst({where:{tenantId,agentId,skillId:skill.id,scopeKey:'*'}});
    if(prior){if(prior.accountId!==null)fail('HUB_SKILL_DEFAULT_SCOPE_INVALID');}
    else{
     await tx.skillAssignment.create({data:{id:randomUUID(),tenantId,agentId,skillId:skill.id,accountId:null,scopeKey:'*',enabled:true}});equipped++;
     await tx.auditLog.createMany({data:{tenantId,accountId:user.accountId,action:'assign_skill',target:agentId+':'+skill.id,meta:{policy:DEFAULT_SKILL_POLICY,scope:'tenant-agent-default',futureAccountsIncluded:true}}});
    }
   }
   return{policy:DEFAULT_SKILL_POLICY,created,equipped,defaultCount:9,executionReady:false};
  });},
  list:user=>transaction(tx=>listInTransaction(tx,user)),
 };
}
