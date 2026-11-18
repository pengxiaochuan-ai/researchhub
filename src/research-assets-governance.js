import {assetVersionInRange,assetEventCeiling} from '../scripts/research-assets-business-identity.mjs';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),positive=x=>Number.isSafeInteger(x)&&x>0,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const actions=['submit','review','release','withdraw'],operations={submit:'submitted',review:'reviewed',release:'released',withdraw:'withdrawn'};
const routes={submit:'submissions',review:'reviews',release:'releases',withdraw:'withdrawals'};
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
export function assetGovernanceRequestAllowed(method,path){
 if(typeof path!=='string'||/[\\#]/.test(path)||path.includes('..'))return false;
 if(method==='POST')return /^\/research-assets\/[A-Za-z0-9_-]{1,160}\/(submissions|reviews|releases|withdrawals)$/.test(path);
 const m=method==='GET'&&path.match(/^\/research-assets\/([A-Za-z0-9_-]{1,160})\/governance\?version=([1-9][0-9]*)$/);return Boolean(m&&assetVersionInRange(m[1],Number(m[2])));
}
export function assertGovernanceOptions(v,{user,scope,target}){
 if(!v||v.schemaVersion!=='rh-asset-governance.v1'||v.scope?.tenantId!==user.tenantId||['studyGroupId','researchProjectId'].some(k=>v.scope[k]!==scope[k])||v.assetId!==target.assetId||v.version!==target.version||!positive(v.expectedRevision)||v.expectedRevision>=assetEventCeiling(v.assetId)||!hash(v.identityRevision)||!hash(v.contentHash)||!hash(v.policyHash)||typeof v.title!=='string'||!v.title.trim()||typeof v.summary!=='string'||typeof v.rightsEvidence!=='string'||typeof v.sourceValid!=='boolean'||typeof v.selfReview!=='boolean'||!Array.isArray(v.actions)||v.actions.some(a=>!actions.includes(a))||!v.actions.includes(target.action)||!Array.isArray(v.recipients)||v.recipients.length>2||v.recipients.some(a=>!valid(a.accountId)||typeof a.displayName!=='string'))fail('当前版本或操作权限已变化，请关闭后重新读取。');
 return v;
}
export function buildGovernanceInput(o,t,d,key){
 if(!actions.includes(t.action)||!o.actions.includes(t.action)||!valid(key)||key.length<8)fail('当前操作无法核对。');
 const input={action:t.action,version:t.version,expectedRevision:o.expectedRevision,contentHash:o.contentHash,policyHash:o.policyHash,identityRevision:o.identityRevision,requestKey:key};
 if(t.action==='submit')return input;
 if(typeof d.reason!=='string'||!d.reason.trim()||d.reason.length>2000)fail('请填写本次操作理由；输入已保留。',422);input.reason=d.reason.trim();
 if(t.action==='review'){
  if(!['approved','changes_requested'].includes(d.conclusion))fail('请选择审核结论。',422);
  if(d.conclusion==='approved'&&(!o.sourceValid||d.contentChecked!==true||d.rightsChecked!==true||o.selfReview&&d.selfReviewAcknowledged!==true))fail('请先核对固定版本、来源用途与本人审核事实。',422);
  Object.assign(input,{conclusion:d.conclusion,contentChecked:d.contentChecked===true,rightsChecked:d.rightsChecked===true,selfReviewAcknowledged:d.selfReviewAcknowledged===true});
 }
 if(t.action==='release'){
  if(!positive(d.ttlDays)||d.ttlDays>7||!Array.isArray(d.discoveryRecipients)||!d.discoveryRecipients.length||new Set(d.discoveryRecipients).size!==d.discoveryRecipients.length||d.discoveryRecipients.some(x=>!o.recipients.some(a=>a.accountId===x)))fail('请选择许可范围内的接收人及不超过7天的期限。',422);
  Object.assign(input,{discoveryRecipients:[...d.discoveryRecipients],ttlDays:d.ttlDays});
 }
 return input;
}
export const governanceNeedsProtection=s=>Boolean(s&&(s.dirty||['submitting','unknown','retryable'].includes(s.phase)));
export const assetGovernancePendingKey=(user,scope)=>'rh-asset-governance-pending:'+JSON.stringify([user.tenantId,user.accountId,user.authVersion,scope.studyGroupId,scope.researchProjectId]);
export function createAssetGovernanceFlow({user,scope,api,storage,onChange=()=>{},onCommitted=()=>{},makeKey=()=>crypto.randomUUID()}){
 const context={tenantId:user.tenantId,accountId:user.accountId,authVersion:user.authVersion,...scope},storageKey=assetGovernancePendingKey(user,scope);
 let s={open:false,phase:'idle',dirty:false,options:null,draft:null},epoch=0,payload=null,markerOnly=false;
 const update=v=>{s={...s,...v};onChange(s);},clear=()=>{try{storage?.removeItem(storageKey);}catch{/* Marker can only re-read an existing receipt. */}};
 function accepted(v){if(!v||v.status!=='committed'||v.assetId!==s.target.assetId||v.version!==s.target.version||v.revision!==s.expectedRevision||v.operation!==operations[s.target.action])throw Object.assign(new Error('操作结果与原对象不一致，请继续核对。'),{code:'ASSET_CATALOG_CONTEXT_INVALID'});clear();update({phase:'committed',dirty:false,receipt:v,message:'操作结论已保存，请以重新读取的资产状态为准。'});onCommitted(v);}
 return{
  state:()=>s,
  async open(target){
   if(governanceNeedsProtection(s)){if(s.target?.assetId!==target.assetId||s.target?.version!==target.version||s.target?.action!==target.action)fail('尚有未完成操作，请先保存、核对或放弃原输入。');update({open:true});return;}
   const token=++epoch;payload=null;markerOnly=false;update({open:true,phase:'loading',dirty:false,target,options:null,draft:null,message:''});
   try{
    const raw=storage?.getItem(storageKey);if(raw){const m=JSON.parse(raw);if(JSON.stringify(m.context)!==JSON.stringify(context)||!valid(m.requestKey)||!valid(m.target?.assetId)||!positive(m.target.version)||!assetVersionInRange(m.target.assetId,m.target.version)||!actions.includes(m.target.action)||!positive(m.expectedRevision)||m.expectedRevision>assetEventCeiling(m.target.assetId))fail('原操作标识无法核对，请先检查资产状态。');payload={requestKey:m.requestKey};markerOnly=true;update({phase:'unknown',target:m.target,expectedRevision:m.expectedRevision,message:'上次操作结果尚待核对；审核输入未保存在浏览器。'});return;}
    const o=assertGovernanceOptions(await api.get('/research-assets/'+target.assetId+'/governance?version='+target.version),{user,scope,target});if(token!==epoch)return;
    update({phase:'editing',options:o,draft:{reason:'',conclusion:o.sourceValid?'approved':'changes_requested',contentChecked:false,rightsChecked:false,selfReviewAcknowledged:false,discoveryRecipients:o.recipients.map(a=>a.accountId),ttlDays:7}});
   }catch(e){if(token===epoch)update({phase:'error',message:e.message});}
  },
  change(v){if(s.phase!=='editing')fail('请先核对原操作结果。');update({draft:{...s.draft,...v},dirty:true,message:''});},
  close(){if(!['loading','submitting'].includes(s.phase))update({open:false});},
  discard(){if(['submitting','unknown'].includes(s.phase))return;epoch++;payload=null;clear();update({open:false,phase:'idle',dirty:false,options:null,draft:null,target:null,message:''});},
  pause(){epoch++;update({phase:s.phase==='submitting'?'unknown':s.phase==='loading'?'error':s.phase,message:'当前读取暂不可用，输入已保留；请重新读取后核对原操作。'});},
  invalidate(){epoch++;payload=null;update({open:false,phase:'invalid',dirty:false,options:null,draft:null,target:null,message:''});},
  async save(){
   if(!['editing','retryable'].includes(s.phase))return;const token=epoch;let sent=false;
   try{
    if(s.phase==='editing'){payload=buildGovernanceInput(s.options,s.target,s.draft,makeKey());update({expectedRevision:payload.expectedRevision+1});}
    const marker=JSON.stringify({context,target:s.target,requestKey:payload.requestKey,expectedRevision:s.expectedRevision});
    if(storage){storage.setItem(storageKey,marker);if(storage.getItem(storageKey)!==marker)fail('无法保存核对标识，尚未发送操作。');}
    update({phase:'submitting',message:'正在保存操作结论…'});sent=true;const receipt=await api.post('/research-assets/'+s.target.assetId+'/'+routes[s.target.action],payload);if(token!==epoch)return;accepted(receipt);
   }catch(e){if(token!==epoch)return;const unknown=sent&&(!e.status||e.status>=500||['ASSET_CATALOG_REQUEST_KEY_CONFLICT','ASSET_CATALOG_CONTEXT_INVALID'].includes(e.code));if(!unknown)clear();update({phase:unknown?'unknown':'editing',message:unknown?'操作结果尚未确认；输入已保留，请先核对原结果。':e.message});}
  },
  async lookup(){if(s.phase!=='unknown')return;const token=epoch;update({message:'正在核对原操作结果…'});try{const receipt=await api.get('/research-assets/operations/'+payload.requestKey);if(token!==epoch)return;if(receipt.status==='committed')accepted(receipt);else if(receipt.status==='not_found'){if(markerOnly){clear();update({phase:'absent',dirty:false,message:'未找到原操作记录，请关闭后核对当前资产，再重新操作。'});}else update({phase:'retryable',message:'未找到原记录，可以使用原输入重试。'});}else fail('原操作结果暂时无法核对。');}catch(e){if(token===epoch)update({phase:'unknown',message:e.message});}}
 };
}
