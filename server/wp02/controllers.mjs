import{assertDeploymentRequest}from'../http/deployment-request.mjs';
import {fault} from './policy.mjs';
import {assertSessionOrigin} from '../auth/session.mjs';
export function validateWp02Request(req,body,{sessionOrigin=false,origin='http://127.0.0.1:19501',apiHost='127.0.0.1:19502',runtimePolicy}={}){
 if(runtimePolicy){assertDeploymentRequest(req,runtimePolicy);if(body&&Buffer.byteLength(JSON.stringify(body))>16384)throw fault('WP02_REQUEST_TOO_LARGE','请求过大。',413);return{ip:req.socket?.remoteAddress??'unknown',user:req.user};}
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)||!/^127\.0\.0\.1:\d+$/.test(apiHost))throw Error('WP02_LOCAL_BINDING_REQUIRED');
 const h=req.headers,hosts=[new URL(origin).host,apiHost];
 if(!hosts.includes(h.host)||Object.keys(h).some(k=>['forwarded','x-forwarded-host','x-forwarded-proto'].includes(k)))throw fault('WP02_ORIGIN_REJECTED','请求来源不符合本机配置。',403);
 if(!['GET','HEAD'].includes(req.method)){if(sessionOrigin)assertSessionOrigin(req,origin);else if((h.origin!==origin)||!/^application\/json(?:\s*;.*)?$/i.test(h['content-type']??''))throw fault('WP02_ORIGIN_REJECTED','请求来源或格式无效。',403);}
 if(body&&Buffer.byteLength(JSON.stringify(body))>16384)throw fault('WP02_REQUEST_TOO_LARGE','请求过大。',413);
 const ip=req.socket?.remoteAddress;
 if(!['127.0.0.1','::ffff:127.0.0.1'].includes(ip))throw fault('WP02_LOCAL_ONLY','仅限本机合成环境。',403);
 return{ip,user:req.user};
}
export function createWp02Controllers({require,load,accounts,invitations,origin='http://127.0.0.1:19501',apiHost='127.0.0.1:19502',runtimePolicy}){
 const {Controller,Get,Post,Patch,Body,Req,HttpCode,HttpException}=require('@nestjs/common'),Public=load('common/decorators','Public');
 const invoke=async(req,body,method)=>{try{return await accounts[method](validateWp02Request(req,body,{origin,apiHost,runtimePolicy}),body);}catch(e){throw new HttpException({code:e.code??'WP02_UNAVAILABLE',message:e.status?e.message:'账户服务暂时不可用，请核对后重试。'},e.status??503);}};
 class AccountAccessController {
  register(req,b){return invoke(req,b,'requestRegistration');}confirmRegister(req,b){return invoke(req,b,'confirmRegistration');}
  reset(req,b){return invoke(req,b,'requestReset');}confirmReset(req,b){return invoke(req,b,'confirmReset');}
  profile(req){return invoke(req,undefined,'readProfile');}updateProfile(req,b){return invoke(req,b,'updateProfile');}
 }
 Controller('account-access')(AccountAccessController);
 for(const [method,verb,path,status,anonymous]of [['register',Post,'registrations',202,true],['confirmRegister',Post,'registration-confirmations',201,true],['reset',Post,'password-resets',202,true],['confirmReset',Post,'password-reset-confirmations',200,true],['profile',Get,'profile',200,false],['updateProfile',Patch,'profile',200,false]]){
  const descriptor=Object.getOwnPropertyDescriptor(AccountAccessController.prototype,method);
  verb(path)(AccountAccessController.prototype,method,descriptor);HttpCode(status)(AccountAccessController.prototype,method,descriptor);Req()(AccountAccessController.prototype,method,0);if(method!=='profile')Body()(AccountAccessController.prototype,method,1);if(anonymous)Public()(AccountAccessController.prototype,method,descriptor);
 }
 if(!invitations)return [AccountAccessController];
 const {Query,Param}=require('@nestjs/common');
 const inviteInvoke=async(req,input,method,id)=>{try{const ctx={...validateWp02Request(req,input,{sessionOrigin:true,origin,apiHost,runtimePolicy}),groupId:req.headers['x-study-group-id'],projectId:req.headers['x-research-project-id']};return await invitations[method](ctx,...(id?[id,input]:[input]));}catch(e){throw new HttpException({code:e.code??'WP02_INVITATION_UNAVAILABLE',message:e.status?e.message:'邀请服务暂时不可用，请刷新核对，不会自动重发。'},e.status??503);}};
 class MemberInvitationsController {
  context(req){return inviteInvoke(req,undefined,'context');}list(req,q){return inviteInvoke(req,q,'list');}issue(req,b){return inviteInvoke(req,b,'issue');}
  revoke(req,id,b){return inviteInvoke(req,b,'revoke',id);}resend(req,id,b){return inviteInvoke(req,b,'resend',id);}
 }
 Controller('member-invitations')(MemberInvitationsController);
 for(const [method,verb,path,status]of [['context',Get,'context',200],['list',Get,'',200],['issue',Post,'',201],['revoke',Post,':id/revocations',200],['resend',Post,':id/resends',200]]){
  const p=MemberInvitationsController.prototype,d=Object.getOwnPropertyDescriptor(p,method);verb(path)(p,method,d);HttpCode(status)(p,method,d);Req()(p,method,0);
  if(['revoke','resend'].includes(method)){Param('id')(p,method,1);Body()(p,method,2);}else if(method==='list')Query()(p,method,1);else if(method==='issue')Body()(p,method,1);
 }
 class MemberInvitationAcceptanceController {preview(req,b){return inviteInvoke(req,b,'preview');}accept(req,b){return inviteInvoke(req,b,'accept');}}
 Controller('')(MemberInvitationAcceptanceController);
 for(const [method,path]of [['preview','member-invitation-previews'],['accept','member-invitation-acceptances']]){const p=MemberInvitationAcceptanceController.prototype,d=Object.getOwnPropertyDescriptor(p,method);Post(path)(p,method,d);HttpCode(200)(p,method,d);Req()(p,method,0);Body()(p,method,1);}
 return [AccountAccessController,MemberInvitationsController,MemberInvitationAcceptanceController];
}
