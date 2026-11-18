import test from 'node:test';
import assert from 'node:assert/strict';
import {validFileFeaturePage,validFileTaskPage} from '../src/capture-file-session.js';
import {createCaptureClient,validCaptureMarker} from '../src/formal-capture-session.js';

const route={studyId:'study',visitId:'visit'},file={id:'file',sourceRef:{kind:'modality_file',id:'file',sha256:'a'.repeat(64)},taskCount:22},task={id:'task',status:'complete',skillKey:'preprocessed-feature-import',sourceRef:{kind:'processing_task',id:'task',fileId:'file',updatedAt:'2026-11-12T00:00:00.000Z',hashVersion:'t14-source-v1',contentHash:'b'.repeat(64)},quality:{status:'reported',alerts:0,missing:0},featureCount:501,features:[],featuresNextCursor:'next'};
const feature={id:'feature',featureKey:'synthetic.metric',sourceRef:{kind:'feature',id:'feature',fileId:'file',taskId:'task',hashVersion:'t14-source-v1',contentHash:'c'.repeat(64)}};

test('independent source-page negatives reject changed study visit file task and parent hashes',()=>{
 const fp={...route,fileId:file.id,taskId:task.id,fileSourceRef:file.sourceRef,taskSourceRef:task.sourceRef,total:501,items:[feature],nextCursor:'following'};
 assert(validFileFeaturePage(fp,route,file,task));
 for(const changed of [{studyId:'other'},{visitId:'other'},{fileId:'other'},{taskId:'other'},{fileSourceRef:{...file.sourceRef,sha256:'d'.repeat(64)}},{taskSourceRef:{...task.sourceRef,contentHash:'d'.repeat(64)}},{taskSourceRef:{...task.sourceRef,updatedAt:'2026-11-12T01:00:00.000Z'}},{total:500}])assert.equal(validFileFeaturePage({...fp,...changed},route,file,task),false);
 const embedded={...task,features:[feature]},tp={...route,fileId:file.id,fileSourceRef:file.sourceRef,total:22,items:[embedded],nextCursor:'next-task'};
 assert(validFileTaskPage(tp,route,file));assert(!validFileTaskPage({...tp,fileSourceRef:null},route,file));
 assert(!validFileFeaturePage({...fp,items:[{...feature,sourceRef:{...feature.sourceRef,taskId:'other'}}]},route,file,task));
});

test('independent privacy contract: current withdrawal invalidates in-flight reads, ordinary 503 does not',async()=>{
 let release,mode='pending',lost=0;
 const client=createCaptureClient({fetchImpl:async()=>mode==='pending'?await new Promise(resolve=>{release=resolve;}):new Response(JSON.stringify(mode==='withdraw'?{code:'PARTICIPATION_CAPTURE_BLOCKED',message:'用途已撤回'}:{code:'FILE_SERVICE_UNAVAILABLE',message:'暂不可用'}),{status:mode==='withdraw'?409:503,headers:{'Content-Type':'application/json'}}),onAccessLost:()=>{lost++;client.invalidate();}});
 const pending=client.request('/old-file-source');mode='withdraw';await assert.rejects(client.request('/files'),e=>e.status===409);assert.equal(lost,1);
 release(new Response(JSON.stringify({items:[{id:'old-sensitive-source'}]}),{status:200,headers:{'Content-Type':'application/json'}}));await assert.rejects(pending,e=>e.stale===true);
 mode='503';await assert.rejects(client.request('/files'),e=>e.status===503);assert.equal(lost,1);
});

test('independent file recovery contract distinguishes known unavailable from unknown write and forbids body storage',async()=>{
 const scope={actor:'actor',authVersion:1,studyId:'study'},marker={...scope,visitId:'visit',assignmentId:null,queryId:null,domain:'file',action:'upload',requestKey:'original'};
 assert(validCaptureMarker(marker,scope));for(const key of ['filename','contentBase64','body','sourceSha256'])assert(!validCaptureMarker({...marker,[key]:'private-file-body'},scope));
 const unavailable=createCaptureClient({fetchImpl:async()=>new Response(JSON.stringify({code:'FILE_SERVICE_UNAVAILABLE'}),{status:503})});await assert.rejects(unavailable.request('/file',{method:'POST',body:{requestKey:'original'}}),e=>e.unknown===false);
 const cut=createCaptureClient({fetchImpl:async()=>{throw Error('response cut');}});await assert.rejects(cut.request('/file',{method:'POST',body:{requestKey:'original'}}),e=>e.unknown===true);
});
