import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createResearchProjectsClient} from '../../src/research-projects-session.js';
import {acceptStudyDataContext,studyDataReturnHref} from '../../src/study-data-navigation.js';
import {Button} from './Components.jsx';
import './study-data-ai-context.css';

export function useStudyDataAiContext({user,route,paused}){
 const client=useMemo(()=>createResearchProjectsClient(),[]),epoch=useRef(0),[attempt,setAttempt]=useState(0),[state,setState]=useState({key:'',kind:'none'});
 const requested=route.kind==='hub'&&Boolean(route.uploadStudyId);
 const key=[user?.tenantId,user?.accountId,user?.authVersion,requested?route.uploadStudyId:'',route.uploadSubjectId,route.uploadVisitId].join(':');
 const latest=useRef(key);latest.current=key;
 useEffect(()=>{
  const turn=++epoch.current;client.invalidate();
  if(!requested){setState({key,kind:'none'});return;}
  if(paused||!user?.accountId){setState({key,kind:'loading'});return;}
  setState({key,kind:'loading'});
  const context={studyId:route.uploadStudyId,...(route.uploadSubjectId?{subjectId:route.uploadSubjectId}:{}),...(route.uploadVisitId?{visitId:route.uploadVisitId}:{})};
  void(async()=>{try{
   const study=await client.request('/research-studies/'+context.studyId);
   const subject=context.subjectId?await client.request('/research-studies/'+context.studyId+'/subjects/'+context.subjectId):undefined;
   const data=acceptStudyDataContext(context,study,subject);
   if(epoch.current===turn&&latest.current===key)setState({key,kind:'ready',context,data});
  }catch(e){if(epoch.current===turn&&latest.current===key)setState({key,kind:'error',message:e.message});}})();
  return()=>{++epoch.current;client.invalidate();};
 },[client,key,requested,paused,attempt]);
 const view=state.key===key&&!paused?state:{key,kind:requested?'loading':'none'};
 return{...view,requested,blocked:requested&&view.kind!=='ready',refresh:()=>setAttempt(x=>x+1)};
}
export default function StudyDataAiContext({state}){
 if(!state.requested)return null;
 return <section className="study-data-ai-context" aria-label="本次采集归属" aria-busy={state.kind==='loading'}>
  {state.kind==='ready'?<><p><strong>本次采集</strong>：{state.data.studyName}{state.data.subjectCode?' · '+state.data.subjectCode:''}{state.data.visitName?' · '+state.data.visitName:''}</p><p>批量表格按文件中的被试和访视核对。</p><a href={studyDataReturnHref(state.context)}>{state.context.visitId?'返回本次访视':state.context.subjectId?'返回被试数据':'返回研究数据'}</a></>:state.kind==='error'?<><p role="alert">本次采集归属暂时无法核对。{state.message}</p><Button onClick={state.refresh}>重新核对采集归属</Button></>:<p role="status">正在核对本次研究与采集归属…</p>}
 </section>;
}
