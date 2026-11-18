import React,{useEffect,useRef,useState} from 'react';
import {Button,Card} from './Components.jsx';
import GuidanceClauseDetails from './GuidanceClauseDetails.jsx';
import {buildGuidanceCitationAdd,citationSelectionDirty} from '../../src/guidance-plan-citation.js';
import './guidance-plan-citations.css';

const empty=()=>({paragraph:'',documentId:'',clauseId:'',purpose:'design_check',confirmed:false});
const sourceKey=data=>JSON.stringify(data?.sources?.map(s=>[s.documentId,s.reviewVersion,s.clauseDetails.extractionId,s.clauseDetails.payloadSha256,s.clauseDetails.reviewVersion]));
export default function ResearchDesignGuidanceCitations({view,client,busy,readOnly,onDirty,onSave,onRefresh,onAccessLost}){
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[history,setHistory]=useState(''),[selection,setSelection]=useState(empty),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retryPayload,setRetryPayload]=useState(null);
 const sequence=useRef(0),reading=useRef(null),alive=useRef(true),dataRef=useRef(null),busyRef=useRef(busy),errorRef=useRef(null);
 busyRef.current=busy;
 function choose(next){setRetryPayload(null);setSelection(next);onDirty(citationSelectionDirty(next));}
 function invalidate(){sequence.current++;reading.current=null;dataRef.current=null;setData(null);setLoading(false);}
 function unconfirm(){setSelection(s=>({...s,confirmed:false}));}
 async function load(clear=false){
  if(busyRef.current||!client)return;if(reading.current&&!clear)return;
  if(clear){invalidate();unconfirm();}
  const token=++sequence.current;reading.current=token;setLoading(true);
  try{
   const result=await client.get('/research-plan-drafts/'+view.id+'/guidance-citations'+(history?'?versionNo='+history:''));
   if(!alive.current||token!==sequence.current)return;
   if(result.id!==view.id||!Number.isSafeInteger(result.version)||!Number.isSafeInteger(result.currentVersion))throw Error('引用响应与当前草稿不一致，未显示正文。');
   if(result.sourceStatus==='restricted'){invalidate();onAccessLost(Object.assign(Error(result.message),{status:403}));return;}
   if(!Array.isArray(result.sources)||!Array.isArray(result.paragraphs)||!Array.isArray(result.citations))throw Error('引用响应结构无效，未显示正文。');
   if(!history&&result.version!==view.version){invalidate();setError('服务端方案已有新版本。请先核对或放弃未保存选择，再刷新设计；不会自动改绑段落。');onRefresh();return;}
   if(dataRef.current&&sourceKey(dataRef.current)!==sourceKey(result))unconfirm();
   dataRef.current=result;setData(result);setError('');
  }catch(e){if(alive.current&&token===sequence.current){dataRef.current=null;setData(null);unconfirm();setError(e.message);if([401,403].includes(e.status))onAccessLost(e);}}
  finally{if(alive.current&&token===sequence.current){reading.current=null;setLoading(false);}}
 }
 useEffect(()=>{choose(empty());setHistory('');invalidate();},[view.id,view.version]);
 useEffect(()=>{
  if(!open)return;void load(true);
  const refresh=()=>{if(document.visibilityState!=='hidden')void load(true);else{invalidate();unconfirm();}},auth=()=>{invalidate();onAccessLost(Object.assign(Error('身份已变化，请重新核对本人方案。'),{status:401}));};
  const timer=setInterval(()=>void load(),3000);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('qiyan:auth-changed',auth);
  return()=>{sequence.current++;reading.current=null;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('qiyan:auth-changed',auth);};
 },[open,history,view.id,view.version,client]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;onDirty(false);};},[]);
 useEffect(()=>{onDirty(citationSelectionDirty(selection)||!!retryPayload);},[selection,retryPayload,onDirty]);
 useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
 const paragraph=data?.paragraphs?.[Number(selection.paragraph)],source=data?.sources.find(s=>s.documentId===selection.documentId),clause=source?.clauseDetails.clauses.find(c=>c.id===selection.clauseId);
 const disabled=busy||readOnly||loading||!!retryPayload||!data?.canEdit||data.version!==view.version;
 async function save(payload){
  // A remove has no form choices, but an uncertain write must still pin its original CAS/key.
  onDirty(true);const result=await onSave(payload);
  if(!alive.current)return;
  if(result?.ok===false&&(result.status===0||result.status>=500))setRetryPayload(payload);
  else if(result?.ok===false)onDirty(citationSelectionDirty(selection));
 }
 async function submit(event){event.preventDefault();if(disabled)return;try{const payload=buildGuidanceCitationAdd(data,selection);setError('');await save(payload);}catch(e){setError(e.message);}}
 function changeHistory(value){if((citationSelectionDirty(selection)||retryPayload)&&!window.confirm('切换引用历史将放弃本面板尚未保存的选择和未确认提交的重试，是否继续？'))return;choose(empty());invalidate();setHistory(value);}
 return <Card title="指南／标准人工引用" className="design-panel citation-panel">
  <p>把已保存方案段落与已审核条款建立人工引用关系；不改正文，不调用AI，不代表条款已证明方案有效。</p>
  <details open={open} onToggle={event=>{const next=event.currentTarget.open;setOpen(next);if(!next){invalidate();unconfirm();}}}>
   <summary>核对并管理方案条款引用</summary>
   {error&&<p role="alert" ref={errorRef} tabIndex={-1} className="design-error">{error}</p>}
   {retryPayload&&<div><p>上次提交结果尚未确认。此入口只重发完全相同的操作与原请求键，不另建引用；核对前不接受新的引用操作。</p><Button disabled={busy} onClick={()=>void save(retryPayload)}>重试上次未确认提交（不新增操作）</Button><Button disabled={busy} onClick={()=>{if(window.confirm('仅放弃重试，不撤销可能已保存的操作；随后读取当前已保存版本，是否继续？')){choose(empty());onRefresh();}}}>放弃重试并核对当前版本</Button></div>}
   {loading&&<p role="status">正在重新核对方案版本及当前来源审核…</p>}
   {!data&&!loading&&<Button onClick={()=>void load(true)} disabled={busy}>重试读取引用</Button>}
   <label className="citation-label">引用记录版本<select aria-label="引用记录版本" value={history} disabled={busy||loading} onChange={e=>changeHistory(e.target.value)}><option value="">当前方案版本 v{view.version}</option>{(data?.versions??view.versions??[]).map(v=><option key={v.versionNo} value={String(v.versionNo)}>历史 v{v.versionNo} · 只读</option>)}</select></label>
   {data&&<>
    <p>正在核对 v{data.version}；当前服务端 v{data.currentVersion}。{data.readOnly?'固定历史，只读。':data.canEdit?'仅本人当前草稿可修改。':'方案来源、阶段或任务状态要求只读。'}</p>
    <h3>已保存引用（{data.citations.length} / 12）</h3>
    {!data.citations.length&&<p role="status">此版本尚无人工引用，不自动补入示例或AI证据。</p>}
    <ul className="citation-list">{data.citations.map(ref=><li key={ref.citationId}>
     <p>{ref.purpose==='background'?'研究背景':'方案核对依据'} · 建立于方案 v{ref.planVersion} · {ref.targetStatus==='matched'?'段落匹配':'段落已变化，待重新绑定'}</p>
     {ref.target&&<blockquote className="citation-reading">{ref.target.text}</blockquote>}
     {ref.sourceStatus==='current'?<><h3>{ref.title}</h3><details><summary>核对原始条款与页码</summary><GuidanceClauseDetails details={ref.details}/></details></>:<p role="status">来源当前不可用或审核已变化；不显示旧原文。请到H06重新核对，必要时解除后重新添加。</p>}
     {!data.readOnly&&<Button disabled={disabled||citationSelectionDirty(selection)} onClick={()=>void save({action:'remove',citationId:ref.citationId})}>解除本条引用</Button>}
     {!data.readOnly&&citationSelectionDirty(selection)&&<p>请先保存或清空新增引用的未保存选择，再解除已有引用。</p>}
    </li>)}</ul>
    {!data.readOnly&&<form onSubmit={submit} className="citation-form">
     <h3>新增人工引用</h3>
     <p>保存或解除会新增方案版本，既有AI建议、执行准备、试跑及报告可能保留为旧基准；不会自动重绑、重算或调用AI。</p>
     <fieldset disabled={disabled}><legend>核对目标与依据</legend>
      <label>已保存方案段落<select aria-label="已保存方案段落" value={selection.paragraph} onChange={e=>choose({...selection,paragraph:e.target.value,confirmed:false})}><option value="">请选择完整段落</option>{data.paragraphs.map((p,i)=><option key={p.start} value={String(i)}>段落 {i+1} · 字符 {p.start}–{p.end}</option>)}</select></label>
      {selection.paragraph!==''&&paragraph&&<div><h4>目标段落全文</h4><blockquote className="citation-reading">{paragraph.text}</blockquote></div>}
      <label>指南或研究标准<select aria-label="指南或研究标准" value={selection.documentId} onChange={e=>choose({...selection,documentId:e.target.value,clauseId:'',confirmed:false})}><option value="">请选择当前获准来源</option>{data.sources.map(s=><option key={s.documentId} value={s.documentId}>{s.externalKey}</option>)}</select></label>
      {source&&<p className="citation-source-title">完整来源：{source.title}</p>}
      <label>关键条款<select aria-label="关键条款" value={selection.clauseId} onChange={e=>choose({...selection,clauseId:e.target.value,confirmed:false})}><option value="">请选择条款</option>{source?.clauseDetails.clauses.map(c=><option key={c.id} value={c.id}>{c.heading}</option>)}</select></label>
      {source&&clause&&<GuidanceClauseDetails details={{...source.clauseDetails,clauses:[clause]}}/>}
      <label>引用用途<select aria-label="引用用途" value={selection.purpose} onChange={e=>choose({...selection,purpose:e.target.value,confirmed:false})}><option value="design_check">方案核对依据</option><option value="background">研究背景</option></select></label>
      <label className="citation-confirm"><input type="checkbox" checked={selection.confirmed} onChange={e=>choose({...selection,confirmed:e.target.checked})}/>我已核对完整目标段落、条款原文、章节及页码，确认用于本人方案核对，不作为疗效证明。</label>
      <div className="design-actions"><Button type="submit" primary disabled={data.citations.length>=12}>保存人工引用（不调用AI）</Button><Button onClick={()=>choose(empty())} disabled={!citationSelectionDirty(selection)}>清空本面板选择</Button></div>
     </fieldset>
     {!data.sources.length&&<p role="status">暂无当前获准条款。请由Hub管理员核对来源展示审核，不会自行授权。</p>}
     {disabled&&<p>当前只读、正在核验或其他表单有未保存修改，请先完成核对。</p>}
    </form>}
    <p><a href="/pages/h06/">到H06核对指南与研究标准</a>；仅局部已审核摘录，不提供整本下载或AI自动引用。</p>
   </>}
  </details>
 </Card>;
}
