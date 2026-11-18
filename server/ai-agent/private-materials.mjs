import {freezePrivateMaterials,normalizeMaterialRefs,materialDigest as digest} from './session-material-contract.mjs';
const fail=code=>{throw Object.assign(Error(code),{code,status:409});};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function binding(snapshot){
 if(snapshot?.schema!=='hub-private-materials.v1')fail('HUB_PRIVATE_BINDING_CHANGED');
 const {hash,...body}=snapshot;if(digest(body)!==hash||!snapshot.materials?.length)fail('HUB_PRIVATE_BINDING_CHANGED');
 normalizeMaterialRefs(snapshot.materials.map(m=>({materialId:m.materialId,version:m.version})));return snapshot;
}
function documentMetadata(snapshot,metadata){
 binding(snapshot);if(!Array.isArray(metadata)||metadata.length!==snapshot.materials.length)fail('HUB_PRIVATE_METADATA_CHANGED');
 return snapshot.materials.map(m=>{
  const rows=metadata.filter(d=>d.materialId===m.materialId);if(rows.length!==1)fail('HUB_PRIVATE_METADATA_CHANGED');
  const d=rows[0];if(typeof d.title!=='string'||!Number.isSafeInteger(d.contentLength)||d.contentLength<1||!Number.isSafeInteger(d.lineCount)||d.lineCount<1||typeof d.reviewed!=='boolean')fail('HUB_PRIVATE_METADATA_CHANGED');return d;
 });
}
export function planPrivateMaterialReads(snapshot,metadata,{maxChars=24000}={}){
 const docs=documentMetadata(snapshot,metadata);
 if(!Number.isSafeInteger(maxChars)||maxChars<600||maxChars>48000||maxChars<docs.length*60)fail('HUB_PRIVATE_READING_LIMIT');
 const each=Math.floor(maxChars/docs.length),plans=[];
 for(const d of docs){
  const n=d.contentLength;
  if(n<=each)plans.push({materialId:d.materialId,docId:snapshot.materials.find(m=>m.materialId===d.materialId).docId,start:0,length:n});
  else{
   const width=Math.floor(each/3),last=each-2*width,mid=Math.floor((n-width)/2),docId=snapshot.materials.find(m=>m.materialId===d.materialId).docId;
   for(const [start,length]of [[0,width],[mid,width],[n-last,last]])plans.push({materialId:d.materialId,docId,start,length});
  }
 }
 return plans;
}
export function assemblePrivateMaterialPack(snapshot,metadata,plans,fragments,{maxChars=24000}={}){
 const docs=documentMetadata(snapshot,metadata),expected=planPrivateMaterialReads(snapshot,metadata,{maxChars});
 if(JSON.stringify(plans)!==JSON.stringify(expected)||!Array.isArray(fragments)||fragments.length!==plans.length)fail('HUB_PRIVATE_FRAGMENT_CHANGED');
 const sources=snapshot.materials.map((m,index)=>{
  const d=docs[index],sourceId='M'+(index+1),selected=plans.filter(p=>p.materialId===m.materialId);
  const excerpts=selected.map((p,i)=>{
   const matches=fragments.filter(f=>f.materialId===p.materialId&&f.docId===p.docId&&f.start===p.start&&f.length===p.length);
   if(matches.length!==1)fail('HUB_PRIVATE_FRAGMENT_CHANGED');const f=matches[0];
   if(typeof f.text!=='string'||Array.from(f.text).length!==p.length||!Number.isSafeInteger(f.lineStart)||!Number.isSafeInteger(f.lineEnd)||f.lineStart<1||f.lineEnd<f.lineStart||f.lineEnd>d.lineCount)fail('HUB_PRIVATE_FRAGMENT_CHANGED');
   return{id:sourceId+'-F'+(i+1),start:p.start,end:p.start+p.length,lineStart:f.lineStart,lineEnd:f.lineEnd,text:f.text};
  });
  if(!excerpts.some(f=>f.text.trim()))fail('HUB_PRIVATE_TEXT_EMPTY');
  const readCharacters=selected.reduce((sum,p)=>sum+p.length,0);
  return{id:sourceId,materialId:m.materialId,materialVersion:m.version,kbId:m.kbId,sourceFileId:m.sourceFileId,sourceSha256:m.sourceSha256,
   docId:m.docId,docVersion:m.docVersion,contentSha256:m.contentSha256,title:d.title,reviewed:d.reviewed,
   sourceType:d.reviewed?'owner-private-reviewed-document':'owner-uploaded-draft',
   coverage:{complete:readCharacters===d.contentLength,readCharacters,totalCharacters:d.contentLength,totalLines:d.lineCount,positionUnit:'unicode-codepoints'},fragments:excerpts};
 });
 const body={schema:'hub-private-material-pack.v1',binding:structuredClone(snapshot),readingLimit:maxChars,sources};
 return freeze({...body,packHash:digest(body)});
}
export function assertPrivateMaterialPack(pack){
 if(pack?.schema!=='hub-private-material-pack.v1')fail('HUB_PRIVATE_PACK_CHANGED');const {packHash,...body}=pack;
 if(digest(body)!==packHash)fail('HUB_PRIVATE_PACK_CHANGED');binding(pack.binding);return pack;
}

