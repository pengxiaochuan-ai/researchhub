import {submitWithAccountReceipt} from './account-receipt.mjs';
import {setContext} from '../research-studies/repository.mjs';
const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code});};
export function advanceSessionVersion(version){
 if(!Number.isInteger(version)||version<0||version>=2147483647)fail(409,'HUB_ACCOUNT_VERSION_EXHAUSTED','账号会话版本无法更新，请联系维护人员核对。');
 return version+1;
}
export function validateStatusTransition({actor,principal,target,input,activeAdmins}){
 if(!actor||actor.id!==principal.accountId||actor.tenantId!==principal.tenantId||actor.status!=='active'||actor.role!=='tenant_admin'||actor.isTenantAdmin!==true||actor.authVersion!==principal.authVersion)
  fail(403,'HUB_ACCOUNT_ADMIN_REQUIRED','当前账号无权管理本租户账号。');
 if(!target||target.tenantId!==principal.tenantId)fail(404,'HUB_ACCOUNT_NOT_FOUND','账号不存在或当前身份无权访问。');
 if(target.role==='platform_admin')fail(403,'HUB_ACCOUNT_PLATFORM_PROTECTED','平台账号不能在此维护。');
 if(input.status==='disabled'&&target.id===actor.id)fail(409,'HUB_ACCOUNT_SELF_PROTECTED','不能停用当前登录账号。');
 if(input.status==='disabled'&&target.role==='tenant_admin'&&target.isTenantAdmin&&target.status==='active'&&activeAdmins<=1)
  fail(409,'HUB_ACCOUNT_LAST_ADMIN','请保留至少一位有效租户管理员。');
 if(target.status===input.status)fail(409,'HUB_ACCOUNT_STATUS_UNCHANGED','账号状态已经变化，请刷新核对。');
 if(!['active','disabled'].includes(target.status))fail(409,'HUB_ACCOUNT_STATE_REJECTED','当前账号状态不支持此操作。');
 advanceSessionVersion(target.authVersion);
}

// Internal only. The supplied inspector must cover all target-owned execution
// types in the deployment; omission or failure may not be interpreted as clear.
export async function changeAccountStatus({db,principal,input,legacyUpdate,inspectBlockers}){
 if(typeof inspectBlockers!=='function'||typeof legacyUpdate!=='function')throw Error('HUB_ACCOUNT_GUARDS_REQUIRED');
 await setContext(db,principal);
 return submitWithAccountReceipt({db,principal,input},async bound=>{
  // The receipt reader already holds the common official/tenant authorization
  // locks. Refresh actual rows after waiting, not from req.user role claims.
  const [actor,target,tenant,activeAdmins]=await Promise.all([
   db.account.findFirst({where:{id:principal.accountId,tenantId:principal.tenantId}}),
   db.account.findFirst({where:{id:input.targetAccountId,tenantId:principal.tenantId}}),
   db.tenant.findFirst({where:{id:principal.tenantId,status:'active'},select:{id:true}}),
   db.account.count({where:{tenantId:principal.tenantId,status:'active',role:'tenant_admin',isTenantAdmin:true}}),
  ]);
  if(!tenant)fail(403,'HUB_ACCOUNT_ADMIN_REQUIRED','当前租户不可用。');
  validateStatusTransition({actor,principal,target,input,activeAdmins});
  if(input.status==='disabled'){
   const blockers=await inspectBlockers(db,principal,target);
   if(!Array.isArray(blockers))throw Error('HUB_ACCOUNT_BLOCKERS_UNAVAILABLE');
   if(blockers.length)fail(409,'HUB_ACCOUNT_DISABLE_BLOCKED',blockers.join('；'));
  }
  await setContext(db,principal);
  // Version is written before the legacy audit captures the real result. All
  // three changes (version, legacy status/refund, receipt) share this same tx.
  const updated=await db.account.updateMany({where:{id:target.id,tenantId:principal.tenantId,status:target.status,authVersion:target.authVersion,updatedAt:new Date(input.expectedVersion)},data:{authVersion:advanceSessionVersion(target.authVersion)}});
  if(updated.count!==1)fail(409,'HUB_ACCOUNT_VERSION_CONFLICT','账号资料已变化，请刷新核对后重试。');
  await legacyUpdate(bound,{...principal,role:actor.role,isTenantAdmin:actor.isTenantAdmin},target.id,{status:input.status});
 });
}
