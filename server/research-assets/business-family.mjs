import{catalogError}from'../../scripts/research-assets-catalog-contract.mjs';
import{isBusinessAssetId as assetId}from'../../scripts/research-assets-business-identity.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>0&&x<=2147483647;
const prefix='rh-research-asset:business:v1:';
export function businessAssetKey(value){if(!assetId(value))throw catalogError('INPUT_INVALID',400,'业务资产标识无效。');return prefix+value;}
// Classification is not authorization. The runtime must also use the current
// Study principal, RLS, immutable policy/source checks and atomic event chain.
export function businessAssetFamily(parent,registry){
 if(!parent||!registry||!assetId(registry.assetId)||!['tenantId','studyGroupId','researchProjectId','ownerAccountId'].every(k=>id(registry[k]))||!['protocol','dataset','instrument','analysis','publication'].includes(registry.kind)||!integer(registry.revision)||!integer(registry.workingVersionNo))return null;
 if(parent.id!==registry.assetId||parent.idempotencyKey!==prefix+registry.assetId||!['tenantId','studyGroupId','researchProjectId','ownerAccountId'].every(k=>parent[k]===registry[k])||parent.createdBy!==registry.ownerAccountId||parent.typeKey!=='research_report'||parent.status!=='draft'||parent.deletedAt||parent.currentVersionNo!==registry.workingVersionNo)return null;
 return{family:'business',maxVersions:2147483647,maxOperations:2147483647};
}
