import FormalTaskSourcePicker,{useFormalTaskMode} from './FormalTaskSourcePicker.jsx';
import {useTaskConfirmation} from './TaskConfirmation.jsx';
import {safeFormalTaskHref} from '../../src/formal-tasks-session.js';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {StudyTaskAssignments} from './StudyTaskForm.jsx';

export const taskLabels={open:'待处理',in_progress:'进行中',blocked:'受阻',completed:'已提交',cancelled:'已取消',pending_review:'待验收',accepted:'已验收',returned:'已退回',not_submitted:'未提交',not_required:'无需验收'};
const actionLabels={create:'创建任务',edit:'编辑信息',assign:'调整分派',transition:'变更执行状态',review:'任务验收',remind:'站内提醒',link:'调整关联'};
const date=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'未设置';
const noop=()=>{};
export function validateTaskTransitionForm(value,task){
 const errors={};
 if(!task.capabilities.transitions.includes(value.status))errors.status='请选择当前允许的状态操作';
 if((value.status==='cancelled'||task.capabilities.requiresActingReason)&&!value.reason.trim())errors.reason='取消或管理员代办必须说明原因';
 if([...value.reason].length>2000)errors.reason='原因最多2000字';
 if(value.status==='blocked'&&(!value.blockedReason.trim()||[...value.blockedReason].length>2000))errors.blockedReason='请输入1–2000字受阻说明';
 if(value.status==='completed'&&(!value.completionNote.trim()&&!value.evidenceRefs.length||[...value.completionNote].length>2000))errors.completionNote='请填写最多2000字完成说明或选择有效固定版本证据';
 if(value.evidenceRefs.length>10)errors.completionNote='最多选择10条固定版本证据';
 return errors;
}

function EvidencePicker({loader,value,onChange,busy,onError=noop}){
 const [query,setQuery]=useState(''),[applied,setApplied]=useState(''),[page,setPage]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),abort=useRef(null);
 async function read(cursor){
  abort.current?.abort();const controller=new AbortController();abort.current=controller;setLoading(true);setError('');
  try{
   const next=await loader({q:applied,...(cursor?{cursor}:{})},controller.signal);
   if(controller.signal.aborted)return;setPage(old=>cursor?{...next,items:[...old.items,...next.items]}:next);
  }catch(e){if(e.name!=='AbortError'){setError(e.message);if([401,403].includes(e.status))onError(e);}}
  finally{if(!controller.signal.aborted)setLoading(false);}
 }
 useEffect(()=>{if(loader)void read();return()=>abort.current?.abort();},[loader,applied]);
 return <fieldset className="s08-evidence-picker" disabled={busy}><legend>工作证据（可选，最多10条）</legend>
  <p>仅引用本人已有读取权限的当前草稿版本；固定版本不等于正式批准或方法学验收。不接受自由URL或任意附件。</p>
  <div className="wf-toolbar"><label>查找工作证据<input value={query} maxLength={120} onChange={e=>setQuery(e.target.value)}/></label><Button disabled={loading} onClick={()=>query===applied?void read():setApplied(query)}>检索工作证据</Button></div>
  {loading&&<p role="status">正在核对资料版本…</p>}{error&&<p role="alert" className="wf-error">{error}</p>}
  {page?.availability==='restricted'&&<p>当前身份不能读取这些资料版本；可填写完成说明。任务权限不扩大资料读取权限。</p>}
  {page?.availability==='available'&&page.items.length===0&&<p>当前页没有可核验的本人资料版本，请调整检索或填写完成说明。</p>}
  {page?.invalidRecords>0&&<p role="alert">本页有{page.invalidRecords}条版本完整性未通过，未列为可提交证据。</p>}
  {page?.items.map(item=>{const checked=value.some(ref=>ref.artifactId===item.artifactId&&ref.version===item.version);return <label className="wf-check" key={item.artifactId}><input type="checkbox" aria-label={'引用证据：'+item.title+' v'+item.version} checked={checked} disabled={busy||!checked&&value.length>=10} onChange={e=>onChange(e.target.checked?[...value,item]:value.filter(ref=>ref.artifactId!==item.artifactId))}/><span>{item.title} · v{item.version}</span></label>;})}
  {page?.nextCursor&&<Button disabled={loading} onClick={()=>void read(page.nextCursor)}>读取更多工作证据</Button>}
  {value.length>0&&<div><p>已选择{value.length}条固定版本，提交时仍会重验：</p>{value.map(item=><p key={item.artifactId}>{item.title} · v{item.version} <Button disabled={busy} onClick={()=>onChange(value.filter(ref=>ref.artifactId!==item.artifactId))}>移除此引用</Button></p>)}</div>}
 </fieldset>;
}

