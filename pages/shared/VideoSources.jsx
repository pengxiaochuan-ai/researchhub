import React,{useEffect,useRef,useState} from 'react';
import {Button} from './Components.jsx';
import {contentBase,mediaTime,mediaEvidenceTime} from '../../src/session-media-content.js';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import './VideoSources.css';
export function VideoChatAnswer({message,media}){
 const key=media?.identity+':'+media?.sessionId+':'+message.id+':'+message.meta?.provenance?.videoEvidence?.packHash;
 const[restricted,setRestricted]=useState(null);
 if(restricted===key)return <p role="alert">视频或访问权限已变化，当前不能展示原解释。请刷新核对。</p>;
 return <><Markdown allowImages={false} headingOffset={2}>{message.content}</Markdown><VideoSources evidence={message.meta.provenance.videoEvidence} media={media} onRestricted={()=>setRestricted(key)}/></>;
}
export default function VideoSources({evidence,media,onRestricted}){
 const [feedback,setFeedback]=useState(''),[loading,setLoading]=useState(null),epoch=useRef(0);
 const identity=media?.identity+':'+media?.sessionId+':'+evidence?.packHash;
 useEffect(()=>{++epoch.current;setFeedback('');setLoading(null);return()=>{++epoch.current;};},[identity,media?.paused]);
 if(evidence?.schema!=='hub-video-pack.v1'||!Array.isArray(evidence.sources)||!evidence.sources.length)return null;
 async function replay(s){
  const turn=++epoch.current;setFeedback('');setLoading(s.id);
  try{
   if(!media?.client||media.paused||media.sessionId!==evidence.sessionId)throw Error('请在原视频会话核对并播放。');
   const result=await media.client.get(contentBase(evidence.sessionId,evidence.mediaId)+'/content-runs/'+evidence.runId+'/evidence/'+s.evidenceId);
   if(turn!==epoch.current)return;
   if(result.id!==s.evidenceId||result.sourceSha256!==evidence.sourceSha256||result.mediaVersion!==evidence.sourceVersion||result.playbackUs!==s.startUs||result.startUs!==s.startUs||result.endUs!==s.endUs)throw Object.assign(Error('视频或来源已变化，请刷新核对。'),{code:'VIDEO_SOURCE_CHANGED'});
   if(!media.playbackRef?.current?.(evidence,result))throw Error('原视频尚未就绪，请核对本会话视频后再试。');
  }catch(e){if(turn===epoch.current){if([401,403,404,409,410].includes(e.status)||e.code==='VIDEO_SOURCE_CHANGED'){media?.closePlaybackRef?.current?.(evidence);onRestricted?.();setFeedback('视频或访问权限已变化，请刷新核对。');}else setFeedback(e.message||'视频暂时无法定位，请稍后再试。');}}
  finally{if(turn===epoch.current)setLoading(null);}
 }
 return <details className="video-chat-sources"><summary>核对视频来源与时间 · {evidence.sources.length}条</summary><p>仅以下自动转写与抽样画面描述；AI解释需结合原视频核对，具体时间以来源回放为准。</p><ul>{evidence.sources.map(s=><li key={s.id}><div><b>[{s.id}] {s.kind==='transcript'?'自动转写':'抽样画面描述（AI生成）'}</b><Button disabled={Boolean(loading)||media?.paused} loading={loading===s.id} onClick={()=>replay(s)} aria-label={'回放来源'+s.id+' '+mediaEvidenceTime(s)}>{mediaEvidenceTime(s)}{s.kind==='transcript'?'–'+mediaTime(s.endUs):''}{s.estimated?' · 近似位置':''}</Button></div><p>{s.text}{s.textTruncated?'（片段已截取）':''}</p></li>)}</ul>{feedback&&<p role="alert">{feedback}</p>}</details>;
}
