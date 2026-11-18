// Hub-owned draft envelope; no database, model, file or initialization side effects.
import {createHash} from 'node:crypto';

export const RESEARCH_ASSET_PREFIX='rh-research-asset:';
export const RESEARCH_ASSET_MARKER='rh-research-asset-candidate.v1';
export const RESEARCH_ASSET_KINDS=Object.freeze(['protocol','dataset','instrument','analysis','publication']);
const scopeKeys=['tenantId','studyGroupId','researchProjectId'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const positive=value=>Number.isSafeInteger(value)&&value>0;
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const hash=text=>createHash('sha256').update(text).digest('hex');
const digest=value=>hash(JSON.stringify(value,(_key,item)=>plain(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item));
export function researchAssetError(code,status,message){return Object.assign(new Error(message),{code,status});}
const invalid=()=>researchAssetError('RESEARCH_ASSET_INPUT_INVALID',400,'资产标识、版本或内容格式无效。');
const corrupt=()=>researchAssetError('RESEARCH_ASSET_CONTEXT_INVALID',409,'资产版本信息无法核对，请返回目录重新打开。');
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function readResearchAssetRequest(id,version){
 if(!identifier(id)||version!==undefined&&(typeof version!=='string'||!/^[1-9][0-9]*$/.test(version)||!positive(Number(version))))throw invalid();
 return{id,versionNo:version===undefined?undefined:Number(version)};
}
function validEnvelope(block){
 return exact(block,['type','registrationKey','assetKind','versionNo','ownerAccountId',...scopeKeys,'metadata','source','contentHash'])&&
  block.type===RESEARCH_ASSET_MARKER&&typeof block.registrationKey==='string'&&block.registrationKey.startsWith(RESEARCH_ASSET_PREFIX)&&block.registrationKey.length<=240&&
  RESEARCH_ASSET_KINDS.includes(block.assetKind)&&positive(block.versionNo)&&[...scopeKeys,'ownerAccountId'].every(key=>identifier(block[key]))&&
  exact(block.metadata,['title','summary','purpose','limitations','author'])&&Object.entries(block.metadata).every(([key,value])=>text(value,key==='title'?300:2000))&&
  exact(block.source,['kind','label'])&&block.source.kind==='author_declared_synthetic'&&text(block.source.label,1000)&&/^[a-f0-9]{64}$/.test(block.contentHash);
}
/** Used by the future Hub writer and named test fixtures, never exposed as a read endpoint. */
export function sealResearchAssetVersion({registrationKey,assetKind,versionNo,ownerAccountId,tenantId,studyGroupId,researchProjectId,metadata,source,contentMd}){
 if(!text(contentMd,120000))throw invalid();
 const block={type:RESEARCH_ASSET_MARKER,registrationKey,assetKind,versionNo,ownerAccountId,tenantId,studyGroupId,researchProjectId,metadata,source,contentHash:hash(contentMd)};
 if(!validEnvelope(block))throw invalid();
 return structuredClone({...block,seal:digest(block)});
}
export function assertResearchAssetIdentity(artifact,user){
 if(!artifact||!scopeKeys.every(key=>identifier(user?.[key])&&artifact[key]===user[key])||!identifier(user?.accountId)||
  artifact.ownerAccountId!==user.accountId||artifact.createdBy!==user.accountId||artifact.deletedAt!==null||artifact.status!=='draft'||artifact.typeKey!=='research_report'||
  !identifier(artifact.id)||artifact.id.startsWith('rh-formal-report-')||!positive(artifact.currentVersionNo)||
  typeof artifact.idempotencyKey!=='string'||!artifact.idempotencyKey.startsWith(RESEARCH_ASSET_PREFIX)){
  throw researchAssetError('RESEARCH_ASSET_NOT_FOUND',404,'未找到可访问的资产草稿。');
 }
}
export function presentResearchAssetVersion({artifact,version,user}){
 assertResearchAssetIdentity(artifact,user);
 if(!version||version.artifactId!==artifact.id||!scopeKeys.every(key=>version[key]===artifact[key])||version.createdBy!==user.accountId||
  !positive(version.versionNo)||version.versionNo>artifact.currentVersionNo||!text(version.contentMd,120000)||!Array.isArray(version.contentBlocks)||version.contentBlocks.length!==1)throw corrupt();
 const block=version.contentBlocks[0];
 if(!plain(block)||!Object.hasOwn(block,'seal'))throw corrupt();
 const {seal,...unsigned}=block;
 if(!validEnvelope(unsigned)||seal!==digest(unsigned)||unsigned.contentHash!==hash(version.contentMd)||
  unsigned.registrationKey!==artifact.idempotencyKey||unsigned.ownerAccountId!==artifact.ownerAccountId||
  unsigned.versionNo!==version.versionNo||!scopeKeys.every(key=>unsigned[key]===artifact[key]))throw corrupt();
 return{schemaVersion:'rh-research-asset-detail.v1',id:artifact.id,kind:block.assetKind,title:block.metadata.title,status:'draft',ownerAccountId:artifact.ownerAccountId,
  tenantId:artifact.tenantId,studyGroupId:artifact.studyGroupId,researchProjectId:artifact.researchProjectId,
  version:version.versionNo,currentVersion:artifact.currentVersionNo,isHistorical:version.versionNo!==artifact.currentVersionNo,readOnly:true,
  contentMd:version.contentMd,metadata:structuredClone(block.metadata),source:structuredClone(block.source),assetCreatedAt:artifact.createdAt,createdAt:version.createdAt,changeSummary:version.changeSummary};
}
