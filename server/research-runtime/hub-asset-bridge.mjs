import {createHash} from 'node:crypto';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {supportsHubAssetSource} from '../hub-assets/source-reader.mjs';

export const HUB_COPY_MARKER='rh-hub-asset-copy.v1';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const fail=()=>{throw catalogError('HUB_SOURCE_UNAVAILABLE',409,'固定成果或当前权限已变化，请重新核对。');};

/** Adapters run on the caller's existing transaction and current actor only. */
export function createHubAssetBridge({tenantId,resolveScope,authorize,readRecords,readBody,createArtifact,readScopes,readArtifact,readVersions,saveVersion}){
 for(const fn of [resolveScope,authorize,readRecords,readBody,createArtifact,readScopes])if(typeof fn!=='function')throw TypeError('HUB_ASSET_BRIDGE_REQUIRED');
 async function principal(tx,user,ref,permission){
  if(user?.tenantId!==tenantId||!id(user.accountId)||!Number.isSafeInteger(user.authVersion))fail();
  const scope=await resolveScope(user,ref);
  if(scope?.tenantId!==tenantId||!id(scope.studyGroupId)||!id(scope.researchProjectId))fail();
  return authorize(tx,user,scope,permission);
 }
 async function resolveSource(tx,user,ref){
  if(!id(ref?.studyId)||!id(ref.assetId)||!ref.assetId.startsWith('rhab-')||!Number.isSafeInteger(ref.version)||ref.version<1)fail();
  const p=await principal(tx,user,ref,'artifact.read');
  const records=await readRecords(tx,p,ref.assetId),r=records.find(r=>r.registry.assetId===ref.assetId),policy=r?.policies.find(x=>x.version===ref.version);
  if(!r||r.registry.ownerAccountId!==user.accountId||r.registry.deletedAt||r.registry.approvedVersionNo!==ref.version||policy?.sourceValid!==true)fail();
  const contentMd=await readBody(tx,p,ref.assetId,ref.version,policy);
  if(typeof contentMd!=='string'||digest(contentMd)!==policy.contentHash)fail();
  return{...p,assetId:ref.assetId,version:ref.version,title:policy.metadata.title,summary:policy.metadata.summary??'',kind:r.registry.kind,contentHash:policy.contentHash,policyHash:policy.policyHash,contentMd,sourceKind:policy.sourceKind,sourceBindings:policy.sourceBindings,ownerId:r.registry.ownerAccountId,ownerDisplayName:r.registry.ownerName,registryRevision:r.registry.revision};
 }
 async function createTarget(tx,user,input){
  const source=input?.source;
  if(!id(input?.targetStudyId)||!id(input.requestKey)||input.requestKey.length<8||typeof input.title!=='string'||!input.title.trim()||input.title.length>300||typeof input.contentMd!=='string'||!input.contentMd.trim()||!id(source?.entryId)||!id(source.assetId)||!Number.isSafeInteger(source.version)||source.version<1||![source.contentHash,source.policyHash].every(x=>/^[a-f0-9]{64}$/.test(x??''))||digest(input.contentMd)!==source.contentHash)fail();
  const p=await principal(tx,user,{studyId:input.targetStudyId},'artifact.create');
  const block={type:HUB_COPY_MARKER,ownerAccountId:p.accountId,targetStudyId:input.targetStudyId,targetProjectId:p.researchProjectId,source:{...source},sourceStatus:'fixed_at_copy',requiresApplicabilityReview:true};
  const requestHash=digest(canonical({actor:p.accountId,targetStudyId:input.targetStudyId,title:input.title,source}));
  const result=await createArtifact(tx,p,{title:input.title.trim(),typeKey:'protocol_draft',idempotencyKey:'hub-asset-copy:'+p.accountId+':'+input.requestKey,creationRequestHash:requestHash,contentMd:input.contentMd,contentBlocks:[{...block,seal:digest(canonical(block))}]});
  if(!id(result?.id))fail();
  return{targetArtifactId:result.id,targetStudyId:input.targetStudyId,version:1};
 }
 async function reuseTargets(tx,user){
  const candidates=await readScopes(user),items=[];
  for(const candidate of candidates){
   try{const p=await principal(tx,user,{studyId:candidate.studyId},'artifact.create');items.push({id:candidate.studyId,studyId:candidate.studyId,title:candidate.title??p.projectName});}
   catch(error){if(![403,404].includes(error.status??error.getStatus?.()))throw error;}
  }
  return items;
 }
 async function candidates(tx,user,studyId){
  if(!id(studyId))fail();const p=await principal(tx,user,{studyId},'artifact.read'),rows=await readRecords(tx,p);
  return rows.filter(r=>r.registry.ownerAccountId===user.accountId&&!r.registry.deletedAt).flatMap(r=>{
   const policy=r.policies.find(v=>v.version===r.registry.approvedVersionNo);
   return policy?.sourceValid===true&&supportsHubAssetSource(policy)?[{studyId,assetId:r.registry.assetId,version:policy.version,title:policy.metadata.title,summary:policy.metadata.summary??'',kind:r.registry.kind}]:[];
  });
 }
 async function target(tx,user,{artifactId,copyFact},permission){
  if(!id(artifactId)||copyFact?.actor_id!==user.accountId||copyFact.target_artifact_id!==artifactId||!id(copyFact.target_study_id)||![readArtifact,readVersions].every(fn=>typeof fn==='function'))fail();
  const p=await principal(tx,user,{studyId:copyFact.target_study_id},permission),a=await readArtifact(tx,p,artifactId);
  if(!a||a.id!==artifactId||a.ownerAccountId!==user.accountId||a.createdBy!==user.accountId||a.typeKey!=='protocol_draft'||a.deletedAt||!['tenantId','studyGroupId','researchProjectId'].every(key=>a[key]===p[key]))fail();
  const versions=await readVersions(tx,p,artifactId),current=versions.find(v=>v.versionNo===a.currentVersionNo),first=versions.find(v=>v.versionNo===1);
  let lineage;
  for(const v of [first,current]){
   const b=v?.contentBlocks?.find(block=>block.type===HUB_COPY_MARKER),unsigned={...b};delete unsigned.seal;
   if(!b||b.ownerAccountId!==user.accountId||b.targetStudyId!==copyFact.target_study_id||b.targetProjectId!==p.researchProjectId||b.source?.entryId!==copyFact.entry_id||b.source.assetId!==copyFact.asset_id||b.source.policyHash!==copyFact.policy_hash||b.source.version!==copyFact.source_version||b.source.contentHash!==copyFact.source_hash||digest(canonical(unsigned))!==b.seal||digest(v.contentMd)!==v.contentHash)fail();
   if(lineage&&canonical(b.source)!==canonical(lineage))fail();lineage=b.source;
  }
  if(first.contentHash!==copyFact.source_hash)fail();
  return{p,a,current};
 }
 const projectTarget=(t,studyId)=>({id:t.a.id,studyId,title:t.a.title,version:t.current.versionNo,currentVersion:t.a.currentVersionNo,contentMd:t.current.contentMd});
 async function readTarget(tx,user,input){const t=await target(tx,user,input,'artifact.read');return projectTarget(t,input.copyFact.target_study_id);}
 async function saveTarget(tx,user,input){
  const b=input?.body;if(!b||!Number.isSafeInteger(b.expectedVersion)||b.expectedVersion<1||!id(b.requestKey)||typeof b.contentMd!=='string'||!b.contentMd.trim()||Buffer.byteLength(b.contentMd,'utf8')>131072||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(b.contentMd)||typeof saveVersion!=='function')fail();
  const t=await target(tx,user,input,'artifact.edit');
  if(t.a.currentVersionNo!==b.expectedVersion)throw catalogError('HUB_ASSET_DRAFT_VERSION_CONFLICT',409,'草稿已更新，请保留输入并重新读取当前版本。');
  await saveVersion(tx,t.p,input.artifactId,{baseVersionNo:b.expectedVersion,contentMd:b.contentMd,contentBlocks:t.current.contentBlocks,changeSummary:'修订本人从Hub复用的方案草稿'});
  return readTarget(tx,user,input);
 }
 return{resolveSource,createTarget,candidates,reuseTargets,readTarget,saveTarget};
}
