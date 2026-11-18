import {isPendingReview,isDecidedReview,sourceReviewCopy} from './source-review-queue.js';
import {safeAcademicReturn} from './academic-content-route.js';
import {reportAssetReviewUrl,validReportAssetReview} from './report-asset-context.js';
import {parseReviewPage,parseDecisionPage} from './protocol-review-queue.js';
import {protocolReviewDetailHref} from './governance-protocol-route.js';
import {formalUrl} from './formal-preparation-session.js';
import {loadInvitationExceptions} from './invitation-exceptions.js';
import {invitationLocationHref} from './invitation-location.js';

export const governanceKinds={sources:'来源审核',teams:'团队资料维护',billing:'AI用量与对账',protocols:'方案审核',invitations:'邀请异常'};
export const governanceModules={
 ethics:{name:'伦理合规',adapters:['protocols']},data:{name:'数据治理',adapters:['sources','teams']},
 quality:{name:'研究质量',adapters:[]},access:{name:'用户与权限',adapters:['invitations']},
 centers:{name:'多中心管理',adapters:[]},audit:{name:'审计日志',adapters:[]},system:{name:'系统配置',adapters:['billing']},
};
const selectors={sources:'reviewKey',teams:'team',billing:'record'};
const views={sources:'source-review',teams:'directory-review',billing:'token-reconciliation'};
export function governanceNavTarget(label){
 if(label==='数据治理')return'/pages/g02/?view=source-review';
 if(label==='系统配置')return'/pages/g02/?view=token-reconciliation';
 if(label==='多中心管理')return'/pages/g02/?governanceModule=centers';
 return null;
}
const valid=(kind,id)=>typeof id==='string'&&(kind==='sources'?/^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+){1,2}$/:/^[A-Za-z0-9_-]{1,200}$/).test(id);
export function governanceLink(kind,id){
 if(kind==='invitations'){
  if(id===undefined)return'/pages/s11/';
  if(typeof id!=='string'||id.split(':').length!==3)throw Error('管理事项标识不正确。');
  return invitationLocationHref(...id.split(':'));
 }
 if(kind==='protocols'){
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,160}:[A-Za-z0-9_-]{1,160}(?::[A-Za-z0-9_-]{1,160})?$/.test(id))throw Error('管理事项标识不正确。');
  const [studyId,protocolId,decisionId]=id.split(':');return decisionId?protocolReviewDetailHref(studyId,protocolId,'processed'):formalUrl('s07',studyId,protocolId);
 }
 if(!Object.hasOwn(views,kind)||id!==undefined&&!valid(kind,id))throw Error('管理事项标识不正确。');
 return '/pages/g02/?'+new URLSearchParams({view:views[kind],...(id===undefined?{}:{[selectors[kind]]:id})});
}
export function governanceTarget(search,kind){
 const p=new URLSearchParams(search),key=selectors[kind],value=p.get(key);
 return p.getAll(key).length===1&&valid(kind,value)?value:null;
}
export function governanceOverviewLocation(search='',prefix='governance'){
 const p=new URLSearchParams(search),m=prefix+'Module',n=prefix+'Page',module=p.get(m),page=p.get(n);
 const attention=p.get(prefix+'AttentionPage');
 return{module:p.getAll(m).length===1&&(module==='all'||Object.hasOwn(governanceModules,module))?module:'all',page:p.getAll(n).length===1&&/^[1-9]\d{0,3}$/.test(page??'')?Number(page):1,...(p.getAll(prefix+'AttentionPage').length===1&&/^[1-9]\d{0,3}$/.test(attention??'')?{attentionPage:Number(attention)}:{})};
}
export function governanceOverviewHref(value){
 const params=new URLSearchParams(),{module,page,attentionPage}=governanceOverviewLocation(new URLSearchParams({governanceModule:value?.module??'all',governancePage:String(value?.page??1),...(value?.attentionPage!==undefined?{governanceAttentionPage:String(value.attentionPage)}:{})}).toString());
 if(module!=='all')params.set('governanceModule',module);if(page!==1)params.set('governancePage',String(page));if(attentionPage)params.set('governanceAttentionPage',String(attentionPage));
 return '/pages/g02/'+(params.size?'?'+params:'');
}
export function governanceItemHref(item,location){
 // Overview and G01 are distinct return origins; never combine their contexts.
 const href=item.kind==='protocols'&&item.disposition==='processed'?formalUrl('s07',...item.id.split(':').slice(0,2)):governanceLink(item.kind,item.id);
 const url=new URL(href,'http://local'),params=url.searchParams;
 const safe=governanceOverviewLocation(new URL(governanceOverviewHref(location),'http://local').search);
 const prefix=item.kind==='protocols'?'governance':'overview';
 params.set(prefix+'Module',safe.module);params.set(prefix+'Page',String(safe.page));if(item.kind==='invitations'&&safe.attentionPage)params.set('overviewAttentionPage',String(safe.attentionPage));return url.pathname+'?'+params;
}
export const governanceBackHref=search=>governanceOverviewHref(governanceOverviewLocation(search,'overview'));
export function safeGovernanceReturn(value){
 const academic=safeAcademicReturn(value);if(academic?.startsWith('/pages/g02/'))return academic;
 const fallback='/pages/p01/';let url;
 try{url=new URL(value,'http://researchhub.local');}catch{return fallback;}
 if(url.origin!=='http://researchhub.local'||url.pathname!=='/pages/g02/'||url.hash)return fallback;
 const p=url.searchParams,view=p.get('view'),kind=Object.keys(views).find(k=>views[k]===view);
 if(view==='asset-review'){
  return validReportAssetReview(p)?reportAssetReviewUrl(p.get('reportId')??undefined):fallback;
 }
 const allowed=view?['view',selectors[kind],'overviewModule','overviewPage']:['governanceModule','governancePage','governanceAttentionPage'];
 if(view&&!kind||[...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1))return fallback;
 for(const [key,v]of p){
  if(key.endsWith('Module')&&v!=='all'&&!Object.hasOwn(governanceModules,v))return fallback;
  if(key.endsWith('Page')&&!/^[1-9]\d{0,3}$/.test(v))return fallback;
  if(kind&&key===selectors[kind]&&(!valid(kind,v)||v.length>500))return fallback;
 }
 return url.pathname+url.search;
}
export function selectGovernanceItems(results,module,disposition){
 const adapters=module==='all'?Object.keys(governanceKinds):governanceModules[module]?.adapters??[];
 const unique=new Map();
 for(const kind of adapters)for(const item of results?.[kind]?.state==='ready'?results[kind].items:[])
  if(item.disposition===disposition&&!unique.has(item.eventKey))unique.set(item.eventKey,item);
 const knownDate=item=>item.updatedAt&&Number.isFinite(Date.parse(item.updatedAt))?Date.parse(item.updatedAt):null;
 return [...unique.values()].sort((a,b)=>{
  const x=knownDate(a),y=knownDate(b);
  if(x===null&&y!==null)return 1;if(x!==null&&y===null)return -1;
  return (x!==null&&y!==null?(disposition==='processed'?y-x:x-y):0)||a.eventKey.localeCompare(b.eventKey);
 });
}
export function governanceCoverage(results,module,mode='pending'){
 const selected=(module==='all'?Object.keys(governanceKinds):governanceModules[module]?.adapters??[]).filter(k=>mode!=='processed'||k!=='invitations');
 return{selected,accessible:selected.filter(k=>results?.[k]?.state==='ready'),partial:!!results&&selected.some(k=>results[k]?.state!=='ready')};
}
const invalid=()=>{throw Error('事项列表已变化或暂时无法核对，请重新读取。');};
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('读取已取消','AbortError');};
const time=value=>value&&Number.isFinite(Date.parse(value))?value:null;

