const detailPurposes=['read_body','cite','comment','download','ai','derive','apply','export'];
import {parseAssetCollaborationQuery,ASSET_COLLABORATION_VIEWS} from '../scripts/research-assets-views-contract.mjs';
import {readCatalogAssetLocation} from './research-assets-catalog-session.js';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),positive=x=>Number.isSafeInteger(x)&&x>0,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const types={request:'requested',share:'decided',decide:'decided',revoke:'grant_revoked',cite:'cited'};
export function assetUsageRequestAllowed(method,path){
 if(typeof path!=='string'||/[\\#]/.test(path)||path.includes('..'))return false;
 if(method==='POST')return /^\/research-assets\/[A-Za-z0-9_-]{1,160}\/(?:access-requests|citations|access-requests\/[A-Za-z0-9_-]{1,160}\/decisions|grants\/[A-Za-z0-9_-]{1,160}\/revocations)$/.test(path);
 if(method!=='GET')return false;
 if(/^\/research-assets\/[A-Za-z0-9_-]{1,160}\/usage\?version=[1-8]$/.test(path))return true;
 if(path.startsWith('/research-assets/collaborations?'))try{parseAssetCollaborationQuery(new URLSearchParams(path.split('?')[1]));return path.split('?').length===2;}catch{return false;}
 return false;
}
export function assertUsageOptions(o,{user,scope,target}){
 if(!o||o.schemaVersion!=='rh-asset-usage.v1'||o.scope?.tenantId!==user.tenantId||['studyGroupId','researchProjectId'].some(k=>o.scope[k]!==scope[k])||o.assetId!==target.assetId||o.version!==target.version||!positive(o.expectedRevision)||o.expectedRevision>24||!hash(o.identityRevision)||!hash(o.contentHash)||!hash(o.policyHash)||typeof o.title!=='string'||!o.title||['sourceValid','releaseActive','canManage','canRequest','canShare','canCite'].some(k=>typeof o[k]!=='boolean')||!Array.isArray(o.requests)||o.requests.length>24||!Array.isArray(o.actors)||o.actors.length>2||o.actors.some(x=>!valid(x.accountId)||typeof x.displayName!=='string')||!Array.isArray(o.recipients)||o.recipients.some(x=>!o.actors.some(a=>a.accountId===x.accountId)))fail('当前资产或许可无法核对，请重新读取。');
 const allowed=o.allowedActions??['read_body','cite'];if(!Array.isArray(allowed)||!allowed.length||allowed.length>8||new Set(allowed).size!==allowed.length||allowed.some(a=>!detailPurposes.includes(a)))fail('用途范围无法核对，请重新读取。');
 for(const r of o.requests)if(!valid(r.requestId)||r.version!==target.version||!positive(r.revision)||!['pending','approved','rejected','revoked'].includes(r.state)||!o.actors.some(a=>a.accountId===r.recipientAccountId)||!Array.isArray(r.requestedActions)||r.requestedActions.some(x=>!allowed.includes(x))||!Array.isArray(r.actions)||r.actions.some(x=>!r.requestedActions.includes(x))||!Number.isFinite(Date.parse(r.expiresAt)))fail('许可记录无法核对，请重新读取。');
 return o;
}
export function assertAssetCollaborations(v,{scope,identityRevision,query,view='all'}){
 if(!v||v.schemaVersion!=='rh-asset-collaborations.v1'||v.scope?.studyGroupId!==scope.studyGroupId||v.scope?.researchProjectId!==scope.researchProjectId||v.identityRevision!==identityRevision||v.page!==query.page||v.pageSize!==query.pageSize||!Number.isSafeInteger(v.total)||v.total<0||v.total>240||!Array.isArray(v.items)||v.items.length!==Math.max(0,Math.min(query.pageSize,v.total-(query.page-1)*query.pageSize))||v.items.some(x=>!valid(x.assetId)||!valid(x.requestId)||!positive(x.version)||x.version>8||!positive(x.requestRevision)||typeof x.title!=='string'||typeof x.recipientName!=='string'||typeof x.purpose!=='string'||!Array.isArray(x.actions)||x.actions.some(a=>!detailPurposes.includes(a))||!['pending','approved','rejected','revoked','expired'].includes(x.state)||!Number.isFinite(Date.parse(x.expiresAt))||typeof x.canManage!=='boolean'))fail('用途申请列表无法核对，请重新读取。');
 if(v.items.some(x=>typeof x.canProcess!=='boolean'))fail('用途处理状态无法核对，请重新读取。');
 if(v.collaborationView!==view||ASSET_COLLABORATION_VIEWS.some(k=>!Number.isSafeInteger(v.counts?.[k])||v.counts[k]<0||v.counts[k]>240||v.counts[k]>v.counts.all)||v.counts[view]!==v.total||v.items.some(x=>!Array.isArray(x.views)||!x.views.includes(view)||x.views.some(k=>!ASSET_COLLABORATION_VIEWS.includes(k))))fail('共享记录分类无法核对，请重新读取。');
 return v;
}
export function buildAssetUsageInput(o,t,d,key){
 const action=t.action;if(!Object.hasOwn(types,action)||!valid(key)||key.length<8)fail('当前操作无法核对。');
 const input={action,version:t.version,expectedRevision:o.expectedRevision,identityRevision:o.identityRevision,policyHash:o.policyHash,contentHash:o.contentHash,requestKey:key};
 if(action==='cite'){if(!o.canCite)fail('本版当前不能引用。',403);return input;}
 const allowed=o.allowedActions??['read_body','cite'],actions=d.actions??[],validActions=actions.length>0&&actions.length<=allowed.length&&new Set(actions).size===actions.length&&actions.every(a=>allowed.includes(a));
 if(['request','share'].includes(action)){
  if(!(action==='request'?o.canRequest:o.canShare))fail('当前不能提交此用途操作。',403);
  if(!validActions||typeof d.purpose!=='string'||!d.purpose.trim()||d.purpose.length>2000||!positive(d.ttlDays)||d.ttlDays>7)fail('请选择所需用途、填写使用目的及不超过7天的期限。',422);
  Object.assign(input,{actions:[...actions].sort(),purpose:d.purpose.trim(),ttlDays:d.ttlDays});
  if(action==='share'){if(!o.recipients.some(a=>a.accountId===d.recipientAccountId))fail('请选择允许范围内的接收人。',422);input.recipientAccountId=d.recipientAccountId;}
 }
 if(['share','decide','revoke'].includes(action)){if(typeof d.reason!=='string'||!d.reason.trim()||d.reason.length>2000)fail('请填写本次处理理由。',422);input.reason=d.reason.trim();}
 if(['decide','revoke'].includes(action)){
  const request=o.requests.find(r=>r.requestId===t.requestId);if(!o.canManage||!request)fail('当前不能处理此申请。',403);
  Object.assign(input,{requestId:request.requestId,expectedRequestRevision:request.revision});
  if(action==='decide'){if(!['approved','rejected'].includes(d.conclusion)||d.conclusion==='approved'&&(!validActions||actions.some(a=>!request.requestedActions.includes(a))))fail('批准用途不能超出原申请，请核对结论。',422);Object.assign(input,{conclusion:d.conclusion,actions:d.conclusion==='rejected'?[]:[...actions].sort()});}
 }
 return input;
}
export const usagePendingKey=(u,s)=>'rh-asset-usage-pending:'+JSON.stringify([u.tenantId,u.accountId,u.authVersion,s.studyGroupId,s.researchProjectId]);
export const usageNeedsProtection=s=>Boolean(s&&(s.dirty||['submitting','unknown','retryable'].includes(s.phase)));
export function createAssetUsageFlow({user,scope,api,storage,onChange=()=>{},onCommitted=()=>{},makeKey=()=>crypto.randomUUID(),clipboard=text=>navigator.clipboard.writeText(text)}){
 let s={open:false,phase:'idle',options:null,draft:null,dirty:false},epoch=0,payload=null,markerOnly=false;const key=usagePendingKey(user,scope),context=JSON.stringify([user.tenantId,user.accountId,user.authVersion,scope.studyGroupId,scope.researchProjectId]);
 const update=v=>{s={...s,...v};onChange(s);},clear=()=>{try{storage?.removeItem(key);}catch{/* An old marker only reads the same result. */}};
 function accepted(r){if(!r||r.status!=='committed'||r.assetId!==s.target.assetId||r.version!==s.target.version||r.revision!==s.expectedRevision||r.operation!==types[s.target.action]||s.target.requestId&&r.requestId!==s.target.requestId||s.target.action!=='cite'&&(!valid(r.requestId)||!positive(r.requestRevision)||r.requestRevision>24||['request','share'].includes(s.target.action)&&r.requestRevision!==1||payload?.expectedRequestRevision&&r.requestRevision!==payload.expectedRequestRevision+1)||s.target.action==='cite'&&!r.citation&&r.contentAccess!=='restricted')throw Object.assign(new Error('原操作结果无法核对。'),{code:'ASSET_CATALOG_CONTEXT_INVALID'});if(r.contentAccess==='restricted'&&r.citation)fail('原操作结果无法核对。');if(r.citation){try{const u=new URL(r.citation.url,'http://asset.local'),route=readCatalogAssetLocation('a02',u.search);if(u.origin!=='http://asset.local'||u.pathname!=='/pages/a02/'||route.assetId!==s.target.assetId||route.versionNo!==s.target.version||route.scope.studyGroupId!==scope.studyGroupId||route.scope.researchProjectId!==scope.researchProjectId||r.citation.excerptIncluded!==false||typeof r.citation.text!=='string'||!r.citation.text||r.citation.text.length>6000)throw Error();}catch{throw Object.assign(new Error('引用结果无法核对。'),{code:'ASSET_CATALOG_CONTEXT_INVALID'});}}clear();update({phase:'committed',dirty:false,receipt:r,citation:r.citation??null,message:r.contentAccess==='restricted'?'原操作已提交，但当前无权读取该引用；不会重复提交。':s.target.action==='cite'?'引用已记录；复制前会再次核对当前许可。':'操作已保存，请以重新读取的当前许可为准。'});onCommitted(r);}
 return{state:()=>s,
  async open(target){
   if(usageNeedsProtection(s)){if(target&&JSON.stringify(target)!==JSON.stringify(s.target))fail('请先核对或处理上次操作。');update({open:true});return;}
   const token=++epoch;payload=null;markerOnly=false;update({open:true,phase:'loading',options:null,draft:null,dirty:false,target,message:'',citation:null});
   try{
    const raw=storage?.getItem(key);if(raw){const m=JSON.parse(raw);if(m.context!==context||!valid(m.requestKey)||!valid(m.target?.assetId)||!positive(m.target.version)||m.target.version>8||!Object.hasOwn(types,m.target.action)||!positive(m.expectedRevision)||m.expectedRevision>24)fail('原操作标识无法核对，请检查当前许可。');markerOnly=true;payload={requestKey:m.requestKey};update({phase:'unknown',target:m.target,expectedRevision:m.expectedRevision,message:'上次操作结果尚未确认，请先核对；用途和审核输入未保存在浏览器。'});return;}
    if(!target)fail('未找到待核对的操作。');const options=assertUsageOptions(await api.get('/research-assets/'+target.assetId+'/usage?version='+target.version),{user,scope,target});if(token!==epoch)return;
    update({phase:'editing',options,draft:{actions:[],purpose:'',reason:'',ttlDays:7,recipientAccountId:options.recipients[0]?.accountId??'',conclusion:'approved'}});
   }catch(e){if(token===epoch)update({phase:'error',message:e.message});}
  },
  change(v){if(s.phase!=='editing')fail('请先核对原操作结果。');update({draft:{...s.draft,...v},dirty:true,message:''});},
  choose(action,requestId){if(s.phase!=='editing')return;update({target:{assetId:s.target.assetId,version:s.target.version,action,requestId},draft:{...s.draft,actions:[],reason:'',conclusion:'approved'},dirty:false,message:''});},
  close(){if(!['loading','submitting'].includes(s.phase))update({open:false});},
  discard(){if(['unknown','submitting'].includes(s.phase))return;epoch++;payload=null;clear();update({open:false,phase:'idle',options:null,draft:null,dirty:false,target:null,citation:null,message:''});},
  pause(){epoch++;update({phase:s.phase==='submitting'?'unknown':s.phase==='loading'?'error':s.phase,citation:null,message:'当前读取暂不可用，输入已保留；请重新读取后核对原操作。'});},
  invalidate(){epoch++;payload=null;update({open:false,phase:'invalid',options:null,draft:null,dirty:false,target:null,citation:null,message:''});},
  async save(){if(!['editing','retryable'].includes(s.phase)||s.target.action==='manage')return;const token=epoch;let sent=false;try{
   if(s.phase==='editing'){payload=buildAssetUsageInput(s.options,s.target,s.draft,makeKey());update({expectedRevision:payload.expectedRevision+1});}
   const marker=JSON.stringify({context,target:s.target,requestKey:payload.requestKey,expectedRevision:s.expectedRevision});if(storage){storage.setItem(key,marker);if(storage.getItem(key)!==marker)fail('无法保存核对标识，尚未提交。');}
   const base='/research-assets/'+s.target.assetId,path=['request','share'].includes(s.target.action)?base+'/access-requests':s.target.action==='decide'?base+'/access-requests/'+s.target.requestId+'/decisions':s.target.action==='revoke'?base+'/grants/'+s.target.requestId+'/revocations':base+'/citations';
   update({phase:'submitting',message:'正在保存用途操作…'});sent=true;const receipt=await api.post(path,payload);if(token!==epoch)return;accepted(receipt);
  }catch(e){if(token!==epoch)return;const unknown=sent&&(!e.status||e.status>=500||['ASSET_CATALOG_REQUEST_KEY_CONFLICT','ASSET_CATALOG_CONTEXT_INVALID'].includes(e.code));if(!unknown)clear();update({phase:unknown?'unknown':'editing',message:unknown?'操作结果尚未确认；原输入已保留，请先核对原结果。':e.message});}},
  async lookup(){if(s.phase!=='unknown')return;const token=epoch;try{const r=await api.get('/research-assets/operations/'+payload.requestKey);if(token!==epoch)return;if(r.status==='committed')accepted(r);else if(r.status==='not_found'){if(markerOnly){clear();update({phase:'absent',dirty:false,message:'未找到原记录，请关闭后核对当前许可再重新操作。'});}else update({phase:'retryable',message:'未找到原记录，可使用原输入重试。'});}else fail('暂时无法核对原记录。');}catch(e){if(token===epoch)update({phase:'unknown',message:e.message});}},
  async copy(){if(s.phase!=='committed'||!s.citation)return;const token=epoch;try{const o=assertUsageOptions(await api.get('/research-assets/'+s.target.assetId+'/usage?version='+s.target.version),{user,scope,target:s.target});if(token!==epoch)return;if(!o.canCite||s.options&&(['identityRevision','contentHash','policyHash'].some(k=>o[k]!==s.options[k])))fail('当前引用许可或来源已变化，不能继续复制。',403);try{await clipboard(s.citation.text+' '+locationOriginless(s.citation.url));if(token===epoch)update({message:'引用已记录，已复制。'});}catch{if(token===epoch)update({message:'引用已记录，复制失败；可手动选择下方书目信息，不会重复增加引用记录。'});}}catch(e){if(token===epoch)update({citation:null,message:e.message});}}
 };
}
function locationOriginless(url){if(typeof url!=='string'||!url.startsWith('/pages/a02/?')||/[\\\r\n]/.test(url))fail('引用链接无法核对。');return typeof location==='undefined'?url:location.origin+url;}
