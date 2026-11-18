import React,{useEffect,useRef,useState} from 'react';
import {Button,Card} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {createCaptureClient} from '../../src/formal-capture-session.js';
import {readFullStudyStage,createFullStudyCommands} from '../../src/full-study-ui-session.js';
export default function FullStudySimulationStage({route,session,onDirty=()=>{}}){
 const [state,setState]=useState(null),[allowed,setAllowed]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[confirm,setConfirm]=useState(false),seq=useRef(0),commands=useRef(null),permissionClient=useRef(null);
 if(!permissionClient.current)permissionClient.current=createCaptureClient();
 if(!commands.current)commands.current=createFullStudyCommands({request:(...args)=>session.request(...args),onPending:setPending});
 async function read(){const token=++seq.current;try{const value=await readFullStudyStage((...args)=>session.request(...args),(...args)=>permissionClient.current.request(...args),route.studyId);if(token!==seq.current)return;setState(value.simulation);setAllowed(value.canAdvance);}catch(e){if(token===seq.current){setState(null);setAllowed(false);setError(e.message);}}}

 useEffect(()=>{commands.current.clear();setState(null);setAllowed(false);if(session.verified)void read();return()=>{seq.current++;permissionClient.current.invalidate();};},[route.studyId,session.actor,session.verified]);
 useEffect(()=>{onDirty('simulation',busy||!!pending);return()=>onDirty('simulation',false);},[busy,pending]);
 async function advance(retry=false){if(!allowed||!session.verified||busy)return;const token=++seq.current;setBusy(true);setError('');try{const value=retry?await commands.current.retry():await commands.current.send('/research-studies/'+route.studyId+'/simulation/advance',{expectedStage:state.stageIndex});if(token!==seq.current)return;setState(value.simulation??value);await session.load();}catch(e){if(token===seq.current)setError(e.message);}finally{if(token===seq.current)setBusy(false);}}
 if(!state)return error?<p role="alert">{error}</p>:null;
 return <Card title="模拟访视阶段"><p>合成模拟 · {state.stage} · 逻辑日期 {state.logicalDate}（{state.timezone}）</p><p>仅推进已登记模拟研究的逻辑日期，真实认证、审计和记录时间不变；当前适用访视完成后才能进入下一阶段。</p>{error&&<p role="alert">{error}</p>}{pending?<Button disabled={busy||!session.verified} onClick={()=>void advance(true)}>以原请求核对阶段推进</Button>:allowed&&state.stageIndex<3&&<Button primary disabled={busy||session.blocked||!state.ready} onClick={()=>setConfirm(true)}>推进下一模拟阶段</Button>}{confirm&&<ConfirmDialog title="推进模拟访视阶段？" confirmLabel="确认推进" onCancel={()=>setConfirm(false)} onConfirm={()=>{setConfirm(false);void advance();}}><p>系统会核对当前阶段适用访视与固定规则；未完成或权限变化将停止推进。</p></ConfirmDialog>}</Card>;
}
