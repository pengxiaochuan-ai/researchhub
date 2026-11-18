import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeMediaInput} from '../server/ai-agent/session-media.mjs';
import {uploadMediaFile,sessionMediaRequestAllowed,readPendingMedia} from '../src/session-media-session.js';
const uuid='12345678-1234-4234-a234-123456789012',size=3*1024*1024+7;
const file=new Blob([new Uint8Array(size)]);file.name='synthetic.mp4';
const item={id:'media-test',version:2,name:'media-test.mp4',extension:'mp4',byteSize:size,archiveState:'pending',inspectionState:'pending',classification:null,inspection:{},contentUnderstood:false,createdAt:new Date().toISOString()};
const sha=b=>createHash('sha256').update(b).digest('hex');
test('resumable metadata is strict, compatible and has an explicit content identity',()=>{
 const body={requestKey:'test',filename:'synthetic.mp4',mimeType:'video/mp4',size,fileIdentity:{schema:'hub-media-content.v1',root:'a'.repeat(64)}};
 assert.deepEqual(normalizeMediaInput(body).fileIdentity,body.fileIdentity);
 for(const fileIdentity of [{schema:'other',root:'a'.repeat(64)},{schema:'hub-media-content.v1',root:'short'},{...body.fileIdentity,path:'bad'},null])assert.throws(()=>normalizeMediaInput({...body,fileIdentity}));
 assert(sessionMediaRequestAllowed('GET',`/sessions/s/media-uploads/${uuid}`));
 assert(!sessionMediaRequestAllowed('GET',`/sessions/s/media-uploads/${uuid}?path=bad`));
 const pending={requestKey:'test',uploadId:uuid,phase:'transferring',byteSize:size,extension:'mp4',fileIdentity:body.fileIdentity};
 assert.deepEqual(readPendingMedia(JSON.stringify([pending])),[pending]);
});
test('resume skips only actual matching server chunks and reports verified bytes first',async()=>{
 let metadata,completed=0;const sent=[],progress=[];
 const chunks=[sha(Buffer.alloc(1024*1024)),sha(Buffer.alloc(1024*1024)),sha(Buffer.alloc(1024*1024)),sha(Buffer.alloc(7))];
 const client={post:async(p,b)=>{if(p.endsWith('/complete')){completed++;return{...item,archiveState:'archived'};}metadata=b;return{item,uploadId:uuid,chunkSize:1024*1024,totalChunks:4,identityMode:'hub-media-content.v1'};},
 get:async()=>({uploadId:uuid,chunkSize:1024*1024,totalChunks:4,byteSize:size,received:[{index:0,byteSize:1024*1024,sha256:chunks[0]},{index:2,byteSize:1024*1024,sha256:'f'.repeat(64)}]}),
 upload:async(p)=>{sent.push(Number(p.split('/').at(-1)));}};
 await uploadMediaFile({client,sid:'s',file,requestKey:'test',resumable:true,onProgress:p=>progress.push(p.loaded)});
 assert.equal(metadata.fileIdentity.schema,'hub-media-content.v1');assert.equal(metadata.fileIdentity.root,sha(JSON.stringify(['hub-media-content.v1',size,1024*1024,chunks])));
 assert.deepEqual(sent.sort(),[1,2,3]);assert.equal(progress[0],1024*1024);assert.equal(progress.at(-1),size);assert.equal(completed,1);
});
test('wrong original file and malformed snapshots never transmit or complete',async()=>{
 let posts=0,uploads=0;const client={post:async()=>{posts++;return{item,uploadId:uuid,chunkSize:1024*1024,totalChunks:4,identityMode:'hub-media-content.v1'};},get:async()=>({uploadId:uuid,chunkSize:1024*1024,totalChunks:4,byteSize:size,received:[{index:9,byteSize:1,sha256:'a'.repeat(64)}]}),upload:async()=>uploads++};
 await assert.rejects(uploadMediaFile({client,sid:'s',file,requestKey:'test',resumable:true,fileIdentity:{schema:'hub-media-content.v1',root:'f'.repeat(64)}}),/原视频/);assert.equal(posts,0);
 await assert.rejects(uploadMediaFile({client,sid:'s',file,requestKey:'test',resumable:true}),/状态/);assert.equal(uploads,0);assert.equal(posts,1);
});
test('identity revoked during the final asynchronous digest never reaches persistence or initialization',async()=>{
 const original=crypto.subtle.digest.bind(crypto.subtle);let count=0,allow=true,release,started,onIdentity=0,posts=0;
 const ready=new Promise(resolve=>{started=resolve;});
 crypto.subtle.digest=async(...args)=>{const value=await original(...args);if(++count===5){started();await new Promise(resolve=>{release=resolve;});}return value;};
 try{
  const pending=uploadMediaFile({client:{post:async()=>posts++},sid:'s',file,requestKey:'test',resumable:true,beforeRequest:async()=>allow,onIdentity:()=>onIdentity++});
  await ready;allow=false;release();await assert.rejects(pending,/变化/);assert.equal(posts,0);assert.equal(onIdentity,0);
 }finally{delete crypto.subtle.digest;}
});
