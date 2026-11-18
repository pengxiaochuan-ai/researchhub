import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createAuthClient} from '../../src/auth-session.js';
import {realEntryLinks} from '../../src/real-entry-links.js';
import HubAgentPanel from './HubAgentPanel.jsx';
import './real-workspace-entry.css';
import {RealAssetEntry,RealDesignEntry} from './RealEntryLayouts.jsx';

const headings={design:['选择已授权 Study',"选择已授权研究，继续本人的草稿。"],assets:['选择已授权 Study','从当前已授权 Study 查看本人私有候选，不代表共享或发布。'],ai:['选择能力入口',"请选择资料问答、研究设计或资产候选。"]};
export default function RealWorkspaceEntry({kind}){
  const client=useMemo(()=>createAuthClient({tenantSlug:import.meta.env.VITE_AUTH_TENANT_SLUG}),[]);
  const [state,setState]=useState({kind:'loading'}),[attempt,setAttempt]=useState(0),sequence=useRef(0);
  useEffect(()=>{let active=true;const read=()=>{const current=++sequence.current;setState({kind:'loading'});client.me().then(user=>{if(active&&current===sequence.current)setState(user?{kind:'ready',user}:{kind:'signed-out'});}).catch(error=>{if(active&&current===sequence.current)setState({kind:'error',message:error.message});});};
    const onFocus=()=>{if(document.visibilityState==='visible')read();};window.addEventListener('focus',onFocus);window.addEventListener('qiyan:user-change',read);read();return()=>{active=false;sequence.current++;window.removeEventListener('focus',onFocus);window.removeEventListener('qiyan:user-change',read);};},[client,attempt]);
  const [title,intro]=headings[kind]??headings.design;
  const links=state.kind==='ready'?realEntryLinks(state.user,kind):[];
  if(kind==='assets')return <RealAssetEntry state={state} links={links} retry={()=>setAttempt(x=>x+1)}/>;
  if(kind==='design')return <RealDesignEntry state={state} links={links} retry={()=>setAttempt(x=>x+1)}/>;
  return <main className="platform-main real-workspace-entry"><div className="real-entry-content"><section className="real-entry-card"><h2>{title}</h2><p>{intro}</p>
    {state.kind==='loading'?<p role="status">正在核验当前账号和 Study 授权…</p>:state.kind==='signed-out'?<p role="status">请先登录；这里不会显示演示账号或其他人的研究。</p>:state.kind==='error'?<p role="alert">{state.message}</p>:<p>当前账号：{state.user.displayName} · {state.user.username}{state.user.tenantName?' · '+state.user.tenantName:''}</p>}
    {state.kind==='signed-out'?<a className="real-entry-action" href={'/pages/p003/?returnTo='+encodeURIComponent('/pages/'+(kind==='design'?'q02':kind==='assets'?'a01':'ai01')+'/')}>前往登录</a>:state.kind==='error'?<button type="button" onClick={()=>setAttempt(x=>x+1)}>重新核验</button>:null}
  </section>
  {state.kind==='ready'&&<section className="real-entry-card"><h2>{kind==='ai'?"可用能力入口":'当前授权 Study'}</h2>{links.length?<ul className="real-entry-list">{links.map(item=><li key={item.url}><div><strong>{item.description}</strong><p>{item.label}</p></div><a href={item.url} aria-label={`${item.label}：${item.description}`}>进入 →</a></li>)}</ul>:<p role="status">当前账号尚无可进入的私有 Study。注册不会自动授予私有研究权限；请等待负责人邀请。</p>}{kind==='ai'&&<p className="real-entry-note">AI仅使用获准来源，调用受账号及租户使用额度限制。</p>}</section>}
  {state.kind==='ready'&&kind==='ai'&&<HubAgentPanel user={state.user}/>}
  <a className="real-entry-back" href="/pages/p01/">返回我的工作台</a></div></main>;
}
