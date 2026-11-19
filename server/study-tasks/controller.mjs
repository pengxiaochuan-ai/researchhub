import {withFixtureTransaction,assertFixtureTarget} from '../database/transactions.mjs';
import {assertStudyTaskFixtureBoundary} from '../../scripts/study-tasks-fixture.mjs';
import {createTaskAuthorization,taskError} from './authorization.mjs';
import {parseTaskQuery,createTaskCursor,readTaskPage,readTaskDetail,readTaskReceipt} from './repository.mjs';
import {parseTaskCommand} from './contract.mjs';
import {createTaskCommands} from './commands.mjs';
import {readTaskEvidenceOptions} from './evidence.mjs';
import {readTaskLinkOptions} from './links.mjs';

export const taskReadRoutes=['studies','context','participants','link-options','operations/:requestKey','',':id'];
export function normalizeTaskFailure(error){
 if(error?.getResponse?.()?.code==='INVALID_TASK_TRANSITION')return taskError('STUDY_TASK_STATE_CONFLICT',409,'任务状态不允许该操作，请刷新后核对');
 return error;
}
export function validateTaskRequest(req,tenantId,{scopeOptional=false}={}) {
 const h=req.headers??{};
 if(!['127.0.0.1:19501','127.0.0.1:19502'].includes(h.host)||h['x-forwarded-host']||h['x-forwarded-proto']||h['sec-fetch-site']==='cross-site')
  throw taskError('STUDY_TASK_ORIGIN_REJECTED');
 if(!['GET','HEAD'].includes(req.method)&&(h.origin!=='http://127.0.0.1:19501'||!/^application\/json(?:\s*;.*)?$/i.test(h['content-type']??'')))
  throw taskError('STUDY_TASK_ORIGIN_REJECTED');
 const group=h['x-study-group-id'],project=h['x-research-project-id'];
 const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
 if(!scopeOptional||group!==undefined||project!==undefined){if(!valid(group)||!valid(project))throw taskError('STUDY_TASK_SCOPE_INVALID',400,'请选择明确的研究');}
 return {scope:group&&project?{tenantId,studyGroupId:group,researchProjectId:project}:null,
  params:new URL(req.originalUrl??req.url,'http://127.0.0.1').searchParams};
}

