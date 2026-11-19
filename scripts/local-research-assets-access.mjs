import {catalogError,effectiveAssetRelease,assertAssetCatalogInput} from './research-assets-catalog-contract.mjs';
import {assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
import {randomUUID} from 'node:crypto';
import {loadCatalogRecords,presentAssetCatalog,catalogRowMatches,fixedReleaseState} from './local-research-assets-catalog-read.mjs';
import {lockCatalogAsset,findCatalogOperation,appendCatalogEvent,projectAssetOperationReceipt} from './local-research-assets-registration.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {parseAssetCollaborationQuery} from './research-assets-views-contract.mjs';
const scope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
const fail=(code,status=409,message='资产使用状态已变化，请重新核对。')=>{throw catalogError(code,status,message);};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),positive=x=>Number.isSafeInteger(x)&&x>0,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const text=x=>typeof x==='string'&&Boolean(x.trim())&&x.length<=2000;
export const DETAIL_PURPOSES=Object.freeze(['read_body','cite','comment','download','ai','derive','apply','export']);
const purposes=(x,detail=false)=>Array.isArray(x)&&x.length>0&&x.length<=(detail?8:2)&&new Set(x).size===x.length&&x.every(v=>(detail?DETAIL_PURPOSES:['read_body','cite']).includes(v));
const fields={request:['actions','purpose','ttlDays'],share:['recipientAccountId','actions','purpose','ttlDays','reason'],decide:['requestId','expectedRequestRevision','conclusion','actions','reason'],revoke:['requestId','expectedRequestRevision','reason'],cite:[]};
export function validateAssetAccessInput(v,{ids,detail=false,runtimeBusiness=false}){
 const common=['action','version','expectedRevision','requestKey','contentHash','policyHash','identityRevision'];
 if(!v||Array.isArray(v)||!Object.hasOwn(fields,v.action)||Object.keys(v).some(k=>!common.includes(k)&&!fields[v.action].includes(k))||!valid(v.requestKey)||v.requestKey.length<8||!positive(v.version)||v.version>(runtimeBusiness?2147483647:8)||!positive(v.expectedRevision)||v.expectedRevision>(runtimeBusiness?2147483647:24)||!hash(v.contentHash)||!hash(v.policyHash)||typeof v.identityRevision!=='string'||!v.identityRevision||v.identityRevision.length>300)fail('INPUT_INVALID',400);
 if(['request','share'].includes(v.action)&&(!purposes(v.actions,detail)||!text(v.purpose)||!positive(v.ttlDays)||v.ttlDays>7))fail('INPUT_INVALID',400);
 if(v.action==='share'&&(!valid(v.recipientAccountId)||!runtimeBusiness&&![ids.owner,ids.admin].includes(v.recipientAccountId)))fail('INPUT_INVALID',400);
 if(['share','decide','revoke'].includes(v.action)&&!text(v.reason))fail('INPUT_INVALID',400,'请填写用途核对或撤销理由。');
 if(['decide','revoke'].includes(v.action)&&(!valid(v.requestId)||!positive(v.expectedRequestRevision)))fail('INPUT_INVALID',400);
 if(v.action==='decide'&&(!['approved','rejected'].includes(v.conclusion)||!Array.isArray(v.actions)||v.conclusion==='approved'&&!purposes(v.actions,detail)||v.conclusion==='rejected'&&v.actions.length!==0))fail('INPUT_INVALID',400);
 return{...v,...(v.actions?{actions:[...v.actions].sort()}: {})};
}
export function assetAccessTransition(record,input,p,now=Date.now(),{runtimeBusiness=false}={}){
 const r=record.registry,policy=record.policies.find(x=>x.version===input.version);
 const selected=input.actions;if(selected&&!purposes(selected,record.family?.family==='detail'||runtimeBusiness&&record.family?.family==='business')&&!(input.action==='decide'&&input.conclusion==='rejected'&&selected.length===0))fail('INPUT_INVALID',400);
 if(selected?.includes('apply')&&r.kind!=='protocol')fail('RIGHTS_REQUIRED',422,'只有研究方案模板支持应用为方案。');
 if(['tenantId','studyGroupId','researchProjectId'].some(k=>r[k]!==p[k]))fail('NOT_FOUND',404);
 if(p.identityRevision!==input.identityRevision||r.revision!==input.expectedRevision||!policy||policy.contentHash!==input.contentHash||policy.policyHash!==input.policyHash)fail('VERSION_CONFLICT');
 const manage=r.ownerAccountId===p.accountId||p.isTenantAdmin===true;
 if(r.deletedAt||policy.sourceValid!==true&&!(input.action==='revoke'&&manage))fail('SOURCE_INVALID');
 if(!assetEventBudgetAllows(record,input.action,now))fail('FIXTURE_CAPACITY');
 const release=effectiveAssetRelease(record.events,input.version,now);
 const request=record.grants.find(g=>g.requestId===input.requestId),active=g=>g.version===input.version&&g.state==='approved'&&Date.parse(g.expiresAt)>now;
 const payload={contentHash:policy.contentHash,policyHash:policy.policyHash},next={...r,revision:r.revision+1};
 if(input.action==='revoke'){
  if(!manage)fail('FORBIDDEN',403);if(!request||request.version!==input.version||request.revision!==input.expectedRequestRevision||!['pending','approved'].includes(request.state))fail('VERSION_CONFLICT');
  return{next,type:'grant_revoked',payload:{...payload,reason:input.reason},request:{...request,state:'revoked',actions:[],revision:request.revision+1}};
 }
 if(!release.active)fail('STATE_CONFLICT');
 if(!manage&&!release.recipients.includes(p.accountId))fail('NOT_FOUND',404);
 if(input.action==='cite'){
  if(!manage&&!record.grants.some(g=>active(g)&&g.recipientAccountId===p.accountId&&g.actions.includes('cite')))fail('FORBIDDEN',403,'本版尚未获得引用许可。');
  return{next,type:'cited',payload};
 }
 if(['request','share'].includes(input.action)){
  if(input.action==='share'&&!manage)fail('FORBIDDEN',403);
  const recipient=input.action==='request'?p.accountId:input.recipientAccountId;
  if(recipient===r.ownerAccountId||input.action==='share'&&recipient===p.accountId)fail('SELF_REQUEST',409,'无需为本人申请或共享。');
  if(!release.recipients.includes(recipient)||!policy.discoveryRecipientCeiling.includes(recipient))fail('RIGHTS_REQUIRED',422);
  if(record.grants.some(g=>g.version===input.version&&g.recipientAccountId===recipient&&['pending','approved'].includes(g.state)&&Date.parse(g.expiresAt)>now))fail('DUPLICATE_REQUEST',409,'已有有效申请或许可，请先核对原记录。');
  const expiresAt=new Date(Math.min(now+input.ttlDays*86400000,Date.parse(release.expiresAt))).toISOString();
  return{next,type:input.action==='request'?'requested':'decided',payload:{...payload,purpose:input.purpose,...(input.reason?{reason:input.reason}:{})},request:{version:input.version,recipientAccountId:recipient,initiatorAccountId:p.accountId,requestedActions:input.actions,actions:input.action==='request'?[]:input.actions,purpose:input.purpose,expiresAt,state:input.action==='request'?'pending':'approved',decisionMode:input.action==='request'?'request':'direct_share',revision:1}};
 }
 if(!manage)fail('FORBIDDEN',403);
 if(!request||request.version!==input.version||request.revision!==input.expectedRequestRevision||request.state!=='pending'||Date.parse(request.expiresAt)<=now)fail('VERSION_CONFLICT');
 if(input.actions.some(a=>!request.requestedActions.includes(a)))fail('RIGHTS_REQUIRED',422);
 return{next,type:'decided',payload:{...payload,reason:input.reason,conclusion:input.conclusion},request:{...request,state:input.conclusion,actions:input.actions,revision:request.revision+1}};
}

