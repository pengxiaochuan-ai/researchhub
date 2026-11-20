import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {assertMaterialPage,materialKnowledgeHref,materialStateLabel,readPendingMaterialKeys,materialAnalysisState} from '../../src/session-material-session.js';
import './AgentMaterials.css';
import {assertMaterialUploadRetry} from '../../src/session-material-recovery.js';
import {AgentMediaView} from './AgentMedia.jsx';
import {assertResearchDataPage} from '../../src/research-data-session.js';
import {createUploadStudyIntents,selectUploadStudy,requiresStudyUpload} from '../../src/research-data-upload-intent.js';
import {mediaFileExtension,mediaMaxBytes} from '../../src/session-media-types.js';
import {isEeglabSelection} from '../../src/eeglab-envelope.js';
import StudyUploadDialog from './StudyUploadDialog.jsx';

export function useAgentMaterials({client,identity,sessionId,getSession,enabled,analysisReady=false,researchData,media,paused=false,contextStudyId}){
 const input=useRef(null),alive=useRef(true),epoch=useRef(0),reading=useRef(false),readAgain=useRef(false),writing=useRef(false),sequence=useRef(0),getSessionRef=useRef(getSession),readRef=useRef(null),sidRef=useRef(sessionId),previousSession=useRef(sessionId),pendingMemory=useRef(new Map());
 const selectedFiles=useRef(null),retryUpload=useRef(null);
 const uploadTrigger=useRef(null);
 const selectionGeneration=useRef(0),selectionReads=useRef(0),selectionRef=useRef(null),[dataSelection,setDataSelection]=useState(null);
 selectionRef.current=dataSelection;
 const intents=sid=>createUploadStudyIntents({storage:sessionStorage,identity,sessionId:sid});
 const verification=useRef({paused,enabled,researchData,media}),verificationWaiter=useRef(null);verification.current={paused,enabled,researchData,media};
 const wakeUpload=()=>{const resolve=verificationWaiter.current;verificationWaiter.current=null;resolve?.();};
 async function verified(sid,turn,requiresData=false,requiresMedia=false){
  while(alive.current&&turn===epoch.current&&(sidRef.current==null||sidRef.current===sid)){
   if(!verification.current.enabled)return false;
   if(!verification.current.paused){if(requiresData&&!verification.current.researchData){setError('研究数据上传权限已变化，本次未继续处理；已保存文件请核对。');return false;}if(requiresMedia&&!verification.current.media?.enabled){setError('原件上传权限已变化，本次未继续上传。');return false;}return true;}
   await new Promise(resolve=>{verificationWaiter.current=resolve;});
  }return false;
 }
 getSessionRef.current=getSession;sidRef.current=sessionId;
 const [items,setItems]=useState([]),[pending,setPending]=useState([]),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[nextCursor,setNextCursor]=useState(null),[missing,setMissing]=useState([]);
 const viewKey=identity+':'+(sessionId??''),[shownKey,setShownKey]=useState(viewKey),[checkedKey,setCheckedKey]=useState(null);
 const storageKey=sid=>'rh-material-pending:'+identity+':'+sid;
 const keys=sid=>{const key=storageKey(sid);if(pendingMemory.current.has(key))return pendingMemory.current.get(key);let value=[];try{value=readPendingMaterialKeys(sessionStorage.getItem(key));}catch{}pendingMemory.current.set(key,value);return value;};
 const saveKeys=(sid,value,{required=false}={})=>{
  try{sessionStorage.setItem(storageKey(sid),JSON.stringify(value));}catch{if(required)throw Error('浏览器无法保存上传进度，本次未上传。请允许站点存储后重试。');}
  pendingMemory.current.set(storageKey(sid),value);if(alive.current&&(sidRef.current===sid||!sidRef.current))setPending(value);
 };
 const forget=(sid,key)=>saveKeys(sid,keys(sid).filter(k=>k!==key));
 const merge=value=>setItems(previous=>[...new Map([...previous,...value].map(item=>[item.id,item])).values()]);
 useEffect(()=>{alive.current=true;++epoch.current;setItems([]);setError('');setUploading(false);setCheckedKey(null);return()=>{alive.current=false;++epoch.current;wakeUpload();};},[client,identity,enabled]);
 useEffect(()=>{++sequence.current;setCheckedKey(null);setItems([]);setError('');if(!paused||!enabled)wakeUpload();},[paused,enabled]);
 async function read(sid=sessionId,cursor){
  if(!sid||!enabled||paused)return;
  if(reading.current){readAgain.current=true;return;}
  reading.current=true;const turn=epoch.current,seq=++sequence.current;
  try{
   const value=assertMaterialPage(await client.get(`/sessions/${sid}/materials?limit=20${cursor?'&cursor='+encodeURIComponent(cursor):''}`));
   if(!alive.current||turn!==epoch.current||seq!==sequence.current||sidRef.current!==sid)return;
   if(cursor)merge(value.items);else setItems(value.items);setShownKey(identity+':'+sid);setCheckedKey(identity+':'+sid);setNextCursor(value.nextCursor);setError('');
   const unresolved=keys(sid);setPending(unresolved);const absent=[];setMissing([]);
   for(const key of unresolved){
    const dataKey=key.startsWith('research-data-');
    const receipt=await client.get(`/sessions/${sid}/${dataKey?'research-data':'materials'}/receipts/${key}`);
    if(!alive.current||turn!==epoch.current||seq!==sequence.current||sidRef.current!==sid)return;
    if(!receipt||typeof receipt.found!=='boolean')throw Error('上传回执暂时无法核对，请重试核对。');
    if(!receipt.found)absent.push(key);
    if(receipt.found){if(dataKey){assertResearchDataPage({items:[receipt.item],nextCursor:null});const intent=intents(sid).forUpload(key);if(intent){intents(sid).uploaded(key,receipt.item);const batch=intents(sid).readyBatch(key);if(!intent.batch&&batch)await researchData?.preview(sid,batch.files.map(f=>({...f,state:'ready'})),{uploadKeys:batch.keys});}await researchData?.refresh(sid);}else{const accepted=assertMaterialPage({items:[receipt.item],nextCursor:null});merge(accepted.items);}forget(sid,key);}
   }
   if(alive.current&&turn===epoch.current&&seq===sequence.current)setMissing(absent);
  }catch(reason){if(alive.current&&turn===epoch.current){setError(reason.message);if([401,403,404].includes(reason.status))setItems([]);}}
  finally{reading.current=false;if(readAgain.current){readAgain.current=false;if(alive.current)queueMicrotask(()=>void readRef.current());}}
 }
 readRef.current=read;
 useEffect(()=>{
  if(previousSession.current!==sessionId&&previousSession.current!=null){++epoch.current;setUploading(false);wakeUpload();}
  previousSession.current=sessionId;setShownKey(viewKey);setItems([]);setMissing([]);setPending(sessionId?keys(sessionId):[]);setNextCursor(null);
  if(sessionId)void readRef.current(sessionId);
 },[client,identity,sessionId,enabled,paused]);
 const polling=items.some(item=>['staged','importing'].includes(item.state));
 useEffect(()=>{if(!polling||!sessionId||paused||!enabled)return;const timer=setInterval(()=>void readRef.current(sessionId),1500);return()=>clearInterval(timer);},[polling,sessionId,paused,enabled]);
 useEffect(()=>{
  const selection=selectedFiles.current;if(!selection)return;
  if(selection.client!==client||selection.identity!==identity||selection.sessionId!==sessionId||!enabled){selectedFiles.current=null;setError('会话或上传权限已变化，本次选择未上传。请核对后重新选择文件。');return;}
  if(!paused){selectedFiles.current=null;void routeSelection(selection.files);}
 },[client,identity,sessionId,paused,enabled]);
 async function selected(event){
  const files=Array.from(event.target.files??[]);event.target.value='';
  if(!files.length||!enabled||writing.current)return;
  if(paused){selectedFiles.current={files,client,identity,sessionId};return;}
  await routeSelection(files);
 }
 useEffect(()=>{selectionGeneration.current++;setDataSelection(null);},[client,identity,enabled]);
 useEffect(()=>{const draft=selectionRef.current;if(draft&&draft.sessionId!==sessionId){selectionGeneration.current++;setDataSelection(null);}},[sessionId]);
 function cancelSelection(){if(selectionRef.current?.submitting)return;selectionGeneration.current++;retryUpload.current=null;setDataSelection(null);}
 async function loadSelection(draft){
  const generation=draft.generation,turn=epoch.current,readNumber=++selectionReads.current;
  const valid=()=>alive.current&&turn===epoch.current&&generation===selectionGeneration.current&&readNumber===selectionReads.current&&(sidRef.current==null||sidRef.current===draft.sessionId);
  if(valid())setDataSelection(s=>s?{...s,loading:true,error:''}:s);
  try{if(!await verified(draft.sessionId,turn,true))return;const value=await client.get(`/sessions/${draft.sessionId}/profile-import-targets`);const studyId=selectUploadStudy(value.items,{contextStudyId:draft.studyId||contextStudyId,pinnedStudyId:draft.pinnedStudyId});if(valid())setDataSelection(s=>({...s,targets:value.items,studyId,loading:false,error:''}));}
  catch(e){if(valid())setDataSelection(s=>({...s,loading:false,error:e.message,targets:[],studyId:''}));}
 }
 async function routeSelection(files){
  let priorIntent;try{if(retryUpload.current&&sessionId)priorIntent=intents(sessionId).forUpload(retryUpload.current.key);}catch(e){setError(e.message);return;}
  if(!requiresStudyUpload(files,priorIntent,contextStudyId))return uploadFiles(files);
  if(paused||!enabled||writing.current)return;
  const turn=epoch.current,generation=++selectionGeneration.current,returnFocus=uploadTrigger.current?.isConnected?uploadTrigger.current:document.activeElement;
  try{const sid=sessionId??await getSessionRef.current();if(!alive.current||turn!==epoch.current||generation!==selectionGeneration.current||sidRef.current!=null&&sidRef.current!==sid)return;
   const retry=retryUpload.current;if(retry)assertMaterialUploadRetry(retry,{sessionId:sid,identity,client},files);
   const pinnedStudyId=retry?intents(sid).forUpload(retry.key)?.studyId:null,draft={sessionId:sid,identity,client,generation,returnFocus,files,targets:[],studyId:'',pinnedStudyId,loading:true,submitting:false,error:''};setDataSelection(draft);await loadSelection(draft);
  }catch(e){if(alive.current&&turn===epoch.current)setError(e.message);}
 }
 async function uploadSelection(){const draft=selectionRef.current;if(!draft||draft.loading||draft.submitting||!draft.targets.some(t=>t.id===draft.studyId)||draft.client!==client||draft.identity!==identity||draft.sessionId!==sessionId||paused||!enabled)return;setDataSelection(s=>({...s,submitting:true}));await uploadFiles(draft.files,{studyId:draft.studyId});if(draft.generation===selectionGeneration.current)setDataSelection(null);}
 async function uploadFiles(files,{studyId}={}){
  if(paused||!enabled||writing.current)return;
  media?.clearSelectionError?.();
  if(isEeglabSelection(files)){
   if(!media?.enabled){setError('当前原件上传不可用，请核对权限后重试。');return;}
   const turn=epoch.current;writing.current=true;setUploading(true);setError('');
   try{const sid=sessionId??await getSessionRef.current();if(await verified(sid,turn,false,true))await verification.current.media.upload(files,sid);}catch(e){if(alive.current&&turn===epoch.current&&!e.mediaHandled)setError(e.message);}finally{writing.current=false;if(alive.current&&turn===epoch.current)setUploading(false);}return;
  }
  if(files.some(f=>/\.eeglab$/i.test(f.name))){setError('请选择原SET及配套FDT，系统会自动整理完整原件包。');return;}
  if(files.length>20||files.some(f=>!f.size||(mediaFileExtension(f.name)?!media?.enabled||f.size>mediaMaxBytes(mediaFileExtension(f.name)):/\.(csv|xlsx)$/i.test(f.name)?!researchData||f.size>25*1024*1024:f.size>100*1024*1024||!/\.(?:pdf|docx|txt|md|markdown)$/i.test(f.name)))){setError(media?.enabled?'请选择最多20份支持的文件；语音WAV/MP3/M4A不超过200MiB，舌图PNG/JPG/JPEG不超过25MiB，视频不超过500MiB，文献不超过100MiB，CSV/XLSX不超过25MiB。':researchData?'请选择最多20份文件；文献不超过100MiB，CSV/XLSX研究数据不超过25MiB。':'请选择最多20份PDF、DOCX、TXT或Markdown文献，每份不超过100MiB。');return;}
  const retry=retryUpload.current;retryUpload.current=null;let originalKey;try{originalKey=assertMaterialUploadRetry(retry,{sessionId,identity,client},files);}catch(e){setError(e.message);return;}
  writing.current=true;setUploading(true);setError('');const turn=epoch.current;
  try{
   const sid=sessionId??await getSessionRef.current();
   if(!alive.current||turn!==epoch.current||sidRef.current!=null&&sidRef.current!==sid)return;
   const acceptedData=[],dataKeys=[],requestKeys=files.map(f=>/\.(csv|xlsx)$/i.test(f.name)?originalKey??'research-data-'+crypto.randomUUID():null);
   if(studyId){if(originalKey){if(!intents(sid).forUpload(originalKey))intents(sid).begin(originalKey,studyId);intents(sid).assertFile(originalKey,files[0]);}else{const dataFiles=files.filter((_,i)=>requestKeys[i]);const batchKeys=requestKeys.filter(Boolean);if(keys(sid).length+batchKeys.length>20)throw Error('请先核对尚未完成的上传，再添加这批文件。');intents(sid).beginBatch(batchKeys,studyId,dataFiles);saveKeys(sid,[...new Set([...keys(sid),...batchKeys])],{required:true});}}
   for(const [fileIndex,file] of files.entries()){
    const dataFile=/\.(csv|xlsx)$/i.test(file.name),mediaFile=Boolean(mediaFileExtension(file.name));if(!await verified(sid,turn,dataFile,mediaFile))return;
    if(mediaFile){await verification.current.media.upload(file,sid);continue;}
    const key=requestKeys[fileIndex]??originalKey??'material-'+crypto.randomUUID(),saved=keys(sid);if(!saved.includes(key)&&saved.length>=20)throw Error('请先核对尚未确认的上传结果，再添加资料。');
    if(dataFile&&studyId)intents(sid).begin(key,studyId);
    saveKeys(sid,[...new Set([...saved,key])],{required:true});++sequence.current;
    const form=new FormData();form.append('requestKey',key);form.append('file',file);
    try{
     const result=await client.upload(`/sessions/${sid}/${dataFile?'research-data':'materials'}`,form);
     if(!alive.current||turn!==epoch.current||sidRef.current!=null&&sidRef.current!==sid)return;
     ++sequence.current;if(dataFile){assertResearchDataPage({items:[result],nextCursor:null});if(studyId){intents(sid).uploaded(key,result);dataKeys.push(key);}acceptedData.push(result);}else{const accepted=assertMaterialPage({items:[result],nextCursor:null});merge(accepted.items);}forget(sid,key);
    }catch(reason){
     if(reason.status===400||reason.status===413)forget(sid,key);
     throw reason;
    }
    if(!alive.current||turn!==epoch.current)return;
   }
   if(acceptedData.length&&await verified(sid,turn,true)){await verification.current.researchData.refresh(sid);if(await verified(sid,turn,true)){const batch=studyId?intents(sid).readyBatch(dataKeys[0]):null;if(!studyId||batch)await verification.current.researchData.preview(sid,batch?batch.files.map(f=>({...f,state:'ready'})):acceptedData,{uploadKeys:batch?.keys??dataKeys});}}
  }catch(reason){if(alive.current&&turn===epoch.current&&!reason.mediaHandled)setError(reason.message);}
  finally{writing.current=false;if(alive.current&&turn===epoch.current)setUploading(false);}
 }
 const current=shownKey===viewKey&&enabled&&!paused;
 const checking=Boolean(enabled&&sessionId&&checkedKey!==viewKey);
 const selectionVisible=dataSelection&&dataSelection.identity===identity&&dataSelection.client===client&&dataSelection.sessionId===sessionId&&enabled&&!paused;
 return {input,researchData,media,dataSelection:selectionVisible?dataSelection:null,uploadSelection,cancelSelection,selectStudy:studyId=>setDataSelection(s=>s?{...s,studyId}:s),reloadStudies:()=>selectionRef.current&&loadSelection(selectionRef.current),items:current?items:[],pending:current?pending:[],uploading:current&&uploading,error:current?error:'',checking,
  ...materialAnalysisState({enabled,analysisReady,checking,error,uploading,pending,items}),
  missing:current?missing:[],retryPending:(key,event)=>{if(paused||!enabled||writing.current||!missing.includes(key)||!keys(sessionId).includes(key))return;uploadTrigger.current=event?.currentTarget??document.activeElement;retryUpload.current={key,sessionId,identity,client};input.current?.click();},nextCursor:current?nextCursor:null,selected,pick:event=>{uploadTrigger.current=event?.currentTarget??document.activeElement;retryUpload.current=null;input.current?.click();},refresh:()=>readRef.current(),more:()=>readRef.current(sessionId,nextCursor)};
}

