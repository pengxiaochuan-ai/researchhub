import {readWp02Config} from '../server/wp02/config.mjs';
import {startCapture} from '../server/wp02/capture.mjs';
import {createAccountMailer} from '../server/wp02/mailer.mjs';
import {createWp02Repository} from '../server/wp02/repository.mjs';
import {createAccountAccess} from '../server/wp02/account-service.mjs';
import {createWp02Controllers} from '../server/wp02/controllers.mjs';
import {createMemberInvitations} from '../server/wp02/invitation-service.mjs';
import {createInvitationRouter} from '../server/wp02/invitation-router.mjs';
import {existsSync,readFileSync} from 'node:fs';
import {createLocalGovernanceUsers} from './local-governance-users.mjs';
import {assetMemberInvitationTarget,assetMemberRoleAllowed,ASSET_MEMBER_ROLE} from '../server/research-assets/member-local-invitation.mjs';

export async function createLocalAccounts({root,ids,prisma,load,require,secret,env,admission}){
 if(typeof admission?.registerInTransaction!=='function')throw Error('WP02_REGISTRATION_ADMISSION_REQUIRED');
 const config=readWp02Config({file:root+'researchhub/.env.smtp.local',approvedMode:'capture'});
 const capture=await startCapture(config,{dir:root+'.tmp/researchhub-wp02/mail/'});
 try{
  const db=createWp02Repository({tenantId:ids.tenant,transact:fn=>prisma.elevated.$transaction(fn),lockAuthorization:load('common/worker-publication','lockAuthorizationMutation')});
  const mailer=createAccountMailer(config,{receipt:id=>capture.receipt(id)});
  const accounts=createAccountAccess({config,db,mailer,bcrypt:require('bcryptjs'),secret,registerAdmissionInTransaction:admission.registerInTransaction});
  const paths=[root+'.tmp/researchhub-wp02/invitation-fixture.json',root+'.tmp/researchhub-real-entry/invitation-fixture.json'];
  const targets=paths.filter(existsSync).map(path=>JSON.parse(readFileSync(path,'utf8')));
  if(!targets.length||targets.some(target=>target.tenantId!==ids.tenant||target.inviterId!==ids.admin))throw new Error('WP02_INVITATION_SCOPE_REJECTED');
  const governance=createLocalGovernanceUsers({root,ids,env,load,require});
  const invitations=createInvitationRouter({tenantId:ids.tenant,db,targets,resolveInvitationTarget:row=>assetMemberInvitationTarget(ids,row),makeService:target=>createMemberInvitations({db,mailer,secret,target,config,allowTenantAdmin:true,...(target.readerRoleId===ASSET_MEMBER_ROLE?{readerRoleAllowed:assetMemberRoleAllowed,targetRoleName:'科研资产成员'}:{})}),resolveTarget:async(groupId,projectId)=>{
   if(!/^[A-Za-z0-9_-]{1,160}$/.test(groupId??'')||!/^[A-Za-z0-9_-]{1,160}$/.test(projectId??''))return null;
   const valid=await db.transaction(async tx=>{const group=await tx.studyGroup.findFirst({where:{id:groupId,tenantId:ids.tenant,status:'active'},select:{id:true}}),project=await tx.researchProject.findFirst({where:{id:projectId,tenantId:ids.tenant,studyGroupId:groupId,status:'active'},select:{id:true}});return Boolean(group&&project);});
   return valid?{tenantId:ids.tenant,groupId,projectId,readerRoleId:governance.fixture.readerRoleId}:null;
  }});
  return{Controllers:[...createWp02Controllers({require,load,accounts,invitations}),governance.Controller],close:()=>capture.close(),credentialsPath:capture.credentialsPath,captureReceipt:id=>capture.receipt(id)};
 }catch(e){await capture.close();throw e;}
}
