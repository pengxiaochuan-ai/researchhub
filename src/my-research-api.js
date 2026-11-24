import {myResearchDraftLink} from './my-research-draft-route.js';
const invalid=()=>{throw Object.assign(new Error('首页数据无法核对，请刷新后重试。'),{code:'MY_RESEARCH_INVALID_RESPONSE'});};
const str=value=>typeof value==='string'&&value.length>0;
const list=value=>Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
function validateEnrollment(value){
 if(!value||!date(value.asOf)||value.windowDays!==14||!['available','not_available'].includes(value.centerPlans)||!['ready','restricted'].includes(value.status)||!list(value.projects)||value.status==='restricted'&&value.projects.length)invalid();
 const validMetrics=row=>row&&
   [row.actual,row.active,row.previous14,row.last14].every(count)&&row.active<=row.actual&&
   (row.target===null||count(row.target))&&
   [row.planStart,row.planEnd].every(day=>day===null||date(day))&&
   (row.expected===null||Number.isFinite(row.expected)&&row.expected>=0)&&
   [null,'behind_plan','target_overdue'].includes(row.alert)&&
   (row.alert!=='behind_plan'||row.expected!==null)&&(row.alert!=='target_overdue'||row.target!==null);
 for(const row of value.projects){
  if(!validMetrics(row)||!id(row.studyGroupId)||!id(row.researchProjectId)||!str(row.title))invalid();
  if(row.centers===undefined)continue;
  if(typeof row.centersRestricted!=='boolean'||!id(row.studyId)||!list(row.centers)||
   !(row.remainingTarget===null||Number.isSafeInteger(row.remainingTarget))||row.centersRestricted&&row.remainingTarget!==null||
   !row.centers.every(c=>validMetrics(c)&&id(c.id)&&str(c.code)&&str(c.name)&&typeof c.enabled==='boolean'&&(c.planVersion===null||count(c.planVersion)&&c.planVersion>0))||
   row.unassigned!==null&&(!row.unassigned||!['actual','active','last14','previous14'].every(key=>count(row.unassigned[key])))||
   row.centersRestricted&&row.unassigned!==null)invalid();
 }
}

export function validateMyResearchOverview(value){
 if(!value||!str(value.profile?.displayName)||!str(value.profile?.tenantName)||!list(value.studyGroups)||!list(value.drafts)||!list(value.tasks)||!list(value.activity)||!['projectCount','ownDraftCount','myOpenTaskCount'].every(key=>count(value.summary?.[key])))invalid();
 for(const group of value.studyGroups){if(!str(group?.id)||!str(group.name)||!list(group.projects))invalid();for(const p of group.projects)if(!str(p?.id)||!str(p.name)||typeof p.canReadDrafts!=='boolean'||typeof p.canReadTasks!=='boolean'||typeof p.canOpenDesignWorkspace!=='boolean')invalid();}
 for(const d of value.drafts)if(!str(d?.id)||!str(d.title)||!str(d.studyGroupId)||!str(d.researchProjectId)||!str(d.updatedAt)||!count(d.version)||typeof d.canOpenPlanFlow!=='boolean')invalid();
 for(const draft of value.drafts)try{myResearchDraftLink(draft);}catch{invalid();}
 for(const task of value.tasks)if(!str(task?.id)||!str(task.title)||!str(task.studyGroupId)||!str(task.researchProjectId)||!str(task.status))invalid();
 for(const event of value.activity)if(!str(event?.id)||!str(event.title)||!str(event.updatedAt))invalid();
 if(value.pagination!==undefined)for(const kind of ['drafts','tasks']){const p=value.pagination?.[kind];if(!p||!Number.isSafeInteger(p.page)||p.page<1||p.page>100000||p.pageSize!==5||typeof p.hasNext!=='boolean')invalid();}
 if(value.enrollment!==undefined)validateEnrollment(value.enrollment);
 return value;
}

export async function fetchMyResearchOverview({fetchImpl=globalThis.fetch,signal,timeoutMs=15000,draftPage,taskPage}={}){
 const query=new URLSearchParams();for(const [key,value] of Object.entries({draftPage,taskPage})){if(value===undefined)continue;if(!Number.isSafeInteger(value)||value<1||value>100000)invalid();query.set(key,String(value));}
 const timeout=AbortSignal.timeout(timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 let response;
 try{
  response=await fetchImpl('/api/my-research/overview'+(query.size?'?'+query:''),{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:combined});
  if(response.status===401)throw Object.assign(new Error('请先登录后查看我的工作台。'),{code:'MY_RESEARCH_UNAUTHENTICATED',status:401});
  if(!response.ok)throw Object.assign(new Error('首页数据暂时不可用，请重试。'),{code:'MY_RESEARCH_UNAVAILABLE',status:response.status});
  return validateMyResearchOverview(await response.json());
 }catch(error){
  if(signal?.aborted)throw signal.reason??Object.assign(new Error('请求已取消'),{name:'AbortError'});
  if(timeout.aborted)throw Object.assign(new Error('首页数据读取超时，请重试。'),{code:'MY_RESEARCH_TIMEOUT'});
  if(error?.code)throw error;
  if(error?.name==='AbortError')throw error;
  throw Object.assign(new Error('无法连接首页数据服务，请稍后重试。'),{code:'MY_RESEARCH_NETWORK'});
 }
}
