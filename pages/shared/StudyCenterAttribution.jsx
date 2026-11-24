import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';

const labels={pending:'待确认',approved:'已确认',superseded:'历史归属'};
const label=center=>center?center.name+'（'+center.code+'）':'';

export default function StudyCenterAttribution({studyId,view,disabled,request,onRefresh}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [unknown,setUnknown]=useState(false),[formVersion,setFormVersion]=useState(0);
 const flight=useRef(null);
 useEffect(()=>()=>{flight.current=null;},[]);
 const enrollmentId=view?.enrollment?.id;
 if(!enrollmentId)return null;
 const correction=view.centerCorrections;
 const options=correction?.options??[],history=correction?.items??[];
 const eligible=options.filter(center=>center.id!==view.enrollmentCenter?.id);
 const hasPending=history.some(item=>item.status==='pending');
 const locked=disabled||busy||unknown;

 async function submit(path,body,message){
  if(locked||flight.current)return;
  const token=Symbol();
  flight.current=token;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/research-studies/'+encodeURIComponent(studyId)+'/enrollments/'+encodeURIComponent(enrollmentId)+'/center-corrections'+path,{method:'POST',body});
   if(flight.current!==token)return;
   setNotice(message);setFormVersion(value=>value+1);
   if(await onRefresh()!==true&&flight.current===token)setUnknown(true);
  }catch(cause){
   if(flight.current!==token)return;
   setUnknown(!!cause.unknown);
   setError(cause.unknown?'更正结果待核对，请重新读取入组记录。':cause.message);
  }finally{
   if(flight.current===token){flight.current=null;setBusy(false);}
  }
 }
 async function refresh(){
  if(busy||disabled||flight.current)return;
  const token=Symbol();
  flight.current=token;
  setBusy(true);setError('');
  try{
   if(await onRefresh()===true&&flight.current===token)setUnknown(false);
   else if(flight.current===token)setError('暂时无法重新读取入组记录。');
  }finally{
   if(flight.current===token){flight.current=null;setBusy(false);}
  }
 }

 if(!view.enrollmentCenter&&!correction)return null;
 return <section aria-label="入组中心" aria-busy={busy}>
  <p>入组中心：{label(view.enrollmentCenter)||'尚未归属'}</p>
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert" className="ep-error">{error}</p>}
  {unknown&&<Button disabled={disabled||busy} onClick={()=>void refresh()}>重新读取入组记录</Button>}
  {history.length>0&&<details open={hasPending}>
   <summary>中心更正记录</summary>
   <ul>{history.map(item=>{
    const target=item.center??options.find(center=>center.id===item.centerId);
    return <li key={item.version}>
     {label(target)||'所选中心'} · 第 {item.version} 次 · {labels[item.status]||'状态待核对'}
     {item.reason&&<p>依据：{item.reason}</p>}
     {correction.canApprove&&item.status==='pending'&&<Button disabled={locked} onClick={()=>void submit('/'+encodeURIComponent(item.version)+'/approve',{},'已确认入组中心更正。')}>确认本次更正</Button>}
    </li>;
   })}</ul>
  </details>}
  {correction?.canSubmit&&!hasPending&&eligible.length>0&&<details key={formVersion}>
   <summary>申请更正入组中心</summary>
   <form onSubmit={event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget),centerId=form.get('centerId'),reason=form.get('reason').trim();
    if(!reason||!eligible.some(center=>center.id===centerId)){setError('请选择更正后的中心并填写更正依据。');return;}
    void submit('',{centerId,reason},'更正申请已提交，等待确认。');
   }}>
    <label className="ep-label">更正后的中心<select aria-label="更正后的中心" name="centerId" disabled={locked} required>
     <option value="">请选择研究中心</option>
     {eligible.map(center=><option key={center.id} value={center.id}>{label(center)}</option>)}
    </select></label>
    <label className="ep-label">更正依据<textarea name="reason" maxLength="500" disabled={locked} required/></label>
    <Button type="submit" disabled={locked}>提交中心更正</Button>
   </form>
  </details>}
 </section>;
}
