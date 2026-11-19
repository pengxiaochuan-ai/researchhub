import{assertDeploymentRequest}from'../server/http/deployment-request.mjs';
import {assetDetailAiBusinessError} from './research-assets-detail-ai-errors.mjs';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {assertAssetHttpContext} from './local-research-assets-registration-controller.mjs';

/** Static catalog routes must be registered before the unchanged V1 :id reader. */
export function createAssetCatalogController({root,require,reader,views,details,comments,files,reuse,ai,reportQa,overview,scopedUser,load,runtimePolicy,origin='http://127.0.0.1:19501'}){
 const {Controller,Get,Head,Post,Body,Req,Param,HttpException,StreamableFile,SetMetadata}=require('@nestjs/common');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=(load?Object.fromEntries(['RequireStudyGroup','RequireResearchProject','RequireStudyGroupMenu','RequireStudyGroupPermission'].map(name=>[name,load('common/decorators',name)])):require(root+'app/server/src/common/decorators.ts'));
 const assertContext=(req,options={})=>{if(runtimePolicy)assertDeploymentRequest(req,runtimePolicy,{json:false});return assertAssetHttpContext(req,options);};
 class AssetCatalogController{
  reportQaStatus(req,id,v){return this.run(req,()=>{if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return reportQa.status(req.user,id,v);});}
  reportQaConsent(req,id,v,b){return this.reportQaWrite(req,id,v,b,'consent');}
  reportQaSearch(req,id,v,b){return this.reportQaWrite(req,id,v,b,'search');}
  reportQaFragment(req,id,v,b){return this.reportQaWrite(req,id,v,b,'fragment');}
  reportQaWrite(req,id,v,b,operation){return this.run(req,()=>{assertContext(req,{mutation:true,origin});if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return reportQa[operation](req.user,id,v,b);});}
  async run(req,operation,deriveScope=true){
   req.res?.setHeader('Cache-Control','no-store');
   try{assertContext(req);if(deriveScope&&scopedUser)req.user=await scopedUser(req);return await operation();}
   catch(e){e=assetDetailAiBusinessError(e)??e;if(e.code?.startsWith('ASSET_CATALOG_'))throw new HttpException({code:e.code,message:e.message},e.status);throw e;}
  }
  aiStatus(req,id,v){return this.run(req,()=>ai.status(req.user,id,v));}
  aiRun(req,id,v,b){return this.run(req,()=>{assertContext(req,{mutation:true,origin});return ai.run(req.user,id,v,b);});}
  aiOpinions(req,id,v,b){return this.run(req,()=>{assertContext(req,{mutation:true,origin});return ai.opinions(req.user,id,v,b);});}
  catalog(req){return this.run(req,()=>reader.catalog(req.user,req.query??{}));}
  overview(req){return this.run(req,()=>overview.read(req.user,req.query??{}),false);}
  detail(req,id,version){return this.run(req,()=>{
   if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400,'资产详情不接受额外查询条件。');
   return reader.detail(req.user,id,version);
  });}
  history(req,id,version){return this.detail(req,id,version);}
  compare(req,id,version){return this.run(req,()=>details.compare(req.user,id,version,req.query??{}));}
  activity(req,id,version){return this.run(req,()=>details.activity(req.user,id,version,req.query??{}));}
  tags(req,id,version,body){return this.run(req,()=>{assertContext(req,{mutation:true,origin});if(String(body?.baseVersion)!==version||Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400,'修订路径与固定版本不一致。');return details.tags(req.user,id,body);});}
  comments(req,id,v){return this.run(req,()=>comments.read(req.user,id,v,req.query??{}));}
  commentCreate(req,id,v,body){return this.commentWrite(req,id,v,null,body);}
  commentRevise(req,id,v,commentId,body){return this.commentWrite(req,id,v,commentId,body);}
  commentWrite(req,id,v,commentId,body){return this.run(req,()=>{assertContext(req,{mutation:true,origin});if(Object.keys(req.query??{}).length||(!commentId?body?.action!=='create':!['edit','withdraw','moderate'].includes(body?.action)))throw catalogError('INPUT_INVALID',400,'讨论操作路径不一致。');return comments.execute(req.user,id,v,commentId,body);});}
  commentHistory(req,id,v,commentId){return this.run(req,()=>{if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return comments.history(req.user,id,v,commentId);});}
  appliedList(req){return this.run(req,()=>{assertContext(req);if(!req.headers?.['x-researchhub-actor'])throw catalogError('INPUT_INVALID',400);return reuse.listTargets(reuse.targetStudyId?{...req.user,researchProjectId:reuse.targetStudyId}:req.user,req.query??{});});}
  appliedRead(req,id,version){return this.run(req,()=>{assertContext(req);if(!req.headers?.['x-researchhub-actor']||Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return reuse.readTarget(reuse.targetStudyId?{...req.user,researchProjectId:reuse.targetStudyId}:req.user,id,version);});}
  appliedGuidance(req,id){return this.run(req,()=>{assertContext(req);if(!req.headers?.['x-researchhub-actor'])throw catalogError('INPUT_INVALID',400);return reuse.targetGuidance(reuse.targetStudyId?{...req.user,researchProjectId:reuse.targetStudyId}:req.user,id,req.query??{});});}
  appliedSave(req,id,body){return this.run(req,()=>{assertContext(req,{mutation:true,origin});if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return reuse.saveTarget(reuse.targetStudyId?{...req.user,researchProjectId:reuse.targetStudyId}:req.user,id,body);});}
  reuseOptions(req,id,v){return this.run(req,()=>{if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return reuse.options(req.user,id,v);});}
  reusePreview(req,id,v,body){return this.run(req,()=>{assertContext(req,{mutation:true,origin});if(Object.keys(req.query??{}).length||!body||Object.keys(body).some(k=>!['kind','title'].includes(k)))throw catalogError('INPUT_INVALID',400);return reuse.preview(req.user,id,v,body);});}
  reuseCreate(req,id,v,body){return this.run(req,()=>{assertContext(req,{mutation:true,origin});if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return reuse.execute(req.user,id,v,body);});}
  reuseResult(req,id,v){return this.run(req,()=>{if(Object.keys(req.query??{}).length!==1||typeof req.query.requestKey!=='string')throw catalogError('INPUT_INVALID',400);return reuse.result(req.user,id,v,req.query.requestKey);});}
  files(req,id,v){return this.run(req,()=>{if(Object.keys(req.query??{}).length)throw catalogError('INPUT_INVALID',400);return files.list(req.user,id,v);});}
  fileContent(req,id,v,fileId){return this.transfer(req,id,v,fileId,false);}
  fileHead(req,id,v,fileId){return this.transfer(req,id,v,fileId,false,true);}
  markdown(req,id,v){return this.transfer(req,id,v,null,true);}
  markdownHead(req,id,v){return this.transfer(req,id,v,null,true,true);}
  transfer(req,id,v,fileId,markdown,head=false){return this.run(req,async()=>{
   head=head||req.method==='HEAD';
   if(!head&&(req.headers?.['x-researchhub-request']!=='asset-catalog-v1'||!req.headers?.['x-researchhub-actor']||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))throw catalogError('ORIGIN_REJECTED',403,'请从当前资产页面下载文件。');assertContext(req);if(Object.keys(req.query??{}).some(k=>k!=='requestKey')||!head&&typeof req.query?.requestKey!=='string')throw catalogError('INPUT_INVALID',400);
   const controller=new AbortController(),cancel=()=>controller.abort(),closed=()=>{if(!req.res.writableEnded)cancel();};req.once?.('aborted',cancel);req.res.once?.('close',closed);if(req.aborted)cancel();
   try{const result=await files.content(req.user,id,v,{fileId,markdown,head,range:req.headers?.range,requestKey:req.query?.requestKey,signal:controller.signal});
    if(controller.signal.aborted||req.res.destroyed){result.stream?.destroy();throw catalogError('REQUEST_CANCELLED',499,'下载已取消。');}
    req.res.status(result.partial?206:200);for(const [k,val]of Object.entries({'Accept-Ranges':'bytes','Cache-Control':'private, no-store','Content-Type':result.mimeType,'Content-Length':String(result.length),'X-Content-Type-Options':'nosniff','X-Content-SHA256':result.sha256,'Content-Disposition':`attachment; filename="${result.filename.replace(/[^A-Za-z0-9._-]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`}))req.res.setHeader(k,val);if(result.partial)req.res.setHeader('Content-Range',`bytes ${result.start}-${result.end}/${result.size}`);
    if(head){req.res.end();return;}result.stream.once('close',()=>{req.off?.('aborted',cancel);req.res.off?.('close',closed);});return new StreamableFile(result.stream);
   }catch(e){req.off?.('aborted',cancel);req.res.off?.('close',closed);throw e;}
  });}
  preview(req,id){return this.run(req,()=>{
   const q=req.query??{};
   if(Object.keys(q).some(k=>!['version','tab'].includes(k))||typeof q.version!=='string'||!/^[1-9][0-9]*$/.test(q.version)||!Number.isSafeInteger(Number(q.version))||q.tab!==undefined&&!['basic','versions','relations','citations'].includes(q.tab))throw catalogError('INPUT_INVALID',400,'预览版本或栏目无效。');
   return reader.preview(req.user,id,q.version,q.tab??'basic');
  });}
 }
 Controller('research-assets')(AssetCatalogController);RequireStudyGroup()(AssetCatalogController);RequireResearchProject()(AssetCatalogController);RequireStudyGroupMenu('artifacts')(AssetCatalogController);RequireStudyGroupPermission('artifact.read')(AssetCatalogController);
 if(reportQa)for(const[method,path,write]of[['reportQaStatus','report-qa',false],['reportQaConsent','ai-consents',true],['reportQaSearch','report-qa/search',true],['reportQaFragment','report-qa/fragment',true]]){
  const d=Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method);(write?Post:Get)(':id/versions/:version/'+path)(AssetCatalogController.prototype,method,d);Req()(AssetCatalogController.prototype,method,0);Param('id')(AssetCatalogController.prototype,method,1);Param('version')(AssetCatalogController.prototype,method,2);if(write)Body()(AssetCatalogController.prototype,method,3);if(scopedUser)SetMetadata('requireStudyGroup',false)(AssetCatalogController.prototype,method,d);
 }
 if(scopedUser)for(const method of ['catalog','detail','history','preview','compare','activity'])SetMetadata('requireStudyGroup',false)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));
 if(overview){const descriptor=Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,'overview');Get('overview')(AssetCatalogController.prototype,'overview',descriptor);Req()(AssetCatalogController.prototype,'overview',0);SetMetadata('requireStudyGroup',false)(AssetCatalogController.prototype,'overview',descriptor);}
 for(const [method,path,write]of [['appliedList','applied-drafts',false],['appliedRead','applied-drafts/:id/design',false],['appliedHistory','applied-drafts/:id/versions/:version',false],['appliedGuidance','applied-drafts/:id/guidance-citations',false],['appliedSave','applied-drafts/:id/versions',true]]){
  if(method==='appliedHistory')Object.defineProperty(AssetCatalogController.prototype,method,{value:function(req,id,v){return this.appliedRead(req,id,v);},configurable:true});(write?Post:Get)(path)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));Req()(AssetCatalogController.prototype,method,0);if(method!=='appliedList')Param('id')(AssetCatalogController.prototype,method,1);if(method==='appliedHistory')Param('version')(AssetCatalogController.prototype,method,2);if(write)Body()(AssetCatalogController.prototype,method,2);
 }
 for(const type of ['graph','contributions','trash','recommendations','usage']){
  Object.defineProperty(AssetCatalogController.prototype,type,{value:function(req){return this.run(req,()=>views.read(req.user,type,req.query??{}));},configurable:true});
  Get(type)(AssetCatalogController.prototype,type,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,type));Req()(AssetCatalogController.prototype,type,0);
  if(scopedUser)SetMetadata('requireStudyGroup',false)(AssetCatalogController.prototype,type,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,type));
 }
 for(const [method,path,write,nested]of [['comments',':id/versions/:version/comments',false,false],['commentCreate',':id/versions/:version/comments',true,false],['commentRevise',':id/versions/:version/comments/:commentId/revisions',true,true],['commentHistory',':id/versions/:version/comments/:commentId/history',false,true]]){
  (write?Post:Get)(path)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));Req()(AssetCatalogController.prototype,method,0);Param('id')(AssetCatalogController.prototype,method,1);Param('version')(AssetCatalogController.prototype,method,2);if(nested)Param('commentId')(AssetCatalogController.prototype,method,3);if(write)Body()(AssetCatalogController.prototype,method,nested?4:3);
 }
 for(const [method,path,write]of [['aiStatus','ai-status',false],['aiRun','ai-jobs',true],['aiOpinions','ai-decisions',true],['reuseOptions','reuse-options',false],['reusePreview','reuse-previews',true],['reuseCreate','reuses',true],['reuseResult','reuse-result',false]]){(write?Post:Get)(':id/versions/:version/'+path)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));Req()(AssetCatalogController.prototype,method,0);Param('id')(AssetCatalogController.prototype,method,1);Param('version')(AssetCatalogController.prototype,method,2);if(write)Body()(AssetCatalogController.prototype,method,3);}
 for(const [method,path,head,nested]of [['files',':id/versions/:version/files',false,false],['fileContent',':id/versions/:version/files/:fileId/content',false,true],['fileHead',':id/versions/:version/files/:fileId/content',true,true],['markdown',':id/versions/:version/markdown',false,false],['markdownHead',':id/versions/:version/markdown',true,false]]){
  (head?Head:Get)(path)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));Req()(AssetCatalogController.prototype,method,0);Param('id')(AssetCatalogController.prototype,method,1);Param('version')(AssetCatalogController.prototype,method,2);if(nested)Param('fileId')(AssetCatalogController.prototype,method,3);
 }
 for(const method of ['compare','activity','tags']){
  const decorator=method==='tags'?Post:Get;decorator(':id/versions/:version/'+method)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));Req()(AssetCatalogController.prototype,method,0);Param('id')(AssetCatalogController.prototype,method,1);Param('version')(AssetCatalogController.prototype,method,2);if(method==='tags')Body()(AssetCatalogController.prototype,method,3);
 }
 for(const [method,path]of [['catalog','catalog'],['detail','catalog/:id'],['history','catalog/:id/versions/:version'],['preview',':id/preview']]){
  Get(path)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));
  Req()(AssetCatalogController.prototype,method,0);
  if(method!=='catalog')Param('id')(AssetCatalogController.prototype,method,1);
  if(method==='history')Param('version')(AssetCatalogController.prototype,method,2);
 }
 if(runtimePolicy)for(const method of Object.getOwnPropertyNames(AssetCatalogController.prototype).filter(k=>k!=='constructor'))SetMetadata('requireStudyGroup',false)(AssetCatalogController.prototype,method,Object.getOwnPropertyDescriptor(AssetCatalogController.prototype,method));
 return AssetCatalogController;
}
