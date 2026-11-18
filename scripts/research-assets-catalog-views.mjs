import {catalogError,assertAssetCatalogInput,catalogVisibleVersion} from './research-assets-catalog-contract.mjs';
import {presentAssetCatalog,catalogRowMatches,loadCatalogRecords} from './local-research-assets-catalog-read.mjs';
import {parseAssetViewQuery} from './research-assets-views-contract.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {ASSET_SOURCE_KB} from './research-assets-knowledge-sources.mjs';
const fail=(code='CONTEXT_INVALID',status=409)=>{throw catalogError(code,status,'资产视图已变化，请重新读取。');};
const queryObject=q=>Object.fromEntries(Object.entries(q).map(([k,v])=>[k,String(v)]));
const scope=p=>({tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId});
export function currentViewRows(records,p,query={},now=Date.now()){
 const q=assertAssetCatalogInput(query);
 return presentAssetCatalog({records,principal:p,query:queryObject({...q,page:1,pageSize:50}),now,allItems:true}).items;
}
export function visibleAssetEvents(records,p,rows,now){
 return records.filter(r=>rows.some(x=>x.id===r.registry.assetId)).flatMap(r=>r.events.filter(e=>catalogVisibleVersion({...r,principal:p,version:e.version,now})).map(e=>({...e,assetId:r.registry.assetId})));
}
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const day=value=>{const p=Object.fromEntries(dayFormat.formatToParts(new Date(value)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const counts=()=>({created:0,revised:0,submitted:0,reviewed:0,cited:0});
const knowledgeTarget=b=>({available:true,docId:b.id,kbId:ASSET_SOURCE_KB,docVersion:b.version,contentSha256:b.contentHash});
export async function sourceNames(tx,p,policies){const ids=[...new Set(policies.filter(v=>v.sourceValid===true).flatMap(v=>v.sourceBindings.filter(b=>b.kind==='knowledge').map(b=>b.id)))];return ids.length?tx.knowledgeDoc.findMany({where:{tenantId:p.tenantId,studyGroupId:p.studyGroupId,kbId:ASSET_SOURCE_KB,id:{in:ids}},select:{id:true,title:true,version:true}}):[];}
export function presentAssetViews({type,records,principal:p,query={},selection=null,cursor=null,knowledgeDocuments=[],now=Date.now(),allItems=false}){
 const q=assertAssetCatalogInput(query),rows=currentViewRows(records,p,query,now),events=visibleAssetEvents(records,p,rows,now),base={schemaVersion:'rh-asset-'+type+'.v1',scope:scope(p),identityRevision:p.identityRevision};
 const paged=items=>({...base,total:items.length,page:q.page,pageSize:q.pageSize,items:allItems?items:items.slice((q.page-1)*q.pageSize,q.page*q.pageSize)});
 if(type==='trash'){
  const items=records.flatMap(record=>{const r=record.registry,policy=record.policies.find(x=>x.version===r.workingVersionNo),manager=r.ownerAccountId===p.accountId||p.isTenantAdmin;
   if(!r.deletedAt||!manager||['tenantId','studyGroupId','researchProjectId'].some(k=>r[k]!==p[k])||!policy)return[];
   const row={...policy.metadata,id:r.assetId,kind:r.kind,version:r.workingVersionNo,sourceKind:policy.sourceKind,state:r.workingState,scope:'private',deletedAt:r.deletedAt};
   if(!catalogRowMatches({...row,domains:row.domains??[]},q))return[];
   return[{id:row.id,title:row.title,version:row.version,kind:row.kind,deletedAt:row.deletedAt,canRestore:policy.sourceValid===true&&r.revision<24&&Boolean(p.isTenantAdmin||p.permissions?.includes('artifact.edit')),unavailableReason:policy.sourceValid===false?'来源当前不可用，暂不能恢复。':r.revision>=24?'已达当前操作上限。':null}];
  }).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt))||b.id.localeCompare(a.id));return paged(items);
 }
 if(type==='contributions'){
  const own=events.filter(e=>e.actorAccountId===p.accountId),totals=counts(),items=rows.flatMap(r=>{const value=counts();for(const e of own.filter(e=>e.assetId===r.id))if(Object.hasOwn(value,e.type)){value[e.type]++;totals[e.type]++;}return Object.values(value).some(Boolean)?[{id:r.id,title:r.title,version:r.version,counts:value}]:[];});return{...paged(items),totals};
 }
 if(type==='usage'){
  const days=Array.from({length:30},(_,i)=>({date:day(now-(29-i)*86400000),cited:0,applied:0,downloaded:0})),totals={cited:0,applied:0,downloaded:0};
  for(const e of events){const ms=Date.parse(e.createdAt);if(!Number.isFinite(ms))fail();const metric=e.type==='asset_apply'?'applied':e.type;if(ms>now||!Object.hasOwn(totals,metric))continue;const bucket=days.find(d=>d.date===day(ms));if(bucket){bucket[metric]++;totals[metric]++;}}
  return{...base,timeZone:'Asia/Shanghai',days,totals};
 }
 if(type==='recommendations'){
  let selected;if(selection){const r=records.find(x=>x.registry.assetId===selection.id);if(!r||!catalogVisibleVersion({...r,principal:p,version:selection.version,now}))fail('NOT_FOUND',404);selected=r.policies.find(x=>x.version===selection.version);}
  const ranked=rows.filter(r=>r.id!==selection?.id).map(r=>{const domain=selected&&r.domains.some(d=>selected.metadata.domains?.includes(d)),kind=selected&&records.find(x=>x.registry.assetId===selection.id).registry.kind===r.kind;return{row:r,rank:domain?2:kind?1:0,reason:domain?'与所选资产有共同领域':kind?'与所选资产类型相同':'当前有权查看的资产'};}).sort((a,b)=>b.rank-a.rank||b.row.id.localeCompare(a.row.id));
  const viewHash=assetDigest({scope:scope(p),identity:p.identityRevision,query:q,selection,rows:ranked.map(x=>x.row)});let offset=0;
  if(cursor){let decoded;try{if(typeof cursor!=='string'||cursor.length>1024||!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();decoded=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{fail('INPUT_INVALID',400);}if(!decoded||decoded.viewHash!==viewHash||!Number.isSafeInteger(decoded.offset)||decoded.offset<0||decoded.offset%3||decoded.offset>ranked.length)fail('CURSOR_STALE');offset=decoded.offset;}
  const items=ranked.slice(offset,offset+3).map(({row:r,reason})=>({id:r.id,title:r.title,kind:r.kind,version:r.version,reason})),next=offset+items.length;
  return{...base,total:ranked.length,items,nextCursor:next<ranked.length?Buffer.from(JSON.stringify({offset:next,viewHash})).toString('base64url'):null};
 }
 if(type==='graph'){
  const selected=allItems?rows:rows.slice((q.page-1)*q.pageSize,q.page*q.pageSize),nodes=selected.map(r=>({id:r.id+':v'+r.version,kind:'asset',assetId:r.id,version:r.version,title:r.title})),edges=[];
  const put=n=>{if(!nodes.some(x=>x.id===n.id))nodes.push(n);};
  for(const row of selected){const r=records.find(x=>x.registry.assetId===row.id),policy=r.policies.find(x=>x.version===row.version),target=row.id+':v'+row.version;
   for(const b of policy.sourceBindings??[]){if(b.kind==='artifact'){const source=selected.find(x=>x.id===b.id&&x.version===b.version);if(source)edges.push({from:b.id+':v'+b.version,to:target,type:'source'});}else if(b.kind==='knowledge'&&policy.sourceValid===true){const id='knowledge:'+b.id+':v'+b.version,doc=knowledgeDocuments.find(d=>d.id===b.id&&d.version===b.version);if(!doc)fail('SOURCE_INVALID');put({id,kind:'knowledge',assetId:row.id,version:row.version,title:doc.title,knowledgeTarget:knowledgeTarget(b)});edges.push({from:id,to:target,type:'source'});}}
   const citations=events.filter(e=>e.assetId===row.id&&e.version===row.version&&e.type==='cited').length;if(citations){const id='study:'+p.researchProjectId;put({id,kind:'study',assetId:row.id,version:row.version,title:p.projectName??'当前研究'});edges.push({from:target,to:id,type:'citation',count:citations});}
  }
  return{...base,total:rows.length,page:q.page,pageSize:q.pageSize,nodes,edges};
 }
 fail('INPUT_INVALID',400);
}
export async function previewAssetView({tx,records,principal:p,id,version,tab,now=Date.now()}){
 if(!['relations','citations'].includes(tab))return{};
 const record=records.find(x=>x.registry.assetId===id);if(!record||!catalogVisibleVersion({...record,principal:p,version,now}))fail('NOT_FOUND',404);
 const reuse=record.family?.family==='detail'?(await tx.$queryRawUnsafe('SELECT kind,created_at FROM rh_asset.asset_reuse_record WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND asset_id=$4 AND version_no=$5 ORDER BY created_at,record_id',p.tenantId,p.studyGroupId,p.researchProjectId,id,version)).map(x=>({kind:x.kind,at:new Date(x.created_at).toISOString(),targetAvailable:false})):[];
 if(tab==='citations')return{reuse,citations:{total:record.events.filter(e=>e.version===version&&e.type==='cited').length,items:record.events.filter(e=>e.version===version&&e.type==='cited').map(e=>({version,createdAt:e.createdAt,targetStudyName:p.projectName??'当前研究',isSelf:e.actorAccountId===p.accountId}))}};
 const rows=currentViewRows(records,p,{},now),policy=record.policies.find(x=>x.version===version),items=[],documents=await sourceNames(tx,p,[policy]);
 for(const b of policy.sourceBindings??[]){if(b.kind==='knowledge'&&policy.sourceValid===true){const doc=documents.find(d=>d.id===b.id&&d.version===b.version);if(!doc)fail('SOURCE_INVALID');items.push({kind:'knowledge',relation:'source',title:doc.title,sourceVersion:b.version,knowledgeTarget:knowledgeTarget(b)});}else if(b.kind==='artifact'){const target=rows.find(r=>r.id===b.id&&r.version===b.version);if(target)items.push({kind:'asset',relation:'source',assetId:target.id,version:target.version,title:target.title});}}
 for(const row of rows){const other=records.find(x=>x.registry.assetId===row.id),v=other.policies.find(x=>x.version===row.version);if(v.sourceBindings?.some(b=>b.kind==='artifact'&&b.id===id&&b.version===version))items.push({kind:'asset',relation:'derived',assetId:row.id,version:row.version,title:row.title});}
 return{reuse,relations:{items}};
}
export function createAssetViewReader({withAccess,assertSources=async()=>false,now=()=>Date.now(),loadRecords=loadCatalogRecords}){
 return{read(user,type,query={}){const input=parseAssetViewQuery(type,query);return withAccess(user,'artifact.read',async(tx,p)=>{const records=await loadRecords(tx,p,assertSources),clock=now(),policies=type==='graph'?currentViewRows(records,p,input.query,clock).map(row=>records.find(r=>r.registry.assetId===row.id).policies.find(v=>v.version===row.version)):[];return presentAssetViews({type,records,principal:p,...input,knowledgeDocuments:await sourceNames(tx,p,policies),now:clock});});}};
}
