import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useAgentMedia} from '../../pages/shared/AgentMedia.jsx';
import {useAgentMaterials,AgentMaterialsView} from '../../pages/shared/AgentMaterials.jsx';
import {RegisteredMediaList} from '../../pages/shared/AgentMediaIngest.jsx';
import '../../src/design-tokens.css';
const storageKey='audio-media-component-harness.v1';
const stored=()=>{try{return JSON.parse(sessionStorage.getItem(storageKey))??{items:[],rows:{},calls:[]};}catch{return{items:[],rows:{},calls:[]};}};
const data=stored(),h={actor:'owner',denied:false,sourceDenied:false,paused:false,loseConfirm:false,delayPrepare:false,data};window.audioHarness=h;
const save=()=>sessionStorage.setItem(storageKey,JSON.stringify(data));
const audio=(body={})=>({id:'audio',version:3,modality:'audio',name:'rh-media-audio.'+((body.filename??'voice.wav').split('.').pop()),extension:(body.filename??'voice.wav').split('.').pop().toLowerCase(),byteSize:body.size??100,archiveState:'archived',inspectionState:'complete',classification:'valid',contentUnderstood:false,createdAt:'2026-11-19T00:00:00.000Z',inspection:{hasImage:false,hasVideo:false,hasAudio:true,durationSeconds:1,sampleRateHz:44100,channels:1,codec:(body.filename??'voice.wav').endsWith('.wav')?'pcm_s24le':(body.filename??'voice.wav').endsWith('.mp3')?'mp3':'aac',bitDepth:(body.filename??'voice.wav').endsWith('.wav')?24:null}});
const current=()=>data.rows[h.actor]??null;
const log=(method,path,body)=>{data.calls.push({method,path,body,actor:h.actor});save();};
const client={get:async path=>{
 log('GET',path);
 if(path.includes('/materials'))return{items:[],nextCursor:null};
 if(path.startsWith('/research-studies/')){if(h.denied)throw Object.assign(Error('读取权限已变化'),{status:403});return{items:current()?.state==='committed'?[current()]:[],nextCursor:null};}
 if(h.sourceDenied)throw Object.assign(Error('来源读取权限已变化'),{status:403});
 if(path.includes('/ingest-targets'))return{items:current()?.state==='committed'?[]:[{id:'study',name:'合成研究',subjects:[{id:'subject',subjectId:'SYNTHETIC',visits:[{id:'visit',name:'本次访视'}]}]}],current:current()?.state==='committed'?current():null};
 if(path.includes('/ingest-receipts/'))return{found:Boolean(current()),item:current()};
 if(path.includes('/media/receipts/'))return{found:data.items.length>0,item:data.items[0]};
 if(path.includes('/media?'))return{items:h.actor==='owner'?data.items:[],nextCursor:null};
 throw Error('Unexpected harness read: '+path);
},post:async(path,body)=>{
 const actor=h.actor;log('POST',path,body);
 if(path.endsWith('/media-uploads')){const item={...audio(body),archiveState:'pending',inspectionState:'pending',classification:null,inspection:{hasImage:false,hasVideo:false,hasAudio:false}};data.uploadBody=body;save();return{item,uploadId:'11111111-1111-4111-8111-111111111111',chunkSize:1024*1024,totalChunks:Math.ceil(body.size/(1024*1024))};}
 if(path.endsWith('/complete')){const item=audio(data.uploadBody);data.items=[item];save();return item;}
 if(path.endsWith('/confirm')){const row=data.rows[actor];data.rows[actor]={...row,version:2,state:'committed',receipt:{schema:'hub-media-ingest-receipt.v1',confirmationHash:row.confirmationHash,modalityFileId:'file',registeredAt:'2026-11-19T00:00:00.000Z'},contentHref:`/api/research-studies/study/subjects/subject/session-media-ingests/binding-${actor}/content`};save();if(h.loseConfirm)throw Error('结果尚未确认');return data.rows[actor];}
 if(path.endsWith('/ingests')){if(h.delayPrepare)await new Promise(resolve=>h.releasePrepare=resolve);data.rows[actor]={id:'binding-'+actor,version:1,state:'planned',requestKey:body.requestKey,confirmationHash:'a'.repeat(64),source:{mediaId:'audio',modality:'audio',sha256:'b'.repeat(64),byteSize:data.items[0]?.byteSize??100,inspection:audio(data.uploadBody).inspection},study:{id:body.studyId,name:'合成研究'},subject:{id:body.subjectId,subjectCode:'SYNTHETIC'},visit:body.subjectVisitId?{id:body.subjectVisitId,name:'本次访视'}:null,collectedAt:body.collectedAt??null};save();return data.rows[actor];}
 throw Error('Unexpected harness write: '+path);
},upload:async(path,body)=>{log('CHUNK',path,{byteSize:body.size});}};
function App(){
 const[actor,setActor]=useState('owner'),[revision,setRevision]=useState(0),[paused,setPaused]=useState(false);
 h.identity=value=>{h.actor=value;setActor(value);};h.refresh=()=>setRevision(x=>x+1);h.pause=value=>{h.paused=value;setPaused(value);};
 const media=useAgentMedia({client,identity:actor,sessionId:'session',enabled:true,resumable:false,registrationEnabled:true,contentEnabled:true,acquisitionContext:{studyId:'study',subjectId:'subject',visitId:'visit'},paused});
 const materials=useAgentMaterials({client,identity:actor,sessionId:'session',getSession:async()=>'session',enabled:true,media,paused,contextStudyId:'study'});
 return <main style={{fontSize:14,lineHeight:'22px',maxWidth:1000,padding:16}}><p id="actor">{actor}</p><button onClick={materials.pick} disabled={paused||materials.uploading||media.uploading}>上传文件</button><AgentMaterialsView materials={materials}/><div id="registered"><RegisteredMediaList key={actor+':'+revision} client={client} identity={actor} studyId="study" subjectId="subject" visitId="visit" enabled={!paused}/></div></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
