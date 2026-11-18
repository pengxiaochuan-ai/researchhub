import React from 'react';
import {Button} from './Components.jsx';
export default function FullStudyReviewProgress({operation,busy,onCheck,onContinue}){
 if(!operation)return null;
 const p=operation.progress,done=operation.status==='completed';
 return <div className="full-study-review-progress"><p role="status">{done?'审核已完成':operation.status==='blocked'?'审核已停止':'正在审核'}，已完成 {p.completed}/{p.total}{operation.status==='blocked'?' · 当前已停止，请核对原因。':''}</p><progress aria-label="本次实际审核进度" max={Math.max(1,p.total)} value={p.completed}/>{!done&&<><p>离开页面会停止后续审核；当前已受理批次可能完成，可在返回后核对。</p><div className="ep-actions"><Button disabled={busy} onClick={onCheck}>核对审核进度</Button>{operation.canContinue&&<Button primary disabled={busy} onClick={onContinue}>继续审核</Button>}</div></>}</div>;
}
