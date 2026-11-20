import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {api,ApiError} from '../../api/client';
import {useAuth} from '../../store/auth';
import {canUseKnowledgeAi,canUseResearchPlans} from '../../../knowledge-session.js';
import {makeDesignWorkspaceUrl} from '../../../research-design-session.js';
import Markdown from '../../components/Markdown';
import {buildKnowledgeConversationItems,isKnowledgeChatNearBottom,type KnowledgeMessage,type KnowledgeQueueJob} from './knowledge-chat-state';

type Source={docId:string;docTitle:string;kbName:string;version:number;contentHash:string;chunkId:string;quote:string;page?:number;section?:string;retrievedAt:string;status?:string};
type State={messages:KnowledgeMessage[];jobs:KnowledgeQueueJob[];nextCursor?:string};
type Quota={effectiveRemainingTokens?:string;requiredTokens:string;blocked:boolean;canStart:boolean;message:string};
function Reply({message,sessionId,onOpenDoc}:{message:KnowledgeMessage;sessionId:string;onOpenDoc?:(id:string)=>void}){
  const [source,setSource]=useState<Source|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const sources=(message.meta?.provenance as any)?.knowledgeSources as Source[]|undefined;
  const planResult=(message.meta?.provenance as any)?.researchPlanResult;
  useEffect(()=>{setSource(null);setError('');},[message.meta?.sourceStatus]);
  async function open(index:number){setLoading(true);setError('');setSource(null);try{setSource(await api.get<Source>(`/sessions/${sessionId}/knowledge-sources/${message.id}/${index}`));}catch(e){setError(e instanceof Error?e.message:'来源核验失败');}finally{setLoading(false);}}
  return <div className="qa-reply rounded-lg border border-ink-200 bg-ink-50 p-3">
    {planResult&&<p className="mb-2 text-ink-500" role="status">科研候选历史消息 · 绑定草稿 v{planResult.version}。不代表当前PICO或正式方案；请在原方案草稿页核对最新版本。</p>}
    {message.meta?.sourceStatus==='stale'&&<p className="mb-2 text-amber-700" role="status">历史回答：引用版本已变化，请重新核对；不会作为新回答的证据。</p>}
    <div className="qa-answer"><Markdown allowImages={false}>{message.content}</Markdown></div>
    {sources?.length>0&&<div className="mt-3 flex flex-wrap gap-2" aria-label="回答来源">{sources.map((s,i)=><button type="button" key={s.chunkId+'-'+i} className="btn-outline qa-source-button" onClick={()=>void open(i+1)}>查看来源 [{i+1}]《{s.docTitle}》· v{s.version}</button>)}</div>}
    {loading&&<p role="status">正在核验来源的当前访问权限…</p>}
    {error&&<p role="alert" className="mt-2 text-red-700">{error}。请刷新会话重新核对。</p>}
    {source&&<section className="qa-source mt-3 rounded-lg border border-ink-200 bg-white p-3" aria-label="可追溯来源">
      <h3 className="font-semibold">来源：《{source.docTitle}》· v{source.version}</h3>
      <p>{source.kbName} · {source.status==='stale'?'旧版本引用，已过期':'当前已审核版本'}{source.page?` · 第${source.page}页`:''}{source.section?` · ${source.section}`:''}</p>
      <blockquote className="qa-answer my-3 border-l-2 border-brand-200 pl-3">{source.quote}</blockquote>
      <p className="qa-source-meta">正文 SHA256：{source.contentHash}</p><p className="qa-source-meta">分块：{source.chunkId} · 检索时间：{source.retrievedAt}</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-outline" onClick={()=>onOpenDoc?.(source.docId)}>打开当前文档</button><button type="button" className="btn-outline" onClick={()=>setSource(null)}>收起来源</button></div>
    </section>}
  </div>;
}

