import React,{useEffect,useRef,useState} from 'react';
import {Shell} from './Shell.jsx';
import {Button,Card} from './Components.jsx';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
import {readCatalogAssetLocation,assertCatalogAssetDetail,createCatalogSelectionFence,makeCatalogAssetUrl} from '../../src/research-assets-catalog-session.js';
import {researchAssetReadMessage,researchAssetIdentityChanged,readResearchAssetIdentity} from '../../src/research-assets-session.js';
import ResearchAssetCatalogDetail from './ResearchAssetCatalogDetail.jsx';
import './research-assets-detail.css';
export default function ResearchAssetCatalogReadWorkspace(){
 const[state,setState]=useState({status:'loading'}),[attempt,setAttempt]=useState(0),fence=useRef(createCatalogSelectionFence()),current=useRef(null),pending=useRef(null),boundary=useRef(false);
 let route;try{route=readCatalogAssetLocation('a02',location.search);}catch{}
 useEffect(()=>{
  let active=true,probing=false;const token=fence.current.begin(),observation={latest:null};pending.current=observation;setState(s=>s.asset?{...s,status:'paused'}:{status:'loading'});boundary.current=false;
  const valid=()=>active&&fence.current.current(token);
  async function read(){
   if(probing)return;probing=true;
   try{
    if(!route)throw Object.assign(new Error('无效资产入口。'),{status:404});
    const user=await readResearchAssetIdentity({read:async()=>{
     const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
     if(!response.ok)throw Object.assign(new Error('当前身份无法核对。'),{status:response.status});return response.json();
    },isCurrent:valid,latestIdentity:()=>observation.latest});
    if(!user||!valid())return;current.current=user;pending.current=null;
    const api=createAssetCatalogClient({user,scope:route.scope}),value=assertCatalogAssetDetail(await api.get('/research-assets/catalog/'+route.assetId+'/versions/'+route.versionNo),route);
    if(valid()){boundary.current=true;setState({status:'ready',asset:value,user});}
   }catch(e){if(valid()){boundary.current=false;setState(s=>![401,403,404].includes(e.status)&&s.asset?{...s,status:'paused',message:researchAssetReadMessage(e)}:{status:'error',message:researchAssetReadMessage(e),needsLogin:e.status===401});}}finally{probing=false;}
  }
  void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},5000);
  const identity=e=>{if(pending.current&&e.detail?.status!=='checking')pending.current.latest=e.detail;if(researchAssetIdentityChanged(current.current,e.detail)){boundary.current=false;fence.current.invalidate();current.current=null;setState({status:'error',message:'账号或会话权限已变化，请重新打开资产。'});}};
  const refresh=()=>setAttempt(n=>n+1);window.addEventListener('qiyan:user-change',identity);window.addEventListener('qiyan:auth-changed',refresh);window.addEventListener('popstate',refresh);
  return()=>{active=false;boundary.current=false;fence.current.invalidate();pending.current=null;clearInterval(timer);window.removeEventListener('qiyan:user-change',identity);window.removeEventListener('qiyan:auth-changed',refresh);window.removeEventListener('popstate',refresh);};
 },[attempt]);
 return <Shell active="科研资产" className="research-asset-page" hero={{breadcrumb:'科研资产 › 资产详情',title:'资产详情',subtitle:'核对固定版本、来源与当前可用范围。'}}><div className="content stack research-assets-detail"><div className="tag-row"><a href={route?.returnTo??'/pages/a01/'}>返回科研资产</a>{state.user&&<span>{state.user.displayName}</span>}</div>
  {state.status==='loading'?<Card><p role="status" className="form-block">正在读取固定版本…</p></Card>:state.status==='error'?<Card><div className="form-block"><p role="alert">{state.message}</p><Button onClick={()=>setAttempt(n=>n+1)}>重新读取</Button>{state.needsLogin&&<a href={'/pages/p003/?returnTo='+encodeURIComponent(location.pathname+location.search)}>前往登录</a>}</div></Card>:<>{state.status==='paused'&&<Card><div className="form-block"><p role="alert">{state.message??'正在核对固定版本…'}</p><Button onClick={()=>setAttempt(n=>n+1)}>重新读取</Button></div></Card>}<ResearchAssetCatalogDetail key={state.asset.id+':'+state.asset.version} asset={state.asset} user={state.user} api={createAssetCatalogClient({user:state.user,scope:route.scope})} scope={route.scope} returnTo={route.returnTo} initialTab={route.detailTab} blocked={state.status!=='ready'} canProceed={()=>boundary.current} onAccessLost={e=>{boundary.current=false;fence.current.invalidate();setState({status:'error',message:researchAssetReadMessage(e),needsLogin:e.status===401});}} onSaved={r=>location.assign(makeCatalogAssetUrl(route.scope,r.assetId,r.version,route.returnTo))}/></>}
 </div></Shell>;
}
