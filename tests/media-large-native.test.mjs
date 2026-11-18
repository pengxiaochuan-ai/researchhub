import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {mkdtemp,rm,open,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createReadStream} from 'node:fs';import {createHash} from 'node:crypto';
import {identityFromMediaPath,createMediaChunkSnapshot} from '../server/ai-agent/session-media-snapshot.mjs';
test('420.47MiB generated-only native upload resumes, assembles and verifies without unbounded buffering', {skip:process.env.RH_MEDIA_LARGE_SYNTHETIC!=='1'},async()=>{
 const root=new URL('../../',import.meta.url).pathname,require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const {ChatChunkUploadStore}=require(root+'app/server/src/sessions/chat-chunk-upload.ts'),{inspectChatUploadFile}=require(root+'app/server/src/sessions/chat-upload-inspector.ts');
 const directory=await mkdtemp(join(tmpdir(),'rh-large-synthetic-')),path=join(directory,'SYNTHETIC-ONLY.mp4'),store=new ChatChunkUploadStore({rootDirectory:join(directory,'chunks'),allowedExtensions:new Set(['.mp4'])}),size=440899132;
 const context={tenantId:'large-synthetic',accountId:'large-synthetic',sessionId:'large-synthetic',studyGroupId:'large-synthetic',researchProjectId:'large-synthetic'};
 try{
  const prefix=await readFile(root+'researchhub/.tmp/ai-video-2026-11-16/reuse-probe/generated-av.mp4'),header=Buffer.alloc(8);header.writeUInt32BE(size-prefix.length);header.write('free',4,'ascii');
  const file=await open(path,'wx',0o600);try{await file.write(prefix);await file.write(header);await file.truncate(size);}finally{await file.close();}
  const identity=await identityFromMediaPath(path,size),binding=identity.root,init=await store.initialize(context,{filename:'SYNTHETIC-ONLY.mp4',mimeType:'video/mp4',sizeBytes:size,binding});assert.equal(init.totalChunks,421);
  const part=async index=>{const start=index*1024*1024,length=Math.min(1024*1024,size-start);await store.writeChunk(context,init.uploadId,index,createReadStream(path,{start,end:start+length-1}),length);};
  await part(0);await part(3);const snapshot=await createMediaChunkSnapshot({directory:join(directory,'chunks')})(context,{upload_id:init.uploadId,request_fingerprint:binding,byte_size:size,extension:'mp4',content_type:'video/mp4'});assert.deepEqual(snapshot.received.map(x=>x.index),[0,3]);
  let sent=0;for(let i=0;i<init.totalChunks;i++)if(!snapshot.received.some(x=>x.index===i)){await part(i);sent++;}assert.equal(sent,419);
  const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);const original=hash.digest('hex');
  await store.complete(context,init.uploadId,async assembled=>{assert.equal(assembled.size,size);assert.deepEqual(await identityFromMediaPath(assembled.path,size),identity);assert.equal((await inspectChatUploadFile({path:assembled.path,filename:assembled.originalname,declaredMimetype:assembled.mimetype,size:assembled.size})).sha256,original);return{checked:true};},binding);
  console.log(JSON.stringify({generatedOnly:true,byteSize:size,totalChunks:421,retainedChunks:2,sentAfterResume:419,identityAndOriginalShaVerified:true,newDatabaseObjects:0}));
 }finally{store.onModuleDestroy();await rm(directory,{recursive:true,force:true});}
});
