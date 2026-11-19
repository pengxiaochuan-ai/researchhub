import{isBusinessAssetId,assetVersionCeiling}from'../scripts/research-assets-business-identity.mjs';
import {makeCatalogAssetUrl} from './research-assets-catalog-session.js';
import {makeDesignWorkspaceUrl} from './research-design-session.js';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),fail=()=>{throw Object.assign(Error('复用结果与当前固定版本或研究不一致，请重新核对。'),{status:409});};
export function assetReuseRequestAllowed(method,path){if(typeof path!=='string'||/[\\#]/.test(path)||path.includes('..'))return false;const source=path.match(/^\/research-assets\/([^/]+)\/versions\/([1-9][0-9]*)\//);if(!source||Number(source[2])>assetVersionCeiling(source[1]))return false;const base='/research-assets/[A-Za-z0-9_-]{1,160}/versions/'+(isBusinessAssetId(source[1])?'[1-9][0-9]{0,9}':'[1-8]')+'/';return method==='POST'?new RegExp('^'+base+'(?:reuse-previews|reuses)$').test(path):method==='GET'&&(new RegExp('^'+base+'reuse-options$').test(path)||new RegExp('^'+base+'reuse-result\\?requestKey=[A-Za-z0-9_-]{8,160}$').test(path));}
export function assertAssetReusePreview(v,asset,kind){if(v?.schemaVersion!=='rh-asset-reuse-preview.v1'||v.id!==asset.id||v.version!==asset.version||v.kind!==kind||v.identityRevision!==asset.identityRevision||!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<1||v.expectedRevision>=(asset.family==='business'?2147483647:24)||!['contentHash','policyHash','mappingHash'].every(k=>/^[a-f0-9]{64}$/.test(v[k]))||typeof v.title!=='string'||v.title.length>160||typeof v.targetStudyName!=='string'||typeof v.sourceTitle!=='string'||!Array.isArray(v.mappings)||v.mappings.some(x=>typeof x.source!=='string'||typeof x.target!=='string')||!Array.isArray(v.unconfirmed)||v.unconfirmed.some(x=>typeof x!=='string'))fail();return v;}
export function assetReuseResultUrl(v,{asset,scope}){
 const business=asset.family==='business'&&/^rhab-[0-9a-f-]{36}$/.test(asset.id)&&v?.targetContext==='current-project';
 if(v?.schemaVersion!=='rh-asset-reuse-result.v1'||v.id!==asset.id||v.version!==asset.version||!['copy','apply'].includes(v.kind)||!valid(v.targetArtifactId)||v.targetVersion!==1||v.targetProjectId!==(v.kind==='copy'||business?scope.researchProjectId:'rh-asset-detail-20261113-study-b'))fail();
 return v.kind==='copy'?makeCatalogAssetUrl(scope,v.targetArtifactId,1):makeDesignWorkspaceUrl('s07',{...scope,researchProjectId:v.targetProjectId},v.targetArtifactId)+(business?'&assetApplied=1':'');
}
export function canUseAssetAppliedDraft(user,scope){
 if(!scope||!['researcher','tenant_admin'].includes(user?.role)||user.isTenantAdmin!==(user.role==='tenant_admin'))return false;
 const group=user.studyGroups?.find(g=>g.id===scope.studyGroupId),project=group?.researchProjects?.find(p=>p.id===scope.researchProjectId);
 if(!project)return false;
 return user.role==='tenant_admin'||group.role?.menuPermissions?.some(k=>['artifacts','*'].includes(k))===true&&group.role?.buttonPermissions?.some(k=>['artifact.read','*'].includes(k))===true;
}


export function isNamedAssetTargetAdminScope(user,scope){return user?.role==='tenant_admin'&&user.tenantId==='rh-kb-local-b0e2af9d-tenant'&&scope?.studyGroupId==='rh-kb-local-b0e2af9d-group'&&scope.researchProjectId==='rh-asset-detail-20261113-study-b';}

// Explicit A02 resource transport: the endpoint validates named B independently.
// This is not a fallback to another study and never fabricates a membership.
export function assetTargetTransportPath(path,{business=false}={}){
 if(path==='/api/research-plan-drafts?limit=20')return'/api/research-assets/applied-drafts?limit=20';
 const version=business?'[1-9][0-9]{0,9}':'[1-2]';
 const match=new RegExp('^/api/research-plan-drafts/([A-Za-z0-9_-]{1,160})/(design|versions(?:/'+version+')?|guidance-citations(?:\\?versionNo='+version+')?)$').exec(path);
 if(!match)fail();return'/api/research-assets/applied-drafts/'+match[1]+'/'+match[2];
}

export const canRequestAssetReuse=asset=>['detail','business'].includes(asset?.family)&&asset.bodyAccess==='allowed';