// Scoped local assembly only. No legacy Controller, global Guard or Worker changes.
export async function createStudyTaskController({env,ids,require,load,secret,readTaskSynthetic}) {
 if((await assertFixtureTarget(env)).databaseName!=='wp01_test_full_baseline')throw new Error('S08_TARGET_REJECTED');
 const manifests=await withFixtureTransaction(env,'direct',db=>db.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run
  WHERE manifest->>'purpose'='ResearchHub-S08-20261102-task-page'`,{readOnly:true});
 if(manifests.length!==1)throw new Error('S08_FIXTURE_REQUIRED');
 const manifest=manifests[0].manifest;
 assertStudyTaskFixtureBoundary(manifest,{scope:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project},ids:{owner:ids.owner,admin:ids.admin}});
 const boundary=manifest.plan,authorize=createTaskAuthorization({boundary,assertAuthority:load('study-operations/study-task-authority','assertStudyTaskAuthority')});
 const cursor=createTaskCursor(secret);
 const contextDeps={readSynthetic:readTaskSynthetic,allowFormal:false};
 const {Controller,Get,Post,Patch,Put,Req,Res,Body,Param,HttpCode,HttpException}=require('@nestjs/common');
 const scopeTx=(target,operation)=>withFixtureTransaction(env,'app',async db=>{
  await db.$executeRaw`SELECT set_config('app.tenant_id',${target.tenantId},true),set_config('app.study_group_id',${target.studyGroupId},true),set_config('app.research_project_id',${target.researchProjectId},true)`;
  return operation(db);
 });
 const scoped=(req,action,operation)=>{
  const {scope,params}=validateTaskRequest(req,ids.tenant);
  // Fence before selecting the DB scope, then recheck real authority under its lock.
  return scopeTx(scope,async db=>{
   const authority=await authorize(db,req.user,scope,action);
   const created=await db.$queryRaw`SELECT task_id FROM rh_study_tasks.operation WHERE tenant_id=${scope.tenantId}
    AND study_group_id=${scope.studyGroupId} AND research_project_id=${scope.researchProjectId} AND action='create'`;
   return operation(db,{...authority,writableTaskIds:created.map(row=>row.task_id)},params);
  });
 };
 const StudyOperationsService=load('study-operations/study-operations.service','StudyOperationsService');
 const commands=createTaskCommands({transact:scopeTx,authorize,boundary,contextDeps,studyOperations:new StudyOperationsService({
  withTenantTransaction(){throw new Error('S08_NESTED_TRANSACTION_REJECTED');},
 })});
 const known=(req)=>parseTaskQuery(new URL(req.originalUrl??req.url,'http://127.0.0.1').searchParams,[]);
 const handle=error=>{
  error=normalizeTaskFailure(error);
  if(error?.getStatus)throw error;
  if(error?.code?.startsWith('STUDY_TASK_'))throw new HttpException({code:error.code,message:error.message,...(error.fieldErrors?{fieldErrors:error.fieldErrors}:{})},error.status??403);
  throw new HttpException({code:'STUDY_TASK_UNAVAILABLE',message:'任务服务暂不可用，请稍后重试'},503);
 };
 const finish=async(res,operation)=>{res.setHeader('Cache-Control','no-store');try{return await operation();}catch(error){handle(error);}};
 class StudyTaskController {
  async studies(req,res){return finish(res,async()=>{
   const {params}=validateTaskRequest(req,ids.tenant,{scopeOptional:true});
   const query=parseTaskQuery(params,['q','limit','cursor']);
   return scopeTx(boundary.scope,async db=>{
    const authority=await authorize(db,req.user,boundary.scope,'read');
    const candidates=await db.researchProject.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,status:'active',id:{in:[ids.project,boundary.project.id]},...(query.q?{name:{contains:query.q,mode:'insensitive'}}:{})},select:{id:true,name:true,status:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}]});
    const visible=[];
    for(const row of candidates){
     try{await authorize(db,req.user,{...boundary.scope,researchProjectId:row.id},'read');visible.push(row);}
     catch(error){if((error.code??error.getResponse?.()?.code)!=='STUDY_TASK_AUTH_REQUIRED')throw error;}
    }
    const binding={...authority,researchProjectId:'study-selection'},last=query.cursor?cursor.decode(binding,query,query.cursor):null;
    const remaining=visible.filter(row=>!last||row.createdAt<last.createdAt||+row.createdAt===+last.createdAt&&row.id<last.id);
    const items=remaining.slice(0,query.limit);
    return {items:items.map(row=>({id:row.id,name:row.name,status:row.status,studyGroupId:ids.group})),nextCursor:remaining.length>query.limit?cursor.encode(binding,query,items.at(-1)):null};
   });
  });}
  async context(req,res){return finish(res,()=>scoped(req,'read',async(db,authority)=>{
   known(req);
   const actor=await db.account.findFirst({where:{id:authority.actorAccountId,tenantId:ids.tenant},select:{id:true,displayName:true,tenant:{select:{name:true}}}});
   const study=await db.researchProject.findFirst({where:{id:authority.researchProjectId,tenantId:ids.tenant,studyGroupId:ids.group},select:{id:true,name:true}});
   return {scope:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:study.id},study,
    actor:{id:actor.id,displayName:actor.displayName,tenantName:actor.tenant.name,roleLabel:authority.isTenantAdmin?'租户管理员':authority.canConfigure?'Study任务管理者':'科研人员'},
    capabilities:{canCreate:authority.canConfigure,canConfigure:authority.canConfigure,canExecute:authority.canExecute,canReview:authority.canReview,readAll:authority.readAll},syntheticOnly:true};
  }));}
  async list(req,res){return finish(res,()=>scoped(req,'read',(db,authority,params)=>readTaskPage(db,authority,parseTaskQuery(params),cursor)));}
  async participants(req,res){return finish(res,()=>scoped(req,'read',async(db,authority,params)=>{
   const query=parseTaskQuery(params,['q','limit','cursor']);
   const last=query.cursor?cursor.decode({...authority,researchProjectId:authority.researchProjectId+'-participants'},query,query.cursor):null;
   const accounts=await db.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.owner,ids.admin]},status:'active',AND:[
    {OR:[{role:'tenant_admin',isTenantAdmin:true},{role:{notIn:['platform_admin','tenant_admin']},isTenantAdmin:false,researchProjectMemberships:{some:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:authority.researchProjectId,status:'active'}}}]},
    ...(query.q?[{displayName:{contains:query.q,mode:'insensitive'}}]:[]),
    ...(last?[{OR:[{createdAt:{lt:last.createdAt}},{createdAt:last.createdAt,id:{lt:last.id}}]}]:[])]},select:{id:true,displayName:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:query.limit+1});
   const items=accounts.slice(0,query.limit);
   return {items:items.map(a=>({id:a.id,displayName:a.displayName||'未设置姓名'})),nextCursor:accounts.length>query.limit?cursor.encode({...authority,researchProjectId:authority.researchProjectId+'-participants'},query,items.at(-1)):null};
  }));}
  async receipt(req,res,key){return finish(res,()=>scoped(req,'read',(db,authority)=>{known(req);return readTaskReceipt(db,authority,key);}));}
  async linkOptions(req,res){return finish(res,()=>scoped(req,'read',(db,authority,params)=>{
   if(params.getAll('kind').length!==1||!['completion_evidence','synthetic_crf_record','formal_visit'].includes(params.get('kind')))throw taskError('STUDY_TASK_QUERY_INVALID',400,'请选择已支持的关联选项类型');
   const queryParams=new URLSearchParams(params);queryParams.delete('kind');
   const query={...parseTaskQuery(queryParams,['q','limit','cursor']),kind:params.get('kind')};
   return query.kind==='completion_evidence'?readTaskEvidenceOptions(db,authority,query,cursor):readTaskLinkOptions(db,authority,query,cursor,contextDeps);
  }));}
  async detail(req,res,id){return finish(res,()=>scoped(req,'read',(db,authority)=>{known(req);return readTaskDetail(db,authority,id,contextDeps);}));}
  async create(req,res,body){return finish(res,()=>{
   const {scope}=validateTaskRequest(req,ids.tenant);known(req);
   return commands(req.user,scope,parseTaskCommand('create',body));
  });}
  async edit(req,res,body,id){return finish(res,()=>{
   const {scope}=validateTaskRequest(req,ids.tenant);known(req);
   return commands(req.user,scope,parseTaskCommand('edit',body,id));
  });}
  async assign(req,res,body,id){return finish(res,()=>{
   const {scope}=validateTaskRequest(req,ids.tenant);known(req);
   return commands(req.user,scope,parseTaskCommand('assign',body,id));
  });}
  async transition(req,res,body,id){return finish(res,()=>{
   const {scope}=validateTaskRequest(req,ids.tenant);known(req);
   return commands(req.user,scope,parseTaskCommand('transition',body,id));
  });}
  async review(req,res,body,id){return finish(res,()=>{
   const {scope}=validateTaskRequest(req,ids.tenant);known(req);
   return commands(req.user,scope,parseTaskCommand('review',body,id));
  });}
  async remind(req,res,body,id){return finish(res,()=>{
   const {scope}=validateTaskRequest(req,ids.tenant);known(req);
   return commands(req.user,scope,parseTaskCommand('remind',body,id));
  });}
  async link(req,res,body,id){return finish(res,()=>{
   const {scope}=validateTaskRequest(req,ids.tenant);known(req);
   return commands(req.user,scope,parseTaskCommand('link',body,id));
  });}
 }
 for(const [verb,path,name] of [[Post,'','create'],[Patch,':id','edit'],[Post,':id/assignments','assign'],[Post,':id/transitions','transition'],[Post,':id/reviews','review'],[Post,':id/reminders','remind'],[Put,':id/context','link']]){
  verb(path)(StudyTaskController.prototype,name,Object.getOwnPropertyDescriptor(StudyTaskController.prototype,name));
  if(name!=='create')HttpCode(200)(StudyTaskController.prototype,name,Object.getOwnPropertyDescriptor(StudyTaskController.prototype,name));
  Req()(StudyTaskController.prototype,name,0);Res({passthrough:true})(StudyTaskController.prototype,name,1);Body()(StudyTaskController.prototype,name,2);
  if(name!=='create')Param('id')(StudyTaskController.prototype,name,3);
 }
 Controller('study-tasks')(StudyTaskController);
 for(const [path,name,param] of [['studies','studies'],['context','context'],['participants','participants'],['link-options','linkOptions'],['operations/:requestKey','receipt','requestKey'],['','list'],[':id','detail','id']]){
  Get(path)(StudyTaskController.prototype,name,Object.getOwnPropertyDescriptor(StudyTaskController.prototype,name));
  Req()(StudyTaskController.prototype,name,0);Res({passthrough:true})(StudyTaskController.prototype,name,1);
  if(param)Param(param)(StudyTaskController.prototype,name,2);
 }
 return StudyTaskController;
}
