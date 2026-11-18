import {unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createSessionMaterials,MATERIAL_MAX_BYTES} from '../server/ai-agent/session-materials.mjs';
import {isHubConversation} from './hub-agent-contract.mjs';
const deny=()=>{throw Object.assign(Error('HUB_MATERIAL_ACCESS_REJECTED'),{code:'HUB_MATERIAL_ACCESS_REJECTED',status:403});};
// Busboy emits partsLimit as soon as it reaches this count, including at EOF.
// Leave one sentinel part; files/fields still enforce exactly one of each.
export const MATERIAL_MULTIPART_LIMITS=Object.freeze({fileSize:MATERIAL_MAX_BYTES,files:1,fields:1,fieldSize:160,parts:3});
export function createLocalMaterialAccess({env,ids,load,transaction}){
  const lock=load('common/worker-publication','lockAuthorizationMutation');
  const effective=load('common/tool-catalog','effectiveRuntimeToolKeys');
  const scoped=load('common/scoped-assignment','scopedAssignmentEnabled');
  const permissions=load('common/permission-catalog','hasRequiredPermissions');
  const inTransaction=async(tx,user,sessionId,operation)=>{
    if(!user||user.tenantId!==ids.tenant||user.studyGroupId!==ids.group||user.researchProjectId!==ids.project||![ids.owner,ids.admin].includes(user.accountId))deny();
      await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,user.tenantId,user.studyGroupId,user.researchProjectId,user.accountId);
      await lock(tx,user.tenantId);
      const agentId=ids.tenant+'-kb-research';
      const [account,membership,project,session,config,accesses]=await Promise.all([
        tx.account.findFirst({where:{id:user.accountId,tenantId:user.tenantId,status:'active'},include:{tenant:true}}),
        tx.studyGroupMembership.findFirst({where:{tenantId:user.tenantId,studyGroupId:user.studyGroupId,accountId:user.accountId,status:'active',studyGroup:{status:'active'},role:{status:'active'}},include:{role:true}}),
        tx.researchProjectMembership.findFirst({where:{tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,status:'active',researchProject:{status:'active'}}}),
        tx.session.findFirst({where:{id:sessionId,tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,accountId:user.accountId,agentId,deletedAt:null,status:'active',channel:'knowledge'},include:{agent:true}}),
        tx.agentConfig.findFirst({where:{tenantId:user.tenantId,agentId,active:true,archivedAt:null},orderBy:{version:'desc'}}),
        tx.agentAccess.findMany({where:{tenantId:user.tenantId,agentId,scopeKey:{in:['*',user.accountId]}}}),
      ]);
      if(!account||account.tenant.status!=='active'||account.authVersion!==user.authVersion||!membership||!project||!session||!isHubConversation(session.contextKey)||session.agent.status!=='active'||session.agent.type!=='research'||!config||!scoped(accesses,user.accountId))deny();
      const role=membership.role;
      if(!permissions(role.menuPermissions,['knowledge','workbench'])||!permissions(role.buttonPermissions,['knowledge.edit','chat.use'])||!effective('research',config.tools,role).includes('file.read'))deny();
      const current={tenantId:account.tenantId,accountId:account.id,studyGroupId:session.studyGroupId,researchProjectId:session.researchProjectId,authVersion:account.authVersion,role:account.role,isTenantAdmin:account.isTenantAdmin,username:account.username};
      return operation(tx,current);
  };
  return {inTransaction,transaction:(user,sessionId,operation)=>{
    const run=tx=>inTransaction(tx,user,sessionId,operation);
    return transaction?transaction(user,run):withFixtureTransaction(env,'app',run);
  }};
}

export function materialNativeOperations({tx,user,load,storage,scope,ingestion,extract,grounding}){
  const bound={forTenant:()=>tx,elevated:tx,withTenantTransaction:(_t,_g,_p,fn)=>fn(tx)};
  const Queue=load('knowledge/knowledge-import.service','KnowledgeImportService'),Knowledge=load('knowledge/knowledge.service','KnowledgeService');
  const queue=new Queue(bound,storage,extract,ingestion,scope);
  // The actual native worker is scheduled only after the outer PG commit.
  queue.schedule=()=>{};
  const knowledge=new Knowledge(bound,ingestion,grounding,extract,queue,storage);
  return {
    async privateBase(){
      return await tx.knowledgeBase.findFirst({where:{tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,ownerAccountId:user.accountId,visibility:'private'},orderBy:[{createdAt:'asc'},{id:'asc'}]})??knowledge.createBase(user,{name:'我的资料',visibility:'private'});
    },
    enqueue:(kbId,file)=>knowledge.enqueueImportFile(user,{kbId,...file}),
  };
}

