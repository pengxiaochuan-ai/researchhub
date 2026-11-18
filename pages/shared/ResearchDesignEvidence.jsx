import React,{useEffect,useRef,useState} from 'react';
import {Card,Button} from './Components.jsx';
import {validateEvidenceEdits} from '../../src/research-design-session.js';

export default function ResearchDesignEvidence({view,busy,readOnly,onDirty,onSave}){
 const rows=view.evidence?.rows??[],[drafts,setDrafts]=useState(()=>Object.fromEntries(rows.map(r=>[r.rowId,{decision:r.decision,reason:r.reason??''}]))),[errors,setErrors]=useState({}),[notice,setNotice]=useState('');
 const refs=useRef({}),checked=validateEvidenceEdits(rows,drafts);
 useEffect(()=>{onDirty(false);return()=>onDirty(false);},[]);
 function change(id,key,value){const next={...drafts,[id]:{...drafts[id],[key]:value}};setDrafts(next);setNotice('');const result=validateEvidenceEdits(rows,next);onDirty(result.changes.length>0);if(!result.errors[id])setErrors(old=>{const copy={...old};delete copy[id];return copy;});}
 function submit(event){event.preventDefault();const result=validateEvidenceEdits(rows,drafts);setErrors(result.errors);if(!result.valid){refs.current[Object.keys(result.errors)[0]]?.focus();return;}if(!result.changes.length){setNotice('没有未保存的证据处置，不新增重复版本。');return;}void onSave(result.changes);}
 return <Card title="固定资料证据核对" className="design-panel">
  <p>{view.assetReuse?'当前依据为来源资产固定版本，未继承知识资料片段或AI证据结论。':<>仅覆盖本草稿选定的 {view.coverage.selectedFragments} 个审核片段，不代表整库、全文或系统综述。AI归纳仍待本人核对，处置不改变知识资料审核状态。</>}</p>
  {!rows.length?<p>尚无真实证据候选。请先保存本人方案，再显式整理证据；不会自动调用模型。</p>:<form className="design-evidence-form" onSubmit={submit} noValidate>
   <p className="design-meta">结果消息：{view.evidence.resultMessageId} · 处置修订 {view.evidenceDecisionRevision} · {view.evidence.status==='current'?'当前输入有效':'历史结果，输入已变化'}</p>
   {rows.map((row,index)=><fieldset key={row.rowId} disabled={busy||readOnly}>
    <legend>证据候选 {index+1} · {({support:'支持信息',contrast:'相反信息',context:'背景或方法提示',unknown:'所查片段未报告'})[row.relation]}</legend>
    <p className="design-reading">{row.claim}</p><p>局限：{row.limitation||'本行未补充局限，请结合原文核对。'}</p>
    {row.sourceRefs.map(ref=>{const source=view.sources.find(s=>s.chunkId===ref.sourceId);return <details key={ref.sourceId+':'+ref.start}><summary>核对来源 [{ref.sourceNumber}]《{source?.docTitle??'已封存片段'}》· v{source?.version}</summary><blockquote className="design-reading">{ref.quote}</blockquote><p className="design-meta">{source?.page?'来源页：'+source.page:'仅片段定位，未提供页码'} · 字符区间 {ref.start}–{ref.end}</p><p className="design-meta">分块：{ref.sourceId}<br/>摘录SHA256：{ref.hash}</p></details>;})}
    <label htmlFor={'evidence-decision-'+row.rowId}>本人证据处置</label><select id={'evidence-decision-'+row.rowId} value={drafts[row.rowId].decision} onChange={e=>change(row.rowId,'decision',e.target.value)}><option value="needs_verification">待核验</option><option value="include">纳入当前设计依据</option><option value="exclude">排除</option><option value="background">仅作背景</option></select>
    <label htmlFor={'evidence-reason-'+row.rowId}>处置理由</label><textarea id={'evidence-reason-'+row.rowId} ref={e=>{refs.current[row.rowId]=e;}} rows={2} maxLength={1000} value={drafts[row.rowId].reason} aria-invalid={Boolean(errors[row.rowId])} aria-describedby={'evidence-help-'+row.rowId+(errors[row.rowId]?' evidence-error-'+row.rowId:'')} onChange={e=>change(row.rowId,'reason',e.target.value)}/>
    <p id={'evidence-help-'+row.rowId}>排除、仅背景或待核验须填写理由；纳入可附说明。只保存本人明确修改的行，其他行不自动处置。</p>
    {errors[row.rowId]&&<p id={'evidence-error-'+row.rowId} role="alert" className="design-error">{errors[row.rowId]}</p>}
   </fieldset>)}
   <Button type="submit" primary disabled={busy||readOnly||!checked.changes.length} loading={busy}>保存证据处置</Button><p>{readOnly?'当前只读；请先核对来源、版本或正在执行的任务。':checked.changes.length?'修改尚未保存，提交后新增已保存版本。':'当前没有未保存的证据处置。'}</p>{notice&&<p role="status">{notice}</p>}
  </form>}
 </Card>;
}
