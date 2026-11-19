import {assertVerifiedRuntimeSchema} from '../database/transactions.mjs';
import {assertDeploymentRequest} from '../http/deployment-request.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../database/transactions.mjs';
import {createResearchIdentityService} from './service.mjs';
import {identityError} from './policy.mjs';

export const identityRoute=path=>/^\/api\/account-access\/(?:research-profile(?:\/.*)?|research-identity)\/?$/.test(path);
export function validateIdentityRequest(req,body,receipt=false,runtimePolicy){
  const h=req.headers??{},deny=()=>{throw identityError('IDENTITY_ORIGIN_REJECTED',403,'仅允许本机同源合成环境请求。');};
  if(runtimePolicy)assertDeploymentRequest(req,runtimePolicy);
  else {
  if(!['127.0.0.1:19501','127.0.0.1:19502'].includes(h.host)||Object.keys(h).some(k=>['forwarded','x-forwarded-host','x-forwarded-proto'].includes(k)))deny();
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))deny();
  if(!['GET','HEAD'].includes(req.method)&&(h.origin!=='http://127.0.0.1:19501'||!/^application\/json(?:\s*;.*)?$/i.test(h['content-type']??'')))deny();
  }
  if(body!==undefined&&Buffer.byteLength(JSON.stringify(body))>49152)throw identityError('IDENTITY_REQUEST_TOO_LARGE',413,'科研资料请求超过48KiB，请减少输入。');
  const params=new URL(req.originalUrl??req.url,'http://127.0.0.1:19502').searchParams;
  let baseVersion;
  if(receipt){const values=params.getAll('baseVersion');if([...params.keys()].some(k=>k!=='baseVersion')||values.length!==1||!/^(0|[1-9]\d*)$/.test(values[0])||!Number.isSafeInteger(Number(values[0])))throw identityError('IDENTITY_INVALID_QUERY',400,'回执需唯一的合法资料版本。');baseVersion=Number(values[0]);}
  else if([...params].length)throw identityError('IDENTITY_INVALID_QUERY',400,'本人资料不接受账号或范围查询参数。');
  return{user:req.user,baseVersion};
}

export async function createResearchIdentityController({env,ids,load,require,runtimePolicy}){
  await assertFixtureTarget(env);
  if(runtimePolicy)assertVerifiedRuntimeSchema(env);
  if(!runtimePolicy){
  const{inspectResearchIdentitySchema,evaluateResearchIdentitySchema,researchIdentitySchemaHash}=await import('../../scripts/research-identity-schema.mjs');
  const state=await inspectResearchIdentitySchema(env);
  if(evaluateResearchIdentitySchema(state,researchIdentitySchemaHash)!=='existing')throw new Error('IDENTITY_SCHEMA_NOT_PREPARED');
  }
  const lockAuthorization=load('common/worker-publication','lockAuthorizationMutation');
  const db={tenantId:ids.tenant,transaction:fn=>withFixtureTransaction(env,'app',async tx=>{
    await tx.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
    await tx.$executeRaw`SELECT set_config('app.study_group_id','',true)`;
    await tx.$executeRaw`SELECT set_config('app.research_project_id','',true)`;
    await lockAuthorization(tx,ids.tenant);
    return fn(tx);
  })};
  const service=createResearchIdentityService({db});
  const {Controller,Get,Post,Patch,Body,Req,Res,Param,HttpCode,HttpException}=require('@nestjs/common');
  const invoke=async(req,res,method,body,key)=>{
    res.setHeader('Cache-Control','no-store');
    try{const ctx=validateIdentityRequest(req,body,method==='receipt',runtimePolicy);return await service[method](ctx,...(method==='receipt'?[key,ctx.baseVersion]:body===undefined?[]:[body]));}
    catch(e){throw new HttpException({code:e.code??'IDENTITY_UNAVAILABLE',message:e.status?e.message:'科研资料服务暂不可用，请保留输入并核对。',...(e.fieldErrors?{fieldErrors:e.fieldErrors}:{})},e.status??503);}
  };
  class ResearchIdentityController{
    read(req,res){return invoke(req,res,'read');}
    save(req,res,body){return invoke(req,res,'save',body);}
    establish(req,res,body){return invoke(req,res,'establish',body);}
    receipt(req,res,key){return invoke(req,res,'receipt',undefined,key);}
    identity(req,res){return invoke(req,res,'identity');}
  }
  Controller('account-access')(ResearchIdentityController);
  for(const[name,verb,path]of [['read',Get,'research-profile'],['save',Patch,'research-profile'],['establish',Post,'research-profile/establishments'],['receipt',Get,'research-profile/receipts/:requestKey'],['identity',Get,'research-identity']]){
    const p=ResearchIdentityController.prototype,d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);HttpCode(200)(p,name,d);Req()(p,name,0);Res({passthrough:true})(p,name,1);
    if(['save','establish'].includes(name))Body()(p,name,2);if(name==='receipt')Param('requestKey')(p,name,2);
  }
  return ResearchIdentityController;
}
