import {CATALOG_ASSET_PREFIX,assertCatalogFixtureInventory,assertAssetAction,catalogError,catalogVisibleVersion} from './research-assets-catalog-contract.mjs';
import {validateAssetRegistration,sealAssetRegistration,registrationRequestHash,assetDigest} from './research-assets-registration-contract.mjs';
import {loadCatalogRecords} from './local-research-assets-catalog-read.mjs';
import {assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
import {catalogAssetFamily} from './research-assets-detail-contract.mjs';
import {isBusinessAssetId} from './research-assets-business-identity.mjs';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=(code,status=409,message='资产状态已变化，请核对后重试。')=>{throw catalogError(code,status,message);};
const scope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
export const registryProjection=r=>({assetId:r.asset_id,...{tenantId:r.tenant_id,studyGroupId:r.study_group_id,researchProjectId:r.research_project_id},ownerAccountId:r.owner_account_id,kind:r.asset_kind,revision:r.revision,workingVersionNo:r.working_version_no,workingState:r.working_state,submittedVersionNo:r.submitted_version_no,approvedVersionNo:r.approved_version_no,releasedVersionNo:r.released_version_no,releaseState:r.release_state,everSubmitted:r.ever_submitted,deletedAt:r.deleted_at});
export async function lockCatalogAsset(tx,p,id){
 if(!valid(id))fail('INPUT_INVALID',400,'资产标识无效。');
 const [r]=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.asset_registry WHERE asset_id=$1 AND tenant_id=$2 AND study_group_id=$3 AND research_project_id=$4 FOR UPDATE',id,p.tenantId,p.studyGroupId,p.researchProjectId);
 if(!r)fail('NOT_FOUND',404,'未找到可操作的资产。');return registryProjection(r);
}
export async function findCatalogOperation(tx,p,key,expectedHash){
 const [e]=await tx.$queryRawUnsafe('SELECT request_hash,result_receipt FROM rh_asset.asset_event WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND actor_account_id=$4 AND request_key=$5',p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId,key);
 if(!e)return null;if(expectedHash&&e.request_hash!==expectedHash)fail('REQUEST_KEY_CONFLICT',409,'该次提交已用于不同内容，请先核对原结果。');return e.result_receipt;
}
export function projectAssetOperationReceipt(receipt,record,p,now=Date.now()){
 if(!receipt?.citation)return receipt;
 const policy=record?.policies.find(x=>x.version===receipt.version),visible=record?.registry.assetId===receipt.assetId&&policy&&catalogVisibleVersion({...record,principal:p,version:receipt.version,sourceValid:policy.sourceValid===true,now});
 if(visible?.citeAllowed)return receipt;
 // Knowing one's own submission outcome does not retain access to the asset.
 return{status:receipt.status,assetId:receipt.assetId,version:receipt.version,revision:receipt.revision,operation:receipt.operation,contentAccess:'restricted'};
}
export async function appendCatalogEvent(tx,p,{registry:r,version,type,requestKey,requestHash,payload={},receipt}, {syntheticOnly=!isBusinessAssetId(r.assetId)}={}){
 await tx.$executeRawUnsafe('INSERT INTO rh_asset.asset_event(tenant_id,study_group_id,research_project_id,asset_id,version_no,asset_revision,actor_account_id,event_type,request_key,request_hash,payload,result_receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)',p.tenantId,p.studyGroupId,p.researchProjectId,r.assetId,version,r.revision,p.accountId,type,requestKey,requestHash,JSON.stringify(payload),JSON.stringify(receipt));
 await tx.auditLog.create({data:{...scope(p),accountId:p.accountId,action:'hub_asset_'+type,target:r.assetId,meta:{version,revision:r.revision,requestKey,requestHash,...payload,syntheticOnly}}});
}
async function inventory(tx,p,ids){
 const rows=await tx.$queryRawUnsafe('SELECT a.id,a."tenantId",a."studyGroupId",a."researchProjectId",a."ownerAccountId",a."createdBy",a.status,a."deletedAt",a."currentVersionNo",a."idempotencyKey",(SELECT count(*)::int FROM rh_asset.asset_event e WHERE e.asset_id=a.id) AS "eventCount" FROM public.research_artifact a WHERE a."tenantId"=$1 AND a."idempotencyKey" LIKE $2 ORDER BY a.id LIMIT 11',p.tenantId,CATALOG_ASSET_PREFIX+'%');
 assertCatalogFixtureInventory(rows,ids);return rows;
}
export async function writeAssetVersion(tx,p,r,value,{family='catalog'}={}){
 const sealed=sealAssetRegistration(value,p,r.workingVersionNo,r.ownerAccountId,{family});
 const v=await tx.researchArtifactVersion.create({data:{...scope(p),artifactId:r.assetId,versionNo:r.workingVersionNo,contentMd:value.contentMd,contentBlocks:[sealed.block],contentHash:sealed.contentHash,sourceSnapshotHash:assetDigest(value.sourceBindings),changeSummary:r.workingVersionNo===1?'登记初稿':'说明与来源修订',createdBy:p.accountId}});
 await tx.$executeRawUnsafe('INSERT INTO rh_asset.version_policy(tenant_id,study_group_id,research_project_id,asset_id,version_no,artifact_version_id,metadata,source_kind,source_bindings,rights_evidence,discovery_recipient_ceiling,content_hash,policy_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11::text[],$12,$13,$14)',p.tenantId,p.studyGroupId,p.researchProjectId,r.assetId,r.workingVersionNo,v.id,JSON.stringify(value.metadata),value.sourceKind,JSON.stringify(value.sourceBindings),value.policy.rightsEvidence,value.policy.discoveryRecipients,sealed.contentHash,sealed.policyHash,p.accountId);
 // Legacy Source has a closed scientific-source union: never invent upload/artifact types.
 for(const source of value.sourceBindings.filter(s=>s.kind==='knowledge'))await tx.researchArtifactSource.create({data:{...scope(p),artifactVersionId:v.id,sourceType:'knowledge_doc',sourceId:source.id,sourceVersion:String(source.version),snapshot:source,hash:assetDigest(source)}});
 if(value.file)await tx.researchArtifactFile.create({data:{...scope(p),artifactId:r.assetId,artifactVersionId:v.id,role:'source_attachment',storageKey:value.file.storageKey,filename:value.file.filename,mimeType:value.file.mimeType,sizeBytes:BigInt(value.file.sizeBytes),sha256:value.file.sha256}});
 return v;
}

export function createAssetRegistration({ids,withAccess,assertSources=async()=>false,listSources,uploads,registrationKey}){
 if(typeof withAccess!=='function')throw new TypeError('Current asset authorization required');
 async function resolved(tx,p,value,context){
  if(value.sourceKind==='upload'){if(!uploads)fail('UPLOAD_UNAVAILABLE',503,'文件登记暂不可用，请保留当前输入。');return uploads.resolve(tx,p,value,context);}
  if(value.sourceKind!=='author'&&!await assertSources(tx,p,{sourceKind:value.sourceKind,sourceBindings:value.sourceBindings,metadata:value.metadata,rightsEvidence:value.policy.rightsEvidence,discoveryRecipientCeiling:value.policy.discoveryRecipients}))fail('SOURCE_INVALID',409,'来源或允许用途当前不可用；草稿未提交。');
  return value;
 }
 return{
  options:user=>withAccess(user,'artifact.read',async(tx,p)=>{
   const rows=await inventory(tx,p,ids),actors=await tx.account.findMany({where:{tenantId:p.tenantId,id:{in:[ids.owner,ids.admin]},status:'active'},select:{id:true,displayName:true}});
   return{schemaVersion:'rh-asset-registration-options.v1',scope:scope(p),identityRevision:p.identityRevision,actors:actors.map(a=>({accountId:a.id,displayName:a.displayName,isSelf:a.id===p.accountId})),ownAssets:rows.filter(r=>r.ownerAccountId===p.accountId).map(a=>({id:a.id,kind:a.idempotencyKey.split(':').at(-1),version:a.currentVersionNo})),sourcesStatus:listSources?'ready':'unavailable',sources:listSources?await listSources(tx,p):[],uploadsStatus:uploads?'ready':'unavailable',pendingUploads:uploads?.list(p)??[]};
  }),
  async edit(user,id,number){
   if(!valid(id)||!/^[1-9][0-9]*$/.test(String(number))||!Number.isSafeInteger(Number(number)))fail('INPUT_INVALID',400,'编辑入口或版本无效。');
   return withAccess(user,'artifact.edit',async(tx,p)=>{
    const r=await lockCatalogAsset(tx,p,id);if(r.deletedAt||r.ownerAccountId!==p.accountId&&!p.isTenantAdmin)fail('NOT_FOUND',404,'未找到可操作的资产。');
    if(r.workingVersionNo!==Number(number))fail('VERSION_CONFLICT',409,'当前选择是历史版本，请从最新工作版本修订。');
    const records=await loadCatalogRecords(tx,p,(t,actor,policy)=>policy.sourceKind==='upload'&&uploads?uploads.assertSources(t,actor,policy):assertSources(t,actor,policy)),record=records.find(x=>x.registry.assetId===id),policy=record?.policies.find(x=>x.version===r.workingVersionNo);
    if(!policy||policy.sourceValid!==true)fail('SOURCE_INVALID',409,'来源当前不可用，不能读取原文作为修订输入。');
    const v=await tx.researchArtifactVersion.findFirst({where:{...scope(p),id:policy.artifactVersionId,artifactId:id,versionNo:r.workingVersionNo},select:{contentMd:true}});
    if(!v||assetDigest(v.contentMd)!==policy.contentHash)fail('CONTEXT_INVALID');
    return{schemaVersion:'rh-asset-registration-draft.v1',...scope(p),assetId:id,kind:r.kind,version:r.workingVersionNo,expectedRevision:r.revision,metadata:policy.metadata,sourceKind:policy.sourceKind,sourceBindings:policy.sourceBindings,policy:{rightsEvidence:policy.rightsEvidence,discoveryRecipients:policy.discoveryRecipientCeiling},contentMd:v.contentMd,fileRevisionRequiresNewUpload:policy.sourceKind==='upload',identityRevision:p.identityRevision};
   });
  },
  async register(user,input){
   const value=validateAssetRegistration(input,{ids});
   if(!registrationKey&&Object.hasOwn(value.metadata,'tags'))fail('INPUT_INVALID',400,'请从获准的资产详情修订标签。');
   let committedUpload;
   const receipt=await withAccess(user,'artifact.create',async(tx,p)=>{
    const hash=registrationRequestHash(value,p),full=await resolved(tx,p,value,{version:1,requestHash:hash}),old=await findCatalogOperation(tx,p,value.requestKey,hash);if(full.uploadBinding)committedUpload=full;if(old)return old;
    const rows=await inventory(tx,p,ids);if(!registrationKey&&rows.some(a=>a.ownerAccountId===p.accountId&&a.idempotencyKey===CATALOG_ASSET_PREFIX+(p.accountId===ids.owner?'owner':'admin')+':'+value.kind))fail('FIXTURE_CAPACITY',409,'该类型已有登记资产，请先核对并修订，勿重复新建。');
    const idempotencyKey=registrationKey?registrationKey(p,value):CATALOG_ASSET_PREFIX+(p.accountId===ids.owner?'owner':'admin')+':'+value.kind;
    if(registrationKey){const family=catalogAssetFamily(idempotencyKey,{ownerAccountId:p.accountId,kind:value.kind},p);if(family?.family!=='detail')fail('INPUT_INVALID',400);if(await tx.researchArtifact.findUnique({where:{tenantId_idempotencyKey:{tenantId:p.tenantId,idempotencyKey}},select:{id:true}}))fail('FIXTURE_CAPACITY');}
    if(full.uploadBinding)await uploads.prepare(tx,p,full);
    const a=await tx.researchArtifact.create({data:{...(full.reservedAssetId?{id:full.reservedAssetId}:{}),...scope(p),typeKey:'research_report',title:full.metadata.title,status:'draft',ownerAccountId:p.accountId,createdBy:p.accountId,idempotencyKey,creationRequestHash:hash}});
    const r={assetId:a.id,...scope(p),ownerAccountId:p.accountId,kind:full.kind,revision:1,workingVersionNo:1};
    await tx.$executeRawUnsafe('INSERT INTO rh_asset.asset_registry(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind) VALUES($1,$2,$3,$4,$5,$6)',a.id,p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId,full.kind);
    await writeAssetVersion(tx,p,r,full);
    const receipt={assetId:a.id,version:1,revision:1,operation:'created',status:'committed',...(full.uploadBinding?{uploadId:full.uploadBinding.uploadId}:{})};
    await appendCatalogEvent(tx,p,{registry:r,version:1,type:'created',requestKey:value.requestKey,requestHash:hash,receipt});return receipt;
   });
   if(committedUpload){await uploads.confirm(user,committedUpload,receipt);return{...receipt,attachmentStatus:'bound'};}return receipt;
  },
  async revise(user,id,input){
   const value=validateAssetRegistration(input,{ids,revision:true});if(!valid(id))fail('INPUT_INVALID',400);
   let committedUpload;
   const receipt=await withAccess(user,'artifact.edit',async(tx,p)=>{
    const r=await lockCatalogAsset(tx,p,id);if(r.ownerAccountId!==p.accountId&&!p.isTenantAdmin)fail('NOT_FOUND',404,'未找到可操作的资产。');
    const hash=registrationRequestHash(value,p,id),full=await resolved(tx,p,value,{assetId:id,version:value.baseVersion+1,requestHash:hash}),old=await findCatalogOperation(tx,p,value.requestKey,hash);if(full.uploadBinding)committedUpload=full;if(old)return old;
    await inventory(tx,p,ids);if(value.kind!==r.kind)fail('INPUT_INVALID',400,'修订不能改变资产类型。');
    const current=(await loadCatalogRecords(tx,p,(t,actor,policy)=>policy.sourceKind==='upload'&&uploads?uploads.assertSources(t,actor,policy):assertSources(t,actor,policy))).find(x=>x.registry.assetId===id);
    if(current?.family.family==='catalog'&&Object.hasOwn(value.metadata,'tags'))fail('INPUT_INVALID',400,'此资产不允许修订标签。');
    if(current&&r.workingVersionNo>=current.family.maxVersions)fail('FIXTURE_CAPACITY',409,'当前资产已达到版本上限。');
    if(!current||!assetEventBudgetAllows(current,'revise'))fail('FIXTURE_CAPACITY',409,'当前操作额度需保留用于停止已发布版本的使用。');
    const next=assertAssetAction({registry:r,sourceValid:true,policy:{rightsEvidence:full.policy.rightsEvidence}},{action:'revise',version:r.workingVersionNo,baseVersion:value.baseVersion,expectedRevision:value.expectedRevision,requestKey:value.requestKey},p);
    if(full.uploadBinding)await uploads.prepare(tx,p,full);
    const updated=await tx.researchArtifact.updateMany({where:{...scope(p),id,status:'draft',deletedAt:null,ownerAccountId:r.ownerAccountId,currentVersionNo:r.workingVersionNo},data:{title:full.metadata.title,currentVersionNo:next.workingVersionNo}});
    if(updated.count!==1)fail('VERSION_CONFLICT');
    const changed=await tx.$executeRawUnsafe("UPDATE rh_asset.asset_registry SET working_version_no=$1,working_state='draft',submitted_version_no=NULL,approved_version_no=NULL,revision=$2,updated_at=now() WHERE asset_id=$3 AND revision=$4",next.workingVersionNo,next.revision,id,r.revision);
    if(changed!==1)fail('VERSION_CONFLICT');await writeAssetVersion(tx,p,next,full);
    const receipt={assetId:id,version:next.workingVersionNo,revision:next.revision,operation:'revised',status:'committed',...(full.uploadBinding?{uploadId:full.uploadBinding.uploadId}:{})};
    await appendCatalogEvent(tx,p,{registry:next,version:next.workingVersionNo,type:'revised',requestKey:value.requestKey,requestHash:hash,receipt});return receipt;
   });
   if(committedUpload){await uploads.confirm(user,committedUpload,receipt);return{...receipt,attachmentStatus:'bound'};}return receipt;
  },
  operation(user,key){
   if(!valid(key)||key.length<8)fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    let receipt=await findCatalogOperation(tx,p,key);if(uploads)receipt=await uploads.reconcile(tx,p,key,receipt);
    if(receipt?.citation){const records=await loadCatalogRecords(tx,p,(t,actor,policy)=>policy.sourceKind==='upload'&&uploads?uploads.assertSources(t,actor,policy):assertSources(t,actor,policy));receipt=projectAssetOperationReceipt(receipt,records.find(x=>x.registry.assetId===receipt.assetId),p);}
    return receipt??{status:'not_found'};
   });
  }
 };
}
