import FormalTaskSourcePicker,{useFormalTaskMode} from './FormalTaskSourcePicker.jsx';
import {useTaskConfirmation} from './TaskConfirmation.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';

export const emptyTaskForm=()=>({name:'',assigneeAccountId:'',dueDate:'',priority:'normal',collaboratorAccountIds:[],dependencyTaskIds:[],context:null});
export function validateTaskDraft(value,editing=false){
 const errors={};
 if(!value.name.trim()||[...value.name.trim()].length>120)errors.name='请输入1–120字的任务标题';
 if(!editing&&!value.assigneeAccountId)errors.assigneeAccountId='请选择真实负责人';
 const date=new Date(value.dueDate+'T15:59:59.999Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate)||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value.dueDate)errors.dueDate='请选择真实存在的截止日期';
 return errors;
}
export default function StudyTaskForm({task,participants=[],dependencies=[],dependencyCursor,onMoreDependencies,loadLinks,onError,allowed=false,busy=false,onSave=()=>{},onDirty=()=>{},onCancel=()=>{}}){
 const formal=useFormalTaskMode(),[sourceBusy,setSourceBusy]=useState(false);
 const initial=task?{name:task.name,assigneeAccountId:task.assignee?.id??'',dueDate:task.dueAt?.slice(0,10)??'',priority:task.priority}:emptyTaskForm();
 const [draft,setDraft]=useState(initial),[errors,setErrors]=useState({}),summary=useRef(null);
 const dirty=JSON.stringify(draft)!==JSON.stringify(initial);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[draft,onDirty]);
 useEffect(()=>{if(Object.keys(errors).length)summary.current?.focus();},[errors]);
 const change=(key,value)=>setDraft(old=>({...old,[key]:value}));
 function submit(event){event.preventDefault();const next=validateTaskDraft(draft,Boolean(task));setErrors(next);if(!Object.keys(next).length&&!sourceBusy)onSave(draft,task);}
 const field=(key,label,node)=><div className="wf-field"><label htmlFor={'s08-'+key}>{label}</label>{React.cloneElement(node,{id:'s08-'+key,disabled:busy||!allowed||node.props.disabled,'aria-invalid':Boolean(errors[key]),'aria-describedby':errors[key]?'s08-error-'+key:undefined})}{errors[key]&&<p className="s08-field-error" id={'s08-error-'+key}>{errors[key]}</p>}</div>;
 return <form onSubmit={submit} className="wf-form-grid s08-task-form" noValidate>
  {!!Object.keys(errors).length&&<div className="wf-error s08-form-wide" role="alert" tabIndex={-1} ref={summary}><strong>请核对以下内容</strong><ul>{Object.entries(errors).map(([key,message])=><li key={key}><a href={'#s08-'+key}>{message}</a></li>)}</ul></div>}
  {field('name','任务标题',<input value={draft.name} onChange={e=>change('name',e.target.value)} required maxLength={240}/>)}
  {field('assigneeAccountId','负责人',<select value={draft.assigneeAccountId} onChange={e=>change('assigneeAccountId',e.target.value)} required disabled={Boolean(task)}><option value="">请选择负责人</option>{task?.assignee&&!participants.some(p=>p.id===task.assignee.id)&&<option value={task.assignee.id}>{task.assignee.displayName}（不在活跃候选中）</option>}{participants.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select>)}
  {field('dueDate','截止日期',<input type="date" value={draft.dueDate} onChange={e=>change('dueDate',e.target.value)} required/>)}
  <Button primary type="submit" loading={busy} disabled={!allowed||sourceBusy||Boolean(task)&&!dirty}>{task?'保存修改':'创建任务'}</Button>
  <details className="s08-form-wide"><summary>更多任务设置</summary>{field('priority','优先级',<select value={draft.priority} onChange={e=>change('priority',e.target.value)}>{[['low','低'],['normal','普通'],['high','高'],['urgent','紧急']].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>)}{!task&&<><TaskRelationFields value={draft} onChange={setDraft} participants={participants} dependencies={dependencies} disabled={busy||!allowed} cursor={dependencyCursor} onMore={onMoreDependencies}/>{formal?<><FormalTaskSourcePicker onBusy={setSourceBusy} disabled={busy||!allowed} onSelect={value=>change('context',value)}/>{draft.context&&<p>已选择{draft.context.kind==='formal_response_ref'?'固定答卷修订':'访视'}，将随任务创建保存。</p>}</>:<TaskInitialContext value={draft.context} onChange={value=>change('context',value)} loader={loadLinks} onError={onError} disabled={busy||!allowed}/>}</>}</details>
  {task&&<div className="s08-form-wide"><p>这里只修改题名、截止日和优先级；负责人/协作调整在任务详情中单独提交。</p><Button disabled={busy} onClick={onCancel}>取消编辑</Button></div>}
 </form>;
}

function TaskInitialContext({value,onChange,loader,onError=()=>{},disabled}){
 const [page,setPage]=useState({items:[],nextCursor:null}),[loading,setLoading]=useState(false),[error,setError]=useState(''),abort=useRef(null);
 useEffect(()=>()=>abort.current?.abort(),[]);
 async function read(cursor){
  if(!loader||loading)return;abort.current?.abort();const controller=new AbortController();abort.current=controller;setLoading(true);setError('');
  try{const next=await loader({kind:'synthetic_crf_record',...(cursor?{cursor}:{})},controller.signal);if(!controller.signal.aborted)setPage(old=>cursor?{...next,items:[...old.items,...next.items]}:next);}
  catch(e){if(e.name!=='AbortError'){setError(e.message);if([401,403].includes(e.status))onError(e);}}
  finally{if(!controller.signal.aborted)setLoading(false);}
 }
 return <fieldset className="s08-initial-context" disabled={disabled}><legend>创建时关联记录（可选）</legend><p>仅关联本人已有可读合成记录的固定版本；不修改原记录，也不是完成证据。可在创建后再关联。</p><Button disabled={loading} onClick={()=>void read()}>读取可关联记录</Button>{loading&&<p role="status">正在核对已有记录…</p>}{error&&<p role="alert">{error}</p>}<label htmlFor="s08-create-context">创建时关联记录（可选）</label><select id="s08-create-context" value={value?.sourceId??''} disabled={loading} onChange={e=>onChange(page.items.find(item=>item.sourceId===e.target.value)?.context??null)}><option value="">暂不关联</option>{page.items.map(item=><option key={item.sourceId} value={item.sourceId}>{item.label} · {item.subjectLabel} · {item.visitLabel} · v{item.sourceVersion}</option>)}</select>{page.availability==='available'&&!page.items.length&&<p>未找到可关联记录，请调整检索条件。</p>}{page.invalidRecords>0&&<p>来源或父版本已变化的记录未列为选项。</p>}{page.nextCursor&&<Button disabled={loading} onClick={()=>void read(page.nextCursor)}>读取更多创建关联选项</Button>}</fieldset>;
}

function TaskRelationFields({value,onChange,participants,dependencies,disabled=false,cursor,onMore}){
 const toggle=(field,id,checked)=>onChange({...value,[field]:checked?[...(value[field]??[]),id]:(value[field]??[]).filter(key=>key!==id)});
 return <div className="s08-relations">
  <fieldset disabled={disabled}><legend>协作者</legend><p>选择任务负责人，不改变研究成员或访问权限。</p>{participants.map(p=><label className="wf-check" key={p.id}><input type="checkbox" aria-label={'协作者：'+p.displayName} checked={(value.collaboratorAccountIds??[]).includes(p.id)} onChange={e=>toggle('collaboratorAccountIds',p.id,e.target.checked)}/>{p.displayName}</label>)}</fieldset>
  <fieldset disabled={disabled}><legend>前置任务</legend><p>仅可选择有权查看的任务；不能依赖自身、形成循环或跨研究关联，前置任务未完成时不能开始。</p>{dependencies.length?dependencies.map(task=><label className="wf-check" key={task.id}><input type="checkbox" aria-label={'前置任务：'+task.name} checked={(value.dependencyTaskIds??[]).includes(task.id)} onChange={e=>toggle('dependencyTaskIds',task.id,e.target.checked)}/>{task.name}</label>):<p>暂无可选择的前置任务</p>}{cursor&&<Button disabled={disabled} onClick={onMore}>读取更多前置任务</Button>}</fieldset>
 </div>;
}

export function StudyTaskAssignments({task,participants=[],dependencies=[],dependencyCursor,onMoreDependencies,busy=false,onSave=()=>{},onDirty=()=>{}}){
 const confirm=useTaskConfirmation();
 const initial={assigneeAccountId:task.assignee?.id??'',collaboratorAccountIds:task.collaborators.map(c=>c.id),dependencyTaskIds:task.dependencies.filter(d=>d.readable).map(d=>d.id)};
 const [draft,setDraft]=useState(initial),[error,setError]=useState(''),errorRef=useRef(null);
 const dirty=JSON.stringify(draft)!==JSON.stringify(initial);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[draft,onDirty]);
 return <form className="s08-assignments" onSubmit={e=>{e.preventDefault();if(!participants.some(p=>p.id===draft.assigneeAccountId)){setError('请选择当前有效负责人');queueMicrotask(()=>errorRef.current?.focus());return;}setError('');onSave(draft,task);}} noValidate>
  {error&&<p role="alert" className="wf-error" tabIndex={-1} ref={errorRef}>{error}</p>}
  <div className="wf-field"><label htmlFor="s08-assignment-owner">分派负责人</label><select id="s08-assignment-owner" value={draft.assigneeAccountId} onChange={e=>setDraft(old=>({...old,assigneeAccountId:e.target.value}))} disabled={busy} required><option value="">请选择负责人</option>{!participants.some(p=>p.id===draft.assigneeAccountId)&&draft.assigneeAccountId&&<option value={draft.assigneeAccountId} disabled>原负责人已不在活跃候选中</option>}{participants.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select></div>
  <TaskRelationFields value={draft} onChange={setDraft} participants={participants} dependencies={dependencies.filter(d=>d.id!==task.id)} disabled={busy} cursor={dependencyCursor} onMore={onMoreDependencies}/>
  <div className="wf-toolbar"><Button type="submit" primary loading={busy} disabled={!dirty}>保存分派</Button><Button disabled={busy||!dirty} onClick={async()=>{if(await confirm('放弃未保存的分派修改？')){setDraft(initial);setError('');}}}>取消分派修改</Button></div>
 </form>;
}
