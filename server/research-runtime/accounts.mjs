import{isAbsolute}from'node:path';
import{withDeploymentTransaction}from'../database/transactions.mjs';
import{startCapture}from'../wp02/capture.mjs';
import{createAccountMailer}from'../wp02/mailer.mjs';
import{createWp02Repository}from'../wp02/repository.mjs';
import{createAccountAccess}from'../wp02/account-service.mjs';
import{createMemberInvitations}from'../wp02/invitation-service.mjs';
import{createInvitationRouter}from'../wp02/invitation-router.mjs';
import{createWp02Controllers}from'../wp02/controllers.mjs';
export const runtimeReaderRoleAllowed=role=>role?.dataScope==='group'&&Array.isArray(role.menuPermissions)&&role.menuPermissions.every(k=>['workbench','knowledge','artifacts'].includes(k))&&Array.isArray(role.buttonPermissions)&&role.buttonPermissions.every(k=>k==='artifact.read');
const mailUnavailable=()=>{throw Object.assign(Error('邮件服务尚未启用，请稍后重试或联系管理员。'),{status:503,code:'HUB_MAIL_NOT_CONFIGURED'});};
export function disabledMailAccounts(accounts){
 return {...accounts,requestRegistration:mailUnavailable,requestReset:mailUnavailable,confirmRegistration:mailUnavailable,confirmReset:mailUnavailable};
}
export const disabledMailInvitations=()=>Object.fromEntries(['context','list','issue','revoke','resend','preview','accept'].map(key=>[key,mailUnavailable]));
export function runtimeCaptureSettings(env,origin){
 if(env.HUB_MAIL_MODE!=='capture'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)||!isAbsolute(env.HUB_MAIL_DATA_DIR??''))throw Error('RESEARCH_RUNTIME_CAPTURE_CONFIGURATION_REQUIRED');
 for(const key of ['HUB_CAPTURE_SMTP_PORT','HUB_CAPTURE_INBOX_PORT'])if(!/^\d+$/.test(env[key]??'')||Number(env[key])<19650||Number(env[key])>19750)throw Error('RESEARCH_RUNTIME_CAPTURE_CONFIGURATION_REQUIRED');
 if(env.HUB_CAPTURE_SMTP_PORT===env.HUB_CAPTURE_INBOX_PORT)throw Error('RESEARCH_RUNTIME_CAPTURE_CONFIGURATION_REQUIRED');
 return Object.freeze({mode:'capture',baseUrl:origin,from:'researchhub@example.test',smtpHost:'127.0.0.1',smtpPort:Number(env.HUB_CAPTURE_SMTP_PORT),inboxHost:'127.0.0.1',inboxPort:Number(env.HUB_CAPTURE_INBOX_PORT)});
}
export async function createRuntimeAccounts({env,config,transactionEnv,runtimePolicy,admission,require,load}){
 const tenantId=config.scope.defaultTenantId;
 if(!['capture','disabled'].includes(env.HUB_MAIL_MODE))throw Error('RESEARCH_RUNTIME_MAIL_MODE_REQUIRED');
 const lock=load('common/worker-publication','lockAuthorizationMutation');
 const db=createWp02Repository({tenantId,transact:fn=>withDeploymentTransaction(transactionEnv,'direct',fn),lockAuthorization:(tx,t)=>lock(tx,t,{includeOfficial:true})});
 if(env.HUB_MAIL_MODE==='disabled'){
  const service=createAccountAccess({config:{baseUrl:config.origin},db,mailer:{send:mailUnavailable},bcrypt:require('bcryptjs'),secret:config.jwtSecret,registerAdmissionInTransaction:admission.registerInTransaction});
  return{Controllers:createWp02Controllers({require,load,accounts:disabledMailAccounts(service),invitations:disabledMailInvitations(),origin:config.origin,apiHost:env.HUB_API_AUTHORITY,runtimePolicy}),close:async()=>{}};
 }
 const settings=runtimeCaptureSettings(env,config.origin);
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(env.HUB_INVITATION_READER_ROLE_ID??''))throw Error('RESEARCH_RUNTIME_INVITATION_ROLE_REQUIRED');
 const capture=await startCapture(settings,{dir:env.HUB_MAIL_DATA_DIR});
 try{
  const mailer=createAccountMailer(settings,{receipt:id=>capture.receipt(id)}),accounts=createAccountAccess({config:settings,db,mailer,bcrypt:require('bcryptjs'),secret:config.jwtSecret,registerAdmissionInTransaction:admission.registerInTransaction});
  const resolveTarget=async(groupId,projectId)=>{
   if(![groupId,projectId].every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x)))return null;
   return db.transaction(async tx=>{
    const group=await tx.studyGroup.findFirst({where:{id:groupId,tenantId,status:'active'},select:{id:true}}),project=await tx.researchProject.findFirst({where:{id:projectId,tenantId,studyGroupId:groupId,status:'active'},select:{id:true}}),role=await tx.permissionRole.findFirst({where:{id:env.HUB_INVITATION_READER_ROLE_ID,tenantId,status:'active'}});
    return group&&project&&runtimeReaderRoleAllowed(role)?{tenantId,groupId,projectId,readerRoleId:role.id}:null;
   });
  };
  const invitations=createInvitationRouter({tenantId,db,targets:[],resolveTarget,resolveInvitationTarget:async row=>{const target=await resolveTarget(row.studyGroupId,row.researchProjectId);return target?.readerRoleId===row.targetRoleId?target:null;},makeService:target=>createMemberInvitations({db,mailer,secret:config.jwtSecret,target,config:settings,allowTenantAdmin:true,readerRoleAllowed:runtimeReaderRoleAllowed})});
  return{Controllers:createWp02Controllers({require,load,accounts,invitations,origin:config.origin,apiHost:env.HUB_API_AUTHORITY,runtimePolicy}),close:()=>capture.close()};
 }catch(error){await capture.close();throw error;}
}
