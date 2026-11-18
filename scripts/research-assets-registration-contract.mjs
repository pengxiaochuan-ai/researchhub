import {createHash} from 'node:crypto';
import {CATALOG_KINDS,catalogError} from './research-assets-catalog-contract.mjs';
export const canonicalAssetJson=x=>Array.isArray(x)?'['+x.map(canonicalAssetJson).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).filter(k=>x[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonicalAssetJson(x[k])).join(',')+'}':JSON.stringify(x);
export const assetDigest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:canonicalAssetJson(x)).digest('hex');
const positive=x=>Number.isSafeInteger(x)&&x>0;
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const reject=(code='INPUT_INVALID',status=400,message='资产登记内容无效，请核对输入。')=>{throw catalogError(code,status,message);};
function keys(value,allowed,required=allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))reject();}
function text(x,max,{empty=false}={}){if(typeof x!=='string'||(!empty&&!x.trim())||x.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x))reject();return x.trim();}
export function validateAssetRegistration(input,{ids,revision=false,family='catalog',allowedRecipients=[]}={}){
 const required=['kind','metadata','sourceKind','sourceBindings','policy','requestKey'];
 keys(input,[...required,'contentMd','uploadId',...(revision?['baseVersion','expectedRevision']:[])],required);
 if(!CATALOG_KINDS.includes(input.kind)||!['author','knowledge','artifact','upload'].includes(input.sourceKind)||!valid(input.requestKey)||input.requestKey.length<8)reject();
 const business=family==='business';
 if(revision&&(!positive(input.baseVersion)||input.baseVersion>=(business?2147483647:8)||!positive(input.expectedRevision)||input.expectedRevision>=(business?2147483647:24)))reject('VERSION_CONFLICT',409,'版本已变化或达到可用上限，请核对。');
 const fields={title:160,summary:2000,purpose:2000,limitations:2000,author:240};keys(input.metadata,[...Object.keys(fields),'domains','tags'],Object.keys(fields));
 const metadata=Object.fromEntries(Object.entries(fields).map(([k,max])=>[k,text(input.metadata[k],max)]));
 if(Object.hasOwn(input.metadata,'tags')){const tags=input.metadata.tags;if(!Array.isArray(tags)||tags.length>12)reject();metadata.tags=tags.map(x=>text(x,24));if(new Set(metadata.tags).size!==metadata.tags.length)reject();}
 const domains=input.metadata.domains??[];if(!Array.isArray(domains)||domains.length>8)reject();metadata.domains=domains.map(d=>text(d,80));if(new Set(metadata.domains).size!==metadata.domains.length)reject();
 if(input.kind==='analysis')metadata.analysisNature='method_description';
 keys(input.policy,['rightsEvidence','discoveryRecipients']);const recipients=input.policy.discoveryRecipients;
 const ceiling=business?allowedRecipients:[ids?.owner,ids?.admin];
 if(!Array.isArray(recipients)||recipients.length>(business?100:2)||new Set(recipients).size!==recipients.length||recipients.some(x=>!valid(x)||!ceiling.includes(x)))reject('RIGHTS_REQUIRED',422,'可发现范围不在已确认用途内。');
 const policy={rightsEvidence:text(input.policy.rightsEvidence,4000,{empty:true}),discoveryRecipients:[...recipients].sort()};
 if(!Array.isArray(input.sourceBindings)||input.sourceBindings.length>8)reject();
 const sourceBindings=input.sourceBindings.map(b=>{keys(b,['kind','id','version','contentHash']);if(b.kind!==input.sourceKind||!valid(b.id)||!positive(b.version)||typeof b.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(b.contentHash))reject();return{...b};});
 if(new Set(sourceBindings.map(s=>s.kind+':'+s.id+':'+s.version)).size!==sourceBindings.length||input.sourceKind==='author'&&sourceBindings.length||['knowledge','artifact'].includes(input.sourceKind)&&!sourceBindings.length)reject('SOURCE_INVALID',422,'请选取可核对的固定来源版本。');
 let contentMd;
 if(input.sourceKind==='upload'){
  if(!valid(input.uploadId)||Object.hasOwn(input,'contentMd')||sourceBindings.length)reject('UPLOAD_INVALID',422,'请选择有效的待登记文件。');
 }else{
  if(Object.hasOwn(input,'uploadId')||typeof input.contentMd!=='string'||!input.contentMd.trim()||Buffer.byteLength(input.contentMd,'utf8')>131072||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.contentMd))reject();contentMd=input.contentMd;
 }
 return{kind:input.kind,metadata,sourceKind:input.sourceKind,sourceBindings,policy,requestKey:input.requestKey,...(contentMd!==undefined?{contentMd}:{uploadId:input.uploadId}),...(revision?{baseVersion:input.baseVersion,expectedRevision:input.expectedRevision}:{})};
}
export function registrationRequestHash(value,actor,assetId=null){
 const {requestKey,...payload}=value;return assetDigest({payload,tenantId:actor.tenantId,studyGroupId:actor.studyGroupId,researchProjectId:actor.researchProjectId,accountId:actor.accountId,assetId});
}
export function sealAssetRegistration(value,actor,number,ownerAccountId=actor.accountId,{family='catalog'}={}){
 if(!positive(number)||number>(family==='business'?2147483647:8)||!valid(ownerAccountId)||typeof value.contentMd!=='string'||!value.contentMd.trim())reject();
 const contentHash=assetDigest(value.contentMd),policy={assetKind:value.kind,versionNo:number,ownerAccountId,metadata:value.metadata,sourceKind:value.sourceKind,sourceBindings:value.sourceBindings,rightsEvidence:value.policy.rightsEvidence,discoveryRecipientCeiling:value.policy.discoveryRecipients,contentHash};
 const policyHash=assetDigest(policy);return{contentHash,policyHash,block:{type:'rh-research-asset-catalog.v2',...policy,policyHash}};
}
export function assertRegistrationPolicy(block,policy,owner,kind){
 const expected={assetKind:kind,versionNo:policy.version,ownerAccountId:owner,metadata:policy.metadata,sourceKind:policy.sourceKind??block?.sourceKind,sourceBindings:policy.sourceBindings,rightsEvidence:policy.rightsEvidence,discoveryRecipientCeiling:policy.discoveryRecipientCeiling,contentHash:policy.contentHash};
 const bound=block&&{...block};if(bound){delete bound.type;delete bound.policyHash;}
 if(block?.type!=='rh-research-asset-catalog.v2'||canonicalAssetJson(bound)!==canonicalAssetJson(expected)||block.policyHash!==policy.policyHash||assetDigest(expected)!==policy.policyHash)reject('CONTEXT_INVALID',409,'资产固定版内容与用途依据无法核对。');
 return true;
}
