import React,{useState} from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import {Button} from './Components.jsx';
import {makeCatalogAssetUrl} from '../../src/research-assets-catalog-session.js';
import './research-assets-registration.css';
const labels={submit:'提交审核',review:'审核资产',release:'发布摘要',withdraw:'撤回发布'};
export default function ResearchAssetGovernanceDialog({model:m,scope,onChange,onSave,onLookup,onClose,onDiscard,returnFocus,unavailable}){
 const [discard,setDiscard]=useState(false);if(!m.open)return null;
 if(discard)return <ConfirmDialog title="放弃未保存的操作输入？" confirmLabel="放弃输入" onCancel={()=>setDiscard(false)} onConfirm={()=>{setDiscard(false);onDiscard();}}><p>只清空本次输入，不撤销已保存的结论或资产。</p></ConfirmDialog>;
 const action=m.target?.action,o=unavailable?null:m.options,d=m.draft,busy=['loading','submitting'].includes(m.phase),done=['committed','absent'].includes(m.phase),unknown=m.phase==='unknown',locked=m.phase!=='editing';
 const check=(key,text)=><label className="asset-governance-check"><input type="checkbox" checked={d[key]} onChange={e=>onChange({[key]:e.target.checked})}/><span>{text}</span></label>;
 return <ConfirmDialog title={labels[action]??'核对资产操作'} busy={busy} danger={action==='withdraw'} returnFocus={returnFocus} cancelLabel={done?'关闭':'关闭，保留输入'} confirmLabel={done?'完成':unknown?'核对操作结果':m.phase==='retryable'?'原输入重试':labels[action]??'确认'} confirmDisabled={unavailable&&!done||!done&&!unknown&&(['error','invalid'].includes(m.phase))} onCancel={onClose} onConfirm={done?onClose:unknown?onLookup:onSave}>
  <div className="asset-registration-form">
   {m.message&&<p role={m.phase==='committed'?'status':'alert'}>{m.message}</p>}
   {unavailable&&!done&&<p role="alert">当前资产状态未核对，暂不能保存；输入已保留。</p>}
   {o&&d&&<><h3>{o.title} · v{m.target.version}</h3><p>{o.summary}</p><p><a href={makeCatalogAssetUrl(scope,m.target.assetId,m.target.version)} target="_blank" rel="noopener">核对固定版正文与来源</a></p>
    <details><summary>来源与用途依据</summary><p>{o.rightsEvidence||'尚未提供'}</p></details>
    {!o.sourceValid&&<p role="alert">来源当前不可用，不能通过审核或发布；可退回修订或停止使用。</p>}
    <fieldset disabled={locked}>
     {action==='submit'&&<p>提交当前固定版供管理员审核。后续修订不会替换本次待审内容。</p>}
     {action==='review'&&<><label>审核结论<select name="conclusion" value={d.conclusion} onChange={e=>onChange({conclusion:e.target.value})}><option value="approved" disabled={!o.sourceValid}>通过</option><option value="changes_requested">退回修订</option></select></label>{d.conclusion==='approved'&&<>{check('contentChecked','已核对本固定版内容')}{check('rightsChecked','已核对来源与允许用途')}{o.selfReview&&check('selfReviewAcknowledged','本次为本人内容审核，将明确记录')}</>}</>}
     {action==='release'&&<><p>仅向所选人员开放此版题名和摘要，不授予正文、引用或AI使用权。</p><fieldset><legend>可发现摘要的人</legend>{o.recipients.map(a=><label className="asset-governance-check" key={a.accountId}><input type="checkbox" checked={d.discoveryRecipients.includes(a.accountId)} onChange={e=>onChange({discoveryRecipients:e.target.checked?[...d.discoveryRecipients,a.accountId]:d.discoveryRecipients.filter(x=>x!==a.accountId)})}/><span>{a.displayName}</span></label>)}</fieldset><label>有效天数<input name="ttlDays" type="number" min="1" max="7" value={d.ttlDays} onChange={e=>onChange({ttlDays:Number(e.target.value)})}/></label></>}
     {action==='withdraw'&&<p>停止此版摘要发现及已有正文、引用许可，待处理申请一并失效；历史记录保留。</p>}
     {action!=='submit'&&<label>操作理由 *<textarea name="governanceReason" maxLength={2000} rows={3} value={d.reason} onChange={e=>onChange({reason:e.target.value})}/></label>}
    </fieldset>
   </>}
   {m.dirty&&!busy&&!unknown&&<Button danger onClick={()=>setDiscard(true)}>放弃输入</Button>}
  </div>
 </ConfirmDialog>;
}
