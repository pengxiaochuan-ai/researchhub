import React,{useState} from 'react';
import {Button} from './Components.jsx';
import {readResearchProjectRoute,researchProjectUrl} from '../../src/research-projects-session.js';
import {useResearchDirectory} from './research-directory-hooks.js';
import './research-projects.css';
const statusLabels={draft:'课题草稿',study_created:'研究已建立',active:'研究已建立'};
export default function ResearchProjects(){
 let routeError;try{readResearchProjectRoute('q02',location.search);}catch(error){routeError=error.message;}
 const [query,setQuery]=useState('');
 const directory=useResearchDirectory({limit:20,query,onIdentityReset:()=>setQuery('')});
 const ready=directory.kind==='ready'&&!routeError;
 return <main className="platform-main real-workspace-entry rh-research-projects"><div className="wf-content"><section className="wf-panel" aria-busy={directory.kind==='loading'||directory.refreshing}>
  <div className="rh-directory-heading"><h2>我的课题与草稿</h2>{ready&&<span aria-live="polite">共 {directory.total} 项</span>}</div>
  <div className="wf-toolbar"><label htmlFor="research-project-search">搜索课题<input id="research-project-search" value={query} maxLength={200} onChange={event=>setQuery(event.target.value)} placeholder="课题名称或研究问题"/></label>{ready&&directory.capabilities.canCreateProject&&<Button primary onClick={()=>location.assign(researchProjectUrl())}>新建课题</Button>}</div>
  {(routeError||directory.message)&&<p role="alert">{routeError||directory.message}</p>}{directory.kind==='loading'&&<p role="status">正在读取当前账号的课题…</p>}{!routeError&&['error','restricted'].includes(directory.kind)&&<Button onClick={directory.retry}>重新读取</Button>}
  {ready&&<><ul className="wf-list rh-directory-list">{directory.items.map(item=><li key={item.key} data-directory-key={item.key} data-project-intent-id={item.intentId} data-execution-project-id={item.executionProjectId}>
   <strong>{item.title}</strong><small>{[item.studyGroupName,statusLabels[item.status],new Date(item.updatedAt).toLocaleDateString('zh-CN')].filter(Boolean).join(' · ')}</small>{item.summary&&<p className="rh-directory-summary">{item.summary}</p>}
   <div className="rh-project-links"><a href={item.links.primary}>{item.capabilities.canOpenStudy?'进入研究概览':'查看与编辑'}</a>{item.links.edit&&item.links.edit!==item.links.primary&&<a href={item.links.edit}>查看与编辑</a>}</div>
  </li>)}</ul>{!directory.items.length&&<p role="status">{query.trim()?'未找到匹配课题。':'尚无可查看的课题，可新建并保存研究问题。'}</p>}{directory.nextCursor&&<Button disabled={directory.refreshing||directory.loadingMore} loading={directory.loadingMore} onClick={directory.more}>查看更多课题</Button>}</>}
  <a href="/pages/q02/">查看研究方案草稿</a>
 </section></div></main>;
}
