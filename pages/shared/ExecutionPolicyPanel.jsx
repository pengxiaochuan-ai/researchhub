import React,{useState} from 'react';
import {Button,Card} from './Components.jsx';
import {POLICY_SECTIONS,policyDraftBody,policyMissing} from '../../src/execution-policy-session.js';
const statusText={missing:'待确认',configured:'已填写',not_applicable:'不适用'};
export default function ExecutionPolicyPanel({policy,sections,canEdit=false,busy=false,dirty=false,unknown=false,error='',onChange=()=>{},onSave=()=>{},onRetry=()=>{}}){
 const [localError,setLocalError]=useState('');
 const change=(key,fn)=>{const next=structuredClone(sections);fn(next[key]);setLocalError('');onChange(next);};
 const submit=event=>{event.preventDefault();try{onSave(policyDraftBody(policy,sections));setLocalError('');}catch(e){setLocalError(e.message);}};
 const missing=policyMissing(sections);
 return <Card title="研究政策与责任" className="ep-policy"><p>{policy?'政策版本 v'+policy.versionNumber+' · '+(policy.status==='draft'?'草稿':'已固定'):'尚未保存政策草稿'}</p>
 {policy&&<p>记录人：{policy.createdByName||'已记录'} · 记录时间：{policy.createdAt||'待确认'}{policy.reviewedAt?' · 审核人：'+(policy.reviewedByName||'已记录')+' · 审核时间：'+policy.reviewedAt:''}</p>}
 {policy&&(policy.createdBy||policy.reviewedBy)&&<details><summary>责任记录详情</summary><p>记录账号：{policy.createdBy||'待确认'}{policy.reviewedBy?' · 审核账号：'+policy.reviewedBy:''}</p></details>}
 {missing.length?<p>待确认：{missing.map(x=>x.label).join('、')}</p>:<p>已填写各项状态；仍需核对内容与启动条件。</p>}
 {(localError||error)&&<p role="alert" className="ep-error">{localError||error}{dirty?' 当前输入已保留。':''}</p>}
 <form onSubmit={submit}><fieldset disabled={!canEdit||busy||unknown}>{POLICY_SECTIONS.map(({key,label,fields})=>{const s=sections[key];return <details key={key}><summary>{label} · {statusText[s.status]}</summary><fieldset><legend>{label}</legend>{policy?.sections?.[key]?.decidedBy&&<p>记录人：{policy.sections[key].decidedByName||'已记录'} · 记录时间：{policy.sections[key].decidedAt||'待确认'}</p>}{policy?.sections?.[key]?.decidedBy&&<details><summary>记录详情</summary><p>记录账号：{policy.sections[key].decidedBy}</p></details>}
 <label className="ep-label">状态<select aria-label={label+'状态'} value={s.status} onChange={e=>change(key,x=>{x.status=e.target.value;})}><option value="missing">待确认</option><option value="configured">已填写</option><option value="not_applicable">不适用</option></select></label>
 {s.status!=='missing'&&<><label className="ep-label">依据<input aria-label={label+'依据'} value={s.source} onChange={e=>change(key,x=>{x.source=e.target.value;})}/></label><label className="ep-label">{s.status==='not_applicable'?'不适用理由':'依据说明'}<textarea aria-label={label+(s.status==='not_applicable'?'不适用理由':'依据说明')} rows="2" value={s.reason} onChange={e=>change(key,x=>{x.reason=e.target.value;})}/></label>{s.status==='configured'&&<>{key==='site'&&<label className="ep-label">中心范围<select aria-label="中心范围" value={s.mode??''} onChange={e=>change(key,x=>{x.mode=e.target.value;})}><option value="">待确认</option><option value="study_wide">当前研究授权范围</option></select></label>}{fields.map(([name,text])=>name==='reviewIndependence'?<label key={name} className="ep-label">{text}<select aria-label={label+text} value={s.rules[name]} onChange={e=>change(key,x=>{x.rules[name]=e.target.value;})}><option value="">待确认</option><option value="required">需要独立审核</option><option value="not_required">不要求独立审核</option></select></label>:<label key={name} className="ep-label">{text}<textarea aria-label={label+text} rows="2" value={s.rules[name]} onChange={e=>change(key,x=>{x.rules[name]=e.target.value;})}/></label>)}</>}</>}
 </fieldset></details>;})}</fieldset>{canEdit&&<div className="ep-actions"><Button primary={dirty} type="submit" disabled={busy||unknown||!dirty} loading={busy}>保存政策草稿</Button>{unknown&&<Button onClick={onRetry} disabled={busy}>核对上次保存结果</Button>}</div>}</form></Card>;
}
