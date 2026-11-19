import {assertAssetAction,effectiveAssetRelease,catalogError} from './research-assets-catalog-contract.mjs';
const fail=(code,status=409,message='资产状态已变化，请重新核对后操作。')=>{throw catalogError(code,status,message);};
const positive=x=>Number.isSafeInteger(x)&&x>0;
export const governanceScope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
export const assetSelfReview=(record,policy,actor)=>record.registry.ownerAccountId===actor.accountId||policy.createdBy===actor.accountId;
export function assetEventBudgetAllows(record,action,now=Date.now()){
 const n=record.registry.revision,limit=record.family?.maxOperations??24;
 if(n>=limit)return false;
 // Each independently live fixed release needs its own future withdrawal event.
 const live=record.policies.filter(p=>effectiveAssetRelease(record.events,p.version,now).active).length;
 return action==='withdraw'||limit-(n+1)>=live+(action==='release'||action==='trash'?1:0);
}
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const reason=x=>typeof x==='string'&&x.trim().length>0&&x.length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x);
const fields={submit:[],review:['conclusion','reason','contentChecked','rightsChecked','selfReviewAcknowledged'],release:['reason','discoveryRecipients','ttlDays'],withdraw:['reason']};
export function validateAssetGovernance(input,{ids,family='catalog',runtimeBusiness=false}){
 const common=['action','version','expectedRevision','requestKey','contentHash','policyHash','identityRevision'];
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(fields,input.action)||Object.keys(input).some(k=>!common.includes(k)&&!fields[input.action].includes(k)))fail('INPUT_INVALID',400,'操作字段无效，请重新打开。');
 if(!positive(input.version)||input.version>(family==='business'?2147483647:8)||!positive(input.expectedRevision)||input.expectedRevision>(family==='business'?2147483647:24)||!id(input.requestKey)||input.requestKey.length<8||!hash(input.contentHash)||!hash(input.policyHash)||typeof input.identityRevision!=='string'||!input.identityRevision||input.identityRevision.length>300)fail('INPUT_INVALID',400,'操作上下文不完整，请重新打开。');
 if(input.action!=='submit'&&!reason(input.reason))fail('INPUT_INVALID',400,'请填写本次操作理由。');
 if(input.action==='review'&&(!['approved','changes_requested'].includes(input.conclusion)||['contentChecked','rightsChecked','selfReviewAcknowledged'].some(k=>input[k]!==undefined&&typeof input[k]!=='boolean')))fail('INPUT_INVALID',400,'审核结论无效。');
 if(input.action==='release'&&(!positive(input.ttlDays)||input.ttlDays>7||!Array.isArray(input.discoveryRecipients)||!input.discoveryRecipients.length||input.discoveryRecipients.length>(runtimeBusiness&&family==='business'?100:2)||new Set(input.discoveryRecipients).size!==input.discoveryRecipients.length||input.discoveryRecipients.some(x=>!id(x)||!(runtimeBusiness&&family==='business')&&![ids.owner,ids.admin].includes(x))))fail('INPUT_INVALID',400,'请选择有效的接收人和不超过7天的期限。');
 return{...input,...(input.reason!==undefined?{reason:input.reason.trim()}:{}),...(input.discoveryRecipients?{discoveryRecipients:[...input.discoveryRecipients].sort()}: {})};
}

