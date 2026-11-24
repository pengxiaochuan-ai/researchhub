import React,{useEffect,useRef} from 'react';
import {Landmark,Folder,ClipboardCheck,BrainCircuit,AlertTriangle,FileText,CalendarDays,ArrowRight,Clock} from 'lucide-react';
import {researchProjectUrl,researchProjectsUrl} from '../../src/research-projects-session.js';
import PersonalRecordList from './PersonalRecordList.jsx';
import PersonalEnrollment from './PersonalEnrollment.jsx';
import {Button} from './Components.jsx';
const taskAnchor='p01-my-tasks';
const day=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
const date=value=>new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
function Stat({Icon,title,value,detail}){return <div className={'stat '+(title==='岐研 AI'?'aiStat':'')}><div className="statTop"><Icon/>{title}</div><div className="statNum">{value}</div><small>{detail}</small></div>;}
const pendingProjectDirectory={kind:'loading',items:[],total:null,nextCursor:null,capabilities:{canCreateProject:false},message:''};
const projectStatus={draft:'课题草稿',study_created:'研究已建立',active:'研究已建立'};
function ProjectDirectoryPreview({directory,unverified,onRetry}){
  const ready=!unverified&&directory.kind==='ready',empty=ready&&directory.total===0;
  const projects=ready&&!empty&&Array.isArray(directory.items)?directory.items.slice(0,5):[];
  return <div className="personal-project-preview" aria-busy={!unverified&&directory.kind==='loading'}>
    {unverified?<p className="empty-state" role="status">身份与课题授权尚未核验，不显示私有内容。</p>:<>
      {directory.kind==='loading'&&<p className="empty-state" role="status">正在读取课题…</p>}
      {directory.kind==='error'&&<><p className="empty-state" role="alert">{directory.message||'课题暂时无法读取，请重试。'}</p><Button onClick={onRetry}>重新读取课题</Button></>}
      {directory.kind==='restricted'&&<p className="empty-state" role="status">{directory.message||'当前账号无权查看课题，请核对当前身份与授权。'}</p>}
      {projects.map(project=><div className="project" key={project.key}><div className="picon"><CalendarDays/></div><div><b>{project.title}</b><small>{project.studyGroupName||projectStatus[project.status]||'状态待核对'}</small></div>{project.links?.primary&&<a className="text-link" href={project.links.primary} aria-label={`查看${project.title}`}><ArrowRight/></a>}</div>)}
      {empty&&<p className="empty-state">尚无可查看的课题与草稿。</p>}
      {ready&&!empty&&!projects.length&&<p className="empty-state">课题预览暂不可用，请查看完整列表。</p>}
      {ready&&<a className="personal-project-more" href={researchProjectsUrl}>查看更多课题 →</a>}
    </>}
  </div>;
}
export default function PersonalOverview({data,unverified=false,notice,onAccessLost,projectDirectory=pendingProjectDirectory,onRetryProjectDirectory,decisions}){
  const tasks=useRef(null);
  function openTasks(){
    if(!tasks.current)return;
    tasks.current.open=true;
    tasks.current.querySelector('summary')?.focus({preventScroll:true});
    tasks.current.scrollIntoView({block:'start'});
  }
  function followTasks(event){
    if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
    event.preventDefault();
    const hash='#'+taskAnchor;
    if(window.location.hash!==hash)window.history.pushState(window.history.state,'',hash);
    openTasks();
  }
  useEffect(()=>{
    if(!unverified&&window.location.hash==='#'+taskAnchor)openTasks();
  },[unverified]);
  const decisionState=unverified?null:decisions;
  const decisionCount=decisionState?.kind==='ready'
    ? decisionState.nextCursor ? (decisionState.items.length?decisionState.items.length+'+ 项':'—') : decisionState.items.length+' 项'
    : '—';
  const directory=projectDirectory??pendingProjectDirectory;
  const projectCount=!unverified&&directory.kind==='ready'&&Number.isSafeInteger(directory.total)&&directory.total>=0?directory.total:'—';
  const canCreateProject=!unverified&&directory.kind==='ready'&&directory.capabilities?.canCreateProject===true;
  return <>{notice}<div className="hello"><div><h1>{unverified?'我的工作台':data.profile.displayName+'，您好'}</h1><p>专注于证据，推动更好的临床实践。</p></div><time>{day}</time></div>
    <div className="workspace"><div className="center">
      <section className="hub">
        <div className="hubMain">
          <div className="hubIcon"><Landmark aria-hidden="true"/></div>
          <div>
            <small>当前科研工作空间 · {data.profile.tenantName}</small>
            <h2>Research Hub</h2>
            <div className="hubMeta">课题与草稿 {projectCount} 项 · 本人草稿 {data.summary.ownDraftCount} 份</div>
          </div>
        </div>
        <a className="hubResearchLink" href="/pages/h01/">进入领域研究 <ArrowRight size={16} aria-hidden="true"/></a>
      </section>
      <div className="stats"><Stat Icon={Folder} title="我的课题" value={unverified?`${projectCount} 项`:<a className="statCountLink" href={researchProjectsUrl} aria-label={`查看我的课题，${projectCount} 项`}>{projectCount} 项</a>} detail="当前可查看课题与草稿"/><Stat Icon={AlertTriangle} title="需要判断" value={unverified?decisionCount:<a className="statCountLink" href="#p01-decisions">{decisionCount}</a>} detail="待审核的研究方案"/><Stat Icon={ClipboardCheck} title="待我处理" value={unverified?`${data.summary.myOpenTaskCount} 项`:<a className="statCountLink" href={'#'+taskAnchor} aria-label={`查看待我处理，${data.summary.myOpenTaskCount} 项`} onClick={followTasks}>{data.summary.myOpenTaskCount} 项</a>} detail="分配给我的未完成任务"/><Stat Icon={BrainCircuit} title="岐研 AI" value={<a href="/pages/ai01/">进入 AI ›</a>} detail="按当前授权与Token额度使用"/></div>
      <section className="attention" id="p01-decisions"><div className="attHead"><h2><AlertTriangle/>需要您判断</h2></div><div className="attBody">
        <div className="pending-decisions">
          <h3>待审核研究方案</h3>
          {unverified?<p role="status">正在核对登录身份。</p>:decisionState?.kind==='error'?<div role="alert"><p>待审核方案暂时无法读取。</p><Button onClick={decisionState.retry}>重新读取</Button></div>:decisionState?.kind!=='ready'?<p role="status">正在读取待审核方案…</p>:<>
            {decisionState.items.length>0?<ul className="record-list">{decisionState.items.map(item=><li key={item.studyId+':'+item.protocol.id}>
              <div><a className="decisionLink" href={item.href}>{item.protocol.title}</a><small>{item.studyTitle} · 方案 v{item.protocol.versionNumber}</small></div>
            </li>)}</ul>:<p role="status">{decisionState.nextCursor?'当前范围暂未找到待审核方案。':'当前没有需要您审核的研究方案。'}</p>}
            {decisionState.nextCursor&&<Button onClick={decisionState.more}>继续查看待审核方案</Button>}
          </>}
        </div>
        <PersonalEnrollment enrollment={data.enrollment} unverified={unverified}/>
        <details className="personal-task-details" id={taskAnchor} ref={tasks}><summary>待我处理 · {data.summary.myOpenTaskCount} 项任务</summary><PersonalRecordList kind="tasks" data={data} unverified={unverified} onAccessLost={onAccessLost}/></details>
      </div></section>
      <div className="briefTitle"><h2>与你相关的研究简报</h2><span>个性化简报暂不可用</span><button disabled>查看全部 →</button></div><div className="briefs">{['最新研究证据','研究方法进展','潜在研究机会'].map(label=><article key={label}><b><FileText/>{label}</b><p>暂无已核验的个性化简报。</p></article>)}</div>
    </div><div className="rail"><section className="railCard"><h2><a href="/pages/k01/">个人知识库 →</a></h2><p>管理本人文献与知识资料</p></section><section className="railCard"><div className="railTitle personal-project-title"><h2>我的课题</h2><div className="personal-project-title-actions"><span>{projectCount} 项</span>{canCreateProject&&<Button primary className="personal-project-create" onClick={()=>location.assign(researchProjectUrl())}>新建课题</Button>}</div></div><ProjectDirectoryPreview directory={directory} unverified={unverified} onRetry={onRetryProjectDirectory}/>
      <details className="personal-draft-details"><summary>本人研究草稿 · {data.summary.ownDraftCount} 份</summary><PersonalRecordList kind="drafts" data={data} unverified={unverified} onAccessLost={onAccessLost}/></details>
    </section><section className="railCard recent"><div className="railTitle"><h2>近期重要动态</h2></div><p className="empty-state">研究事件与领域动态暂不可用。</p><details><summary>本人草稿更新时间（不是研究动态）</summary><ul className="activity-list">{data.activity.map(item=><li key={item.id}><Clock/><div><b>{item.title}</b><small>{date(item.updatedAt)}</small></div></li>)}</ul></details></section></div></div>
  </>;
}

export function PersonalOverviewSkeleton({notice}){
  // These are explicit unknown presentation values, never synthetic records or zero metrics.
  return <PersonalOverview unverified notice={notice} data={{profile:{tenantName:'身份与授权未核验'},summary:{projectCount:'—',ownDraftCount:'—',myOpenTaskCount:'—'},studyGroups:[],drafts:[],tasks:[],activity:[]}}/>;
}