export function createAssetUsage({ids,withAccess,assertSources=async()=>false,now=()=>Date.now(),loadRecords=loadCatalogRecords,beforeCommit=async()=>{},auditOptions,runtimeBusiness=false}){
 async function assertRecipient(tx,p,accountId){
  if(!runtimeBusiness&&![ids.owner,ids.admin].includes(accountId))fail('RIGHTS_REQUIRED',422);
  const account=await tx.account.findFirst({where:{id:accountId,tenantId:p.tenantId,status:'active'}});
  if(!account)fail('RIGHTS_REQUIRED',422,'接收人当前不可用，未新增许可。');
  if(account.role==='tenant_admin')return;
  const membership=await tx.studyGroupMembership.findFirst({where:{tenantId:p.tenantId,studyGroupId:p.studyGroupId,accountId,status:'active',role:{tenantId:p.tenantId,status:'active'}},include:{role:true}});
  const member=await tx.researchProjectMembership.findFirst({where:{tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,accountId,status:'active'}});
  const includes=(list,item)=>Array.isArray(list)&&(list.includes(item)||list.includes('*'));
  if(!member||!membership||!includes(membership.role?.menuPermissions,'artifacts')||!includes(membership.role?.buttonPermissions,'artifact.read'))fail('RIGHTS_REQUIRED',422,'接收人当前研究访问权限无法核对，未新增许可。');
 }
 async function current(tx,p,id){
  await lockCatalogAsset(tx,p,id);
  const record=(await loadRecords(tx,p,assertSources)).find(x=>x.registry.assetId===id);if(!record)fail('NOT_FOUND',404);
  const rows=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.access_request WHERE asset_id=$1 AND tenant_id=$2 AND study_group_id=$3 AND research_project_id=$4 ORDER BY created_at,request_id FOR UPDATE',id,p.tenantId,p.studyGroupId,p.researchProjectId);
  record.grants=rows.map(x=>({requestId:x.request_id,version:x.version_no,recipientAccountId:x.recipient_account_id,initiatorAccountId:x.initiator_account_id,requestedActions:x.requested_actions,actions:x.approved_actions,purpose:x.purpose,state:x.state,decisionMode:x.decision_mode,reason:x.decision_reason,expiresAt:x.expires_at.toISOString(),createdAt:x.created_at.toISOString(),revision:x.revision}));return record;
 }
 async function available(tx,p,id,version){
  const record=await current(tx,p,id),r=record.registry,policy=record.policies.find(x=>x.version===version),manage=r.ownerAccountId===p.accountId||p.isTenantAdmin===true,release=effectiveAssetRelease(record.events,version,now());
  if(!policy||r.deletedAt||!manage&&(!release.active||!release.recipients.includes(p.accountId)||policy.sourceValid!==true))fail('NOT_FOUND',404);
  return{record,r,policy,manage,release};
 }
 return{
  collaborations(user,query){
   return withAccess(user,'artifact.read',async(tx,p)=>readAssetCollaborations({tx,p,records:await loadRecords(tx,p,assertSources),query,ids,now,runtimeBusiness}));
  },
  options(user,id,version){
   if(!valid(id)||(!runtimeBusiness?!/^[1-8]$/.test(String(version)):!/^[1-9][0-9]*$/.test(String(version))||!positive(Number(version))||Number(version)>2147483647))fail('INPUT_INVALID',400);
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const {record,r,policy,manage,release}=await available(tx,p,id,Number(version));
    // Historical request names must remain resolvable so a manager can revoke an
    // inactive recipient's grant. Active status gates only new recipient choices.
    const people=await tx.account.findMany({where:{tenantId:p.tenantId,id:{in:runtimeBusiness?[...new Set([p.accountId,r.ownerAccountId,...policy.discoveryRecipientCeiling,...record.grants.flatMap(g=>[g.initiatorAccountId,g.recipientAccountId])])]:[ids.owner,ids.admin]}},select:{id:true,displayName:true,status:true}});
    const grants=record.grants.filter(g=>g.version===Number(version)&&(manage||g.recipientAccountId===p.accountId||g.initiatorAccountId===p.accountId));
    const allowed=release.active&&policy.sourceValid===true,live=grants.some(g=>['pending','approved'].includes(g.state)&&Date.parse(g.expiresAt)>now()&&g.recipientAccountId===p.accountId);
    const canCite=allowed&&(manage||grants.some(g=>g.state==='approved'&&g.actions.includes('cite')&&Date.parse(g.expiresAt)>now()&&g.recipientAccountId===p.accountId));
    return{schemaVersion:'rh-asset-usage.v1',scope:scope(p),assetId:id,version:Number(version),title:policy.metadata.title,expectedRevision:r.revision,identityRevision:p.identityRevision,contentHash:policy.contentHash,policyHash:policy.policyHash,sourceValid:policy.sourceValid===true,releaseActive:release.active,releaseExpiresAt:release.expiresAt,allowedActions:(record.family?.family==='detail'||runtimeBusiness&&record.family?.family==='business')?DETAIL_PURPOSES.filter(a=>a!=='apply'||r.kind==='protocol'):['read_body','cite'],canManage:manage,canRequest:allowed&&!manage&&!live,canShare:allowed&&manage,canCite,actors:people.map(a=>({accountId:a.id,displayName:a.displayName})),recipients:people.filter(a=>a.status==='active'&&a.id!==p.accountId&&a.id!==r.ownerAccountId&&release.recipients.includes(a.id)&&policy.discoveryRecipientCeiling.includes(a.id)).map(a=>({accountId:a.id,displayName:a.displayName})),requests:grants};
   });
  },
  async execute(user,id,input){
   if(!valid(id))fail('INPUT_INVALID',400);const value=validateAssetAccessInput(input,{ids,detail:true,runtimeBusiness});
   return withAccess(user,'artifact.read',async(tx,p)=>{
    const {record,policy}=await available(tx,p,id,value.version);
    if(p.identityRevision!==value.identityRevision)fail('IDENTITY_CHANGED');
    const requestHash=assetDigest({assetId:id,...scope(p),actor:p.accountId,...value}),prior=await findCatalogOperation(tx,p,value.requestKey,requestHash);if(prior)return projectAssetOperationReceipt(prior,record,p,now());
    const result=assetAccessTransition(record,value,p,now(),{runtimeBusiness}),next=result.next;
    await beforeCommit(tx,p,{record,action:value.action,input:value});
    if(value.action==='share'||value.action==='decide'&&value.conclusion==='approved')await assertRecipient(tx,p,result.request.recipientAccountId);
    const changed=await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET revision=$1,updated_at=now() WHERE asset_id=$2 AND revision=$3',next.revision,id,record.registry.revision);if(changed!==1)fail('VERSION_CONFLICT');
    let grant=result.request;
    if(grant&&!grant.requestId)grant={...grant,requestId:'rh-access-'+randomUUID()};
    const receipt={assetId:id,version:value.version,revision:next.revision,operation:result.type,status:'committed',...(grant?{requestId:grant.requestId,requestRevision:grant.revision}: {})};
    if(value.action==='cite')receipt.citation={text:policy.metadata.author+'．'+policy.metadata.title+' [科研资产，v'+value.version+']．',url:'/pages/a02/?'+new URLSearchParams({assetCatalog:'1',researchAssetId:id,assetVersion:String(value.version),studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId}),excerptIncluded:false};
    await appendCatalogEvent(tx,p,{registry:next,version:value.version,type:result.type,requestKey:value.requestKey,requestHash,payload:{...result.payload,...(grant?{access:grant}: {})},receipt},auditOptions);
    if(grant){
     const g=grant,decided=g.state==='pending'?null:p.accountId,reason=g.state==='pending'?null:value.reason;
     if(['request','share'].includes(value.action))await tx.$executeRawUnsafe('INSERT INTO rh_asset.access_request(request_id,tenant_id,study_group_id,research_project_id,asset_id,version_no,initiator_account_id,recipient_account_id,requested_actions,approved_actions,purpose,state,decision_mode,decided_by,decision_reason,expires_at,revision,event_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[],$11,$12,$13,$14,$15,$16::timestamptz,$17,$18)',g.requestId,p.tenantId,p.studyGroupId,p.researchProjectId,id,g.version,g.initiatorAccountId,g.recipientAccountId,g.requestedActions,g.actions,g.purpose,g.state,g.decisionMode,decided,reason,g.expiresAt,g.revision,next.revision);
     else{const n=await tx.$executeRawUnsafe('UPDATE rh_asset.access_request SET approved_actions=$1::text[],state=$2,decided_by=$3,decision_reason=$4,revision=$5,event_revision=$6,updated_at=now() WHERE request_id=$7 AND asset_id=$8 AND version_no=$9 AND revision=$10',g.actions,g.state,decided,reason,g.revision,next.revision,g.requestId,id,value.version,value.expectedRequestRevision);if(n!==1)fail('VERSION_CONFLICT');}
    }
    return receipt;
   });
  }
 };
}

