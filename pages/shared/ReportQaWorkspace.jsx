import './report-asset-qa.css';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
import {createKnowledgeClient} from '../../src/knowledge-session.js';
import {makeCatalogAssetUrl} from '../../src/research-assets-catalog-session.js';
import {reportQaPath,reportQaCitationHref} from '../../src/report-asset-qa.js';
import AgentHistory from './AgentHistory.jsx';
import {agentQuestionError} from '../../src/agent-question.js';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import {Button} from './Components.jsx';
export default function ReportQaWorkspace({user,route,paused}){
 const api=useMemo(()=>createAssetCatalogClient({user,scope:route.scope}),[user.accountId,user.authVersion,route.scope.studyGroupId,route.scope.researchProjectId]);
 const oldGroup=user.studyGroups?.find(g=>g.researchProjects?.length),historyClient=useMemo(()=>createKnowledgeClient({scope:()=>({studyGroupId:oldGroup?.id,researchProjectId:oldGroup?.researchProjects?.[0]?.id})}),[oldGroup?.id,oldGroup?.researchProjects?.[0]?.id]);
 const key=JSON.stringify(['report-qa-question',user.tenantId,user.accountId,user.authVersion,route.scope,route.assetId,route.version]);
 const[question,setQuestion]=useState(()=>{try{return sessionStorage.getItem(key)??'';}catch{return'';}}),[status,setStatus]=useState(null),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tick,setTick]=useState(0);const active=useRef(0),pending=useRef(null);
 useEffect(()=>{try{sessionStorage.setItem(key,question);}catch{}},[key,question]);
 useEffect(()=>{const leave=e=>{if(question.trim()){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[question]);
 useEffect(()=>{const token=++active.current;pending.current=null;setBusy(false);setStatus(null);setResult(null);if(paused)return;api.get(reportQaPath(route.assetId,route.version)).then(v=>{if(token===active.current){setStatus(v);if(!v.canSearch)setResult(null);setError('');}}).catch(e=>{if(token===active.current){setStatus(null);setResult(null);setError(e.message);}});return()=>{active.current++;};},[api,route.assetId,route.version,paused,tick]);
 async function search(e){e.preventDefault();if(pending.current||paused||!status?.canSearch||[...question.trim()].length<2)return;const validation=agentQuestionError(question);if(validation){setError(validation);return;}const operation=Symbol('report-qa-search');pending.current=operation;setBusy(true);setError('');setResult(null);const token=active.current;
  try{const r=await api.post(reportQaPath(route.assetId,route.version,'/search'),{question});if(token===active.current)setResult(r);}
  catch(e){if(token===active.current){setError(e.message+' 问题已保留，请重新核对后重试。');if([401,403,409].includes(e.status)){setResult(null);setStatus(null);}}}
  finally{if(pending.current===operation){pending.current=null;setBusy(false);}}
 }
 return <div className="workspace report-qa-workspace"><section className="conversationList" aria-label="会话列表"><button className="newChat" onClick={()=>location.assign('/pages/ai01/')}>＋ 新建对话</button><AgentHistory client={historyClient} paused={paused} /></section>
  <section className="chat" aria-label="科研 Agent 对话"><div className="thread">
   <p><a href={makeCatalogAssetUrl(route.scope,route.assetId,route.version)}>返回报告资产</a></p>
   <h2>{status?.title??'本研究报告问答'} · 第{route.version}版</h2>
   <p>仅核对此固定版合成报告。AI回答暂不可用，可先检索报告依据。</p>
   {error&&<p role="alert">{error}</p>}{!status&&!error&&<p role="status">正在核对报告与用途许可…</p>}{status&&!status.canSearch&&<p role="status">当前报告用途尚未启用、已撤销或到期，请返回报告核对。</p>}
   {result&&<section aria-label="检索到的报告依据" className="report-qa-evidence"><h3>检索到的报告依据</h3><p role="status">{result.status==='no_evidence'?'此固定版没有匹配依据，不能据此形成结论。':'以下为报告原文依据，尚未生成AI回答。'}</p>{result.evidence.map((f,i)=><article key={f.id}><h4><a href={reportQaCitationHref(route.scope,route.assetId,route.version,f)}>{'来源'+(i+1)+' · '+(f.headingPath.length?f.headingPath.join(' / '):'报告说明')+' · 原文第'+f.startLine+'–'+f.endLine+'行'}</a></h4><div className="research-asset-reading"><Markdown allowImages={false} headingOffset={2}>{f.text}</Markdown></div></article>)}</section>}
  </div><div className="composer"><form onSubmit={search}><label htmlFor="report-qa-question">研究问题</label><textarea id="report-qa-question" rows={3} maxLength={8000} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="例如：数据完整性和使用限制" disabled={paused||busy}/><div className="composerTools"><Button type="submit" primary disabled={paused||busy||!status?.canSearch||[...question.trim()].length<2}>{busy?'正在检索…':'检索报告依据'}</Button><Button disabled={paused||busy} onClick={()=>setTick(x=>x+1)}>重新核对</Button></div></form></div></section>
 </div>;
}
