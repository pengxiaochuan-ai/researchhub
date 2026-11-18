import {createHash} from 'node:crypto';
import {assertAssetCatalogInput,catalogVisibleVersion,effectiveAssetRelease,CATALOG_KINDS,CATALOG_ASSET_PREFIX,catalogError,assetUsageActions,assetTrashBlock} from './research-assets-catalog-contract.mjs';
import {assertRegistrationPolicy} from './research-assets-registration-contract.mjs';
import {governanceActions,assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
import {catalogAssetFamily} from './research-assets-detail-contract.mjs';
import {REPORT_CONTEXT} from './research-assets-report-context.mjs';
import {businessAssetFamily} from '../server/research-assets/business-family.mjs';
const normalize=s=>String(s??'').normalize('NFKC').toLowerCase();
const comparable=new Intl.Collator('zh-Hans-CN',{numeric:true,sensitivity:'base'});
const date=x=>x instanceof Date?x.toISOString():x;
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const invalid=()=>{throw catalogError('CONTEXT_INVALID',409,'资产固定版本无法核对，请重新打开。');};
export function fixedReleaseState(record,version,now){
 const events=record.events.filter(e=>e.version===version&&['released','withdrawn','expired'].includes(e.type)).sort((a,b)=>a.revision-b.revision),last=events.at(-1);
 return last?last.type==='withdrawn'?'withdrawn':last.type==='expired'?'expired':effectiveAssetRelease(record.events,version,now).active?'released':'expired':null;
}
export function catalogRowMatches(r,q){
 return(!q.q||normalize(r.title+' '+r.summary).includes(normalize(q.q)))&&(q.kind==='all'||r.kind===q.kind)&&(q.domain==='all'||r.domains.includes(q.domain))&&(q.status==='all'||r.state===q.status)&&(q.scope==='all'||r.scope===q.scope)&&(q.source==='all'||r.sourceKind===q.source);
}

export function visibleCatalogAsset(record,principal,now,version,records=[]){
 const checked={...record,principal,now,version};
 if(record.sourceValid===false)return null;
 const value=catalogVisibleVersion(checked);
 if(!value)return null;
 const p=record.policies.find(p=>p.version===value.version);
 if(p.sourceValid===false)return null;
 const r=record.registry,own=r.ownerAccountId===principal.accountId||principal.isTenantAdmin;
 const isWorking=own&&value.version===r.workingVersionNo;
 return{record,policy:p,view:value,row:{id:r.assetId,kind:r.kind,title:p.metadata.title,summary:p.metadata.summary??'',domains:p.metadata.domains??[],sourceKind:p.sourceKind,
  sourceStudy:{id:r.researchProjectId,name:principal.projectName??'当前研究'},version:value.version,currentVersion:own?r.workingVersionNo:value.version,
  state:fixedReleaseState(record,value.version,now)??(isWorking?r.workingState:'draft'),scope:!effectiveAssetRelease(record.events,value.version,now).active?'private':r.ownerAccountId===principal.accountId?'sent':'received',
  owner:{accountId:r.ownerAccountId,displayName:r.ownerName??'责任人待核对'},createdAt:date(r.createdAt),updatedAt:date(isWorking?r.updatedAt:p.createdAt),
  bodyAllowed:value.bodyAllowed,citeAllowed:value.citeAllowed,canActions:['read','versions',...(isWorking&&(principal.isTenantAdmin||principal.permissions?.includes('artifact.edit'))&&r.workingVersionNo<(record.family?.maxVersions??8)&&assetEventBudgetAllows(record,'revise',now)?['edit']:[]),...(isWorking&&(principal.isTenantAdmin||principal.permissions?.includes('artifact.edit'))&&assetEventBudgetAllows(record,'trash',now)&&!assetTrashBlock(record,records)?['trash']:[]),...governanceActions(record,principal,value.version,now),...assetUsageActions(record,principal,value.version,now)].filter(a=>(record.family?.family!=='report_context'||['read','versions','submit','review'].includes(a))&&(!record.availableActions||record.availableActions.includes(a)))}};
}
const visible=visibleCatalogAsset;
export function presentAssetCatalog({records,principal,query,now=Date.now(),allItems=false}){
 const q=assertAssetCatalogInput(query),all=records.map(record=>visible(record,principal,now,undefined,records)).filter(Boolean).map(x=>x.row);
 const stats={all:all.length,...Object.fromEntries(CATALOG_KINDS.map(k=>[k,all.filter(r=>r.kind===k).length]))};
 const filterOptions={domains:[...new Set(all.flatMap(r=>r.domains))].sort(comparable.compare)};
 const filtered=all.filter(r=>catalogRowMatches(r,q));
 const direction=q.direction==='asc'?1:-1;
 filtered.sort((a,b)=>direction*(q.sort==='updatedAt'?String(a.updatedAt??'').localeCompare(String(b.updatedAt??'')):comparable.compare(a[q.sort],b[q.sort]))||b.id.localeCompare(a.id));
 return{schemaVersion:records.some(r=>r.family?.family==='business')?'rh-research-asset-catalog.v2':'rh-research-asset-catalog.v1',scope:{studyGroupId:principal.studyGroupId,researchProjectId:principal.researchProjectId},identityRevision:principal.identityRevision,stats,filterOptions,total:filtered.length,page:q.page,pageSize:q.pageSize,items:allItems?filtered:filtered.slice((q.page-1)*q.pageSize,q.page*q.pageSize)};
}

/** Fixed policies/blocks only: catalog queries never read or return body text. */
export async function loadCatalogRecords(tx,principal,assertSources,{family='legacy',assetId,skipInvisibleSourceReads=false}={}){
 const business=family==='business';
 if(assetId!==undefined&&!validId(assetId))throw catalogError('INPUT_INVALID',400,'资产标识无效。');
 const rows=await tx.$queryRawUnsafe(`SELECT
 jsonb_build_object('id',c.id,'tenantId',c."tenantId",'studyGroupId',c."studyGroupId",'researchProjectId',c."researchProjectId",'ownerAccountId',c."ownerAccountId",'createdBy',c."createdBy",'typeKey',c."typeKey",'status',c.status,'deletedAt',c."deletedAt",'currentVersionNo',c."currentVersionNo",'idempotencyKey',c."idempotencyKey") AS parent,
 jsonb_build_object('assetId',r.asset_id,'tenantId',r.tenant_id,'studyGroupId',r.study_group_id,'researchProjectId',r.research_project_id,'ownerAccountId',r.owner_account_id,'ownerName',a."displayName",'kind',r.asset_kind,'revision',r.revision,'workingVersionNo',r.working_version_no,'workingState',r.working_state,'submittedVersionNo',r.submitted_version_no,'approvedVersionNo',r.approved_version_no,'releasedVersionNo',r.released_version_no,'releaseState',r.release_state,'everSubmitted',r.ever_submitted,'deletedAt',r.deleted_at,'createdAt',r.created_at,'updatedAt',r.updated_at) AS registry,
 coalesce((SELECT jsonb_agg(jsonb_build_object('version',p.version_no,'metadata',p.metadata,'sourceKind',p.source_kind,'sourceBindings',p.source_bindings,'rightsEvidence',p.rights_evidence,'discoveryRecipientCeiling',p.discovery_recipient_ceiling,'contentHash',p.content_hash,'policyHash',p.policy_hash,'artifactVersionId',p.artifact_version_id,'createdAt',p.created_at,'createdBy',p.created_by,'block',v."contentBlocks"->0,'storedContentHash',v."contentHash") ORDER BY p.version_no) FROM rh_asset.version_policy p JOIN public.research_artifact_version v ON v.id=p.artifact_version_id WHERE p.asset_id=r.asset_id),'[]') AS policies,
 coalesce((SELECT jsonb_agg(jsonb_build_object('type',e.event_type,'version',e.version_no,'revision',e.asset_revision,'actorAccountId',e.actor_account_id,'discoveryRecipients',e.payload->'discoveryRecipients','expiresAt',e.payload->>'expiresAt','createdAt',e.created_at) ORDER BY e.asset_revision) FROM rh_asset.asset_event e WHERE e.asset_id=r.asset_id),'[]') AS events,
 coalesce((SELECT jsonb_agg(jsonb_build_object('version',x.version_no,'recipientAccountId',x.recipient_account_id,'actions',x.approved_actions,'state',x.state,'expiresAt',x.expires_at)) FROM rh_asset.access_request x WHERE x.asset_id=r.asset_id),'[]') AS grants
 FROM rh_asset.asset_registry r JOIN public.account a ON a.id=r.owner_account_id LEFT JOIN public.research_artifact c ON c.id=r.asset_id
 WHERE r.tenant_id=$1 AND r.study_group_id=$2 AND r.research_project_id=$3 AND r.asset_id ${business?'LIKE':'NOT LIKE'} 'rhab-%' ${assetId===undefined?'':'AND r.asset_id=$4'} ORDER BY r.asset_id ${business?'':'LIMIT 27'}`,principal.tenantId,principal.studyGroupId,principal.researchProjectId,...(assetId===undefined?[]:[assetId]));
 if(!business&&rows.length>26)invalid();const seen=new Set();let legacy=0,detail=0,context=0;
 for(const r of rows){
  if(!CATALOG_KINDS.includes(r.registry.kind)||!business&&(r.policies.length>8||r.events.length>24))invalid();
  const parent=r.parent,ownerLabel=Object.entries(principal.catalogActors??{}).find(([_label,id])=>id===r.registry.ownerAccountId)?.[0];
  if(!parent||!business&&!ownerLabel||parent.id!==r.registry.assetId||['tenantId','studyGroupId','researchProjectId','ownerAccountId'].some(k=>parent[k]!==r.registry[k])||['tenantId','studyGroupId','researchProjectId'].some(k=>r.registry[k]!==principal[k])||parent.createdBy!==r.registry.ownerAccountId||parent.typeKey!=='research_report'||parent.status!=='draft'||parent.deletedAt||parent.currentVersionNo!==r.registry.workingVersionNo)invalid();
  r.family=business?businessAssetFamily(parent,r.registry):catalogAssetFamily(parent.idempotencyKey,r.registry,principal);
  if(!r.family||seen.has(parent.idempotencyKey)||r.registry.workingVersionNo>r.family.maxVersions||r.policies.length>r.family.maxVersions)invalid();seen.add(parent.idempotencyKey);
  if(business){if(r.policies.length!==r.registry.workingVersionNo||r.events.length!==r.registry.revision||r.policies.some((p,i)=>p.version!==i+1)||r.events.some((e,i)=>e.revision!==i+1))invalid();}
  else if(r.family.family==='catalog'){if(++legacy>10)invalid();}else if(r.family.family==='detail'){if(++detail>16)invalid();}else if(++context>1)invalid();
  if(!business&&principal.researchProjectId===REPORT_CONTEXT.projectId&&r.family.family!=='report_context')invalid();
  for(const p of r.policies){
   p.assetId=r.registry.assetId;
   const b=p.block;
   if(!b||b.type!=='rh-research-asset-catalog.v2'||b.assetKind!==r.registry.kind||b.ownerAccountId!==r.registry.ownerAccountId||b.versionNo!==p.version||b.policyHash!==p.policyHash||p.storedContentHash!==p.contentHash||canonical(b.metadata)!==canonical(p.metadata)||canonical(b.sourceBindings)!==canonical(p.sourceBindings))invalid();
   assertRegistrationPolicy(b,p,r.registry.ownerAccountId,r.registry.kind);
   // Non-author source families must be actively checked, never silently admitted by a missing adapter.
   // Do not ask an artifact-only user to open somebody else's invisible KB.
   // Managers still recheck recycled sources for a possible restore.
   const needsSource=!business&&!skipInvisibleSourceReads||r.registry.ownerAccountId===principal.accountId||principal.isTenantAdmin===true||catalogVisibleVersion({...r,principal,version:p.version})!==null;
   p.sourceValid=p.sourceKind==='author'&&p.sourceBindings.length===0?true:needsSource?await assertSources(tx,principal,p):false;
  }
 }
 return rows;
}

export function createAssetCatalogReader({withAccess,assertSources=async()=>false,previewProjection=()=>({}),now=()=>Date.now(),loadRecords=loadCatalogRecords}){
 if(typeof withAccess!=='function')throw new TypeError('Current asset authorization required');
 const read=(user,run)=>withAccess(user,'artifact.read',async(tx,p)=>run(tx,p,await loadRecords(tx,p,assertSources)));
 const detail=(user,id,version,includeBody,tab='basic')=>read(user,async(tx,p,records)=>{
   if(!validId(id)||version!==undefined&&(!/^[1-9][0-9]*$/.test(String(version))||!Number.isSafeInteger(Number(version))))throw catalogError('INPUT_INVALID',400,'资产标识或版本无效。');
   const r=records.find(r=>r.registry.assetId===id),selected=r&&visible(r,p,now(),version===undefined?undefined:Number(version),records);
   if(!selected)throw catalogError('NOT_FOUND',404,'未找到可访问的资产或版本。');
   const current=visible(r,p,now());let {policy,view}=selected;
   let contentMd;
   if(includeBody&&view.bodyAllowed){
    const v=await tx.researchArtifactVersion.findFirst({where:{id:policy.artifactVersionId,artifactId:id,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,versionNo:view.version},select:{contentMd:true}});
    if(!v||hash(v.contentMd)!==policy.contentHash)invalid();contentMd=v.contentMd;
   }
   const final=visible(r,p,now(),view.version,records);if(!final)throw catalogError('NOT_FOUND',404,'当前固定版本已不可访问。');view=final.view;if(!view.bodyAllowed)contentMd=undefined;
   return{schemaVersion:includeBody?'rh-research-asset-detail.v2':'rh-research-asset-preview.v1',id,kind:r.registry.kind,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,ownerAccountId:r.registry.ownerAccountId,owner:selected.row.owner,sourceStudy:selected.row.sourceStudy,version:view.version,currentVersion:current?.view.version??view.version,isHistorical:view.version!==current?.view.version,state:selected.row.state,readOnly:true,bodyAccess:view.bodyAllowed?'allowed':'restricted',bodyExpiresAt:view.bodyExpiresAt??null,...(contentMd!==undefined?{contentMd}:{}),metadata:policy.metadata,sourceKind:policy.sourceKind,createdAt:policy.createdAt,assetCreatedAt:r.registry.createdAt,canActions:selected.row.canActions,revision:r.registry.revision,...(r.aiAvailability?{aiAvailability:r.aiAvailability}:{}),canEditTags:r.family.family==='detail'&&selected.row.canActions.includes('edit')&&view.bodyAllowed,family:r.family.family,...(r.family.family==='report_context'?{sourceOrigin:{studyId:REPORT_CONTEXT.studyId,reportId:REPORT_CONTEXT.reportId,reportVersion:1}}:r.sourceOrigin?{sourceOrigin:r.sourceOrigin}:{}),versions:r.policies.filter(v=>visible(r,p,now(),v.version)).map(v=>({version:v.version,createdAt:v.createdAt})).sort((a,b)=>b.version-a.version),identityRevision:p.identityRevision,...(!includeBody?await previewProjection({tx,records,principal:p,id,version:view.version,tab,now:now()}):{})};
  });
 return{
  catalog:(user,query)=>read(user,(_tx,p,records)=>presentAssetCatalog({records,principal:p,query,now:now()})),
  detail:(user,id,version)=>detail(user,id,version,true),
  preview:(user,id,version,tab)=>detail(user,id,version,false,tab)
 };
}
