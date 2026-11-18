import {ASSET_AUX_VIEWS,parseAssetViewQuery} from '../scripts/research-assets-views-contract.mjs';
import {materialKnowledgeHref} from './session-material-session.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),version=x=>Number.isSafeInteger(x)&&x>0&&x<=8,count=x=>Number.isSafeInteger(x)&&x>=0&&x<=240;
const fail=()=>{throw Object.assign(new Error('资产视图无法核对，请重新读取。'),{status:409,code:'ASSET_CATALOG_CONTEXT_INVALID'});};
export function assetViewRequestAllowed(method,path){
 if(method!=='GET'||typeof path!=='string'||/[\\#]/.test(path)||path.includes('..'))return false;
 const [pathname,q,...extra]=path.split('?'),type=pathname.replace('/research-assets/','');if(extra.length||pathname!=='/research-assets/'+type||!ASSET_AUX_VIEWS.includes(type))return false;
 try{parseAssetViewQuery(type,new URLSearchParams(q));return true;}catch{return false;}
}
export function assertAssetView(v,type,{scope,identityRevision}){
 if(!v||v.schemaVersion!=='rh-asset-'+type+'.v1'||v.scope?.studyGroupId!==scope.studyGroupId||v.scope?.researchProjectId!==scope.researchProjectId||v.identityRevision!==identityRevision)fail();
 if(type==='usage'){
  if(v.timeZone!=='Asia/Shanghai'||!Array.isArray(v.days)||v.days.length!==30||v.days.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||['cited','applied','downloaded'].some(k=>!count(d[k]))||i&&Date.parse(d.date)-Date.parse(v.days[i-1].date)!==86400000)||['cited','applied','downloaded'].some(k=>!count(v.totals?.[k])||v.totals[k]!==v.days.reduce((n,d)=>n+d[k],0)))fail();return v;
 }
 if(!Number.isSafeInteger(v.total)||v.total<0||v.total>26)fail();
 if(type==='graph'){
  if(!Array.isArray(v.nodes)||v.nodes.length>100||!Array.isArray(v.edges)||v.edges.length>100||new Set(v.nodes.map(n=>n.id)).size!==v.nodes.length||v.nodes.some(n=>typeof n.id!=='string'||!['asset','knowledge','study'].includes(n.kind)||!id(n.assetId)||!version(n.version)||typeof n.title!=='string'||n.kind==='knowledge'&&!materialKnowledgeHref(n.knowledgeTarget,scope))||v.edges.some(e=>!v.nodes.some(n=>n.id===e.from)||!v.nodes.some(n=>n.id===e.to)||!['source','citation'].includes(e.type)||e.count!==undefined&&!count(e.count)))fail();return v;
 }
 if(!Array.isArray(v.items)||v.items.length>26||v.items.some(r=>!id(r.id)||!version(r.version)||typeof r.title!=='string'))fail();
 if(type==='recommendations'){if(v.items.length>3||v.nextCursor!==null&&(typeof v.nextCursor!=='string'||!/^[A-Za-z0-9_-]{1,1024}$/.test(v.nextCursor))||v.items.some(r=>typeof r.reason!=='string'))fail();}
 else if(type==='contributions'){const keys=['created','revised','submitted','reviewed','cited'];if(keys.some(k=>!count(v.totals?.[k]))||v.items.some(r=>keys.some(k=>!count(r.counts?.[k]))))fail();}
 else if(type==='trash'&&v.items.some(r=>!Number.isFinite(Date.parse(r.deletedAt))||typeof r.canRestore!=='boolean'||r.unavailableReason!==null&&typeof r.unavailableReason!=='string'))fail();
 return v;
}
export function assertAssetPreviewExtras(v,tab,scope){
 if(tab==='relations'){if(!Array.isArray(v.relations?.items)||v.relations.items.length>100||v.relations.items.some(r=>!['asset','knowledge'].includes(r.kind)||!['source','derived'].includes(r.relation)||typeof r.title!=='string'||r.kind==='asset'&&(!id(r.assetId)||!version(r.version))||r.kind==='knowledge'&&!materialKnowledgeHref(r.knowledgeTarget,scope)))fail();}
 if(tab==='citations'){if(!count(v.citations?.total)||!Array.isArray(v.citations.items)||v.citations.items.length!==v.citations.total||v.citations.items.some(r=>r.version!==v.version||!Number.isFinite(Date.parse(r.createdAt))||typeof r.targetStudyName!=='string'||typeof r.isSelf!=='boolean'))fail();}return v;
}
