import assert from 'node:assert/strict';
import {edcDigest} from './synthetic-edc-contract.mjs';
import {applicabilityId} from './asset-applicability-scope.mjs';
export const APPLICABILITY_ACCESS_ACTION='researchhub_applicability_access_registered';
export function applicabilityAccessRegistration(ids){
 const policy={schema:'rh-applicability-current-access.v1',mode:'current_permissions',tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accounts:[ids.owner,ids.admin],operations:['U01','U02','U03']};
 return{...policy,policyHash:edcDigest(policy)};
}
export function createApplicabilityCurrentAccess(ids){
 const registration=applicabilityAccessRegistration(ids),deny=()=>assert.fail('APPLICABILITY_ACCESS_RESTRICTED');
 function purpose(user,operation='U01',pair){
  if(!user||user.tenantId!==ids.tenant||user.studyGroupId!==ids.group||user.researchProjectId!==ids.project||!registration.accounts.includes(user.accountId)||!registration.operations.includes(operation))deny();
  if(pair&&(!pair||Object.keys(pair).length!==3||!['accountId','assetId','targetPlanId'].every(k=>applicabilityId(pair[k]))||pair.accountId!==user.accountId||pair.assetId===pair.targetPlanId))deny();
  return registration;
 }
 async function authorized(tx,user,operation='U01',pair){
  purpose(user,operation,pair);
  if(!Number.isSafeInteger(user.authVersion)||user.authVersion<0)deny();
  const [account,member,project,membership,event]=await Promise.all([
   tx.account.findFirst({where:{id:user.accountId,tenantId:ids.tenant,status:'active',authVersion:user.authVersion,tenant:{status:'active'}},select:{id:true}}),
   tx.studyGroupMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:user.accountId,status:'active',studyGroup:{tenantId:ids.tenant,status:'active'},role:{tenantId:ids.tenant,status:'active'}},include:{role:true}}),
   tx.researchProject.findFirst({where:{id:ids.project,tenantId:ids.tenant,studyGroupId:ids.group,status:'active'},select:{id:true}}),
   tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:user.accountId,status:'active'},select:{id:true}}),
   tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:APPLICABILITY_ACCESS_ACTION,target:ids.project,meta:{path:['policyHash'],equals:registration.policyHash}},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{meta:true}}),
  ]);
  const role=member?.role,permissions=role?.buttonPermissions;
  if(!account||!project||!membership||!role||role.tenantId!==ids.tenant||role.status!=='active'||!['knowledge','workbench','artifacts'].every(k=>role.menuPermissions?.includes(k))||!['artifact.read','chat.use'].every(k=>permissions?.includes(k))||!event||edcDigest(event.meta)!==edcDigest(registration))deny();
  const operations=['U01',...(permissions.includes('artifact.edit')?['U02','U03']:[])];
  if(!operations.includes(operation))deny();
  if(pair){
   const parents=await tx.researchArtifact.findMany({where:{id:{in:[pair.assetId,pair.targetPlanId]},tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:user.accountId,createdBy:user.accountId,status:'draft',deletedAt:null},select:{id:true},take:2});
   if(parents.length!==2||![pair.assetId,pair.targetPlanId].every(id=>parents.some(p=>p.id===id)))deny();
  }
  return{...registration,operations};
 }
 return{purpose,authorized,registration};
}