export function TaskTransitionForm({task,busy=false,onSave=noop,onDirty=noop,loadEvidence,onError}){
 const formal=useFormalTaskMode(),confirm=useTaskConfirmation(),[sourceBusy,setSourceBusy]=useState(false);
 const [draft,setDraft]=useState({status:'',reason:'',blockedReason:'',completionNote:'',evidenceRefs:[]}),[errors,setErrors]=useState({}),summary=useRef(null);
 const dirty=Boolean(draft.status||draft.reason||draft.blockedReason||draft.completionNote||draft.evidenceRefs.length);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[draft,onDirty]);
 useEffect(()=>{if(Object.keys(errors).length)summary.current?.focus();},[errors]);
 const change=(key,value)=>setDraft(old=>({...old,[key]:value}));
 const prefix='s08-transition-'+task.id;
 const field=(key,label)=> <div className="wf-field"><label htmlFor={prefix+'-'+key}>{label}</label><textarea id={prefix+'-'+key} value={draft[key]} rows={3} disabled={busy} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?prefix+'-error-'+key:undefined} onChange={e=>change(key,e.target.value)}/>{errors[key]&&<p id={prefix+'-error-'+key} className="s08-field-error">{errors[key]}</p>}</div>;
 return <form className="s08-transition-form" noValidate onSubmit={e=>{e.preventDefault();const next=validateTaskTransitionForm(draft,task);setErrors(next);if(!Object.keys(next).length){if(!sourceBusy)onSave(draft,task);}}}>
  {Object.keys(errors).length>0&&<div role="alert" className="wf-error" tabIndex={-1} ref={summary}><strong>请核对任务操作</strong><ul>{Object.entries(errors).map(([key,text])=><li key={key}><a href={'#'+prefix+'-'+key}>{text}</a></li>)}</ul></div>}
  <div className="wf-field"><label htmlFor={prefix+'-status'}>任务状态操作</label><select id={prefix+'-status'} value={draft.status} disabled={busy} aria-invalid={Boolean(errors.status)} onChange={e=>change('status',e.target.value)}><option value="">请选择操作</option>{task.capabilities.transitions.map(status=><option value={status} key={status}>{status==='completed'?'提交完成（进入待验收）':status==='in_progress'?'开始／恢复执行':taskLabels[status]}</option>)}</select></div>
  {!task.dependenciesReady&&<p>前置条件尚未满足或无法核对，暂不能开始／恢复；这不会泄露不可读前置任务的题名。</p>}
  {draft.status&&(draft.status==='cancelled'||task.capabilities.requiresActingReason)&&field('reason',draft.status==='cancelled'?'取消原因':'管理员代办原因')}
  {draft.status==='blocked'&&field('blockedReason','受阻说明')}
  {draft.status==='completed'&&<>{field('completionNote','完成说明')}{formal?<><FormalTaskSourcePicker disabled={busy} onBusy={setSourceBusy} evidence onSelect={ref=>change('evidenceRefs',[ref])}/>{draft.evidenceRefs.length>0&&<p>已选择：{draft.evidenceRefs[0].label} · 第{draft.evidenceRefs[0].revisionNo}次修订 <Button disabled={busy} onClick={()=>change('evidenceRefs',[])}>移除此引用</Button></p>}</>:<EvidencePicker loader={loadEvidence} value={draft.evidenceRefs} onChange={value=>change('evidenceRefs',value)} busy={busy} onError={onError}/>}<p>本次只是提交完成事实，随后需任务验收；不是临床采集、方案审批、锁库或导出。</p></>}
  <div className="wf-toolbar"><Button type="submit" primary loading={busy} disabled={sourceBusy}>确认状态变更</Button><Button disabled={busy||!dirty} onClick={async()=>{if(await confirm('放弃未提交的任务状态操作？')){setDraft({status:'',reason:'',blockedReason:'',completionNote:'',evidenceRefs:[]});setErrors({});}}}>取消状态操作</Button></div>
 </form>;
}

