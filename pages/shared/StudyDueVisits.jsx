import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {captureUrl} from '../../src/formal-capture-session.js';
import {getPlatformUser} from '../../src/platform-user.js';
import {createResearchProjectsClient} from '../../src/research-projects-session.js';
import {createStudyDueVisitsSession,dueVisitUrl,formatDueVisitDate} from '../../src/study-due-visits-session.js';
import './study-due-visits.css';
const attention={due:'今日待访视',overdue:'逾期',in_progress:'进行中'};
export default function StudyDueVisits({studyId,enabled=true}){
 const [state,setState]=useState({kind:'idle',busy:false,items:[],nextCursor:null,day:null,message:''});
 const latest=useRef(null),alive=useRef(true),client=useRef(null),session=useRef(null);latest.current={studyId,enabled};
 function currentScope(){const p=latest.current,user=getPlatformUser(),query=new URLSearchParams(location.search);return p.enabled&&user.authenticated&&query.get('researchStudy')==='1'&&query.get('studyId')===p.studyId?{accountId:user.id,authVersion:user.authVersion,studyId:p.studyId,url:location.pathname+location.search}:null;}
 if(!client.current)client.current=createResearchProjectsClient();
 if(!session.current)session.current=createStudyDueVisitsSession({request:(...args)=>client.current.request(...args),scope:currentScope,onChange:value=>{if(alive.current)setState(value);}});
 const url=location.pathname+location.search;
 useEffect(()=>{
  alive.current=true;
  function refresh(){const scope=currentScope();if(session.current.setContext(scope))client.current.invalidate();if(scope&&document.visibilityState==='visible')void session.current.load();}
  window.addEventListener('qiyan:user-change',refresh);window.addEventListener('focus',refresh);window.addEventListener('popstate',refresh);document.addEventListener('visibilitychange',refresh);refresh();
  return()=>{alive.current=false;session.current.invalidate();client.current.invalidate();window.removeEventListener('qiyan:user-change',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('popstate',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[studyId,enabled,url]);
 const actual=currentScope(),visible=actual&&state.scope&&['accountId','authVersion','studyId','url'].every(key=>actual[key]===state.scope[key]);
 const shown=visible?state:{kind:actual?'loading':'restricted',busy:!!actual,items:[],nextCursor:null,day:null,message:''};
 return <section id="study-due-visits" tabIndex={-1} style={{scrollMarginTop:'calc(var(--layout-topbar) + 16px)'}} className="card mini-list updates study-due-visits" aria-label="今日待访视" aria-busy={shown.busy}>
  <div className="card-title"><h2>今日待访视</h2></div>
  {shown.day&&<p className="study-due-visits-day">{shown.day} · 北京时间</p>}
  {shown.kind==='error'?<div role="alert"><p>{shown.message}</p><Button disabled={shown.busy} onClick={()=>void session.current.load()}>重新读取待访视</Button></div>:shown.kind==='restricted'?<p>当前账号或研究范围已变化，请重新核对。</p>:<>
   {shown.busy&&<p role="status">{shown.message||(shown.loadingMore?'正在读取更多待访视…':'正在读取今日待访视…')}</p>}
   {shown.items.length>0&&<ul className="study-due-visits-list">{shown.items.map(row=><li key={row.visitId}>
    <div><strong>{row.subject.subjectId}</strong><span>{row.visitPlan.name}</span><span>{row.windowStart&&row.windowEnd?'窗口：'+formatDueVisitDate(row.windowStart)+' 至 '+formatDueVisitDate(row.windowEnd):'安排日期：'+formatDueVisitDate(row.windowStart??row.targetDate)}</span><span>{attention[row.attention]}</span></div>
    <a href={dueVisitUrl(studyId,row.visitId)}>进入本次访视</a>
   </li>)}</ul>}
   {shown.kind==='ready'&&!shown.items.length&&<p className="rs-empty">今日暂无待访视安排。</p>}
   {shown.kind==='ready'&&<div className="study-due-visits-actions">{shown.nextCursor&&<Button disabled={shown.busy} onClick={()=>void session.current.more()}>查看更多待访视</Button>}<Button disabled={shown.busy} onClick={()=>void session.current.load()}>刷新待访视</Button><a href={captureUrl('s09',studyId)}>查看全部访视</a></div>}
  </>}
 </section>;
}
