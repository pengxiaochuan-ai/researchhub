import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';import {Readable} from 'node:stream';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';
import {createSessionMedia,assertMediaQuestionReadableInTx} from './session-media.mjs';import {createMediaInspection} from '../../scripts/ai-session-media-inspection.mjs';
import {createMediaChunkSnapshot} from './session-media-snapshot.mjs';
import {identifyMediaFile} from '../../src/media-content-identity.js';
import {createConversationCommands} from './conversation-commands.mjs';
const root=new URL('../../../',import.meta.url).pathname,require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k],{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const rollback=Symbol('media-only-test-rollback');
test('real app PG, native chunks/signatures/ffprobe and Range remain isolated and recover unknown outcomes',async t=>{
 const bytes=await readFile(new URL('../../.tmp/ai-video-2026-11-16/reuse-probe/generated-av.mp4',import.meta.url));
 const directory=await mkdtemp(join(tmpdir(),'rh-media-pg-'));
 const Chunk=load('sessions/chat-chunk-upload','ChatChunkUploadStore');
 const chunks=new Chunk({rootDirectory:directory,allowedExtensions:new Set(['.mp4','.mov','.webm'])});
 try{await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true)`,ids.tenant);
  const actor=await tx.account.findUnique({where:{id:ids.owner}}),sid='rh-media-rollback-'+randomUUID();
  const user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner,authVersion:actor.authVersion};
  await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)`,ids.group,ids.project,ids.owner);
  await tx.$executeRawUnsafe(`INSERT INTO public.session(id,"tenantId","studyGroupId","researchProjectId","accountId","agentId",title,channel,"contextKey","updatedAt") VALUES($1,$2,$3,$4,$5,$6,'合成视频回滚验证','knowledge',$7,now())`,sid,ids.tenant,ids.group,ids.project,ids.owner,ids.tenant+'-kb-research','hub:lingshu-xinyu:conversation:'+randomUUID());
  const rawAccess=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>fn(tx)}),objects=new Map();let puts=0,afterPut,afterStream,lastStream,afterTransaction,cancels=0;
  const access={transaction:async(...args)=>{const value=await rawAccess.transaction(...args);await afterTransaction?.(value);return value;}};
  const cancel=chunks.cancel.bind(chunks);chunks.cancel=async(...args)=>{cancels++;return cancel(...args);};
  const storage={
   async statObject(key){const value=objects.get(key);if(!value)throw{code:'NoSuchKey'};return{size:value.bytes.length,metaData:value.meta};},
   async putFile(key,path,type,meta){puts++;objects.set(key,{bytes:await readFile(path),meta:{...meta,'content-type':type}});await afterPut?.();},
   async getStream(key,start=0,length){const b=objects.get(key).bytes;lastStream=Readable.from([b.subarray(start,length==null?b.length:start+length)]);await afterStream?.();return lastStream;},
   async downloadToFile(key,path){await writeFile(path,objects.get(key).bytes);},
  };
  const native=load('ingest/media-inspection','parseFfprobeOutput'),classify=load('ingest/media-inspection','classifyFfprobeFailure');
  const inspect=createMediaInspection({parse:native,classify});
  let afterSnapshot;const readChunks=createMediaChunkSnapshot({directory});
  const service=createSessionMedia({access,chunks,storage,readChunks:async(...args)=>{const value=await readChunks(...args);await afterSnapshot?.();return value;},inspectSignature:load('sessions/chat-upload-inspector','inspectChatUploadFile'),inspectMedia:inspect,parseRange:load('sessions/sessions.service','parseAttachmentByteRange')});
  const initialize=(key,b=bytes)=>service.initialize(user,sid,{requestKey:key,filename:'generated.mp4',mimeType:'video/mp4',size:b.length});
  const context={...user,sessionId:sid};delete context.authVersion;
  const first=await initialize('media-main-'+randomUUID());
  await service.chunk(user,sid,first.uploadId,0,Readable.from([bytes]),bytes.length);
  const complete=await service.complete(user,sid,first.uploadId);
  assert.equal(complete.archiveState,'archived');assert.equal(complete.inspectionState,'complete');assert.equal(complete.classification,'valid');assert.equal(complete.inspection.hasAudio,true);assert.equal(puts,1);
  assert.equal((await service.complete(user,sid,first.uploadId)).id,complete.id);assert.equal(puts,1);
  assert.equal((await service.receipt(user,sid,(await tx.$queryRawUnsafe('SELECT request_key FROM rh_ai.session_media_uploads WHERE id=$1',complete.id))[0].request_key)).item.id,complete.id);
  const content=await service.content(user,sid,complete.id,'bytes=0-31');assert.equal(content.status,206);assert.equal(content.headers['Content-Length'],'32');
  const delivered=[];for await(const b of content.stream)delivered.push(b);assert.deepEqual(Buffer.concat(delivered),bytes.subarray(0,32));
  await t.test('admin cannot read private owner media',async()=>{await assert.rejects(service.list({...user,accountId:ids.admin},sid),e=>e.code==='HUB_MATERIAL_ACCESS_REJECTED');});
  await t.test('media question admission sets the real app account GUC and stops before jobs or scheduling',async()=>{
   await tx.$queryRawUnsafe(`SELECT set_config('app.account_id','',true)`);
   await assert.rejects(assertMediaQuestionReadableInTx(tx,user,sid,'视频里有几个人？'),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE');
   let schedules=0;
   const commands=createConversationCommands({tenantId:ids.tenant,transaction:fn=>fn(tx),authorize:async()=>user,
    admit:(db,u,s,q)=>assertMediaQuestionReadableInTx(db,u,s,q?.text),stage:async(db,u,j)=>{await assertMediaQuestionReadableInTx(db,u,j.sessionId,j.text);return j.payload;},schedule:()=>{schedules++;}});
   await assert.rejects(commands.submit(user,sid,{text:'视频中的人情绪如何？',requestKey:'media-gate-'+randomUUID(),kbIds:[]}),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE');
   const initial=await commands.submit(user,sid,{text:'仅检索Hub已审核论文',requestKey:'media-edit-'+randomUUID(),kbIds:[]});
   await commands.edit(user,sid,initial.id,{text:'视频里有几个人？',version:initial.version});await commands.tick(user,sid);
   assert.equal(schedules,0);assert.equal(await tx.knowledgeChatJob.count({where:{sessionId:sid}}),0);
   assert((await commands.list(user,sid)).items.some(x=>x.status==='paused'));
  });
  await t.test('stream opened before a version change is destroyed before delivery',async()=>{
   afterStream=async()=>{await tx.$executeRawUnsafe('UPDATE rh_ai.session_media_uploads SET version=version+1 WHERE id=$1',complete.id);};
   await assert.rejects(service.content(user,sid,complete.id),e=>e.code==='MEDIA_SOURCE_CHANGED');assert.equal(lastStream.destroyed,true);afterStream=null;
  });
  await t.test('PUT response unknown cannot allow same-size different source to overwrite the original',async()=>{
   const value=await initialize('media-unknown-'+randomUUID());
   await service.chunk(user,sid,value.uploadId,0,Readable.from([bytes]),bytes.length);
   afterPut=async()=>{throw Error('simulated unknown PUT response');};
   await assert.rejects(service.complete(user,sid,value.uploadId),/unknown PUT/);afterPut=null;
   const changed=Buffer.from(bytes);changed[changed.length-1]^=1;
   await service.chunk(user,sid,value.uploadId,0,Readable.from([changed]),changed.length);
   const before=puts;await assert.rejects(service.complete(user,sid,value.uploadId),e=>e.code==='MEDIA_SOURCE_CHANGED');assert.equal(puts,before);
   await service.chunk(user,sid,value.uploadId,0,Readable.from([bytes]),bytes.length);
   assert.equal((await service.complete(user,sid,value.uploadId)).archiveState,'archived');assert.equal(puts,before);
  });
  await t.test('bad container is archived but never marked successfully parsed',async()=>{
   const b=bytes.subarray(0,40),value=await initialize('media-corrupt-'+randomUUID(),b);
   await service.chunk(user,sid,value.uploadId,0,Readable.from([b]),b.length);
   const result=await service.complete(user,sid,value.uploadId);assert.equal(result.archiveState,'archived');assert.equal(result.inspectionState,'unavailable');assert.equal(result.classification,'corrupt');
  });
  await t.test('first SHA binding result unknown forbids every PUT until the original receipt is recovered',async()=>{
   const key='media-freeze-unknown-'+randomUUID(),value=await initialize(key);
   await service.chunk(user,sid,value.uploadId,0,Readable.from([bytes]),bytes.length);
   afterTransaction=async row=>{if(row?.request_key===key&&row.source_sha256&&row.archive_state==='pending')throw Error('unknown freeze commit');};
   const before=puts;await assert.rejects(service.complete(user,sid,value.uploadId),/unknown freeze commit/);assert.equal(puts,before);afterTransaction=null;
   assert.equal((await service.receipt(user,sid,key)).item.archiveState,'pending');
   assert.equal((await service.complete(user,sid,value.uploadId)).archiveState,'archived');assert.equal(puts,before+1);
  });
  await t.test('initialization binding committed but response lost never cancels the bound manifest',async()=>{
   const key='media-init-unknown-'+randomUUID(),beforeCancels=cancels;
   afterTransaction=async row=>{if(row?.request_key===key&&row.upload_id)throw Error('unknown init commit');};
   await assert.rejects(initialize(key),/unknown init commit/);afterTransaction=null;
   assert.equal(cancels,beforeCancels);const value=await initialize(key);
   await service.chunk(user,sid,value.uploadId,0,Readable.from([bytes]),bytes.length);
   assert.equal((await service.complete(user,sid,value.uploadId)).archiveState,'archived');assert.equal(cancels,beforeCancels);
  });
  await t.test('stored original survives a lost completion manifest and can finalize by the same upload ID',async()=>{
   const value=await initialize('media-expired-receipt-'+randomUUID());await service.chunk(user,sid,value.uploadId,0,Readable.from([bytes]),bytes.length);
   afterPut=async()=>{throw Error('unknown PUT before manifest expiry');};await assert.rejects(service.complete(user,sid,value.uploadId),/unknown PUT/);afterPut=null;
   await chunks.cancel(context,value.uploadId);const before=puts;
   const result=await service.complete(user,sid,value.uploadId);assert.equal(result.archiveState,'archived');assert.equal(result.classification,'valid');assert.equal(puts,before);
  });
  await t.test('resumable native chunks bind content, reject same-size substitution and repair only mismatched parts',async()=>{
   const large=Buffer.concat([bytes,Buffer.alloc(2*1024*1024)]),fileIdentity=(await identifyMediaFile(new Blob([large]))).fileIdentity,key='media-resume-'+randomUUID();
   const body={requestKey:key,filename:'synthetic.mp4',mimeType:'video/mp4',size:large.length,fileIdentity};
   const value=await service.initialize(user,sid,body);assert.equal(value.identityMode,'hub-media-content.v1');
   const send=index=>{const b=large.subarray(index*1024*1024,Math.min(large.length,(index+1)*1024*1024));return service.chunk(user,sid,value.uploadId,index,Readable.from([b]),b.length);};
   await send(0);await send(2);
   const snapshot=await service.snapshot(user,sid,value.uploadId);assert.deepEqual(snapshot.received.map(x=>x.index),[0,2]);
   assert.equal((await service.initialize(user,sid,body)).uploadId,value.uploadId);
   await assert.rejects(service.initialize(user,sid,{...body,fileIdentity:{schema:'hub-media-content.v1',root:'f'.repeat(64)}}),e=>e.code==='MEDIA_REQUEST_CONFLICT');
   await assert.rejects(service.snapshot({...user,accountId:ids.admin},sid,value.uploadId),e=>e.code==='HUB_MATERIAL_ACCESS_REJECTED');
   const wrong=Buffer.alloc(1024*1024,42);await service.chunk(user,sid,value.uploadId,1,Readable.from([wrong]),wrong.length);
   const before=puts;await assert.rejects(service.complete(user,sid,value.uploadId),e=>e.code==='MEDIA_FILE_IDENTITY_CHANGED');assert.equal(puts,before);
   const [row]=await tx.$queryRawUnsafe('SELECT source_sha256,archive_state FROM rh_ai.session_media_uploads WHERE id=$1',value.item.id);assert.equal(row.source_sha256,null);assert.equal(row.archive_state,'pending');
   await send(1);const complete=await service.complete(user,sid,value.uploadId);assert.equal(complete.archiveState,'archived');assert.equal(puts,before+1);
  });
  await t.test('snapshot revalidates the row after filesystem reads and legacy archive remains unchanged',async()=>{
   const key='media-snapshot-race-'+randomUUID(),fileIdentity=(await identifyMediaFile(new Blob([bytes]))).fileIdentity;
   const value=await service.initialize(user,sid,{requestKey:key,filename:'synthetic.mp4',mimeType:'video/mp4',size:bytes.length,fileIdentity});
   await service.chunk(user,sid,value.uploadId,0,Readable.from([bytes]),bytes.length);
   afterSnapshot=()=>tx.$executeRawUnsafe('UPDATE rh_ai.session_media_uploads SET version=version+1 WHERE id=$1',value.item.id);
   await assert.rejects(service.snapshot(user,sid,value.uploadId),e=>e.code==='MEDIA_VERSION');afterSnapshot=null;
   assert.equal((await service.snapshot(user,sid,value.uploadId)).received.length,1);
   assert.equal((await service.receipt(user,sid,key)).identityMode,'hub-media-content.v1');
   assert.equal((await service.complete(user,sid,value.uploadId)).archiveState,'archived');
   assert.equal((await service.complete(user,sid,first.uploadId)).id,first.item.id);
  });
  assert.equal((await service.list(user,sid,{limit:'1'})).items.length,1);
  const page=await service.list(user,sid,{limit:'1'});assert(page.nextCursor);assert.notEqual((await service.list(user,sid,{limit:'1',cursor:page.nextCursor})).items[0].id,page.items[0].id);
  throw rollback;
 }),e=>e===rollback);}finally{chunks.onModuleDestroy();await rm(directory,{recursive:true,force:true});}
});
