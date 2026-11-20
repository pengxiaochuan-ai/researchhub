import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useAgentMedia} from '../../pages/shared/AgentMedia.jsx';
import {useAgentMaterials,AgentMaterialsView} from '../../pages/shared/AgentMaterials.jsx';
import {RegisteredMediaList} from '../../pages/shared/AgentMediaIngest.jsx';
import {createEeglabEnvelope} from '../../src/eeglab-envelope.js';
import '../../src/design-tokens.css';
const key='synthetic-eeglab-harness.v1';
const read=()=>{try{return JSON.parse(sessionStorage.getItem(key))??{items:[],rows:{},calls:[],chunks:{}};}catch{return{items:[],rows:{},calls:[],chunks:{}};}};
const data=read(),save=()=>sessionStorage.setItem(key,JSON.stringify(data));
const h={actor:'owner',denied:false,sourceDenied:false,loseConfirm:false,delayPrepare:false,noTargets:false,data};window.eeglabHarness=h;
h.configure=({inspection,rejectCode=null})=>{data.inspection=inspection;data.rejectCode=rejectCode;save();};
h.package=createEeglabEnvelope;
const log=(method,path,body)=>{data.calls.push({method,path,body,actor:h.actor});save();};
const current=()=>data.rows[h.actor]??null;
const unavailable=()=>({hasEeg:false,hasAudio:false,hasVideo:false,hasImage:false,...(data.rejectCode?{failureCode:data.rejectCode}:{})});
const item=(body=data.uploadBody??{})=>({id:'eeg',version:3,modality:'eeg',name:'rh-media-eeg.eeglab',extension:'eeglab',byteSize:body.size??100,archiveState:'archived',inspectionState:data.rejectCode?'unavailable':'complete',classification:data.rejectCode?'corrupt':'valid',contentUnderstood:false,createdAt:'2026-11-19T00:00:00.000Z',inspection:data.rejectCode?unavailable():data.inspection});
const bytes=()=>Object.keys(data.chunks).sort((a,b)=>a-b).flatMap(k=>data.chunks[k]);
h.originalBytes=bytes;
const client={get:async path=>{
 log('GET',path);
 if(path.includes('/materials'))return{items:[],nextCursor:null};
 if(path.startsWith('/research-studies/')){const row=current();if(h.delayRead){h.delayRead=false;await new Promise(resolve=>h.releaseRead=resolve);}if(h.denied)throw Object.assign(Error('读取权限已变化'),{status:403});return{items:row?.state==='committed'?[row]:[],nextCursor:null};}
 if(h.sourceDenied)throw Object.assign(Error('来源读取权限已变化'),{status:403});
 if(path.includes('/ingest-targets'))return{items:h.noTargets||current()?.state==='committed'?[]:[{id:'study',name:'合成研究',subjects:[{id:'subject',subjectId:'SYNTHETIC',visits:[{id:'visit',name:'本次访视'}]}]}],current:current()?.state==='committed'?current():null};
 if(path.includes('/ingest-receipts/'))return{found:Boolean(current()),item:current()};
 if(path.includes('/media/receipts/'))return{found:data.items.length>0,item:data.items[0]};
 if(path.includes('/media?'))return{items:h.actor==='owner'?data.items:[],nextCursor:null};
 throw Error('Unexpected isolated EEGLAB read: '+path);
},post:async(path,body)=>{
 const actor=h.actor;log('POST',path,body);
 if(path.endsWith('/media-uploads')){data.uploadBody=body;data.chunks={};save();return{item:{...item(body),archiveState:'pending',inspectionState:'pending',classification:null,inspection:unavailable()},uploadId:'11111111-1111-4111-8111-111111111111',chunkSize:1024*1024,totalChunks:Math.ceil(body.size/(1024*1024))};}
 if(path.endsWith('/complete')){const value=item();data.items=[value];data.sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes())))].map(x=>x.toString(16).padStart(2,'0')).join('');save();return value;}
 if(path.endsWith('/confirm')){const row=data.rows[actor];data.rows[actor]={...row,version:2,state:'committed',receipt:{schema:'hub-media-ingest-receipt.v1',confirmationHash:row.confirmationHash,modalityFileId:'eeg-file',registeredAt:'2026-11-19T00:00:00.000Z'},contentHref:`/api/research-studies/study/subjects/subject/session-media-ingests/binding-${actor}/content`};save();if(h.loseConfirm)throw Error('结果尚未确认');return data.rows[actor];}
 if(path.endsWith('/ingests')){if(h.delayPrepare)await new Promise(resolve=>h.releasePrepare=resolve);data.rows[actor]={id:'binding-'+actor,version:1,state:'planned',requestKey:body.requestKey,confirmationHash:'a'.repeat(64),source:{mediaId:'eeg',modality:'eeg',sha256:data.sha256,byteSize:data.uploadBody.size,inspection:data.inspection},study:{id:body.studyId,name:'合成研究'},subject:{id:body.subjectId,subjectCode:'SYNTHETIC'},visit:body.subjectVisitId?{id:body.subjectVisitId,name:'本次访视'}:null,collectedAt:body.collectedAt??null};save();return data.rows[actor];}
 throw Error('Unexpected isolated EEGLAB write: '+path);
},upload:async(path,body)=>{data.chunks[path.split('/').pop()]=[...new Uint8Array(await body.arrayBuffer())];log('CHUNK',path,{byteSize:body.size});}};
function App(){
 const[actor,setActor]=useState('owner'),[revision,setRevision]=useState(0),[paused,setPaused]=useState(false);
 h.identity=v=>{h.actor=v;setActor(v);};h.refresh=()=>setRevision(x=>x+1);h.pause=v=>setPaused(v);
 const media=useAgentMedia({client,identity:actor,sessionId:'session',enabled:true,resumable:false,registrationEnabled:true,contentEnabled:true,acquisitionContext:{studyId:'study',subjectId:'subject',visitId:'visit'},paused});
 const materials=useAgentMaterials({client,identity:actor,sessionId:'session',getSession:async()=>'session',enabled:true,media,paused,contextStudyId:'study'});
 return <main style={{fontSize:14,lineHeight:'22px',maxWidth:1000,padding:16}}><p id="actor">{actor}</p><button onClick={materials.pick} disabled={paused||materials.uploading||media.uploading}>上传文件</button><AgentMaterialsView materials={materials}/><div id="registered"><RegisteredMediaList key={actor+':'+revision} client={client} identity={actor} studyId="study" subjectId="subject" visitId="visit" enabled={!paused}/></div></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
