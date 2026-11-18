import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
const noop=()=>{};
export function StudyTaskContext({task,busy=false,unknown=false,loader,onSave=noop,onDirty=noop,onError=noop}){
 const [choices,setChoices]=useState({items:[],nextCursor:null}),[draft,setDraft]=useState(''),[q,setQ]=useState(''),[applied,setApplied]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const abort=useRef(null),source=task?.context,allowed=Boolean(task?.capabilities.canLink);
 useEffect(()=>{onDirty(Boolean(draft));return()=>onDirty(false);},[draft,onDirty]);
 async function load(cursor){
  if(!allowed||!loader)return;
  abort.current?.abort();const controller=new AbortController();abort.current=controller;setLoading(true);setError('');
  try{const page=await loader({kind:'synthetic_crf_record',q:applied,...(cursor?{cursor}:{})},controller.signal);if(controller.signal.aborted)return;setChoices(old=>cursor?{...page,items:[...old.items,...page.items]}:page);}
  catch(e){if(e.name!=='AbortError'){setError(e.message);if([401,403].includes(e.status))onError(e);}}
  finally{if(!controller.signal.aborted)setLoading(false);}
 }
 useEffect(()=>{void load();return()=>abort.current?.abort();},[allowed,loader,applied]);
 if(!task)return <p>请选择任务核对其关联上下文。</p>;
 return <div className="s08-context">
  {source?.status==='current'?<div><h3>{source.label}</h3><p>{source.kind==='synthetic_crf_record'?'合成CRF记录':'正式访视'} · {source.subjectLabel} · {source.visitLabel??''} · 固定版本 v{source.sourceVersion}</p>
   {Number.isSafeInteger(source.responseRevision)&&<p>答案修订：{source.responseRevision}；仅核对版本，不在此展示或修改答案。</p>}

   {source.navigation?.href?<a href={source.navigation.href}>打开关联访视／记录</a>:<p>{source.navigation?.reason}</p>}
  </div>:<p>{source?.status==='restricted'?source.message:'尚未关联访视或合成记录。'}</p>}
  <p>关联或任务完成不代表访视完成、数据批准或锁库；仅可关联本人的合成CRF记录，不操作临床数据。</p>
  {allowed&&<form onSubmit={e=>{e.preventDefault();if(!draft)return;const picked=choices.items.find(item=>item.sourceId===draft);if(draft==='none')onSave({kind:'none'},task);else if(picked)onSave(picked.context,task);}}>
   <div className="wf-toolbar"><label>查找关联记录包<input value={q} maxLength={120} disabled={busy||unknown} onChange={e=>setQ(e.target.value)}/></label><Button disabled={busy||unknown||loading} onClick={()=>{setDraft('');q===applied?void load():setApplied(q);}}>检索关联记录</Button></div>
   {loading&&<p role="status">正在核对真实记录及当前来源…</p>}{error&&<p role="alert">{error}</p>}
   {choices.availability==='restricted'&&<p>当前资料读取授权不足，不能因任务管理权限扩大记录范围。</p>}
   {choices.invalidRecords>0&&<p>本页有{choices.invalidRecords}项记录的来源、父版本或授权已变化，未作为可关联选项。</p>}
   {!loading&&choices.availability==='available'&&!choices.items.length&&<p>当前筛选没有可关联的本人记录，请调整检索或核对原资料。</p>}
   <div className="wf-field"><label htmlFor={'s08-context-'+task.id}>选择关联记录</label><select id={'s08-context-'+task.id} value={draft} disabled={busy||unknown||loading} onChange={e=>setDraft(e.target.value)}><option value="">请选择，选择后需确认</option>{source&&source.kind!=='none'&&<option value="none">解除当前关联</option>}{choices.items.map(item=><option key={item.sourceId} value={item.sourceId}>{item.label} · {item.subjectLabel} · {item.visitLabel} · v{item.sourceVersion}</option>)}</select></div>
   <div className="wf-toolbar"><Button primary type="submit" disabled={!draft||loading||unknown} loading={busy}>确认关联</Button><Button disabled={!draft||busy||unknown} onClick={()=>setDraft('')}>取消关联修改</Button>{choices.nextCursor&&<Button disabled={busy||unknown||loading} onClick={()=>void load(choices.nextCursor)}>读取更多关联记录</Button>}</div>
  </form>}
 </div>;
}
