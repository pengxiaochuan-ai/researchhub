import {readPublicAcademicRoute,safeAcademicReturn} from './academic-content-route.js';

export const PUBLIC_ACTIVITY_CATEGORIES=['registration','publication','guidance','organization','researcher','platform_content'];
const invalid=()=>{throw new Error('领域动态暂时无法读取，请重试。');};
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const dayOf=value=>date.format(new Date(value));
const validTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
export const activityDate=(day,calculatedAt)=>day===dayOf(calculatedAt)?'今天':day;
function validHref(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\r\n]/.test(value))return false;
 try{const url=new URL(value,'https://activity.invalid');if(url.hash)return false;if(url.pathname==='/pages/p011/')return Boolean(readPublicAcademicRoute(url.search)?.id);return Boolean(safeAcademicReturn(value)&&url.searchParams.has('contentId'));}catch{return false;}
}
export function validatePublicActivity(data,{limit=6}={}){
 if(!data||data.scope!=='CURRENT_HUB_APPROVED_PUBLIC_INDEXED'||data.timezone!=='Asia/Shanghai'||!validTime(data.calculatedAt)||!['ready','partial'].includes(data.status)||!Array.isArray(data.items)||data.items.length>limit)invalid();
 for(const category of PUBLIC_ACTIVITY_CATEGORIES){const s=data.categoryStatuses?.[category];if(!s||!['ready','unavailable'].includes(s.status)||!['complete','partial','unknown'].includes(s.coverage)||!['complete','partial','unknown'].includes(s.dateCoverage))invalid();if(data.status==='ready'&&(s.status!=='ready'||s.coverage!=='complete'||s.dateCoverage!=='complete'))invalid();}
 const ids=new Set();
 for(const item of data.items){
  if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||!PUBLIC_ACTIVITY_CATEGORIES.includes(item.category)||!['aggregate','content'].includes(item.kind)||!validTime(item.eventAt)||Date.parse(item.eventAt)>Date.parse(data.calculatedAt)||item.day!==dayOf(item.eventAt)||typeof item.title!=='string'||!item.title.trim()||typeof item.summary!=='string')invalid();
  ids.add(item.id);
  if(item.kind==='aggregate'&&(item.category==='platform_content'||!Number.isSafeInteger(item.count)||item.count<1||item.href!=null))invalid();
  if(item.kind==='content'&&(item.category!=='platform_content'||item.href!=null&&!validHref(item.href)))invalid();
 }
 return data;
}
export async function fetchPublicActivity({hubKey='lingshu-xinyu',limit=6,signal,fetchImpl=globalThis.fetch,timeoutMs=15000}={}){
 if(typeof hubKey!=='string'||!/^[a-z0-9][a-z0-9-]{0,99}$/.test(hubKey)||![4,6].includes(limit))throw new Error('领域动态请求参数无效。');
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(()=>controller.abort(new DOMException('读取超时','TimeoutError')),timeoutMs);
 try{controller.signal.throwIfAborted();const response=await fetchImpl(`/api/hubs/${encodeURIComponent(hubKey)}/public-activity?limit=${limit}`,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});if(!response.ok)invalid();const data=await response.json();controller.signal.throwIfAborted();return validatePublicActivity(data,{limit});}
 finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
