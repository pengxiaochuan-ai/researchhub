import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {useResearchProjectAccess} from './research-project-hooks.js';
import './study-centers.css';

const planLabels={draft:'草稿',pending:'待确认',pending_review:'待确认',approved:'已确认',active:'生效中',superseded:'已替代'};
const dateText=value=>typeof value==='string'?value.slice(0,10):'';
const centerLabel=center=>`${center.name}（${center.code}）`;

function CenterPlanForm({onSave,busy}){
 return <form className="center-fields" onSubmit={event=>{
  event.preventDefault();
  const form=new FormData(event.currentTarget);
  onSave({target:Number(form.get('target')),startDate:form.get('startDate'),
   ...(form.get('endDate')?{endDate:form.get('endDate')}:{}),reason:form.get('reason').trim()});
 }}>
  <label>目标人数<input name="target" type="number" min="1" step="1" required disabled={busy}/></label>
  <label>计划开始日<input name="startDate" type="date" required disabled={busy}/></label>
  <label>计划结束日<input name="endDate" type="date" disabled={busy}/></label>
  <label>录入或调整依据<input name="reason" maxLength="500" required disabled={busy}/></label>
  <Button type="submit" disabled={busy}>保存待确认计划</Button>
 </form>;
}

function CenterAccessForm({center,memberOptions,busy,onSave}){
 const [selected,setSelected]=useState('');
 const granted=new Set(center.memberAccountIds??[]);
 const member=memberOptions.find(item=>item.id===selected);
 return <form className="center-fields" onSubmit={event=>{
  event.preventDefault();
  if(member)onSave({accountId:member.id,active:!granted.has(member.id)});
 }}>
  <label>中心入组人员<select value={selected} onChange={event=>setSelected(event.target.value)} disabled={busy} required>
   <option value="">请选择课题成员</option>
   {memberOptions.map(item=><option value={item.id} key={item.id}>{item.displayName}{granted.has(item.id)?'（已获授权）':''}</option>)}
  </select></label>
  <Button type="submit" disabled={busy||!member}>{member&&granted.has(member.id)?'撤销中心入组权限':'授予中心入组权限'}</Button>
 </form>;
}

function CenterRow({center,memberOptions,permissions,busy,onCommand}){
 const plans=center.plans??[];
 const effectiveVersion=plans.find(plan=>plan.status==='approved')?.version;
 const hasPending=plans.some(plan=>['draft','pending','pending_review'].includes(plan.status));
 const endpoint='/'+encodeURIComponent(center.id);
 return <li className="center-row">
  <h3>{centerLabel(center)}</h3><p>{center.active?'已启用':'已停用'}</p>
  {plans.length>0?<ul className="center-plans">{plans.map(plan=><li key={plan.version}>
   <p><strong>计划第 {plan.version} 版</strong> · {plan.target} 人 · {plan.status==='approved'?(plan.version===effectiveVersion?'当前版本':'历史版本'):planLabels[plan.status]||'状态待核对'}</p>
   <p>{dateText(plan.startDate)}{plan.endDate?' 至 '+dateText(plan.endDate):'起，结束日待配置'}</p>
   {plan.reason&&<p>依据：{plan.reason}</p>}
   {permissions.approve&&['draft','pending','pending_review'].includes(plan.status)&&
    <Button disabled={busy} onClick={()=>onCommand(endpoint+'/plans/'+encodeURIComponent(plan.version)+'/approve','POST',{},'计划已确认。')}>确认该版本计划</Button>}
  </li>)}</ul>:<p>尚未配置中心目标。</p>}
  {permissions.configure&&<details>
   <summary>维护{centerLabel(center)}</summary>
   <form className="center-fields" onSubmit={event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    onCommand(endpoint,'PATCH',{name:form.get('name').trim(),active:form.get('active')==='enabled'},'中心信息已更新。');
   }}>
    <label>中心名称<input name="name" defaultValue={center.name} maxLength="120" required disabled={busy}/></label>
    <label>中心状态<select name="active" defaultValue={center.active?'enabled':'disabled'} disabled={busy}>
     <option value="enabled">启用</option><option value="disabled">停用</option>
    </select></label>
    <Button type="submit" disabled={busy}>保存中心信息</Button>
   </form>
   {center.active&&!hasPending&&<CenterPlanForm busy={busy} onSave={body=>onCommand(endpoint+'/plans','POST',body,'中心计划已保存，等待确认。')}/>}
   {memberOptions.length>0&&<CenterAccessForm center={center} memberOptions={memberOptions} busy={busy}
    onSave={body=>onCommand(endpoint+'/access','PUT',body,body.active?'已授予中心入组权限。':'已撤销中心入组权限。')}/>}
  </details>}
 </li>;
}

