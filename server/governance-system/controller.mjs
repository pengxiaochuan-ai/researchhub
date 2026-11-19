import {withFixtureTransaction} from '../database/transactions.mjs';
import {createGovernanceSystem} from './service.mjs';
export function createGovernanceSystemController({env,ids,require,readState}){
 const {Controller,Get,Req,Res,Query,HttpException}=require('@nestjs/common');
 const service=createGovernanceSystem({tenantId:ids.tenant,readState,transact:cb=>withFixtureTransaction(env,'direct',cb,{readOnly:true})});
 class GovernanceSystemController{
  async status(req,res,query){
   res.setHeader('Cache-Control','private, no-store');
   try{return await service.status(req.user,query);}
   catch(e){throw new HttpException({code:e.status?e.code:'HUB_SYSTEM_UNAVAILABLE',message:e.status?e.message:'服务状态暂时无法读取，请重试。'},e.status??503);}
  }
 }
 Controller('governance-system')(GovernanceSystemController);
 const p=GovernanceSystemController.prototype;Get('status')(p,'status',Object.getOwnPropertyDescriptor(p,'status'));[Req(),Res({passthrough:true}),Query()].forEach((f,i)=>f(p,'status',i));
 return GovernanceSystemController;
}
