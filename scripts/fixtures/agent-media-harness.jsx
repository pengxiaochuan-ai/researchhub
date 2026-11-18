// Isolated UI contract fixture; no real backend or model.
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{useAgentMaterials,AgentMaterialsView}from'../../pages/shared/AgentMaterials.jsx';
import{useAgentMedia}from'../../pages/shared/AgentMedia.jsx';import'../../src/design-tokens.css';
const rows=new Map(),receipts=new Map(),identities=new Map(),parts=new Map(),h=window.mediaHarness={calls:[],actor:'owner',holdInit:false,holdChunk:false,unknownComplete:false,capability:true,resumable:new URL(location.href).searchParams.has('resumable')};
h.dump=()=>({rows:[...rows],receipts:[...receipts],identities:[...identities],parts:[...parts],count});h.restore=value=>{for(const[k,v]of value.rows)rows.set(k,v);for(const[k,v]of value.receipts)receipts.set(k,v);for(const[k,v]of value.identities??[])identities.set(k,v);for(const[k,v]of value.parts??[])parts.set(k,v);count=value.count??count;};
const rowKey=sid=>h.actor+':'+sid;let count=0;
const client={
 get:async path=>{h.calls.push(['GET',path,h.actor]);const sid=path.split('/')[2];if(path.includes('/media-uploads/')){const uploadId=path.split('/').at(-1),info=identities.get(uploadId);return{uploadId,byteSize:info.size,chunkSize:1024*1024,totalChunks:Math.ceil(info.size/(1024*1024)),received:parts.get(uploadId)??[]};}if(path.includes('/materials'))return{items:[],nextCursor:null};if(path.includes('/receipts/')){if(h.holdReceipt||h.holdNextReceipt){h.holdNextReceipt=false;await new Promise(resolve=>{h.releaseReceipt=resolve;});}const item=receipts.get(path.split('/').at(-1));return{found:Boolean(item),item,identityMode:h.resumable?'hub-media-content.v1':'legacy',upload:item?{uploadId:'00000000-0000-4000-a000-'+item.id.slice(6).padStart(12,'0'),chunkSize:1024*1024,totalChunks:Math.ceil(item.byteSize/(1024*1024))}:null};}return{items:rows.get(rowKey(sid))??[],nextCursor:null};},
 post:async(path,body)=>{
  h.calls.push(['POST',path,h.actor]);const sid=path.split('/')[2],key=rowKey(sid);
  if(path.endsWith('/media-uploads')){
   (h.initializationKeys??=[]).push(body.requestKey);
   if(h.failBeforeInit)throw Error('视频初始化暂不可用，请保留原上传并稍后核对。');
   const previous=h.resumable&&receipts.get(body.requestKey);
   if(previous)return{item:previous,uploadId:'00000000-0000-4000-a000-'+previous.id.slice(6).padStart(12,'0'),chunkSize:1024*1024,totalChunks:Math.ceil(body.size/(1024*1024)),identityMode:'hub-media-content.v1'};
   const item={id:'media-'+(++count),version:2,name:'media-'+count+'.mp4',extension:'mp4',byteSize:body.size,archiveState:'pending',inspectionState:'pending',classification:null,inspection:{hasAudio:false,hasVideo:false},contentUnderstood:false,canRecheck:false,createdAt:new Date().toISOString()};
   rows.set(key,[item]);receipts.set(body.requestKey,item);
   identities.set('00000000-0000-4000-a000-'+String(count).padStart(12,'0'),{size:body.size,fileIdentity:body.fileIdentity});
   if(h.holdInit)await new Promise(resolve=>{h.releaseInit=resolve;});
   if(h.unknownAfterInit)throw Error('视频初始化结果尚未确认。');
   return{item,uploadId:'00000000-0000-4000-a000-'+String(count).padStart(12,'0'),chunkSize:1024*1024,totalChunks:Math.ceil(body.size/(1024*1024)),identityMode:h.resumable?'hub-media-content.v1':'legacy'};
  }
  if(h.unknownBeforeArchive)throw Error('视频归档结果尚未确认。');
  const item=(rows.get(key)??[])[0],result={...item,version:5,archiveState:'archived',inspectionState:'complete',classification:'valid',inspection:{durationSeconds:1,hasVideo:true,hasAudio:true}};
  rows.set(key,[result]);for(const[k,v]of receipts)if(v.id===item.id)receipts.set(k,result);
  if(h.unknownComplete)throw Error('视频上传结果尚未确认。');return result;
 },
 upload:async(path,blob,options)=>{h.calls.push(['CHUNK',path,h.actor]);const index=Number(path.split('/').at(-1)),uploadId=path.split('/')[4];if(h.failIndexes?.includes(index))throw Error('上传连接中断，请继续原上传。');if(h.holdChunk)await new Promise(resolve=>{h.releaseChunk=resolve;});if(h.resumable){const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');parts.set(uploadId,[...(parts.get(uploadId)??[]).filter(x=>x.index!==index),{index,byteSize:blob.size,sha256}]);}options.onProgress?.({loaded:blob.size});return{uploaded:true};},
};
function Fixture(){
 const[sid,setSid]=useState('session-A'),[identity,setIdentity]=useState('owner'),[paused,setPaused]=useState(false),[enabled,setEnabled]=useState(true),[registrationState,setRegistrationState]=useState(undefined);
 h.switch=setSid;h.pause=setPaused;h.identity=value=>{h.actor=value;setIdentity(value);};h.capability=setEnabled;
 h.registration=setRegistrationState;
 const media=useAgentMedia({client,identity,sessionId:sid,enabled,resumable:h.resumable,registrationState,paused});
 h.mediaState={checkingUploads:media.checkingUploads,feedback:media.feedback,error:media.error};
 const materials=useAgentMaterials({client,identity,sessionId:sid,getSession:async()=>{if(h.deferSessionCommit)h.commitCreatedSession=()=>setSid('created-session');else setSid('created-session');return'created-session';},enabled:true,analysisReady:true,media,paused});
 return <main style={{maxWidth:720,padding:24,fontFamily:'sans-serif'}}><p id="current">{identity} · {sid??'未建会话'}</p><output id="paused">{String(paused)}</output><button onClick={materials.pick}>上传文件</button><AgentMaterialsView materials={materials} scope={{studyGroupId:'g',researchProjectId:'p'}} analysisReady/></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
