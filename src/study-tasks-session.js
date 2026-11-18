const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const fail=(code='STUDY_TASK_INVALID_RESPONSE',status=400,message='任务信息无法确认，请刷新后重新核对。')=>Object.assign(new Error(message),{code,status});
const abort=()=>Object.assign(new Error('身份或研究已切换，旧请求已丢弃'),{name:'AbortError'});
const scopeHeaders=scope=>{
 if(!scope||!validId(scope.studyGroupId)||!validId(scope.researchProjectId)||Object.keys(scope).some(k=>!['studyGroupId','researchProjectId'].includes(k)))throw fail();
 return {'X-Study-Group-Id':scope.studyGroupId,'X-Research-Project-Id':scope.researchProjectId};
};
export function readStudyTaskLocation(search) {
 const p=new URLSearchParams(search);
 if([...p.keys()].some(key=>!['studyGroupId','researchProjectId','taskId'].includes(key)))throw fail();
 for(const key of ['studyGroupId','researchProjectId','taskId'])if(p.getAll(key).length>1)throw fail();
 const scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')};scopeHeaders(scope);
 const taskId=p.get('taskId');if(taskId&&!validId(taskId))throw fail();
 return {scope,taskId};
}
export const isStudyTaskRoute=(pageId,search='')=>pageId==='s08'&&new URLSearchParams(search).has('studyGroupId');
export function studyTasksHeader(config,search){
 let scope;try{scope=readStudyTaskLocation(search).scope;}catch{return {...config,title:'执行任务',description:'研究范围无效，请从我的工作台重新选择',meta:'',actions:[]};}
 return {...config,title:'执行任务',description:'核对当前Study的真实任务，创建、分派、执行与验收。',meta:"合成数据演练",
  crumbs:[['我的工作台','p01'],['Study概览'],['执行任务']],actions:[['返回概览','s01',false,false,scope]]};
}
export function studyTasksUrl(scope,taskId) {
 scopeHeaders(scope);if(taskId&&!validId(taskId))throw fail();
 return '/pages/s08/?'+new URLSearchParams({...scope,...(taskId?{taskId}:{})});
}
const cursorValid=value=>value===null||typeof value==='string'&&value.length<=2048&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
function page(value,validate) {
 if(!value||!Array.isArray(value.items)||value.items.length>20||!cursorValid(value.nextCursor)||!value.items.every(validate))throw fail();
 return value;
}
const taskValid=t=>validId(t?.id)&&typeof t.name==='string'&&Number.isSafeInteger(t.version)&&t.version>=0&&
 ['open','in_progress','blocked','completed','cancelled'].includes(t.status)&&['not_required','not_submitted','pending_review','accepted','returned'].includes(t.reviewStatus)&&
 typeof t.capabilities?.canConfigure==='boolean'&&Array.isArray(t.capabilities.transitions);
