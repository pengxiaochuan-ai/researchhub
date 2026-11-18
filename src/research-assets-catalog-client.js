import {reportAssetRequestAllowed} from './report-asset-context.js';
import {reportQaRequestAllowed} from './report-asset-qa.js';
import {assetDetailAiRequestAllowed} from './research-assets-detail-ai.js';
import {assetReuseRequestAllowed} from './research-assets-reuse.js';
import {assetFileRequestAllowed,validateAssetDownload} from './research-assets-detail-files.js';
import {commentRequestAllowed} from './research-assets-comments.js';
import {createKnowledgeClient,ApiError} from './knowledge-session.js';
import {catalogRequestAllowed} from './research-assets-catalog-session.js';
import {assetRegistrationRequestAllowed,assetRegistrationHeaders} from './research-assets-registration.js';
import {assetUsageRequestAllowed} from './research-assets-usage.js';
import {assetGovernanceRequestAllowed} from './research-assets-governance.js';
import {assetViewRequestAllowed} from './research-assets-views.js';
import {assetLifecycleRequestAllowed} from './research-assets-lifecycle.js';
import {assetDetailRequestAllowed} from './research-assets-detail.js';
export function createAssetCatalogClient({user,scope,fetchImpl=globalThis.fetch}){
 const readHeaders=assetRegistrationHeaders(user),writeHeaders=assetRegistrationHeaders(user,true),fixedScope={...scope};
 if(!fixedScope.studyGroupId||!fixedScope.researchProjectId)throw new ApiError('请先选择当前研究。',403);
 function pinned(url,init){
  const path=typeof url==='string'&&url.startsWith('/api/')?url.slice(4):'',method=init?.method??'GET';
  if(!reportQaRequestAllowed(method,path)&&!reportAssetRequestAllowed(method,path)&&!assetDetailAiRequestAllowed(method,path)&&!catalogRequestAllowed(method,path)&&!assetRegistrationRequestAllowed(method,path)&&!assetGovernanceRequestAllowed(method,path)&&!assetUsageRequestAllowed(method,path)&&!assetViewRequestAllowed(method,path)&&!assetLifecycleRequestAllowed(method,path)&&!assetDetailRequestAllowed(method,path)&&!commentRequestAllowed(method,path)&&!assetFileRequestAllowed(method,path)&&!assetReuseRequestAllowed(method,path))throw new ApiError('无效的资产请求路径。',400);
  return fetchImpl(url,{...init,headers:{...init.headers,...(method==='GET'?readHeaders:writeHeaders),'X-Study-Group-Id':fixedScope.studyGroupId,'X-Research-Project-Id':fixedScope.researchProjectId}});
 }
 const base=createKnowledgeClient({scope:()=>fixedScope,fetchImpl:pinned});
 return{get:base.get,post:base.post,
  async download(path,options={}){
   if(!assetFileRequestAllowed('GET',path)||!path.includes('?requestKey='))throw new ApiError('无效的固定文件路径。',400);
   let response;try{response=await pinned('/api'+path,{method:'GET',headers:{...writeHeaders,Accept:'text/plain, text/markdown'},credentials:'same-origin',cache:'no-store',redirect:'error',signal:options.signal??AbortSignal.timeout(30000)});}catch(e){if(e instanceof ApiError)throw e;throw new ApiError('文件连接中断，请重试原文件操作。');}
   return validateAssetDownload(response,options);
  },
  async upload(path,form){
   if(path!=='/research-assets/uploads'||!(form instanceof FormData))throw new ApiError('无效的资产文件请求。',400);
   let response;try{response=await pinned('/api'+path,{method:'POST',headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(120000),body:form});}catch(e){if(e instanceof ApiError)throw e;throw new ApiError('文件暂存连接中断；请保留原文件核对重试。');}
   if(!response.headers.get('Content-Type')?.includes('application/json'))throw new ApiError('文件暂存响应无法核对，请保留原文件。');
   let value;try{value=await response.json();}catch{throw new ApiError('文件暂存响应无法解析，请保留原文件。');}
   if(!response.ok)throw new ApiError(typeof value.message==='string'?value.message:'文件暂存失败，请保留原文件核对。',response.status,value.code??'');return value;
  }
 };
}
