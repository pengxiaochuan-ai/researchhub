import {randomUUID} from 'node:crypto';
import {materialDigest} from './session-material-contract.mjs';
import {validMediaIdentity,MEDIA_IDENTITY_SCHEMA} from '../../src/media-content-identity.js';
import {identityFromMediaPath} from './session-media-snapshot.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export const MEDIA_MAX_BYTES=500*1024*1024,MEDIA_CHUNK_BYTES=1024*1024;
export const mediaError=(code,status=409)=>Object.assign(Error(code),{code,status});
const fail=(code,status)=>{throw mediaError(code,status);};
const scope=(u,sid)=>[u.tenantId,u.studyGroupId,u.researchProjectId,u.accountId,sid];
const where='tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5';
const types={mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
export async function assertMediaQuestionReadableInTx(tx,u,sid,text=''){
 const action=/(?:分析|解读|总结|概括|转写|识别|描述|提取|看一下|说了|讲了|summari[sz]|analy[sz]|transcrib|describe)/i.test(text);
 const explicitVideo=/(?:视频|录像|录屏|画面|\bvideo\b|\bclip\b)/i.test(text);
 if(!action&&!explicitVideo)return;
 const currentVideo=/(?:这(?:段|个|些)?(?:视频|录像|录屏)|(?:视频|录像|录屏)(?:里|中|内|的内容|内容|讲|说)|上传.{0,8}(?:视频|录像|录屏)|(?:this|uploaded|attached).{0,8}(?:video|clip))/i.test(text);
 if(!currentVideo&&/(?:\b(?:pdf|docx|csv|xlsx|pubmed|hub)\b|文献|论文|表格|研究方向|研究方案)/i.test(text))return;
 await tx.$queryRawUnsafe(`SELECT set_config('app.account_id',$1,true)`,u.accountId);
 const [state]=await tx.$queryRawUnsafe(`SELECT EXISTS(SELECT 1 FROM rh_ai.session_media_uploads WHERE ${where}) AS media,EXISTS(SELECT 1 FROM rh_ai.session_materials WHERE ${where} AND deleted_at IS NULL) OR EXISTS(SELECT 1 FROM rh_ai.research_data_uploads WHERE ${where}) AS other`,...scope(u,sid));
 if(state?.media&&(explicitVideo||!state.other||/(?:附件|上传|全部材料|所有文件|这些文件|这个文件|attached|this file)/i.test(text)))throw Object.assign(mediaError('MEDIA_CONTENT_UNAVAILABLE'),{publicMessage:'视频已归档，可先播放核对；当前没有可供AI解读的画面或转写内容。'});
}
export function normalizeMediaInput(body){
 if(!body||!['filename,mimeType,requestKey,size','fileIdentity,filename,mimeType,requestKey,size'].includes(Object.keys(body).sort().join(','))||Object.hasOwn(body,'fileIdentity')&&!validMediaIdentity(body.fileIdentity)||!id(body.requestKey)||typeof body.filename!=='string'||body.filename.length>255||/[\x00-\x1f/\\]/.test(body.filename)||!Number.isSafeInteger(body.size)||body.size<1||body.size>MEDIA_MAX_BYTES)fail('MEDIA_INPUT',400);
 const extension=/\.([a-z0-9]+)$/i.exec(body.filename)?.[1].toLowerCase(),contentType=types[extension];
 if(!contentType||!['',contentType,...(extension==='mp4'?['application/mp4']:[])].includes(body.mimeType))fail('MEDIA_INPUT',400);
 return{requestKey:body.requestKey,extension,contentType,byteSize:body.size,...(body.fileIdentity?{fileIdentity:body.fileIdentity}:{})};
}
const rowInput=row=>({requestKey:row.request_key,extension:row.extension,contentType:row.content_type,byteSize:Number(row.byte_size)});
const identityMode=row=>materialDigest(rowInput(row))===row.request_fingerprint?'legacy':MEDIA_IDENTITY_SCHEMA;
export function projectMedia(row){
 const inspection=row.inspection??{};
 return{id:row.id,version:row.version,name:row.safe_filename,extension:row.extension,byteSize:Number(row.byte_size),
  archiveState:row.archive_state,inspectionState:row.inspection_state,classification:row.inspection_classification,
  inspection:{...(Number.isFinite(inspection.durationSeconds)?{durationSeconds:inspection.durationSeconds}:{}),hasVideo:inspection.hasVideo===true,hasAudio:inspection.hasAudio===true},
  canRecheck:row.archive_state==='archived'&&(row.inspection_state==='pending'||row.inspection_state==='unavailable'||row.inspection_state==='running'&&new Date(row.lease_expires_at)<=new Date()),
  contentUnderstood:false,createdAt:row.created_at.toISOString()};
}
const metadata=stat=>Object.fromEntries(Object.entries(stat.metaData??{}).map(([k,v])=>[k.toLowerCase().replace(/^x-amz-meta-/,''),v]));
function assertObject(row,stat){
 const m=metadata(stat);
 if(Number(stat.size)!==Number(row.byte_size)||m['aisci-sha256']!==row.source_sha256||m['aisci-media-id']!==row.id||m['aisci-account-id']!==row.account_id||m['aisci-session-id']!==row.session_id)fail('MEDIA_SOURCE_CHANGED');
}
export {assertObject as assertMediaObject};
const missing=e=>['NoSuchKey','NotFound','NoSuchObject'].includes(e?.code)||e?.statusCode===404;
export function createSessionMedia({access,chunks,storage,inspectSignature,inspectMedia,parseRange,readChunks}){
 async function own(tx,u,sid,value,field='id',lock=false){
  if(field==='upload_id'?!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value):!id(value))fail('MEDIA_INPUT',400);
  const suffix={id:'id=$6',request_key:'request_key=$6',upload_id:'upload_id=$6::uuid'}[field];if(!suffix)fail('MEDIA_INPUT',400);
  const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE ${where} AND ${suffix}${lock?' FOR UPDATE':''}`,...scope(u,sid),value);
  if(!row)fail('MEDIA_NOT_FOUND',404);return row;
 }
 const read=(u,sid,value,field)=>access.transaction(u,sid,(tx,current)=>own(tx,current,sid,value,field));
 const context=(u,sid)=>({tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId,sessionId:sid});
 async function audit(tx,u,sid,action,row){await tx.auditLog.create({data:{tenantId:u.tenantId,studyGroupId:u.studyGroupId,accountId:u.accountId,action:'hub_media_'+action,target:row.id,meta:{sessionId:sid,version:row.version}}});}
 async function update(tx,row,sql,values){
  const [next]=await tx.$queryRawUnsafe(`UPDATE rh_ai.session_media_uploads SET ${sql},version=version+1 WHERE id=$${values.length+1} AND version=$${values.length+2} RETURNING *`,...values,row.id,row.version);
  if(!next)fail('MEDIA_VERSION');return next;
 }
 async function publishArchive(u,sid,source){
  return access.transaction(u,sid,async(tx,current)=>{
   const row=await own(tx,current,sid,source.id,'id',true);
   if(row.source_sha256!==source.source_sha256)fail('MEDIA_SOURCE_CHANGED');
   if(row.archive_state==='failed')fail('MEDIA_FILE_INVALID',400);
   if(row.archive_state==='archived')return row;
   const saved=await update(tx,row,"archive_state='archived'",[]);await audit(tx,current,sid,'archived',saved);return saved;
  });
 }
 async function markFailed(u,sid,mediaId,requireUnfrozen=false){
  return access.transaction(u,sid,async(tx,current)=>{
   const row=await own(tx,current,sid,mediaId,'id',true);if(row.archive_state!=='pending')return row;
   if(requireUnfrozen&&row.source_sha256)fail('MEDIA_SOURCE_CHANGED');
   const saved=await update(tx,row,"archive_state='failed'",[]);await audit(tx,current,sid,'upload_failed',saved);return saved;
  });
 }
 async function check(u,sid,mediaId,{requestKey,expectedVersion},path){
  if(!id(requestKey)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)fail('MEDIA_INPUT',400);
  const hex=materialDigest([mediaId,requestKey]).slice(0,32),attempt=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  const claim=await access.transaction(u,sid,async(tx,current)=>{
   const row=await own(tx,current,sid,mediaId,'id',true);
   if(row.archive_state!=='archived')fail('MEDIA_NOT_ARCHIVED');
   if(row.inspection_attempt_id===attempt&&['complete','unavailable'].includes(row.inspection_state))return{row,replay:true};
   if(row.version!==expectedVersion)fail('MEDIA_VERSION');
   if(row.inspection_state==='running'&&new Date(row.lease_expires_at)>new Date())fail('MEDIA_CHECK_RUNNING');
   return{row:await update(tx,row,`inspection_state='running',inspection_classification=NULL,inspection_attempt_id=$1::uuid,lease_expires_at=now()+interval '45 seconds'`,[attempt]),replay:false};
  });
  if(claim.replay)return projectMedia(claim.row);
  let result;
  if(path)result=await inspectMedia(path,claim.row.safe_filename);
  else{
   // Explicit recheck downloads only this authorized immutable object.
   result=await inspectMedia(null,claim.row.safe_filename,{storage,key:claim.row.storage_key,validate:async()=>{
    const row=await read(u,sid,mediaId);if(row.source_sha256!==claim.row.source_sha256||row.inspection_attempt_id!==attempt)fail('MEDIA_SOURCE_CHANGED');
    assertObject(row,await storage.statObject(row.storage_key));
   }});
  }
  return access.transaction(u,sid,async(tx,current)=>{
   const row=await own(tx,current,sid,mediaId,'id',true);
   if(row.version!==claim.row.version||row.inspection_attempt_id!==attempt||row.inspection_state!=='running'||new Date(row.lease_expires_at)<=new Date())fail('MEDIA_VERSION');
   const next=await update(tx,row,`inspection_state=$1,inspection_classification=$2,inspection=$3::jsonb,lease_expires_at=NULL`,[result.classification==='valid'?'complete':'unavailable',result.classification,JSON.stringify({hasVideo:result.hasVideo,hasAudio:result.hasAudio,...(Number.isFinite(result.durationSeconds)?{durationSeconds:result.durationSeconds}:{})})]);
   await audit(tx,current,sid,'checked',next);return projectMedia(next);
  });
 }
 return{
  async initialize(u,sid,body){
   const value=normalizeMediaInput(body),fingerprint=materialDigest(value);
   let row=await access.transaction(u,sid,async(tx,current)=>{
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',materialDigest([...scope(current,sid),value.requestKey]));
    const [existing]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE ${where} AND request_key=$6`,...scope(current,sid),value.requestKey);
    if(existing){if(existing.request_fingerprint!==fingerprint)fail('MEDIA_REQUEST_CONFLICT');return existing;}
    const mediaId='rh-media-'+randomUUID();
    const [created]=await tx.$queryRawUnsafe(`INSERT INTO rh_ai.session_media_uploads(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,request_fingerprint,extension,content_type,safe_filename,byte_size,storage_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,mediaId,...scope(current,sid),value.requestKey,fingerprint,value.extension,value.contentType,mediaId+'.'+value.extension,value.byteSize,`${current.tenantId}/hub-media/${sid}/${mediaId}.${value.extension}`);
    return created;
   });
   if(!row.upload_id){
    const initialized=await chunks.initialize(context(u,sid),{filename:row.safe_filename,mimeType:row.content_type,sizeBytes:Number(row.byte_size),binding:row.request_fingerprint});
    // An unknown transaction result must not cancel a potentially bound upload.
    row=await access.transaction(u,sid,async(tx,current)=>{
     const currentRow=await own(tx,current,sid,row.id,'id',true);
     if(currentRow.upload_id)return currentRow;
     return update(tx,currentRow,'upload_id=$1::uuid',[initialized.uploadId]);
    });
    if(row.upload_id!==initialized.uploadId)await chunks.cancel(context(u,sid),initialized.uploadId);
   }
   return{item:projectMedia(row),uploadId:row.upload_id,chunkSize:MEDIA_CHUNK_BYTES,totalChunks:Math.ceil(Number(row.byte_size)/MEDIA_CHUNK_BYTES),identityMode:identityMode(row),expiresAt:new Date(row.created_at.getTime()+2*60*60*1000).toISOString()};
  },
  async snapshot(u,sid,uploadId){
   const row=await read(u,sid,uploadId,'upload_id');
   if(row.archive_state!=='pending'||identityMode(row)==='legacy')fail('MEDIA_VERSION');
   if(!readChunks)fail('MEDIA_UNAVAILABLE',503);
   let result,error;try{result=await readChunks(context(u,sid),row);}catch(e){error=e;}
   const latest=await read(u,sid,uploadId,'upload_id');
   if(latest.version!==row.version||latest.request_fingerprint!==row.request_fingerprint||latest.archive_state!=='pending')fail('MEDIA_VERSION');
   if(error)throw error;return result;
  },
  async chunk(u,sid,uploadId,index,input,length){
   const row=await read(u,sid,uploadId,'upload_id');if(row.archive_state!=='pending')fail('MEDIA_ALREADY_ARCHIVED');
   if(!Number.isSafeInteger(index)||index<0)fail('MEDIA_INPUT',400);
   const result=await chunks.writeChunk(context(u,sid),uploadId,index,input,length);
   await read(u,sid,uploadId,'upload_id');return result;
  },
  async complete(u,sid,uploadId){
   let row=await read(u,sid,uploadId,'upload_id');
   if(row.archive_state==='failed')fail('MEDIA_FILE_INVALID',400);
   if(row.archive_state==='archived'){assertObject(row,await storage.statObject(row.storage_key));return projectMedia(await read(u,sid,row.id));}
   try{await chunks.complete(context(u,sid),uploadId,async file=>{
    if(identityMode(row)!=='legacy'){
     const fileIdentity=await identityFromMediaPath(file.path,Number(row.byte_size));
     if(materialDigest({...rowInput(row),fileIdentity})!==row.request_fingerprint)fail('MEDIA_FILE_IDENTITY_CHANGED');
    }
    let signature;
    try{signature=await inspectSignature({path:file.path,filename:file.originalname,declaredMimetype:file.mimetype,size:file.size});}
    catch(e){if(e.name==='ChatUploadSignatureError'||e.name==='ChatUploadInspectionError'){
     if(!row.source_sha256)await markFailed(u,sid,row.id,true);fail('MEDIA_FILE_INVALID',400);
    }throw e;}
    if(signature.modality!=='video'||signature.extension!==row.extension||file.size!==Number(row.byte_size))fail('MEDIA_FILE_INVALID',400);
    row=await access.transaction(u,sid,async(tx,current)=>{
     const currentRow=await own(tx,current,sid,row.id,'id',true);
     if(currentRow.archive_state==='failed')fail('MEDIA_FILE_INVALID',400);
     if(currentRow.source_sha256&&currentRow.source_sha256!==signature.sha256)fail('MEDIA_SOURCE_CHANGED');
     return currentRow.source_sha256?currentRow:update(tx,currentRow,'source_sha256=$1',[signature.sha256]);
    });
    if(row.archive_state!=='archived'){
     if((await read(u,sid,row.id)).archive_state==='failed')fail('MEDIA_FILE_INVALID',400);
     let exists=false;
     try{assertObject(row,await storage.statObject(row.storage_key));exists=true;}catch(e){if(!missing(e))throw e;}
     if(!exists)await storage.putFile(row.storage_key,file.path,row.content_type,{
      'X-Amz-Meta-Aisci-Sha256':row.source_sha256,'X-Amz-Meta-Aisci-Media-Id':row.id,
      'X-Amz-Meta-Aisci-Account-Id':row.account_id,'X-Amz-Meta-Aisci-Session-Id':sid});
     assertObject(row,await storage.statObject(row.storage_key));
     row=await publishArchive(u,sid,row);
    }
    if(row.inspection_state==='pending')await check(u,sid,row.id,{requestKey:row.request_key,expectedVersion:row.version},file.path);
    return{mediaId:row.id};
   },row.request_fingerprint);}catch(e){
    if(e.getStatus?.()!==404)throw e;
    // A temporary manifest may expire after a successful PUT. Recover only the
    // already frozen original; never create/re-upload another identity.
    row=await read(u,sid,row.id);
    let stored=false;
    if(row.source_sha256){try{assertObject(row,await storage.statObject(row.storage_key));stored=true;}catch(error){if(!missing(error))throw error;}}
    if(stored){row=await publishArchive(u,sid,row);if(row.inspection_state==='pending')await check(u,sid,row.id,{requestKey:row.request_key,expectedVersion:row.version});}
    else{await markFailed(u,sid,row.id);fail('MEDIA_UPLOAD_EXPIRED',410);}
   }
   return projectMedia(await read(u,sid,row.id));
  },
  receipt:(u,sid,key)=>{if(!id(key))fail('MEDIA_INPUT',400);return access.transaction(u,sid,async(tx,current)=>{const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE ${where} AND request_key=$6`,...scope(current,sid),key);return{found:Boolean(row),item:row?projectMedia(row):null,identityMode:row?identityMode(row):null,upload:row?.upload_id?{uploadId:row.upload_id,chunkSize:MEDIA_CHUNK_BYTES,totalChunks:Math.ceil(Number(row.byte_size)/MEDIA_CHUNK_BYTES)}:null};});},
  list:(u,sid,{limit='20',cursor}={})=>{
   if(!/^(?:[1-9]|1[0-9]|20)$/.test(String(limit))||cursor&&!id(cursor))fail('MEDIA_INPUT',400);
   return access.transaction(u,sid,async(tx,current)=>{
    if(cursor)await own(tx,current,sid,cursor);
    const rows=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE ${where}${cursor?' AND (created_at,id)<(SELECT created_at,id FROM rh_ai.session_media_uploads WHERE id=$7)':''} ORDER BY created_at DESC,id DESC LIMIT $6`,...scope(current,sid),Number(limit)+1,...(cursor?[cursor]:[]));
    return{items:rows.slice(0,Number(limit)).map(projectMedia),nextCursor:rows.length>Number(limit)?rows[Number(limit)-1].id:null};
   });
  },
  recheck:(u,sid,mediaId,body)=>check(u,sid,mediaId,body),
  async content(u,sid,mediaId,range){
   const row=await read(u,sid,mediaId);if(row.archive_state!=='archived')fail('MEDIA_NOT_ARCHIVED');
   assertObject(row,await storage.statObject(row.storage_key));
   const bounds=parseRange(range,Number(row.byte_size));
   const verify=async(opened=false)=>access.transaction(u,sid,async(tx,actor)=>{
    const current=await own(tx,actor,sid,mediaId);if(current.version!==row.version||current.source_sha256!==row.source_sha256||current.archive_state!=='archived')fail('MEDIA_SOURCE_CHANGED');
    if(opened)await audit(tx,actor,sid,'read_opened',current);
   });
   await verify();const stream=await storage.getStream(row.storage_key,bounds?.start,bounds?.length);
   try{await verify(true);}catch(e){stream.destroy();throw e;}
   const headers={'Cache-Control':'private, no-store','Content-Type':row.content_type,'Content-Disposition':`inline; filename="${row.safe_filename}"`,'Content-Length':String(bounds?.length??row.byte_size),'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff',...(bounds?{'Content-Range':`bytes ${bounds.start}-${bounds.end}/${row.byte_size}`}:{})};
   return{stream,status:bounds?206:200,headers};
  },
 };
}
