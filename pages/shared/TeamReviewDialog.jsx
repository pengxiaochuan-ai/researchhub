import React,{useEffect,useRef} from 'react';
import {Button} from './Components.jsx';
export function TeamReviewControls({reason,onReason,audience,onAudience,disabled}){
 return <div className="team-review-controls"><label>审核展示范围<select aria-label="审核展示范围" value={audience} disabled={disabled} onChange={e=>onAudience(e.target.value)}><option value="tenant">仅租户成员</option><option value="public">公开访客</option></select></label><label>审核备注（选填）<textarea aria-label="审核备注" value={reason} maxLength={2000} disabled={disabled} onChange={e=>onReason(e.target.value)}/></label></div>;
}
export function TeamReviewContent({preview}){
 return <><p>“{preview.data.name}”的团队资料将向未登录访客公开展示。</p>{preview.jointInstitutions?.length>0&&<p>同时公开审核关联机构：{preview.jointInstitutions.map(x=>x.name).join('、')}。</p>}<p>本次涉及{preview.changes.length}项资料变更；不会授予账号或 Study 权限。</p></>;
}
export default function TeamReviewDialog({returnFocus,preview,busy,onClose,onConfirm}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current,trigger=returnFocus??document.activeElement;dialog.showModal();return()=>{dialog.close();if(trigger?.isConnected)trigger.focus();};},[returnFocus]);
 return <dialog ref={ref} className="team-review-dialog" aria-labelledby="team-review-title" aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <h2 id="team-review-title">确认公开展示</h2>
  <TeamReviewContent preview={preview}/>
  {busy&&<p role="status">正在提交审核，请稍候…</p>}
  <div className="team-form-actions"><Button primary disabled={busy} onClick={onConfirm}>确认公开并审核</Button><Button disabled={busy} onClick={onClose}>返回修改</Button></div>
 </dialog>;
}
