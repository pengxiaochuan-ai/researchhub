import {assertAssetCatalogInput,CATALOG_KINDS} from '../scripts/research-assets-catalog-contract.mjs';
import {isBusinessAssetId,assetVersionInRange} from '../scripts/research-assets-business-identity.mjs';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const version=x=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&positive(Number(x));
const fail=()=>{throw Object.assign(new Error('资产入口、范围或版本无法核对，请返回科研资产重新选择。'),{status:409,code:'ASSET_CATALOG_CONTEXT_INVALID'});};
const queryKeys=['q','kind','domain','status','scope','source','page','pageSize','sort','direction'];
const uiKeys=['studyGroupId','researchProjectId','tab','selectedAssetId','selectedVersion','scroll','previewTab','collaborationView'];
const tabs=['list','graph','contributions','collaborations','trash'];
const previewTabs=['basic','versions','relations','citations'];
// Auth intentionally omits raw role permission arrays. The server checks current action rights.
export const catalogScopes=user=>(user?.studyGroups??[]).flatMap(g=>(g.researchProjects??[]).filter(p=>valid(g.id)&&valid(p.id)).map(p=>({studyGroupId:g.id,researchProjectId:p.id,label:g.name+' / '+p.name})));
export const catalogRenderState=(state,routeKey)=>state.status==='ready'&&state.routeKey!==routeKey?{status:'loading'}:state;
const unique=(p,keys)=>{if([...p.keys()].some(k=>!keys.includes(k)||p.getAll(k).length!==1))fail();};
export function readCatalogListLocation(search){
 const p=new URLSearchParams(search);unique(p,[...queryKeys,...uiKeys]);
 const g=p.get('studyGroupId'),r=p.get('researchProjectId');
 if((g||r)&&(!valid(g)||!valid(r))||p.has('tab')&&!tabs.includes(p.get('tab'))||p.has('previewTab')&&!previewTabs.includes(p.get('previewTab')))fail();
 if(p.has('collaborationView')&&!['all','sent','received','requested','pending'].includes(p.get('collaborationView')))fail();
 if((p.has('selectedAssetId')||p.has('selectedVersion'))&&(!valid(p.get('selectedAssetId'))||!version(p.get('selectedVersion'))))fail();
 if(p.has('scroll')&&(!/^(0|[1-9][0-9]{0,6})$/.test(p.get('scroll'))||Number(p.get('scroll'))>1000000))fail();
 const query=assertAssetCatalogInput(new URLSearchParams([...p].filter(([k])=>queryKeys.includes(k))));
 return{scope:g?{studyGroupId:g,researchProjectId:r}:null,query,tab:p.get('tab')??'list',collaborationView:p.get('collaborationView')??'all',previewTab:p.get('previewTab')??'basic',selection:p.has('selectedAssetId')?{id:p.get('selectedAssetId'),version:Number(p.get('selectedVersion'))}:null,scroll:Number(p.get('scroll')??0)};
}
export function safeCatalogReturn(value,scope){
 if(typeof value!=='string'||!value.startsWith('/pages/a01/')||/[\\\r\n]/.test(value))fail();
 const u=new URL(value,'http://researchhub.local');if(u.origin!=='http://researchhub.local'||u.pathname!=='/pages/a01/'||u.hash)fail();
 const parsed=readCatalogListLocation(u.search);
 if(scope&&parsed.scope&&(scope.studyGroupId!==parsed.scope.studyGroupId||scope.researchProjectId!==parsed.scope.researchProjectId))fail();
 return u.pathname+u.search;
}
export const isCatalogAssetRoute=(pageId,search)=>pageId==='a02'&&new URLSearchParams(search).has('assetCatalog');
export const isCatalogListRoute=(pageId,search)=>pageId==='a01'&&!['assetDrafts','crfMethodAssets','assetApplicability','projectId','view'].some(k=>new URLSearchParams(search).has(k));
export const catalogEntryActions=()=>[['知识资料','k01'],['上传资产',null,true]];
export const catalogOwnsPageAction=({real,pageId,search,label})=>real===true&&(isCatalogListRoute(pageId,search)&&label==='上传资产'||isCatalogAssetRoute(pageId,search)&&['引用','分享','下载','复用此资产'].includes(label));
export function catalogPreviewDuringRefresh(previous,catalog,selection){
 const preview=previous?.preview;
 if(previous?.status!=='ready'||!preview||preview.id!==selection?.id||preview.version!==selection?.version||previous.catalog?.identityRevision!==catalog.identityRevision)return{};
 // Keep one prior snapshot only while the explicit preview is still being verified.
 // The selected version need not occur on this filtered/paged list; success commits both, failure clears preview.
 return{catalog:previous.catalog,preview,previewStatus:'ready'};
}
export function catalogBreadcrumbReturn(pageId,search,target){
 if(target!=='a01'||!isCatalogAssetRoute(pageId,search))return null;
 try{return readCatalogAssetLocation(pageId,search).returnTo;}catch{return'/pages/a01/';}
}
export function catalogAssetHeader(config,pageId,search){
 if(!isCatalogAssetRoute(pageId,search))return config;
 return{...config,title:'资产详情',description:'核对资产的固定版本、来源与当前可用范围。',meta:'',crumbs:[['科研资产','a01'],['资产详情']],actions:(config.actions??[]).map(([label])=>[label,undefined,false,true]),nav:undefined};
}
export function readCatalogAssetLocation(pageId,search){
 const p=new URLSearchParams(search);unique(p,['researchAssetId','assetCatalog','assetVersion','studyGroupId','researchProjectId','assetReturnTo','assetDetailTab']);
 const scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')};
 if(pageId!=='a02'||p.get('assetCatalog')!=='1'||!valid(p.get('researchAssetId'))||!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||!version(p.get('assetVersion')))fail();
 if(p.has('assetDetailTab')&&!/^[0-6]$/.test(p.get('assetDetailTab')))fail();
 return{scope,assetId:p.get('researchAssetId'),versionNo:Number(p.get('assetVersion')),...(p.has('assetDetailTab')?{detailTab:Number(p.get('assetDetailTab'))}:{}),returnTo:safeCatalogReturn(p.get('assetReturnTo')??'/pages/a01/',scope)};
}
export function makeCatalogAssetUrl(scope,id,number,returnTo='/pages/a01/',detailTab){
 const p=new URLSearchParams({researchAssetId:id,assetCatalog:'1',assetVersion:String(number),studyGroupId:scope?.studyGroupId??'',researchProjectId:scope?.researchProjectId??'',assetReturnTo:safeCatalogReturn(returnTo,scope)});
 if(detailTab!==undefined)p.set('assetDetailTab',String(detailTab));readCatalogAssetLocation('a02',p);return'/pages/a02/?'+p;
}
export function catalogRequestAllowed(method,path){
 if(method!=='GET'||typeof path!=='string'||/[\\#]/.test(path)||path.includes('..'))return false;
 const [pathname,query,...extra]=path.split('?');if(extra.length)return false;
 try{
  if(pathname==='/research-assets/catalog'){assertAssetCatalogInput(new URLSearchParams(query));return true;}
  const detail=pathname.match(/^\/research-assets\/catalog\/([A-Za-z0-9_-]{1,160})(?:\/versions\/([1-9][0-9]*))?$/);
  if(detail)return query===undefined&&(!detail[2]||version(detail[2]));
  if(/^\/research-assets\/[A-Za-z0-9_-]{1,160}\/preview$/.test(pathname)){
   const p=new URLSearchParams(query);unique(p,['version','tab']);return version(p.get('version'))&&(!p.has('tab')||previewTabs.includes(p.get('tab')));
  }
 }catch{return false;}return false;
}
export function assertCatalogAssetDetail(v,route,{preview=false}={}){
 if(!v||v.schemaVersion!==(preview?'rh-research-asset-preview.v1':'rh-research-asset-detail.v2')||v.id!==route.assetId||!CATALOG_KINDS.includes(v.kind)||!valid(v.ownerAccountId)||v.studyGroupId!==route.scope.studyGroupId||v.researchProjectId!==route.scope.researchProjectId||v.version!==route.versionNo||!positive(v.currentVersion)||v.version>v.currentVersion||v.isHistorical!==(v.version!==v.currentVersion)||v.readOnly!==true||!['allowed','restricted'].includes(v.bodyAccess)||typeof v.metadata?.title!=='string'||!v.metadata.title.trim()||typeof v.metadata?.summary!=='string'||!Array.isArray(v.canActions)||v.canActions.some(a=>!['read','versions','edit','submit','review','release','withdraw','share','manage_access','request_access','cite','trash'].includes(a))||v.canActions.includes('edit')&&(v.isHistorical||v.bodyAccess!=='allowed')||typeof v.identityRevision!=='string'||!/^[a-f0-9]{64}$/.test(v.identityRevision))fail();
 if((preview||v.bodyAccess==='restricted')&&Object.hasOwn(v,'contentMd')||!preview&&v.bodyAccess==='allowed'&&(typeof v.contentMd!=='string'||!v.contentMd.trim()))fail();
 const business=v.family==='business'&&isBusinessAssetId(v.id);
 if(v.family==='business'&&!business||!Array.isArray(v.versions)||v.versions.length>(business?2147483647:8)||v.currentVersion>(business?2147483647:8)||!v.versions.some(x=>x.version===v.version)||v.versions.some(x=>!positive(x.version)||x.version>v.currentVersion)||new Set(v.versions.map(x=>x.version)).size!==v.versions.length)fail();
 return v;
}
export function shouldRenderContextBreadcrumb(pageId,config){
 return !(pageId==='a01'&&config.crumbs?.length===1&&config.crumbs[0][0]===config.title);
}
export function assertCatalogList(v,route){
 const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
 if(!v||!['rh-research-asset-catalog.v1','rh-research-asset-catalog.v2'].includes(v.schemaVersion)||v.scope?.studyGroupId!==route.scope?.studyGroupId||v.scope?.researchProjectId!==route.scope?.researchProjectId||!/^[a-f0-9]{64}$/.test(v.identityRevision??'')||!['all',...CATALOG_KINDS].every(k=>nonnegative(v.stats?.[k]))||v.stats.all!==CATALOG_KINDS.reduce((n,k)=>n+v.stats[k],0)||v.schemaVersion==='rh-research-asset-catalog.v1'&&v.stats.all>26||!nonnegative(v.total)||v.total>v.stats.all||v.page!==route.query.page||v.pageSize!==route.query.pageSize||!Array.isArray(v.items)||v.items.length!==Math.max(0,Math.min(v.pageSize,v.total-(v.page-1)*v.pageSize))||!Array.isArray(v.filterOptions?.domains)||v.filterOptions.domains.some(x=>typeof x!=='string'||!x.trim())||new Set(v.items.map(x=>x.id)).size!==v.items.length)fail();
 for(const r of v.items)if(!valid(r.id)||!CATALOG_KINDS.includes(r.kind)||typeof r.title!=='string'||!r.title.trim()||typeof r.summary!=='string'||!assetVersionInRange(r.id,r.version)||!valid(r.owner?.accountId)||typeof r.owner?.displayName!=='string'||r.sourceStudy?.id!==route.scope.researchProjectId||typeof r.sourceStudy?.name!=='string'||!['draft','in_review','changes_requested','approved','released','withdrawn','expired'].includes(r.state)||!['private','received','sent'].includes(r.scope))fail();
 return v;
}
export function createCatalogSelectionFence(){
 let sequence=0;
 return{begin:(id,version,identity)=>({sequence:++sequence,id,version,identity}),current:token=>token?.sequence===sequence,invalidate:()=>{sequence++;}};
}
