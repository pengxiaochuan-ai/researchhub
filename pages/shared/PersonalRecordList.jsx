import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {fetchMyResearchOverview} from '../../src/my-research-api.js';
import {studyTasksUrl} from '../../src/study-tasks-session.js';
import {myResearchDraftLink} from '../../src/my-research-draft-route.js';
import {myResearchReportPath} from '../../src/my-research-report-preview.js';
import PersonalReportPreview from './PersonalReportPreview.jsx';

const statuses={open:'待处理',in_progress:'进行中',blocked:'受阻'};
const date=value=>new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));

// Pagination lives inside the confirmed disclosure; no new page or workspace shell.
export default function PersonalRecordList({kind,data,unverified=false,onAccessLost}){
 const initial=()=>({items:data[kind],page:data.pagination?.[kind]?.page??1,hasNext:data.pagination?.[kind]?.hasNext??false});
 const [state,setState]=useState(initial),[all,setAll]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef(null),sequence=useRef(0),retryPage=useRef(1),heading=useRef(null);
 useEffect(()=>{sequence.current++;controller.current?.abort();setState(initial());setAll(false);setBusy(false);setError('');return()=>{sequence.current++;controller.current?.abort();};},[data,kind]);
 async function read(page){
  controller.current?.abort();controller.current=new AbortController();const turn=++sequence.current;retryPage.current=page;setBusy(true);setError('');
  try{const value=await fetchMyResearchOverview({[kind==='drafts'?'draftPage':'taskPage']:page,signal:controller.current.signal});if(turn!==sequence.current)return;const pagination=value.pagination?.[kind];if(!pagination)throw new Error('列表分页暂不可用，请重新读取。');setState({items:value[kind],page:pagination.page,hasNext:pagination.hasNext});setAll(true);heading.current?.focus();}
  catch(e){if(turn===sequence.current&&e.name!=='AbortError'){setState(s=>({...s,items:[]}));setError(e.message);if([401,403].includes(e.status))onAccessLost?.(e);}}
  finally{if(turn===sequence.current)setBusy(false);}
 }
 return <div className="personal-records" aria-busy={busy}>
  <span className="personal-record-position" ref={heading} tabIndex={-1}>{all?`第 ${state.page} 页`:kind==='tasks'?'按截止时间排序':'最近更新'}</span>
  {error?<p role="alert">{error} <Button onClick={()=>void read(retryPage.current)}>重新读取</Button></p>:<>
   <ul className="record-list">{state.items.map(item=><li key={item.id}><div><b>{item.title}</b>
    {kind==='tasks'?<><small>{statuses[item.status]??'状态待核对'}{item.dueAt?' · '+date(item.dueAt):' · 未设置截止时间'}</small><a className="text-link" href={studyTasksUrl({studyGroupId:item.studyGroupId,researchProjectId:item.researchProjectId},item.id)}>处理任务 →</a></>:<><small>v{item.version} · {date(item.updatedAt)}</small>{myResearchDraftLink(item)?<a className="text-link" href={myResearchDraftLink(item).href}>{myResearchDraftLink(item).label}</a>:<span>{item.workspace?.kind==='applicability'?'当前核对授权不可用':'此类草稿暂不支持打开'}</span>}{item.canOpenWorkspace!==false&&myResearchReportPath(item)&&<PersonalReportPreview key={item.id+':'+item.version} draft={item} onAccessLost={onAccessLost}/>}</>}
   </div></li>)}</ul>
   {!state.items.length&&<p>{unverified?'身份与记录尚未核验。':all?'本页暂无记录，请返回上一页或重新读取。':kind==='tasks'?'当前没有分配给你的未关闭任务。':'暂无本人研究草稿。'}</p>}
  </>}
  {!unverified&&<nav className="personal-record-pager" aria-label={kind==='tasks'?'本人任务分页':'本人草稿分页'}>
   {!all?state.hasNext&&<Button disabled={busy} onClick={()=>void read(1)}>查看全部{kind==='tasks'?'任务':'草稿'}</Button>:<><Button disabled={busy||state.page<=1} onClick={()=>void read(state.page-1)}>上一页</Button><Button disabled={busy||!state.hasNext} onClick={()=>void read(state.page+1)}>下一页</Button></>}
   {busy&&<span role="status">正在读取…</span>}
  </nav>}
 </div>;
}
