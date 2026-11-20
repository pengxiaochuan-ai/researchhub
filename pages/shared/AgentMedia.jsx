import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {assertMediaPage,mediaContentHref,mediaStateLabel,uploadMediaFile,readPendingMedia,recoverMediaReceipt} from '../../src/session-media-session.js';
import {identifyMediaFile} from '../../src/media-content-identity.js';
import {isTongueMedia,isTongueExtension,isAudioMedia,isAudioExtension,mediaFileExtension,mediaTypeLabel,mediaExtensionLabel,mediaMaxBytes,isEegMedia,isEegExtension,eegInspectionLabel} from '../../src/session-media-types.js';
import './AgentMedia.css';
import {createEeglabEnvelope} from '../../src/eeglab-envelope.js';
import{AgentMediaIngest}from'./AgentMediaIngest.jsx';
import{AgentMediaContent}from'./AgentMediaContent.jsx';
import{OriginalAudio}from'./OriginalAudio.jsx';

export function useAgentMedia({client,identity,sessionId,enabled=false,resumable=false,registrationEnabled=false,registrationState,contentEnabled=false,contentState,acquisitionContext,paused=false}){
 const alive=useRef(true),generation=useRef(0),sequence=useRef(0),previousSession=useRef(sessionId),waiting=useRef(new Set()),writing=useRef(false),pendingMemory=useRef(new Map()),checking=useRef(false);
 const current=useRef({client,identity,sessionId,enabled,paused});current.current={client,identity,sessionId,enabled,paused};
 const resumeInput=useRef(null),resumeSelection=useRef(null),playbackRef=useRef(null),closePlaybackRef=useRef(null);
 const [uploadName,setUploadName]=useState(null);
 const viewKey=identity+':'+(sessionId??''),[shown,setShown]=useState(viewKey),[items,setItems]=useState([]),[pending,setPending]=useState([]),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[checkingUploads,setCheckingUploads]=useState(false),[uploading,setUploading]=useState(false),[progress,setProgress]=useState(null),[nextCursor,setNextCursor]=useState(null),[checkingId,setCheckingId]=useState(null);
 const keyFor=sid=>'rh-media-pending:'+identity+':'+sid;
 const keys=sid=>{if(pendingMemory.current.has(keyFor(sid)))return pendingMemory.current.get(keyFor(sid));let value=[];try{value=readPendingMedia(sessionStorage.getItem(keyFor(sid)));}catch{}pendingMemory.current.set(keyFor(sid),value);return value;};
 const save=(sid,value,required=false)=>{try{sessionStorage.setItem(keyFor(sid),JSON.stringify(value));}catch{if(required)throw Error('浏览器无法保存上传进度，本次未继续提交。请允许站点存储后核对原上传。');}pendingMemory.current.set(keyFor(sid),value);if(alive.current)setPending(value);};
 const saveRecord=(sid,record,required=false)=>save(sid,[...keys(sid).filter(x=>x.requestKey!==record.requestKey),record],required);
 const forget=(sid,key)=>save(sid,keys(sid).filter(x=>x.requestKey!==key));
 const wake=()=>{for(const resolve of waiting.current)resolve();waiting.current.clear();};
 const isCurrent=(sid,turn)=>alive.current&&turn===generation.current&&current.current.client===client&&current.current.identity===identity&&current.current.enabled&&(current.current.sessionId==null||current.current.sessionId===sid);
 async function ready(sid,turn){
  while(isCurrent(sid,turn)){if(!current.current.paused)return true;await new Promise(resolve=>waiting.current.add(resolve));}return false;
 }
 useEffect(()=>{alive.current=true;++generation.current;setItems([]);setError('');setFeedback('');setCheckingUploads(false);setUploading(false);setUploadName(null);setCheckingId(null);return()=>{alive.current=false;++generation.current;wake();};},[client,identity,enabled]);
 useEffect(()=>{++sequence.current;setCheckingUploads(false);if(!paused||!enabled)wake();},[paused,enabled]);
 async function read(sid=sessionId,cursor,manual=false){
  if(!sid||!enabled||paused)return;
  const turn=generation.current,seq=++sequence.current;
  setCheckingUploads(true);if(manual)setFeedback('');
  try{
   const result=assertMediaPage(await client.get(`/sessions/${sid}/media?limit=20${cursor?'&cursor='+cursor:''}`));
   if(!isCurrent(sid,turn)||seq!==sequence.current||current.current.paused)return;
   setShown(identity+':'+sid);setItems(previous=>cursor?[...new Map([...previous,...result.items].map(x=>[x.id,x])).values()]:result.items);setNextCursor(result.nextCursor);
   const unresolved=keys(sid);setPending(unresolved);
   let missing=0;const checked=new Map(result.items.map(item=>[item.id,item]));
   for(const record of unresolved){
    const receipt=await client.get(`/sessions/${sid}/media/receipts/${record.requestKey}`);
    if(!isCurrent(sid,turn)||seq!==sequence.current||current.current.paused)return;
    if(receipt.found){
     const recovered=recoverMediaReceipt(record,receipt);checked.set(recovered.item.id,recovered.item);setItems(previous=>[...new Map([...previous,recovered.item].map(x=>[x.id,x])).values()]);
     if(recovered.pending)saveRecord(sid,recovered.pending);else forget(sid,record.requestKey);
    }else missing++;
   }
   if(manual||!keys(sid).length)setError('');
   const checkedItems=[...checked.values()],word=checkedItems.some(x=>isTongueMedia(x)||isAudioMedia(x)||isEegMedia(x))||unresolved.some(x=>isTongueExtension(x.extension)||isAudioExtension(x.extension)||isEegExtension(x.extension))?'文件':'视频';
   if(manual||unresolved.length)setFeedback((missing?'暂未查到这次上传记录，请选择原视频继续上传。':checkedItems.some(item=>item.archiveState==='pending')?'已核对上传记录，视频尚未归档，请继续完成原操作。':checkedItems.some(item=>item.archiveState==='failed')?'已核对，存在未能归档的视频，请核对文件状态后重新上传。':checkedItems.length?'已核对，视频已归档。':'已核对，当前会话暂无视频。').replaceAll('视频',word));
  }catch(reason){if(isCurrent(sid,turn)&&seq===sequence.current){setShown(identity+':'+sid);setError(reason.message);if([401,403,404].includes(reason.status))setItems([]);}}
  finally{if(isCurrent(sid,turn)&&seq===sequence.current)setCheckingUploads(false);}
 }
 const readRef=useRef(read);readRef.current=read;
 useEffect(()=>{
  const changed=previousSession.current!==sessionId;
  if(changed&&previousSession.current!=null){++generation.current;setUploading(false);setUploadName(null);wake();}
  if(changed){setError('');setFeedback('');setCheckingUploads(false);}
  previousSession.current=sessionId;setShown(viewKey);setItems([]);setNextCursor(null);setPending(sessionId?keys(sessionId):[]);
  if(sessionId)void readRef.current(sessionId);
 },[client,identity,sessionId,enabled,paused]);
 useEffect(()=>{resumeSelection.current=null;},[client,identity,sessionId]);
 const polling=items.some(x=>x.archiveState==='archived'&&x.inspectionState==='running'&&!x.canRecheck);
 useEffect(()=>{if(!polling||!sessionId||paused||!enabled)return;const timer=setInterval(()=>void readRef.current(sessionId),1500);return()=>clearInterval(timer);},[polling,sessionId,paused,enabled]);
 async function upload(file,sid,originalKey){
  const turn=generation.current;let ownsWrite=false,activeKey;
  try{
   const group=Array.isArray(file),extension=group?'eeglab':mediaFileExtension(file.name);
   if(!extension||!group&&(!file.size||file.size>mediaMaxBytes(extension)))throw Error('请选择200MiB以内的WAV/MP3/M4A语音、25MiB以内的PNG/JPG/JPEG舌图，或500MiB以内的MP4/MOV/WebM视频。');
   if(!await ready(sid,turn))throw Error('视频上传状态已变化，请核对后重新选择文件。');
   if(writing.current)throw Error('原视频上传仍在处理中，请稍后核对上传状态。');
   writing.current=true;ownsWrite=true;++sequence.current;setCheckingUploads(false);setShown(identity+':'+sid);setUploading(true);setUploadName({sessionId:sid,name:group?'EEGLAB原件组':file.name});setProgress({checking:group,loaded:0,total:group?0:file.size});setError('');setFeedback('');
   if(group){file=await createEeglabEnvelope(file,{current:()=>ready(sid,turn)});if(!await ready(sid,turn))return;setUploadName({sessionId:sid,name:file.name});setProgress({loaded:0,total:file.size});}
   const list=keys(sid);
   const matches=list.filter(x=>x.byteSize===file.size&&x.extension===extension);
   let record=originalKey?list.find(x=>x.requestKey===originalKey):list.length===1?list[0]:matches.length===1?matches[0]:null,initialization,useResume=resumable;
   if(originalKey&&!record)throw Error('原上传记录已变化，请先核对上传状态。');
   if(!originalKey&&matches.length>1)throw Error('有多项相同格式和大小的视频尚未完成，请从对应记录点“继续上传”。');
   if(record){
    const receipt=await client.get(`/sessions/${sid}/media/receipts/${record.requestKey}`);if(!await ready(sid,turn))return;
    const recovered=recoverMediaReceipt(record,receipt);
    if(!recovered.pending){
     let sameOriginal=recovered.item.archiveState==='archived'&&recovered.item.byteSize===file.size&&recovered.item.extension===extension;
     if(!originalKey&&sameOriginal&&record.fileIdentity){
      const identified=await identifyMediaFile(file,{current:async()=>{if(!await ready(sid,turn))throw Error('会话已变化，本次未继续上传。');},onChecking:()=>{if(isCurrent(sid,turn))setProgress({checking:true,loaded:0,total:file.size});}});
      sameOriginal=identified.fileIdentity.root===record.fileIdentity.root;
     }
     if(!await ready(sid,turn))return;
     setItems(previous=>[...new Map([...previous,recovered.item].map(x=>[x.id,x])).values()]);forget(sid,record.requestKey);
     if(originalKey||sameOriginal){if(recovered.item.archiveState==='failed')throw Error('原上传未能归档，请用“上传文件”重新选择文件。');setFeedback(`已核对，原${mediaExtensionLabel(extension)}已归档。`);return;}
     record=null;
    }else{
     record=recovered.pending;saveRecord(sid,record,true);
     if(record.byteSize!==file.size||record.extension!==extension){
      if(originalKey)throw Error(`请选择原视频继续上传，格式和大小需与原记录一致。原记录：${record.extension.toUpperCase()}，${(record.byteSize/1024/1024).toFixed(2)} MiB；本次：${extension?.toUpperCase()??'未知格式'}，${(file.size/1024/1024).toFixed(2)} MiB。上传另一份视频请用“上传文件”。`);
      record=null; // A different selection is a new upload; retain the unresolved original.
     }else{
      if(receipt.identityMode==='legacy')useResume=false;
      if(receipt.upload?.uploadId)initialization={item:receipt.item,...receipt.upload};
     }
    }
   }
   if(!record){if(keys(sid).length>=20)throw Error('未完成上传记录已达20项，请先核对已有上传。');record={requestKey:'media-'+crypto.randomUUID(),uploadId:null,phase:'initializing',byteSize:file.size,extension};}
   activeKey=record.requestKey;
   saveRecord(sid,record,true);
   const item=await uploadMediaFile({client,sid,file,requestKey:record.requestKey,initialization,resumable:useResume,fileIdentity:record.fileIdentity,beforeRequest:()=>ready(sid,turn),
    onChecking:()=>{if(isCurrent(sid,turn))setProgress({checking:true,loaded:0,total:file.size});},
    onIdentity:fileIdentity=>{if(!isCurrent(sid,turn))throw Error('会话已变化，本次未继续上传。');record={...record,fileIdentity};saveRecord(sid,record,true);},
    onInitialized:init=>{record={...record,uploadId:init.uploadId,phase:'transferring'};saveRecord(sid,record,true);},
    onCompleting:init=>{++sequence.current;setCheckingUploads(false);record={...record,uploadId:init.uploadId,phase:'completing'};saveRecord(sid,record,true);},
    onProgress:value=>{if(isCurrent(sid,turn))setProgress(value);}});
   if(!isCurrent(sid,turn))return;
   ++sequence.current;setCheckingUploads(false);setItems(previous=>[...new Map([...previous,item].map(x=>[x.id,x])).values()]);setFeedback('');forget(sid,record.requestKey);
  }catch(reason){const handled=isCurrent(sid,turn);if(handled){if([400,410].includes(reason.status))await readRef.current(sid);if(isCurrent(sid,turn)){if(reason.code==='MEDIA_FILE_IDENTITY_CHANGED')save(sid,keys(sid).map(x=>x.requestKey===activeKey?{...x,phase:'transferring'}:x));setError(reason.message.replaceAll('视频',mediaExtensionLabel(mediaFileExtension(Array.isArray(file)?'eeglab-originals.eeglab':file.name))));}}reason.mediaHandled=handled;throw reason;}
  finally{if(ownsWrite){writing.current=false;if(isCurrent(sid,turn)){setUploading(false);setUploadName(null);setProgress(null);}}}
 }
 async function finish(record){
  const sid=sessionId,turn=generation.current;let ownsWrite=false;
  try{
   if(!sid||!await ready(sid,turn))throw Error('视频上传状态已变化，请核对后重新选择文件。');
   if(writing.current)throw Error('原视频上传仍在处理中，请稍后核对上传状态。');
   writing.current=true;ownsWrite=true;++sequence.current;setCheckingUploads(false);setUploading(true);setUploadName(null);setProgress(null);setError('');setFeedback('');
   const receipt=await client.get(`/sessions/${sid}/media/receipts/${record.requestKey}`);if(!await ready(sid,turn))return;
   const recovered=recoverMediaReceipt(record,receipt);let result=recovered.item;
   if(recovered.pending){
    const uploadId=receipt.upload?.uploadId??recovered.pending.uploadId;if(!uploadId)throw Error('请重新选择原视频继续上传。');
    saveRecord(sid,{...recovered.pending,uploadId,phase:'completing'},true);
    result=await client.post(`/sessions/${sid}/media-uploads/${uploadId}/complete`,{});
   }
   if(!await ready(sid,turn))return;
   assertMediaPage({items:[result],nextCursor:null});++sequence.current;setCheckingUploads(false);setItems(previous=>[...new Map([...previous,result].map(x=>[x.id,x])).values()]);
   if(result.archiveState==='archived'||result.archiveState==='failed')forget(sid,record.requestKey);
  }catch(reason){if(isCurrent(sid,turn)){if([400,410].includes(reason.status))await readRef.current(sid);if(isCurrent(sid,turn)){setError(reason.message.replaceAll('视频',mediaExtensionLabel(record.extension)));if((reason.status===400||reason.code==='MEDIA_FILE_IDENTITY_CHANGED')&&keys(sid).some(x=>x.requestKey===record.requestKey))saveRecord(sid,{...record,phase:'transferring'});}}}
  finally{if(ownsWrite){writing.current=false;if(isCurrent(sid,turn))setUploading(false);}}
 }
 function pickPending(record){
  if(!resumeInput.current){setError('文件选择器尚未就绪，请刷新后核对原上传。');return;}
  resumeSelection.current={client,identity,sessionId,requestKey:record.requestKey};setFeedback(`请选择原${mediaExtensionLabel(record.extension)}继续上传。`);
  try{resumeInput.current.click();}catch{setError(`暂时无法打开文件选择窗口，请用“上传文件”选择原${mediaExtensionLabel(record.extension)}继续上传。`);}
 }
 function resumeSelected(event){
  const files=Array.from(event.target.files??[]),selection=resumeSelection.current,file=files.some(f=>/\.(set|fdt)$/i.test(f.name))?files:files[0];event.target.value='';
  if(!file)return;
  if(!selection||selection.client!==client||selection.identity!==identity||selection.sessionId!==sessionId){setError('会话已变化，本次未继续上传。');return;}
  void upload(file,sessionId,selection.requestKey).catch(()=>{});
 }
 async function recheck(item){
  const sid=sessionId,turn=generation.current;if(checking.current||!sid||!await ready(sid,turn))return;
  checking.current=true;setCheckingId(item.id);setError('');
  try{
   const result=await client.post(`/sessions/${sid}/media/${item.id}/recheck`,{requestKey:'media-check-'+crypto.randomUUID(),expectedVersion:item.version});
   if(!isCurrent(sid,turn)||current.current.paused)return;
   assertMediaPage({items:[result],nextCursor:null});setItems(previous=>previous.map(x=>x.id===result.id?result:x));
  }catch(reason){if(isCurrent(sid,turn))setError(reason.message);}
  finally{checking.current=false;if(isCurrent(sid,turn))setCheckingId(null);}
 }
 const [registrationDirty,setRegistrationDirty]=useState(false);
 const visible=shown===viewKey&&enabled&&!paused;
 return{client,identity,sessionId,enabled,paused,acquisitionContext,registrationDirty:visible&&registrationDirty,onRegistrationDirty:setRegistrationDirty,playbackRef,closePlaybackRef,contentEnabled:visible&&contentEnabled,contentState:visible?contentState:undefined,registrationEnabled:visible&&registrationEnabled,registrationState:visible?registrationState:undefined,checkingId:visible?checkingId:null,items:visible?items:[],pending:visible?pending:[],error:visible?error:'',feedback:visible?feedback:'',checkingUploads:visible&&checkingUploads,uploading:visible&&uploading,uploadName:visible&&uploading&&uploadName?.sessionId===sessionId?uploadName.name:'',progress:visible?progress:null,nextCursor:visible?nextCursor:null,
  clearSelectionError:()=>{if(!writing.current){setError('');setFeedback('');}},hasMedia:visible&&items.length>0,upload,recheck,finish,pickPending,resumeInput,resumeSelected,refresh:()=>readRef.current(sessionId,undefined,true),more:()=>readRef.current(sessionId,nextCursor)};
}

