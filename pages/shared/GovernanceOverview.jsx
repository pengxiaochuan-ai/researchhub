import React,{useEffect,useMemo,useState} from 'react';
import {Button} from './Components.jsx';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import {hubSourceRequest} from '../../src/hub-source-api.js';
import {createDirectoryClient} from '../../src/directory-session.js';
import {createHubBillingClient} from '../../src/hub-billing-session.js';
import {createResearchProjectsClient} from '../../src/research-projects-session.js';
import {governanceKinds,governanceModules,governanceLink,loadGovernanceItems,selectGovernanceItems,governanceOverviewLocation,governanceOverviewHref,governanceItemHref,governanceCoverage} from '../../src/governance-overview.js';
import {createGovernanceUsersClient} from '../../src/governance-users-session.js';
import {createAccountAccessClient} from '../../src/account-session.js';
import {loadGovernanceResults} from '../../src/governance-loading.js';
import {createAcademicContentClient} from '../../src/academic-content-client.js';
import {academicHref} from '../../src/academic-content-route.js';
import './governance-overview.css';

const kinds=Object.keys(governanceKinds);
const date=value=>new Date(value).toLocaleString('zh-CN',{hour12:false});

function useGovernanceResults(mode,identity,refresh,enabled=true){
 const clients=useMemo(()=>{const protocols=createResearchProjectsClient(),users=createGovernanceUsersClient(),invites=createAccountAccessClient({enabled:Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG)});return{invitationStudies:options=>users.request('studies',options),invitationList:(scope,query,options)=>invites.listInvitations(scope,query,options),directory:createDirectoryClient(),billing:createHubBillingClient(),sourceRequest:hubSourceRequest,protocolRequest:protocols.request,protocols};},[]);
 const [result,setResult]=useState(null);
 const ready=enabled&&!identity.checking&&!identity.unavailable&&identity.user.authenticated;
 useEffect(()=>{
  setResult(null);
  if(!ready)return;
  let active=true;const controller=new AbortController();
  const requested=governanceCoverage(null,'all',mode).selected;
  const timer=setTimeout(()=>{controller.abort();clients.directory.invalidate();clients.billing.invalidate();clients.protocols.invalidate();},20000);
  void loadGovernanceResults({kinds:requested,signal:controller.signal,load:k=>loadGovernanceItems(k,mode,{...clients,signal:controller.signal}),onUpdate:next=>{if(active)setResult(next);}}).finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);controller.abort();clients.directory.invalidate();clients.billing.invalidate();clients.protocols.invalidate();};
 },[ready,identity.checking,identity.identityKey,identity.unavailable,mode,refresh,clients]);
 return result;
}

