import {createAssetCatalogReader,loadCatalogRecords} from './local-research-assets-catalog-read.mjs';
import {catalogError,assertAssetAction} from './research-assets-catalog-contract.mjs';
import {compareFixedAssetVersions,validateAssetTags} from './research-assets-detail-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {lockCatalogAsset,findCatalogOperation,writeAssetVersion,appendCatalogEvent} from './local-research-assets-registration.mjs';
import {assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
import {assetVersionInRange} from './research-assets-business-identity.mjs';
const fail=(code,status=409,message='固定版本状态已变化，请核对后重试。')=>{throw catalogError(code,status,message);};
const positive=n=>Number.isSafeInteger(n)&&n>0;
const version=(x,id)=>/^[1-9][0-9]*$/.test(String(x))&&assetVersionInRange(id,Number(x));
const fields=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('INPUT_INVALID',400);};
export function createAssetDetailReader({withAccess,assertSources=async()=>false,readFixed}){
 const read=readFixed??((tx,p,id,v)=>createAssetCatalogReader({withAccess:(_u,_permission,fn)=>fn(tx,p),assertSources}).detail({},id,v));
 return{
  async compare(user,id,v,query){
   fields(query,['withVersion']);if(!version(v,id)||!version(query.withVersion,id))fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const before=await read(tx,p,id,Number(query.withVersion)),after=await read(tx,p,id,Number(v));
    if([before,after].some(x=>x.bodyAccess!=='allowed'||x.bodyExpiresAt!=null&&(!Number.isFinite(Date.parse(x.bodyExpiresAt))||Date.parse(x.bodyExpiresAt)<=Date.now())))fail('FORBIDDEN',403,'请先取得两个固定版本的正文许可。');
    return{schemaVersion:'rh-asset-comparison.v1',id,identityRevision:p.identityRevision,before:{version:before.version},after:{version:after.version},...compareFixedAssetVersions(before,after)};
   });
  },
  async activity(user,id,v,query={}){
   fields(query,['cursor']);if(!version(v,id))fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const detail=await read(tx,p,id,Number(v));if(detail.bodyAccess!=='allowed')fail('FORBIDDEN',403,'当前仅获准查看摘要。');
    const withReviewReasons=['report_context','business'].includes(detail.family);
    const rows=await tx.$queryRawUnsafe('SELECT e.asset_revision,e.event_type,e.version_no,e.created_at,e.payload->>\'reason\' AS reason,e.payload->>\'conclusion\' AS conclusion,a."displayName" AS actor_name FROM rh_asset.asset_event e JOIN public.account a ON a.id=e.actor_account_id AND a."tenantId"=e.tenant_id WHERE e.tenant_id=$1 AND e.study_group_id=$2 AND e.research_project_id=$3 AND e.asset_id=$4 AND e.version_no=$5 ORDER BY e.asset_revision DESC'+(detail.family==='business'?'':' LIMIT 25'),p.tenantId,p.studyGroupId,p.researchProjectId,id,Number(v));
    if(detail.family!=='business'&&rows.length>24||withReviewReasons&&rows.some(e=>e.event_type==='reviewed'&&(typeof e.reason!=='string'||!e.reason.trim()||e.reason.length>2000||!['approved','changes_requested'].includes(e.conclusion))))fail('CONTEXT_INVALID');const binding=assetDigest({id,v:Number(v),identity:p.identityRevision,revisions:rows.map(x=>x.asset_revision)});let offset=0;
    if(query.cursor!==undefined){let c;try{if(typeof query.cursor!=='string'||query.cursor.length>512||!/^[A-Za-z0-9_-]+$/.test(query.cursor))throw Error();c=JSON.parse(Buffer.from(query.cursor,'base64url'));}catch{fail('INPUT_INVALID',400);}if(c?.binding!==binding||!Number.isSafeInteger(c.offset)||c.offset<0||c.offset%20||c.offset>rows.length)fail('CURSOR_STALE');offset=c.offset;}
    const items=rows.slice(offset,offset+20).map(e=>({revision:e.asset_revision,type:e.event_type,version:e.version_no,at:new Date(e.created_at).toISOString(),actor:e.actor_name??'未提供',...(withReviewReasons&&e.event_type==='reviewed'?{reason:e.reason,conclusion:e.conclusion}:{})})),next=offset+items.length;
    if(detail.bodyExpiresAt!=null&&Date.parse(detail.bodyExpiresAt)<=Date.now())fail('FORBIDDEN',403,'本版正文使用许可已到期。');
    return{schemaVersion:'rh-asset-activity.v1',id,version:Number(v),identityRevision:p.identityRevision,total:rows.length,items,nextCursor:next<rows.length?Buffer.from(JSON.stringify({binding,offset:next})).toString('base64url'):null};
   });
  },
  async tags(user,id,input){
   fields(input,['baseVersion','expectedRevision','tags','requestKey']);if(!version(input.baseVersion)||!positive(input.expectedRevision)||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(input.requestKey))fail('INPUT_INVALID',400);const tags=validateAssetTags(input.tags);
   return withAccess(user,'artifact.edit',async(tx,p)=>{
    const r=await lockCatalogAsset(tx,p,id),records=await loadCatalogRecords(tx,p,assertSources),record=records.find(x=>x.registry.assetId===id);
    if(!record||record.family?.family!=='detail'||r.ownerAccountId!==p.accountId&&!p.isTenantAdmin)fail('FORBIDDEN',403,'此资产不允许修订标签。');
    const requestHash=assetDigest({kind:'a02-tags.v1',id,actor:p.accountId,...input,tags}),old=await findCatalogOperation(tx,p,input.requestKey,requestHash);if(old)return old;
    const policy=record.policies.find(x=>x.version===r.workingVersionNo);if(!policy?.sourceValid)fail('SOURCE_INVALID');
    if(r.workingVersionNo>=record.family.maxVersions||!assetEventBudgetAllows(record,'revise'))fail('FIXTURE_CAPACITY',409,'当前资产已达到可用修订上限。');
    const next=assertAssetAction({registry:r,sourceValid:true,policy},{action:'revise',version:r.workingVersionNo,baseVersion:Number(input.baseVersion),expectedRevision:input.expectedRevision,requestKey:input.requestKey},p);
    const detail=await read(tx,p,id,r.workingVersionNo);if(detail.bodyAccess!=='allowed')fail('FORBIDDEN',403);
    const changed=await tx.researchArtifact.updateMany({where:{id,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,status:'draft',deletedAt:null,currentVersionNo:r.workingVersionNo},data:{currentVersionNo:next.workingVersionNo}});if(changed.count!==1)fail('VERSION_CONFLICT');
    const count=await tx.$executeRawUnsafe("UPDATE rh_asset.asset_registry SET working_version_no=$1,working_state='draft',submitted_version_no=NULL,approved_version_no=NULL,revision=$2,updated_at=now() WHERE asset_id=$3 AND revision=$4",next.workingVersionNo,next.revision,id,r.revision);if(count!==1)fail('VERSION_CONFLICT');
    await writeAssetVersion(tx,p,next,{kind:r.kind,metadata:{...policy.metadata,tags},contentMd:detail.contentMd,sourceKind:policy.sourceKind,sourceBindings:policy.sourceBindings,policy:{rightsEvidence:policy.rightsEvidence,discoveryRecipients:policy.discoveryRecipientCeiling}});
    const receipt={status:'committed',assetId:id,version:next.workingVersionNo,revision:next.revision,operation:'revised'};await appendCatalogEvent(tx,p,{registry:next,version:next.workingVersionNo,type:'revised',requestKey:input.requestKey,requestHash,payload:{changedFields:['tags']},receipt});return receipt;
   });
  }
 };
}
