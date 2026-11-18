import {assertAssetAction,catalogError,assetTrashBlock} from './research-assets-catalog-contract.mjs';
import {assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
import {loadCatalogRecords} from './local-research-assets-catalog-read.mjs';
import {lockCatalogAsset,findCatalogOperation,appendCatalogEvent} from './local-research-assets-registration.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
const fail=(code,status=409,message='资产回收状态已变化，请重新核对。')=>{throw catalogError(code,status,message);};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),positive=x=>Number.isSafeInteger(x)&&x>0,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function validateAssetLifecycle(v,{family='catalog'}={}){
 if(!v||Array.isArray(v)||Object.keys(v).some(k=>!['action','version','expectedRevision','identityRevision','contentHash','policyHash','requestKey','reason'].includes(k))||!['trash','restore'].includes(v.action)||!positive(v.version)||v.version>(family==='business'?2147483647:8)||!positive(v.expectedRevision)||v.expectedRevision>(family==='business'?2147483647:24)||!valid(v.requestKey)||v.requestKey.length<8||typeof v.identityRevision!=='string'||!v.identityRevision||v.identityRevision.length>300||!hash(v.contentHash)||!hash(v.policyHash)||typeof v.reason!=='string'||!v.reason.trim()||v.reason.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v.reason))fail('INPUT_INVALID',400,'请填写有效的处理理由并重新核对资产。');return{...v,reason:v.reason.trim()};
}
export function lifecycleTransition(record,records,input,p,now=Date.now()){
 const v=validateAssetLifecycle(input,{family:record.family?.family}),r=record.registry,policy=record.policies.find(x=>x.version===v.version);
 if(v.identityRevision!==p.identityRevision||!policy||policy.contentHash!==v.contentHash||policy.policyHash!==v.policyHash)fail('VERSION_CONFLICT');
 if(!assetEventBudgetAllows(record,v.action,now))fail('FIXTURE_CAPACITY');
 const reason=assetTrashBlock(record,records);if(reason)fail('STATE_CONFLICT',409,reason);
 return assertAssetAction({registry:r,sourceValid:policy.sourceValid===true,everSubmitted:r.everSubmitted,hasReferences:false},v,p,now);
}
export function createAssetLifecycle({withAccess,assertSources=async()=>false,now=()=>Date.now(),loadRecords=loadCatalogRecords,family='catalog',beforeCommit=async()=>{},auditOptions}){
 async function current(tx,p,id){const r=await lockCatalogAsset(tx,p,id);if(r.ownerAccountId!==p.accountId&&!p.isTenantAdmin)fail('NOT_FOUND',404);const records=await loadRecords(tx,p,assertSources),record=records.find(x=>x.registry.assetId===id);if(!record)fail('NOT_FOUND',404);return{record,records};}
 return{
  options(user,id,version){if(!valid(id)||!/^[1-9][0-9]*$/.test(String(version))||!positive(Number(version))||Number(version)>(family==='business'?2147483647:8))fail('INPUT_INVALID',400);return withAccess(user,'artifact.read',async(tx,p)=>{
   const {record,records}=await current(tx,p,id),r=record.registry,policy=record.policies.find(x=>x.version===Number(version));if(!policy)fail('NOT_FOUND',404);
   const action=r.deletedAt?'restore':'trash',blocked=policy.version!==r.workingVersionNo?'当前选择为历史版本。':policy.sourceValid!==true?'来源当前不可用，暂不能操作。':!assetEventBudgetAllows(record,action,now())?'已达当前操作上限。':!p.isTenantAdmin&&!p.permissions?.includes('artifact.edit')?'当前账号没有编辑权限。':assetTrashBlock(record,records);
   return{schemaVersion:'rh-asset-lifecycle.v1',scope:{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId},assetId:id,version:policy.version,title:policy.metadata.title,action,expectedRevision:r.revision,identityRevision:p.identityRevision,contentHash:policy.contentHash,policyHash:policy.policyHash,allowed:!blocked,unavailableReason:blocked??null};
  });},
  async execute(user,id,input){if(!valid(id))fail('INPUT_INVALID',400);const value=validateAssetLifecycle(input,{family});return withAccess(user,'artifact.edit',async(tx,p)=>{
   const {record,records}=await current(tx,p,id);if(value.identityRevision!==p.identityRevision)fail('IDENTITY_CHANGED');
   const requestHash=assetDigest({assetId:id,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,actor:p.accountId,...value}),prior=await findCatalogOperation(tx,p,value.requestKey,requestHash);if(prior)return prior;
   const next=lifecycleTransition(record,records,value,p,now());
   await beforeCommit(tx,p,{record,action:value.action,input:value});
   const changed=await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET deleted_at=$1::timestamptz,revision=$2,updated_at=now() WHERE asset_id=$3 AND revision=$4',next.deletedAt??null,next.revision,id,record.registry.revision);if(changed!==1)fail('VERSION_CONFLICT');
   const type=value.action==='trash'?'trashed':'restored',receipt={assetId:id,version:value.version,revision:next.revision,operation:type,status:'committed'};
   await appendCatalogEvent(tx,p,{registry:next,version:value.version,type,requestKey:value.requestKey,requestHash,payload:{reason:value.reason,contentHash:value.contentHash,policyHash:value.policyHash},receipt},auditOptions);return receipt;
  });}
 };
}
