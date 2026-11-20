import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Readable} from 'node:stream';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';
import {createLocalSessionMediaIngests} from '../../scripts/local-session-media-ingests.mjs';
import {createMediaInspection} from '../../scripts/ai-session-media-inspection.mjs';
import {createSessionMedia} from './session-media.mjs';
import {inspectMediaSchema} from '../../scripts/ai-session-media-schema.mjs';
import {inspectMediaIngestSchema} from '../../scripts/ai-session-media-ingest-schema.mjs';
import {upgradeTongueImageSchema,assertTongueImageSchemaReady} from '../../scripts/ai-session-tongue-image-schema.mjs';
const root=new URL('../../../',import.meta.url).pathname,require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k],{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const target=JSON.parse(readFileSync(new URL('../../docs/testing/evidence/study-data-linkage-2026-11-19/before/target.json',import.meta.url)));
const run=promisify(execFile),rollback=Symbol('tongue-full-rollback');
test('real PostgreSQL tongue upgrade, JPEG/PNG decoding, one receipt, current authority and exact downgrade fully roll back',async t=>{
 await assertFixtureTarget(env);
 const directory=await mkdtemp(join(tmpdir(),'rh-tongue-pg-'));
 try{
  for(const ext of['png','jpg'])await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=640x480','-frames:v','1','-y',join(directory,'synthetic.'+ext)],{timeout:30000});
  await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
   const initial={media:await inspectMediaSchema(tx),ingest:await inspectMediaIngestSchema(tx)},alreadyUp=initial.media.receipt?.imageRevision==='tongue-images.v1';
   const first=await upgradeTongueImageSchema(tx,env);assert.equal(first.changed,!alreadyUp);await assertTongueImageSchemaReady(tx);assert.equal((await upgradeTongueImageSchema(tx,env)).changed,false);
   const rejected=async(name,fn,match)=>{await tx.$executeRawUnsafe('SAVEPOINT tongue_case');try{await assert.rejects(fn,e=>String(e.code??'')+' '+String(e.meta?.message??e.message)===match||String(e.meta?.message??e.message).includes(match),name);}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT tongue_case');await tx.$executeRawUnsafe('RELEASE SAVEPOINT tongue_case');}};
   await rejected('readiness refuses constraint drift even with an otherwise known receipt',async()=>{await tx.$executeRawUnsafe('ALTER TABLE rh_ai.session_media_uploads DROP CONSTRAINT session_media_mime');await assertTongueImageSchemaReady(tx);},initial.media.receipt?.eeglabRevision?'MEDIA_EEGLAB_SCHEMA_NOT_READY':initial.media.receipt?.audioRevision?'MEDIA_AUDIO_SCHEMA_NOT_READY':'MEDIA_TONGUE_SCHEMA_NOT_READY');
   const account=await tx.account.findUnique({where:{id:ids.admin}}),sid='rh-tongue-rollback-'+randomUUID();
   const user={tenantId:ids.tenant,accountId:ids.admin,authVersion:account.authVersion,role:account.role,isTenantAdmin:account.isTenantAdmin,studyGroupId:ids.group,researchProjectId:ids.project};
   await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,ids.project,ids.admin);
   await tx.$executeRawUnsafe(`INSERT INTO public.session(id,"tenantId","studyGroupId","researchProjectId","accountId","agentId",title,channel,"contextKey","updatedAt") VALUES($1,$2,$3,$4,$5,$6,'合成舌图全回滚验证','knowledge',$7,now())`,sid,ids.tenant,ids.group,ids.project,ids.admin,ids.tenant+'-kb-research','hub:lingshu-xinyu:conversation:'+randomUUID());
   const beforeCounts={tasks:await tx.processingTask.count(),features:await tx.feature.count()};
   const Chunk=load('sessions/chat-chunk-upload','ChatChunkUploadStore'),chunks=new Chunk({rootDirectory:join(directory,'chunks'),allowedExtensions:new Set(['.png','.jpg','.jpeg'])}),objects=new Map();let puts=0;
   const storage={statObject:async key=>{const x=objects.get(key);if(!x)throw{code:'NoSuchKey'};return{size:x.bytes.length,metaData:x.meta};},putFile:async(key,path,_type,meta)=>{puts++;objects.set(key,{bytes:await readFile(path),meta});},getStream:async(key,start=0,length)=>{const b=objects.get(key).bytes;return Readable.from([b.subarray(start,length==null?b.length:start+length)]);},downloadToFile:async(key,path)=>writeFile(path,objects.get(key).bytes)};
   const media=createSessionMedia({access:createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>fn(tx)}),chunks,storage,inspectSignature:load('sessions/chat-upload-inspector','inspectChatUploadFile'),inspectMedia:createMediaInspection({parse:load('ingest/media-inspection','parseFfprobeOutput'),classify:load('ingest/media-inspection','classifyFfprobeFailure')}),parseRange:load('sessions/sessions.service','parseAttachmentByteRange')});
   const ingests=(await createLocalSessionMediaIngests({env,ids,load,require,storage,transaction:fn=>fn(tx)})).service;
   for(const ext of['png','jpg'])await t.test('actual '+ext+' upload, registration, readback, retry and raw bytes',async()=>{
    const bytes=await readFile(join(directory,'synthetic.'+ext)),key='tongue-'+randomUUID();
    const start=await media.initialize(user,sid,{requestKey:key,filename:'synthetic.'+ext,mimeType:ext==='png'?'image/png':'image/jpeg',size:bytes.length});
    await media.chunk(user,sid,start.uploadId,0,Readable.from([bytes]),bytes.length);
    const saved=await media.complete(user,sid,start.uploadId);assert.equal(saved.modality,'tongue');assert.equal(saved.inspectionState,'complete');assert.deepEqual(saved.inspection,{hasVideo:false,hasAudio:false,hasImage:true,width:640,height:480});
    const putsBefore=puts;assert.equal((await media.complete(user,sid,start.uploadId)).id,saved.id);assert.equal(puts,putsBefore);
    const plans=await ingests.targets(user,sid,saved.id,{studyId:target.studyId});assert(plans.items.some(x=>x.id===target.studyId));
    const planned=await ingests.prepare(user,sid,saved.id,{requestKey:'register-'+randomUUID(),studyId:target.studyId,subjectId:target.subjectId,subjectVisitId:target.visitId,collectedAt:null});assert.equal(planned.source.modality,'tongue');
    const body={expectedVersion:planned.version,confirmationHash:planned.confirmationHash},registered=await ingests.confirm(user,sid,saved.id,planned.id,body);
    assert.equal(registered.state,'committed');assert.equal(registered.source.modality,'tongue');assert.equal(registered.visit.id,target.visitId);
    assert.deepEqual(await ingests.confirm(user,sid,saved.id,planned.id,body),registered);
    const file=await tx.modalityFile.findUnique({where:{id:registered.receipt.modalityFileId}});assert.equal(file.modality,'tongue');assert.equal(file.kind,'raw');assert.equal(file.status,'needs_review');assert.equal(file.subjectVisitId,target.visitId);assert.equal(file.meta.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(file.meta.hubMediaIngest.featuresGenerated,false);
    const read=await ingests.content(user,target.studyId,target.subjectId,registered.id),chunks=[];for await(const b of read.stream)chunks.push(b);assert.deepEqual(Buffer.concat(chunks),bytes);assert.equal(read.headers['Content-Type'],ext==='png'?'image/png':'image/jpeg');assert.equal(read.headers['Cache-Control'],'private, no-store');assert.equal(read.headers['X-Content-Type-Options'],'nosniff');
    const list=await ingests.subjectList(user,target.studyId,target.subjectId,{visitId:target.visitId,fileId:file.id});assert.equal(list.items.length,1);assert.equal(list.items[0].receipt.modalityFileId,file.id);
    await assert.rejects(ingests.content({...user,accountId:ids.owner},target.studyId,target.subjectId,registered.id),e=>[403,404].includes(e.status??e.getStatus?.()));
    await assert.rejects(ingests.content({...user,authVersion:user.authVersion+1},target.studyId,target.subjectId,registered.id),e=>[401,403,404].includes(e.status??e.getStatus?.()));
    await assert.rejects(ingests.subjectGet(user,target.studyId,'foreign-subject',registered.id),e=>e.status===404);
    await rejected('same original cannot be registered twice',async()=>{
     const next=await ingests.prepare(user,sid,saved.id,{requestKey:'duplicate-'+randomUUID(),studyId:target.studyId,subjectId:target.subjectId,subjectVisitId:target.visitId});return next;
    },'MEDIA_INGEST_ALREADY_REGISTERED');
    const clone=async({snapshotPatch}={})=>{await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',study_group_id,true),set_config('app.research_project_id',research_project_id,true),set_config('app.account_id',account_id,true) FROM rh_ai.session_media_ingests WHERE id=$1`,registered.id);const nextId='rh-tongue-guard-'+randomUUID();await tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_ingests(id,tenant_id,account_id,session_id,source_study_group_id,source_research_project_id,media_id,source_version,source_sha256,study_id,study_group_id,research_project_id,scope_key,subject_id,enrollment_id,visit_id,protocol_id,collected_at,request_key,confirmation_hash,snapshot,permission_ref,audit_id) SELECT $1,tenant_id,account_id,session_id,source_study_group_id,source_research_project_id,media_id,(SELECT version FROM rh_ai.session_media_uploads WHERE id=media_id),source_sha256,study_id,study_group_id,research_project_id,scope_key,subject_id,enrollment_id,visit_id,protocol_id,collected_at,$2,confirmation_hash,CASE WHEN $3::jsonb IS NULL THEN snapshot ELSE jsonb_set(snapshot,'{source}',(snapshot->'source')||$3::jsonb) END,permission_ref,$4 FROM rh_ai.session_media_ingests WHERE id=$5`,nextId,'guard-key-'+randomUUID(),snapshotPatch?JSON.stringify(snapshotPatch):null,nextId+'-audit',registered.id);return nextId;};
    for(const patch of[{hasImage:false},{hasVideo:true},{width:0},{width:1.5},{height:null},{width:20001},{width:10000,height:10000}])await rejected('DB image evidence refuses '+JSON.stringify(patch),async()=>{await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)`,ids.group,ids.project,ids.admin);await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_uploads SET inspection=inspection||$1::jsonb,version=version+1 WHERE id=$2`,JSON.stringify(patch),saved.id);await clone();},'MEDIA_INGEST_PARENT');
    await rejected('DB source snapshot cannot pretend image is video',()=>clone({snapshotPatch:{modality:'video'}}),'MEDIA_INGEST_SOURCE_CHANGED');
    await rejected('DB source snapshot dimensions must match frozen source',()=>clone({snapshotPatch:{inspection:{...registered.source.inspection,width:321}}}),'MEDIA_INGEST_SOURCE_CHANGED');
    await rejected('DB image receipt cannot bind a video modality file',async()=>{
     const nextId=await clone(),wrong=await tx.modalityFile.create({data:{tenantId:user.tenantId,subjectId:target.subjectId,subjectVisitId:target.visitId,modality:'video',kind:'raw',storageKey:file.storageKey,filename:file.filename,status:'needs_review',createdBy:user.accountId,meta:{sha256:file.meta.sha256,hubMediaIngest:{id:nextId}}}});
     await tx.$executeRawUnsafe(`UPDATE rh_ai.session_media_ingests SET state='committed',modality_file_id=$1,receipt=$2::jsonb,version=version+1,audit_id=$3 WHERE id=$4`,wrong.id,JSON.stringify({...registered.receipt,modalityFileId:wrong.id}),nextId+'-committed-audit',nextId);
    },'MEDIA_INGEST_RECEIPT');
    await rejected('DB image size ceiling also applies to direct application writes',async()=>{
     const mid='rh-tongue-too-large-'+randomUUID();await tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true)`,ids.group,ids.project);
     await tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_media_uploads(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,request_fingerprint,extension,content_type,safe_filename,byte_size,storage_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'png','image/png',$9,26214401,$10)`,mid,ids.tenant,ids.group,ids.project,ids.admin,sid,'size-'+randomUUID(),'a'.repeat(64),mid+'.png',`${ids.tenant}/hub-media/${sid}/${mid}.png`);
    },'session_media_uploads_extension_check');
   });
   await rejected('downgrade cannot discard existing image rows or a newer audio revision',()=>upgradeTongueImageSchema(tx,env,{direction:'down'}),initial.media.receipt?.audioRevision?'MEDIA_TONGUE_AUDIO_DOWNGRADE_REQUIRED':'MEDIA_TONGUE_DOWN_REQUIRES_EMPTY_IMAGES');
   assert.equal(await tx.processingTask.count(),beforeCounts.tasks);assert.equal(await tx.feature.count(),beforeCounts.features);
   throw rollback;
  }),e=>e===rollback);
  // Separate empty-image upgrade/down proof, with exact known original catalog.
  await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{const before={media:await inspectMediaSchema(tx),ingest:await inspectMediaIngestSchema(tx)};if(before.media.receipt?.imageRevision==='tongue-images.v1'){await assertTongueImageSchemaReady(tx);throw rollback;}await upgradeTongueImageSchema(tx,env);await upgradeTongueImageSchema(tx,env,{direction:'down'});assert.equal((await inspectMediaSchema(tx)).catalogHash,before.media.catalogHash);assert.equal((await inspectMediaIngestSchema(tx)).catalogHash,before.ingest.catalogHash);throw rollback;}),e=>e===rollback);
 }finally{await rm(directory,{recursive:true,force:true});}
});
