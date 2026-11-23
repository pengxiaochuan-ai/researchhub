import React,{useEffect,useRef,useState} from 'react';
import {fetchPublicActivity,activityDate} from '../../src/public-activity.js';
import {Button} from './Components.jsx';
import './public-activity.css';

export function usePublicActivity({hubKey='lingshu-xinyu',limit=6}={}){
 const [state,setState]=useState({kind:'loading'}),[retry,setRetry]=useState(0),epoch=useRef(0);
 const scope=hubKey+'\0'+limit;
 useEffect(()=>{
  let controller;
  const refresh=()=>{
   controller?.abort();controller=new AbortController();const request=++epoch.current;setState({kind:'loading',scope});
   fetchPublicActivity({hubKey,limit,signal:controller.signal}).then(data=>{if(request===epoch.current)setState({kind:'ready',scope,data});}).catch(error=>{if(request===epoch.current&&error.name!=='AbortError')setState({kind:'error',scope});});
  };
  const visible=()=>{if(document.visibilityState==='visible')refresh();};
  refresh();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
  return()=>{epoch.current++;controller?.abort();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
 },[hubKey,limit,retry]);
 return{state:state.scope===scope?state:{kind:'loading'},onRetry:()=>setRetry(value=>value+1)};
}
export function PublicActivityList({state,onRetry}){
 if(state.kind==='loading')return <p className="public-activity-state" role="status">正在读取领域动态…</p>;
 if(state.kind!=='ready')return <div className="public-activity-state" role="alert"><p>领域动态暂时无法读取。</p><Button onClick={onRetry}>重试</Button></div>;
 const {data}=state,partial=data.status==='partial';
 return <>
  {partial&&<div className="public-activity-state" role="status"><p>部分动态暂时无法读取。</p><Button onClick={onRetry}>重试</Button></div>}
  {data.items.length?<ul className="public-activity-list" tabIndex={0} aria-label="公开领域动态">{data.items.map(item=><li key={item.id}>
   {item.kind==='content'&&item.href?<a href={item.href}>{item.title}</a>:<strong>{item.title}</strong>}
   {item.summary&&<p>{item.summary}</p>}<time dateTime={item.day}>{activityDate(item.day,data.calculatedAt)}</time>
  </li>)}</ul>:<p className="public-activity-state" role="status">{partial?'暂无可展示的新增动态。':'暂无公开领域动态。'}</p>}
 </>;
}
export default function PublicActivity(props){const activity=usePublicActivity(props);return <div className="public-activity"><PublicActivityList {...activity}/></div>;}
