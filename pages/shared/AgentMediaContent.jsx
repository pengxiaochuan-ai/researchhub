import React,{useEffect,useRef,useState}from'react';
import{Button}from'./Components.jsx';import{contentBase,assertContentRun,assertPlaybackEvidence,mediaTime}from'../../src/session-media-content.js';import'./AgentMediaContent.css';
const stateLabel={idle:'等待处理',queued:'等待处理',running:'正在处理',complete:'已完成',not_applicable:'不适用',failed:'未能完成'};
const reasonLabel={no_audio:'原视频不含音轨。',no_speech:'未检测到可转写的语音。',MEDIA_CONTENT_TIMELINE_UNSUPPORTED:'此视频的时间格式暂不支持内容定位，仍可播放原件。',MEDIA_CONTENT_DURATION_UNSUPPORTED:'内容分析支持10分钟以内的视频，原件仍可播放。',MEDIA_CONTENT_FORMAT_UNSUPPORTED:'此格式暂不支持内容分析，原件仍可播放。',MEDIA_CONTENT_VISUAL_BUSY:'画面分析服务正在使用中，请稍后重试。',MEDIA_CONTENT_AUTHORIZATION_CHANGED:'登录身份已变化，此次尚未执行；请核对后再重试。',MEDIA_CONTENT_INTERRUPTED_UNKNOWN:'处理曾中断，结果尚待核对；不会自动重跑。'};
export function AgentMediaContent({client,identity,sessionId,item,active=false,paused=false,onSeek,onRestricted}){
 const [run,setRun]=useState(null),[error,setError]=useState(''),[restricted,setRestricted]=useState(false),[reading,setReading]=useState(false);const generation=useRef(0),sequence=useRef(0),latest=useRef({});latest.current={identity,sessionId,item,paused};const base=contentBase(sessionId,item.id),view=identity+':'+sessionId+':'+item.id+':'+item.version;
 const [shown,setShown]=useState(view);const current=(g,s)=>g===generation.current&&(s===undefined||s===sequence.current)&&latest.current.identity===identity&&latest.current.sessionId===sessionId&&latest.current.item.version===item.version&&!latest.current.paused;
 const readRef=useRef(null);
 async function read(g=generation.current){if(paused)return;const s=++sequence.current;try{let value=assertContentRun(await client.get(base+'/content-runs/current'),item);if(!current(g,s))return;
  if(!value.requestKey){const requestKey='start-'+value.rootId;try{value=assertContentRun(await client.post(base+'/content-runs',{requestKey,expectedMediaVersion:item.version}),item);}catch(reason){if(!current(g,s))return;const receipt=await client.get(base+'/content-receipts/'+requestKey);if(!receipt.found)throw reason;value=assertContentRun(receipt.item,item);}}
  if(current(g,s)){setRun(value);setShown(view);setError('');setRestricted(false);}
 }catch(e){if(current(g,s)){setShown(view);if([401,403,404,410].includes(e.status)){setRun(null);setRestricted(true);if(run)onRestricted?.(item.id);}else setError(e.message||'视频解读暂不可用，请重新查询。');}}}
 readRef.current=read;
 useEffect(()=>{const g=++generation.current;setRun(null);setError('');setRestricted(false);setShown(view);if(!paused)void read(g);return()=>{++generation.current;};},[client,view,paused]);
 const visible=shown===view?run:null,busy=visible&&['audio','visual'].some(k=>['idle','queued','running'].includes(visible.channels[k].state));
 useEffect(()=>{if(!busy||paused)return;const timer=setInterval(()=>void readRef.current(),2500);return()=>clearInterval(timer);},[busy,paused,view]);
 async function seek(e){const g=generation.current;setReading(true);try{const value=assertPlaybackEvidence(await client.get(base+'/content-runs/'+visible.id+'/evidence/'+e.id),visible,item);if(current(g))await onSeek?.(item,value);}catch(e){if(current(g)){setError(e.message);if([401,403,404,410].includes(e.status)){setRun(null);setRestricted(true);if(run)onRestricted?.(item.id);}}}finally{if(current(g))setReading(false);}}
 async function retry(channel){const g=generation.current,s=++sequence.current;setError('');try{const requestKey='retry-'+crypto.randomUUID(),value=assertContentRun(await client.post(base+'/content-runs/'+visible.id+'/retries',{requestKey,expectedVersion:visible.version,channel}),item);if(current(g,s))setRun(value);}catch(e){if(current(g,s))setError(e.message||'未能确认重试，请查询原状态。');}}
 if(!active)return null;
 return <div className="agent-media-content" aria-label="视频内容解读" data-content-media={item.id}>
  {restricted?<p role="status">当前视频尚无可用解读或访问授权已变化。</p>:visible?<>
   {['audio','visual'].map(channel=><section key={channel} aria-label={channel==='audio'?'自动转写':'抽样画面'}><h4>{channel==='audio'?'自动转写':'抽样画面'} · {stateLabel[visible.channels[channel].state]}</h4>
    {visible.channels[channel].reason&&<p>{reasonLabel[visible.channels[channel].reason]??'此通道没有可展示内容。'}</p>}
    {visible.channels[channel].state==='failed'&&<p role="status">{reasonLabel[visible.channels[channel].code]??'此次处理未完成，原视频仍可播放。'} {visible.channels[channel].outcomeKnown===true&&visible.latest&&<Button onClick={()=>retry(channel)}>重试{channel==='audio'?'转写':'画面分析'}</Button>}</p>}
    {visible.evidence.filter(e=>e.channel===channel).map(e=><div className="agent-media-evidence" key={e.id}>{e.kind==='frame'&&<img loading="lazy" src={'/api'+base+'/content-runs/'+visible.id+'/evidence/'+e.id+'/image'} alt="该时间点的原视频画面"/>}<div><Button disabled={reading||paused} onClick={()=>seek(e)} aria-label={`回放${mediaTime(e.startUs)}${e.kind==='transcript'?'附近语音':'画面'}`}>{mediaTime(e.startUs)}{e.estimated?' 附近':''}</Button><p>{e.text}</p></div></div>)}
   </section>)}
   {visible.manifest&&<p className="agent-media-coverage">视频时长 {mediaTime(visible.manifest.durationUs)}。{visible.channels.audio.state==='complete'?'语音已自动转写，时间为近似定位；请回听核对。':''}{visible.channels.visual.state==='complete'?`抽样查看${visible.evidence.filter(e=>e.channel==='visual').length}处画面，并非逐帧审阅。`:''}</p>}
  </>:!error&&<p role="status">正在核对视频解读状态…</p>}
  {error&&<p role="alert">{error} <Button onClick={()=>readRef.current()}>重新查询</Button></p>}
 </div>;
}
