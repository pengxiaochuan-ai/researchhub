import {randomUUID} from 'node:crypto';
import {catalogError,assertAssetAction} from '../../scripts/research-assets-catalog-contract.mjs';
import {validateAssetRegistration,registrationRequestHash,assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {writeAssetVersion,appendCatalogEvent,lockCatalogAsset,findCatalogOperation} from '../../scripts/local-research-assets-registration.mjs';
import {loadCatalogRecords} from '../../scripts/local-research-assets-catalog-read.mjs';
import {businessAssetKey,businessAssetFamily} from './business-family.mjs';

const scope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
const positive=n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647;
const fail=(code,status=409,message='资产内容或版本已变化，请重新核对。')=>{throw catalogError(code,status,message);};
const assertId=id=>businessAssetKey(id);
export const businessRegistrationRequestHash=(value,p,id=null)=>assetDigest({family:'business',registration:registrationRequestHash(value,p,id)});
function businessReceipt(receipt){if(receipt)assertId(receipt.assetId);return receipt;}

/** Normal business registration. Authorization and the transaction belong to
 * withAccess; there is no fixture ID, account label or one-per-kind admission.
 * Source adapters and local fixture budgets must be explicit dependencies. */
export function createBusinessAssetRegistration({withAccess,assertSources=async()=>false,listSources,listRecipients=async(_tx,p)=>[{accountId:p.accountId,displayName:p.displayName??'本人',isSelf:true}],resolveSource,beforeCommit=async()=>{},syntheticOnly=false}={}){
 if(typeof withAccess!=='function')throw new TypeError('Current business asset authorization required');
 const validate=(input,revision=false)=>validateAssetRegistration(input,{revision,family:'business',allowedRecipients:input?.policy?.discoveryRecipients??[]});
 async function recipients(tx,p,value){
  const actors=await listRecipients(tx,p),allowed=new Set(actors.map(a=>a.accountId));
  if(value.policy.discoveryRecipients.some(id=>!allowed.has(id)))fail('RIGHTS_REQUIRED',422,'可发现范围不在当前研究授权内。');
 }
 async function resolved(tx,p,value,context){
  const full=resolveSource?await resolveSource(tx,p,value,context):value;
  if(value.sourceKind==='author'){
   if(full.sourceKind!=='author'||full.sourceBindings.length)fail('SOURCE_INVALID');
  }else if(!await assertSources(tx,p,{sourceKind:full.sourceKind,sourceBindings:full.sourceBindings,metadata:full.metadata,rightsEvidence:full.policy.rightsEvidence,discoveryRecipientCeiling:full.policy.discoveryRecipients}))fail('SOURCE_INVALID',409,'来源或允许用途当前不可用；输入已保留，未提交草稿。');
  if(typeof full.contentMd!=='string'||!full.contentMd.trim())fail('SOURCE_INVALID',409,'来源正文尚未完成核对，未提交草稿。');
  return full;
 }
 async function readRecord(tx,p,id){
  const [record]=await loadCatalogRecords(tx,p,assertSources,{family:'business',assetId:id});
  if(!record)fail('NOT_FOUND',404,'未找到有权操作的资产。');return record;
 }
 async function lock(tx,p,id){
  const r=await lockCatalogAsset(tx,p,id);
  const parent=await tx.researchArtifact.findFirst({where:{...scope(p),id}});
  if(!businessAssetFamily(parent,r))fail('CONTEXT_INVALID');
  if(r.ownerAccountId!==p.accountId&&!p.isTenantAdmin)fail('NOT_FOUND',404,'未找到有权操作的资产。');
  return r;
 }
 return{
  options:user=>withAccess(user,'artifact.read',async(tx,p)=>{
   const ownAssets=await tx.$queryRawUnsafe("SELECT asset_id AS id,asset_kind AS kind,working_version_no AS version FROM rh_asset.asset_registry WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND owner_account_id=$4 AND asset_id LIKE 'rhab-%' ORDER BY asset_id",p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId);
   const canCreate=p.isTenantAdmin||p.permissions?.includes('artifact.create');
   return{schemaVersion:'rh-asset-registration-options.v2',family:'business',scope:scope(p),identityRevision:p.identityRevision,actors:await listRecipients(tx,p),ownAssets,admission:{canCreate:Boolean(canCreate),reason:canCreate?null:'当前账号没有登记权限，请联系研究管理员。'},sourcesStatus:listSources?'ready':'unavailable',sources:listSources?await listSources(tx,p):[],uploadsStatus:'unavailable',pendingUploads:[]};
  }),
  async register(user,input){
   const value=validate(input);
   return withAccess(user,'artifact.create',async(tx,p)=>{
    const requestHash=businessRegistrationRequestHash(value,p),old=businessReceipt(await findCatalogOperation(tx,p,value.requestKey,requestHash));
    if(old)return old;
    await recipients(tx,p,value);
    const full=await resolved(tx,p,value,{version:1,requestHash});
    await beforeCommit(tx,p,{action:'create',value:full});
    const id='rhab-'+randomUUID(),idempotencyKey=businessAssetKey(id);
    await tx.researchArtifact.create({data:{id,...scope(p),typeKey:'research_report',title:full.metadata.title,status:'draft',ownerAccountId:p.accountId,createdBy:p.accountId,idempotencyKey,creationRequestHash:requestHash}});
    const r={assetId:id,...scope(p),ownerAccountId:p.accountId,kind:full.kind,revision:1,workingVersionNo:1};
    await tx.$executeRawUnsafe('INSERT INTO rh_asset.asset_registry(asset_id,tenant_id,study_group_id,research_project_id,owner_account_id,asset_kind) VALUES($1,$2,$3,$4,$5,$6)',id,p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId,full.kind);
    await writeAssetVersion(tx,p,r,full,{family:'business'});
    const receipt={assetId:id,version:1,revision:1,operation:'created',status:'committed'};
    await appendCatalogEvent(tx,p,{registry:r,version:1,type:'created',requestKey:value.requestKey,requestHash,receipt},{syntheticOnly});return receipt;
   });
  },
  async revise(user,id,input){
   assertId(id);const value=validate(input,true);
   return withAccess(user,'artifact.edit',async(tx,p)=>{
    const r=await lock(tx,p,id),requestHash=businessRegistrationRequestHash(value,p,id),old=businessReceipt(await findCatalogOperation(tx,p,value.requestKey,requestHash));
    if(old)return old;
    if(value.kind!==r.kind)fail('INPUT_INVALID',400,'修订不能改变资产类型。');
    await recipients(tx,p,value);
    const full=await resolved(tx,p,value,{assetId:id,version:value.baseVersion+1,requestHash});
    const record=await readRecord(tx,p,id);
    const next=assertAssetAction({registry:r,sourceValid:true,family:record.family},{action:'revise',version:r.workingVersionNo,baseVersion:value.baseVersion,expectedRevision:value.expectedRevision,requestKey:value.requestKey},p);
    await beforeCommit(tx,p,{action:'revise',id,registry:r,value:full,next});
    const updated=await tx.researchArtifact.updateMany({where:{...scope(p),id,status:'draft',deletedAt:null,ownerAccountId:r.ownerAccountId,currentVersionNo:r.workingVersionNo},data:{title:full.metadata.title,currentVersionNo:next.workingVersionNo}});
    if(updated.count!==1)fail('VERSION_CONFLICT');
    const changed=await tx.$executeRawUnsafe("UPDATE rh_asset.asset_registry SET working_version_no=$1,working_state='draft',submitted_version_no=NULL,approved_version_no=NULL,revision=$2,updated_at=now() WHERE asset_id=$3 AND revision=$4 AND tenant_id=$5 AND study_group_id=$6 AND research_project_id=$7",next.workingVersionNo,next.revision,id,r.revision,p.tenantId,p.studyGroupId,p.researchProjectId);
    if(changed!==1)fail('VERSION_CONFLICT');
    await writeAssetVersion(tx,p,next,full,{family:'business'});
    const receipt={assetId:id,version:next.workingVersionNo,revision:next.revision,operation:'revised',status:'committed'};
    await appendCatalogEvent(tx,p,{registry:next,version:next.workingVersionNo,type:'revised',requestKey:value.requestKey,requestHash,receipt},{syntheticOnly});return receipt;
   });
  },
  async edit(user,id,number){
   assertId(id);const version=Number(number);if(!positive(version)||String(version)!==String(number))fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.edit',async(tx,p)=>{
    const r=await lock(tx,p,id);if(r.deletedAt)fail('NOT_FOUND',404);
    if(r.workingVersionNo!==version)fail('VERSION_CONFLICT',409,'当前选择是历史版本，请从最新工作版本修订。');
    const record=await readRecord(tx,p,id),policy=record.policies.find(v=>v.version===version);
    if(!policy?.sourceValid)fail('SOURCE_INVALID');
    const v=await tx.researchArtifactVersion.findFirst({where:{...scope(p),id:policy.artifactVersionId,artifactId:id,versionNo:version},select:{contentMd:true}});
    if(!v||assetDigest(v.contentMd)!==policy.contentHash)fail('CONTEXT_INVALID');
    return{schemaVersion:'rh-asset-registration-draft.v2',family:'business',...scope(p),assetId:id,kind:r.kind,version,expectedRevision:r.revision,metadata:policy.metadata,sourceKind:policy.sourceKind,sourceBindings:policy.sourceBindings,policy:{rightsEvidence:policy.rightsEvidence,discoveryRecipients:policy.discoveryRecipientCeiling},contentMd:v.contentMd,fileRevisionRequiresNewUpload:policy.sourceKind==='upload',identityRevision:p.identityRevision};
   });
  },
  operation(user,key){
   if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(key))fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const receipt=await findCatalogOperation(tx,p,key);
    return receipt?.assetId?.startsWith('rhab-')?businessReceipt(receipt):{status:'not_found'};
   });
  }
 };
}
