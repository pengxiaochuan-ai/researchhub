import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {useDirectoryIdentity} from './DirectoryState.jsx';
import {createResearchProjectsClient} from '../../src/research-projects-session.js';
import {readProtocolReviewRange} from '../../src/protocol-review-queue.js';
import {readProtocolReviewRoute,protocolReviewHref,protocolReviewDetailHref} from '../../src/governance-protocol-route.js';
import {protocolStatusLabel} from '../../src/execution-release-session.js';
import './governance-protocol.css';

const labels={returned:'已退回',approved:'已批准',activated:'已启用'};
const time=x=>new Date(x).toLocaleString('zh-CN',{hour12:false});
export default function GovernanceProtocolWorkspace(){
 const identity=useDirectoryIdentity(),client=useMemo(()=>createResearchProjectsClient(),[]);
 let route,routeError;try{route=readProtocolReviewRoute(location.search);}catch(e){routeError=e.message;}
 const tab=route?.tab??'pending',ready=!identity.checking&&!identity.unavailable&&identity.user.authenticated;
 const [state,setState]=useState(null),[revision,setRevision]=useState(0);
 const epoch=useRef(0),busy=useRef(false),loaded=useRef([]);
 async function read(next=null){
  if(busy.current||!ready||routeError)return;busy.current=true;const n=epoch.current,actor=identity.identityKey;
  setState({kind:'loading',identity:actor,tab,items:[],cursor:null});
  try{
   const result=await readProtocolReviewRange(client.request,tab,next?loaded.current.length+20:20);
   if(n!==epoch.current)return;
   loaded.current=result.items;
   setState({kind:'ready',identity:actor,tab,items:loaded.current,cursor:result.nextCursor});
  }catch(e){if(n!==epoch.current)return;loaded.current=[];setState({kind:'error',identity:actor,tab,items:[],cursor:null,message:e.message});if(e.status===401)window.dispatchEvent(new CustomEvent('qiyan:auth-refresh'));}
  finally{if(n===epoch.current)busy.current=false;}
 }
 useEffect(()=>{
  epoch.current++;client.invalidate();busy.current=false;loaded.current=[];setState(null);
  if(ready&&!routeError)void read();
  return()=>{epoch.current++;client.invalidate();};
 },[ready,identity.identityKey,identity.checking,tab,revision,routeError]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')setRevision(x=>x+1);};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
 const visible=ready&&state?.identity===identity.identityKey&&state.tab===tab?state:null;
 return <main className="platform-main gp-page"><div className="gp-content">
  <nav className="gp-tabs" aria-label="方案审核记录">{[['pending','待审核'],['processed','已处理']].map(([key,label])=><a key={key} aria-current={tab===key?'page':undefined} href={protocolReviewHref(key)}>{label}</a>)}</nav>
  <section className="gp-card" aria-busy={ready&&(!visible||visible.kind==='loading')}><div className="gp-heading"><h2>{tab==='pending'?'待审核方案':'审核决定记录'}</h2><Button disabled={!ready||visible?.kind==='loading'} onClick={()=>setRevision(x=>x+1)}>刷新列表</Button></div>
   <p className="gp-explanation">{tab==='pending'?'核对固定方案后，在方案详情完成内部审核。批准后仍需单独启用。':'按研究展示已记录的决定；同一版本可能有多次退回、批准或启用记录。'}</p>
   {routeError?<p role="alert">{routeError}</p>:identity.unavailable?<p role="alert">暂时无法核对登录状态，请检查网络后刷新。</p>:!ready?<p role="status">正在核对登录身份…</p>:<>
    {(!visible||visible.kind==='loading')&&<p role="status">正在读取{tab==='pending'?'待审方案':'审核记录'}…</p>}
    {visible?.kind==='error'&&<div role="alert"><p>{visible.message}</p><Button onClick={()=>setRevision(x=>x+1)}>重新读取</Button></div>}
    {!!visible?.items?.length&&<ul className="gp-items">{visible.items.map(x=><li key={tab==='pending'?x.studyId+':'+x.protocol.id:x.decision.id}><div className="gp-item-body"><h3>{x.protocol.title}</h3><p className="gp-meta">{x.studyTitle} · 方案 v{x.protocol.versionNumber}</p>{tab==='processed'?<><p><strong>{labels[x.decision.kind]}</strong> · {time(x.decision.createdAt)} · {x.decision.actorName||'决定人信息不可用'}</p>{x.decision.reason&&<p className="gp-reason">退回原因：{x.decision.reason}</p>}<p className="gp-meta">方案当前状态：{protocolStatusLabel(x.protocol.status)}</p></>:<p className="gp-meta">待审核{x.protocol.updatedAt?' · 方案更新：'+time(x.protocol.updatedAt):''}</p>}</div><a className="gp-action" href={protocolReviewDetailHref(x.studyId,x.protocol.id,tab)}>查看方案<span className="gp-sr">：{x.protocol.title} v{x.protocol.versionNumber}</span></a></li>)}</ul>}
    {visible?.kind==='ready'&&!visible.items.length&&<p role="status">{visible.cursor?'此范围暂未找到记录，可继续查找。':tab==='pending'?'当前可管理范围内没有待审核方案。':'当前可管理范围内没有已记录的审核决定。'}</p>}
    {visible?.cursor&&<div className="gp-footer"><span>已读取 {visible.items?.length??0} 条</span><Button disabled={visible.kind==='loading'} loading={visible.kind==='loading'} onClick={()=>void read(visible.cursor)}>继续读取</Button></div>}
   </>}
  </section>
 </div></main>;
}
