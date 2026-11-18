import {operationPayload,canonicalContent,normalizeDraft} from '../server/academic-content/contract.mjs';
const base='/api/hubs/lingshu-xinyu',readBase=audience=>(audience==='public'?'/api/public/hubs/lingshu-xinyu':base)+'/academic-content',manage=base+'/content-management';
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const content=v=>{try{return Boolean(v&&validId(v.id)&&Number.isSafeInteger(v.revision)&&v.revision>0&&['draft','published','withdrawn'].includes(v.status)&&v.draft&&normalizeDraft(v.draft));}catch{return false;}};
const mismatch=(unknown=false)=>Object.assign(Error('内容结果无法核对，请保留原输入后重新核对。'),{code:'CONTENT_RESPONSE_INVALID',unknown});
async function proof(op){const payload=operationPayload(op.action,op.id,op.body),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalContent(payload)));return{action:op.action,baseRevision:op.action==='create'?0:op.body.baseRevision,requestHash:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')};}
function matches(value,op,p){return content(value?.content)&&value.content.revision===p.baseRevision+1&&(op.id==null||value.content.id===op.id)&&value.receipt?.contentId===value.content.id&&value.receipt?.action===op.action&&value.receipt.baseRevision===p.baseRevision&&value.receipt.requestKey===op.body.requestKey&&value.receipt.requestHash===p.requestHash&&(op.action!=='publish'||value.content.status==='published')&&(op.action!=='withdraw'||value.content.status==='withdrawn');}
const reading=v=>v&&validId(v.id)&&typeof v.title==='string'&&typeof v.body==='string'&&typeof v.summary==='string'&&['public','members'].includes(v.audience)&&Array.isArray(v.resources)&&v.resources.every(r=>typeof r.label==='string'&&/^[A-Za-z0-9_-]{1,220}$/.test(r.key));
const card=v=>v&&validId(v.id)&&typeof v.title==='string'&&typeof v.summary==='string'&&['public','members'].includes(v.audience);
export function academicResourceHref(audience,id,key){if(!validId(id)||typeof key!=='string'||!/^[A-Za-z0-9_-]{1,220}$/.test(key))throw mismatch();return readBase(audience)+'/'+encodeURIComponent(id)+'/resources/'+encodeURIComponent(key);}
export function createAcademicContentClient({fetchImpl=globalThis.fetch}={}){
 async function request(path,{method='GET',body,signal}={}){
  let res,data;try{res=await fetchImpl(path,{method,credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch(e){throw Object.assign(Error('连接中断，操作结果尚未确认。'),{unknown:method!=='GET',cause:e});}
  try{data=await res.json();}catch{throw mismatch(method!=='GET');}if(!res.ok)throw Object.assign(Error(data.message??'内容服务暂不可用，请稍后核对。'),{status:res.status,code:data.code,unknown:method!=='GET'&&res.status>=500});return data;
 }
 function path(audience,id){if(!['public','member'].includes(audience)||id!==undefined&&!validId(id))throw mismatch();return readBase(audience)+(id?'/'+encodeURIComponent(id):'');}
 return Object.freeze({
  async list(audience,query={},options){const params=new URLSearchParams(query),v=await request(path(audience)+(params.size?'?'+params:''),options);if(!Array.isArray(v?.items)||!v.items.every(x=>card(x)&&(audience!=='public'||x.audience==='public'))||v.nextCursor!==null&&typeof v.nextCursor!=='string')throw mismatch();return v;},
  async detail(audience,id,options){const v=await request(path(audience,id),options);if(!reading(v)||v.id!==id||audience==='public'&&v.audience!=='public')throw mismatch();return v;},
  async adminList(query={},options){const v=await request(manage+'?'+new URLSearchParams(query),options);if(!Array.isArray(v?.items)||!v.items.every(content)||!Number.isSafeInteger(v.page)||!Number.isSafeInteger(v.total))throw mismatch();return v;},
  async adminDetail(id,options){if(!validId(id))throw mismatch();const v=await request(manage+'/'+id,options);if(!content(v)||v.id!==id)throw mismatch();return v;},
  async history(id){if(!validId(id))throw mismatch();const v=await request(manage+'/'+id+'/history');if(!Array.isArray(v?.items))throw mismatch();return v;},
  async mutate(op){const p=await proof(op),body=operationPayload(op.action,op.id,op.body).body;const target=op.action==='create'?manage:manage+'/'+encodeURIComponent(op.id)+(op.action==='publish'?'/publications':op.action==='withdraw'?'/withdrawals':'');const v=await request(target,{method:op.action==='save'?'PATCH':'POST',body});if(!matches(v,op,p))throw mismatch(true);return v;},
  async operation(op){const p=await proof(op),target=manage+(op.action==='create'?'':'/'+encodeURIComponent(op.id))+'/operations/'+encodeURIComponent(op.body.requestKey),v=await request(target+'?'+new URLSearchParams(p));
   if(!['committed','unsubmitted','superseded'].includes(v?.state)||v.requestKey!==op.body.requestKey||v.action!==op.action||v.baseRevision!==p.baseRevision||v.requestHash!==p.requestHash||(op.action!=='create'||v.state!=='committed')&&v.contentId!==(op.id??null))throw mismatch();
   if(v.state==='committed'&&(!matches(v.result,op,p)||v.contentId!==v.result?.content?.id)||v.state==='unsubmitted'&&v.revision!==p.baseRevision||v.state==='superseded'&&(!Number.isSafeInteger(v.revision)||v.revision<=p.baseRevision))throw mismatch();return v;
  },
 });
}
