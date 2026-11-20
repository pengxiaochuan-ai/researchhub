import useStudyDataLeaveGuard from './useStudyDataLeaveGuard.jsx';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createKnowledgeClient} from '../../src/knowledge-session.js';
import AgentQuestion from './AgentQuestion.jsx';
import AgentHistory from './AgentHistory.jsx';
import AgentMessages,{useLatestAgentMessage} from './AgentMessages.jsx';
import {VideoChatAnswer} from './VideoSources.jsx';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import LiteratureSources from './LiteratureSources.jsx';
import AgentCommandComposer from './AgentCommandComposer.jsx';
import AgentPendingMessage from './AgentPendingMessage.jsx';
import {useAgentMaterials,AgentMaterialsView} from './AgentMaterials.jsx';
import {useAgentMedia} from './AgentMedia.jsx';
import ResearchDataPreview,{useResearchData} from './ResearchDataPreview.jsx';
import './SmartSearch.css';
import {agentQuestionError,agentQuestionLength,AGENT_QUESTION_MAX_CHARACTERS} from '../../src/agent-question.js';
import {resolveHubAgentAvailability} from '../../src/hub-agent-availability.js';

const hubKey='lingshu-xinyu';
const displayError=error=>error?.message||'服务暂时不可用，请刷新核对。';