export function AgentMediaView({media}){
 const [opened,setOpened]=useState(null),[play,setPlay]=useState(false),[failed,setFailed]=useState(null);
 const [bindingId,setBindingId]=useState(null);
 const videoRef=useRef(null),pendingSeek=useRef(null),seekIdentity=media.identity+':'+media.sessionId;
 const applySeek=()=>{const v=videoRef.current,p=pendingSeek.current;if(!p||!v||p.identity!==seekIdentity||v.dataset.mediaId!==p.mediaId||v.readyState<1)return;pendingSeek.current=null;try{v.currentTime=Number(p.playbackUs)/1e6;if(p.focus)v.scrollIntoView({block:'nearest',inline:'nearest'});void v.play().catch(()=>setFailed(p.mediaId));}catch{setFailed(p.mediaId);}};
 const seek=(value,evidence,{focus=false}={})=>{pendingSeek.current={identity:seekIdentity,mediaId:value.id,playbackUs:evidence.playbackUs,focus};setOpened(value.id);setPlay(false);setFailed(null);queueMicrotask(applySeek);};
 useEffect(()=>{if(!media.playbackRef)return;const replay=(pack,evidence)=>{const source=media.items.find(x=>x.id===pack.mediaId);if(media.paused||pack.sessionId!==media.sessionId||!source||source.version!==pack.sourceVersion)return false;seek(source,evidence,{focus:true});return true;};const close=pack=>{if(pack.sessionId!==media.sessionId)return;videoRef.current?.pause();if(opened===pack.mediaId){setOpened(null);pendingSeek.current=null;}};media.playbackRef.current=replay;if(media.closePlaybackRef)media.closePlaybackRef.current=close;return()=>{if(media.playbackRef.current===replay)media.playbackRef.current=null;if(media.closePlaybackRef?.current===close)media.closePlaybackRef.current=null;};});
 useEffect(()=>{pendingSeek.current=null;},[seekIdentity]);
 useEffect(()=>{applySeek();},[opened]);
 useEffect(()=>setBindingId(null),[media.identity,media.sessionId]);
 useEffect(()=>{setOpened(null);setPlay(false);setFailed(null);},[media.identity,media.sessionId]);
 useEffect(()=>{if(media.paused)setPlay(false);},[media.paused]);
 const {items,pending,error,feedback,checkingUploads,uploading,progress}=media,item=items.find(x=>x.id===opened);
 const selected=items.find(x=>x.id===bindingId)??(items.length===1?items[0]:null),bindingItem=media.registrationEnabled&&selected?.archiveState==='archived'&&selected.inspectionState==='complete'&&selected.classification==='valid'&&(selected.inspection.hasVideo||isTongueMedia(selected)&&selected.inspection.hasImage||isAudioMedia(selected)&&selected.inspection.hasAudio||isEegMedia(selected)&&selected.inspection.hasEeg)?selected:null;
 const hasImages=items.some(isTongueMedia)||pending.some(x=>isTongueExtension(x.extension)),hasEeg=items.some(isEegMedia)||pending.some(x=>isEegExtension(x.extension)),hasVoice=items.some(isAudioMedia)||pending.some(x=>isAudioExtension(x.extension)),kinds=new Set([...items.map(mediaTypeLabel),...pending.map(x=>mediaExtensionLabel(x.extension))]),sectionLabel=kinds.size>1?'本会话采集文件':hasImages?'本会话舌图':hasVoice?'本会话语音':hasEeg?'本会话EEG原件':'本会话视频';
 const visible=items.length>0||pending.length>0||error||feedback||uploading;
 return <><input ref={media.resumeInput} data-media-resume type="file" accept=".mp4,.mov,.webm,.png,.jpg,.jpeg,.wav,.mp3,.m4a,.set,.fdt" multiple hidden onChange={media.resumeSelected}/>{visible&&<section className="agent-materials agent-media" aria-label={sectionLabel} aria-busy={uploading}>
  {uploading&&<p role="status">{media.uploadName&&<><span className="agent-media-upload-name" data-media-upload-name>{media.uploadName}</span> · </>}{progress?.checking?'正在核对文件…':progress&&progress.loaded<progress.total?`正在上传${mediaExtensionLabel(mediaFileExtension(media.uploadName))} · ${Math.floor(progress.loaded/progress.total*100)}%`:'文件已传输，正在归档并检查…'}</p>}
  {items.length>0&&<details open><summary>{sectionLabel} · {items.length}份</summary><ul>{items.map(value=><li key={value.id} data-media-id={value.id}>
   <span className="agent-material-name">{mediaTypeLabel(value)} · {value.extension.toUpperCase()} · {new Date(value.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
   <span>{mediaStateLabel(value)}</span>
   {value.inspectionState==='complete'&&bindingItem?.id!==value.id&&<span>{isEegMedia(value)?eegInspectionLabel(value.inspection):isTongueMedia(value)?`${value.inspection.width} × ${value.inspection.height} 像素`:isAudioMedia(value)?`时长 ${value.inspection.durationSeconds}秒 · ${value.inspection.sampleRateHz} Hz`:`时长 ${value.inspection.durationSeconds??'未知'}秒${value.inspection.hasAudio?' · 含声音':''}`}</span>}
   {media.registrationEnabled&&value.archiveState==='archived'&&value.classification==='valid'&&(value.inspection.hasVideo||isTongueMedia(value)&&value.inspection.hasImage||isAudioMedia(value)&&value.inspection.hasAudio||isEegMedia(value)&&value.inspection.hasEeg)&&bindingItem?.id!==value.id&&<Button onClick={()=>setBindingId(value.id)}>关联研究</Button>}
   {value.archiveState==='archived'&&value.classification==='valid'&&(isEegMedia(value)?<a href={mediaContentHref(media.sessionId,value.id)} download>下载完整原件</a>:<Button onClick={()=>{setOpened(opened===value.id?null:value.id);setPlay(opened!==value.id);setFailed(null);}}>{isTongueMedia(value)?(opened===value.id?'收起原图':'查看原图'):(opened===value.id?isAudioMedia(value)?'收起语音':'收起视频':'播放')}</Button>)}
   {value.canRecheck&&<Button disabled={Boolean(media.checkingId)} loading={media.checkingId===value.id} onClick={()=>media.recheck(value)}>重新检查</Button>}
  </li>)}</ul>{media.nextCursor&&<Button onClick={media.more}>{hasImages||hasVoice||hasEeg?'更多文件':'更多视频'}</Button>}</details>}
  {media.contentEnabled&&items.filter(value=>!isTongueMedia(value)&&!isAudioMedia(value)&&!isEegMedia(value)&&value.archiveState==='archived'&&value.classification==='valid').map(value=><AgentMediaContent key={value.id} client={media.client} identity={media.identity} sessionId={media.sessionId} item={value} active={opened?opened===value.id:items[0]?.id===value.id} paused={media.paused} onSeek={seek} onRestricted={id=>{if(opened===id){setOpened(null);pendingSeek.current=null;}}}/>)}
  {bindingItem&&<AgentMediaIngest key={bindingItem.id} client={media.client} identity={media.identity} sessionId={media.sessionId} item={bindingItem} acquisitionContext={media.acquisitionContext} onDirtyChange={media.onRegistrationDirty}/>}
  {item&&<div className="agent-media-player">{isTongueMedia(item)?<>{failed!==item.id&&<img key={item.id} src={mediaContentHref(media.sessionId,item.id)} alt="当前舌图原件" onError={()=>setFailed(item.id)}/>}<a href={mediaContentHref(media.sessionId,item.id)} target="_blank" rel="noopener noreferrer">打开原图</a></>:isAudioMedia(item)?<>{failed!==item.id&&<OriginalAudio src={mediaContentHref(media.sessionId,item.id)} label="当前语音原件" autoPlay={play} onError={()=>setFailed(item.id)}/>}<a href={mediaContentHref(media.sessionId,item.id)} target="_blank" rel="noopener noreferrer">打开语音原件</a></>:<video ref={videoRef} data-media-id={item.id} onLoadedMetadata={applySeek} key={item.id} src={mediaContentHref(media.sessionId,item.id)} controls playsInline autoPlay={play} preload="metadata" aria-label="当前视频" onError={()=>setFailed(item.id)}/>}{failed===item.id&&<p role="alert">{isTongueMedia(item)?'当前舌图无法加载，请核对网络与文件状态。':isAudioMedia(item)?'当前语音无法播放，请核对网络与文件状态。':'当前视频无法播放，请核对网络；文件检查通过但浏览器不支持其编码时，可换兼容浏览器查看。'}{(isTongueMedia(item)||isAudioMedia(item))&&<Button onClick={()=>setFailed(null)}>{isAudioMedia(item)?'重新加载语音':'重新加载原图'}</Button>}</p>}</div>}
  {items.some(x=>!isTongueMedia(x)&&!isAudioMedia(x)&&!isEegMedia(x)&&x.archiveState==='archived')&&!media.contentEnabled&&<p>原视频可播放，内容解读暂不可用。</p>}
  {hasImages&&<p>请核对原图及采集归属；文件检查通过不代表舌象质量合格。</p>}{hasVoice&&<p>支持WAV（PCM16/24位）、MP3和M4A（AAC）的单音轨录音；请按研究方案核对录音质量与采集归属。</p>}
  {items.some(x=>x.archiveState==='archived')&&media.registrationState==='unavailable'&&<p role="status">{hasImages||hasVoice||hasEeg?'原件可查看，登记暂不可用。':'视频仍可播放，登记暂不可用。'}</p>}
  {pending.length>0&&!uploading&&<div role="status">{pending.map((record,index)=><p key={record.requestKey}>{index===0?(checkingUploads?'正在核对上传状态…':feedback||`有一项${mediaExtensionLabel(record.extension)}上传尚未完成。`):'还有一项文件上传尚未完成。'}（{record.extension.toUpperCase()} · {(record.byteSize/1024/1024).toFixed(2)} MiB）{record.phase==='completing'&&record.uploadId?<Button disabled={checkingUploads} onClick={()=>media.finish(record)}>继续归档</Button>:<Button disabled={checkingUploads} onClick={()=>media.pickPending(record)}>继续上传</Button>}</p>)}<Button loading={checkingUploads} busyLabel="核对中…" onClick={media.refresh}>核对上传</Button></div>}
  {!pending.length&&feedback&&!uploading&&<p role="status">{feedback}</p>}
  {error&&<p role="alert">{error} <Button loading={checkingUploads} busyLabel="核对中…" onClick={media.refresh}>{hasImages||hasVoice||hasEeg?'核对文件状态':'核对视频状态'}</Button></p>}
 </section>}</>;

}
