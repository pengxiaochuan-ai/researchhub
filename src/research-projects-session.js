const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
export function isResearchProjectRoute(page,search=''){
 const p=new URLSearchParams(search);
 if(page==='q01'&&p.has('researchPlanId'))return false;
 return page==='q01'&&p.has('researchCreation')||page==='q02'&&p.has('researchProjects')||page==='s01'&&p.has('researchStudy');
}
export function readResearchProjectRoute(page,search=''){
 if(!isResearchProjectRoute(page,search))return null;
 const p=new URLSearchParams(search),marker={q01:'researchCreation',q02:'researchProjects',s01:'researchStudy'}[page],idKey=page==='q01'?'projectIntentId':page==='s01'?'studyId':null;
 const allowed=new Set([marker,...(idKey?[idKey]:[])]);
 if([...p.keys()].some(key=>!allowed.has(key)||p.getAll(key).length!==1)||p.get(marker)!=='1'||idKey&&(p.has(idKey)&&!valid(p.get(idKey))||page==='s01'&&!p.has(idKey)))throw Error('此课题链接无效，请从我的课题重新进入。');
 return{kind:page==='q01'?'creation':page==='q02'?'list':'study',id:idKey?p.get(idKey):null};
}
export function researchProjectUrl(id){if(id!=null&&!valid(id))throw Error('课题标识无效');return'/pages/q01/?'+new URLSearchParams({researchCreation:'1',...(id?{projectIntentId:id}:{})});}
export function researchStudyUrl(id){if(!valid(id))throw Error('研究标识无效');return'/pages/s01/?'+new URLSearchParams({researchStudy:'1',studyId:id});}
export const researchProjectsUrl='/pages/q02/?researchProjects=1';
export function researchCreationHeader(config,page,search){
 if(!isResearchProjectRoute(page,search))return config;
 return{...config,workspace:'我的工作台',title:page==='q01'?'研究课题':page==='q02'?'我的课题与草稿':'研究概览',description:page==='q01'?'明确研究问题，保存后继续研究准备。':page==='q02'?'查看已保存课题，继续编辑或进入研究。':'查看当前研究与准备情况。',meta:'',actions:[],nav:undefined,crumbs:[['我的工作台','p01'],['我的课题','q02',{researchProjects:'1'}],...(page==='q02'?[]:[[page==='q01'?'研究课题':'研究概览']])],hide:page==='q01'?['.platform-hero']:config.hide};
}
export function createResearchProjectsClient({fetchImpl=globalThis.fetch,onAccessLost=()=>{}}={}){
 let epoch=0;
 return{invalidate(){epoch++;},async request(path,{method='GET',body,signal}={}){
  const token=epoch;let response;
  try{const deadline=AbortSignal.timeout(20000);response=await fetchImpl('/api'+path,{method,credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,deadline]):deadline,headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
  catch(cause){if(token!==epoch)throw Object.assign(Error('登录状态已变化，请重新核对。'),{code:'RESEARCH_STALE'});throw Object.assign(Error('连接中断，请检查网络后重试。'),{unknown:method!=='GET',cause});}
  const data=await response.json().catch(()=>null);
  if(token!==epoch)throw Object.assign(Error('登录状态已变化，请重新核对。'),{code:'RESEARCH_STALE'});
  if(!response.ok){const error=Object.assign(Error(data?.message||({401:'登录已失效，请重新登录。',403:'当前账号无权继续此操作。',404:'此课题不存在或当前无权访问。',409:'课题已有更新，当前输入已保留，请核对最新版本。'})[response.status]||'暂时无法完成请求，请稍后重试。'),{status:response.status,code:data?.code,unknown:method!=='GET'&&response.status>=500});const missingPreparationReceipt=method==='GET'&&/^\/research-projects\/receipts\/[A-Za-z0-9_-]+(?:\?|$)/.test(path)&&response.status===404&&data?.code!=='RESEARCH_NOT_FOUND';if([401,403,404].includes(response.status)&&!missingPreparationReceipt){epoch++;onAccessLost(error);}throw error;}
  if(!data||typeof data!=='object')throw Object.assign(Error('未能确认操作结果，请重试核对。'),{unknown:method!=='GET'});
  return data;
 }};
}
export function createProjectMutation({request,key=()=>crypto.randomUUID()}){
 let pending=null;
 async function execute(){const current=pending;try{const result=await request(current.path,{method:current.method,body:current.body});if(pending===current)pending=null;return result;}catch(error){if(!error.unknown&&pending===current)pending=null;throw error;}}
 return{pending:()=>pending,clear(){pending=null;},async submit(path,method,body){if(pending)throw Error('上次操作结果待确认，请先重试核对。');pending={path,method,body:{...body,requestKey:key()}};return execute();},retry(){if(!pending)throw Error('没有待确认操作。');return execute();}};
}
// Refresh the range the user already opened, using fresh server authorization.
// Old rows are never merged into this result: revoked rows must disappear.
export async function readResearchProjectRange(request,loadedCount=0){
 const desired=Math.max(20,Number.isSafeInteger(loadedCount)&&loadedCount>0?loadedCount:0),items=[],seen=new Set();let cursor=null;
 do{const params=new URLSearchParams({limit:String(Math.min(100,desired-items.length))});if(cursor)params.set('cursor',cursor);const page=await request('/research-projects?'+params);items.push(...page.items);cursor=page.nextCursor??null;if(cursor){if(seen.has(cursor))throw Error('课题列表暂时无法继续，请重新读取。');seen.add(cursor);}}while(cursor&&items.length<desired);
 return{items,nextCursor:cursor};
}
