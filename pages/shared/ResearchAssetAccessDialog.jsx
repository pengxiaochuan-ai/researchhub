import React,{useState} from 'react';import ConfirmDialog from './ConfirmDialog.jsx';import {Button} from './Components.jsx';
import './research-assets-registration.css';
const labels={request:'申请使用',share:'指定共享',manage:'用途申请与许可',decide:'处理用途申请',revoke:'撤销使用许可',cite:'引用此资产'};
const purposes={read_body:'阅读正文',cite:'书目引用',comment:'评论讨论',download:'附件下载',ai:'AI解读',derive:'创建副本',apply:'应用为方案',export:'Markdown导出'},states={pending:'待处理',approved:'已授予',rejected:'已拒绝',revoked:'已撤销'};
export default function ResearchAssetAccessDialog({model:m,onChange,onChoose,onSave,onLookup,onCopy,onClose,onDiscard,returnFocus,unavailable}){
 const [discard,setDiscard]=useState(false);if(!m.open)return null;
 if(discard)return <ConfirmDialog title="放弃未保存的用途输入？" confirmLabel="放弃输入" onCancel={()=>setDiscard(false)} onConfirm={()=>{setDiscard(false);onDiscard();}}><p>仅清空本次输入，不删除或撤销已保存的申请、许可和引用记录。</p></ConfirmDialog>;
 const o=unavailable?null:m.options,d=m.draft,action=m.target?.action,done=['committed','absent'].includes(m.phase),busy=['loading','submitting'].includes(m.phase),unknown=m.phase==='unknown',locked=m.phase!=='editing',manage=action==='manage';
 const req=o?.requests.find(r=>r.requestId===m.target.requestId),name=id=>o?.actors.find(a=>a.accountId===id)?.displayName??'接收人';
 const expires=r=>Date.parse(r.expiresAt)<=Date.now(),checkActions=req?.requestedActions??o?.allowedActions??['read_body','cite'];
 return <ConfirmDialog title={labels[action]??'核对用途操作'} returnFocus={returnFocus} busy={busy} danger={action==='revoke'} cancelLabel={done||manage?'关闭':'关闭，保留输入'} confirmLabel={manage?'关闭':done?m.citation?'复制引用':'完成':unknown?'核对操作结果':m.phase==='retryable'?'原输入重试':action==='cite'?'生成引用':labels[action]??'确认'} confirmDisabled={unavailable&&(!done||Boolean(m.citation))||!done&&!unknown&&(m.phase==='error')} onCancel={onClose} onConfirm={manage?onClose:done?m.citation?onCopy:onClose:unknown?onLookup:onSave}>
  <div className="asset-registration-form">
   {m.message&&<p role={m.phase==='committed'?'status':'alert'}>{m.message}</p>}
   {unavailable&&!done&&<p role="alert">当前资产状态未核对，暂不能提交；输入已保留。</p>}
   {o&&<><h3>{o.title} · v{m.target.version}</h3>{!o.sourceValid&&<p role="alert">来源当前不可用，不能新增许可或引用；已有许可可撤销。</p>}
    {manage?<div>{o.requests.length?o.requests.map(r=><div className="form-block" key={r.requestId}><p><b>{name(r.recipientAccountId)}</b> · {expires(r)&&['pending','approved'].includes(r.state)?'已到期':states[r.state]} · {new Date(r.expiresAt).toLocaleString('zh-CN',{hour12:false})}</p><p>{r.purpose} · {r.requestedActions.map(a=>purposes[a]).join('、')}</p>{o.canManage&&!expires(r)&&r.state==='pending'&&<Button onClick={()=>onChoose('decide',r.requestId)}>处理申请</Button>}{o.canManage&&['pending','approved'].includes(r.state)&&<Button onClick={()=>onChoose('revoke',r.requestId)}>撤销许可</Button>}</div>):<p>暂无用途申请或许可。</p>}</div>:d&&<fieldset disabled={locked}>
     {req&&<><p>接收人：{name(req.recipientAccountId)}</p><p>原申请用途：{req.purpose}；有效至 {new Date(req.expiresAt).toLocaleString('zh-CN',{hour12:false})}</p></>}
     {action==='share'&&<label>接收人<select name="usageRecipient" value={d.recipientAccountId} onChange={e=>onChange({recipientAccountId:e.target.value})}><option value="">请选择</option>{o.recipients.map(a=><option value={a.accountId} key={a.accountId}>{a.displayName}</option>)}</select></label>}
     {action==='decide'&&<label>处理结论<select name="usageConclusion" value={d.conclusion} onChange={e=>onChange({conclusion:e.target.value})}><option value="approved">批准所选用途</option><option value="rejected">拒绝申请</option></select></label>}
     {['request','share','decide'].includes(action)&&!(action==='decide'&&d.conclusion==='rejected')&&<fieldset><legend>{action==='decide'?'批准用途':'所需用途'}</legend>{checkActions.map(a=><label className="asset-governance-check" key={a}><input type="checkbox" checked={d.actions.includes(a)} onChange={e=>onChange({actions:e.target.checked?[...d.actions,a]:d.actions.filter(x=>x!==a)})}/><span>{purposes[a]}</span></label>)}<p>只授予明确选中的用途；未选择的用途不会获得授权。</p></fieldset>}
     {['request','share'].includes(action)&&<><label>使用目的 *<textarea name="usagePurpose" value={d.purpose} maxLength={2000} rows={3} onChange={e=>onChange({purpose:e.target.value})}/></label><label>有效天数<input name="usageDays" type="number" min="1" max="7" value={d.ttlDays} onChange={e=>onChange({ttlDays:Number(e.target.value)})}/></label><p>最长7天，且不晚于本版发布期限。</p></>}
     {['share','decide','revoke'].includes(action)&&<label>处理理由 *<textarea name="usageReason" value={d.reason} maxLength={2000} rows={3} onChange={e=>onChange({reason:e.target.value})}/></label>}
     {action==='revoke'&&<p>停止此许可所列用途的后续使用，历史记录保留。账号本身已有的管理员权限不受此操作改变。</p>}
     {action==='cite'&&<p>生成本固定版的书目引用，不附带正文摘录；再次复制同条引用不会重复记数。</p>}
    </fieldset>}
   </>}
   {!unavailable&&m.citation&&<label>已生成的书目信息<textarea readOnly rows={4} value={m.citation.text+' '+m.citation.url}/></label>}
   {m.dirty&&!busy&&!unknown&&<Button danger onClick={()=>setDiscard(true)}>放弃输入</Button>}
  </div>
 </ConfirmDialog>;
}