export function AgentMaterialsView({materials,scope,analysisReady=false}){
 const {items,pending,uploading,error,nextCursor}=materials;
 return <>
  <StudyUploadDialog draft={materials.dataSelection} onCancel={materials.cancelSelection} onUpload={materials.uploadSelection} onChange={materials.selectStudy} onReload={materials.reloadStudies}/>
  {materials.media?.enabled&&<p data-eeglab-upload-guidance>EEG上传前请在EEGLAB去除身份信息并重新保存；选择SET及它需要的同次导出FDT。</p>}
  <input ref={materials.input} type="file" data-agent-materials accept={'.pdf,.docx,.txt,.md,.markdown'+(materials.researchData?',.csv,.xlsx':'')+(materials.media?.enabled?',.mp4,.mov,.webm,.png,.jpg,.jpeg,.wav,.mp3,.m4a,.set,.fdt':'')} multiple hidden onChange={materials.selected}/>
  {materials.media&&<AgentMediaView media={materials.media}/>}
  {materials.researchData?.items.length>0&&<section className="agent-materials" aria-label="本会话研究数据"><details><summary>本会话研究数据 · {materials.researchData.nextCursor?'已显示':''}{materials.researchData.items.length}份</summary><ul>{materials.researchData.items.map(item=><li key={item.id}><span className="agent-material-name">{item.name}</span><span>{item.state==='ready'?'已暂存':'当前不可用'}</span></li>)}</ul>{materials.researchData.nextCursor&&<Button disabled={materials.researchData.loading} onClick={materials.researchData.more}>更多数据文件</Button>}</details>{!materials.researchData.analysisReady?<p>本会话研究数据的AI分析暂不可用。</p>:materials.researchData.imports?.item?.state!=='committed'?<p>完成上方导入确认后，可提问本批数据。</p>:null}</section>}
  {(items.length>0||pending.length>0||uploading&&!materials.media?.uploading||error)&&<section className="agent-materials" aria-label="本会话资料" aria-busy={uploading}>
   {uploading&&!materials.media?.uploading&&<p role="status">正在上传资料…</p>}
   {items.length>0&&<details open><summary>本会话资料 · {items.length}份</summary><ul>{items.map(item=>{
    const href=materialKnowledgeHref(item,scope);return <li key={item.id}><span className="agent-material-name">{item.name}</span><span>{materialStateLabel(item)}</span>{href&&<a href={href} target="_blank" rel="noopener noreferrer">{item.decisionRequired?'确认保存':'查看资料'}</a>}</li>;
   })}</ul>{nextCursor&&<Button onClick={materials.more}>更多资料</Button>}</details>}
   {items.some(item=>item.available)&&!analysisReady&&<p role="status">资料提问暂不可用，已保存内容可在知识资料中查看。</p>}
   {analysisReady&&items.length>0&&<p role="status">默认分析本会话可用资料；解析完成后自动执行。需处理的资料不会用于回答。</p>}
   {pending.length>0&&!uploading&&<div role="status"><p>有{pending.length}项上传结果待核对，未重复上传。<Button onClick={materials.refresh}>核对上传</Button></p>{materials.missing?.length>0&&<p>暂未查到保存记录。请选择原文件恢复上传；系统沿用原操作，避免重复保存。<Button onClick={event=>materials.retryPending(materials.missing[0],event)}>重新选择原文件</Button></p>}<p>可以先填写研究问题，上传核对完成后再发送。</p></div>}
   {error&&<p role="alert">{error} <Button onClick={materials.refresh}>核对资料状态</Button></p>}
  </section>}
 </>;
}