export default function StudyCenters({studyId,onCount}){
 const [state,setState]=useState({kind:'loading'});
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [reload,refresh]=useState(0),[formVersion,nextForm]=useState(0),[confirmationRequired,setConfirmationRequired]=useState(false);
 const flight=useRef(null),current=useRef(studyId);
 current.current=studyId;
 const access=useResearchProjectAccess(()=>{
  flight.current=null;
  setState({kind:'restricted'});
  setBusy(false);
  setNotice('');
  setError('');
  setConfirmationRequired(false);
  nextForm(value=>value+1);
 },{pollAccess:false,shouldRevalidate:()=>!flight.current});
 const endpoint='/research-studies/'+encodeURIComponent(studyId)+'/centers';
 useEffect(()=>{
  if(!access.authenticated){setState({kind:'restricted'});return;}
  const controller=new AbortController();
  setState(current=>current.studyId===studyId&&current.kind==='ready'?current:{kind:'loading'});
  access.client.request(endpoint,{signal:controller.signal}).then(data=>{
   if(controller.signal.aborted)return;
   if(!Array.isArray(data.items)||typeof data.permissions?.configure!=='boolean'||typeof data.permissions?.approve!=='boolean')throw Error('研究中心信息无法核对。');
   setState({kind:'ready',studyId,data});
   setConfirmationRequired(false);
  }).catch(cause=>{
   if(!controller.signal.aborted&&cause.code!=='RESEARCH_STALE')setState({kind:'error',message:cause.message});
  });
  return()=>controller.abort();
 },[studyId,endpoint,access.authenticated,access.revision,access.client,reload]);
 async function command(path,method,body,message){
  if(flight.current||confirmationRequired||state.kind!=='ready'||state.studyId!==studyId)return;
  const token=Symbol();
  flight.current=token;
  setBusy(true);
  setError('');
  setNotice('');
  try{
   await access.client.request(endpoint+path,{method,body});
   if(flight.current!==token||current.current!==studyId)return;
   setNotice(message);
   nextForm(value=>value+1);
   setState({kind:'loading'});
   refresh(value=>value+1);
  }catch(cause){
   if(flight.current===token&&current.current===studyId){
    setConfirmationRequired(!!cause.unknown);
    setError(cause.unknown?'结果待核对，请刷新中心列表后再操作。':cause.message);
   }
  }finally{
   if(flight.current===token){flight.current=null;setBusy(false);}
  }
 }
 const data=state.kind==='ready'&&state.studyId===studyId?state.data:null;
 const visibleCount=data?.available===true?data.items.length:null;
 useEffect(()=>{onCount?.(visibleCount);return()=>onCount?.(null);},[visibleCount,onCount]);
 const locked=busy||confirmationRequired;
 return <div className="study-centers" aria-busy={busy||state.kind==='loading'}>
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert">{error}{confirmationRequired&&<Button onClick={()=>refresh(value=>value+1)}>重新读取</Button>}</p>}
  {state.kind==='loading'&&<p role="status">正在读取研究中心…</p>}
  {state.kind==='restricted'&&<p>当前账号没有可查看的中心信息。</p>}
  {state.kind==='error'&&<div role="alert"><p>{state.message}</p><Button onClick={()=>refresh(value=>value+1)}>重新读取</Button></div>}
  {data&&<>
   {(data.permissions.configure||data.permissions.approve)&&<div className="center-project-target">
    <p>课题入组总目标 {data.projectTarget?`${data.projectTarget.target} 人 · 第 ${data.projectTarget.version} 版`:'尚未确认'}</p>
    {data.permissions.approve&&<details key={'target'+formVersion}><summary>确认课题入组总目标</summary>
     <form className="center-fields" onSubmit={event=>{
      event.preventDefault();
      const values=new FormData(event.currentTarget);
      command('/target','PUT',{target:Number(values.get('target')),reason:values.get('reason').trim(),
       expectedVersion:data.projectTarget?.version??null},'课题入组总目标已确认。');
     }}>
      <label>课题目标人数<input name="target" type="number" min="1" step="1" required disabled={locked}
       defaultValue={data.projectTarget?.target}/></label>
      <label>课题目标依据<input name="reason" maxLength="500" required disabled={locked}/></label>
      <Button type="submit" disabled={locked}>保存课题入组总目标</Button>
     </form>
    </details>}
   </div>}
   {data.available===false?<p>研究中心管理暂不可用。</p>:data.items.length>0?<ul className="center-rows" key={'rows'+formVersion}>{data.items.map(center=><CenterRow key={center.id} center={center} memberOptions={data.memberOptions??[]} permissions={data.permissions} busy={locked} onCommand={command}/>)}</ul>:<p>尚无可查看的研究中心。</p>}
   {data.permissions.configure&&<details key={'add'+formVersion}><summary>新增研究中心</summary>
    <form className="center-fields" onSubmit={event=>{
     event.preventDefault();
     const form=new FormData(event.currentTarget);
     command('','POST',{code:form.get('code').trim(),name:form.get('name').trim()},'研究中心已添加。');
    }}>
     <label>中心编号<input name="code" maxLength="32" required disabled={locked}/></label>
     <label>中心名称<input name="name" maxLength="120" required disabled={locked}/></label>
     <Button type="submit" disabled={locked}>添加中心</Button>
    </form>
   </details>}
  </>}
 </div>;
}
