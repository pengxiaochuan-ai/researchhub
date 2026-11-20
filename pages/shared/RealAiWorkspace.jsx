import React, { useEffect, useMemo, useState } from 'react';
import { createAuthClient } from '../../src/auth-session.js';
import HubAgentPanel from './HubAgentPanel.jsx';
import ReportQaWorkspace from './ReportQaWorkspace.jsx';
import {readReportQaRoute,reportQaHref} from '../../src/report-asset-qa.js';
import ArticleAgentPanel from './ArticleAgentPanel.jsx';
import {AgentHistoryProvider} from './AgentHistory.jsx';
import {readArticleAiRoute,articleAiHref,hubAiHref} from '../../src/article-ai-session.js';
import StudyDataAiContext,{useStudyDataAiContext} from './StudyDataAiContext.jsx';
import './real-ai-workspace.css';

export default function RealAiWorkspace() {
  const client = useMemo(() => createAuthClient({ tenantSlug: import.meta.env.VITE_AUTH_TENANT_SLUG }), []);
  const [state, setState] = useState({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const readRoute=()=>{const qa=readReportQaRoute(globalThis.location?.search??'');return qa?{...qa,kind:qa.invalid?'invalid':'report-qa'}:readArticleAiRoute(globalThis.location?.search??'');};
  const [route,setRoute]=useState(readRoute);
  const [historyRevision,setHistoryRevision]=useState(0);
  const dataContext=useStudyDataAiContext({user:state.user,route,paused:state.kind!=='ready'||state.checking});
  useEffect(()=>{const read=()=>setRoute(readRoute());window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read);},[]);
  useEffect(() => {
    let sequence = 0, active = true;
    const read = event => {
      const turn = ++sequence;
      setState(current => {
        const identity=event?.detail;
        const changed=identity&&identity.status!=='checking'&&(!identity.authenticated||identity.id!==current.user?.accountId);
        return current.user&&!changed?{...current,checking:true,message:''}:{kind:'loading'};
      });
      client.me().then(user => { if (active && turn === sequence) setState(user ? { kind: 'ready', user,checking:false } : { kind: 'signed-out' }); })
        .catch(error => { if (active && turn === sequence) setState(current=>current.user?{...current,checking:true,message:error.message}:{kind:'error',message:error.message}); });
    };
    const visible = () => { if (!document.hidden) read(); };
    read(); window.addEventListener('qiyan:user-change', read); window.addEventListener('focus', visible);
    return () => { active = false; sequence++; window.removeEventListener('qiyan:user-change', read); window.removeEventListener('focus', visible); };
  }, [client, attempt]);
  const status = state.kind === 'loading' ? '正在核验当前账号与科研 Agent…' : state.kind === 'signed-out'
    ? '请先登录，注册不自动取得私有 Study 或 Agent 权限。' : state.kind === 'error' ? state.message : '';
  const renderContext = content => content?<aside className="contextRail" aria-label="本次参考资料">{content}</aside>:null;
  const uploadContext={...(route.uploadSubjectId?{uploadSubjectId:route.uploadSubjectId}:{}),...(route.uploadVisitId?{uploadVisitId:route.uploadVisitId}:{})};
  const returnTo=route.kind==='report-qa'?reportQaHref(route.scope,route.assetId,route.version):route.kind==='article'?articleAiHref(route.recordId,route.recovery):route.kind==='hub'?hubAiHref(route.sessionId,route.uploadStudyId,uploadContext):'/pages/ai01/';
  const group=state.user?.studyGroups?.find(item=>item.researchProjects?.length);
  const identityKey=[state.user?.accountId,group?.id,group?.researchProjects?.[0]?.id].join(':');
  const navigate=href=>{history.pushState(null,'',href);setRoute(readRoute());};
  const created=(id,{preserveComposer=false}={})=>{history.replaceState(null,'',hubAiHref(id,route.uploadStudyId,uploadContext));setHistoryRevision(v=>v+1);setRoute(previous=>({...readArticleAiRoute(location.search),...(preserveComposer?{instanceKey:previous.instanceKey??previous.sessionId??''}:{})}));};
  return <AgentHistoryProvider key={identityKey} navigate={navigate} refreshKey={historyRevision}><main className="platform-main real-ai-workspace" aria-busy={state.checking||state.kind==='loading'}>
    {state.checking&&<p className="real-ai-revalidation" role={state.message?'alert':'status'}>{state.message||'正在重新核验当前身份；会话与未发送输入保留，核验前暂停提交。'}{state.message&&<button onClick={()=>setAttempt(x=>x+1)}>重新核验</button>}</p>}
    {state.kind === 'ready'&&route.kind!=='invalid' ? route.kind==='report-qa'
      ? <ReportQaWorkspace key={[state.user.tenantId,state.user.accountId,state.user.authVersion,route.scope.studyGroupId,route.scope.researchProjectId,route.assetId,route.version].join(':')} user={state.user} route={route} paused={state.checking}/>
      : route.kind==='article'
      ? <ArticleAgentPanel key={identityKey+':'+route.recordId+':'+(route.recovery?.requestKey??'')+':'+(route.recovery?.inputHash??'')} user={state.user} recordId={route.recordId} recovery={route.recovery} paused={state.checking} renderContext={renderContext}/>
      : <HubAgentPanel key={identityKey+':'+(route.instanceKey??route.sessionId??'')} user={state.user} sessionId={route.sessionId} uploadStudyId={dataContext.kind==='ready'?route.uploadStudyId:undefined} acquisitionContext={dataContext.kind==='ready'?dataContext.context:undefined} contextNotice={<StudyDataAiContext state={dataContext}/>} onSessionCreated={created} paused={state.checking||dataContext.blocked} layout="workbench" /> :
      <div className="workspace"><section className="conversationList"><button className="newChat" disabled>＋ 新建对话</button><p>会话将在授权核验后显示。</p></section>
        <section className="chat"><div className="thread"><p role={state.kind === 'error'||route.kind==='invalid' ? 'alert' : 'status'}>{route.kind==='invalid'?'资料问答入口参数无效，请返回原资料重新进入。':status}</p>{state.kind === 'signed-out' && <a href={'/pages/p003/?returnTo='+encodeURIComponent(returnTo)}>前往登录</a>}{route.kind==='invalid'&&<a href="/pages/e01/">返回论文列表</a>}{state.kind === 'error' && <button onClick={() => setAttempt(x => x + 1)}>重新核验</button>}</div>
          <div className="composer"><label htmlFor="ai-unavailable-question">研究问题</label><textarea id="ai-unavailable-question" placeholder="核验授权后开始提问" disabled /><button disabled>发送</button></div></section></div>}
  </main></AgentHistoryProvider>;
}
