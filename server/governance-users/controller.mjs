import {assertSessionOrigin} from '../auth/session.mjs';
export function createGovernanceUsersController({require,service,origin}){
 const {Controller,Get,Post,Req,Res,Body,Param,Query,HttpCode,HttpException}=require('@nestjs/common');
 class GovernanceUsersController{}
 Controller('governance-users')(GovernanceUsersController);
 for(const[name,verb,path]of [['accounts',Get,'accounts'],['detail',Get,'accounts/:id'],['receipt',Get,'account-receipts/:requestKey'],['studies',Get,'studies'],['memberReceipt',Get,'studies/:id/member-receipts/:requestKey'],['members',Get,'studies/:id/members'],['status',Post,'accounts/:id/status'],['changeMember',Post,'studies/:id/members/:accountId']]){
  GovernanceUsersController.prototype[name]=async function(req,res,body,params,query){
   res.setHeader('Cache-Control','no-store');
   try{
    if(verb===Post){assertSessionOrigin(req,origin);if(Buffer.byteLength(JSON.stringify(body??null))>4096)throw Object.assign(Error('提交内容过长，请核对后重试。'),{status:413,code:'HUB_USERS_INPUT_TOO_LARGE'});}
    if(name==='accounts')return await service.accounts(req.user,query);
    if(name==='detail')return await service.detail(req.user,params.id);
    if(name==='receipt')return await service.receipt(req.user,params.requestKey);
    if(name==='studies')return await service.studies(req.user);
    if(name==='memberReceipt')return await service.memberReceipt(req.user,query.studyGroupId,params.id,params.requestKey);
    if(name==='members'){if(Object.keys(query).some(k=>k!=='studyGroupId'))throw Object.assign(Error('查询条件无效。'),{status:400});return await service.members(req.user,query.studyGroupId,params.id);}
    if(!body||Array.isArray(body)||typeof body!=='object')throw Object.assign(Error('提交内容无效。'),{status:400});
    if(name==='status'){if(Object.keys(body).some(k=>!['status','expectedVersion','requestKey'].includes(k)))throw Object.assign(Error('提交字段无效。'),{status:400});return await service.status(req.user,{...body,targetAccountId:params.id});}
    const {studyGroupId,...input}=body;return await service.changeMember(req.user,studyGroupId,params.id,params.accountId,input);
   }catch(e){
    if(e instanceof HttpException)throw e;
    if(Number.isInteger(e.status)&&e.status>=400&&e.status<500)throw new HttpException({code:e.code??'HUB_USERS_REJECTED',message:e.message},e.status);
    throw new HttpException({code:'HUB_USERS_UNAVAILABLE',message:'资料暂时无法核对，请保留当前操作后重试。'},503);
   }
  };
  const p=GovernanceUsersController.prototype,d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);if(verb===Post)HttpCode(200)(p,name,d);
  [Req(),Res({passthrough:true}),Body(),Param(),Query()].forEach((f,i)=>f(p,name,i));
 }
 return GovernanceUsersController;
}
