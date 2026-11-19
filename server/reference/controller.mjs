import {assertVerifiedRuntimeSchema} from '../database/transactions.mjs';
import {withFixtureTransaction} from '../database/transactions.mjs';
import {listDivisions,referenceError} from './divisions.mjs';
import {validateDirectoryRequest,directoryQuery} from '../directory/controller.mjs';
export async function createReferenceController({env,require,runtimePolicy}){
 if(runtimePolicy)assertVerifiedRuntimeSchema(env);
 if(!runtimePolicy){const{inspectReferenceSchema}=await import('../../scripts/reference-divisions-schema.mjs');if(await inspectReferenceSchema(env)!=='existing')throw Error('REFERENCE_SCHEMA_REQUIRED');}
 const {Controller,Get,Req,Res,HttpException}=require('@nestjs/common');
 class ReferenceController{async divisions(req,res){
  res.setHeader('Cache-Control','no-store');try{validateDirectoryRequest(req,undefined,{runtimePolicy});if(!req.user?.accountId)throw referenceError('UNAUTHORIZED',401);const q=directoryQuery(req,['parentCode']);return await withFixtureTransaction(env,'app',tx=>listDivisions(tx,q.parentCode),{readOnly:true});}
  catch(e){throw new HttpException({code:e.code??'REFERENCE_UNAVAILABLE',message:e.status===400?e.message:e.status===401?'请先登录。':'省市字典暂不可用，请保留输入后重试。'},e.status??503);}
 }}
 Controller('reference')(ReferenceController);const p=ReferenceController.prototype,d=Object.getOwnPropertyDescriptor(p,'divisions');Get('administrative-divisions')(p,'divisions',d);Req()(p,'divisions',0);Res({passthrough:true})(p,'divisions',1);return ReferenceController;
}
