import React,{useEffect,useRef,useState} from 'react';
import {AIPanel,Button} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import {reportQaPath,reportQaHref} from '../../src/report-asset-qa.js';
export default function ReportAssetQaPanel({asset,scope,user,api,blocked,onAccessLost,pendingRef,canOpen}){
 const[value,setValue]=useState(null),[error,setError]=useState(''),[tick,setTick]=useState(0),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(null);const turn=useRef(0),pending=useRef(false),request=useRef(null),apiRef=useRef(api);apiRef.current=api;
 pendingRef.current=()=>pending.current;
 useEffect(()=>{const token=++turn.current;if(blocked){setValue(null);return;}apiRef.current.get(reportQaPath(asset.id,asset.version)).then(v=>{if(token===turn.current){setValue(v);setError('');if(request.current&&v.consentRevision>request.current.expectedConsentRevision)request.current=null;}}).catch(e=>{if(token===turn.current){setValue(null);setError(e.message);if([401,403].includes(e.status))onAccessLost?.(e);}});return()=>{turn.current++;};},[asset.id,asset.version,user.accountId,user.authVersion,blocked,tick]);
 async function write(action){
  if(pending.current||blocked||!value||!canOpen())return;pending.current=true;setBusy(true);const token=turn.current;setError('');
  request.current??={action,expectedConsentRevision:value.consentRevision,requestKey:crypto.randomUUID()};
  if(request.current.action!==action){pending.current=false;setBusy(false);setError('请先核对上次用途操作的结果。');return;}
  try{await apiRef.current.post('/research-assets/'+asset.id+'/versions/'+asset.version+'/ai-consents',request.current);if(token===turn.current){request.current=null;setConfirm(null);setTick(x=>x+1);}}
  catch(e){if(token===turn.current){setError(e.message+' 请先重新核对用途状态。');if([401,403].includes(e.status)){setValue(null);onAccessLost?.(e);}}}
  finally{pending.current=false;if(token===turn.current)setBusy(false);}
 }
 return <><AIPanel title="AI 资产解读" action={value?.canSearch?'基于本研究报告提问':value?.canGrant?'启用本研究问答':'基于本研究报告提问'} actionDisabled={busy||blocked||!value||!value.canSearch&&!value.canGrant} onAction={()=>value.canSearch?location.assign(reportQaHref(scope,asset.id,asset.version)):void write('grant')}>
  <div className="form-block asset-ai-content">{error&&<p role="alert">{error}</p>}{!value?<p role="status">{error?'当前AI用途状态无法核对。':'正在核对报告AI用途…'}</p>:<><p>{value.canSearch?'已允许本人基于本研究报告问答。':value.state==='revoked'?'本报告的AI用途已撤销。':value.state==='expired'?'本报告的AI用途已到期。':'仅用于本人在当前研究中的报告问答。'}</p>{value.expiresAt&&<p>有效至 {new Date(value.expiresAt).toLocaleString('zh-CN',{hour12:false})}</p>}<p>问答仅引用此固定版；合成研究结果不作为临床结论。</p>{value.canRevoke&&<Button disabled={busy} onClick={e=>setConfirm(e.currentTarget)}>撤销AI用途</Button>}</>}<Button disabled={busy||blocked} onClick={()=>setTick(x=>x+1)}>重新核对用途状态</Button></div>
 </AIPanel>{confirm&&<ConfirmDialog title="撤销本报告的AI用途？" returnFocus={confirm} busy={busy} confirmLabel="撤销AI用途" onCancel={()=>setConfirm(null)} onConfirm={()=>void write('revoke')}><p>将停止后续问答及受限引用读取；已自行复制的内容无法追回。原报告和资产保持不变。</p></ConfirmDialog>}</>;
}
