const BASE='/api/hubs/lingshu-xinyu/assets';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>0;
const capabilities=['canReview','canWithdraw','canRequest','canRead','canCite','canCopy','canDecideUsage'];
const validEntry=value=>value&&id(value.id)&&id(value.assetId)&&revision(value.version)&&revision(value.revision)&&typeof value.title==='string'&&typeof value.summary==='string'&&typeof value.kind==='string'&&id(value.owner?.id)&&typeof value.owner.displayName==='string'&&['pending','approved','rejected','withdrawn'].includes(value.status)&&['current','unavailable'].includes(value.sourceStatus)&&capabilities.every(key=>typeof value.capabilities?.[key]==='boolean')&&Array.isArray(value.usageRequests);
const validCopy=value=>value&&id(value.target?.id)&&id(value.target.studyId)&&typeof value.target.title==='string'&&typeof value.target.contentMd==='string'&&revision(value.target.version)&&value.target.currentVersion===value.target.version&&['current','unavailable'].includes(value.sourceStatus)&&id(value.source?.entryId)&&id(value.source.assetId)&&revision(value.source.version)&&/^[a-f0-9]{64}$/.test(value.source.contentHash);
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
export async function hubAssetOperationHash(op){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical({action:op.action,entryId:op.id??null,body:op.body,...(['decide_usage','revoke_usage'].includes(op.action)?{usageRequestId:op.requestId}: {})})));return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');}
export class HubAssetError extends Error{constructor(message,{status=0,code='HUB_ASSET_RESPONSE_INVALID',unknown=false}={}){super(message);this.name='HubAssetError';this.status=status;this.code=code;this.unknown=unknown;}}
const invalid=(unknown=false)=>new HubAssetError('成果结果暂时无法核对，请保留输入后重新核对。',{unknown});
function routeId(value){if(!id(value))throw invalid();return encodeURIComponent(value);}
function operationPath(op){
 if(op?.action==='save_copy'){if(typeof op.body?.contentMd==='string'&&new TextEncoder().encode(op.body.contentMd).length>131072)throw new HubAssetError('正文超过128 KiB，请保留草稿并分段整理后再保存。',{code:'HUB_ASSET_INPUT_TOO_LARGE'});if(!id(op.body?.requestKey)||!revision(op.body.expectedVersion)||typeof op.body.contentMd!=='string')throw invalid();return BASE+'/copies/'+routeId(op.id)+'/versions';}
 if(!op||!id(op.body?.requestKey)||!Number.isSafeInteger(op.body.expectedRevision)||op.body.expectedRevision<0)throw invalid();
 if(op.action==='submit'){if(op.id!=null||op.body.expectedRevision!==0)throw invalid();return BASE+'/submissions';}
 const root=BASE+'/'+routeId(op.id),suffix={decide:'/decision',withdraw:'/withdraw',request_usage:'/usage-requests',cite:'/citations',copy:'/copies'};
 if(['decide_usage','revoke_usage'].includes(op.action))return root+'/usage-requests/'+routeId(op.requestId)+(op.action==='decide_usage'?'/decision':'/revocations');
 if(!suffix[op.action])throw invalid();return root+suffix[op.action];
}
function matches(value,op,hash){
 const receipt=value?.receipt;
 if(!receipt||receipt.requestKey!==op.body.requestKey||receipt.requestHash!==hash||receipt.action!==op.action)return false;
 if(value.unavailable===true)return Object.keys(value).sort().join(',')==='receipt,unavailable'&&id(receipt.entryId)&&(op.id==null||receipt.entryId===op.id)&&receipt.revision===(op.action==='save_copy'?op.body.expectedVersion:op.body.expectedRevision)+1&&(!['decide_usage','revoke_usage'].includes(op.action)||receipt.usageRequestId===op.requestId);
 if(op.action==='save_copy')return validCopy(value)&&value.target.id===op.id&&receipt.entryId===op.id&&receipt.revision===op.body.expectedVersion+1&&value.target.version>=receipt.revision;
 return validEntry(value.entry)&&receipt.entryId===value.entry.id&&(op.id==null||value.entry.id===op.id)&&receipt.revision===op.body.expectedRevision+1&&value.entry.revision>=receipt.revision&&
  (op.action!=='submit'||value.entry.assetId===op.body.assetId&&value.entry.version===op.body.version)&&
  (op.sourceVersion==null||value.entry.version===op.sourceVersion)&&
  (!['decide_usage','revoke_usage'].includes(op.action)||receipt.usageRequestId===op.requestId)&&
  (op.action!=='copy'||id(value.result?.targetArtifactId)&&value.result.targetStudyId===op.body.targetStudyId&&value.result.version===1);
}
export function createHubAssetClient({fetchImpl=globalThis.fetch}={}){
 async function request(path,{method='GET',body,signal}={}){
  let response,data;const write=method!=='GET',serialized=write?JSON.stringify(body):undefined;if(write&&new TextEncoder().encode(serialized).length>262144)throw new HubAssetError('本次内容超过可提交大小，请保留草稿并分段整理后再保存。',{code:'HUB_ASSET_INPUT_TOO_LARGE'});
  try{response=await fetchImpl(path,{method,credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),headers:{Accept:'application/json',...(write?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(write?{body:serialized}:{})});}catch{throw new HubAssetError(write?'连接中断，操作结果尚未确认，请先核对原操作。':'暂时无法连接成果目录，请稍后重试。',{code:'HUB_ASSET_NETWORK',unknown:write});}
  try{data=await response.json();}catch{if(response.ok)throw invalid(write);}
  if(!response.ok){const status=response.status;throw new HubAssetError(({401:'请登录后继续查看成果。',403:'当前账号无权执行此操作，请重新核对访问范围。',404:'成果不存在、已移出或当前不可访问。',409:'成果已变化，请重新读取当前版本后处理。'})[status]||'成果服务暂时不可用，请稍后重试。',{status,code:typeof data?.code==='string'?data.code:'HUB_ASSET_UNAVAILABLE',unknown:write&&(status>=500||status===408)});}
  return data;
 }
 async function listPath(path,options,validate){const value=await request(path,options);if(!Array.isArray(value?.items)||!Number.isSafeInteger(value.total)||value.total<value.items.length||!value.items.every(validate))throw invalid();return value;}
 return Object.freeze({
  async list(query={},options){const params=new URLSearchParams();for(const key of ['view','q','kind','status','page','assetId','version'])if(query[key]!=null&&query[key]!=='')params.set(key,String(query[key]));return listPath(BASE+(params.size?'?'+params:''),options,validEntry);},
  async reviews(query={},options){const params=new URLSearchParams();for(const key of ['q','kind','status','page'])if(query[key]!=null&&query[key]!=='')params.set(key,String(query[key]));return listPath(BASE+'/reviews'+(params.size?'?'+params:''),options,validEntry);},
  async candidates(studyId,options){return listPath(BASE+'/candidates?studyId='+routeId(studyId),options,item=>id(item.assetId)&&revision(item.version)&&typeof item.title==='string'&&item.studyId===studyId);},
  async targets(options){return listPath(BASE+'/reuse-targets',options,item=>id(item.id)&&item.studyId===item.id&&typeof item.title==='string');},
  async copyDetail(targetId,options){const value=await request(BASE+'/copies/'+routeId(targetId),options);if(!validCopy(value)||value.target.id!==targetId)throw invalid();return value;},
  async detail(entryId,options){const value=await request(BASE+'/'+routeId(entryId),options);if(!validEntry(value)||value.id!==entryId)throw invalid();return value;},
  async body(entryId,{version,expectedRevision,...options}){if(!revision(version)||!revision(expectedRevision))throw invalid();const value=await request(BASE+'/'+routeId(entryId)+'/body?expectedRevision='+expectedRevision,options);if(value?.entryId!==entryId||value.version!==version||value.revision!==expectedRevision||typeof value.contentMd!=='string'||!/^[a-f0-9]{64}$/.test(value.contentHash))throw invalid();return value;},
  async mutate(op){const path=operationPath(op),hash=await hubAssetOperationHash(op),value=await request(path,{method:'POST',body:op.body});if(!matches(value,op,hash))throw invalid(true);return value;},
  async operation(op){operationPath(op);const hash=await hubAssetOperationHash(op),value=await request(BASE+'/operations/'+routeId(op.body.requestKey));if(value?.requestKey!==op.body.requestKey||!['committed','unsubmitted'].includes(value.state))throw invalid();if(value.state==='committed'&&!matches(value.result,op,hash))throw invalid();return value;},
 });
}
