import React,{useEffect,useState} from 'react';
import {createResearchProjectsClient} from '../../src/research-projects-session.js';
import {readResearchExecution} from '../../src/research-directory-session.js';
import {makeDesignWorkspaceUrl} from '../../src/research-design-session.js';
import {readStudyOverviewLocation} from '../../src/study-overview-route.js';
import './real-study-overview.css';

const unavailable="当前研究的此项数据暂不可用。";
function OverviewCard({title,className='',children}){return <section className={'card '+className}><div className="card-title"><h2>{title}</h2></div>{children||<p className="rs-empty">{unavailable}</p>}</section>;}
export function StudyOverviewLayout({state={kind:'loading'},scope}){
  const ready=state.kind==='ready',project=ready?state.project:null;
  return <div className="dashboard-grid">
    <div className="left-dashboard"><div className="metrics-row">{['入组进度','研究中心进度','数据完整率','方案偏离','不良事件'].map(title=><section className="metric-card" key={title}><span className="metric-title">{title}</span><div className="metric-value">—</div><p className="muted">暂不可用</p></section>)}</div>
      <div className="charts-row"><OverviewCard title="入组趋势" className="chart-card enrollment-card"/><OverviewCard title="各中心入组情况" className="chart-card center-chart-card"/></div>
      <div className="details-row"><OverviewCard title="研究中心列表" className="center-list"><div className="rs-table-scroll"><table><thead><tr>{['中心名称','主要研究者','计划入组','已入组','完成率','状态','操作'].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody><tr><td colSpan={7}>{unavailable}</td></tr></tbody></table></div></OverviewCard>
        <OverviewCard title="岐研 AI 分析" className="ai-analysis"><p className="rs-empty">本页尚无真实分析结果。可按当前授权进入科研 Agent 或完善本人研究设计。</p><div className="rs-actions"><a href="/pages/ai01/">与 AI 进一步讨论</a>{ready&&project.canOpenDesignWorkspace&&<a href={makeDesignWorkspaceUrl('s02',scope)}>进入本人研究设计草稿</a>}</div></OverviewCard></div>
      <div className="bottom-row"><OverviewCard title="最近数据更新" className="mini-list updates"/><OverviewCard title="相关文档" className="mini-list documents"/><OverviewCard title="讨论与决策" className="mini-list discussions"/></div>
    </div>
    <aside className="right-dashboard"><OverviewCard title="研究信息" className="research-info"><div className="rs-info"><b>{project?.name||'研究信息核验中'}</b><p>{project?.description||'研究简介尚未提供或尚未核验。'}</p>{ready&&<><p>研究组：{state.group.name}</p><p>当前账号：{state.data.profile.displayName}</p></>}{['研究类型','适应症','干预措施','对照组','主要终点','次要终点','研究人群','研究中心'].map(label=><div className="info-row" key={label}><b>{label}</b><span>暂不可用</span></div>)}</div></OverviewCard>
      <OverviewCard title="里程碑" className="milestones"/><OverviewCard title="需要您判断" className="attention-card"/></aside>
  </div>;
}

function ScopedStudyOverview({scope}){
  const [state,setState]=useState({kind:'loading'}),[retry,setRetry]=useState(0);
  useEffect(()=>{let controller=new AbortController(),sequence=0;const read=()=>{controller.abort();controller=new AbortController();const current=++sequence;setState({kind:'loading'});readResearchExecution(createResearchProjectsClient().request,scope,{signal:controller.signal}).then(data=>{if(current!==sequence)return;setState({kind:'ready',data,group:data.group,project:data.project});}).catch(error=>{if(current!==sequence||error.name==='AbortError')return;setState({kind:error.status===401?'signed-out':[403,404].includes(error.status)?'forbidden':'error',message:error.message});});};const onFocus=()=>{if(document.visibilityState==='visible')read();};window.addEventListener('qiyan:user-change',read);window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);read();return()=>{sequence++;controller.abort();window.removeEventListener('qiyan:user-change',read);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);};},[scope.studyGroupId,scope.researchProjectId,retry]);
  const {kind}=state;
  return <>
    {kind!=='ready'&&<section className="rs-card" role={kind==='error'||kind==='forbidden'?'alert':'status'}><h2>{kind==='loading'?'正在核验 Study 数据':kind==='signed-out'?'请先登录':kind==='forbidden'?'无权查看此 Study':'Study 数据暂时不可用'}</h2><p>{kind==='loading'?'正在读取当前账号的服务端研究关系。':kind==='signed-out'?"请登录后从“我的工作台”重新选择研究。":kind==='forbidden'?'当前账号暂无此 Study 的查看权限。':state.message}</p>{kind==='error'?<button type="button" onClick={()=>setRetry(x=>x+1)}>重新读取</button>:null}{kind==='signed-out'?<a href="/pages/p003/">前往登录</a>:null}</section>}
    <StudyOverviewLayout state={state} scope={scope}/>
    {kind==='ready'&&<a className="rs-back" href={'/pages/s11/?'+new URLSearchParams({members:'1',...scope})}>查看此 Study 成员与权限</a>}
    <a className="rs-back" href="/pages/p01/">返回我的工作台</a>
  </>;
}

export default function RealStudyOverview(){
  let scope,error;try{scope=readStudyOverviewLocation(location.search);}catch(caught){error=caught;}
  return <main className="platform-main page rs-overview real-study-overview">{error?<section className="rs-card" role="alert"><h2>无法打开 Study 概览</h2><p>{error.message}</p><a href="/pages/p01/">返回我的工作台</a></section>:<ScopedStudyOverview scope={scope}/>}</main>;
}