export async function readAssetCollaborations({tx,p,records,query,ids,now=()=>Date.now(),allItems=false,runtimeBusiness=false}){
 const {query:q,view}=parseAssetCollaborationQuery(query);
    const visible=presentAssetCatalog({records,principal:p,query:Object.fromEntries(Object.entries({...q,page:1,pageSize:50}).map(([k,v])=>[k,String(v)])),now:now()}).items;
    const rows=await tx.$queryRawUnsafe("SELECT x.*,EXISTS(SELECT 1 FROM rh_asset.asset_event e WHERE e.asset_id=x.asset_id AND e.version_no=x.version_no AND e.payload->'access'->>'requestId'=x.request_id AND e.payload->'access'->>'state'='approved') AS ever_approved,EXISTS(SELECT 1 FROM rh_asset.asset_event e WHERE e.asset_id=x.asset_id AND e.version_no=x.version_no AND e.payload->'access'->>'requestId'=x.request_id AND e.payload->'access'->>'state'='approved' AND e.actor_account_id=$4) AS approved_by_me FROM rh_asset.access_request x WHERE x.tenant_id=$1 AND x.study_group_id=$2 AND x.research_project_id=$3 ORDER BY x.updated_at DESC,x.request_id LIMIT 241",p.tenantId,p.studyGroupId,p.researchProjectId,p.accountId);if(rows.length>240)fail('CONTEXT_INVALID');
    const items=rows.flatMap(x=>{const record=records.find(r=>r.registry.assetId===x.asset_id),policy=record?.policies.find(v=>v.version===x.version_no);if(!policy||record.registry.deletedAt)return[];
     const manager=p.isTenantAdmin||record.registry.ownerAccountId===p.accountId;if(!manager&&x.recipient_account_id!==p.accountId&&x.initiator_account_id!==p.accountId)return[];
     if(!visible.some(a=>a.id===x.asset_id)){
      // A source becoming unavailable must not hide the manager's reduction path.
      // Only sealed metadata is used for filtering; no body/source is returned.
      const r=record.registry,head=record.policies.find(v=>v.version===r.workingVersionNo);
      if(!manager||!head||!catalogRowMatches({...head.metadata,domains:head.metadata.domains??[],kind:r.kind,sourceKind:head.sourceKind,state:fixedReleaseState(record,r.workingVersionNo,now())??r.workingState,scope:!effectiveAssetRelease(record.events,r.workingVersionNo,now()).active?'private':r.ownerAccountId===p.accountId?'sent':'received'},q))return[];
     }
     const views=['all',...(x.approved_by_me?['sent']:[]),...(x.ever_approved&&x.recipient_account_id===p.accountId?['received']:[]),...(x.decision_mode==='request'&&x.initiator_account_id===p.accountId?['requested']:[]),...(manager&&x.state==='pending'&&Date.parse(x.expires_at)>now()?['pending']:[])];
     return[{assetId:x.asset_id,title:policy.metadata.title,version:x.version_no,requestId:x.request_id,requestRevision:x.revision,updatedAt:x.updated_at.toISOString(),recipientAccountId:x.recipient_account_id,purpose:x.purpose,actions:x.approved_actions.length?x.approved_actions:x.requested_actions,state:Date.parse(x.expires_at)<=now()&&['pending','approved'].includes(x.state)?'expired':x.state,expiresAt:x.expires_at.toISOString(),canManage:manager,canProcess:manager&&policy.sourceValid===true&&effectiveAssetRelease(record.events,x.version_no,now()).active,views}];});
    const people=await tx.account.findMany({where:{tenantId:p.tenantId,id:{in:runtimeBusiness?[...new Set(items.map(x=>x.recipientAccountId))]:[ids.owner,ids.admin]}},select:{id:true,displayName:true}});
    const counts=Object.fromEntries(['all','sent','received','requested','pending'].map(k=>[k,items.filter(x=>x.views.includes(k)).length])),filtered=items.filter(x=>x.views.includes(view));
    return{schemaVersion:'rh-asset-collaborations.v1',scope:scope(p),identityRevision:p.identityRevision,collaborationView:view,counts,page:q.page,pageSize:q.pageSize,total:filtered.length,items:(allItems?filtered:filtered.slice((q.page-1)*q.pageSize,q.page*q.pageSize)).map(x=>({...x,recipientName:people.find(a=>a.id===x.recipientAccountId)?.displayName??'接收人'}))};
}
