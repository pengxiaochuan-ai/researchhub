import React,{useState} from 'react';
import {Button} from './Components.jsx';
import {taskLabels} from './StudyTaskRow.jsx';
export function TaskListFilters({filters,participants=[],busy,onApply}){
 const [draft,setDraft]=useState(filters);
 const change=(key,value)=>setDraft(old=>({...old,[key]:value}));
 return <form className="s08-task-filters" onSubmit={e=>{e.preventDefault();onApply(draft);}}>
  <div className="wf-field"><label htmlFor="s08-filter-q">搜索任务</label><input id="s08-filter-q" value={draft.q} maxLength={120} disabled={busy} onChange={e=>change('q',e.target.value)}/></div>
  <div className="wf-field"><label htmlFor="s08-filter-status">任务状态筛选</label><select id="s08-filter-status" value={draft.status} disabled={busy} onChange={e=>change('status',e.target.value)}><option value="">全部状态</option>{['open','in_progress','blocked','completed','cancelled'].map(s=><option key={s} value={s}>{taskLabels[s]}</option>)}</select></div>
  <div className="wf-field"><label htmlFor="s08-filter-review">验收状态筛选</label><select id="s08-filter-review" value={draft.reviewStatus} disabled={busy} onChange={e=>change('reviewStatus',e.target.value)}><option value="">全部验收状态</option>{['not_submitted','pending_review','accepted','returned','not_required'].map(s=><option key={s} value={s}>{taskLabels[s]}</option>)}</select></div>
  <div className="wf-field"><label htmlFor="s08-filter-assignee">负责人筛选</label><select id="s08-filter-assignee" value={draft.assigneeAccountId} disabled={busy} onChange={e=>change('assigneeAccountId',e.target.value)}><option value="">全部可见负责人</option>{participants.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select></div>
  <div className="wf-field"><label htmlFor="s08-filter-limit">每页条数</label><select id="s08-filter-limit" value={draft.limit} disabled={busy} onChange={e=>change('limit',Number(e.target.value))}>{[2,10,20].map(n=><option key={n} value={n}>{n}条</option>)}</select></div>
  <label className="wf-check"><input type="checkbox" checked={draft.overdue} disabled={busy} onChange={e=>change('overdue',e.target.checked)}/>仅逾期</label>
  <Button type="submit" disabled={busy}>应用任务筛选</Button>
 </form>;
}
export function TaskPagination({index,nextCursor,busy,onPage}){
 return <nav className="wf-toolbar" aria-label="任务分页"><Button disabled={busy||index===0} onClick={()=>onPage('previous')}>上一页</Button><span>第{index+1}页</span><Button disabled={busy||!nextCursor} onClick={()=>onPage('next')}>下一页</Button></nav>;
}
