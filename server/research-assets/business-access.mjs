// Business authorization only. The caller holds the existing tenant/official
// authorization lock; this module never opens a transaction or grants a role.
import{createHash}from'node:crypto';
import{catalogError}from'../../scripts/research-assets-catalog-contract.mjs';

const actions=new Set(['artifact.read','artifact.create','artifact.edit','artifact.review','artifact.release','artifact.archive']);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const allows=(values,key)=>Array.isArray(values)&&(values.includes(key)||values.includes('*'));
const deny=(status=403)=>{throw catalogError('AUTHORIZATION_REVOKED',status,'当前身份或研究权限无法核对，请重新读取。');};

export async function authorizeBusinessAssetStudy({tx,user,scope,permission}){
 if(!actions.has(permission))throw catalogError('INPUT_INVALID',400,'资产操作类型无效。');
 if(!id(user?.accountId)||!id(user?.tenantId)||!scope||!['tenantId','studyGroupId','researchProjectId'].every(k=>id(scope[k]))||scope.tenantId!==user.tenantId)deny();
 if(!Number.isSafeInteger(user.authVersion)||user.authVersion<0)deny(401);
 const boundScope={tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId};
 const account=await tx.account.findFirst({where:{id:user.accountId,tenantId:scope.tenantId},include:{tenant:true}});
 if(!account||account.id!==user.accountId||account.tenantId!==scope.tenantId||account.status!=='active'||account.tenant?.status!=='active'||account.authVersion!==user.authVersion||account.role!==user.role)deny(401);
 const project=await tx.researchProject.findFirst({where:{id:scope.researchProjectId,tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,status:'active',studyGroup:{tenantId:scope.tenantId,status:'active'}}});
 if(!project||project.id!==scope.researchProjectId)deny();
 const isTenantAdmin=account.role==='tenant_admin';let membership,member;
 if(!isTenantAdmin){
  membership=await tx.studyGroupMembership.findFirst({where:{tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,accountId:account.id,status:'active',role:{tenantId:scope.tenantId,status:'active'}},include:{role:true}});
  member=await tx.researchProjectMembership.findFirst({where:{tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,researchProjectId:scope.researchProjectId,accountId:account.id,status:'active'}});
  if(membership?.status!=='active'||membership.role?.status!=='active'||member?.status!=='active'||!allows(membership.role.menuPermissions,'artifacts')||!allows(membership.role.buttonPermissions,'artifact.read')||!allows(membership.role.buttonPermissions,permission))deny();
 }
 for(const[key,value]of [['app.tenant_id',scope.tenantId],['app.study_group_id',scope.studyGroupId],['app.research_project_id',scope.researchProjectId],['app.account_id',account.id],['app.auth_version',String(user.authVersion)]])await tx.$executeRawUnsafe('SELECT set_config($1,$2,true)',key,value);
 // Keep the existing current-authorization revision shared by A01 and A02.
 // Project IDs are globally unique and the full scope was checked above.
 const identityRevision=createHash('sha256').update(JSON.stringify({accountId:account.id,role:account.role,authVersion:account.authVersion,project:project.id,membership,member})).digest('hex');
 return{...boundScope,accountId:account.id,displayName:account.displayName,role:account.role,authVersion:account.authVersion,isTenantAdmin,permissions:isTenantAdmin?[...actions]:[...actions].filter(key=>allows(membership.role.buttonPermissions,key)),projectName:project.name,identityRevision};
}
