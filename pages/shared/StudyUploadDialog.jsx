import React from 'react';import ConfirmDialog from './ConfirmDialog.jsx';import {Button} from './Components.jsx';import './StudyUploadDialog.css';
export default function StudyUploadDialog({draft,onChange,onCancel,onUpload,onReload}){
 if(!draft)return null;
 return <ConfirmDialog title="上传研究数据" danger={false} confirmLabel="上传并检查" busy={draft.submitting} confirmDisabled={draft.loading||!draft.studyId||Boolean(draft.error)} onCancel={onCancel} onConfirm={onUpload} returnFocus={draft.returnFocus}>
  <div className="agent-study-upload"><ul aria-label="本次选择的文件">{draft.files.map((f,i)=><li key={i}>{f.name}</li>)}</ul>
   {draft.loading?<p role="status">正在读取可用研究…</p>:<label>归属研究<select value={draft.studyId} disabled={draft.submitting||Boolean(draft.pinnedStudyId)} onChange={e=>onChange(e.target.value)}><option value="">请选择研究</option>{draft.targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
   {!draft.loading&&!draft.targets.length&&!draft.error&&<p>当前没有可导入的研究，请联系研究负责人核对上传权限。</p>}
   {!draft.loading&&draft.pinnedStudyId&&!draft.studyId&&<p role="alert">原上传对应的研究当前不可用，请先核对原上传结果。</p>}
   {draft.error&&<p role="alert">{draft.error} <Button disabled={draft.loading||draft.submitting} onClick={onReload}>重新读取研究</Button></p>}
   <p>文件上传后自动检查，确认导入后才会更新被试档案。</p>
  </div>
 </ConfirmDialog>;
}
