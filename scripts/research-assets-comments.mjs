import {randomUUID} from 'node:crypto';
import {catalogError} from './research-assets-catalog-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {loadCatalogRecords,createAssetCatalogReader} from './local-research-assets-catalog-read.mjs';
import {lockCatalogAsset,findCatalogOperation,appendCatalogEvent} from './local-research-assets-registration.mjs';
import {assetEventBudgetAllows} from './research-assets-governance-contract.mjs';
import {buildA02Manifest} from './research-assets-a02-preflight-contract.mjs';
const fail=(code='COMMENT_CONFLICT',status=409,message='讨论状态已变化，请核对后重试。')=>{throw catalogError(code,status,message);};
const positive=x=>Number.isSafeInteger(x)&&x>0,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),key=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(x),publicId=x=>typeof x==='string'&&/^rh-comment-[a-f0-9]{32}$/.test(x);
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
export const publicCommentId=x=>'rh-comment-'+assetDigest(x).slice(0,32);
export function validateCommentInput(v){
 const common=['action','expectedRevision','identityRevision','contentHash','policyHash','requestKey','body'],extra={create:['parentCommentId'],edit:['expectedCommentRevision'],withdraw:['expectedCommentRevision'],moderate:['expectedCommentRevision','reason']};
 if(!v||Array.isArray(v)||!Object.hasOwn(extra,v.action)||Object.keys(v).some(k=>!common.includes(k)&&!extra[v.action].includes(k))||!positive(v.expectedRevision)||v.expectedRevision>24||!hash(v.identityRevision)||!hash(v.contentHash)||!hash(v.policyHash)||!key(v.requestKey)||v.action==='create'&&v.parentCommentId!=null&&!publicId(v.parentCommentId)||v.action!=='create'&&(!positive(v.expectedCommentRevision)||v.expectedCommentRevision>3)||['create','edit'].includes(v.action)&&!text(v.body)||['withdraw','moderate'].includes(v.action)&&v.body!==''||v.action==='moderate'&&!text(v.reason))fail('INPUT_INVALID',400,'请核对讨论内容与当前版本。');
 return{...v,...(v.reason?{reason:v.reason.trim()}:{})};
}
export function commentTransition(previous,input,p){
 if(!previous||input.action==='create'||previous.revision!==input.expectedCommentRevision||previous.revision>=3||['withdraw','moderate'].includes(previous.action))fail();
 const own=previous.authorAccountId===p.accountId;
 if(['edit','withdraw'].includes(input.action)&&!own||input.action==='moderate'&&(!p.isTenantAdmin||!text(input.reason)))fail('FORBIDDEN',403,'仅作者可修订或撤回；管理员管理须填写理由。');
 return{...previous,revision:previous.revision+1,action:input.action,body:['withdraw','moderate'].includes(input.action)?'':input.body,reason:input.reason??null};
}
export function presentAssetComments(rows,p,writable){return rows.map(x=>{const active=['create','edit'].includes(x.action),own=x.author_account_id===p.accountId;return{commentId:publicCommentId(x.comment_id),parentCommentId:x.parent_comment_id?publicCommentId(x.parent_comment_id):null,revision:x.revision,state:active?'active':x.action==='withdraw'?'withdrawn':'moderated',body:active?x.body:'',reason:x.action==='moderate'?x.reason:null,author:x.author_name??'未提供',createdAt:new Date(x.first_at??x.created_at).toISOString(),updatedAt:new Date(x.created_at).toISOString(),canEdit:writable&&active&&own&&x.revision<3,canWithdraw:writable&&active&&own&&x.revision<3,canModerate:writable&&active&&p.isTenantAdmin===true&&x.revision<3,canHistory:p.isTenantAdmin===true};});}
export function latestAssetComments(rows){const latest=[];for(const row of [...rows].sort((a,b)=>a.revision-b.revision)){const old=latest.find(x=>x.comment_id===row.comment_id);if(old)Object.assign(old,row,{first_at:old.first_at});else latest.push({...row,first_at:row.created_at});}return latest;}
export function createAssetComments({ids,withAccess,assertSources=async()=>false,now=()=>Date.now()}){
 const slots=()=>buildA02Manifest(ids).comments;
 const readFixed=(tx,p,id,v)=>createAssetCatalogReader({withAccess:(_u,_permission,run)=>run(tx,p),assertSources,now}).detail({},id,v);
 async function current(tx,p,id,v,{write=false}={}){
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(id)||!/^[1-8]$/.test(String(v)))fail('INPUT_INVALID',400);
  if(write)await lockCatalogAsset(tx,p,id);const record=(await loadCatalogRecords(tx,p,assertSources)).find(r=>r.registry.assetId===id);if(!record||record.family?.family!=='detail')fail('NOT_FOUND',404);
  const detail=await readFixed(tx,p,id,Number(v));if(detail.bodyAccess!=='allowed')fail('FORBIDDEN',403,'请先取得本固定版本的正文阅读许可。');
  const [rights]=await tx.$queryRawUnsafe("SELECT rh_asset.detail_actor_can_use($1,$2::integer,'comment') AS allowed",id,Number(v));
  const rows=await tx.$queryRawUnsafe('SELECT c.*,a."displayName" AS author_name,b."displayName" AS actor_name FROM rh_asset.asset_comment_event c JOIN public.account a ON a.id=c.author_account_id AND a."tenantId"=c.tenant_id JOIN public.account b ON b.id=c.actor_account_id AND b."tenantId"=c.tenant_id WHERE c.tenant_id=$1 AND c.study_group_id=$2 AND c.research_project_id=$3 AND c.asset_id=$4 AND c.version_no=$5 ORDER BY c.event_revision LIMIT 25',p.tenantId,p.studyGroupId,p.researchProjectId,id,Number(v));
  if(rows.length>24)fail('CONTEXT_INVALID');const latest=latestAssetComments(rows);
  if(latest.length>8)fail('CONTEXT_INVALID');const applicable=slots().filter(s=>s.assetKey===record.parent.idempotencyKey&&s.version===Number(v)&&ids[s.actor]===p.accountId),writable=rights?.allowed===true&&assetEventBudgetAllows(record,'comment',now());
  return{record,detail,rows,latest,applicable,writable,rightsAllowed:rights?.allowed===true};
 }
 function checkDelivery(detail){if(detail.bodyExpiresAt!=null&&Date.parse(detail.bodyExpiresAt)<=now())fail('FORBIDDEN',403,'正文使用许可已到期，请重新核对。');}
 function contextValue(c,p){const policy=c.record.policies.find(x=>x.version===c.detail.version);return{expectedRevision:c.record.registry.revision,identityRevision:p.identityRevision,contentHash:policy.contentHash,policyHash:policy.policyHash};}
 return{
  read(user,id,v,query={}){if(!query||Object.keys(query).some(k=>k!=='cursor')||query.cursor!==undefined&&(typeof query.cursor!=='string'||!/^[A-Za-z0-9_-]{1,512}$/.test(query.cursor)))fail('INPUT_INVALID',400);return withAccess(user,'artifact.read',async(tx,p)=>{
   const c=await current(tx,p,id,v),binding=assetDigest({id,v:Number(v),identity:p.identityRevision,revision:c.record.registry.revision,rows:c.latest.map(x=>[x.comment_id,x.revision])});let offset=0;if(query.cursor){let x;try{x=JSON.parse(Buffer.from(query.cursor,'base64url'));}catch{fail('INPUT_INVALID',400);}if(x.binding!==binding||!Number.isSafeInteger(x.offset)||x.offset<0||x.offset%4||x.offset>=c.latest.length)fail('CURSOR_STALE');offset=x.offset;}
   const items=presentAssetComments(c.latest,p,c.writable).map(x=>({...x,canReply:c.writable&&x.state==='active'&&c.applicable.some(s=>s.parentKey&&publicCommentId(s.parentKey)===x.commentId&&!c.latest.some(a=>a.comment_id===s.key))}));checkDelivery(c.detail);
   return{schemaVersion:'rh-asset-comments.v1',id,version:Number(v),...contextValue(c,p),canCreate:c.writable&&c.applicable.some(s=>!s.parentKey&&!c.latest.some(x=>x.comment_id===s.key)),total:items.length,items:items.slice(offset,offset+4),nextCursor:offset+4<items.length?Buffer.from(JSON.stringify({binding,offset:offset+4})).toString('base64url'):null};
  });},
  history(user,id,v,commentId){if(!publicId(commentId))fail('INPUT_INVALID',400);return withAccess(user,'artifact.read',async(tx,p)=>{if(!p.isTenantAdmin)fail('FORBIDDEN',403);const c=await current(tx,p,id,v),key=slots().find(s=>publicCommentId(s.key)===commentId)?.key,rows=c.rows.filter(x=>x.comment_id===key);if(!rows.length)fail('NOT_FOUND',404);checkDelivery(c.detail);return{schemaVersion:'rh-asset-comment-history.v1',id,version:Number(v),commentId,identityRevision:p.identityRevision,items:rows.map(x=>({revision:x.revision,action:x.action,body:x.body,reason:x.reason,actor:x.actor_name??'未提供',at:new Date(x.created_at).toISOString()}))};});},
  execute(user,id,v,commentId,input){const value=validateCommentInput(input);if(value.action==='create'&&commentId!=null||value.action!=='create'&&!publicId(commentId))fail('INPUT_INVALID',400);return withAccess(user,'artifact.read',async(tx,p)=>{
   const c=await current(tx,p,id,v,{write:true});if(!c.rightsAllowed)fail('FORBIDDEN',403,'当前不能新增或修改本固定版本的讨论。');checkDelivery(c.detail);const requestHash=assetDigest({kind:'a02-comment.v1',id,version:Number(v),commentId:commentId??null,actor:p.accountId,...value}),old=await findCatalogOperation(tx,p,value.requestKey,requestHash);if(old)return old;if(!c.writable)fail('FIXTURE_CAPACITY',409,'当前可用讨论操作数量已达上限。');
   const context=contextValue(c,p);if(['expectedRevision','identityRevision','contentHash','policyHash'].some(k=>value[k]!==context[k]))fail('VERSION_CONFLICT');let row;
   if(value.action==='create'){
    const parent=value.parentCommentId?slots().find(s=>publicCommentId(s.key)===value.parentCommentId)?.key:null,oldParent=parent&&c.latest.find(x=>x.comment_id===parent);
    if(value.parentCommentId&&(!oldParent||!['create','edit'].includes(oldParent.action)))fail('COMMENT_PARENT_INVALID',422,'回复对象当前不可用。');
    const slot=c.applicable.find(s=>(s.parentKey??null)===(parent??null)&&!c.latest.some(x=>x.comment_id===s.key));if(!slot)fail('FIXTURE_CAPACITY',409,'当前可用讨论数量已达上限。');
    row={comment_id:slot.key,parent_comment_id:parent,parent_revision:parent?1:null,author_account_id:p.accountId,revision:1,action:'create',body:value.body,reason:null};
   }else{
    const key=slots().find(s=>publicCommentId(s.key)===commentId)?.key,previous=c.latest.find(x=>x.comment_id===key);if(!previous)fail('NOT_FOUND',404);const changed=commentTransition({commentId:previous.comment_id,authorAccountId:previous.author_account_id,parentCommentId:previous.parent_comment_id,revision:previous.revision,action:previous.action},value,p);row={...previous,revision:changed.revision,action:changed.action,body:changed.body,reason:changed.reason};
   }
   const next={...c.record.registry,revision:c.record.registry.revision+1},n=await tx.$executeRawUnsafe('UPDATE rh_asset.asset_registry SET revision=$1,updated_at=now() WHERE asset_id=$2 AND revision=$3',next.revision,id,c.record.registry.revision);if(n!==1)fail('VERSION_CONFLICT');checkDelivery(c.detail);
   const receipt={status:'committed',operation:'comment_changed',assetId:id,version:Number(v),revision:next.revision,commentId:publicCommentId(row.comment_id),commentRevision:row.revision,commentAction:row.action};
   await appendCatalogEvent(tx,p,{registry:next,version:Number(v),type:'comment_changed',requestKey:value.requestKey,requestHash,payload:{commentId:row.comment_id,commentRevision:row.revision,action:row.action,...(row.reason?{reason:row.reason}:{})},receipt});
   await tx.$executeRawUnsafe('INSERT INTO rh_asset.asset_comment_event(event_id,tenant_id,study_group_id,research_project_id,asset_id,version_no,comment_id,parent_comment_id,parent_revision,author_account_id,actor_account_id,action,body,reason,revision,event_revision,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)','rh-comment-event-'+randomUUID(),p.tenantId,p.studyGroupId,p.researchProjectId,id,Number(v),row.comment_id,row.parent_comment_id??null,row.parent_revision??null,row.author_account_id,p.accountId,row.action,row.body,row.reason,row.revision,next.revision,value.requestKey,requestHash);return receipt;
  });}
 };
}
