import React,{useEffect,useRef,useState} from 'react';
import {Button,Card} from './Components.jsx';
export default function SyntheticEdcExplanation({view,onRun,onSource,externalBusy}){
 const [ids,setIds]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[source,setSource]=useState(null),alive=useRef(true),reading=useRef(0),alert=useRef(null),q=view.quality,e=view.explanation,job=view.job;
 useEffect(()=>{setIds([]);setError('');},[q?.id]);
 useEffect(()=>{reading.current++;setSource(null);},[e?.resultMessageId,e?.status,view.aiStatus]);
 useEffect(()=>()=>{alive.current=false;reading.current++;},[]);
 useEffect(()=>{if(error)alert.current?.focus();},[error]);
 const pending=['queued','processing'].includes(job?.status),canRun=q?.status==='current'&&q.findings.length>0&&view.sourceStatus==='current'&&!externalBusy&&!pending&&!busy&&!view.quota?.blocked;
 async function run(){if(busy)return;setBusy(true);setError('');try{await onRun(ids);}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}}
 async function readSource(index){const token=++reading.current;setSource(null);setError('');try{const s=await onSource(e.sessionId,e.resultMessageId,index);if(alive.current&&token===reading.current)setSource(s);}catch(e){if(alive.current&&token===reading.current)setError(e.message);}}
 return <Card title="AI辅助质控解释（待本人核对）"><p>仅解释选定问题和固定已审核片段，不向模型提供原始答案，不自动更正、不计算临床指标。未选、未解释的问题仍保留在质控清单中。</p>
 <p>模型用量统一计入租户及账号 Token 额度，按实际用量结算。</p>
 {view.quota?.blocked&&<p role="status">{view.quota.message}</p>}
 {q&&<fieldset disabled={!canRun}><legend>显式选择需要解释的1–6个当前问题</legend>{q.findings.map(f=><label className="ep-checkbox" key={f.findingId}><input type="checkbox" checked={ids.includes(f.findingId)} disabled={!ids.includes(f.findingId)&&ids.length>=6} onChange={ev=>setIds(old=>ev.target.checked?[...old,f.findingId]:old.filter(id=>id!==f.findingId))}/>{f.ruleKey} · {f.subjectKey} · {view.config.visits.find(v=>v.key===f.visitKey)?.name}{f.fieldKey?' · '+view.config.form.schema.fields.find(v=>v.key===f.fieldKey)?.label:''}</label>)}</fieldset>}
 <div className="ep-actions"><Button primary loading={busy} disabled={!canRun||ids.length<1||ids.length>6} onClick={()=>void run()}>发起AI解释（计入Token用量）</Button></div>
 {!q&&<p>请先检查已保存记录，获得真实质控快照后再选择问题。</p>}{q?.status==='stale'&&<p>质控快照已过期，请先重检，不会用旧问题发起新调用。</p>}
 {pending&&<p role="status">{job.status==='queued'?'已入原科研Agent队列，等待执行。':'原科研Agent正在解释选定质控问题。'} 期间仍可保存答案；数据变更后旧解释将不予交付。</p>}{job?.status==='failed'&&<p role="alert">{job.errorMessage??'AI解释失败，未交付；不自动重试，已发生费用保留。'}</p>}
 {view.aiStatus==='restricted'&&<p role="alert">AI解释上下文受限或无法核对，正文和来源不再交付。</p>}{error&&<p ref={alert} tabIndex={-1} role="alert" className="ep-error">{error}</p>}
 {e&&<section aria-label="真实AI质控解释"><p role="status" className={e.status==='current'?'ep-notice':'ep-error'}>{e.status==='current'?'当前数据的AI解释候选，待本人核对':'历史AI解释已过期，不代表当前数据；请重检后显式发起新任务'}</p><p className="ep-meta">数据 d{e.binding.dataRevision} · 质控 {e.qualityId} · 消息 {e.resultMessageId}</p>
 <div className="ep-reading">{e.items.map(i=><article key={i.findingId}><p>{i.explanation}</p>{i.question&&<p>{i.question}</p>}<p className="ep-meta">问题：{i.findingId}</p><div className="ep-actions">{i.sourceRefs.map(n=><Button key={n} onClick={()=>void readSource(n)}>查看来源 [{n}]</Button>)}</div></article>)}</div>
 <p>已解释 {e.items.length} 项；未覆盖问题不视为通过。本候选不是审核、研究放行或临床结论。</p>{source&&<section className="ep-reading" aria-label="已重验的原始引用"><h3>来源 [{source.index}] · {source.docTitle}</h3><p>{source.quote}</p><p className="ep-meta">{source.docId} · 版本 {source.version} · {source.chunkId} · {source.status==='current'?'当前授权原片段':'原版本引用，已过期，不自动替换'} · {source.retrievedAt}</p></section>}</section>}
 {!e&&!pending&&!job&&<p>尚无本包可交付的AI解释。</p>}</Card>;
}