// Never accept a client-authored pack as a grant: read exact RLS-scoped native
// parents under current authorization, lock them, and rebuild before delivery.
export function createPrivateMaterialReader({access}){
 async function prepareInTx(tx,user,sessionId,input){
  const refs=normalizeMaterialRefs(input);if(!refs.length)fail('HUB_PRIVATE_MATERIAL_REQUIRED');
  const rows=await tx.$queryRawUnsafe(`SELECT m.*,k.visibility AS kb_visibility,k."ownerAccountId" AS kb_owner,
   k."tenantId" AS kb_tenant,k."studyGroupId" AS kb_group,k."researchProjectId" AS kb_project,
   f.sha256 AS file_sha,f."docId" AS file_doc,f."createdBy" AS file_owner,
   i.status AS import_status,i.stage AS import_stage,i."safetyLevel" AS import_safety,i."docId" AS import_doc,i."createdBy" AS import_owner,
   d.version AS current_doc_version,d.title AS doc_title,d.status AS doc_status,d.reviewed,d."safetyLevel" AS doc_safety,d."trashedAt" AS doc_trashed,
   encode(sha256(convert_to(d."contentMd",'UTF8')),'hex') AS current_content_sha,
   char_length(d."contentMd")::int AS content_length,
   (1+char_length(d."contentMd")-char_length(replace(d."contentMd",E'\n','')))::int AS line_count
   FROM rh_ai.session_materials m
   JOIN public.knowledge_base k ON k.id=m.kb_id
   JOIN public.knowledge_source_file f ON f.id=m.source_file_id AND f."kbId"=k.id AND f."tenantId"=m.tenant_id AND f."studyGroupId"=m.study_group_id
   JOIN public.knowledge_import_task i ON i.id=m.import_task_id AND i."sourceFileId"=f.id AND i."kbId"=k.id AND i."tenantId"=m.tenant_id AND i."studyGroupId"=m.study_group_id
   JOIN public.knowledge_doc d ON d.id=m.doc_id AND d."kbId"=k.id AND d."tenantId"=m.tenant_id AND d."studyGroupId"=m.study_group_id
   WHERE m.id=ANY($1::text[]) AND m.session_id=$2 AND m.tenant_id=$3 AND m.account_id=$4
   FOR SHARE OF m,k,f,i,d`,refs.map(r=>r.materialId),sessionId,user.tenantId,user.accountId);
  const records=rows.map(r=>{
   if(r.import_status!=='complete'||r.import_stage!=='complete'||r.import_safety!=='allow'||r.file_doc!==r.doc_id||r.import_doc!==r.doc_id||r.file_owner!==user.accountId||r.import_owner!==user.accountId||r.file_sha!==r.source_sha256||r.current_doc_version!==r.doc_version||r.current_content_sha!==r.content_sha256)fail('HUB_PRIVATE_SOURCE_CHANGED');
   return{id:r.id,tenantId:r.tenant_id,accountId:r.account_id,studyGroupId:r.study_group_id,researchProjectId:r.research_project_id,sessionId:r.session_id,version:r.version,purpose:r.purpose,state:r.state,deletedAt:r.deleted_at,
    kbId:r.kb_id,kbVisibility:r.kb_visibility,kbOwnerAccountId:r.kb_owner,kbTenantId:r.kb_tenant,kbStudyGroupId:r.kb_group,kbResearchProjectId:r.kb_project,
    sourceFileId:r.source_file_id,sourceKbId:r.kb_id,sourceDocId:r.file_doc,sourceTenantId:r.tenant_id,sourceStudyGroupId:r.study_group_id,sourceCreatedBy:r.file_owner,
    docId:r.doc_id,docKbId:r.kb_id,docTenantId:r.tenant_id,docStudyGroupId:r.study_group_id,docVersion:r.doc_version,docStatus:r.doc_status,safetyLevel:r.doc_safety,trashedAt:r.doc_trashed,sourceSha256:r.source_sha256,contentSha256:r.content_sha256};
  });
  const snapshot=freezePrivateMaterials({principal:user,sessionId,refs,records});
  const metadata=rows.map(r=>({materialId:r.id,title:r.doc_title,reviewed:r.reviewed,contentLength:r.content_length,lineCount:r.line_count}));
  const plans=planPrivateMaterialReads(snapshot,metadata);
  const fragments=await tx.$queryRawUnsafe(`SELECT p."materialId",p."docId",p.start,p.length,
   substring(d."contentMd" FROM p.start+1 FOR p.length) AS text,
   (1+char_length(left(d."contentMd",p.start))-char_length(replace(left(d."contentMd",p.start),E'\n','')))::int AS "lineStart",
   (1+char_length(left(d."contentMd",p.start+p.length))-char_length(replace(left(d."contentMd",p.start+p.length),E'\n',''))-CASE WHEN right(substring(d."contentMd" FROM p.start+1 FOR p.length),1)=E'\n' THEN 1 ELSE 0 END)::int AS "lineEnd"
   FROM jsonb_to_recordset($1::jsonb) AS p("materialId" text,"docId" text,start integer,length integer)
   JOIN public.knowledge_doc d ON d.id=p."docId" ORDER BY p."materialId",p.start`,JSON.stringify(plans));
  return assemblePrivateMaterialPack(snapshot,metadata,plans,fragments);
 }
 return{
  prepareInTx:(tx,user,sessionId,refs)=>access.inTransaction(tx,user,sessionId,(db,current)=>prepareInTx(db,current,sessionId,refs)),
  prepare:(user,sessionId,refs)=>access.transaction(user,sessionId,(tx,current)=>prepareInTx(tx,current,sessionId,refs)),
  async assertCurrentInTx(tx,user,sessionId,pack){
   assertPrivateMaterialPack(pack);
   const current=await access.inTransaction(tx,user,sessionId,(db,actor)=>prepareInTx(db,actor,sessionId,pack.binding.materials.map(m=>({materialId:m.materialId,version:m.version}))));
   if(current.packHash!==pack.packHash)fail('HUB_PRIVATE_PACK_CHANGED');return true;
  },
  async assertCurrent(user,sessionId,pack){
   assertPrivateMaterialPack(pack);
   const current=await access.transaction(user,sessionId,(tx,actor)=>prepareInTx(tx,actor,sessionId,pack.binding.materials.map(m=>({materialId:m.materialId,version:m.version}))));
   if(current.packHash!==pack.packHash)fail('HUB_PRIVATE_PACK_CHANGED');return true;
  },
 };
}