export function validateTaskReviewForm(value){
 const errors={};if(!['accept','return'].includes(value.decision))errors.decision='请选择接受或退回';
 if([...value.note].length>1000||value.decision==='return'&&!value.note.trim())errors.note='退回须说明原因，备注最多1000字';return errors;
}
export function TaskReviewForm({task,actorId,busy=false,onSave=noop,onDirty=noop}){
 const confirm=useTaskConfirmation();
 const [draft,setDraft]=useState({decision:'',note:''}),[errors,setErrors]=useState({}),summary=useRef(null);
 const dirty=Boolean(draft.decision||draft.note);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[draft,onDirty]);
 useEffect(()=>{if(Object.keys(errors).length)summary.current?.focus();},[errors]);
 return <form className="s08-review-form" noValidate onSubmit={e=>{e.preventDefault();const next=validateTaskReviewForm(draft);setErrors(next);if(!Object.keys(next).length)onSave(draft,task);}}>
  {task.submission?.actor.id===actorId&&<p className="s08-review-warning">本任务由您提交，接受后将标记同一账号提交与验收，不是独立复核。</p>}
  {!task.submission&&<p>当前没有可核验的提交者记录，不推断独立复核。</p>}
  <p>这里只验收任务，不审批方案、不锁库、不共享、发布或导出。</p>
  {!!Object.keys(errors).length&&<div role="alert" className="wf-error" tabIndex={-1} ref={summary}>{Object.values(errors).map(text=><p key={text}>{text}</p>)}</div>}
  <div className="wf-field"><label htmlFor={'s08-review-'+task.id}>任务验收操作</label><select id={'s08-review-'+task.id} value={draft.decision} disabled={busy} aria-invalid={Boolean(errors.decision)} onChange={e=>setDraft(old=>({...old,decision:e.target.value}))}><option value="">请选择验收操作</option><option value="accept">接受完成</option><option value="return">退回继续处理</option></select></div>
  <div className="wf-field"><label htmlFor={'s08-review-note-'+task.id}>验收备注／退回原因</label><textarea id={'s08-review-note-'+task.id} rows={3} maxLength={2000} value={draft.note} disabled={busy} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note?'s08-review-note-error-'+task.id:undefined} onChange={e=>setDraft(old=>({...old,note:e.target.value}))}/>{errors.note&&<p className="s08-field-error" id={'s08-review-note-error-'+task.id}>{errors.note}</p>}</div>
  <div className="wf-toolbar"><Button primary type="submit" loading={busy}>确认任务验收</Button><Button disabled={busy||!dirty} onClick={async()=>{if(await confirm('放弃未提交的任务验收意见？')){setDraft({decision:'',note:''});setErrors({});}}}>取消验收操作</Button></div>
 </form>;
}

