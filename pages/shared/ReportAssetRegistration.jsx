import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import './research-assets-registration.css';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
import {canRegisterReportAsset,reportAssetScope,reportAssetReviewUrl,reportAssetDetailUrl,reportAssetSourcePath,C2_REPORT_ID,reportAssetCanEdit,reportAssetWriteUncertain,validC2ReportAssetReceipt} from '../../src/report-asset-context.js';
import {researchAssetIdentityChanged} from '../../src/research-assets-session.js';

export function useReportAssetRegistration({user,studyId,report,scopeKey,disabled=false}){
 const allowed=canRegisterReportAsset({user,studyId,report}),identity=JSON.stringify([user?.accountId,user?.authVersion,user?.role,studyId,scopeKey]);
 const api=useMemo(()=>user?createAssetCatalogClient({user,scope:reportAssetScope}):null,[identity]);
 const [open,setOpen]=useState(false),[phase,setPhase]=useState('idle'),[source,setSource]=useState(null),[draft,setDraft]=useState({purpose:'',limitations:'',rightsEvidence:''}),[dirty,setDirty]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState(null),[leave,setLeave]=useState(null);
 const host=useRef(null),trigger=useRef(null),epoch=useRef(0),pending=useRef(null),bypassLeave=useRef(false);
 const markerKey='rh-report-asset-context:'+identity,unknown=['unknown','retryable'].includes(phase),busy=['loading','submitting'].includes(phase),protect=dirty||unknown||phase==='submitting';
 const editable=phase==='editing'&&reportAssetCanEdit(report?.artifactId,source);
 useEffect(()=>{epoch.current++;pending.current=null;setOpen(false);setSource(null);setResult(null);setDraft({purpose:'',limitations:'',rightsEvidence:''});setDirty(false);setPhase('idle');return()=>{epoch.current++;};},[identity]);
 useEffect(()=>{const changed=e=>{if(researchAssetIdentityChanged(user,e.detail)){epoch.current++;pending.current=null;setOpen(false);setSource(null);setResult(null);setDraft({purpose:'',limitations:'',rightsEvidence:''});setDirty(false);setPhase('denied');}};window.addEventListener('qiyan:user-change',changed);return()=>window.removeEventListener('qiyan:user-change',changed);},[identity]);
 useEffect(()=>{
  const unload=e=>{if(protect&&!bypassLeave.current){e.preventDefault();e.returnValue='';}},navigate=e=>{
   if(!protect||bypassLeave.current||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
   const a=e.target.closest?.('a[href]');if(!a||a.target==='_blank'||a.href===location.href)return;
   e.preventDefault();e.stopPropagation();setLeave({url:a.href,trigger:a});
  };
  window.addEventListener('beforeunload',unload);document.addEventListener('click',navigate,true);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigate,true);};
 },[protect]);
 function clearMarker(){sessionStorage.removeItem(markerKey);}
 function fail(e){
  setMessage(e.message||'连接暂不可用，请保留输入并重新核对。');
  if([401,403].includes(e.status)){epoch.current++;pending.current=null;setSource(null);setResult(null);setDraft({purpose:'',limitations:'',rightsEvidence:''});setDirty(false);setPhase('denied');}
 }
 async function show(force=false){
  if(!allowed||disabled)return;
  trigger.current=document.activeElement;setOpen(true);if(!force&&source&&['editing','unknown','retryable','committed'].includes(phase))return;
  const n=++epoch.current;setPhase('loading');setMessage('');
  try{
   const value=await api.get(reportAssetSourcePath(report.artifactId));if(n!==epoch.current)return;
   if(value.reportId!==report.artifactId||value.studyId!==studyId||value.contentHash!==report.contentHash)throw Error('报告来源已变化，请重新读取原报告。');
   setSource(value);if(!dirty)setDraft(value.existing?{purpose:value.existing.metadata.purpose,limitations:value.existing.metadata.limitations,rightsEvidence:value.existing.rightsEvidence}:{purpose:'历史报告的可追溯引用与研究讨论',limitations:'仅为合成研究历史结果，不作为新研究结论。',rightsEvidence:''});
   const saved=sessionStorage.getItem(markerKey);
   if(saved){const m=JSON.parse(saved);if(m.identity!==identity||!/^[-_A-Za-z0-9]{8,128}$/.test(m.key))throw Error('原操作标识无法核对，请联系管理员。');pending.current={key:m.key,expected:m.expected};setPhase('unknown');setMessage('上次操作结果尚待核对，请先核对原结果。');}else setPhase('editing');
  }catch(e){if(n===epoch.current){setPhase('error');fail(e);}}
 }
 async function accept(value,n=epoch.current){
  if(report.artifactId===C2_REPORT_ID){const fresh=await api.get(reportAssetSourcePath(report.artifactId));if(n!==epoch.current)return;if(!validC2ReportAssetReceipt(value,pending.current?.expected,fresh))throw Error('资产来源与原操作无法核对，请保留原操作。');}

  if(n!==epoch.current)return;
  if(!(report.artifactId===C2_REPORT_ID?/^rhab-[0-9a-f-]{36}$/.test(value?.assetId??''):value?.assetId==='rh-report-asset-20261116-admin')||![1,2].includes(value.version)||value.status!=='committed')throw Error('登记结果暂不可核对，请保留原操作。');
  clearMarker();pending.current=null;setResult(value);setDirty(false);setPhase('committed');setMessage(value.operation==='existing'?'此报告已有资产，本次未重复登记，请查看已有资产说明。':'资产已保存；审核结果以治理页面为准。');
 }
 async function send(retry=false){
  if(!allowed||disabled)return;
  const n=epoch.current;let sent=false,received=false;
  try{
   if(!retry){const key='report-asset-'+crypto.randomUUID(),body={...draft,requestKey:key};if(source.existing)Object.assign(body,{baseVersion:source.existing.version,expectedRevision:source.existing.revision});pending.current={key,body,path:reportAssetSourcePath(report.artifactId,source.existing?'revisions':'registrations'),expected:source.existing?{operation:'revised',version:body.baseVersion+1,revision:body.expectedRevision+1}:{operation:'created',version:1,revision:1}};}
   const p=pending.current;if(!p?.body)throw Error('原输入未保存在浏览器，请先核对原结果。');
   const marker=JSON.stringify({identity,key:p.key,...(report.artifactId===C2_REPORT_ID?{expected:p.expected}:{})});sessionStorage.setItem(markerKey,marker);if(sessionStorage.getItem(markerKey)!==marker)throw Error('无法保留操作核对标识，尚未提交。');
   setPhase('submitting');setMessage('');sent=true;const value=await api.post(p.path,p.body);received=true;if(n!==epoch.current)return;await accept(value,n);
  }catch(e){if(n!==epoch.current)return;if(reportAssetWriteUncertain({sent,received,error:e})){setPhase('unknown');setMessage('保存结果尚待核对，已保留原操作标识，请勿重新登记。');if([401,403].includes(e.status))fail(e);}else{if(!sent||e.status<500)clearMarker();setPhase(e.status===409?'error':'editing');fail(e);}}
 }
 async function recover(){
  if(!allowed||disabled||!pending.current)return;
  const n=epoch.current;setPhase('submitting');setMessage('');
  try{const v=await api.get('/research-assets/operations/'+pending.current.key);if(n!==epoch.current)return;if(v.status==='committed')await accept(v,n);else if(v.status==='not_found'){if(pending.current.body){setPhase('retryable');setMessage('未找到原提交，可以沿用原输入重试。');}else{clearMarker();pending.current=null;setSource(null);setPhase('error');setMessage('未找到原提交，请重新读取并填写说明。');}}else throw Error('原结果暂不可核对，请稍后重试。');}catch(e){if(n===epoch.current){setPhase('unknown');fail(e);}}
 }
 function change(k,value){setDraft(d=>({...d,[k]:value}));setDirty(true);setMessage('');}
 const goReview=()=>{if(dirty&&!result){setLeave({url:reportAssetReviewUrl(report.artifactId),trigger:document.activeElement});return;}bypassLeave.current=true;location.assign(reportAssetReviewUrl(report.artifactId));};
 const button=allowed?<span ref={host}><Button disabled={disabled||busy} onClick={()=>void show()}>登记为科研资产</Button></span>:null;
 const dialogs=<>{allowed&&!disabled&&open&&<ConfirmDialog title="登记科研资产" danger={false} busy={busy} returnFocus={trigger.current} fallbackFocus={host.current} onCancel={()=>setOpen(false)}
   confirmLabel={phase==='unknown'?'核对原操作结果':phase==='retryable'?'沿用原输入重试':phase==='committed'||source?.existing&&!editable?'前往资产审核':source?.existing?'保存资产说明':'登记资产'}
   confirmDisabled={!['unknown','retryable','committed'].includes(phase)&&(!source||editable&&(!draft.purpose.trim()||!draft.limitations.trim()||!draft.rightsEvidence.trim()||source.existing&&!dirty))}
   onConfirm={()=>phase==='unknown'?void recover():phase==='retryable'?void send(true):phase==='committed'||source?.existing&&!editable?goReview():void send()}>
   {message&&<p role={phase==='committed'?'status':'alert'}>{message}</p>}
   {source&&<><p>{source.reportTitle} · 固定第{source.reportVersion}版</p><p>资产保留此报告及来源，单独审核；原报告不变。</p>
    {source.existing&&<p>已有第{source.existing.version}版资产。<a href={reportAssetDetailUrl(source.existing.version,source.existing.assetId)}>查看资产详情</a></p>}
    {!result&&<div className="asset-registration-form">{[['purpose','使用目的',2000],['limitations','使用限制',2000],['rightsEvidence','材料使用依据',4000]].map(([k,label,max])=><label key={k}>{label}<textarea aria-label={label} rows={3} maxLength={max} disabled={!editable||busy} value={draft[k]} onChange={e=>change(k,e.target.value)}/></label>)}</div>}
   </>}
   {result&&<p><a href={reportAssetDetailUrl(result.version,result.assetId)}>查看已保存的资产</a></p>}
   {['error','denied'].includes(phase)&&<Button onClick={()=>{setSource(null);void show(true);}}>重新核对来源</Button>}
  </ConfirmDialog>}
  {allowed&&leave&&<ConfirmDialog title="离开前保留修改" confirmLabel="离开此页" returnFocus={leave.trigger} fallbackFocus={host.current} onCancel={()=>setLeave(null)} onConfirm={()=>{bypassLeave.current=true;location.assign(leave.url);}}><p>{unknown?'上次提交仍待核对，返回此报告后可继续核对原结果。':'未保存的资产说明只保留在当前页面，离开将丢失。'}</p></ConfirmDialog>}
 </>;
 return {button,dialogs};
}
export default function ReportAssetRegistration(props){const state=useReportAssetRegistration(props);return <>{state.button}{state.dialogs}</>;}