export function createStudyTaskClient({fetchImpl=globalThis.fetch,timeoutMs=15000}={}) {
 let epoch=0,lifetime=new AbortController();
 const invalidate=()=>{epoch++;lifetime.abort();lifetime=new AbortController();};
 async function request(path,{scope,query={},signal,method='GET',body}={}) {
  const token=epoch,params=new URLSearchParams();
  for(const [key,value] of Object.entries(query)){
   if(!['q','status','reviewStatus','assigneeAccountId','overdue','limit','cursor','kind'].includes(key)||Array.isArray(value)||typeof value==='object')throw fail();
   if(value!==undefined&&value!=='')params.set(key,String(value));
  }
  const combined=AbortSignal.any([lifetime.signal,AbortSignal.timeout(timeoutMs),...(signal?[signal]:[])]);
  let response;
  try{response=await fetchImpl('/api/study-tasks'+path+(params.size?'?'+params:''),{
   method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:combined,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(scope?scopeHeaders(scope):{})},...(body?{body:JSON.stringify(body)}:{}),
  });}catch(error){if(token!==epoch||signal?.aborted)throw abort();throw fail('STUDY_TASK_NETWORK',0,'连接中断或超时，请重试读取；不会回退演示数据。');}
  if(token!==epoch||combined.aborted)throw abort();
  let data;try{data=await response.json();}catch{throw fail();}
  if(token!==epoch||combined.aborted)throw abort();
  if(!response.ok){
   if([401,403].includes(response.status))invalidate();
   throw fail(typeof data?.code==='string'?data.code:'STUDY_TASK_UNAVAILABLE',response.status,response.status===401?'登录已失效，请重新登录。':response.status===403?'当前账号无权访问这项研究或任务。':response.status===409?'任务已变化，请刷新核对。':'任务服务暂不可用，请稍后重试。');
  }
  return data;
 }
 return {
  invalidate,
  loadTaskPage:async(scope,query={},signal)=>page(await request('',{scope,query,signal}),taskValid),
  loadStudies:async(query={},signal)=>page(await request('/studies',{query,signal}),s=>validId(s?.id)&&validId(s.studyGroupId)&&typeof s.name==='string'),
  loadParticipants:async(scope,query={},signal)=>page(await request('/participants',{scope,query,signal}),p=>validId(p?.id)&&typeof p.displayName==='string'),
  loadEvidenceOptions:async(scope,query={},signal)=>{
   const value=await request('/link-options',{scope,query:{...query,kind:'completion_evidence'},signal});
   page(value,item=>item?.kind==='artifact_version'&&validId(item.artifactId)&&Number.isSafeInteger(item.version)&&item.version>0&&typeof item.title==='string'&&['contentHash','sourceSnapshotHash'].every(key=>typeof item[key]==='string'&&/^[a-f0-9]{64}$/.test(item[key])));
   if(!['available','restricted'].includes(value.availability))throw fail();return value;
  },
  loadLinkOptions:async(scope,query={},signal)=>{
   if(!['synthetic_crf_record','formal_visit'].includes(query.kind))throw fail();
   const value=await request('/link-options',{scope,query,signal});
   page(value,item=>item?.kind==='synthetic_crf_record'&&validId(item.sourceId)&&validId(item.parentId)&&validId(item.rootId)&&Number.isSafeInteger(item.sourceVersion)&&typeof item.sourceHash==='string'&&/^[a-f0-9]{64}$/.test(item.sourceHash)&&item.context?.sourceId===item.sourceId);
   if(!['available','restricted','local_synthetic_only'].includes(value.availability))throw fail();return value;
  },
  loadContext:async(scope,signal)=>{const v=await request('/context',{scope,signal});if(v?.scope?.studyGroupId!==scope.studyGroupId||v.scope.researchProjectId!==scope.researchProjectId||!validId(v.actor?.id)||typeof v.actor.displayName!=='string'||typeof v.capabilities?.canCreate!=='boolean')throw fail();return v;},
  loadTask:async(scope,id,signal)=>{if(!validId(id))throw fail();const v=await request('/'+id,{scope,signal});if(!taskValid(v?.item)||!Array.isArray(v.item.history))throw fail();return v;},
  loadReceipt:async(scope,key,signal)=>{if(!/^[A-Za-z0-9_-]{8,128}$/.test(key))throw fail();const v=await request('/operations/'+key,{scope,signal});if(!validId(v?.operationId)||!validId(v.taskId)||!Number.isSafeInteger(v.version)||v.version<0)throw fail();return v;},
  mutateTask:async(scope,action,input,taskId,signal)=>{
   const routes={create:['','POST'],edit:['/'+taskId,'PATCH'],assign:['/'+taskId+'/assignments','POST'],transition:['/'+taskId+'/transitions','POST'],review:['/'+taskId+'/reviews','POST'],remind:['/'+taskId+'/reminders','POST'],link:['/'+taskId+'/context','PUT']};
   if(!routes[action]||action!=='create'&&!validId(taskId)||!/^[A-Za-z0-9_-]{8,128}$/.test(input?.requestKey))throw fail();
   const [path,method]=routes[action];
   try{
    const value=await request(path,{scope,body:input,method,signal});
    if(!validId(value?.operationId)||!validId(value.taskId)||!Number.isSafeInteger(value.version)||value.version<0)throw fail();
    return value;
   }catch(error){
    if(error.name==='AbortError')throw error;
    if(error.code==='STUDY_TASK_NETWORK'||error.code==='STUDY_TASK_INVALID_RESPONSE'||error.status>=500)
     throw Object.assign(fail('STUDY_TASK_RESULT_UNKNOWN',0,'提交结果尚未确认；请先核对原提交回执，不会自动重试或换编号。'),{requestKey:input.requestKey});
    throw error;
   }
  },
 };
}
