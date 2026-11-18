import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import {fetchMyResearchReport} from '../../src/my-research-report-preview.js';

export default function PersonalReportPreview({draft,onAccessLost}){
 const [open,setOpen]=useState(false),[state,setState]=useState({kind:'idle'}),controller=useRef(null),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;controller.current?.abort();},[draft.id,draft.version]);
 async function read(){controller.current?.abort();controller.current=new AbortController();const n=++sequence.current;setOpen(true);setState({kind:'loading'});try{const value=await fetchMyResearchReport(draft,{signal:controller.current.signal});if(n===sequence.current)setState({kind:'ready',value});}catch(e){if(n===sequence.current&&e.name!=='AbortError'){setState({kind:'error',message:e.message});if(e.status===401)onAccessLost?.(e);}}}
 function close(){sequence.current++;controller.current?.abort();setOpen(false);setState({kind:'idle'});}
 return <div className="personal-report-preview"><Button onClick={()=>open?close():void read()} aria-expanded={open}>{open?'收起报告':'阅读报告'}</Button>
  {open&&<section aria-label="报告草稿只读预览">
   {state.kind==='loading'&&<p role="status">正在读取报告与来源…</p>}
   {state.kind==='error'&&<p role="alert">{state.message} <Button onClick={()=>void read()}>重新读取报告</Button></p>}
   {state.kind==='ready'&&<><p>草稿 v{state.value.version} · 未审批 · {state.value.sourceStatus==='current'?'来源与当前记录匹配':'历史快照，不能视为当前结论'}{state.value.currentVersion!==state.value.version?' · 已有更新版本':''}</p>
    <div className="personal-report-reading"><Markdown allowImages={false} headingOffset={2}>{state.value.contentMd}</Markdown></div>
    <details><summary>查看原始来源与版本</summary><ul>{state.value.sourceRows.map((s,index)=><li key={index}>{s.sourceType} · {s.sourceId} · {s.sourceVersion??'固定记录'}</li>)}</ul></details>
   </>}
  </section>}
 </div>;
}
