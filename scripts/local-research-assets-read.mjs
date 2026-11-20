import {coreSourcePath} from '../server/research-runtime/dependencies.mjs';
// Inject the existing current-authorization transaction. Never initializes grants or fixtures.
import {RESEARCH_ASSET_PREFIX,readResearchAssetRequest,assertResearchAssetIdentity,presentResearchAssetVersion,researchAssetError} from './research-assets-read-contract.mjs';

const scopeOf=user=>({tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId});
const versionSelect={artifactId:true,tenantId:true,studyGroupId:true,researchProjectId:true,versionNo:true,contentMd:true,contentBlocks:true,createdBy:true,createdAt:true,changeSummary:true};
const notFound=()=>researchAssetError('RESEARCH_ASSET_NOT_FOUND',404,'未找到可访问的资产草稿或版本。');
const corrupt=()=>researchAssetError('RESEARCH_ASSET_CONTEXT_INVALID',409,'资产版本信息无法核对，请返回目录重新打开。');

export function createResearchAssetsReader({withScope}){
 if(typeof withScope!=='function')throw new TypeError('Current authorization transaction is required');
 return{async read(user,id,number){
  const request=readResearchAssetRequest(id,number);
  return withScope(user,'artifact.read',async tx=>{
   const scope=scopeOf(user);
   const artifact=await tx.researchArtifact.findFirst({where:{...scope,id:request.id,ownerAccountId:user.accountId,createdBy:user.accountId,status:'draft',deletedAt:null,typeKey:'research_report',idempotencyKey:{startsWith:RESEARCH_ASSET_PREFIX}},select:{id:true,...Object.fromEntries(Object.keys(scope).map(k=>[k,true])),ownerAccountId:true,createdBy:true,status:true,deletedAt:true,typeKey:true,idempotencyKey:true,currentVersionNo:true,createdAt:true}});
   assertResearchAssetIdentity(artifact,user);if(artifact.id!==request.id)throw notFound();
   const readVersion=versionNo=>tx.researchArtifactVersion.findFirst({where:{...scope,artifactId:artifact.id,versionNo},select:versionSelect});
   const head=await readVersion(artifact.currentVersionNo);
   const headView=presentResearchAssetVersion({artifact,version:head,user});
   if(head.versionNo!==artifact.currentVersionNo)throw corrupt();
   const versionNo=request.versionNo??artifact.currentVersionNo;
   const version=versionNo===artifact.currentVersionNo?head:await readVersion(versionNo);
   if(!version)throw notFound();
   const view=version===head?headView:presentResearchAssetVersion({artifact,version,user});
   if(view.version!==versionNo||view.kind!==headView.kind)throw corrupt();
   const history=await tx.researchArtifactVersion.findMany({where:{...scope,artifactId:artifact.id,versionNo:{lte:artifact.currentVersionNo}},select:{versionNo:true,createdAt:true,changeSummary:true},orderBy:{versionNo:'desc'},take:51});
   if(history.some(v=>!Number.isSafeInteger(v.versionNo)||v.versionNo<1||v.versionNo>artifact.currentVersionNo)||new Set(history.map(v=>v.versionNo)).size!==history.length)throw corrupt();
   return{...view,versions:history.slice(0,50).map(v=>({version:v.versionNo,createdAt:v.createdAt,changeSummary:v.changeSummary})),hasMoreVersions:history.length>50};
  });
 }};
}

export function createResearchAssetsReadController({root,require,withScope}){
 const {Controller,Get,Req,Param,HttpException}=require('@nestjs/common');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(coreSourcePath('common/decorators'));
 const reader=createResearchAssetsReader({withScope});
 class ResearchAssetsReadController{
  async read(req,id,version){
   req.res?.setHeader('Cache-Control','no-store');
   try{
    if(Object.keys(req.query??{}).length)throw researchAssetError('RESEARCH_ASSET_INPUT_INVALID',400,'资产读取不接受额外查询条件。');
    return await reader.read(req.user,id,version);
   }catch(e){if(e.code?.startsWith('RESEARCH_ASSET_'))throw new HttpException({code:e.code,message:e.message},e.status);throw e;}
  }
  history(req,id,version){return this.read(req,id,version);}
 }
 Controller('research-assets')(ResearchAssetsReadController);RequireStudyGroup()(ResearchAssetsReadController);RequireResearchProject()(ResearchAssetsReadController);RequireStudyGroupMenu('artifacts')(ResearchAssetsReadController);RequireStudyGroupPermission('artifact.read')(ResearchAssetsReadController);
 for(const [method,path]of [['read',':id'],['history',':id/versions/:version']]){
  Get(path)(ResearchAssetsReadController.prototype,method,Object.getOwnPropertyDescriptor(ResearchAssetsReadController.prototype,method));
  Req()(ResearchAssetsReadController.prototype,method,0);Param('id')(ResearchAssetsReadController.prototype,method,1);
  if(method==='history')Param('version')(ResearchAssetsReadController.prototype,method,2);
 }
 return ResearchAssetsReadController;
}
