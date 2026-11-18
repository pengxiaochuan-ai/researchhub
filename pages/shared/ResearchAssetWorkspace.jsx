import React,{useEffect,useRef,useState} from 'react';
import {Shell} from './Shell.jsx';
import {Button,Card} from './Components.jsx';
import {createKnowledgeClient} from '../../src/knowledge-session.js';
import {createDesignReadFence} from '../../src/research-design-session.js';
import {readResearchAssetLocation,researchAssetReadMessage,researchAssetIdentityChanged,readResearchAssetResponse,readResearchAssetIdentity} from '../../src/research-assets-session.js';
import ResearchAssetDetail from './ResearchAssetDetail.jsx';
import './research-assets-detail.css';

export default function ResearchAssetWorkspace(){
 const [asset,setAsset]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[needsLogin,setNeedsLogin]=useState(false);
 const fence=useRef(createDesignReadFence()),reads=useRef(createDesignReadFence()),identityPending=useRef(null),active=useRef(null),alert=useRef(null);
 function clear(message='',retainIdentity=false){
  fence.current.invalidate();reads.current.invalidate();identityPending.current=null;active.current=null;setAsset(null);if(!retainIdentity)setProfile(null);setLoading(false);setNeedsLogin(false);setError(message);
 }
 function failed(e,token){if(fence.current.current(token)){clear(researchAssetReadMessage(e),e.status!==401);setNeedsLogin(e.status===401);}}
 async function initialize(){
  clear();const token=fence.current.begin(),observation={latest:null};identityPending.current=observation;setLoading(true);
  try{
   let route;try{route=readResearchAssetLocation('a02',location.search);}catch(e){throw Object.assign(e,{status:404});}
   if(!import.meta.env.VITE_AUTH_TENANT_SLUG)throw Error('资产服务暂不可用，请稍后重试。');
   const user=await readResearchAssetIdentity({read:async()=>{
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Object.assign(Error('当前身份无法核对。'),{status:response.status});
    return response.json();
   },isCurrent:()=>fence.current.current(token),latestIdentity:()=>observation.latest});
   if(!user)return;setProfile(user);
   const group=user.studyGroups?.find(g=>g.id===route.scope.studyGroupId),project=group?.researchProjects?.find(p=>p.id===route.scope.researchProjectId);
   if(!project||!group.role?.menuPermissions?.some(p=>['*','artifacts'].includes(p))||!group.role?.buttonPermissions?.some(p=>['*','artifact.read'].includes(p)))throw Object.assign(Error('当前账号没有此研究的资产读取权限。'),{status:403});
   const api=createKnowledgeClient({scope:()=>route.scope,onAccessLost:e=>failed(e,token)});
   const path='/research-assets/'+route.assetId+(route.versionNo?'/versions/'+route.versionNo:'');
   active.current={token,route,user,api,path,probing:false};identityPending.current=null;
   const requestToken=reads.current.begin();
   await readResearchAssetResponse({read:()=>api.get(path),route,accountId:user.accountId,isCurrent:()=>fence.current.current(token)&&reads.current.current(requestToken),publish:setAsset});
  }catch(e){failed(e,token);}finally{if(fence.current.current(token))setLoading(false);}
 }
 async function probe(){
  const current=active.current;if(!current||current.probing)return;current.probing=true;
  const requestToken=reads.current.begin();
  try{await readResearchAssetResponse({read:()=>current.api.get(current.path),route:current.route,accountId:current.user.accountId,isCurrent:()=>fence.current.current(current.token)&&reads.current.current(requestToken),publish:setAsset});}catch(e){failed(e,current.token);}finally{current.probing=false;}
 }
 useEffect(()=>{
  void initialize();const refresh=()=>void initialize(),timer=setInterval(()=>void probe(),5000);
  const identity=e=>{if(identityPending.current&&e.detail?.status!=='checking')identityPending.current.latest=e.detail;if(researchAssetIdentityChanged(active.current?.user,e.detail))clear('账号或会话权限已变化，请重新打开资产。');};
  window.addEventListener('qiyan:auth-changed',refresh);window.addEventListener('popstate',refresh);window.addEventListener('qiyan:user-change',identity);
  return()=>{fence.current.invalidate();reads.current.invalidate();identityPending.current=null;active.current=null;clearInterval(timer);window.removeEventListener('qiyan:auth-changed',refresh);window.removeEventListener('popstate',refresh);window.removeEventListener('qiyan:user-change',identity);};
 },[]);
 useEffect(()=>{if(error)alert.current?.focus();},[error]);
 return <Shell active="科研资产" className="research-asset-page" hero={{breadcrumb:'科研资产 › 资产详情',title:'资产详情',subtitle:'核对资产的固定版本、用途与来源。'}}>
  <div className="content stack research-assets-detail">
   <div className="tag-row"><a href="/pages/a01/">返回科研资产</a>{profile&&<span>{profile.displayName} · 本人私有草稿</span>}</div>
   {loading&&<Card><p role="status" className="form-block">正在读取资产…</p></Card>}
   {error&&<Card><div className="form-block"><p role="alert" ref={alert} tabIndex={-1}>{error}</p><Button onClick={()=>void initialize()}>重新读取</Button>{needsLogin&&<a href="/pages/p003/">前往登录</a>}</div></Card>}
   {asset&&<ResearchAssetDetail key={asset.id+':'+asset.version} asset={asset} scope={active.current.route.scope}/>}
  </div>
 </Shell>;
}
