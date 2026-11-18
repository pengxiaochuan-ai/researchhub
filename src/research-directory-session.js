const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const invalid=()=>{throw Object.assign(Error('课题列表暂时无法核对，请重新读取。'),{code:'RESEARCH_DIRECTORY_INVALID_RESPONSE'});};
function allowedLink(value){
 if(typeof value!=='string'||!value.startsWith('/pages/')||/[\\\r\n]/.test(value))return false;
 let url;try{url=new URL(value,'http://directory.local');}catch{return false;}
 if(url.origin!=='http://directory.local'||url.hash)return false;const p=url.searchParams;
 const exact=keys=>[...p.keys()].length===keys.length&&keys.every(k=>p.getAll(k).length===1);
 return url.pathname==='/pages/q01/'&&exact(['researchCreation','projectIntentId'])&&p.get('researchCreation')==='1'&&identifier(p.get('projectIntentId'))||
  url.pathname==='/pages/s01/'&&(exact(['researchStudy','studyId'])&&p.get('researchStudy')==='1'&&identifier(p.get('studyId'))||exact(['studyGroupId','researchProjectId'])&&identifier(p.get('studyGroupId'))&&identifier(p.get('researchProjectId')));
}
export function validateResearchDirectory(value){
 if(!value||!Array.isArray(value.items)||!Number.isSafeInteger(value.total)||value.total<value.items.length||!(value.nextCursor===null||typeof value.nextCursor==='string'&&value.nextCursor.length>0&&value.nextCursor.length<=2048)||typeof value.capabilities?.canCreateProject!=='boolean')invalid();
 const seen=new Set();for(const item of value.items){
  if(!item||!identifier(item.id)||!['intent','execution'].includes(item.kind)||typeof item.key!=='string'||!/^(intent|execution):[A-Za-z0-9_-]{1,160}$/.test(item.key)||seen.has(item.key)||typeof item.title!=='string'||!item.title||typeof item.summary!=='string'||typeof item.status!=='string'||typeof item.updatedAt!=='string'||!Number.isFinite(Date.parse(item.updatedAt))||!allowedLink(item.links?.primary)||typeof item.capabilities?.canEdit!=='boolean'||typeof item.capabilities?.canOpenStudy!=='boolean')invalid();
  if(item.links.edit!==undefined&&!allowedLink(item.links.edit)||item.links.overview!==undefined&&!allowedLink(item.links.overview))invalid();
  seen.add(item.key);
 }
 if(value.nextCursor&&!value.items.length)invalid();return value;
}
// Re-read the visible range from its beginning. Revoked rows are never retained by merging old pages.
export async function readResearchDirectoryRange(request,{count=20,query='',signal}={}){
 if(!Number.isSafeInteger(count)||count<1||typeof query!=='string'||query.length>200)invalid();
 const items=[],keys=new Set(),cursors=new Set();let cursor=null,total,capabilities;
 do{
  const limit=Math.min(100,count-items.length),params=new URLSearchParams({limit:String(limit)});if(query.trim())params.set('q',query.trim());if(cursor)params.set('cursor',cursor);
  const page=validateResearchDirectory(await request('/research-directory?'+params,{signal}));if(page.items.length>limit)invalid();
  if(total!==undefined&&total!==page.total)throw Object.assign(Error('课题列表发生变化，请重新读取。'),{code:'RESEARCH_DIRECTORY_CHANGED'});
  total=page.total;capabilities=page.capabilities;for(const item of page.items){if(keys.has(item.key))invalid();keys.add(item.key);items.push(item);}cursor=page.nextCursor;
  if(cursor){if(cursors.has(cursor))invalid();cursors.add(cursor);}
 }while(cursor&&items.length<count);
 return{items,total,nextCursor:cursor,capabilities};
}
export async function readResearchExecution(request,scope,{signal}={}){
 if(!identifier(scope?.studyGroupId)||!identifier(scope?.researchProjectId))invalid();
 const value=await request('/research-directory/execution/'+encodeURIComponent(scope.researchProjectId)+'?'+new URLSearchParams({studyGroupId:scope.studyGroupId}),{signal});
 if(!value||value.group?.id!==scope.studyGroupId||value.project?.id!==scope.researchProjectId||value.project.studyGroupId!==scope.studyGroupId||typeof value.group.name!=='string'||typeof value.project.name!=='string'||typeof value.profile?.displayName!=='string'||typeof value.profile?.tenantName!=='string'||value.capabilities?.canOpenStudy!==true||['canReadDrafts','canReadTasks','canOpenDesignWorkspace'].some(k=>typeof value.project[k]!=='boolean'))invalid();
 return value;
}
