import {effectiveAssetRelease,catalogError} from './research-assets-catalog-contract.mjs';
import {validateAssetGovernance,governanceActions,governanceTransition,governanceScope,assetSelfReview} from './research-assets-governance-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {loadCatalogRecords} from './local-research-assets-catalog-read.mjs';
import {lockCatalogAsset,findCatalogOperation,appendCatalogEvent} from './local-research-assets-registration.mjs';
const fail=(code,status=409,message='资产状态已变化，请重新核对后操作。')=>{throw catalogError(code,status,message);};
const scope=governanceScope;
const positive=x=>Number.isSafeInteger(x)&&x>0;
export {validateAssetGovernance,governanceActions,governanceTransition} from './research-assets-governance-contract.mjs';

export function createAssetGovernance({ids,withAccess,assertSources=async()=>false,now=()=>Date.now(),loadRecords=loadCatalogRecords,validate=input=>validateAssetGovernance(input,{ids}),permissionFor=value=>value.action==='submit'?'artifact.edit':'artifact.read',beforeCommit=async()=>{},auditOptions}){
 const current=async(tx,p,id)=>{
  const r=await lockCatalogAsset(tx,p,id);
  if(r.ownerAccountId!==p.accountId&&!p.isTenantAdmin)fail('NOT_FOUND',404,'未找到可管理的资产。');
  const record=(await loadRecords(tx,p,assertSources)).find(x=>x.registry.assetId===id);
  if(!record)fail('NOT_FOUND',404);return record;
 };
 return{
  options(user,id,version){
   if(!id||!positive(Number(version))||!/^[1-9][0-9]*$/.test(String(version)))fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const record=await current(tx,p,id),r=record.registry,policy=record.policies.find(x=>x.version===Number(version));if(!policy||r.deletedAt)fail('NOT_FOUND',404);
    const accounts=await tx.account.findMany({where:{tenantId:p.tenantId,id:{in:policy.discoveryRecipientCeiling},status:'active'},select:{id:true,displayName:true}});
    return{schemaVersion:'rh-asset-governance.v1',scope:scope(p),assetId:id,version:policy.version,expectedRevision:r.revision,identityRevision:p.identityRevision,contentHash:policy.contentHash,policyHash:policy.policyHash,title:policy.metadata.title,summary:policy.metadata.summary,rightsEvidence:policy.rightsEvidence,sourceValid:policy.sourceValid===true,selfReview:assetSelfReview(record,policy,p),actions:governanceActions(record,p,policy.version,now()).filter(a=>!record.availableActions||record.availableActions.includes(a)),recipients:accounts.map(a=>({accountId:a.id,displayName:a.displayName})),workingState:r.workingState,releaseActive:effectiveAssetRelease(record.events,policy.version,now()).active};
   });
  },
  async execute(user,id,input){
   const value=validate(input);
   return withAccess(user,permissionFor(value),async(tx,p)=>{
    const record=await current(tx,p,id);
    if(value.action!=='submit'&&!p.isTenantAdmin)fail('FORBIDDEN',403,'仅当前租户管理员可以审核或发布。');
    if(value.identityRevision!==p.identityRevision)fail('IDENTITY_CHANGED');
    const requestHash=assetDigest({assetId:id,...scope(p),actor:p.accountId,...value}),old=await findCatalogOperation(tx,p,value.requestKey,requestHash);if(old)return old;
    const result=governanceTransition(record,value,p,now()),r=result.next,policy=record.policies.find(x=>x.version===value.version);
    // Approval/delivery must check actual fixed content as well as the immutable metadata seal.
    if(value.action==='release'||value.action==='review'&&value.conclusion==='approved'){
     const v=await tx.researchArtifactVersion.findFirst({where:{...scope(p),id:policy.artifactVersionId,artifactId:id,versionNo:value.version},select:{contentMd:true}});
     if(!v||assetDigest(v.contentMd)!==policy.contentHash)fail('CONTEXT_INVALID');
    }
    await beforeCommit(tx,p,{record,action:value.action,input:value});
    let reviewId;
    if(value.action==='review'){
     const review=await tx.researchArtifactReview.create({data:{...scope(p),artifactId:id,versionId:policy.artifactVersionId,reviewerAccountId:p.accountId,roleKey:'tenant_admin',conclusion:value.conclusion,comment:value.reason}});reviewId=review.id;result.payload.reviewId=review.id;
    }
    const updated=await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET revision=$1,working_state=$2,submitted_version_no=$3,approved_version_no=$4,released_version_no=$5,release_state=$6,ever_submitted=$7,updated_at=now() WHERE asset_id=$8 AND revision=$9',r.revision,r.workingState,r.submittedVersionNo??null,r.approvedVersionNo??null,r.releasedVersionNo??null,r.releaseState,r.everSubmitted===true,id,record.registry.revision);
    if(updated!==1)fail('VERSION_CONFLICT');
    const receipt={assetId:id,version:value.version,revision:r.revision,operation:result.type,status:'committed',...(reviewId?{reviewId}: {})};
    await appendCatalogEvent(tx,p,{registry:r,version:value.version,type:result.type,requestKey:value.requestKey,requestHash,payload:result.payload,receipt},auditOptions);
    if(result.revokeVersion)await tx.$executeRawUnsafe("UPDATE rh_asset.access_request SET state='revoked',approved_actions='{}',decided_by=$1,decision_reason=$2,revision=revision+1,event_revision=$3,updated_at=now() WHERE asset_id=$4 AND version_no=$5 AND state IN ('pending','approved')",p.accountId,value.reason,r.revision,id,result.revokeVersion);
    return receipt;
   });
  }
 };
}
