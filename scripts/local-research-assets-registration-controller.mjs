import{assertDeploymentRequest}from'../server/http/deployment-request.mjs';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {REPORT_CONTEXT} from './research-assets-report-context.mjs';
import {assetVersionInRange} from './research-assets-business-identity.mjs';
const fail=(code,status,message)=>{throw catalogError(code,status,message);};
export function assertAssetHttpContext(req,{origin,mutation=false}={}){
 const h=req.headers??{},actor=h['x-researchhub-actor'],version=h['x-researchhub-auth-version'];
 if(mutation&&(h.origin!==origin||h['x-researchhub-request']!=='asset-catalog-v1'))fail('ORIGIN_REJECTED',403,'请求来源无法核对，请从当前页面重新打开操作。');
 if(!mutation&&actor===undefined&&version===undefined)return true;
 if(typeof actor!=='string'||typeof version!=='string'||!/^(0|[1-9][0-9]*)$/.test(version)||!Number.isSafeInteger(Number(version)))fail('INPUT_INVALID',400,'操作身份上下文不完整，请重新打开。');
 if(actor!==req.user?.accountId||Number(version)!==req.user?.authVersion)fail('IDENTITY_CHANGED',409,'账号或会话已变化，未继续执行原操作，请重新读取。');return true;
}
export function createAssetRegistrationController({root,require,registration,reportContext,reportSource,materialBasis,governance,usage,lifecycle,uploads,afterCommit,afterGovernanceCommit,afterUsageCommit,afterLifecycleCommit,scopedUser,load,runtimePolicy,origin='http://127.0.0.1:19501'}){
 const {Controller,Get,Post,Req,Param,Body,UploadedFile,UseInterceptors,HttpException,SetMetadata}=require('@nestjs/common');
 const {FileInterceptor}=require('@nestjs/platform-express');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=(load?Object.fromEntries(['RequireStudyGroup','RequireResearchProject','RequireStudyGroupMenu','RequireStudyGroupPermission'].map(name=>[name,load('common/decorators',name)])):require(root+'app/server/src/common/decorators.ts'));
 const assertContext=(req,options={})=>{if(runtimePolicy)assertDeploymentRequest(req,runtimePolicy,{json:false});return assertAssetHttpContext(req,options);};
 class AssetRegistrationController{
  async run(req,mutation,execute){
   req.res?.setHeader('Cache-Control','no-store');
   try{assertContext(req,{origin,mutation});if(scopedUser)req.user=await scopedUser(req);return await execute();}catch(e){if(e.code?.startsWith('ASSET_CATALOG_'))throw new HttpException({code:e.code,message:e.message},e.status);throw e;}
  }
  noQuery(req){if(Object.keys(req.query??{}).length)fail('INPUT_INVALID',400,'此操作不接受额外查询条件。');}
  reportPreview(req){return this.run(req,false,()=>{this.noQuery(req);return reportContext.preview(req.user);});}
  reportRegister(req,body){return this.run(req,true,()=>{this.noQuery(req);return reportContext.register(req.user,body);});}
  reportRevise(req,body){return this.run(req,true,()=>{this.noQuery(req);return reportContext.revise(req.user,body);});}
  reportRef(req,id){const q=req.query??{};if(Object.keys(q).length!==1||typeof q.studyId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(q.studyId)||!/^[A-Za-z0-9_-]{1,160}$/.test(id))fail('INPUT_INVALID',400,'报告来源范围无效。');return{studyId:q.studyId,reportId:id};}
  sourcePreview(req,id){return this.run(req,false,()=>reportSource.preview(req.user,this.reportRef(req,id)));}
  sourceRegister(req,id,body){return this.run(req,true,()=>reportSource.register(req.user,this.reportRef(req,id),body));}
  sourceRevise(req,id,body){return this.run(req,true,()=>reportSource.revise(req.user,this.reportRef(req,id),body));}
  materialApprove(req,id,body){return this.run(req,true,()=>{if(!body||!Number.isSafeInteger(body.version)||body.version<1)fail('INPUT_INVALID',400,'请选择固定报告版本。');const {version,...input}=body;return materialBasis.approve(req.user,{...this.reportRef(req,id),version},input);});}
  materialRevoke(req,id,body){return this.run(req,true,()=>{this.noQuery(req);return materialBasis.revoke(req.user,id,body);});}
  requireOriginalRegistrationScope(req){if(req.user?.researchProjectId===REPORT_CONTEXT.projectId)fail('FORBIDDEN',403,'请从原方法报告登记或完善资产说明。');}
  options(req){return this.run(req,false,()=>{const q=req.query??{};if(Object.keys(q).length&&!(Object.keys(q).length===1&&typeof q.assetId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(q.assetId)))fail('INPUT_INVALID',400,'登记来源查询无效。');return registration.options(req.user,q.assetId);});}
  operation(req,key){return this.run(req,false,()=>{this.noQuery(req);return registration.operation(req.user,key);});}
  edit(req,id){return this.run(req,false,()=>{const q=req.query??{};if(Object.keys(q).length!==1||typeof q.version!=='string'||!/^[1-9][0-9]*$/.test(q.version))fail('INPUT_INVALID',400,'请选择一个明确的固定版本。');return registration.edit(req.user,id,q.version);});}
  governance(req,id){return this.run(req,false,()=>{const q=req.query??{};if(Object.keys(q).length!==1||typeof q.version!=='string'||!/^[1-9][0-9]*$/.test(q.version)||!assetVersionInRange(id,Number(q.version)))fail('INPUT_INVALID',400,'请选择一个明确的固定版本。');return governance.options(req.user,id,q.version);});}
  executeGovernance(req,id,body,action){return this.run(req,true,async()=>{this.noQuery(req);if(body?.action!==action)fail('INPUT_INVALID',400,'操作路径与结论不一致。');const receipt=await governance.execute(req.user,id,body);await afterGovernanceCommit?.({user:req.user,input:body,receipt});return receipt;});}
  submit(req,id,body){return this.executeGovernance(req,id,body,'submit');}
  review(req,id,body){return this.executeGovernance(req,id,body,'review');}
  release(req,id,body){return this.executeGovernance(req,id,body,'release');}
  withdraw(req,id,body){return this.executeGovernance(req,id,body,'withdraw');}
  usage(req,id){return this.run(req,false,()=>{const q=req.query??{};if(Object.keys(q).length!==1||typeof q.version!=='string'||!/^[1-8]$/.test(q.version))fail('INPUT_INVALID',400,'请选择固定版本。');return usage.options(req.user,id,q.version);});}
  collaborations(req){return this.run(req,false,()=>usage.collaborations(req.user,req.query??{}));}
  usageWrite(req,id,body,action,requestId){return this.run(req,true,async()=>{this.noQuery(req);if(!(Array.isArray(action)?action.includes(body?.action):body?.action===action)||requestId!==undefined&&requestId!==body?.requestId)fail('INPUT_INVALID',400,'操作路径与请求不一致。');const receipt=await usage.execute(req.user,id,body);await afterUsageCommit?.({user:req.user,input:body,receipt});return receipt;});}
  requestAccess(req,id,body){return this.usageWrite(req,id,body,['request','share']);}
  decideAccess(req,id,requestId,body){return this.usageWrite(req,id,body,'decide',requestId);}
  revokeAccess(req,id,requestId,body){return this.usageWrite(req,id,body,'revoke',requestId);}
  cite(req,id,body){return this.usageWrite(req,id,body,'cite');}
  lifecycle(req,id){return this.run(req,false,()=>{const q=req.query??{};if(Object.keys(q).length!==1||typeof q.version!=='string'||!/^[1-9][0-9]*$/.test(q.version)||!assetVersionInRange(id,Number(q.version)))fail('INPUT_INVALID',400,'请选择固定版本。');return lifecycle.options(req.user,id,q.version);});}
  lifecycleWrite(req,id,body,action){return this.run(req,true,async()=>{this.noQuery(req);if(body?.action!==action)fail('INPUT_INVALID',400,'操作路径与请求不一致。');const receipt=await lifecycle.execute(req.user,id,body);await afterLifecycleCommit?.({user:req.user,input:body,receipt});return receipt;});}
  trashAsset(req,id,body){return this.lifecycleWrite(req,id,body,'trash');}
  restoreAsset(req,id,body){return this.lifecycleWrite(req,id,body,'restore');}
  register(req,body){return this.run(req,true,async()=>{this.noQuery(req);this.requireOriginalRegistrationScope(req);const receipt=await registration.register(req.user,body);await afterCommit?.({user:req.user,input:body,receipt});return receipt;});}
  revise(req,id,body){return this.run(req,true,async()=>{this.noQuery(req);this.requireOriginalRegistrationScope(req);const receipt=await registration.revise(req.user,id,body);await afterCommit?.({user:req.user,input:body,receipt});return receipt;});}
  upload(req,body,file){return this.run(req,true,()=>{this.noQuery(req);if(!body||Object.keys(body).length!==1||typeof body.requestKey!=='string')fail('INPUT_INVALID',400,'上传请求字段无效。');return uploads.stage(req.user,file,body.requestKey);});}
 }
 Controller('research-assets')(AssetRegistrationController);RequireStudyGroup()(AssetRegistrationController);RequireResearchProject()(AssetRegistrationController);RequireStudyGroupMenu('artifacts')(AssetRegistrationController);RequireStudyGroupPermission('artifact.read')(AssetRegistrationController);
 if(materialBasis)for(const[method,path]of[['materialApprove','report-sources/:id/material-ai-approvals'],['materialRevoke','material-ai-basis/:id/revocations']]){Post(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);Param('id')(AssetRegistrationController.prototype,method,1);Body()(AssetRegistrationController.prototype,method,2);}
 if(scopedUser)for(const method of ['options','operation','edit','register','revise','governance','submit','review','lifecycle','trashAsset','restoreAsset'])SetMetadata('requireStudyGroup',false)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));
 for(const [method,path,write]of [['reportPreview','report-context-source',false],['reportRegister','report-context-registrations',true],['reportRevise','report-context-revisions',true]]){
  (write?Post:Get)(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);if(write)Body()(AssetRegistrationController.prototype,method,1);
 }
 for(const [method,path,write]of [['sourcePreview','report-sources/:id',false],['sourceRegister','report-sources/:id/registrations',true],['sourceRevise','report-sources/:id/revisions',true]]){
  (write?Post:Get)(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);Param('id')(AssetRegistrationController.prototype,method,1);if(write)Body()(AssetRegistrationController.prototype,method,2);
 }
 for(const [method,path]of [['options','registrable-sources'],['operation','operations/:key'],['edit',':id/registration'],['governance',':id/governance']]){
  Get(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);
  if(method!=='options')Param(method==='operation'?'key':'id')(AssetRegistrationController.prototype,method,1);
 }
 for(const [action,path] of Object.entries({submit:'submissions',review:'reviews',release:'releases',withdraw:'withdrawals'})){
  Post(':id/'+path)(AssetRegistrationController.prototype,action,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,action));Req()(AssetRegistrationController.prototype,action,0);Param('id')(AssetRegistrationController.prototype,action,1);Body()(AssetRegistrationController.prototype,action,2);
 }
 for(const [method,path]of [['usage',':id/usage'],['collaborations','collaborations']]){Get(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);if(method==='usage')Param('id')(AssetRegistrationController.prototype,method,1);}
 for(const [method,path,nested]of [['requestAccess',':id/access-requests',false],['decideAccess',':id/access-requests/:requestId/decisions',true],['revokeAccess',':id/grants/:requestId/revocations',true],['cite',':id/citations',false]]){
  Post(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);Param('id')(AssetRegistrationController.prototype,method,1);if(nested)Param('requestId')(AssetRegistrationController.prototype,method,2);Body()(AssetRegistrationController.prototype,method,nested?3:2);
 }
 Get(':id/lifecycle')(AssetRegistrationController.prototype,'lifecycle',Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,'lifecycle'));Req()(AssetRegistrationController.prototype,'lifecycle',0);Param('id')(AssetRegistrationController.prototype,'lifecycle',1);
 for(const [method,path]of [['trashAsset',':id/trash'],['restoreAsset',':id/restores']]){Post(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);Param('id')(AssetRegistrationController.prototype,method,1);Body()(AssetRegistrationController.prototype,method,2);}
 for(const [method,path]of [['register',''],['revise',':id/versions'],['upload','uploads']]){
  Post(path)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));Req()(AssetRegistrationController.prototype,method,0);
  if(method==='revise'){Param('id')(AssetRegistrationController.prototype,method,1);Body()(AssetRegistrationController.prototype,method,2);}
  else Body()(AssetRegistrationController.prototype,method,1);
 }
 UploadedFile()(AssetRegistrationController.prototype,'upload',2);
 // Busboy emits partsLimit on equality, so two permitted parts require a sentinel of three.
 // The exact one-file/one-field limits and body-key check still reject any third field/file.
 UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024,files:1,fields:1,parts:3}}))(AssetRegistrationController.prototype,'upload',Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,'upload'));
 if(runtimePolicy)for(const method of Object.getOwnPropertyNames(AssetRegistrationController.prototype).filter(k=>k!=='constructor'))SetMetadata('requireStudyGroup',false)(AssetRegistrationController.prototype,method,Object.getOwnPropertyDescriptor(AssetRegistrationController.prototype,method));
 return AssetRegistrationController;
}
