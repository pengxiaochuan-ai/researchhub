import {formalTasksUrl} from '../../src/formal-tasks-session.js';
import {subjectUrl} from '../../src/research-subjects-session.js';
import React,{useEffect,useState} from 'react';
import {Button} from './Components.jsx';
import StudyDueVisits from './StudyDueVisits.jsx';
import StudyWorkflowNav from './StudyWorkflowNav.jsx';
import {readResearchProjectRoute,researchProjectUrl,researchProjectsUrl} from '../../src/research-projects-session.js';
import {useResearchProjectAccess} from './research-project-hooks.js';
import './real-study-overview.css';
import './research-projects.css';
const count=value=>Number.isSafeInteger(value)&&value>=0?String(value):'暂不可用';
function Card({title,className='',children}){return <section className={'card '+className}><div className="card-title"><h2>{title}</h2></div>{children||<p className="rs-empty">暂无可核验数据。</p>}</section>;}
export default function ResearchStudyOverview(){
 let route,routeError;try{route=readResearchProjectRoute('s01',location.search);}catch(error){routeError=error.message;}
 const [state,setState]=useState({kind:'loading'});const access=useResearchProjectAccess(()=>setState({kind:'restricted'}));
 useEffect(()=>{if(!route?.id||routeError)return;let live=true;setState(current=>current.kind==='ready'?current:{kind:'loading'});access.client.request('/research-studies/'+route.id).then(data=>{if(live)setState({kind:'ready',item:data.item});}).catch(error=>{if(live&&error.code!=='RESEARCH_STALE')setState({kind:'error',message:error.message});});return()=>{live=false;};},[route?.id,access.revision,routeError]);
 const item=state.item,project=item?.project,study=item?.study,counts=item?.counts??{},preparation=item?.preparation;
 return <main className="platform-main page rs-overview real-study-overview rh-study-overview">
  {(routeError||access.accessError||state.message)&&<section className="rs-card" role="alert"><p>{routeError||access.accessError||state.message}</p><Button onClick={access.retry}>重新读取</Button></section>}{state.kind==='loading'&&<p role="status">正在读取研究概览…</p>}
  {state.kind==='ready'&&<><div className="rh-study-summary"><strong>{project?.title}</strong><span>{preparation?.label||'研究状态待核对'}</span>{project?.id&&<a href={researchProjectUrl(project.id)}>查看课题</a>}</div><div className="dashboard-grid"><div className="left-dashboard">
   <div className="metrics-row">{[['受试者',counts.subjects],['研究中心',counts.centers],['研究成员',counts.members],['研究任务',counts.tasks],['研究方案',counts.protocols]].map(([label,value])=><section className="metric-card" key={label}><span className="metric-title">{label}</span>{label==='研究任务'&&<a href={formalTasksUrl({studyId:route.id})}>查看执行任务</a>}{label==='受试者'&&<a href={subjectUrl('s03',route.id)}>查看受试者</a>}<div className="metric-value">{count(value)}</div></section>)}</div>
   <div className="charts-row"><Card title="入组趋势" className="chart-card enrollment-card"/><Card title="各中心入组情况" className="chart-card center-chart-card"/></div><div className="details-row"><Card title="研究中心列表" className="center-list"/><Card title={preparation?.status==='protocol_executing'?'方案与执行':'研究准备'} className="ai-analysis"><p>{preparation?.message||'研究已建立；请准备研究方案、伦理与采集材料，再确认启动条件。'}</p>{Array.isArray(preparation?.items)&&<ul>{preparation.items.map((entry,index)=><li key={entry.key??index}>{entry.label}：{entry.message??(entry.status==='ready'?'已准备':'待准备')}</li>)}</ul>}{preparation?.executingProtocol?<p>当前执行方案：{preparation.executingProtocol.title} · 第{preparation.executingProtocol.versionNumber}版</p>:<p>建立研究不代表方案已批准或研究已启动。</p>}<StudyWorkflowNav item={item} studyId={route.id} onRetry={access.retry}/></Card></div>
   <div className="bottom-row"><StudyDueVisits studyId={route.id} enabled={access.authenticated}/><Card title="相关文档" className="mini-list documents"/><Card title="讨论与决策" className="mini-list discussions"/></div></div>
   <aside className="right-dashboard"><Card title="研究信息" className="research-info"><div className="rs-info"><b>{project?.title}</b><p>{project?.question||'尚未填写核心研究问题。'}</p><div className="info-row"><b>研究类型</b><span>{project?.researchType||'尚未填写'}</span></div>{[['p','研究人群'],['i','干预措施'],['c','对照组'],['o','研究结局']].map(([key,label])=><div className="info-row" key={key}><b>{label}</b><span>{project?.pico?.[key]||'尚未填写'}</span></div>)}{study?.groupName&&<div className="info-row"><b>研究组</b><span>{study.groupName}</span></div>}</div></Card><Card title="里程碑" className="milestones"/><Card title="需要您判断" className="attention-card"/></aside></div></>}
  <a className="rs-back" href={researchProjectsUrl}>返回我的课题</a>
 </main>;
}
