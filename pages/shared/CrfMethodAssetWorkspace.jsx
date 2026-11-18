import React,{useEffect,useRef,useState} from 'react';
import {Shell} from './Shell.jsx';
import {Card,Button} from './Components.jsx';
import {createKnowledgeClient,resolveKnowledgeScope,canUseResearchPlans} from '../../src/knowledge-session.js';
import {createDesignReadFence,createDesignRefreshGate} from '../../src/research-design-session.js';
import {readCrfMethodAssetLocation,makeCrfMethodAssetUrl,crfMethodAssetReadFailure} from '../../src/crf-method-assets-session.js';
import './synthetic-asset.css';
import './crf-method-assets.css';
import CrfMethodAssetDetail from './CrfMethodAssetDetail.jsx';

export default function CrfMethodAssetWorkspace({pageId}){
 const [profile,setProfile]=useState(null),[items,setItems]=useState([]),[next,setNext]=useState(null),[asset,setAsset]=useState(null),[loading,setLoading]=useState(true),[listing,setListing]=useState(false),[error,setError]=useState(''),[listIssue,setListIssue]=useState(null),[probeIssue,setProbeIssue]=useState(null);
 const api=useRef(null),route=useRef(null),account=useRef(null),probe=useRef(null),fence=useRef(createDesignReadFence()),token=useRef(0),listGate=useRef(createDesignRefreshGate()),authGate=useRef(createDesignRefreshGate()),alert=useRef(null);
 function clear(message=''){fence.current.invalidate();listGate.current.invalidate();authGate.current.invalidate();api.current=null;account.current=null;probe.current=null;setProbeIssue(null);setListIssue(null);setProfile(null);setAsset(null);setItems([]);setNext(null);setLoading(false);setListing(false);setError(message);}
 function readTarget(id,versionNo){const key=id+':'+(versionNo??'head');if(probe.current?.key===key)return;probe.current={id,versionNo,key};authGate.current.invalidate();}
 function reject(e,t){if(!fence.current.current(t))return;if([401,403].includes(e.status))clear(e.message);else setError(e.message??'读取失败，请重试；不会回退示例。');}
 async function list(append=false){if(!api.current)return;const g=listGate.current.begin();if(!g)return;const t=token.current;setListing(true);setError('');try{const data=await api.current.get('/crf-method-asset-drafts?limit=20'+(append&&next?'&before='+next:''));if(!fence.current.current(t))return;setItems(old=>append?[...old,...data.items.filter(v=>!old.some(x=>x.id===v.id))]:data.items);setNext(data.nextCursor);setListIssue(null);setError('');}catch(e){if(fence.current.current(t))setListIssue(crfMethodAssetReadFailure(e));reject(e,t);}finally{listGate.current.finish(g);if(fence.current.current(t))setListing(false);}}
 // Separate authorization probe: a held content GET must not prevent revocation
 // from clearing private content. It never resets the manually paged list.
 async function checkAccess(){if(!api.current||!probe.current)return;const g=authGate.current.begin();if(!g)return;const t=token.current,p=probe.current;try{await api.current.get('/crf-method-asset-drafts/'+p.id+(p.versionNo!==null&&p.versionNo!==undefined?'/versions/'+p.versionNo:''));if(fence.current.current(t)&&probe.current===p)setProbeIssue(null);}catch(e){if(fence.current.current(t)&&probe.current===p){if([401,403].includes(e.status))clear(e.message);else setProbeIssue(crfMethodAssetReadFailure(e));}}finally{authGate.current.finish(g);}}
 async function initialize(){clear();const t=fence.current.begin();token.current=t;setLoading(true);try{
  const parsed=readCrfMethodAssetLocation(pageId,location.search);route.current=parsed;
  if(!import.meta.env.VITE_AUTH_TENANT_SLUG)throw Error("方法资产暂不可用，请稍后重试。");
  const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Object.assign(Error("请先登录后查看本人方法资产。"),{status:response.status});
  const user=await response.json(),scope=resolveKnowledgeScope(user,parsed.scope.studyGroupId,parsed.scope.researchProjectId);if(!fence.current.current(t))return;
  if(scope?.studyGroupId!==parsed.scope.studyGroupId||scope?.researchProjectId!==parsed.scope.researchProjectId||!canUseResearchPlans(user,scope))throw Object.assign(Error("当前账号无权访问本研究的方法资产。"),{status:403});
  account.current=user.accountId;api.current=createKnowledgeClient({scope:()=>scope,onAccessLost:e=>{if(fence.current.current(t))clear(e.message);}});setProfile(user);
  if(parsed.assetId){readTarget(parsed.assetId,parsed.versionNo);const value=await api.current.get('/crf-method-asset-drafts/'+parsed.assetId+(parsed.versionNo?'/versions/'+parsed.versionNo:''));if(fence.current.current(t))setAsset(value);}else await list();
 }catch(e){reject(e,t);}finally{if(fence.current.current(t))setLoading(false);}}
 useEffect(()=>{void initialize();const changed=()=>void initialize(),timer=setInterval(()=>void checkAccess(),5000);window.addEventListener('qiyan:auth-changed',changed);window.addEventListener('popstate',changed);return()=>{fence.current.invalidate();listGate.current.invalidate();authGate.current.invalidate();api.current=null;clearInterval(timer);window.removeEventListener('qiyan:auth-changed',changed);window.removeEventListener('popstate',changed);};},[pageId]);
 useEffect(()=>{if(error)alert.current?.focus();},[error]);
 useEffect(()=>{const changed=e=>{const next=e.detail;if(account.current&&next?.status!=='checking'&&(!next?.authenticated||next.id!==account.current))clear('真实账号已切换或会话失效，已清除上一账号的私有内容；请重新核对。');};window.addEventListener('qiyan:user-change',changed);return()=>window.removeEventListener('qiyan:user-change',changed);},[]);
 return <Shell active="科研资产" hero={{title:pageId==='a01'?'我的方法资产候选':'方法资产候选详情',breadcrumb:'科研资产 › 方法资产候选',subtitle:'私有草稿 · 历史证据与复用准备，不是正式资产。'}}>
  <div className="content stack wf-content asset-draft-workspace method-assets-workspace">
   <p className="asset-notice">{profile?profile.displayName+' · '+profile.username:'正在核对真实身份'} · 仅本人本Study候选；管理员也不越权读取他人草稿。</p>
   {loading&&<p role="status">正在读取方法资产…</p>}{error&&<p ref={alert} tabIndex={-1} role="alert" className="asset-error">{error}</p>}
   {!profile&&!loading&&<div className="asset-actions"><Button onClick={()=>void initialize()}>重新核对会话与授权</Button><a href="/pages/p003/">前往真实登录</a></div>}
   {profile&&route.current&&<>
    {!route.current.assetId&&<a href={'/pages/a01/?'+new URLSearchParams({...route.current.scope,assetDrafts:'1'})}>核对前序本人候选（只读往返）</a>}
    {!route.current.assetId&&<><nav className="asset-actions" aria-label="方法候选导航"><Button disabled={listing} loading={listing} onClick={()=>void list()}>刷新方法候选列表</Button><a href="/pages/k01/">返回知识资料</a></nav><Card title="本人本研究方法候选列表"><p>已加载 {listIssue?.state==='invalid'?0:items.length} 项，均来自当前方法报告；不代表已共享。</p>{listIssue&&<p role="status">列表当前未核实；{listIssue.state==='invalid'?'校验失败的摘要已隐藏':'下方仅是上次读取摘要，不保证当前有效'}，请刷新重新核对。</p>}{!items.length&&!listing&&!listIssue&&<p role="status">尚无方法候选。请从本人方法报告核对当前版本后形成候选。</p>}<ul className="asset-list">{(listIssue?.state==='invalid'?[]:items).map(row=><li key={row.id}><h3>{row.title}</h3><p>v{row.version} · {listIssue?'上次读取摘要，当前未核实':row.sourceStatus==='current'?'来源有效':'来源已变化，仅历史核对'} · 派生层数 {row.depth}/8</p><p className="asset-meta">根报告 {row.reportId} · v{row.reportVersionNo}</p><a href={makeCrfMethodAssetUrl('a02',route.current.scope,row.id)} aria-label={'查看方法候选 '+row.id}>查看方法候选与复用准备</a></li>)}</ul>{next&&!listIssue&&<Button disabled={listing} loading={listing} onClick={()=>void list(true)}>加载更多方法候选</Button>}</Card></>}
    {asset&&<CrfMethodAssetDetail key={profile.accountId+':'+asset.id+':'+token.current} initial={asset} api={api.current} scope={route.current.scope} initialVersion={route.current.versionNo} onRestricted={clear} onReadTarget={readTarget} probeIssue={probeIssue} onReadValidated={()=>setProbeIssue(null)}/>}
   </>}
  </div>
 </Shell>;
}