function GovernanceQueue({result,module,disposition,ready,page:controlledPage,onPage,returnLocation,initialPage=1}){
 const [localPage,setLocalPage]=useState(initialPage),page=controlledPage??localPage,setPage=onPage??setLocalPage;
 const {selected,accessible,partial}=governanceCoverage(result,module,disposition==='processed'?'processed':'pending');
 const failures=selected.filter(k=>result?.[k].state==='error');
 const loading=!result||selected.some(k=>result[k]?.state==='loading');
 const items=selectGovernanceItems(result,module,disposition),pages=Math.max(1,Math.ceil(items.length/5));
 const currentPage=Math.min(page,pages),shown=loading&&page>1?[]:items.slice((currentPage-1)*5,currentPage*5);
 return <div className="governance-queue" aria-busy={ready&&selected.length>0&&loading}>
  {!selected.length?<p role="status">暂未提供“{governanceModules[module].name}”的{disposition==='processed'?'处理结果':'待办'}汇总。</p>:!ready?null:!result?<p role="status">正在读取事项…</p>:<>
   {failures.length>0&&<div role="alert" className="governance-error">{failures.map(k=>governanceKinds[k]).join('、')}暂时读取失败，请刷新重试。</div>}
   {loading&&<p role="status">{accessible.length?'正在读取其余事项…':'正在读取事项…'}</p>}
   {selected.some(k=>result[k].state==='denied')&&<p className="governance-muted">{accessible.length||failures.length?'仅展示当前账号有权访问的管理事项。':'当前账号没有所选管理事项的查看或处理权限。'}</p>}
   {accessible.length>0&&items.length===0&&<p role="status">{partial?'已读取的类别暂无此类事项。':disposition==='action'?'当前汇总范围内没有可直接处理的事项。':disposition==='attention'?'当前汇总范围内暂无需关注事项。':'暂无处理结果。'}</p>}
   {!!shown.length&&<><ul className="governance-items">{shown.map(item=><li key={item.kind+':'+item.id}>
    <div className="governance-item-main"><h3>{item.title}</h3>{(disposition==='attention'||item.kind==='billing'||['changed','partial'].includes(item.status))&&item.reason&&<p>{item.reason}</p>}<div className="governance-item-meta"><span className="governance-muted">{governanceKinds[item.kind]} · {item.scopeLabel}</span><span>{item.stateLabel}</span>{item.updatedAt&&<span className="governance-muted">{item.timeLabel}：{date(item.updatedAt)}</span>}</div></div>
    <a className="governance-action" href={governanceItemHref(item,disposition==='attention'&&item.kind==='invitations'?{...returnLocation,attentionPage:currentPage}:controlledPage===undefined?returnLocation:{module,page:currentPage})}>{item.actionLabel}<span className="governance-sr-only">：{item.title}</span></a>
   </li>)}</ul><div className="governance-pagination"><span>{items.length}条{partial?'已读取事项':''} · 第{currentPage}／{pages}页</span>{pages>1&&<><Button disabled={loading||currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</Button><Button disabled={loading||currentPage===pages} onClick={()=>setPage(currentPage+1)}>下一页</Button></>}</div></>}
  </>}
 </div>;
}

function OverviewContent({identity}){
 const [academicAccess,setAcademicAccess]=useState(false);
 const [location,setLocation]=useState(()=>governanceOverviewLocation(window.location.search)),[history,setHistory]=useState(false),[refresh,setRefresh]=useState(0);
 const [attentionOpen,setAttentionOpen]=useState(Boolean(location.attentionPage));
 const ready=!identity.checking&&!identity.unavailable&&identity.user.authenticated;
 useEffect(()=>{setAcademicAccess(false);if(!ready)return;let active=true;const controller=new AbortController();void createAcademicContentClient().adminList({}, {signal:controller.signal}).then(()=>{if(active)setAcademicAccess(true);}).catch(()=>{});return()=>{active=false;controller.abort();};},[ready,identity.identityKey]);
 const supported=location.module==='all'||governanceModules[location.module].adapters.length>0;
 const result=useGovernanceResults('pending',identity,refresh),processed=useGovernanceResults('processed',identity,refresh,history&&governanceCoverage(null,location.module,'processed').selected.length>0);
 const access=kinds.filter(k=>k!=='protocols'&&result?.[k].state==='ready');
 const {accessible,partial}=governanceCoverage(result,location.module);
 const attention=selectGovernanceItems(result,location.module,'attention');
 function change(next){const value={...location,...next};if(next.module!==undefined&&next.module!==location.module)delete value.attentionPage;setLocation(value);window.history.replaceState(null,'',governanceOverviewHref(value));}
 useEffect(()=>{const show=e=>{if(e.persisted)setRefresh(v=>v+1);};window.addEventListener('pageshow',show);return()=>window.removeEventListener('pageshow',show);},[]);
 return <div className="governance-overview">
  {ready&&(access.length>0||academicAccess)&&<section className="governance-panel governance-common" aria-labelledby="governance-common"><h2 id="governance-common">常用管理</h2><nav className="governance-shortcuts" aria-label="常用管理">{access.map(k=><a key={k} href={governanceLink(k)}>{governanceKinds[k]}</a>)}{academicAccess&&<a href={academicHref({management:true})}>资讯与活动</a>}</nav></section>}
  <section className="governance-panel" aria-labelledby="governance-pending"><h2 id="governance-pending">待处理事项</h2><p className="governance-muted">汇总范围：方案审核、数据治理、用户与权限、系统配置</p>
   <div className="governance-toolbar"><label>所属模块<select aria-label="所属模块" value={location.module} onChange={e=>change({module:e.target.value,page:1})}><option value="all">全部模块</option>{Object.entries(governanceModules).map(([key,value])=><option key={key} value={key}>{value.name}</option>)}</select></label><Button disabled={!ready||!result||Object.values(result).some(x=>x.state==='loading')||!supported} onClick={()=>setRefresh(v=>v+1)}>刷新待办</Button></div>
   {location.module==='ethics'&&<p className="governance-muted">此处处理研究方案审核，不代表外部伦理审批。</p>}
   {!ready?<p role="status">{identity.checking?'正在核对当前身份…':identity.unavailable?'身份暂时无法核对，请检查网络后重试。':'请登录有管理权限的账号查看事项。'}</p>:<GovernanceQueue key={location.module} result={result} module={location.module} disposition="action" ready={ready} page={location.page} onPage={page=>change({page})}/>}
  </section>
  {ready&&supported&&accessible.length>0&&<details className="governance-panel governance-attention" open={attentionOpen} onToggle={e=>{const open=e.currentTarget.open;setAttentionOpen(open);if(!open&&location.attentionPage){const {attentionPage,...next}=location;setLocation(next);window.history.replaceState(null,'',governanceOverviewHref(next));}}}><summary>需关注（{partial?'已读取':''}{attention.length}）</summary><GovernanceQueue key={location.module} result={result} module={location.module} disposition="attention" ready={ready} returnLocation={location} initialPage={location.attentionPage??1}/></details>}
  <details className="governance-panel governance-history" onToggle={e=>setHistory(e.currentTarget.open)}><summary>处理结果</summary>{history&&ready&&<GovernanceQueue key={location.module} result={processed} module={location.module} disposition="processed" ready={ready} returnLocation={location}/>}</details>
 </div>;
}
export default function GovernanceOverview(){
 const identity=useDirectoryIdentity();
 return <OverviewContent key={[identity.identityKey,identity.checking,identity.unavailable].join(':')} identity={identity}/>;
}
