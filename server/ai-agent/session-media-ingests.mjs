import{randomUUID}from'node:crypto';
import{materialDigest}from'./session-material-contract.mjs';
import{assertMediaObject}from'./session-media.mjs';
import{mediaIngestFail as fail,mediaIngestId as id,mediaIngestOnly as only,normalizeMediaIngest,mediaIngestSnapshot,mediaInspectionRef}from'./session-media-ingest-contract.mjs';

export function createSessionMediaIngests({studies,sourceAccess,native,storage,scopeKey,sourceScope,allowedStudyIds,parseRange}){
 const allowed=new Set(allowedStudyIds);
 const sourceUser=u=>({...u,...sourceScope});
 const restore=(tx,u,c)=>tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)`,c.studyGroupId,c.executionProjectId,u.accountId);
 async function sourceInTx(tx,u,c,sid,mid){
  try{return await sourceAccess.inTransaction(tx,sourceUser(u),sid,async(connection,actor)=>{
   const [media]=await connection.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_uploads WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND study_group_id=$4 AND research_project_id=$5 AND id=$6 FOR SHARE`,actor.tenantId,actor.accountId,sid,sourceScope.studyGroupId,sourceScope.researchProjectId,mid);
   if(!media)fail('MEDIA_INGEST_NOT_FOUND',404);return{actor,media,source:{...sourceScope,sessionId:sid}};
  });}finally{await restore(tx,u,c);}
 }
 function run(u,sid,mid,studyId,fn){
  if(![sid,mid,studyId].every(id))fail('MEDIA_INGEST_INPUT',400);
  if(!allowed.has(studyId))fail('MEDIA_INGEST_PERMISSION',403);
  return studies.withResearchStudyTransaction(u,studyId,'read',async(tx,c)=>{
   const state=await sourceInTx(tx,u,c,sid,mid);return fn(tx,state.actor,c,state.source,state.media);
  });
 }
 async function meta(u,sid,mid,{planId,key}={}){
  if(![sid,mid].every(id)||planId&&!id(planId)||key&&!id(key))fail('MEDIA_INGEST_INPUT',400);
  return sourceAccess.transaction(sourceUser(u),sid,async(tx,a)=>{
   const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND media_id=$4 AND scope_key=$5${planId?' AND id=$6':key?' AND request_key=$6':" AND state='committed'"} ORDER BY created_at DESC,id DESC LIMIT 1`,a.tenantId,a.accountId,sid,mid,scopeKey,...(planId?[planId]:key?[key]:[]));return row??null;
  });
 }
 async function locked(tx,u,row){
  const [current]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND account_id=$2 AND id=$3 AND scope_key=$4 FOR UPDATE`,u.tenantId,u.accountId,row.id,scopeKey);
  if(!current)fail('MEDIA_INGEST_NOT_FOUND',404);return current;
 }
 async function authority(tx,u,c,source,media,row,capability,expected=false){
  return native.currentInTx(tx,u,c,source,{capability,mediaId:media.id,subjectId:row?.subject_id,visitId:row?.visit_id,expectedRef:expected?row.permission_ref:undefined});
 }
 async function audit(tx,u,c,sid,action,target){return tx.auditLog.create({data:{tenantId:u.tenantId,studyGroupId:c.studyGroupId,accountId:u.accountId,action:'hub_media_ingest_'+action,target,meta:{sessionId:sid,studyId:c.studyId}}});}
 async function view(tx,u,c,source,media,row){
  await authority(tx,u,c,source,media,row,'result.read');
  if(row.media_id!==media.id||row.source_sha256!==media.source_sha256||media.archive_state!=='archived')fail('MEDIA_INGEST_SOURCE_CHANGED');
  const target=await native.targetInTx(tx,u,c,row.subject_id,row.visit_id,row.collected_at?.toISOString()??null);
  if(row.state==='committed'){
   const file=await tx.modalityFile.findFirst({where:{id:row.modality_file_id,tenantId:u.tenantId,subjectId:row.subject_id,subjectVisitId:row.visit_id,createdBy:u.accountId,deletedAt:null,kind:'raw',modality:'video'},select:{id:true,storageKey:true,meta:true}});
   if(!file||file.storageKey!==media.storage_key||file.meta?.sha256!==row.source_sha256||file.meta?.hubMediaIngest?.id!==row.id)fail('MEDIA_INGEST_NOT_FOUND',404);
  }
  return{id:row.id,version:row.version,state:row.state,confirmationHash:row.confirmation_hash,requestKey:row.request_key,
   source:{mediaId:row.media_id,sha256:row.source_sha256,byteSize:Number(media.byte_size),inspection:row.snapshot.source.inspection},
   study:{id:c.studyId,name:target.studyName},subject:{id:target.subject.id,subjectCode:target.subject.subjectId},visit:target.visit?{id:target.visit.id,name:target.visit.name}:null,
   collectedAt:row.collected_at?.toISOString()??null,...(row.receipt?{receipt:row.receipt,contentHref:`/api/research-studies/${c.studyId}/subjects/${row.subject_id}/session-media-ingests/${row.id}/content`}:{})};
 }
 async function checkedMeta(u,sid,mid,query){const row=await meta(u,sid,mid,query);if(!row)fail('MEDIA_INGEST_NOT_FOUND',404);return row;}
 async function read(u,sid,mid,query){const row=await checkedMeta(u,sid,mid,query);return run(u,sid,mid,row.study_id,(tx,a,c,source,media)=>view(tx,a,c,source,media,row));}
 async function subjectRow(u,studyId,subjectId,ingestId,{expected,auditRead=false}={}){
  if(![studyId,subjectId,ingestId].every(id))fail('MEDIA_INGEST_INPUT',400);if(!allowed.has(studyId))fail('MEDIA_INGEST_NOT_FOUND',404);
  return studies.withResearchStudyTransaction(u,studyId,'read',async(tx,c)=>{
   await restore(tx,u,c);
   const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND account_id=$2 AND study_id=$3 AND subject_id=$4 AND id=$5 AND scope_key=$6 AND state='committed'`,u.tenantId,u.accountId,studyId,subjectId,ingestId,scopeKey);
   if(!row)fail('MEDIA_INGEST_NOT_FOUND',404);
   const {actor,media,source}=await sourceInTx(tx,u,c,row.session_id,row.media_id);
   const item=await view(tx,actor,c,source,media,row);
   if(expected&&(row.version!==expected.row.version||media.version!==expected.media.version||media.source_sha256!==expected.media.source_sha256))fail('MEDIA_INGEST_SOURCE_CHANGED');
   if(auditRead)await audit(tx,actor,c,row.session_id,'read_opened',row.id);
   return{item,row,media};
  });
 }
 const service={
  async targets(u,sid,mid){
   const current=await meta(u,sid,mid),items=[];
   if(current)return{items:[],current:await read(u,sid,mid,{planId:current.id})};
   for(const studyId of allowed){try{items.push(await run(u,sid,mid,studyId,async(tx,a,c,source,media)=>{mediaInspectionRef(media);const permission=await authority(tx,a,c,source,media,null,'media.register');return native.candidatesInTx(tx,a,c,permission);}));}catch(e){if(![403,404,409].includes(e.status??e.getStatus?.()))throw e;}}
   return{items:items.filter(x=>x.subjects.length),current:null};
  },
  async prepare(u,sid,mid,body){
   const input=normalizeMediaIngest(body);
   const initial=await run(u,sid,mid,input.studyId,async(tx,a,c,source,media)=>{
    await native.currentInTx(tx,a,c,source,{capability:'media.register',mediaId:mid,subjectId:input.subjectId,visitId:input.subjectVisitId});mediaInspectionRef(media);return media;
   });
   assertMediaObject(initial,await storage.statObject(initial.storage_key));
   return run(u,sid,mid,input.studyId,async(tx,a,c,source,media)=>{
    const permission=await native.currentInTx(tx,a,c,source,{capability:'media.register',mediaId:mid,subjectId:input.subjectId,visitId:input.subjectVisitId});
    const target=await native.targetInTx(tx,a,c,input.subjectId,input.subjectVisitId,input.collectedAt,{write:true}),snapshot=mediaIngestSnapshot(media,target,permission.permissionRef);
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',materialDigest([a.tenantId,a.accountId,sid,input.requestKey]));
    const [saved]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND request_key=$4`,a.tenantId,a.accountId,sid,input.requestKey);
    if(saved){if(saved.media_id!==mid||saved.confirmation_hash!==snapshot.hash)fail('MEDIA_INGEST_REQUEST_CONFLICT');return view(tx,a,c,source,media,saved);}
    const [existing]=await tx.$queryRawUnsafe(`SELECT id FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND media_id=$2 AND state='committed'`,a.tenantId,mid);if(existing)fail('MEDIA_INGEST_ALREADY_REGISTERED');
    const planId='rh-media-ingest-'+randomUUID(),entry=await audit(tx,a,c,sid,'planned',planId);
    const [row]=await tx.$queryRawUnsafe(`INSERT INTO rh_ai.session_media_ingests(id,tenant_id,account_id,session_id,source_study_group_id,source_research_project_id,media_id,source_version,source_sha256,study_id,study_group_id,research_project_id,scope_key,subject_id,enrollment_id,visit_id,protocol_id,collected_at,request_key,confirmation_hash,snapshot,permission_ref,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23) RETURNING *`,planId,a.tenantId,a.accountId,sid,source.studyGroupId,source.researchProjectId,mid,media.version,media.source_sha256,c.studyId,c.studyGroupId,c.executionProjectId,scopeKey,input.subjectId,target.enrollment?.id??null,input.subjectVisitId,target.protocol?.id??null,input.collectedAt?new Date(input.collectedAt):null,input.requestKey,snapshot.hash,JSON.stringify(snapshot),JSON.stringify(permission.permissionRef),entry.id);
    return view(tx,a,c,source,media,row);
   });
  },
  get:(u,sid,mid,planId)=>read(u,sid,mid,{planId}),
  async receipt(u,sid,mid,key){const row=await meta(u,sid,mid,{key});return{found:Boolean(row),item:row?await read(u,sid,mid,{planId:row.id}):null};},
  async confirm(u,sid,mid,planId,body){
   only(body,['expectedVersion','confirmationHash']);if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||!/^[a-f0-9]{64}$/.test(body.confirmationHash??''))fail('MEDIA_INGEST_INPUT',400);
   const old=await checkedMeta(u,sid,mid,{planId});
   const original=await run(u,sid,mid,old.study_id,async(tx,a,c,source,media)=>{await authority(tx,a,c,source,media,old,'result.read');return media;});
   assertMediaObject(original,await storage.statObject(original.storage_key));
   return run(u,sid,mid,old.study_id,async(tx,a,c,source,media)=>{
    // Serialize by original before target write locks; different confirmation plans
    // must resolve to one receipt, rather than an ambiguous uniqueness failure.
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',materialDigest([a.tenantId,mid,'media-ingest-register']));
    const row=await locked(tx,a,old);
    if(row.state==='committed'){if(body.confirmationHash!==row.confirmation_hash||body.expectedVersion!==row.version-1)fail('MEDIA_INGEST_VERSION');return view(tx,a,c,source,media,row);}
    const [registered]=await tx.$queryRawUnsafe(`SELECT id FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND media_id=$2 AND state='committed'`,a.tenantId,mid);
    if(registered)fail('MEDIA_INGEST_ALREADY_REGISTERED');
    if(row.state!=='planned'||row.version!==body.expectedVersion||row.confirmation_hash!==body.confirmationHash)fail('MEDIA_INGEST_VERSION');
    const permission=await authority(tx,a,c,source,media,row,'media.register',true),target=await native.targetInTx(tx,a,c,row.subject_id,row.visit_id,row.collected_at?.toISOString()??null,{write:true});
    const snapshot=mediaIngestSnapshot(media,target,permission.permissionRef);if(snapshot.hash!==row.confirmation_hash)fail('MEDIA_INGEST_SOURCE_CHANGED');
    const file=await tx.modalityFile.create({data:{tenantId:a.tenantId,subjectId:row.subject_id,subjectVisitId:row.visit_id,modality:'video',kind:'raw',storageKey:media.storage_key,filename:media.safe_filename,status:'needs_review',collectedAt:row.collected_at,createdBy:a.accountId,meta:{sha256:media.source_sha256,storageVerifiedSha256:media.source_sha256,size:Number(media.byte_size),mimetype:media.content_type,source:'hub-session-video',hubMediaIngest:{id:row.id,mediaId:mid,inspection:row.snapshot.source.inspection,orchestration:'triage_only',featuresGenerated:false,contentUnderstood:false}}}});
    const entry=await audit(tx,a,c,sid,'committed',row.id),receipt={schema:'hub-media-ingest-receipt.v1',confirmationHash:row.confirmation_hash,modalityFileId:file.id,registeredAt:file.createdAt.toISOString(),auditId:entry.id};
    const [committed]=await tx.$queryRawUnsafe(`UPDATE rh_ai.session_media_ingests SET state='committed',modality_file_id=$1,receipt=$2::jsonb,audit_id=$3,version=version+1 WHERE id=$4 AND version=$5 AND state='planned' RETURNING *`,file.id,JSON.stringify(receipt),entry.id,row.id,row.version);
    if(!committed)fail('MEDIA_INGEST_VERSION');return view(tx,a,c,source,media,committed);
   });
  },
  async subjectList(u,studyId,subjectId,query={}){
   only(query,['limit','cursor','visitId','fileId']);const limit=String(query.limit??'20');if(![studyId,subjectId].every(id)||!/^([1-9]|1[0-9]|20)$/.test(limit)||query.cursor&&!id(query.cursor)||query.visitId&&!id(query.visitId)||query.fileId&&!id(query.fileId))fail('MEDIA_INGEST_INPUT',400);
   if(!allowed.has(studyId))return{items:[],nextCursor:null};
   return studies.withResearchStudyTransaction(u,studyId,'read',async(tx,c)=>{
    await restore(tx,u,c);
    const values=[u.tenantId,u.accountId,studyId,subjectId,scopeKey],predicates=["tenant_id=$1 AND account_id=$2 AND study_id=$3 AND subject_id=$4 AND scope_key=$5 AND state='committed'"];
    if(query.visitId){values.push(query.visitId);predicates.push(`visit_id=$${values.length}`);}if(query.fileId){values.push(query.fileId);predicates.push(`modality_file_id=$${values.length}`);}
    const where=predicates.join(' AND ');
    if(query.cursor){const [cursor]=await tx.$queryRawUnsafe(`SELECT id,created_at FROM rh_ai.session_media_ingests WHERE ${where} AND id=$${values.length+1}`,...values,query.cursor);if(!cursor)fail('MEDIA_INGEST_NOT_FOUND',404);values.push(cursor.created_at,cursor.id);predicates.push(`(created_at,id)<($${values.length-1},$${values.length})`);}
    values.push(Number(limit)+1);const rows=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingests WHERE ${predicates.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT $${values.length}`,...values),selected=rows.slice(0,Number(limit)),items=[];
    for(const row of selected){const {actor,source,media}=await sourceInTx(tx,u,c,row.session_id,row.media_id);items.push(await view(tx,actor,c,source,media,row));}
    return{items,nextCursor:rows.length>Number(limit)?selected.at(-1).id:null};
   });
  },
  async subjectGet(u,studyId,subjectId,ingestId){return(await subjectRow(u,studyId,subjectId,ingestId)).item;},
  async content(u,studyId,subjectId,ingestId,range){
   const before=await subjectRow(u,studyId,subjectId,ingestId),{media,row}=before;
   assertMediaObject(media,await storage.statObject(media.storage_key));const bounds=parseRange(range,Number(media.byte_size));
   const verify=auditRead=>subjectRow(u,studyId,subjectId,ingestId,{expected:before,auditRead});
   await verify();const stream=await storage.getStream(media.storage_key,bounds?.start,bounds?.length);
   try{await verify(true);}catch(e){stream.destroy();throw e;}
   return{stream,status:bounds?206:200,headers:{'Content-Type':media.content_type,'Content-Disposition':`inline; filename="${media.safe_filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Length':String(bounds?.length??media.byte_size),...(bounds?{'Content-Range':`bytes ${bounds.start}-${bounds.end}/${media.byte_size}`}:{})}};
  },
  async limitedReadInTx(tx,u,c){
   if(!allowed.has(c.studyId))return null;await restore(tx,u,c);
   const rows=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_media_ingests WHERE tenant_id=$1 AND account_id=$2 AND study_id=$3 AND scope_key=$4 AND state='committed'`,u.tenantId,u.accountId,c.studyId,scopeKey),subjectIds=[],visitIds=[];
   for(const row of rows){try{const {actor,source,media}=await sourceInTx(tx,u,c,row.session_id,row.media_id);await view(tx,actor,c,source,media,row);subjectIds.push(row.subject_id);if(row.visit_id)visitIds.push(row.visit_id);}catch(e){if(![403,404].includes(e.status??e.getStatus?.()))throw e;}}
   return subjectIds.length?{subjectIds:[...new Set(subjectIds)],visitIds:[...new Set(visitIds)]}:null;
  },
 };
 return service;
}
