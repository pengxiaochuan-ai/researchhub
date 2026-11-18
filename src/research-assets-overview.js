import{ApiError}from'./knowledge-session.js';
import{assetRegistrationHeaders}from'./research-assets-registration.js';
import{assertCatalogList}from'./research-assets-catalog-session.js';
import{materialKnowledgeHref}from'./session-material-session.js';
import{assetVersionInRange}from'../scripts/research-assets-business-identity.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),count=x=>Number.isSafeInteger(x)&&x>=0,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>!a&&!b||a?.studyGroupId===b?.studyGroupId&&a?.researchProjectId===b?.researchProjectId;
const fail=()=>{throw new ApiError('资产总览范围或身份无法核对，请重新读取。',409,'ASSET_CATALOG_OVERVIEW_INVALID');};
export function overviewAssetScope(value,target){const found=value?.contexts?.find(x=>x.assetId===target?.assetId);return found?{...found.assetScope}:null;}
export function assertAssetOverview(value,{user,route}){
 try{
 if(!value||value.schemaVersion!=='rh-asset-overview.v1'||value.complete!==true||value.tenantId!==user.tenantId||value.accountId!==user.accountId||!hash(value.identityRevision)||!same(value.studyFilter,route.scope))fail();
 for(const key of ['scopes','creationScopes'])if(!Array.isArray(value[key])||value[key].some(s=>!id(s.studyGroupId)||!id(s.researchProjectId)||typeof s.label!=='string'))fail();
 if(value.creationScopes.some(s=>!value.scopes.some(t=>same(s,t))))fail();
 const c=value.catalog,keys=['all','protocol','dataset','instrument','analysis','publication'];
 if(!c||keys.some(k=>!count(c.stats?.[k]))||c.stats.all!==keys.slice(1).reduce((n,k)=>n+c.stats[k],0)||!count(c.total)||c.total>c.stats.all||c.page!==route.query.page||c.pageSize!==route.query.pageSize||!Array.isArray(c.items)||c.items.length!==Math.max(0,Math.min(c.pageSize,c.total-(c.page-1)*c.pageSize))||!Array.isArray(c.filterOptions?.domains))fail();
 if(!Array.isArray(value.contexts)||new Set(value.contexts.map(x=>x.assetId)).size!==value.contexts.length||value.contexts.some(x=>!id(x.assetId)||!hash(x.identityRevision)||!value.scopes.some(s=>same(s,x.assetScope))))fail();
 const validRow=r=>r&&id(r.id)&&assetVersionInRange(r.id,r.version)&&typeof r.title==='string'&&value.scopes.some(s=>same(s,r.assetScope))&&(!route.scope||same(route.scope,r.assetScope));
 if(c.items.some(r=>!validRow(r)||!hash(r.scopeIdentityRevision)||r.sourceStudy?.id!==r.assetScope.researchProjectId))fail();
 const checkCatalogRow=r=>{if(!validRow(r)||!value.contexts.some(x=>x.assetId===r.id&&same(x.assetScope,r.assetScope)&&x.identityRevision===r.scopeIdentityRevision))fail();const stats=Object.fromEntries(keys.map(k=>[k,k==='all'||k===r.kind?1:0]));assertCatalogList({schemaVersion:'rh-research-asset-catalog.v1',scope:r.assetScope,identityRevision:r.scopeIdentityRevision,stats,total:1,page:1,pageSize:1,items:[r],filterOptions:{domains:r.domains??[]}}, {scope:r.assetScope,query:{page:1,pageSize:1}});};
 c.items.forEach(checkCatalogRow);
 if(route.tab!=='list'){
  const v=value.mainView;if(!v||!count(v.total)||v.page!==c.page||v.pageSize!==c.pageSize)fail();
  if(route.tab==='graph'){
   if(!Array.isArray(v.nodes)||!Array.isArray(v.edges)||new Set(v.nodes.map(n=>n.id)).size!==v.nodes.length||v.nodes.some(n=>!n||typeof n.id!=='string'||!['asset','knowledge','study'].includes(n.kind)||!validRow({...n,id:n.assetId})||n.kind==='knowledge'&&!materialKnowledgeHref(n.knowledgeTarget,n.assetScope))||v.edges.some(e=>!e||!v.nodes.some(n=>n.id===e.from)||!v.nodes.some(n=>n.id===e.to)||!['source','citation'].includes(e.type)||e.count!==undefined&&!count(e.count)))fail();
  }else{
   if(!Array.isArray(v.items)||v.items.length!==Math.max(0,Math.min(v.pageSize,v.total-(v.page-1)*v.pageSize))||v.items.some(r=>!validRow(r)))fail();
   if(route.tab==='contributions'){const metrics=['created','revised','submitted','reviewed','cited'];if(metrics.some(k=>!count(v.totals?.[k]))||v.items.some(r=>metrics.some(k=>!count(r.counts?.[k]))))fail();}
   if(route.tab==='trash'&&v.items.some(r=>!Number.isFinite(Date.parse(r.deletedAt))||typeof r.canRestore!=='boolean'||r.unavailableReason!==null&&typeof r.unavailableReason!=='string'))fail();
  }
  if(route.tab==='collaborations'){
   const views=['all','sent','received','requested','pending'];
   if(!v.counts||views.some(k=>!count(v.counts[k])||v.counts[k]>v.counts.all)||v.collaborationView!==route.collaborationView||v.counts[route.collaborationView]!==v.total||v.items.some(r=>!id(r.assetId)||!id(r.requestId)||!Number.isSafeInteger(r.requestRevision)||r.requestRevision<1||typeof r.recipientName!=='string'||typeof r.purpose!=='string'||!Array.isArray(r.actions)||r.actions.some(a=>!['read_body','cite','comment','download','ai','derive','apply','export'].includes(a))||!['pending','approved','rejected','revoked','expired'].includes(r.state)||!Number.isFinite(Date.parse(r.expiresAt))||typeof r.canManage!=='boolean'||typeof r.canProcess!=='boolean'||!Array.isArray(r.views)||!r.views.includes(route.collaborationView)||r.views.some(k=>!views.includes(k))))fail();
  }
 }
 if(!value.recommendations||!Array.isArray(value.recommendations.items)||value.recommendations.items.length>3||value.recommendations.items.some(r=>!validRow(r)))fail();
 value.recommendations.items.forEach(checkCatalogRow);
 if(!count(value.recommendations.total)||value.recommendations.total<value.recommendations.items.length||value.recommendations.nextCursor!==null&&(typeof value.recommendations.nextCursor!=='string'||!/^[A-Za-z0-9_-]{1,1024}$/.test(value.recommendations.nextCursor))||value.recommendations.items.some(r=>typeof r.reason!=='string'))fail();
 if(!value.trend||value.trend.timeZone!=='Asia/Shanghai'||!Array.isArray(value.trend.days)||value.trend.days.length!==30||['cited','applied','downloaded'].some(k=>!count(value.trend.totals?.[k])||value.trend.totals[k]!==value.trend.days.reduce((n,d)=>n+d[k],0)))fail();
 if(value.trend.days.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||['cited','applied','downloaded'].some(k=>!count(d[k]))||i&&Date.parse(d.date)-Date.parse(value.trend.days[i-1].date)!==86400000))fail();
 return value;
 }catch{fail();}
}
export async function readAssetOverview({user,route,cursor,fetchImpl=globalThis.fetch}){
 const q=new URLSearchParams(Object.entries(route.query).map(([k,v])=>[k,String(v)]));q.set('tab',route.tab);q.set('collaborationView',route.collaborationView);
 if(route.scope)for(const[k,v]of Object.entries(route.scope))q.set(k,v);
 if(route.selection){q.set('selectedAssetId',route.selection.id);q.set('selectedVersion',String(route.selection.version));}if(cursor)q.set('cursor',cursor);
 let response;try{response=await fetchImpl('/api/research-assets/overview?'+q,{method:'GET',headers:{Accept:'application/json',...assetRegistrationHeaders(user)},credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new ApiError('资产总览连接暂不可用，请重新读取。',503);}
 let value;try{if(!response.headers.get('content-type')?.includes('application/json'))fail();value=await response.json();}catch{throw new ApiError('资产总览响应无法读取，请重新读取。',response.ok?503:response.status);}
 if(!response.ok)throw new ApiError(value.message??'资产总览暂不可用。',response.status,value.code);
 return assertAssetOverview(value,{user,route});
}
