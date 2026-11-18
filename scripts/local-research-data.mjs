import {readFile,unlink} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {createLocalMaterialAccess} from './local-session-materials.mjs';import {createNativeResearchDataPreflight} from './ai-research-data-preflight.mjs';
import {createResearchDataStaging} from '../server/ai-agent/research-data-staging.mjs';
import {createLocalResearchDataImports} from './local-research-data-imports.mjs';
import {createLocalSubjectProfileImports} from './local-subject-profile-imports.mjs';
import {researchDataSourceAllowed} from '../server/ai-agent/research-data-origin.mjs';
export function createLocalResearchData({env,ids,load,require,storage}){
 const imports=createLocalResearchDataImports({env,ids,load,require,storage});
 const profiles=createLocalSubjectProfileImports({env,ids,load,storage});
 if(typeof imports.assertSourceCancellationInTx!=='function')throw Error('DATA_IMPORT_CANCEL_GUARD_REQUIRED');
 const service=createResearchDataStaging({access:createLocalMaterialAccess({env,ids,load}),engine:createNativeResearchDataPreflight({load,require}),storage,assertCancellation:async(...args)=>{await imports.assertSourceCancellationInTx(...args);await profiles.assertSourceCancellationInTx(...args);}});
 const {Controller,Get,Post,Req,Param,Query,Body,UploadedFile,UseInterceptors,HttpException}=require('@nestjs/common'),{FileInterceptor}=require('@nestjs/platform-express'),{diskStorage}=require('multer');
 const {RequireStudyGroup,RequireResearchProject,RequireStudyGroupMenu,RequireStudyGroupPermission}=require(new URL('../../app/server/src/common/decorators.ts',import.meta.url).pathname);
 const only=(v,keys)=>{if(!v||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new HttpException({code:'DATA_INPUT_INVALID',message:'请求内容无效，请核对后重试。'},400);};
 async function invoke(req,fn){
  req.res?.setHeader('Cache-Control','no-store');const h=req.headers??{};
  if(!researchDataSourceAllowed(req))throw new HttpException('请从当前岐研AI页面操作。',403);
  try{return await fn();}catch(e){if(e?.getStatus)throw e;
   const messages={DATA_INPUT_INVALID:'文件或请求格式无效，请核对后重试。',DATA_PREFLIGHT_FORMAT:'请选择CSV或XLSX研究数据。',DATA_PREFLIGHT_CAPACITY:'本批内容超过预检容量，请拆分文件或批次；已保存文件仍保留。',DATA_PREFLIGHT_HEADER:'未找到有效表头，请核对文件。',DATA_SOURCE_CHANGED:'源文件或版本已变化，当前不能使用这份预检。请核对原文件。',DATA_REQUEST_CONFLICT:'该操作对应的文件或范围已不同，请核对原操作。',DATA_VERSION_CONFLICT:'预检状态已变化，请重新获取。',DATA_NOT_FOUND:'预检不存在或无权查看。',HUB_MATERIAL_ACCESS_REJECTED:'当前会话或数据访问权限已失效，请核对后再操作。'};
   Object.assign(messages,{
    DATA_ALREADY_IMPORTED:'这批数据已有入库结果，不能取消原预检。请核对导入结果。',
    DATA_IMPORT_PENDING:'存在待确认的导入，请先核对当前导入状态。',
    DATA_IMPORT_STUDY_MISMATCH:'文件中的研究编号与所选研究不一致，请修正后重新预检。',
    DATA_IMPORT_INPUT_INVALID:'导入请求无效，请重新核对。',
    DATA_IMPORT_SOURCE_CHANGED:'源文件或预检状态已变化，请核对文件及原导入结果。',
    DATA_IMPORT_TARGET_CHANGED:'被试或访视状态已变化，请核对原导入结果和当前记录。',
    DATA_IMPORT_CONFIRMATION_CHANGED:'确认范围或版本已变化，请先核对原导入结果，再重新预检。',
    DATA_IMPORT_PERMISSION_CHANGED:'当前研究的导入授权已失效，请联系研究负责人核对。',
    DATA_IMPORT_OBJECT_FORBIDDEN:'本批包含当前无权使用的被试或访视，请核对访问范围与原导入结果。',
    DATA_IMPORT_MAPPING_REQUIRED:'列与固定表单尚未对应，请核对字段选择；原文件仍保留。',
    DATA_IMPORT_MAPPING_CHANGED:'来源、表单或授权已变化，请重新核对字段；原文件仍保留，本次未导入。',
    DATA_IMPORT_INVALID_ROWS:'本批存在无效记录或已有录入内容，请核对文件及当前访视，避免重复导入。',
    DATA_IMPORT_DUPLICATE_TARGET:'同一被试或访视有重复记录，请修正后重新预检。',
    DATA_IMPORT_FORM_CHANGED:'固定表单已变化，请重新预检。',
    DATA_IMPORT_NOT_FOUND:'导入记录不存在或当前无权查看。',
    DATA_IMPORT_REQUEST_CONFLICT:'该操作已对应其他内容，请核对原操作。',
    DATA_IMPORT_CAPACITY:'本批超过导入容量，请拆分为每批最多100行。',
    DATA_IMPORT_RESULT_RESTRICTED:'导入来源或访问权限已变化，当前不能展示原结果。',
    DATA_ANALYSIS_SOURCE_CHANGED:'本批记录或执行版本已变化，请核对当前原始记录。',
    DATA_ANALYSIS_NOT_IMPORTED:'请先确认本批数据关联的研究并完成导入，再查看概览。',
    DATA_IMPORT_UNIT_REQUIRED:'文件单位与目标表单尚未明确对应，请核对表头单位及研究表单；本次未导入。',
   });
   Object.assign(messages,{PROFILE_IMPORT_SINGLE_FILE_REQUIRED:'本次档案导入只支持单份Excel，请单独上传一份工作簿。',PROFILE_IMPORT_FORMULA_UNSUPPORTED:'档案中包含公式，请将核实后的原始值单独保存为Excel后重新上传。',PROFILE_IMPORT_INPUT_INVALID:'档案请求无效，请重新核对。',PROFILE_IMPORT_SOURCE_CHANGED:'源文件或预检已变化，请核对原文件。',PROFILE_IMPORT_CHANGED:'档案状态已变化，请核对当前结果。',PROFILE_IMPORT_TARGET_CHANGED:'被试档案或研究状态已变化，本次未覆盖，请重新核对。',PROFILE_IMPORT_SUBJECT_FORBIDDEN:'部分被试不存在或不在本人可导入范围内，请核对被试编号。',PROFILE_IMPORT_ROUTE_UNSUPPORTED:'此工作簿不符合档案导入格式，请核对首张工作表及表头。',PROFILE_IMPORT_DUPLICATE_SUBJECT:'有多条记录对应同一被试，请修正后重新上传。',PROFILE_IMPORT_FIELD_INVALID:'部分档案字段无法识别，请核对原始值后重新上传。',PROFILE_IMPORT_MAPPING_REQUIRED:'请逐条确认记录对应的被试编号。',PROFILE_IMPORT_SOURCE_ALREADY_REGISTERED:'该文件已有关联处理任务，请核对原导入结果。',DATA_AGENT_TARGET_REJECTED:'当前研究不可导入，请核对研究权限。',PROFILE_IMPORT_REQUEST_CONFLICT:'本次核对已对应其他内容，请先核对原操作。',PROFILE_IMPORT_HEADER_AMBIGUOUS:'表头存在重名或含义冲突，请修正后重新上传。'});
   const code=e.code??'DATA_SERVICE_UNAVAILABLE';throw new HttpException({code:messages[code]?code:'DATA_SERVICE_UNAVAILABLE',message:messages[code]??'数据服务暂不可用，结果尚未确认。请核对原操作，不要重复上传。'},e.status??503);
  }
 }
 class ResearchDataController{
  profileProbe(req,sid,pid,q){only(q,[]);return invoke(req,()=>profiles.probe(req.user,sid,pid));}
  profileTargets(req,sid,q){only(q,[]);return invoke(req,()=>profiles.targets(req.user,sid));}
  profileCurrent(req,sid,pid,q){only(q,[]);return invoke(req,()=>profiles.current(req.user,sid,pid));}
  profilePrepare(req,sid,body){return invoke(req,()=>profiles.prepare(req.user,sid,body));}
  profileGet(req,sid,pid,q){only(q,[]);return invoke(req,()=>profiles.get(req.user,sid,pid));}
  profileReceipt(req,sid,key,q){only(q,[]);return invoke(req,()=>profiles.receipt(req.user,sid,key));}
  profileConfirm(req,sid,pid,body){return invoke(req,()=>profiles.confirm(req.user,sid,pid,body));}
  profileCancel(req,sid,pid,body){return invoke(req,()=>profiles.cancel(req.user,sid,pid,body));}
  list(req,sid,q){only(q,['limit','cursor']);return invoke(req,()=>service.list(req.user,sid,q));}
  receipt(req,sid,key,q){only(q,[]);return invoke(req,()=>service.receipt(req.user,sid,key));}
  async upload(req,sid,body,file){try{return await invoke(req,async()=>{only(body,['requestKey']);if(!file)throw new HttpException('请选择研究数据文件。',400);return service.upload(req.user,sid,{requestKey:body.requestKey,filename:file.originalname,buffer:await readFile(file.path)});});}finally{if(file?.path)await unlink(file.path).catch(()=>{});}}
  preview(req,sid,body){only(body,['requestKey','files']);return invoke(req,()=>service.preview(req.user,sid,body));}
  current(req,sid,q){only(q,[]);return invoke(req,()=>service.current(req.user,sid));}
  planReceipt(req,sid,key,q){only(q,[]);return invoke(req,()=>service.planReceipt(req.user,sid,key));}
  cancel(req,sid,pid,body){only(body,['version']);return invoke(req,()=>service.cancel(req.user,sid,pid,body));}
  importTargets(req,sid,q){only(q,[]);return invoke(req,()=>imports.service.targets(req.user,sid));}
  importCurrent(req,sid,q){only(q,[]);return invoke(req,()=>imports.service.current(req.user,sid));}
  importPrepare(req,sid,body){return invoke(req,()=>imports.service.prepare(req.user,sid,body));}
  importGet(req,sid,pid,q){only(q,[]);return invoke(req,()=>imports.service.get(req.user,sid,pid));}
  importReceipt(req,sid,key,q){only(q,[]);return invoke(req,()=>imports.service.receipt(req.user,sid,key));}
  importConfirm(req,sid,pid,body){return invoke(req,()=>imports.service.confirm(req.user,sid,pid,body));}
  importCancel(req,sid,pid,body){return invoke(req,()=>imports.service.cancel(req.user,sid,pid,body));}
  importAnalysis(req,sid,pid,q){only(q,[]);return invoke(req,()=>imports.service.analysis(req.user,sid,pid));}
 }
 Controller('sessions')(ResearchDataController);RequireStudyGroup()(ResearchDataController);RequireResearchProject()(ResearchDataController);RequireStudyGroupMenu('workbench')(ResearchDataController);RequireStudyGroupPermission('chat.use')(ResearchDataController);
 const p=ResearchDataController.prototype;
 for(const[name,verb,path]of [['profileTargets',Get,':id/profile-import-targets'],['profileProbe',Get,':id/profile-import-probes/:planId'],['profileCurrent',Get,':id/profile-import-current/:planId'],['profileGet',Get,':id/profile-imports/:planId'],['profileReceipt',Get,':id/profile-imports/receipts/:key'],['profilePrepare',Post,':id/profile-imports'],['profileConfirm',Post,':id/profile-imports/:planId/confirmations'],['profileCancel',Post,':id/profile-imports/:planId/cancellation']]){
  verb(path)(p,name,Object.getOwnPropertyDescriptor(p,name));Req()(p,name,0);Param('id')(p,name,1);
  if(name==='profilePrepare')Body()(p,name,2);else if(name==='profileTargets')Query()(p,name,2);else{Param(name==='profileReceipt'?'key':'planId')(p,name,2);(verb===Post?Body:Query)()(p,name,3);}
 }
 for(const [name,verb,path]of [['list',Get,':id/research-data'],['receipt',Get,':id/research-data/receipts/:key'],['planReceipt',Get,':id/data-preflights/receipts/:key'],['upload',Post,':id/research-data'],['preview',Post,':id/data-preflights'],['current',Get,':id/data-preflights'],['cancel',Post,':id/data-preflights/:planId/cancellation']]){
  const d=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,d);Req()(p,name,0);Param('id')(p,name,1);
  if(['list','current'].includes(name))Query()(p,name,2);
  if(['receipt','planReceipt'].includes(name)){Param('key')(p,name,2);Query()(p,name,3);}
  if(['upload','preview'].includes(name))Body()(p,name,2);
  if(name==='cancel'){Param('planId')(p,name,2);Body()(p,name,3);}
  if(name==='upload'){UploadedFile()(p,name,3);UseInterceptors(FileInterceptor('file',{storage:diskStorage({destination:'/tmp',filename:(_r,_f,done)=>done(null,'rh-data-'+randomUUID())}),limits:{fileSize:25*1024*1024,files:1,fields:1,fieldSize:160,parts:3}}))(p,name,d);}
 }
 for(const[name,verb,path]of [['importTargets',Get,':id/research-data-import-targets'],['importCurrent',Get,':id/research-data-imports'],['importReceipt',Get,':id/research-data-imports/receipts/:key'],['importGet',Get,':id/research-data-imports/:planId'],['importPrepare',Post,':id/research-data-imports'],['importConfirm',Post,':id/research-data-imports/:planId/confirmations'],['importCancel',Post,':id/research-data-imports/:planId/cancellation']]){
  const descriptor=Object.getOwnPropertyDescriptor(p,name);verb(path)(p,name,descriptor);Req()(p,name,0);Param('id')(p,name,1);
  if(['importTargets','importCurrent'].includes(name))Query()(p,name,2);
  else if(name==='importPrepare')Body()(p,name,2);
  else{Param(name==='importReceipt'?'key':'planId')(p,name,2);if(['importGet','importReceipt'].includes(name))Query()(p,name,3);else Body()(p,name,3);}
 }
 {const name='importAnalysis',d=Object.getOwnPropertyDescriptor(p,name);Get(':id/research-data-imports/:planId/analysis')(p,name,d);Req()(p,name,0);Param('id')(p,name,1);Param('planId')(p,name,2);Query()(p,name,3);}
 return{Controller:ResearchDataController,service,imports,profiles,readImportSubjectsInTx:imports.readSubjectsInTx};
}
