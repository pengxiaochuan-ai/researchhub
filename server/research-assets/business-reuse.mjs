import {randomUUID} from 'node:crypto';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {createAssetCatalogReader,loadCatalogRecords,fixedReleaseState} from '../../scripts/local-research-assets-catalog-read.mjs';
import {lockCatalogAsset,appendCatalogEvent,findCatalogOperation,writeAssetVersion} from '../../scripts/local-research-assets-registration.mjs';
import {buildAssetReuseMapping,ASSET_APPLICATION_MARKER} from '../../scripts/research-assets-reuse.mjs';
import {runtimeReuseKey} from '../../deploy/asset-production-ddl.mjs';
import {businessAssetKey} from './business-family.mjs';
const fail=(code='REUSE_CONTEXT_CHANGED',status=409)=>{throw catalogError(code,status,'来源、目标或复用条件已变化，请保留输入并重新核对。');};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0&&x<2147483647;
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const scope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
export function validateBusinessReuse(input){
 const keys=['kind','title','expectedRevision','identityRevision','contentHash','policyHash','mappingHash','requestKey'];
 if(!input||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k))||!['copy','apply'].includes(input.kind)||!id(input.requestKey)||input.requestKey.length<8||typeof input.title!=='string'||!input.title.trim()||input.title.length>160||/[\u0000-\u001f\u007f]/.test(input.title)||!positive(input.expectedRevision)||!['identityRevision','contentHash','policyHash','mappingHash'].every(k=>hash(input[k])))fail('INPUT_INVALID',400);
 return input;
}
// First production-equivalent slice: explicit source and destination share the
// current authorized project. No implicit Study creation or membership grants.
export function createBusinessAssetReuse({withAccess,assertSources,artifacts,loadRecords=loadCatalogRecords,now=Date.now}){
 const reader=(tx,p)=>createAssetCatalogReader({withAccess:(_u,_permission,run)=>run(tx,p),assertSources,loadRecords,now});
 async function source(tx,p,assetId,v,kind,{write=false}={}){
  if(!id(assetId)||!positive(Number(v))||!['copy','apply'].includes(kind))fail('INPUT_INVALID',400);
  if(write)await lockCatalogAsset(tx,p,assetId);
  const record=(await loadRecords(tx,p,assertSources)).find(r=>r.registry.assetId===assetId);
  if(!record||record.family.family!=='business')fail('NOT_FOUND',404);
  const detail=await reader(tx,p).detail({},assetId,Number(v)),policy=record.policies.find(p=>p.version===Number(v));
  const [rights]=await tx.$queryRawUnsafe("SELECT rh_asset.detail_actor_can_use($1,$2::integer,$3) AS allowed",assetId,Number(v),kind==='copy'?'derive':'apply');
  if(detail.bodyAccess!=='allowed'||policy?.sourceValid!==true||rights?.allowed!==true||fixedReleaseState(record,Number(v),now())==='withdrawn'||kind==='apply'&&record.registry.kind!=='protocol')fail('FORBIDDEN',403);
  return{record,detail,policy};
 }
 async function proposal(tx,p,assetId,v,kind,title){
  const c=await source(tx,p,assetId,v,kind),mapping=buildAssetReuseMapping(c.detail,kind);
  if(title!==undefined){if(typeof title!=='string'||!title.trim()||title.length>160||/[\u0000-\u001f\u007f]/.test(title))fail('INPUT_INVALID',400);mapping.title=title.trim();}
  const binding={sourceId:assetId,version:Number(v),kind,expectedRevision:c.record.registry.revision,identityRevision:p.identityRevision,contentHash:c.policy.contentHash,policyHash:c.policy.policyHash,targetProjectId:p.researchProjectId,mapping};
  return{c,mapping,binding,mappingHash:assetDigest(binding)};
 }
 async function target(tx,p,artifactId,v){
  if(!id(artifactId)||v!==undefined&&!positive(Number(v)))fail('INPUT_INVALID',400);
  const a=await tx.researchArtifact.findFirst({where:{...scope(p),id:artifactId,ownerAccountId:p.accountId,createdBy:p.accountId,typeKey:'protocol_draft',status:'draft',deletedAt:null}});
  if(!a||!a.idempotencyKey?.startsWith('rhab-reuse:')||a.approvedVersionNo||a.releasedVersionNo||a.reviewSubmittedVersionNo)fail('NOT_FOUND',404);
  const versions=await tx.researchArtifactVersion.findMany({where:{...scope(p),artifactId},orderBy:{versionNo:'desc'}}),selected=versions.find(vv=>vv.versionNo===(v===undefined?a.currentVersionNo:Number(v))),block=selected?.contentBlocks?.find(b=>b.type===ASSET_APPLICATION_MARKER),unsigned={...block};delete unsigned.seal;
  if(!selected||!block||block.ownerAccountId!==p.accountId||block.targetProjectId!==p.researchProjectId||block.sourceProjectId!==p.researchProjectId||block.pico!==null||block.confirmation!==null||assetDigest(unsigned)!==block.seal||assetDigest(selected.contentMd)!==selected.contentHash)fail();
  const [origin]=await tx.$queryRawUnsafe("SELECT * FROM rh_asset.asset_reuse_record WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND target_artifact_id=$4 AND actor_account_id=$5 AND kind='apply'",p.tenantId,p.studyGroupId,p.researchProjectId,a.id,p.accountId);
  if(!origin||origin.asset_id!==block.sourceId||origin.version_no!==block.sourceVersion||origin.source_hash!==block.sourceHash||origin.source_policy_hash!==block.sourcePolicyHash||origin.mapping_hash!==block.mappingHash||origin.target_project_id!==p.researchProjectId||a.idempotencyKey!==runtimeReuseKey({kind:'apply',assetId:origin.asset_id,version:origin.version_no,targetProjectId:p.researchProjectId,accountId:p.accountId,requestKey:origin.request_key}))fail();
  return{a,versions,selected,block};
 }
 async function projectTarget(tx,p,artifactId,v){
  const t=await target(tx,p,artifactId,v);let available=false,sourceTitle;
  try{const c=await source(tx,p,t.block.sourceId,t.block.sourceVersion,'apply');available=c.policy.contentHash===t.block.sourceHash&&c.policy.policyHash===t.block.sourcePolicyHash;sourceTitle=available?c.detail.metadata.title:undefined;}catch(e){if(![403,404,409].includes(e.status))throw e;}
  return{id:t.a.id,version:t.selected.versionNo,currentVersion:t.a.currentVersionNo,title:t.a.title,stage:'asset_template_draft',sourceStatus:available?'current':'stale',contentMd:t.selected.contentMd,createdAt:t.selected.createdAt,pico:null,confirmation:null,sources:[],coverage:{selectedFragments:0,scope:'fixed_asset_version'},versions:t.versions.map(v=>({versionNo:v.versionNo,changeSummary:v.changeSummary,createdAt:v.createdAt})),quota:{blocked:true,message:'请先核对模板适用条件并确认研究意图。'},assetReuse:{sourceAvailable:available,...(available?{sourceId:t.block.sourceId,sourceVersion:t.block.sourceVersion,sourceTitle}:{}),sourceProjectId:p.researchProjectId,targetProjectId:p.researchProjectId,unconfirmed:t.block.unconfirmed,canEdit:available&&(p.isTenantAdmin||p.permissions.includes('artifact.edit'))}};
 }
 const service={
  options:(user,assetId,v)=>withAccess(user,'artifact.read',async(tx,p)=>{const actions={};for(const kind of ['copy','apply']){try{if(!p.isTenantAdmin&&!p.permissions.includes('artifact.create'))fail('FORBIDDEN',403);await proposal(tx,p,assetId,v,kind);actions[kind]={allowed:true};}catch(e){if(![403,404,409].includes(e.status))throw e;actions[kind]={allowed:false,reason:e.message};}}return{schemaVersion:'rh-asset-reuse-options.v1',id:assetId,version:Number(v),identityRevision:p.identityRevision,actions};}),
  preview:(user,assetId,v,{kind,title}={})=>withAccess(user,'artifact.create',async(tx,p)=>{const q=await proposal(tx,p,assetId,v,kind,title);return{schemaVersion:'rh-asset-reuse-preview.v1',id:assetId,version:Number(v),kind,expectedRevision:q.binding.expectedRevision,identityRevision:p.identityRevision,contentHash:q.binding.contentHash,policyHash:q.binding.policyHash,mappingHash:q.mappingHash,title:q.mapping.title,targetStudyName:p.projectName,targetProjectId:p.researchProjectId,sourceTitle:q.c.detail.metadata.title,unconfirmed:q.mapping.unconfirmed,mappings:[{target:'题名',source:'来源题名'},{target:'草稿正文',source:'来源固定版本正文'},{target:'研究意图及方法配置',source:'待研究者确认，不继承原确认或审批'}]};}),
  execute(user,assetId,v,input){validateBusinessReuse(input);return withAccess(user,'artifact.create',async(tx,p)=>{
   const c=await source(tx,p,assetId,v,input.kind,{write:true}),requestHash=assetDigest({kind:'business-asset-reuse.v1',id:assetId,v:Number(v),actor:p.accountId,...input}),old=await findCatalogOperation(tx,p,input.requestKey,requestHash);if(old)return old;
   const q=await proposal(tx,p,assetId,v,input.kind,input.title);if(['expectedRevision','identityRevision','contentHash','policyHash'].some(k=>input[k]!==q.binding[k])||input.mappingHash!==q.mappingHash)fail();
   const key=runtimeReuseKey({kind:input.kind,assetId,version:Number(v),targetProjectId:p.researchProjectId,accountId:p.accountId,requestKey:input.requestKey});let result;
   if(input.kind==='copy'){
    const copyId='rhab-'+randomUUID();result=await tx.researchArtifact.create({data:{...scope(p),id:copyId,typeKey:'research_report',status:'draft',title:q.mapping.title,ownerAccountId:p.accountId,createdBy:p.accountId,idempotencyKey:businessAssetKey(copyId),creationRequestHash:key.slice('rhab-reuse:'.length)}});
    const registry={assetId:copyId,...scope(p),ownerAccountId:p.accountId,kind:c.record.registry.kind,revision:1,workingVersionNo:1};
    await tx.$executeRawUnsafe('INSERT INTO rh_asset.asset_registry(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind) VALUES($1,$2,$3,$4,$5,$6)',copyId,p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId,registry.kind);
    await writeAssetVersion(tx,p,registry,{kind:registry.kind,metadata:{...c.policy.metadata,title:q.mapping.title,author:p.displayName},contentMd:q.mapping.contentMd,sourceKind:'artifact',sourceBindings:[{kind:'artifact',id:assetId,version:Number(v),contentHash:c.policy.contentHash}],policy:{rightsEvidence:'来源固定版获准派生；副本独立私有，适用条件待确认。'+c.policy.rightsEvidence,discoveryRecipients:[]}},{family:'business'});
    await appendCatalogEvent(tx,p,{registry,version:1,type:'created',requestKey:'rhab_copy_created_'+assetDigest(input.requestKey),requestHash:assetDigest({requestHash,target:copyId}),receipt:{status:'committed',operation:'created',assetId:copyId,version:1,revision:1}},{syntheticOnly:false});
   }else{
    const block={type:ASSET_APPLICATION_MARKER,ownerAccountId:p.accountId,targetProjectId:p.researchProjectId,sourceProjectId:p.researchProjectId,sourceId:assetId,sourceVersion:Number(v),sourceHash:c.policy.contentHash,sourcePolicyHash:c.policy.policyHash,mappingHash:q.mappingHash,pico:null,confirmation:null,unconfirmed:q.mapping.unconfirmed};
    result=await artifacts(tx,p).create(p,{title:q.mapping.title,typeKey:'protocol_draft',idempotencyKey:key,creationRequestHash:requestHash,contentMd:q.mapping.contentMd,contentBlocks:[{...block,seal:assetDigest(block)}]});
   }
   const next={...c.record.registry,revision:c.record.registry.revision+1};if(await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET revision=$1,updated_at=now() WHERE asset_id=$2 AND revision=$3 AND tenant_id=$4 AND study_group_id=$5 AND research_project_id=$6',next.revision,assetId,c.record.registry.revision,p.tenantId,p.studyGroupId,p.researchProjectId)!==1)fail();
   const type='asset_'+input.kind,receipt={status:'committed',operation:type,assetId,version:Number(v),revision:next.revision};
   await appendCatalogEvent(tx,p,{registry:next,version:Number(v),type,requestKey:input.requestKey,requestHash,payload:{targetArtifactId:result.id},receipt},{syntheticOnly:false});
   await tx.$executeRawUnsafe('INSERT INTO rh_asset.asset_reuse_record(record_id,tenant_id,study_group_id,research_project_id,asset_id,version_no,source_hash,source_policy_hash,actor_account_id,kind,target_project_id,target_artifact_id,target_version_no,mapping_hash,request_key,request_hash,event_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,$13,$14,$15,$16)','rh-reuse-'+randomUUID(),p.tenantId,p.studyGroupId,p.researchProjectId,assetId,Number(v),c.policy.contentHash,c.policy.policyHash,p.accountId,input.kind,p.researchProjectId,result.id,q.mappingHash,input.requestKey,requestHash,next.revision);
   return receipt;
  });},
  result:(user,assetId,v,key)=>withAccess(user,'artifact.read',async(tx,p)=>{if(!id(key))fail('INPUT_INVALID',400);const[r]=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.asset_reuse_record WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND asset_id=$4 AND version_no=$5 AND actor_account_id=$6 AND request_key=$7',p.tenantId,p.studyGroupId,p.researchProjectId,assetId,Number(v),p.accountId,key);if(!r||r.target_project_id!==p.researchProjectId)fail('NOT_FOUND',404);await source(tx,p,assetId,v,r.kind);if(r.kind==='apply')await target(tx,p,r.target_artifact_id,1);else{const detail=await reader(tx,p).detail({},r.target_artifact_id,1);if(detail.bodyAccess!=='allowed')fail('FORBIDDEN',403);}return{schemaVersion:'rh-asset-reuse-result.v1',id:assetId,version:Number(v),kind:r.kind,targetArtifactId:r.target_artifact_id,targetProjectId:r.target_project_id,targetVersion:1,targetContext:'current-project'};}),
  readTarget:(user,artifactId,v)=>withAccess(user,'artifact.read',(tx,p)=>projectTarget(tx,p,artifactId,v)),
  targetGuidance:async(user,artifactId,query={})=>{if(Object.keys(query).some(k=>k!=='versionNo'))fail('INPUT_INVALID',400);const v=await service.readTarget(user,artifactId,query.versionNo);return{id:v.id,version:v.version,currentVersion:v.currentVersion,sourceStatus:v.sourceStatus,readOnly:true,canEdit:false,sources:[],paragraphs:[],citations:[],versions:v.versions};},
  listTargets:(user,query={})=>withAccess(user,'artifact.read',async(tx,p)=>{if(Object.keys(query).some(k=>k!=='limit')||query.limit!==undefined&&!/^(?:[1-9]|[12][0-9]|30)$/.test(query.limit))fail('INPUT_INVALID',400);const rows=await tx.researchArtifact.findMany({where:{...scope(p),ownerAccountId:p.accountId,typeKey:'protocol_draft',status:'draft',deletedAt:null,idempotencyKey:{startsWith:'rhab-reuse:'}},orderBy:{createdAt:'desc'},take:Number(query.limit??20)}),items=[];for(const a of rows){const v=await projectTarget(tx,p,a.id);items.push({id:v.id,version:v.version,stage:v.stage,sourceStatus:v.sourceStatus,displayTitle:v.title,createdAt:a.createdAt,nextAction:{key:'manual',label:'核对复用条件与本人方案草稿'}});}return{items,nextCursor:null};}),
  saveTarget(user,artifactId,input){if(!input||Object.keys(input).sort().join(',')!=='baseVersionNo,contentMd,requestKey'||!positive(input.baseVersionNo)||!id(input.requestKey)||input.requestKey.length<8||typeof input.contentMd!=='string'||!input.contentMd.trim()||input.contentMd.length>24000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.contentMd))fail('INPUT_INVALID',400);return withAccess(user,'artifact.edit',async(tx,p)=>{
   const t=await target(tx,p,artifactId),requestHash=assetDigest({id:artifactId,actor:p.accountId,...input}),old=t.versions.find(v=>v.contentBlocks?.some(b=>b.type===ASSET_APPLICATION_MARKER&&b.requestKey===input.requestKey));
   if(old){if(old.contentBlocks.find(b=>b.type===ASSET_APPLICATION_MARKER).requestHash!==requestHash)fail('REQUEST_KEY_CONFLICT');return projectTarget(tx,p,artifactId);}
   if((await projectTarget(tx,p,artifactId)).sourceStatus!=='current'||t.a.currentVersionNo!==input.baseVersionNo)fail();
   const block={...t.block,requestKey:input.requestKey,requestHash};delete block.seal;await artifacts(tx,p).createVersion(p,artifactId,{baseVersionNo:input.baseVersionNo,contentMd:input.contentMd,contentBlocks:[{...block,seal:assetDigest(block)}],changeSummary:'本人复用方案正文修订'});return projectTarget(tx,p,artifactId);
  });}
 };
 return service;
}