function TaskDetails({task,actorId,participants,relations,busy,unknown,onEdit,onAssign,onMoreDependencies,onTransition,onReview,onRemind,loadEvidence,onError,onDirty=noop}){
 const formal=useFormalTaskMode();
 const parts=useRef({assign:false,transition:false,review:false}),[dirty,setDirty]=useState(false);
 const report=useCallback((part,value)=>{parts.current[part]=value;const next=Object.values(parts.current).some(Boolean);setDirty(next);onDirty(next);},[onDirty]);
 const assignDirty=useCallback(value=>report('assign',value),[report]),transitionDirty=useCallback(value=>report('transition',value),[report]),reviewDirty=useCallback(value=>report('review',value),[report]);
 return <div className="s08-task-detail"><h3>任务详情</h3>
  {task.capabilities.readOnlyReason&&<p>{task.capabilities.readOnlyReason}</p>}
  {task.blockedReason&&<p>受阻说明：{task.blockedReason}</p>}
  <div className="s08-reading"><p>{task.completionNote??'尚无完成说明'}</p></div>
  {task.evidence?.length>0&&<div><h3>固定版本工作证据</h3>{task.evidence.map((ref,index)=><p key={index}>{ref.status==='current'||ref.status==='changed'?<>{[ref.subjectCode,ref.visitName||ref.label,ref.formTitle].filter(Boolean).join(' · ')} · 第{ref.context?.sourceVersion??ref.revisionNo}次修订{ref.status==='changed'?' · 当前已有新修订，请重新核对':''}{' '}{safeFormalTaskHref(ref.navigation?.href,formal?.studyId,ref)&&<a href={ref.navigation.href}>核对固定来源</a>}</>:ref.available?<>{ref.title} · v{ref.version}</>:'此引用当前不可读或已变化；不会因任务权限扩大资料读取范围。'}</p>)}</div>}
  {task.submission&&<p>最近提交者：{task.submission.actor.displayName} · v{task.submission.version??'待核对'}</p>}
  {task.reviewer&&<p>最近验收／退回：{task.reviewer.displayName} · {new Date(task.reviewedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}{task.reviewNote&&<> · {task.reviewNote}</>}</p>}
  {task.sameActorReview===true&&<p className="s08-review-warning">同一账号提交与验收，不是独立复核。</p>}
  {task.capabilities.canConfigure&&<Button onClick={()=>onEdit(task)} disabled={busy||dirty}>编辑任务</Button>}
  {dirty&&<p>有尚未提交的详情修改，请先保存或取消；状态、分派和主表单不互相覆盖。</p>}
  {task.capabilities.canAssign&&<details><summary>调整分派与依赖</summary><StudyTaskAssignments task={task} participants={participants} dependencies={relations.items} dependencyCursor={relations.nextCursor} onMoreDependencies={onMoreDependencies} busy={busy||Boolean(unknown)||parts.current.transition} onSave={onAssign} onDirty={assignDirty}/></details>}
  {task.capabilities.transitions.length>0&&<details><summary>执行与状态操作</summary><TaskTransitionForm task={task} busy={busy||Boolean(unknown)||parts.current.assign} onSave={onTransition} onDirty={transitionDirty} loadEvidence={loadEvidence} onError={onError}/></details>}
  {task.capabilities.canReview&&<details><summary>任务验收</summary><TaskReviewForm task={task} actorId={actorId} busy={busy||Boolean(unknown)} onSave={onReview} onDirty={reviewDirty}/></details>}
  {task.capabilities.canRemind&&<div><Button disabled={busy||dirty||Boolean(unknown)} onClick={()=>onRemind(task)}>记录站内提醒</Button><p>提醒仅供当前有效收件人在本页核对；未证明已读或站外送达，不发送邮件或短信。</p></div>}
  {task.history.some(h=>h.action==='remind')&&<div><h3>站内提醒记录</h3>{task.history.filter(h=>h.action==='remind').map(h=><p key={h.id}>{h.actor.displayName} · {new Date(h.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} · {h.notice}<small>未证明已读或站外送达</small></p>)}</div>}
  <h3>操作记录</h3>{task.history.length?<ol>{task.history.map(h=><li key={h.id}>{h.actor.displayName} · {h.reviewDecision==='accept'?'接受完成':h.reviewDecision==='return'?'退回继续处理':actionLabels[h.action]??'任务操作'} · v{h.resultVersion} · {new Date(h.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}{h.fromStatus&&h.toStatus&&<small>{taskLabels[h.fromStatus]} → {taskLabels[h.toStatus]}</small>}{h.reason&&<p>{h.reason}</p>}</li>)}</ol>:<p>暂无本页提交记录；不据此推断历史任务没有操作。</p>}
 </div>;
}

export default function StudyTaskRow({task,selected,...props}){
 return <li className="s08-task-item"><div><strong>{task.name}</strong><small>{task.assignee?.displayName??'未分派'} · {date(task.dueAt)} · v{task.version}{task.overdue?' · 已逾期':''}</small></div>
  <span>{taskLabels[task.status]} · {taskLabels[task.reviewStatus]}</span><Button disabled={props.busy} aria-expanded={selected?.id===task.id} onClick={()=>props.onSelect(task.id)}>查看详情</Button>
  {selected?.id===task.id&&<TaskDetails key={selected.id+':'+selected.version} task={selected} {...props}/>}
 </li>;
}
