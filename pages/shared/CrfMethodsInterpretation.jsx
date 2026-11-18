import React,{useEffect,useRef,useState}from'react';
import{Button,Card}from'./Components.jsx';
export default function CrfMethodsInterpretation({run,api,busy,onSubmit,onRestricted}){
 const[ids,setIds]=useState([]),[error,setError]=useState(''),[source,setSource]=useState(null),[reading,setReading]=useState(false),request=useRef(null),seq=useRef(0),alive=useRef(true),first=useRef(null),alert=useRef(null),selectionError=useRef(false);
 const e=run.explanation,pending=['queued','processing'].includes(run.job?.status),canRun=run.actions?.canInterpret&&!pending&&!busy;
 // React cleanup keeps late source reads from reviving a different result or identity.
 useEffect(()=>{alive.current=true;seq.current++;setSource(null);setReading(false);return()=>{alive.current=false;seq.current++;};},[e?.resultMessageId,e?.status]);
 useEffect(()=>{if(error)(selectionError.current?first:alert).current?.focus();},[error]);
 async function submit(){selectionError.current=false;setError('');if(!ids.length){selectionError.current=true;setError('请选择需要解读的结果组，最多6组。');return;}const signature=JSON.stringify({runId:run.id,resultHash:run.resultHash,ids});if(request.current?.signature!==signature)request.current={signature,body:{baseRunVersion:run.runVersion,resultHash:run.resultHash,evidenceIds:ids,requestKey:'crf-interpret-'+crypto.randomUUID()}};if(await onSubmit(request.current.body))request.current=null;}
 async function readSource(ref){if(reading||!api||!e)return;const token=++seq.current;selectionError.current=false;setReading(true);setSource(null);setError('');try{const s=await api.get('/sessions/'+e.sessionId+'/knowledge-sources/'+e.resultMessageId+'/'+(ref.kind==='method'?'M':'')+ref.index);if(alive.current&&seq.current===token)setSource(s);}catch(err){if(alive.current&&seq.current===token){if([401,403].includes(err.status))onRestricted(err.message);else setError(err.message);}}finally{if(alive.current&&seq.current===token)setReading(false);}}
 return <Card title="AI方法结果解读"><p>仅解释显式选定的方法结果与局限；模型不接收原始答案、科学数值或人工阈值，不自动更正或判断疗效。</p><p>模型用量统一计入租户及账号 Token 额度，按实际用量结算。</p>
 {run.quota?.blocked&&<p role="status">{run.quota.message}</p>}
 {run.aiHold==='terminal-run-binding-review'&&<p role="status" className="ep-notice">AI解读暂不可用，尚未调用模型；当前方法结果仍可查看。</p>}
 {run.aiHold==='model-output-citation-review'&&<p role="status" className="ep-notice">此前AI回答未通过来源核验，未交付解读；用量记录保留，不会自动重试。</p>}
 {run.sourceStatus!=='current'&&<p className="ep-notice">当前来源已过期，不能请求新解释。历史候选仅用于核对。</p>}
 <fieldset disabled={!canRun}><legend>选择需要解读的结果组（1–6组）</legend>{run.result.evidenceGroups.map((g,i)=><label className="crf-ai-choice" key={g.evidenceId}><input ref={i===0?first:undefined} type="checkbox" checked={ids.includes(g.evidenceId)} disabled={!ids.includes(g.evidenceId)&&ids.length>=6} onChange={ev=>{setError('');setIds(old=>ev.target.checked?[...old,g.evidenceId]:old.filter(id=>id!==g.evidenceId));}}/><span>{g.visitLabel} / {g.fieldLabel}</span></label>)}</fieldset>
 <div className="ep-actions"><Button primary loading={busy} disabled={!canRun} onClick={()=>void submit()}>发起AI方法解读（计入Token用量）</Button></div>
 {!canRun&&!pending&&!busy&&<p>解读受结果状态、使用授权与额度限制；未解读不代表已通过。</p>}
 {error&&<p ref={alert} tabIndex={-1} role="alert" className="ep-error">{error}</p>}
 {pending&&<p role="status">{run.job.status==='queued'?"已排队，等待解读。":"正在检索来源并解读结果。"} 数据或来源变化后旧解释不交付，不自动重试。</p>}
 {run.job?.status==='failed'&&<p role="alert" className="ep-error">{run.job.errorMessage}</p>}{run.aiStatus==='restricted'&&<p role="alert">{run.aiMessage}</p>}
 {e&&<section aria-label="真实AI方法解释"><p role="status">{e.status==='current'?'当前方法解释候选，待本人核对':'历史方法解释已过期，不代表当前数据'}</p><p className="ep-meta">消息 {e.resultMessageId} · 运行 {e.binding.runId}</p><div className="ep-reading">{e.items.map((item,i)=><article key={i}><p>{item.explanation}</p>{item.question&&<p>{item.question}</p>}<div className="ep-actions">{item.sourceRefs.map(ref=><Button key={ref.kind+ref.index} disabled={reading} onClick={()=>void readSource(ref)}>查看{ref.kind==='method'?'方法':'文献'}来源 [{ref.kind==='method'?'M':''}{ref.index}]</Button>)}</div></article>)}</div>
 {reading&&<p role="status">正在重新核对来源授权与原版本…</p>}{source&&<section className="ep-reading" aria-label="已重验的解释来源"><h3>{source.kind==='method'?'实际方法来源':'原始文献片段'} [{source.kind==='method'?'M':''}{source.index}]</h3>{source.kind==='method'?<><p>{source.evidence.visitLabel} / {source.evidence.fieldLabel}：记录数 {source.evidence.n}，缺失数 {source.evidence.nMissing}，缺失比例 {source.evidence.missingRate}。数值来自实际冻结方法，不由AI计算。</p><p className="ep-meta">运行 {source.runId} · 输入 {source.inputHash} · 结果 {source.resultHash}</p></>:<><p>{source.quote}</p><p className="ep-meta">{source.docTitle} · 版本 {source.version} · {source.chunkId}</p></>}<p>{source.status==='current'?'当前授权的原来源':'原版本历史来源，不自动替换为新片段'}</p></section>}</section>}
 {!e&&!pending&&!run.job&&<p>尚无本次方法的AI解释。</p>}
 </Card>;
}
