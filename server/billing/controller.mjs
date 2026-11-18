import {assertSessionOrigin} from '../auth/session.mjs';
export function createHubBillingController({require,origin,service}){
 const {Controller,Get,Post,Req,Res,Body,Param,Query,HttpException,HttpCode}=require('@nestjs/common');
 class HubBillingController{}
 Controller('hub-billing')(HubBillingController);
 for(const[name,verb,path]of [['me',Get,'me'],['list',Get,'reconciliations'],['detail',Get,'reconciliations/:id'],['resolve',Post,'reconciliations/:id/resolve']]){
  HubBillingController.prototype[name]=async function(req,res,body,params,query){
   res.setHeader('Cache-Control','no-store');
   try{
    if(name==='resolve'){
     assertSessionOrigin(req,origin);
     if(Buffer.byteLength(JSON.stringify(body??null),'utf8')>4096)throw Object.assign(Error('提交内容过长，请重新核对。'),{status:413,code:'HUB_TOKEN_INPUT_TOO_LARGE'});
     return await service.resolve(req.user,params.id,body);
    }
    if(name==='me')return await service.me(req.user);
    if(name==='list')return await service.list(req.user,query);
    return await service.detail(req.user,params.id);
   }catch(e){
    if(e instanceof HttpException)throw e;
    if(Number.isInteger(e.status)&&e.status>=400&&e.status<500)throw new HttpException({code:e.code??'HUB_TOKEN_REJECTED',message:e.message},e.status);
    throw new HttpException({code:'HUB_TOKEN_UNAVAILABLE',message:'用量服务暂时不可用，请保留当前记录并重试。'},503);
   }
  };
  const d=Object.getOwnPropertyDescriptor(HubBillingController.prototype,name);verb(path)(HubBillingController.prototype,name,d);if(name==='resolve')HttpCode(200)(HubBillingController.prototype,name,d);
  [Req(),Res({passthrough:true}),Body(),Param(),Query()].forEach((decorator,i)=>decorator(HubBillingController.prototype,name,i));
 }
 return HubBillingController;
}