export function governanceActions(record,p,version,now=Date.now()){
 const r=record.registry,policy=record.policies.find(x=>x.version===version);
 if(!policy||r.deletedAt||['tenantId','studyGroupId','researchProjectId'].some(k=>r[k]!==p[k]))return[];
 const admin=p.isTenantAdmin===true,own=r.ownerAccountId===p.accountId,head=r.workingVersionNo===version,actions=[];
 if(r.revision>=(record.family?.maxOperations??24))return actions;
 if(admin&&effectiveAssetRelease(record.events,version,now).active)actions.push('withdraw');
 if(!head)return actions.filter(action=>assetEventBudgetAllows(record,action,now));
 if(admin&&r.workingState==='in_review')actions.push('review');
 if(policy.sourceValid!==true)return actions.filter(action=>assetEventBudgetAllows(record,action,now));
 if((admin||own&&p.permissions?.includes('artifact.edit'))&&['draft','changes_requested'].includes(r.workingState))actions.push('submit');
 if(record.family?.family!=='report_context'&&admin&&r.workingState==='approved'&&!record.events.some(e=>e.type==='released'&&e.version===version))actions.push('release');
 return actions.filter(action=>assetEventBudgetAllows(record,action,now));
}

export function governanceTransition(record,input,p,now=Date.now()){
 if(record.family?.family==='report_context'&&!['submit','review'].includes(input.action))fail('FORBIDDEN',403,'此资产仅开放提交与审核。');
 const r=record.registry,policy=record.policies.find(x=>x.version===input.version);
 if(['tenantId','studyGroupId','researchProjectId'].some(k=>r[k]!==p[k]))fail('NOT_FOUND',404,'未找到可管理的资产。');
 if(input.action!=='submit'&&!p.isTenantAdmin)fail('FORBIDDEN',403,'仅当前租户管理员可以审核或发布。');
 // Identity and immutable seals are never accepted from a previously opened account or draft.
 if(input.identityRevision!==p.identityRevision)fail('IDENTITY_CHANGED',409,'账号或授权已变化，请重新打开操作。');
 if(!policy||input.policyHash!==policy.policyHash||input.contentHash!==policy.contentHash)fail('VERSION_CONFLICT');
 if(!assetEventBudgetAllows(record,input.action,now))fail('FIXTURE_CAPACITY',409,'当前操作额度需保留用于停止已发布版本的使用。');
 if(input.action==='release'&&record.events.some(e=>e.type==='released'&&e.version===input.version))fail('ALREADY_RELEASED',409,'该固定版已有发布记录；重新发布须修订后重新审核。');
 const payload={contentHash:policy.contentHash,policyHash:policy.policyHash};
 if(input.reason)payload.reason=input.reason;
 if(input.action==='review'){
  if(input.conclusion==='approved'){
   if(input.contentChecked!==true||input.rightsChecked!==true)fail('REVIEW_CHECK_REQUIRED',422,'请先核对固定版内容与来源用途。');
   if(assetSelfReview(record,policy,p)&&input.selfReviewAcknowledged!==true)fail('SELF_REVIEW_REQUIRED',422,'请明确本次为本人内容审核。');
  }
  Object.assign(payload,{conclusion:input.conclusion,selfReview:assetSelfReview(record,policy,p),contentChecked:input.contentChecked===true,rightsChecked:input.rightsChecked===true});
 }
 let checked=input;
 if(input.action==='release'){
  const expiresAt=new Date(now+input.ttlDays*86400000).toISOString();
  checked={...input,expiresAt};Object.assign(payload,{discoveryRecipients:input.discoveryRecipients,expiresAt});
 }
 const next=assertAssetAction({registry:r,policy,family:record.family,sourceValid:policy.sourceValid,publishedVersions:record.policies.filter(x=>effectiveAssetRelease(record.events,x.version,now).active).map(x=>x.version)},checked,p,now);
 if(input.action==='submit')next.everSubmitted=true;
 if(input.action==='withdraw'){
  const remaining=record.policies.map(x=>x.version).filter(v=>v!==input.version&&effectiveAssetRelease(record.events,v,now).active).sort((a,b)=>b-a);
  next.releasedVersionNo=remaining[0]??null;next.releaseState=remaining.length?'released':'withdrawn';
 }
 return{next,type:{submit:'submitted',review:'reviewed',release:'released',withdraw:'withdrawn'}[input.action],payload,...(input.action==='withdraw'?{revokeVersion:input.version}:{})};
}