export default function HubAgentPanel({user,layout,paused=false,sessionId,onSessionCreated,uploadStudyId,acquisitionContext,contextNotice}){
  // The browser auth profile deliberately omits permission arrays. The real
  // controller and AgentAccess check decide capability, not a UI role guess.
  const currentGroup=user?.studyGroups?.find(item=>item.researchProjects?.length);
  const scope=useMemo(()=>currentGroup?{studyGroupId:currentGroup.id,researchProjectId:currentGroup.researchProjects[0].id}:null,[currentGroup?.id,currentGroup?.researchProjects?.[0]?.id]);
  const allowed=Boolean(scope);
  const client=useMemo(()=>createKnowledgeClient({scope:()=>scope}),[scope?.studyGroupId,scope?.researchProjectId]);
  const [state,setState]=useState({kind:'loading'}),[session,setSession]=useState(null),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=useRef(0),pendingKey=useRef(null);
  const selectedId=useRef(sessionId),[messages,setMessages]=useState([]);
  const [composerDirty,setComposerDirty]=useState(false);
  const [nextCursor,setNextCursor]=useState(null),[running,setRunning]=useState(false);
  const [jobs,setJobs]=useState([]);
  const [pendingCommand,setPendingCommand]=useState(null);
  const creationKey=useRef(null),creating=useRef(false),[historyVersion,setHistoryVersion]=useState(0);
  const creationContext=useMemo(()=>({}),[client,user?.accountId]),currentCreationContext=useRef(creationContext),creationEpoch=useRef(0);currentCreationContext.current=creationContext;
  useEffect(()=>()=>{creationEpoch.current++;},[]);
  const [composerEpoch,setComposerEpoch]=useState(0);
  const [networkEnabled,setNetworkEnabled]=useState(false);
  const bootContext=useRef(null);
  useEffect(()=>setNetworkEnabled(false),[client,user?.accountId]);
  const threadRef=useLatestAgentMessage(messages,paused);
  useEffect(()=>{
    const turn=++active.current;
    if(paused){setState(previous=>({...previous,kind:'loading'}));return()=>{active.current++;};}
    const previous=bootContext.current,changed=!previous||previous.client!==client||previous.accountId!==user?.accountId||previous.allowed!==allowed;
    bootContext.current={client,accountId:user?.accountId,allowed};
    if(changed){setSession(null);setAnswer(null);setMessages([]);setJobs([]);setNextCursor(null);setRunning(false);setError('');setBusy(false);}
    if(!allowed){setState({kind:'restricted'});return()=>{active.current++;};}
    setState(previous=>({...previous,kind:'loading'}));
    Promise.all([client.get('/agents'),client.get('/knowledge/ai-status')]).then(async([agents,status])=>{
      if(turn!==active.current)return;
      const availability=resolveHubAgentAvailability(agents,status);
      if(availability.kind!=='ready'){setSession(null);setAnswer(null);setMessages([]);setJobs([]);setNextCursor(null);setRunning(false);}
      if(availability.kind==='ready'&&selectedId.current){await load(selectedId.current,turn);if(turn!==active.current)return;setSession({id:selectedId.current});}
      setState(availability);
      setBusy(false);
    }).catch(reason=>{if(turn===active.current)setState({kind:'error',message:displayError(reason)});});
    return()=>{active.current++;};
  },[client,allowed,user?.accountId,paused]);
  const load=async(id,turn=active.current,before)=>{
    try{
      const result=await client.get(`/sessions/${id}/knowledge-state?limit=60${before?'&before='+encodeURIComponent(before):''}`);
      if(turn===active.current)setJobs(old=>before?[...new Map([...(result.jobs??[]),...old].map(j=>[j.id,j])).values()]:result.jobs??[]);
      if(result.hubContext?.kind!=='hub'||result.hubContext.sessionId!==id)throw Object.assign(Error('该会话不属于 Hub 问答，请从历史列表重新进入。'),{status:409});
      if(turn===active.current){setMessages(old=>before?[...new Map([...(result.messages??[]),...old].map(m=>[m.id,m])).values()]:result.messages??[]);setNextCursor(result.nextCursor);setRunning(result.jobs?.some(j=>['queued','processing'].includes(j.status))??false);setAnswer(result.messages?.filter(message=>message.role==='assistant').at(-1)??null);setState(previous=>({...previous,quota:result.quota}));}return result;
    }catch(reason){
      if(turn===active.current&&[401,403,404,409].includes(reason.status)){
        ++active.current;selectedId.current=null;setSession(null);setAnswer(null);setMessages([]);setJobs([]);setNextCursor(null);setRunning(false);setBusy(false);setState({kind:'restricted'});setError(displayError(reason));
      }
      throw reason;
    }
  };
  const begin=async()=>{
    if(paused||busy||creating.current||state.kind!=='ready')return;
    creating.current=true;
    creationEpoch.current++;
    setNetworkEnabled(false);
    setComposerEpoch(v=>v+1);
    const turn=++active.current;creationKey.current??=crypto.randomUUID();
    selectedId.current=null;pendingKey.current=null;setSession(null);setMessages([]);setJobs([]);setAnswer(null);setQuestion('');setNextCursor(null);setRunning(false);setBusy(true);setError('');
    try{const next=await client.post('/sessions/hub-source',{agentId:state.agentId,hubKey,conversationKey:creationKey.current});if(turn===active.current){creationKey.current=null;selectedId.current=next.id;setSession(next);if(onSessionCreated){onSessionCreated(next.id);return;}setHistoryVersion(v=>v+1);if(layout==='workbench')history.replaceState(null,'','/pages/ai01/?sessionId='+encodeURIComponent(next.id));await load(next.id,turn);}}
    catch(reason){if(turn===active.current)setError(displayError(reason));}finally{creating.current=false;if(turn===active.current)setBusy(false);}
  };
  const ensureQueueSession=async()=>{
    if(paused||busy||state.kind!=='ready'||(selectedId.current&&!session))throw Object.assign(Error('会话尚在核验，请稍后再试。'),{status:409});
    if(session)return session.id;
    const generation=creationEpoch.current,context=creationContext;creationKey.current??=crypto.randomUUID();
    const next=await client.post('/sessions/hub-source',{agentId:state.agentId,hubKey,conversationKey:creationKey.current});
    if(context!==currentCreationContext.current||generation!==creationEpoch.current)throw Object.assign(Error('已切换会话，本次文件或问题未发送。'),{status:409});
    creationKey.current=null;selectedId.current=next.id;setSession(next);
    if(onSessionCreated)onSessionCreated(next.id,{preserveComposer:true});else setHistoryVersion(v=>v+1);
    return next.id;
  };
  const materialIdentity=[user?.tenantId,user?.accountId,scope?.studyGroupId,scope?.researchProjectId].join(':');
  const researchData=useResearchData({client,identity:materialIdentity,sessionId:session?.id,enabled:state.materialUpload?.researchDataEnabled===true,overviewEnabled:state.materialUpload?.researchDataOverviewReady===true,analysisReady:state.materialUpload?.researchDataAnalysisReady===true,paused:paused||state.kind!=='ready'});
  const media=useAgentMedia({client,identity:materialIdentity,sessionId:session?.id,enabled:state.materialUpload?.mediaEnabled===true,resumable:state.materialUpload?.mediaResumable===true,registrationEnabled:state.materialUpload?.mediaRegistrationEnabled===true,registrationState:state.materialUpload?.mediaRegistrationState,contentEnabled:state.materialUpload?.mediaContentEnabled===true,contentState:state.materialUpload?.mediaContentState,acquisitionContext,paused:paused||state.kind!=='ready'});
  const materials=useAgentMaterials({client,identity:materialIdentity,sessionId:session?.id,getSession:ensureQueueSession,enabled:state.materialUpload?.enabled===true,analysisReady:state.materialUpload?.analysisReady===true,researchData:state.materialUpload?.researchDataEnabled===true?researchData:undefined,media,paused:paused||state.kind!=='ready',contextStudyId:uploadStudyId});
  const leaveGuard=useStudyDataLeaveGuard({enabled:layout==='workbench',dirty:composerDirty||Boolean(materials.dataSelection)||materials.uploading||media.uploading||media.registrationDirty});
  const send=async event=>{
    event.preventDefault();if(paused||!session||busy||running||state.quota?.blocked)return;
    const text=question.trim(),inputError=agentQuestionError(text);if(inputError){setError(inputError);return;}
    const requestKey=pendingKey.current??('hub-'+crypto.randomUUID());pendingKey.current=requestKey;
    const turn=active.current;setBusy(true);setError('');
    try{
      const queued=await client.post(`/sessions/${session.id}/knowledge-messages`,{text,requestKey,kbIds:[]});
      if(turn!==active.current)return;
      pendingKey.current=null;setQuestion('');
      for(let attempt=0;attempt<20;attempt++){
        const result=await load(session.id,turn);if(turn!==active.current)return;
        const job=result.jobs?.find(item=>item.id===queued.id);
        if(job?.status==='failed'){setError('本次任务未交付回答。问题已保留，请核对状态；不会自动重试。');break;}
        if(job?.status==='completed')break;
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
    }catch(reason){if(turn===active.current)setError(displayError(reason)+' 若请求结果不确定，请先刷新会话，不要重复发送。');}
    finally{if(turn===active.current)setBusy(false);}
  };
  useEffect(()=>{
    if(layout!=='workbench')return;
    const create=event=>{if(event.detail?.pageId==='ai01'&&event.detail?.label==='＋ 新建对话'&&state.kind==='ready'&&!busy&&!paused)void begin();};
    window.addEventListener('qiyan:page-action',create);
    return()=>window.removeEventListener('qiyan:page-action',create);
  });
  if(layout==='workbench')return <div className="workspace" ref={leaveGuard.fallback}>{leaveGuard.dialog}
    <section className="conversationList" aria-label="会话列表"><button type="button" className="newChat" onClick={begin} disabled={paused||busy||state.kind!=='ready'}>{busy?'正在处理…':'＋ 新建对话'}</button>
      {['unavailable','restricted','error'].includes(state.kind)?<div className="dateLabel">本人历史会话</div>:<AgentHistory client={client} paused={paused||!allowed||state.kind!=='ready'} selectedId={session?.id} refreshKey={historyVersion}/>}</section>
    <section className="chat" aria-label="科研 Agent 对话"><div className="thread" ref={threadRef}>{contextNotice}
      {state.kind==='loading'?<p role="status">正在加载会话…</p>:state.kind==='unavailable'?<p role="status">{state.message}</p>:state.kind==='restricted'?<p role="status">当前账号没有此会话的使用权限。</p>:state.kind==='error'?<p role="alert">{state.message}</p>:null}
      {nextCursor&&<button type="button" disabled={paused||busy} onClick={()=>load(session.id,active.current,nextCursor).catch(reason=>setError(displayError(reason)))}>加载更早消息</button>}
      {!paused&&state.kind==='ready'&&<AgentMessages messages={messages} jobs={jobs} media={media}/>}{!paused&&!busy&&state.kind==='ready'&&<AgentPendingMessage command={pendingCommand} messages={messages}/>}{running&&!jobs.some(j=>['queued','processing'].includes(j.status)&&messages.some(m=>m.id===j.userMessageId))&&<p role="status">正在处理，可继续输入下一条指令。</p>}
      {error&&<p role="alert">{error} {session&&<button type="button" onClick={()=>load(session.id).then(()=>setError('')).catch(reason=>setError(displayError(reason)))}>重新获取状态</button>}</p>}
      {!paused&&state.kind==='ready'&&<ResearchDataPreview data={researchData}/>}</div>
      <div className="composer"><AgentMaterialsView materials={materials} scope={scope} analysisReady={state.materialUpload?.analysisReady===true}/>{networkEnabled&&(materials.hasMaterials||researchData.hasData)&&<p role="status">请先关闭“智能搜索”再分析本会话资料；私有资料不会用于联网搜索。</p>}<AgentCommandComposer key={composerEpoch} client={client} sessionId={session?.id} paused={paused} inputUnavailable={busy||state.kind!=='ready'||Boolean(selectedId.current&&!session)} unavailable={busy||state.kind!=='ready'||Boolean(selectedId.current&&!session)||materials.blocksAnalysis||researchData.blocksAnalysis||networkEnabled&&(materials.hasMaterials||researchData.hasData)} running={running} onRefresh={()=>selectedId.current?load(selectedId.current):null} getSession={ensureQueueSession} onPendingChange={setPendingCommand} onDirtyChange={setComposerDirty} quota={state.quota} networkIntent={{schema:'hub-network-intent.v1',enabled:networkEnabled}}/>
        <div className="composerTools"><button type="button" onClick={materials.pick} disabled={paused||busy||state.kind!=='ready'||Boolean(selectedId.current&&!session)||state.materialUpload?.enabled!==true||materials.uploading||media.uploading}>上传文件</button><button type="button" disabled>深度分析</button><button type="button" aria-pressed={networkEnabled} disabled={paused||state.kind!=='ready'} onClick={()=>setNetworkEnabled(value=>!value)}>智能搜索</button></div>
      </div></section></div>;
  return <section className="real-entry-card hub-agent-panel" aria-labelledby="hub-agent-title">
    <h2 id="hub-agent-title">Hub 文献检索与问答</h2>
    <p>独立于私有Study知识库；可检索已审核Hub资料及PubMed公开题录与摘要，实时结果不会自动入库。AI解释需结合原文和专业判断。</p>
    {state.kind==='loading'?<p role="status">正在核验科研 Agent 与当前授权…</p>:state.kind==='unavailable'?<p role="status">{state.message}</p>:state.kind==='restricted'?<p role="status">当前账号未获得科研 Agent 使用授权；公开注册不会自动开放私有 Study 或 Agent。</p>:state.kind==='error'?<p role="alert">{state.message}</p>:<>
      {!session?<button type="button" onClick={begin} disabled={busy}>{busy?'正在建立会话…':'建立独立 Hub 会话'}</button>:<>
        <p>会话已建立。AI仅使用获准来源，按实际用量计费。</p>
        {state.quota?.blocked?<p role="status">{state.quota?.message??'暂时无法核对 Token 额度，请刷新页面。'}</p>:<form onSubmit={send}>
          <label htmlFor="hub-agent-question">检索问题</label>
          <textarea id="hub-agent-question" value={question} aria-invalid={agentQuestionLength(question)>AGENT_QUESTION_MAX_CHARACTERS} aria-describedby={agentQuestionLength(question)>AGENT_QUESTION_MAX_CHARACTERS?'hub-agent-question-error':undefined} onChange={event=>{setQuestion(event.target.value);pendingKey.current=null;}} placeholder="请输入独立、只读的研究问题" disabled={busy}/>
          {agentQuestionLength(question)>AGENT_QUESTION_MAX_CHARACTERS&&<p id="hub-agent-question-error" role="alert">{agentQuestionError(question)}</p>}
          <button type="submit" disabled={busy||Boolean(agentQuestionError(question))}>{busy?'正在检索与核验…':'发送问题'}</button>
        </form>}
        {answer&&<div className="hub-agent-answer"><h3>科研 Agent 回答</h3>{answer.meta?.sourceStatus==='current'&&answer.meta.provenance?.videoEvidence?<VideoChatAnswer message={answer} media={media}/>:<Markdown allowImages={false}>{answer.content}</Markdown>}{answer.meta?.sourceStatus==='restricted'?<p role="alert">来源已失效，原回答不再交付。</p>:answer.meta?.provenance?.videoEvidence?null:answer.meta?.provenance?.literatureEvidence?<LiteratureSources evidence={answer.meta.provenance.literatureEvidence}/>:answer.meta?.provenance?.hubSources?.map(source=><p key={source.sourceRecordId||source.externalDocumentId||source.pmcRecordId}>{source.externalDocumentId
          ? source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">[{source.index}] {source.title}</a> : <span>[{source.index}] {source.title}</span>
          : <a href={`/pages/e02/?recordId=${encodeURIComponent(source.pmcRecordId||source.sourceRecordId)}`}>[{source.index}] {source.title}</a>} · {source.sourceName}{source.externalDocumentId?' · 仅元数据':''}</p>)}</div>}
      </>}
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
