import {createHash} from 'node:crypto';
import {catalogError} from './research-assets-catalog-contract.mjs';
const deny=(status=403)=>{throw catalogError('AUTHORIZATION_REVOKED',status,'当前身份或研究权限无法核对，请重新打开。');};
const includes=(values,key)=>Array.isArray(values)&&(values.includes(key)||values.includes('*'));

function assertScope(ids,user){
  if(user?.tenantId!==ids.tenant||user.studyGroupId!==ids.group||user.researchProjectId!==ids.project||![ids.owner,ids.admin].includes(user.accountId))deny();
  if(!Number.isSafeInteger(user.authVersion)||user.authVersion<0)deny(401);
}
/** Caller must already hold the same tenant/official authorization locks. Never opens a transaction. */
export async function authorizeCatalogScope({ids,tx,user,permission}){
   assertScope(ids,user);
   const account=await tx.account.findFirst({where:{id:user.accountId,tenantId:ids.tenant},include:{tenant:true}});
   if(!account||account.status!=='active'||account.tenant?.status!=='active'||account.authVersion!==user.authVersion||account.role!==user.role)deny(401);
   const project=await tx.researchProject.findFirst({where:{id:ids.project,tenantId:ids.tenant,studyGroupId:ids.group,status:'active',studyGroup:{tenantId:ids.tenant,status:'active'}}});
   if(!project)deny();
   const admin=account.role==='tenant_admin';let membership,member;
   if(!admin){
    membership=await tx.studyGroupMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:account.id,status:'active',role:{tenantId:ids.tenant,status:'active'}},include:{role:true}});
    member=await tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:account.id,status:'active'}});
    if(!membership||!member||!includes(membership.role?.menuPermissions,'artifacts')||!includes(membership.role?.buttonPermissions,'artifact.read')||!includes(membership.role?.buttonPermissions,permission))deny();
   }
   // Set the token version already compared to the current account; never replace a stale token's version.
   for(const [key,value]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project],['app.account_id',account.id],['app.auth_version',String(user.authVersion)]])await tx.$executeRawUnsafe('SELECT set_config($1,$2,true)',key,value);
   const identityRevision=createHash('sha256').update(JSON.stringify({accountId:account.id,role:account.role,authVersion:account.authVersion,project:project.id,membership,member})).digest('hex');
   return{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:account.id,displayName:account.displayName,role:account.role,authVersion:account.authVersion,isTenantAdmin:admin,permissions:admin?['artifact.read','artifact.create','artifact.edit','artifact.review','artifact.release','artifact.archive']:membership.role.buttonPermissions,projectName:project.name,identityRevision,catalogActors:{owner:ids.owner,admin:ids.admin}};
}
/** transaction MUST take the existing authorization lock and set tenant/Study scope. */
export function createCatalogAccess({ids,transaction}){
 if(typeof transaction!=='function')throw new TypeError('Current authorization transaction required');
 return async(user,permission,operation)=>{
  assertScope(ids,user);
  return transaction(user,async tx=>operation(tx,await authorizeCatalogScope({ids,tx,user,permission})));
 };
}