export default function KbAgentPanel({kbId,kbName,onOpenDoc,onActivity}:{kbId?:string;kbName?:string;onOpenDoc?:(id:string)=>void;onKbMutated?:()=>void;onActivity?:(v:{dirty:boolean;inFlight:boolean})=>void}){
  const {user,scope}=useAuth(),allowed=canUseKnowledgeAi(user,scope);
  const [creatingPlan,setCreatingPlan]=useState(false),[plansReady,setPlansReady]=useState(false),planRequest=useRef('');
  const [planList,setPlanList]=useState<{items:Array<{id:string;version:number;stage:string;sourceStatus:string}>;nextCursor?:string}|null>(null);
  const [sessionId,setSessionId]=useState(''),[state,setState]=useState<State>({messages:[],jobs:[]}),[draft,setDraft]=useState(''),[error,setError]=useState(''),[initializing,setInitializing]=useState(false),[sending,setSending]=useState(false),[quota,setQuota]=useState<Quota|null>(null),[attempt,setAttempt]=useState(0);
  const drafts=useRef(new Map<string,string>()),request=useRef<{text:string;key:string}|null>(null),scopeKey=[user?.tenantId,user?.accountId,user?.authVersion,scope?.studyGroupId,scope?.researchProjectId,kbId].join(':'),active=useRef(scopeKey),scroll=useRef<HTMLDivElement>(null);
  active.current=scopeKey;
  const followLatest=useRef(true);
  useLayoutEffect(()=>{if(scroll.current&&followLatest.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[state]);
  useEffect(()=>{onActivity?.({dirty:!!draft.trim(),inFlight:sending||creatingPlan});},[draft,sending,creatingPlan,onActivity]);
  useEffect(()=>()=>onActivity?.({dirty:false,inFlight:false}),[onActivity]);
  const pending=state.jobs.some(j=>j.status==='queued'||j.status==='processing');
  const items=useMemo(()=>buildKnowledgeConversationItems(state.messages,state.jobs),[state]);
  useEffect(()=>{
    let alive=true;setSessionId('');setState({messages:[],jobs:[]});setQuota(null);setPlansReady(false);setError('');setDraft(drafts.current.get(scopeKey)||'');request.current=null;planRequest.current='';setPlanList(null);
    if(!allowed||!kbId)return;
    setInitializing(true);
    (async()=>{try{
      const [agents,status]=await Promise.all([api.get<Array<{id:string;type:string}>>('/agents'),api.get<{enabled?:boolean;message?:string;researchPlans?:{enabled:boolean};quota:Quota}>('/knowledge/ai-status?kbId='+encodeURIComponent(kbId))]),agent=agents.find(a=>a.type==='research');if(!agent)throw new Error('当前账号没有可用科研 Agent，请联系管理员。');if(status.enabled===false)throw new Error(status.message||'当前知识库尚未开放资料问答。');
      const session=await api.post<{id:string}>('/sessions/knowledge',{agentId:agent.id,kbId,kbName});
      const loaded=await api.get<State>(`/sessions/${session.id}/knowledge-state?limit=60`);
      if(alive){setSessionId(session.id);setState(loaded);setQuota(status.quota);setPlansReady(status.researchPlans?.enabled!==false);}
    }catch(e){if(alive)setError(e instanceof Error?e.message:'问答服务不可用');}finally{if(alive)setInitializing(false);}})();
    return()=>{alive=false;};
  },[scopeKey,allowed,attempt]);
  async function refresh(){
    if(!sessionId)return;
    const key=scopeKey;
    try{const [loaded,status]=await Promise.all([api.get<State>(`/sessions/${sessionId}/knowledge-state?limit=60`),api.get<{researchPlans?:{enabled:boolean};quota:Quota}>('/knowledge/ai-status?kbId='+encodeURIComponent(kbId!))]);if(active.current===key){setState(loaded);setQuota(status.quota);setPlansReady(status.researchPlans?.enabled!==false);setError('');}}
    catch(e){if(active.current===key){setError(e instanceof Error?e.message:'更新会话失败');if(e instanceof ApiError&&[401,403].includes(e.status))setState({messages:[],jobs:[]});}}
  }
  useEffect(()=>{
    if(!sessionId)return;let alive=true,timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{if(!alive)return;await refresh();if(alive)timer=setTimeout(poll,pending?1200:5000);};timer=setTimeout(poll,pending?800:5000);return()=>{alive=false;clearTimeout(timer);};
  },[sessionId,pending,scopeKey]);
  function change(value:string){setDraft(value);drafts.current.set(scopeKey,value);}
  async function send(event:React.FormEvent){
    event.preventDefault();if(sending||!sessionId||draft.trim().length<2)return;const key=scopeKey,text=draft.trim();
    if(request.current?.text!==text)request.current={text,key:'kb-'+crypto.randomUUID()};
    setSending(true);setError('');
    try{await api.post(`/sessions/${sessionId}/knowledge-messages`,{text,requestKey:request.current.key,kbIds:[kbId]});if(active.current===key){change('');request.current=null;await refresh();}}
    catch(e){if(active.current===key)setError((e instanceof Error?e.message:'提交失败')+' 输入已保留；请先刷新会话核对。相同问题再次提交沿用原请求标识，不自动重发。');}
    finally{if(active.current===key)setSending(false);}
  }
  async function createPlan(){
    if(!plansReady){setError('研究设计功能暂未就绪，请先完成资料问答。');return;}if(!sessionId||creatingPlan||draft.trim())return;setCreatingPlan(true);setError('');
    planRequest.current||='plan-'+crypto.randomUUID();
    try{const plan=await api.post<{id:string}>('/research-plan-drafts',{sessionId,requestKey:planRequest.current});const query=new URLSearchParams({researchPlanId:plan.id,studyGroupId:scope!.studyGroupId,researchProjectId:scope!.researchProjectId});window.top!.location.assign('/pages/q01/?'+query);}
    catch(e){setError(e instanceof Error?e.message:'候选建立失败；请先核对，不自动重试。');}finally{setCreatingPlan(false);}
  }
  async function listPlans(before?:string){if(!plansReady){setError('研究设计功能暂未就绪，请先完成资料问答。');return;}const key=scopeKey;try{const response=await api.get<any>('/research-plan-drafts?limit=20'+(before?'&before='+before:''));if(active.current===key)setPlanList(previous=>({...response,items:before?[...(previous?.items??[]),...response.items]:response.items}));}catch(e){setError(e instanceof Error?e.message:'候选列表读取失败');}}
  function openPlan(id:string){const query=new URLSearchParams({researchPlanId:id,studyGroupId:scope!.studyGroupId,researchProjectId:scope!.researchProjectId});window.top!.location.assign('/pages/q01/?'+query);}
  return <section className="knowledge-ai flex h-full min-h-0 flex-col" aria-label="科研 Agent 问答">
    <header className="shrink-0 border-b border-ink-200 p-3"><h2 className="font-semibold">科研 Agent · 资料问答</h2><p className="mt-1 text-ink-500">仅依据当前库已审核材料，只读回答；来源可核验。合成体验，不是研究结论。</p></header>
    {!allowed?<p className="p-4" role="status">当前研究角色没有科研 Agent 会话授权，资料阅读权限保持不变。</p>:!kbId?<p className="p-4" role="status">请先选择一个可访问的知识库。</p>:<>
      <div ref={scroll} onScroll={()=>{if(scroll.current)followLatest.current=isKnowledgeChatNearBottom(scroll.current);}} className="min-h-0 flex-1 overflow-auto p-3" aria-label="问答历史">
        {initializing&&<p role="status">正在加载本账号与当前知识库的真实会话…</p>}
        {!initializing&&!items.length&&<p className="text-ink-500">可以问：“这些资料支持哪些研究构想？还缺少哪些信息？”没有审核依据时不生成回答。</p>}
        <div className="space-y-4">{items.map(item=>item.kind==='message'?<Reply key={item.id} message={item.message} sessionId={sessionId} onOpenDoc={onOpenDoc}/>:<article key={item.id} className="space-y-2" aria-label="一轮科研问答">
          <div className="rounded-lg bg-brand-50 p-3 whitespace-pre-wrap break-words">{item.userMessage.content}</div>
          {item.assistantMessage?<Reply message={item.assistantMessage} sessionId={sessionId} onOpenDoc={onOpenDoc}/>:<p role="status" className={item.job?.status==='failed'?'text-red-700':'text-ink-500'}>{item.job?.status==='failed'?`本次未交付回答：${item.job.errorMessage||'执行失败，请核对后另行提问。'}`:item.job?.status==='processing'?'正在检索已审核资料、核验并生成回答…':'已入队，等待前序问题完成。'}</p>}
        </article>)}</div>
      </div>
      <div className="shrink-0 border-t border-ink-200 p-3">
        {error&&<p role="alert" className="mb-2 text-red-700">{error}</p>}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><button type="button" className="btn-outline" onClick={()=>sessionId?void refresh():setAttempt(n=>n+1)} disabled={initializing}>刷新会话</button>{quota&&<span className="text-ink-500">{quota.message}</span>}</div>
        {canUseResearchPlans(user,scope)&&<div className="mb-3"><button type="button" className="btn-outline" disabled={!plansReady||!sessionId||creatingPlan||sending||pending||!!draft.trim()} aria-busy={creatingPlan} onClick={()=>void createPlan()}>形成PICO与方案草稿</button><p className="mt-1 text-ink-500">{plansReady?'先保存或清空未发送问题；将固定当前库已审核片段，进入研究者确认流程，不自动调用模型。':'研究设计功能暂未就绪，可先完成资料问答。'}</p><details onToggle={event=>{if(event.currentTarget.open)void listPlans();}}><summary>继续本账号已有方案草稿</summary>{planList&&!planList.items.length&&<p>当前研究尚无本次候选草稿。</p>}{planList?.items.map(p=><div key={p.id} className="mt-2"><button type="button" className="btn-outline" disabled={!!draft.trim()||creatingPlan||sending||pending||p.sourceStatus!=='current'} onClick={()=>openPlan(p.id)}>继续草稿 {p.id} · v{p.version}</button><p>{({awaiting_pico:'待生成PICO',pico_pending:'PICO任务，请打开核对',pico_confirmed:'PICO已确认',protocol_pending:'方案任务，请打开核对',protocol_draft:'方案草稿已保存',restricted:'来源访问已失效',unavailable:'上下文待核对'} as Record<string,string>)[p.stage]||p.stage}{p.sourceStatus==='stale'?' · 来源已过期':''}</p></div>)}{planList?.nextCursor&&<button className="btn-outline mt-2" type="button" onClick={()=>void listPlans(planList.nextCursor)}>加载更多本账号草稿</button>}</details></div>}
        {canUseResearchPlans(user,scope)&&<div className="mb-3"><button type="button" className="btn-outline" disabled={!plansReady||creatingPlan||sending||pending||!!draft.trim()} onClick={()=>window.top!.location.assign(makeDesignWorkspaceUrl('q02',scope))}>我的研究设计草稿</button><p className="mt-1 text-ink-500">{plansReady?'仅查看当前研究内本人已保存草稿；打开列表不会调用模型。':'研究设计草稿暂不可用。'}</p></div>}
        <form onSubmit={send}><label htmlFor="knowledge-ai-question" className="label">向科研 Agent 提问</label><textarea id="knowledge-ai-question" className="input resize-y" rows={3} value={draft} onChange={e=>change(e.target.value)} maxLength={1000} disabled={initializing||!sessionId} placeholder="围绕当前已审核资料提出具体科研问题…"/>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-ink-500">不自动重试；每问重新检索。{draft.length}/1000</span><button type="submit" className="btn-primary" disabled={sending||!sessionId||draft.trim().length<2||quota?.canStart!==true} aria-busy={sending}>{sending?'正在提交…':'发送问题'}</button></div>
        </form>
      </div>
    </>}
  </section>;
}
