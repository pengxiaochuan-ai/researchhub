import React,{useEffect,useRef} from 'react';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import LiteratureSources from './LiteratureSources.jsx';
import PrivateMaterialSources from './PrivateMaterialSources.jsx';
import ResearchDataSources from './ResearchDataSources.jsx';
import {VideoChatAnswer} from './VideoSources.jsx';
export function useLatestAgentMessage(messages=[],paused=false){
 const ref=useRef(null),lastId=messages.at(-1)?.id;
 useEffect(()=>{
  const thread=ref.current,nodes=thread?.querySelectorAll('.agent-message'),last=nodes?.[nodes.length-1];if(paused||!thread||!last)return;
  thread.scrollTop+=last.getBoundingClientRect().top-thread.getBoundingClientRect().top;
 },[lastId,paused]);
 return ref;
}
function completionLabel(job,messages){
 const status=messages.find(m=>m.id===job.assistantMessageId)?.meta?.provenance?.webOutput?.status;
 return status==='candidate-only'?'本次仅提供检索候选，未完成正文解读。':status==='partial'?'已交付可读取部分，未读取范围请核对回答。':'本次回答已完成。';
}
export default function AgentMessages({messages=[],jobs=[],onEvidence,media}){
 return messages.filter(m=>['user','assistant'].includes(m.role)).map(m=><article key={m.id} className={'agent-message '+(m.role==='assistant'?'hub-agent-answer':'agent-user-message')} aria-label={m.role==='user'?'我的问题':'科研 Agent 回答'}>
  <b>{m.role==='user'?'我的问题':'科研 Agent'}</b>{m.role==='user'&&m.meta?.hubCommand?.networkIntent?.enabled&&<small className="agent-network-label">智能搜索</small>}{m.meta?.sourceStatus==='current'&&m.meta.provenance?.videoEvidence?<VideoChatAnswer message={m} media={media}/>:<Markdown allowImages={false} headingOffset={2} trustedLinks={m.role==='assistant'&&m.meta?.sourceStatus==='snapshot'?[...(m.meta.provenance?.webEvidence?.sources??[]).map(s=>s.url),...(m.meta.provenance?.webEvidence?.tools??[]).filter(t=>t.status==='failed').map(t=>t.requestedUrl)]:[]}>{m.content}</Markdown>}
  {m.role==='user'&&jobs.filter(j=>j.userMessageId===m.id).map(j=><p role="status" key={j.id}>{j.status==='failed'?j.errorCode==='HUB_LITERATURE_PLAN_CLARIFICATION'&&typeof j.errorMessage==='string'&&j.errorMessage.length<=300?'需要补充：'+j.errorMessage+' 问题已保留，请补充后发送；不会自动重试。':'本次未交付回答；问题已保留，不会自动重试。':j.status==='completed'?completionLabel(j,messages):'正在处理，完成后自动显示回答；可继续输入下一条指令。'}</p>)}
  {m.role==='assistant'&&m.meta?.sourceStatus==='current'&&(m.meta.provenance?.videoEvidence?null:m.meta.provenance?.researchDataEvidence?<ResearchDataSources evidence={m.meta.provenance.researchDataEvidence}/>:m.meta.provenance?.privateMaterialEvidence?<PrivateMaterialSources evidence={m.meta.provenance.privateMaterialEvidence}/>:m.meta.provenance?.literatureEvidence?<LiteratureSources evidence={m.meta.provenance.literatureEvidence}/>:m.meta.provenance?.articleEvidence&&onEvidence?<button type="button" onClick={()=>onEvidence(m)}>核对本次证据</button>:m.meta.provenance?.hubSources?.map((s,i)=><p key={i}>{s.externalDocumentId?<span>{s.title} · {s.sourceName} · 仅元数据</span>:<a href={'/pages/e02/?recordId='+encodeURIComponent(s.pmcRecordId||s.sourceRecordId)}>[{s.index??i+1}] {s.title}</a>}</p>))}
 </article>);
}
