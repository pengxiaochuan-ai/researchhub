import {myResearchDraftLink} from './my-research-draft-route.js';
const invalid=()=>{throw Error('报告版本或来源无法核对，请重新读取草稿列表。');};
export function myResearchReportPath(draft){
 const kind=draft.workspace?.kind;if(!['trial-report','edc-report','method-report'].includes(kind))return null;
 myResearchDraftLink(draft);
 if(!Number.isSafeInteger(draft.version)||draft.version<1||draft.version>30)invalid();
 const w=draft.workspace,base='/research-plan-drafts/'+w.planId;
 if(kind==='trial-report')return base+'/synthetic-trials/'+w.runId+'/report-draft/versions/'+draft.version;
 return base+'/synthetic-collections/'+w.collectionId+(kind==='method-report'?'/method-runs/'+w.runId:'')+'/report-drafts/'+draft.id+'/versions/'+draft.version;
}
export async function fetchMyResearchReport(draft,{fetchImpl=globalThis.fetch,signal,timeoutMs=15000}={}){
 const path=myResearchReportPath(draft);if(!path)invalid();
 const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 try{
  const response=await fetchImpl('/api'+path,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json','X-Study-Group-Id':draft.studyGroupId,'X-Research-Project-Id':draft.researchProjectId},signal:combined});
  if(!response.ok)throw Object.assign(Error([401,403,404].includes(response.status)?'当前无法读取此报告，请重新核对身份与草稿列表。':'报告读取失败，请重试；未修改原报告。'),{status:response.status});
  const data=await response.json();
  if(data?.id!==draft.id||data.version!==draft.version||!Number.isSafeInteger(data.currentVersion)||data.currentVersion<data.version||!['current','stale'].includes(data.sourceStatus)||typeof data.contentMd!=='string'||!Array.isArray(data.sourceRows)||data.sourceRows.some(s=>!s||typeof s.sourceType!=='string'||typeof s.sourceId!=='string'||typeof s.hash!=='string'||!/^[a-f0-9]{64}$/.test(s.hash)))invalid();
  return {id:data.id,version:data.version,currentVersion:data.currentVersion,sourceStatus:data.sourceStatus,contentMd:data.contentMd,sourceRows:data.sourceRows};
 }catch(error){if(signal?.aborted)throw signal.reason??error;if(timeout.aborted)throw Error('报告读取超时，请重试。');throw error;}
}