// Reuse existing tenant-authorized lists. Never turn a rejected/partial read into zero tasks.
export async function loadGovernanceItems(kind,mode,{sourceRequest,directory,billing,protocolRequest,invitationStudies,invitationList,signal}){
 const processed=mode==='processed';let rows=[];
 cancelled(signal);
 if(kind==='invitations'){
  if(processed)throw Error('尚未提供邀请异常的处理历史。');
  return loadInvitationExceptions({studies:invitationStudies,list:invitationList,signal});
 }
 if(kind==='protocols'){
  let cursor=null;const cursors=new Set(),seen=new Set();
  do{
   cancelled(signal);
   const params=new URLSearchParams({...(processed?{}:{status:'pending_review'}),limit:'20',...(cursor?{cursor}:{})});
   const parse=processed?parseDecisionPage:parseReviewPage,endpoint=processed?'protocol-decisions':'protocol-reviews';
   const page=parse(await protocolRequest('/research-studies/'+endpoint+'?'+params,{signal}),cursor);cancelled(signal);
   if(page.nextCursor&&cursors.has(page.nextCursor))invalid();if(page.nextCursor)cursors.add(page.nextCursor);
   for(const x of page.items){
    const id=x.studyId+':'+x.protocol.id+(processed?':'+x.decision.id:''),key=processed?x.decision.id:id;if(seen.has(key))invalid();seen.add(key);
    const label=processed?{returned:'已退回',approved:'已批准',activated:'已启用'}[x.decision.kind]:'待审核';
    rows.push({id,title:x.protocol.title,status:processed?x.decision.kind:'pending_review',stateLabel:'方案 v'+x.protocol.versionNumber+' · '+label+(processed&&x.decision.actorName?' · '+x.decision.actorName:''),studyTitle:x.studyTitle,updatedAt:time(processed?x.decision.createdAt:x.protocol.updatedAt)});
   }
   cursor=page.nextCursor;
  }while(cursor);
 }else if(kind==='sources'){
  const result=await sourceRequest('review-queue',{signal});cancelled(signal);
  if(!Array.isArray(result?.items))invalid();
  const seen=new Set();
  for(const x of result.items){
   if(!valid(kind,x.key)||typeof x.title!=='string'||typeof x.state?.status!=='string'||seen.has(x.key))invalid();
   seen.add(x.key);
   if(!(processed?isDecidedReview(x):isPendingReview(x)||x.state.status==='unavailable'))continue;
   const dates=(x.detail?.decisions??[]).map(d=>time(d.createdAt)).filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a));
   const copy=sourceReviewCopy(x);
   rows.push({id:x.key,title:x.title,status:x.state.status,stateLabel:copy.label||x.state.status,reviewSummary:copy.summary,updatedAt:dates[0]??null});
  }
 }else if(kind==='teams'||kind==='billing'){
  let total=null;const seen=new Set();let page=1;
  do{
   cancelled(signal);
   const r=kind==='teams'?await directory.teamWorkspaces({page}):await billing.list({page,status:processed?'settled':'pending'});
   cancelled(signal);
   const p=kind==='teams'?r?.pagination:r;
   const count=kind==='teams'?p?.totalItems:p?.total;
   if(!Array.isArray(r?.items)||p?.page!==page||!Number.isSafeInteger(p?.pageSize)||p.pageSize<1||!Number.isSafeInteger(count)||count<0||total!==null&&total!==count)invalid();
   total=count;
   if(r.items.length!==Math.min(p.pageSize,Math.max(0,total-(page-1)*p.pageSize)))invalid();
   for(const x of r.items){
    if(!valid(kind,x.id)||seen.has(x.id))invalid();seen.add(x.id);
    if(kind==='teams'){
     if(typeof x.name!=='string')invalid();
     if(Boolean(x.reviewed)!==processed)continue;
     rows.push({id:x.id,title:x.name,status:processed?'reviewed':'pending',stateLabel:processed?'已审核':x.hasPublished?'有待审修改':'待审核',updatedAt:time(x.savedAt)});
    }else{
     if(typeof x.accountName!=='string')invalid();
     if(!processed&&x.executing)continue;
     rows.push({id:x.id,title:x.accountName+'的模型用量',status:x.status,canSettle:x.canSettle===true,stateLabel:x.status==='settled'?'已结算':x.status==='released'?'已释放':x.canSettle?'可结算':'待核实',updatedAt:time(x.createdAt)});
    }
   }
   page++;
  }while(seen.size<total);
 }else invalid();
 return rows.map(x=>{
  const needsAttention=kind==='sources'&&x.status==='unavailable'||kind==='billing'&&!x.canSettle;
  const disposition=processed?'processed':needsAttention?'attention':'action';
  const reason=processed||kind==='protocols'?'':kind==='billing'?disposition==='attention'?'尚缺完整用量凭据，暂不能结算。':'实际用量凭据完整，等待核对结算。':kind==='teams'?'团队资料需要审核。':x.status==='unavailable'?'资料尚不完整，暂不能审核。':x.status==='changed'?'来源内容已更新，需要重新核对。':x.status==='partial'?x.reviewSummary:'来源内容及使用范围尚未审核。';
  return{...x,kind,module:kind==='protocols'?'ethics':kind==='billing'?'system':'data',eventKey:kind+':'+x.id,disposition,reason,scopeLabel:kind==='protocols'?x.studyTitle:kind==='billing'?'本租户':'灵枢心域',actionLabel:kind==='protocols'?'查看方案':disposition==='action'?kind==='billing'?'核对':'审核':'查看',timeLabel:kind==='protocols'?processed?'处理时间':'方案更新':kind==='sources'?'最近审核':kind==='billing'?'发生时间':'更新时间',href:governanceLink(kind,x.id)};
 });
}
