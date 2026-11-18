import{createHash}from'node:crypto';
import{assertAssetCatalogInput,catalogError,CATALOG_KINDS}from'./research-assets-catalog-contract.mjs';
const fail=()=>{throw catalogError('OVERVIEW_INCOMPLETE',409,'资产范围未能完整核对，请重新读取。');};
const same=(a,b)=>a?.studyGroupId===b?.studyGroupId&&a?.researchProjectId===b?.researchProjectId;
const unique=items=>[...new Set(items)];
export function presentAssetOverview({parts,user,query={},tab='list',studyFilter=null,collaborationView='all',selection=null,selectedAsset,cursor=null,now=Date.now()}){
 const q=assertAssetCatalogInput(query);
 if(!Array.isArray(parts)||parts.some(p=>p.failed||!p.catalog||!p.identityRevision))fail();
 if(studyFilter&&!parts.some(p=>same(p.scope,studyFilter)))throw catalogError('FORBIDDEN',403,'当前研究无权访问。');
 const selected=studyFilter?parts.filter(p=>same(p.scope,studyFilter)):parts;
 const identityRevision=createHash('sha256').update(JSON.stringify({tenantId:user.tenantId,accountId:user.accountId,authVersion:user.authVersion,parts:parts.map(p=>({scope:p.scope,identityRevision:p.identityRevision}))})).digest('hex');
 const attach=(part,row)=>({...row,id:row.id??row.assetId,assetScope:{...part.scope},scopeIdentityRevision:part.identityRevision});
 const rows=selected.flatMap(p=>p.catalog.items.map(r=>attach(p,r)));
 if(unique(rows.map(r=>r.id)).length!==rows.length)fail();
 const stats=Object.fromEntries(['all',...CATALOG_KINDS].map(k=>[k,selected.reduce((n,p)=>n+p.catalog.stats[k],0)]));
 const compare=new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'}).compare;
 const direction=q.direction==='asc'?1:-1;
 rows.sort((a,b)=>direction*compare(String(a[q.sort]??''),String(b[q.sort]??''))||compare(b.id,a.id));
 const page=items=>({total:items.length,page:q.page,pageSize:q.pageSize,items:items.slice((q.page-1)*q.pageSize,q.page*q.pageSize)});
 const catalog={...page(rows),stats,filterOptions:{domains:unique(selected.flatMap(p=>p.catalog.filterOptions.domains)).sort(compare)}};
 let mainView=null;
 if(tab==='graph'){
  const picked=new Set(catalog.items.map(r=>r.id)),nodes=selected.flatMap(p=>p.view.nodes.map(n=>({...n,assetScope:{...p.scope}}))).filter(n=>n.kind!=='asset'||picked.has(n.assetId));
  const edges=selected.flatMap(p=>p.view.edges).filter(e=>nodes.some(n=>n.id===e.from)&&nodes.some(n=>n.id===e.to));
  mainView={...page(rows),nodes:nodes.filter(n=>n.kind==='asset'||edges.some(e=>e.from===n.id||e.to===n.id)),edges};
 }else if(['contributions','trash','collaborations'].includes(tab)){
  const items=selected.flatMap(p=>p.view.items.map(r=>attach(p,r))).sort((a,b)=>compare(b.deletedAt??b.updatedAt??b.id,a.deletedAt??a.updatedAt??a.id)||compare(b.requestId??b.id,a.requestId??a.id));
  mainView=page(items);
  if(tab==='contributions')mainView.totals=Object.fromEntries(['created','revised','submitted','reviewed','cited'].map(k=>[k,selected.reduce((n,p)=>n+p.view.totals[k],0)]));
  if(tab==='collaborations'){mainView.collaborationView=collaborationView;mainView.counts=Object.fromEntries(['all','sent','received','requested','pending'].map(k=>[k,selected.reduce((n,p)=>n+p.view.counts[k],0)]));}
 }
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
 const days=selected[0]?.trend.days.map(d=>({...d,cited:0,applied:0,downloaded:0}))??Array.from({length:30},(_,i)=>({date:format.format(new Date(now-(29-i)*86400000)),cited:0,applied:0,downloaded:0}));
 for(const p of selected)for(const d of p.trend.days){const target=days.find(x=>x.date===d.date);if(!target)fail();for(const k of ['cited','applied','downloaded'])target[k]+=d[k];}
 const trend={timeZone:'Asia/Shanghai',days,totals:Object.fromEntries(['cited','applied','downloaded'].map(k=>[k,days.reduce((n,d)=>n+d[k],0)]))};
 const chosen=selection&&(selectedAsset??selected.flatMap(p=>p.contextRows??p.catalog.items).find(r=>r.id===selection.id&&r.version===selection.version));
 if(selection&&(!chosen||chosen.id!==selection.id||chosen.version!==selection.version||!selected.some(p=>p.scope.researchProjectId===chosen.sourceStudy.id)))throw catalogError('NOT_FOUND',404,'所选资产当前不可访问。');
 const ranked=rows.filter(r=>r.id!==selection?.id).map(r=>{const domain=chosen&&(r.domains??[]).some(d=>chosen.domains?.includes(d)),kind=chosen&&r.kind===chosen.kind;return{row:r,rank:domain?2:kind?1:0,reason:domain?'与所选资产有共同领域':kind?'与所选资产类型相同':'当前有权查看的资产'};}).sort((a,b)=>b.rank-a.rank||compare(b.row.id,a.row.id));
 const viewHash=createHash('sha256').update(JSON.stringify({identityRevision,query:q,selection,rows:ranked.map(r=>r.row)})).digest('hex');let offset=0;
 if(cursor){let decoded;try{if(typeof cursor!=='string'||!/^[A-Za-z0-9_-]{1,1024}$/.test(cursor))fail();decoded=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{fail();}if(decoded?.viewHash!==viewHash||!Number.isSafeInteger(decoded.offset)||decoded.offset<0||decoded.offset%3||decoded.offset>ranked.length)fail();offset=decoded.offset;}
 const recommended=ranked.slice(offset,offset+3).map(({row,reason})=>({...row,reason})),next=offset+recommended.length;
 const recommendations={items:recommended,total:ranked.length,nextCursor:next<ranked.length?Buffer.from(JSON.stringify({offset:next,viewHash})).toString('base64url'):null};
 const scopes=parts.map(p=>({...p.scope,label:p.label??p.scope.researchProjectId}));
 const contexts=selected.flatMap(p=>[...(p.contextRows??p.catalog.items),...(p.view?.items??[])].map(r=>({assetId:r.id??r.assetId,assetScope:{...p.scope},identityRevision:p.identityRevision}))).filter((c,i,all)=>all.findIndex(x=>x.assetId===c.assetId)===i);
 return{schemaVersion:'rh-asset-overview.v1',complete:true,tenantId:user.tenantId,accountId:user.accountId,identityRevision,studyFilter,scopes,creationScopes:scopes.filter((_,i)=>parts[i].canCreate),catalog,mainView,recommendations,trend,contexts};
}
