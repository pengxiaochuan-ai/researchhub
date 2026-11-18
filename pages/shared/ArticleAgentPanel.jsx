import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {createKnowledgeClient} from '../../src/knowledge-session.js';
import {createArticleAiSession,articleAiHref,articleEvidenceHref} from '../../src/article-ai-session.js';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import AgentQuestion from './AgentQuestion.jsx';
import AgentHistory from './AgentHistory.jsx';
import AgentMessages,{useLatestAgentMessage} from './AgentMessages.jsx';
import AgentCommandComposer from './AgentCommandComposer.jsx';
import AgentPendingMessage from './AgentPendingMessage.jsx';
export {fitAgentQuestion as fitArticleQuestion} from './AgentQuestion.jsx';

const phaseLabel={idle:'尚未发送',ensuring:'正在准备本篇会话',sending:'正在确认提交',uncertain:'提交结果待核对',running:'正在执行',completed:'本次解读已完成',failed:'本次未交付解读'};
const fields={abstract:'摘要',body:'正文',table:'表格文字'};
const omitted={ 'image-pixels':'图片像素未参与解读','supplement-content':'补充材料内容未参与解读','unselected-text':'未选取的原文未参与解读' };
function ArticleContext({article}){
  return <section className="contextCard article-context" aria-label="固定文章与证据">
    <b>本次固定文章</b>{!article?<p>文章版本与授权核验后显示。</p>:<>
      <h3>{article.title}</h3><p>版本 {article.binding.articleVersion}<br/>审核 {article.binding.reviewVersion}</p>
      <a href={articleEvidenceHref(article.binding)}>返回这篇原文</a>
      <p>{article.coverage.notice}</p>
      <p>选取 {article.evidence.fragments.length} 段，共 {article.coverage.characters??article.evidence.fragments.reduce((n,f)=>n+f.length,0)} 字符；不是全文审阅。</p>
      {article.coverage.sections&&<p>方法／结果／讨论：{['methods','results','discussion'].map(k=>article.coverage.sections[k]?'已定位选段':'未选取或未定位').join('／')}；未定位不等于原文不存在。</p>}
      <details><summary>核对原文与选段</summary><dl><dt>原文 SHA-256</dt><dd>{article.binding.rawSha256}</dd></dl>
        {article.evidence.fragments.map(f=><section className="article-fragment" key={f.id}>
          <b>{fields[f.field]} · {f.id}</b><p>{f.locator?.kind==='jats'?'原文章节／段落定位：'+(f.locator.section||'未命名章节'):'原文字段定位'} · 偏移 {f.offset}，长度 {f.length}（字符）</p>
          <p className="article-reading">{f.text}</p><a href={articleEvidenceHref(article.binding,f)}>核对这段原文</a>
        </section>)}
      </details>
      {!!article.omissions?.length&&<p>{article.omissions.map(x=>omitted[x]??'另有未选取组件').join('；')}。</p>}
    </>}
  </section>;
}
export function ArticleWorkspace({view,actions={},contextRail,renderContext,user,client}){
  const [selectedEvidence,setSelectedEvidence]=useState(null);
  const [pendingCommand,setPendingCommand]=useState(null);
  const threadRef=useLatestAgentMessage(view.messages,view.paused);
  const busy=['ensuring','sending','running'].includes(view.phase),unavailable=view.kind!=='ready'||view.paused;
  const article=!unavailable&&view.article?.status!=='restricted'?view.article:null;
  const selected=(view.messages??[]).find(m=>m.id===selectedEvidence)??view.answer;
  const sealed=selected?.meta?.sourceStatus==='current'?selected.meta.provenance?.articleEvidence:null;
  const context=article?<ArticleContext article={sealed?{...article,evidence:sealed,coverage:sealed.coverage,omissions:sealed.omissions}:article}/>:null;
  const rail=context?(renderContext?renderContext(context):<aside className="contextRail" aria-label="本次参考资料">{context}{contextRail}</aside>):null;
  const allowed=!unavailable&&article?.execution.canStart&&!view.quota?.blocked;
  return <div className={'workspace article-workspace'+(rail?' workspace-with-context':'')}>
    <section className="conversationList" aria-label="会话列表">
      <a className="newChat" href="/pages/ai01/">＋ Hub 问答</a>
      {client&&<AgentHistory client={client} paused={view.paused} selectedId={view.sessionId} refreshKey={view.task?.id}/>}
      <p>{user?.displayName} · 本人会话</p><a href="/pages/e01/">返回研究论文</a>
    </section>
    <section className="chat" aria-label="单篇文章解读"><div className="thread" ref={threadRef}>
      <h2>单篇文章 AI 解读</h2>
      {view.kind==='loading'&&<p role="status">正在核对固定文章、当前授权与本篇会话…</p>}
      {article&&<><p><b>{article.title}</b></p><p>{article.coverage.notice}。可先在右侧核对证据，再编辑问题。</p></>}
      {view.paused&&<p role="status">正在重新核验身份，暂停展示原文与提交。</p>}
      {!unavailable&&view.phase!=='idle'&&<p role="status">{phaseLabel[view.phase]??'正在核对状态'}</p>}
      {article&&!article.execution.canStart&&<p role="status">{article.execution.message}</p>}
      {view.error&&<p role="alert">{view.error}</p>}
      {view.nextCursor&&<Button onClick={actions.loadOlder} disabled={unavailable||view.loadingOlder}>加载更早消息</Button>}
      {!view.paused&&view.messages?.length?<AgentMessages messages={view.messages} jobs={view.jobs} onEvidence={m=>setSelectedEvidence(m.id)}/>:view.answer&&<article className="hub-agent-answer article-reading" aria-label="本次解读"><Markdown allowImages={false} headingOffset={2}>{view.answer.content}</Markdown><p><a href={articleEvidenceHref(article.binding)}>［1］核对本篇来源</a></p></article>}
      {!unavailable&&article&&<AgentPendingMessage command={pendingCommand} messages={view.messages}/>}
      {view.task&&<p>任务 {view.task.id} · {phaseLabel[view.phase]}</p>}
      {view.error&&<Button onClick={actions.refresh} disabled={view.paused||view.kind==='loading'||view.refreshing} loading={view.refreshing}>重新获取状态</Button>}
      {view.phase==='uncertain'&&<Button onClick={actions.retryOriginal} disabled={!allowed}>用原编号与原问题重试</Button>}
      {['restricted','error'].includes(view.kind)&&<p><a href="/pages/e01/">返回论文列表重新核对</a></p>}
    </div><div className="composer"><AgentCommandComposer client={client} sessionId={view.sessionId} paused={view.paused} unavailable={view.kind!=='ready'||!article||article.status==='restricted'} running={busy} label="本篇研究问题" inputId="article-ai-question" initialQuestion={view.question??''} onRefresh={actions.refreshLatest} getSession={actions.ensureForQueue} onPendingChange={setPendingCommand} quota={view.quota}/></div></section>{rail}
  </div>;
}
export default function ArticleAgentPanel({user,recordId,recovery,paused,renderContext}){
  useEffect(()=>{const create=e=>{if(!paused&&e.detail?.pageId==='ai01'&&e.detail?.label==='＋ 新建对话')location.assign('/pages/ai01/');};window.addEventListener('qiyan:page-action',create);return()=>window.removeEventListener('qiyan:page-action',create);},[paused]);
  const group=user?.studyGroups?.find(x=>x.researchProjects?.length),scope=group?{studyGroupId:group.id,researchProjectId:group.researchProjects[0].id}:null;
  const client=useMemo(()=>createKnowledgeClient({scope:()=>scope}),[scope?.studyGroupId,scope?.researchProjectId]);
  const [view,setView]=useState({kind:'loading',phase:'idle',question:''}),machine=useRef(null);
  useEffect(()=>{
    const current=createArticleAiSession({recordId,client,recovery,onChange:setView,onRecovery:value=>history.replaceState(null,'',articleAiHref(recordId,value))});
    machine.current=current;if(!paused)current.open();else current.pause();
    return()=>{current.dispose();if(machine.current===current)machine.current=null;};
  },[recordId,client]);
  useEffect(()=>{if(paused)machine.current?.pause();else if(machine.current?.getState().paused)machine.current.open();},[paused]);
  const actions=Object.fromEntries(['refresh','refreshLatest','ensureForQueue','loadOlder','send','retryOriginal','setQuestion'].map(name=>[name,(...args)=>machine.current?.[name](...args)]));
  return <ArticleWorkspace view={paused?{...view,paused:true,article:null,answer:null,messages:[]}:view} actions={actions} user={user} renderContext={renderContext} client={client}/>;
}
