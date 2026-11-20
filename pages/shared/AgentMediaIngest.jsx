import React,{useEffect,useRef,useState}from'react';import{Button}from'./Components.jsx';
import{mediaIngestBase,mediaIngestSubjectBase,assertMediaIngest,assertMediaIngestTargets,assertMediaIngestPage,readMediaIngestPending}from'../../src/session-media-ingests.js';
import{selectMediaDataContext,studyDataReturnHref}from'../../src/study-data-navigation.js';
import{isTongueMedia,isAudioMedia,isEegMedia,eegInspectionLabel}from'../../src/session-media-types.js';
import{OriginalAudio}from'./OriginalAudio.jsx';
import'./AgentMediaIngest.css';
const message=e=>/^(?:MEDIA_INGEST_|Cannot (?:GET|POST)|Not Found|Internal server error|Failed to fetch)/.test(e?.message??'')?'暂时无法核对文件登记信息，请保留原操作并核对。':e?.message||'暂时无法核对登记结果。';
const checkText=i=>i?.hasEeg?eegInspectionLabel(i):i?.hasImage?`图片可读取 · ${i.width} × ${i.height} 像素`:i?.hasAudio&&i.hasVideo===false?`音频可读取 · 时长 ${i.durationSeconds}秒 · ${i.sampleRateHz} Hz · ${i.channels}声道${i.bitDepth==null?'':` · ${i.bitDepth} bit`}`:[i.hasVideo?'含画面':'未检出画面',i.hasAudio?'含声音':'无音轨',...(Number.isFinite(i.durationSeconds)?[`时长 ${i.durationSeconds}秒`]:[])].join(' · ');
function Receipt({item}){return <div className="media-ingest-receipt"><p>{item.study.name} · {item.subject.subjectCode} · {item.visit?.name??'未关联访视'}</p><p>登记时文件检查：{checkText(item.source.inspection)}</p>{item.source.modality==='eeg'&&<ul>{item.source.inspection.members.map(m=><li key={m.extension}>{m.name}</li>)}</ul>}{item.collectedAt&&<p>采集时间：{new Date(item.collectedAt).toLocaleString('zh-CN')}</p>}<details><summary>登记记录</summary><p>原件记录：{item.receipt?.modalityFileId}</p><p>登记时间：{item.receipt&&new Date(item.receipt.registeredAt).toLocaleString('zh-CN')}</p></details></div>;}
export function AgentMediaIngest({client,identity,sessionId,item,acquisitionContext,onDirtyChange}){
 const contextKey=[acquisitionContext?.studyId,acquisitionContext?.subjectId,acquisitionContext?.visitId].join(':');
 const base=mediaIngestBase(sessionId,item.id),key=`rh-media-ingest:${identity}:${sessionId}:${item.id}`,viewKey=key+':'+item.version+':'+contextKey,epoch=useRef(0),pending=useRef(null),writing=useRef(false),latest=useRef(null);latest.current={client,viewKey};
 const [shown,setShown]=useState(viewKey);
 const [targets,setTargets]=useState([]),[studyId,setStudy]=useState(''),[subjectId,setSubject]=useState(''),[visitId,setVisit]=useState(''),[collectedAt,setCollected]=useState(''),[current,setCurrent]=useState(null),[plan,setPlan]=useState(null),[phase,setPhase]=useState('loading'),[error,setError]=useState('');
 const [dirty,setDirty]=useState(false);
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 useEffect(()=>()=>onDirtyChange?.(false),[onDirtyChange]);
 const study=targets.find(s=>s.id===studyId),subject=study?.subjects.find(s=>s.id===subjectId);
 const valid=t=>epoch.current===t&&latest.current.client===client&&latest.current.viewKey===viewKey;
 const save=value=>{try{sessionStorage.setItem(key,JSON.stringify(value));pending.current=value;}catch{throw Error('无法保存登记恢复信息，请允许站点存储后重试。');}};
 const forget=()=>{try{sessionStorage.removeItem(key);}catch{}pending.current=null;};
 function accept(row){assertMediaIngest(row,item.id);if(row.state==='committed'){setCurrent(row);setPlan(null);setDirty(false);forget();setPhase('committed');}else{setPlan(row);setStudy(row.study.id);setSubject(row.subject.id);setVisit(row.visit?.id??'');setPhase('ready');}}
 async function recover(t=epoch.current){
  const record=pending.current;if(!record)return;
  setPhase('checking');setError('');
  try{const response=await client.get(base+'/ingest-receipts/'+record.requestKey);if(!valid(t))return;if(response.found){accept(response.item);}else{setPlan(null);setPhase('unknown');setError('尚未查到原登记结果，请保留原信息，可继续核对或按原信息重试。');}}
  catch(e){if(valid(t)){setCurrent(null);setPlan(null);setPhase('unknown');setError(message(e));}}
 }
 useEffect(()=>{
  const t=++epoch.current;setShown(viewKey);setDirty(false);writing.current=false;setCurrent(null);setPlan(null);setTargets([]);setError('');setPhase('loading');
  let raw;try{raw=sessionStorage.getItem(key);pending.current=readMediaIngestPending(raw);}catch{pending.current=null;}
  async function load(){try{const data=assertMediaIngestTargets(await client.get(base+'/ingest-targets'+(acquisitionContext?.studyId?'?studyId='+encodeURIComponent(acquisitionContext.studyId):'')),item.id);if(!valid(t))return;setTargets(data.items);
    if(data.current){accept(data.current);return;}
    if(pending.current){await recover(t);return;}
    if(raw){setPhase('unknown');setError('原登记记录无法核对，请保留原操作并联系管理员核查。');return;}
    const selected=selectMediaDataContext(data.items,acquisitionContext);setStudy(selected.studyId);setSubject(selected.subjectId);setVisit(selected.visitId);setCollected('');setPhase('ready');
   }catch(e){if(valid(t)){setCurrent(null);setTargets([]);setPhase('error');setError(message(e));}}}
  void load();return()=>{++epoch.current;};
 },[client,identity,sessionId,item.id,item.version,contextKey]);
 async function submit(){
  if(writing.current)return;const t=epoch.current;writing.current=true;setPhase('writing');setError('');
  try{
   let record=pending.current,prepared=plan;
   if(!record){if(!studyId||!subjectId)throw Error('请选择研究和被试后确认。');const requestKey='media-bind-'+crypto.randomUUID();record={schema:'hub-media-ingest-pending.v1',requestKey,phase:'preparing',body:{requestKey,studyId,subjectId,subjectVisitId:visitId||null,collectedAt:collectedAt?new Date(collectedAt).toISOString():null}};save(record);}
   if(!prepared){prepared=assertMediaIngest(await client.post(base+'/ingests',record.body),item.id);if(!valid(t))return;
    if(prepared.study.id!==record.body.studyId||prepared.subject.id!==record.body.subjectId||(prepared.visit?.id??null)!==record.body.subjectVisitId||prepared.collectedAt!==record.body.collectedAt)throw Error('返回的关联信息已变化，请核对原操作。');
    if(prepared.state==='committed'){accept(prepared);return;}setPlan(prepared);
   }
   if(!valid(t))return;save({...record,phase:'confirming'});
   const done=assertMediaIngest(await client.post(base+'/ingests/'+prepared.id+'/confirm',{expectedVersion:prepared.version,confirmationHash:prepared.confirmationHash}),item.id);
   if(valid(t))accept(done);
  }catch(e){if(valid(t)){setCurrent(null);if(e.status>=400&&e.status<500){setPlan(null);forget();setPhase('error');}else setPhase(pending.current?'unknown':'error');setError(message(e));}}
  finally{if(valid(t))writing.current=false;}
 }
 const busy=['loading','writing','checking'].includes(phase),frozen=Boolean(pending.current),done=current?.state==='committed';
 if(shown!==viewKey)return null;
 return <div className="agent-media-ingest" aria-label={isTongueMedia(item)?'舌图登记':isAudioMedia(item)?'语音登记':isEegMedia(item)?'EEG登记':'视频登记'} aria-busy={busy}>
  <p>文件检查：{checkText(item.inspection)}</p>
  {isEegMedia(item)&&<><ul>{item.inspection.members.map(m=><li key={m.extension}>{m.name} · {(m.size/1024/1024).toFixed(2)} MiB</li>)}</ul><p>请核对文件来自同次导出；同名同尺寸的配套文件无法自动区分。登记保留所选原件，采集质量仍需审阅。</p></>}
  {done?<><p role="status">登记成功</p><Receipt item={current}/><a href={studyDataReturnHref({studyId:current.study.id,subjectId:current.subject.id,...(current.visit?.id?{visitId:current.visit.id}:{})})}>{current.visit?'查看本次访视':'查看被试数据'}</a></>:<>
   {phase==='loading'&&<p role="status">正在核对可关联的研究…</p>}
   {plan&&<p>{plan.study.name} · {plan.subject.subjectCode} · {plan.visit?.name??'未关联访视'}</p>}
   {!plan&&targets.length>0&&<div className="media-ingest-fields">
    {targets.length===1?<p>研究：{study?.name}</p>:<label>研究<select aria-label="关联研究" disabled={busy||frozen} value={studyId} onChange={e=>{setDirty(true);setStudy(e.target.value);setSubject('');setVisit('');}}><option value="">请选择研究</option>{targets.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    {study?.subjects.length===1?<p>被试：{subject?.subjectId}</p>:<label>被试<select aria-label="关联被试" disabled={busy||frozen||!studyId} value={subjectId} onChange={e=>{setDirty(true);setSubject(e.target.value);setVisit('');}}><option value="">请选择被试</option>{study?.subjects.map(s=><option key={s.id} value={s.id}>{s.subjectId}</option>)}</select></label>}
    <label>访视<select aria-label="关联访视" disabled={busy||frozen||!subjectId} value={visitId} onChange={e=>{setDirty(true);setVisit(e.target.value);}}><option value="">不关联访视</option>{subject?.visits.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
    <details><summary>采集时间（可选）</summary><input aria-label="实际采集时间" type="datetime-local" disabled={busy||frozen} value={collectedAt} onChange={e=>{setDirty(true);setCollected(e.target.value);}}/></details>
   </div>}
   {!busy&&!targets.length&&!plan&&!error&&<p>当前没有可关联的研究或被试，原件保留在本会话中。</p>}
   {error&&<p role="alert">{error}</p>}
   {(targets.length>0||plan)&&<Button primary disabled={busy||(!pending.current&&(!studyId||!subjectId))} loading={phase==='writing'} busyLabel="正在核对并登记…" onClick={submit}>{pending.current?'继续登记':'确认关联并登记'}</Button>}
   {(phase==='unknown'||pending.current)&&<Button disabled={busy} loading={phase==='checking'} busyLabel="核对中…" onClick={()=>recover()}>核对登记</Button>}
   {plan&&pending.current?.phase==='preparing'&&<Button disabled={busy} onClick={()=>{forget();setPlan(null);setPhase('ready');setError('');}}>修改关联</Button>}
  </>}
 </div>;
}
export function RegisteredMediaList({client,identity,studyId,subjectId,visitId,fileId,compact=false,enabled=true}){
 const epoch=useRef(0),[items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[opened,setOpened]=useState(null),[playing,setPlaying]=useState(null),[next,setNext]=useState(null);
 const base=mediaIngestSubjectBase(studyId,subjectId),viewKey=[identity,studyId,subjectId,visitId,fileId,enabled].join(':'),latest=useRef(null),[shown,setShown]=useState(viewKey);latest.current={client,viewKey};
 const valid=t=>t===epoch.current&&latest.current.client===client&&latest.current.viewKey===viewKey;
 async function load(cursor){const t=++epoch.current;setBusy(true);setError('');if(!cursor)setPlaying(null);try{const url=base+'?'+new URLSearchParams({limit:'20',...(visitId?{visitId}:{}),...(fileId?{fileId}:{}),...(cursor?{cursor}:{})}),get=client.get??client.request,data=assertMediaIngestPage(await get(url));if(!valid(t))return false;setItems(old=>cursor?[...new Map([...old,...data.items].map(x=>[x.id,x])).values()]:data.items);setNext(data.nextCursor);return true;}catch(e){if(valid(t)){setItems([]);setOpened(null);setPlaying(null);setError(message(e));}return false;}finally{if(valid(t))setBusy(false);}}
 useEffect(()=>{++epoch.current;setShown(viewKey);setItems([]);setOpened(null);setPlaying(null);setNext(null);setError('');if(!enabled)return;void load();const focus=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{++epoch.current;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[client,identity,studyId,subjectId,visitId,fileId,enabled]);
 async function playbackError(item){setPlaying(null);if(await load())setError(item.source.modality==='tongue'?'当前舌图无法加载，请核对网络与原件状态。':item.source.modality==='audio'?'当前语音无法播放，请核对网络与原件状态。':'当前视频无法播放，请核对浏览器编码支持和网络。');}
 if(shown!==viewKey||!enabled||compact&&!items.length&&!error)return null;
 return <div className="registered-media-list" aria-busy={busy}>{error&&<p role="alert">{error} <Button disabled={busy} onClick={()=>load()}>重新读取登记记录</Button></p>}{!items.length&&!busy&&!error&&<p>暂无可核验数据。</p>}{items.length>0&&<ul>{items.map(item=>{const image=item.source.modality==='tongue',voice=item.source.modality==='audio',eeg=item.source.modality==='eeg';return <li key={item.id}><p>{image?'舌图原件':voice?'语音原件':eeg?'EEG原件':'视频原件'} · {item.visit?.name??'未关联访视'} · {new Date(item.receipt.registeredAt).toLocaleString('zh-CN')}</p><Button onClick={()=>setOpened(opened===item.id?null:item.id)}>{image||voice||eeg?'查看登记记录':'查看回执'}</Button><>{eeg?<a href={item.contentHref} download>下载完整原件</a>:<Button onClick={()=>setPlaying(playing===item.id?null:item.id)}>{image?(playing===item.id?'收起原图':'查看原图'):(playing===item.id?voice?'收起语音':'收起视频':'播放')}</Button>}</>{opened===item.id&&<Receipt item={item}/>}<div hidden={!playing||playing!==item.id}>{playing===item.id&&(image?<><img key={item.id} src={item.contentHref} alt="已登记舌图原件" onError={()=>playbackError(item)}/><a href={item.contentHref} target="_blank" rel="noopener noreferrer">打开原图</a></>:voice?<OriginalAudio src={item.contentHref} label="已登记语音原件" autoPlay onError={()=>playbackError(item)}/>:<video key={item.id} src={item.contentHref} controls playsInline autoPlay preload="metadata" aria-label="已登记视频" onError={()=>playbackError(item)}/>)}</div></li>;})}</ul>}{next&&<Button disabled={busy} onClick={()=>load(next)}>{items.some(i=>['tongue','audio','eeg'].includes(i.source.modality))?'更多文件':'更多视频'}</Button>}</div>;

}