export function createLocalSessionMaterials({env,ids,load,require,queue,storage,scope,ingestion,extract,grounding}){
  const access=createLocalMaterialAccess({env,ids,load});
  const service=createSessionMaterials({access,inspectFile:load('knowledge/knowledge-file-policy','inspectKnowledgeImportFile'),
    createOperations:(tx,user)=>materialNativeOperations({tx,user,load,storage,scope,ingestion,extract,grounding}),
    startImport:({taskId})=>queue.schedule(taskId)});
  const {Controller,Get,Post,Req,Body,Param,Query,UploadedFile,UseInterceptors,HttpException}=require('@nestjs/common');
  const {FileInterceptor}=require('@nestjs/platform-express'),{diskStorage}=require('multer');
  const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(new URL('../../app/server/src/common/decorators.ts',import.meta.url).pathname);
  const invoke=async(req,fn)=>{
    req.res?.setHeader('Cache-Control','no-store');
    const h=req.headers??{};
    if(!['127.0.0.1:19501','127.0.0.1:19502'].includes(h.host)||Object.keys(h).some(k=>['forwarded','x-forwarded-host','x-forwarded-proto'].includes(k))||req.method==='POST'&&h.origin!=='http://127.0.0.1:19501')throw new HttpException({code:'HUB_MATERIAL_ORIGIN_REJECTED',message:'请从当前页面上传资料。'},403);
    try{return await fn();}catch(e){
      const messages={HUB_MATERIAL_ACCESS_REJECTED:'当前会话或资料授权已失效，请核对后再操作。',HUB_MATERIAL_REQUEST_CONFLICT:'该次上传对应的文件已不同，请保留原操作并重新选择文件。',HUB_MATERIAL_FORMAT_UNAVAILABLE:'请选择PDF、DOCX、TXT或Markdown文献；研究数据请待确认课题后导入。',HUB_MATERIAL_FILE_INVALID:'文件为空、格式无效或超过100MiB。'};
      if(e?.code?.startsWith('HUB_MATERIAL_'))throw new HttpException({code:e.code,message:messages[e.code]??'资料状态无法核对，请保留文件并查询原操作。'},e.status??409);
      if(e?.getStatus)throw e;
      throw new HttpException({code:'HUB_MATERIAL_UNAVAILABLE',message:'资料服务暂不可用，请先核对原上传状态，不要重复上传。'},503);
    }
  };
  class SessionMaterialsController{
    list(req,sid,query){if(Object.keys(query).some(k=>!['limit','cursor'].includes(k)))throw new HttpException('资料分页参数无效',400);return invoke(req,()=>service.list(req.user,sid,query));}
    receipt(req,sid,key,query){if(Object.keys(query).length)throw new HttpException('上传回执参数无效',400);return invoke(req,()=>service.receipt(req.user,sid,key));}
    async upload(req,sid,body,file){try{
      return await invoke(req,()=>{if(!file||!body||Object.keys(body).length!==1||typeof body.requestKey!=='string')throw new HttpException('请选择文件并保留本次上传标记',400);return service.upload(req.user,sid,{requestKey:body.requestKey,file});});
    }finally{if(file?.path)await unlink(file.path).catch(()=>undefined);}}
  }
  Controller('sessions')(SessionMaterialsController);RequireStudyGroup()(SessionMaterialsController);RequireResearchProject()(SessionMaterialsController);
  RequireStudyGroupMenu('workbench')(SessionMaterialsController);RequireStudyGroupPermission('chat.use')(SessionMaterialsController);
  const p=SessionMaterialsController.prototype;
  for(const[name,verb,path]of [['list',Get,':id/materials'],['receipt',Get,':id/materials/receipts/:requestKey'],['upload',Post,':id/materials']]){
    const descriptor=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,descriptor);Req()(p,name,0);Param('id')(p,name,1);
    if(name==='list')Query()(p,name,2);
    if(name==='receipt'){Param('requestKey')(p,name,2);Query()(p,name,3);}
    if(name==='upload'){
      Body()(p,name,2);UploadedFile()(p,name,3);RequireStudyGroupPermission('knowledge.edit')(p,name,descriptor);
      UseInterceptors(FileInterceptor('file',{storage:diskStorage({destination:'/tmp',filename:(_req,_file,done)=>done(null,'rh-ai-material-'+randomUUID())}),limits:MATERIAL_MULTIPART_LIMITS}))(p,name,descriptor);
    }
  }
  return {Controller:SessionMaterialsController,service};
}
