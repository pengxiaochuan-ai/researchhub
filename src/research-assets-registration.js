import {isBusinessAssetId as businessId} from '../scripts/research-assets-business-identity.mjs';
const kinds=['protocol','dataset','instrument','analysis','publication'];
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const fail=message=>{throw Object.assign(new Error(message),{status:409,code:'ASSET_CATALOG_CONTEXT_INVALID'});};
const clone=x=>JSON.parse(JSON.stringify(x));
export const assetRegistrationEntryReady=current=>Boolean(current?.ready&&Array.isArray(current.creationScopes)&&current.creationScopes.some(s=>valid(s?.studyGroupId)&&valid(s?.researchProjectId)));
export function bindAssetRegistrationEntry(doc,{ready,busy,observerFactory=fn=>new MutationObserver(fn)}){
 let active=true;
 const sync=()=>{if(!active)return;for(const button of doc.querySelectorAll('.qiyan-page-actions button'))if(button.textContent.trim()==='上传资产'){if(button.disabled===ready)button.disabled=!ready;const value=String(busy);if(button.getAttribute?.('aria-busy')!==value)button.setAttribute('aria-busy',value);}};
 const observer=observerFactory(sync);observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});sync();
 return()=>{active=false;observer.disconnect();};
}
export const assetRegistrationNeedsProtection=s=>Boolean(s?.dirty||['submitting','uploading','unknown','upload_unknown','retryable'].includes(s?.phase));
export function assetRegistrationContextKey({user,scope}={}){
 if(![user?.tenantId,user?.accountId,scope?.studyGroupId,scope?.researchProjectId].every(valid)||!Number.isSafeInteger(user.authVersion)||user.authVersion<0)return'';
 return JSON.stringify([user.tenantId,user.accountId,user.authVersion,scope.studyGroupId,scope.researchProjectId]);
}
export function assetRegistrationDraft(user,existing){
 const m=existing?.metadata;
 return{kind:existing?.kind??'protocol',mode:existing?.sourceKind==='knowledge'?'knowledge':existing?.sourceKind==='author'?'manual':'file',metadata:{title:m?.title??'',summary:m?.summary??'',purpose:m?.purpose??'',limitations:m?.limitations??'',author:m?.author??user.displayName},domains:(m?.domains??[]).join('，'),contentMd:existing?.contentMd??'',sourceId:existing?.sourceBindings?.[0]?.id??'',uploadId:null,rightsEvidence:existing?.policy?.rightsEvidence??'',audience:existing?.policy?.discoveryRecipients?.some(id=>id!==user.accountId)?'named':'private'};
}
export function buildAssetRegistrationPayload(d,{user,options,edit}={}){
 const errors={},metadata={};
 for(const [key,label,max]of [['title','题名',160],['summary','摘要',2000],['purpose','用途',2000],['limitations','适用限制',2000],['author','作者',240]]){
  const v=d.metadata?.[key];if(typeof v!=='string'||!v.trim()||v.length>max)errors[key]='请填写'+label+'，最多'+max+'字。';else metadata[key]=v.trim();
 }
 const domains=String(d.domains??'').split(/[,，\n]/).map(x=>x.trim()).filter(Boolean);
 if(domains.length>8||domains.some(x=>x.length>80)||new Set(domains).size!==domains.length)errors.domains='研究领域最多8个，不重复，每项最多80字。';metadata.domains=domains;
 if(!kinds.includes(d.kind)||edit&&d.kind!==edit.kind)errors.kind='请选择有效的资产类型；修订不能改变类型。';
 const self=options?.actors?.find(a=>a.accountId===user?.accountId),other=options?.actors?.find(a=>a.accountId!==user?.accountId);
 if(!self||!['private','named'].includes(d.audience)||d.audience==='named'&&!other)errors.audience='当前可见范围无法核对，请重新读取。';
 if(edit&&Object.hasOwn(edit.metadata??{},'tags'))metadata.tags=[...edit.metadata.tags];
 const recipients=d.audience==='named'&&other?[user.accountId,other.accountId]:[user.accountId];
 let sourceKind,sourceBindings=[],body;
 if(d.mode==='file'){
  sourceKind='upload';if(!valid(d.uploadId))errors.uploadId='请选择并暂存TXT或Markdown文件。';else body={uploadId:d.uploadId};
 }else if(d.mode==='knowledge'){
  const source=options?.sources?.find(s=>s.id===d.sourceId);sourceKind='knowledge';
  if(!source||source.binding?.kind!=='knowledge'||recipients.some(id=>!source.discoveryRecipients?.includes(id)))errors.sourceId='当前资料或允许用途不适用，请重新选择获准来源。';else sourceBindings=[source.binding];
 }else if(d.mode==='manual')sourceKind='author';else errors.sourceId='请选择有效的材料来源。';
 if(d.mode!=='file'){
  if(typeof d.contentMd!=='string'||!d.contentMd.trim()||new TextEncoder().encode(d.contentMd).length>131072)errors.contentMd='正文不能为空，手工整理最多128KiB；长文请改用文件上传。';else body={contentMd:d.contentMd};
 }
 if(typeof d.rightsEvidence!=='string'||d.rightsEvidence.length>4000)errors.rightsEvidence='来源与用途依据最多4000字。';
 if(Object.keys(errors).length)throw Object.assign(new Error('请先补齐标注的内容；输入已保留。'),{status:422,fields:errors});
 return{kind:d.kind,metadata,sourceKind,sourceBindings,policy:{rightsEvidence:d.rightsEvidence.trim(),discoveryRecipients:recipients},...body,...(edit?{baseVersion:edit.version,expectedRevision:edit.expectedRevision}:{})};
}
export function createAssetRegistrationAttempt({makeKey=()=>crypto.randomUUID()}={}){
 let current={phase:'idle'};
 const accepted=value=>{
  if(!value||value.status!=='committed'||!valid(value.assetId)||value.version!==current.expectedVersion||value.revision!==current.expectedRevision||current.assetId&&value.assetId!==current.assetId){current.phase='unknown';fail('保存响应与本次对象或版本不一致，请先核对原结果。');}
  current.phase='committed';current.receipt=clone(value);return value;
 };
 return{
  restore(marker){
   if(!valid(marker?.requestKey)||marker.requestKey.length<8||marker.assetId!==undefined&&!valid(marker.assetId)||!positive(marker.expectedVersion)||marker.expectedVersion>(businessId(marker.assetId)?2147483647:8)||!positive(marker.expectedRevision)||marker.expectedRevision>(businessId(marker.assetId)?2147483647:24))fail('原保存标识无法核对，请核对资产目录。');
   current={phase:'unknown',markerOnly:true,assetId:marker.assetId,expectedVersion:marker.expectedVersion,expectedRevision:marker.expectedRevision,payload:{requestKey:marker.requestKey}};
  },
  begin(payload,{assetId}={}){
   if(!['idle','rejected'].includes(current.phase))fail('此保存尚未确认，请先核对原结果。');
   const requestKey=makeKey();if(!valid(requestKey)||requestKey.length<8)fail('无法生成提交标识，请重新打开。');
   current={phase:'submitting',assetId,expectedVersion:assetId?payload.baseVersion+1:1,expectedRevision:assetId?payload.expectedRevision+1:1,payload:{...clone(payload),requestKey}};return clone(current.payload);
  },
  failed(error){current.phase=!error?.status||error.status>=500||['ASSET_CATALOG_REQUEST_KEY_CONFLICT','ASSET_CATALOG_CONTEXT_INVALID'].includes(error.code)?'unknown':'rejected';},
  lookup(value){if(value?.status==='committed')return accepted(value);if(value?.status!=='not_found'){current.phase='unknown';fail('保存状态暂时无法核对，请保留输入后重试。');}current.phase=current.markerOnly?'absent':'retryable';return value;},
  retry(){if(current.phase!=='retryable')fail('请先核对原保存结果。');current.phase='submitting';return clone(current.payload);},
  accept:accepted,
  state:()=>clone(current)
 };
}
export function assetRegistrationRequestAllowed(method,path){
 if(typeof path!=='string'||/[\\#]/.test(path)||path.includes('..'))return false;
 if(method==='POST')return path==='/research-assets'||path==='/research-assets/uploads'||/^\/research-assets\/[A-Za-z0-9_-]{1,160}\/versions$/.test(path);
 if(method!=='GET')return false;
 if(path==='/research-assets/registrable-sources'||/^\/research-assets\/operations\/[A-Za-z0-9_-]{8,160}$/.test(path))return true;
 if(path.startsWith('/research-assets/registrable-sources?')){const parts=path.split('?');if(parts.length!==2)return false;const q=new URLSearchParams(parts[1]);return [...q].length===1&&q.has('assetId')&&valid(q.get('assetId'));}
 const m=path.match(/^\/research-assets\/[A-Za-z0-9_-]{1,160}\/registration\?version=([1-9][0-9]*)$/);return Boolean(m&&positive(Number(m[1])));
}
export function assetRegistrationHeaders(user,write=false){
 if(!valid(user?.accountId)||!Number.isSafeInteger(user.authVersion)||user.authVersion<0)fail('当前操作身份无法核对，请重新读取。');
 return{'X-ResearchHub-Actor':user.accountId,'X-ResearchHub-Auth-Version':String(user.authVersion),...(write?{'X-ResearchHub-Request':'asset-catalog-v1'}:{})};
}
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const text=(x,max,empty=false)=>typeof x==='string'&&x.length<=max&&(empty||Boolean(x.trim()));
const sameScope=(v,s)=>v?.studyGroupId===s?.studyGroupId&&v?.researchProjectId===s?.researchProjectId;
const unique=(list,key)=>Array.isArray(list)&&new Set(list.map(key)).size===list.length;
const binding=b=>b&&['knowledge','artifact','upload'].includes(b.kind)&&valid(b.id)&&positive(b.version)&&hash(b.contentHash);
export function assertAssetRegistrationOptions(v,{scope,user}){
 const business=v?.schemaVersion==='rh-asset-registration-options.v2'&&v.family==='business';
 if(v?.schemaVersion==='rh-asset-registration-options.v1'&&v.family!==undefined)fail('登记族与接口版本不一致，请重新读取。');
 if(!v||!business&&v.schemaVersion!=='rh-asset-registration-options.v1'||v.schemaVersion==='rh-asset-registration-options.v2'&&!business||!sameScope(v.scope,scope)||!hash(v.identityRevision)||!Array.isArray(v.actors)||v.actors.length<1||v.actors.length>(business?100:2)||!unique(v.actors,x=>x.accountId)||v.actors.some(a=>!valid(a.accountId)||!text(a.displayName,240)||a.isSelf!==(a.accountId===user.accountId))||!v.actors.some(a=>a.isSelf))fail('登记身份或研究无法核对，请重新读取。');
 const actors=v.actors.map(a=>a.accountId);
 if(v.admission!==undefined&&(!business||typeof v.admission?.canCreate!=='boolean'||v.admission.canCreate&&v.admission.reason!==null||!v.admission.canCreate&&!text(v.admission.reason,500)))fail('登记可用状态无法核对，请重新读取。');
 if(!Array.isArray(v.ownAssets)||!business&&(v.ownAssets.length>5||!unique(v.ownAssets,x=>x.kind))||!unique(v.ownAssets,x=>x.id)||v.ownAssets.some(a=>!(business?businessId(a.id):valid(a.id))||!kinds.includes(a.kind)||!positive(a.version)||a.version>(business?2147483647:8)))fail('已有资产无法核对，请重新读取。');
 if(!['ready','unavailable'].includes(v.sourcesStatus)||!Array.isArray(v.sources)||v.sources.length>2||!unique(v.sources,x=>x.id)||v.sourcesStatus==='unavailable'&&v.sources.length||v.sources.some(s=>!valid(s.id)||!text(s.title,500)||!positive(s.version)||s.version>3||!binding(s.binding)||s.binding.kind!=='knowledge'||s.binding.id!==s.id||s.binding.version!==s.version||!text(s.contentMd,5242880)||!text(s.rightsEvidence,4000)||!unique(s.discoveryRecipients,x=>x)||!s.discoveryRecipients.length||s.discoveryRecipients.some(id=>!actors.includes(id))))fail('资料来源或允许用途无法核对，请重新读取。');
 if(!['ready','unavailable'].includes(v.uploadsStatus)||!Array.isArray(v.pendingUploads)||v.pendingUploads.length>4||!unique(v.pendingUploads,x=>x.uploadId)||v.uploadsStatus==='unavailable'&&v.pendingUploads.length||v.pendingUploads.some(f=>!valid(f.uploadId)||!text(f.filename,255)||!positive(f.sizeBytes)||f.sizeBytes>5242880||!hash(f.sha256)||!['pending','binding','staging'].includes(f.status)||f.status==='binding'&&(!valid(f.assetId)||!positive(f.version)||!valid(f.operationKey))))fail('暂存文件状态无法核对，请重新读取。');
 return v;
}
export function assertAssetEditDraft(v,route){
 const business=v?.schemaVersion==='rh-asset-registration-draft.v2'&&v.family==='business'&&businessId(v.assetId);
 if(v?.schemaVersion==='rh-asset-registration-draft.v1'&&v.family!==undefined)fail('修订族与接口版本不一致，请重新读取。');
 if(!v||!business&&v.schemaVersion!=='rh-asset-registration-draft.v1'||v.schemaVersion==='rh-asset-registration-draft.v2'&&!business||!sameScope(v,route.scope)||v.assetId!==route.assetId||v.version!==route.version||!positive(v.version)||v.version>(business?2147483647:8)||!kinds.includes(v.kind)||!positive(v.expectedRevision)||v.expectedRevision>(business?2147483647:24)||!hash(v.identityRevision)||route.identityRevision&&v.identityRevision!==route.identityRevision||!['author','knowledge','artifact','upload'].includes(v.sourceKind)||!Array.isArray(v.sourceBindings)||v.sourceBindings.length>8||v.sourceBindings.some(b=>!binding(b))||v.sourceKind==='author'&&v.sourceBindings.length||v.sourceKind!=='author'&&!v.sourceBindings.length||v.fileRevisionRequiresNewUpload!==(v.sourceKind==='upload')||!text(v.contentMd,5242880)||!v.policy||!text(v.policy.rightsEvidence,4000,true)||!unique(v.policy.discoveryRecipients,x=>x)||v.policy.discoveryRecipients.length>(business?100:2)||v.policy.discoveryRecipients.some(id=>!valid(id)))fail('修订对象、来源或固定版本无法核对，请重新读取。');
 for(const [key,max]of [['title',160],['summary',2000],['purpose',2000],['limitations',2000],['author',240]])if(!text(v.metadata?.[key],max))fail('原资产信息无法核对，请重新读取。');
 return v;
}
export function assetRegistrationMessage(error){
 return({401:'会话已失效，请重新登录。',403:'当前账号无权进行此操作，请核对研究与授权。',409:'对象、版本或来源已变化；输入已保留，请核对最新状态。',413:'文件或请求过大；文件最多5MiB，长文请使用文件上传。',422:error?.fields?'请先补齐标注的内容；输入已保留。':'材料或用途不符合当前要求；请核对后重试。'})[error?.status]??'保存结果尚未确认，请先核对原结果，不要重复新建。';
}
