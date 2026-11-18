import {createHash,randomUUID} from 'node:crypto';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
export const MATERIAL_MAX_BYTES=100*1024*1024;
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
// P02 cannot yet execute a fixed-material question. Fail before enqueue/billing
// rather than silently sending the same question to the old no-file branch.
export async function assertNoLegacyMaterialQuestion(tx,user,sessionId){
  await tx.$queryRawUnsafe(`SELECT set_config('app.account_id',$1,true)`,user.accountId);
  const found=await tx.$queryRawUnsafe(`SELECT id FROM rh_ai.session_materials WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5 AND deleted_at IS NULL LIMIT 1 FOR SHARE`,user.tenantId,user.studyGroupId,user.researchProjectId,user.accountId,sessionId);
  if(found.length)throw Object.assign(Error('资料提问暂不可用。可在知识资料查看，或新建无附件会话提问。'),{code:'HUB_MATERIAL_ANALYSIS_UNAVAILABLE',status:409,publicMessage:'资料提问暂不可用。可在知识资料查看，或新建无附件会话提问。'});
}
export function materialUploadIdentity(inspected,size){
  if(!['pdf','docx','txt','md'].includes(inspected?.extension))fail('HUB_MATERIAL_FORMAT_UNAVAILABLE',400);
  if(!Number.isSafeInteger(size)||size<1||size>MATERIAL_MAX_BYTES||!/^[a-f0-9]{64}$/.test(inspected.sha256??''))fail('HUB_MATERIAL_FILE_INVALID',400);
  return createHash('sha256').update(JSON.stringify({purpose:'knowledge',sha256:inspected.sha256,size,extension:inspected.extension,contentType:inspected.contentType})).digest('hex');
}
export function projectSessionMaterial(row,{source,task,doc}){
  const removed=row.deleted_at!==null;
  const missing=row.source_file_id&&(!source||!task);
  const state=removed?'removed':missing?'failed':row.state;
  const unavailable=removed||state==='failed';
  const decisionRequired=state==='blocked'&&task?.status==='blocked'&&task.errorCode==='DIRECT_IDENTIFIER_CONFIRMATION_REQUIRED';
  const reviewDoc=state==='blocked'&&task?.status==='complete'&&doc?.id&&source?.docId===doc.id&&task.docId===doc.id&&doc.kbId===row.kb_id&&doc.trashedAt===null?doc.id:null;
  return {id:row.id,version:row.version,state,stage:removed?'removed':unavailable?'unavailable':task?.stage??'uploaded',
    name:unavailable?'资料不可用':doc?.title||source?.filename||'上传资料',progress:unavailable?0:Math.min(100,Math.max(0,Number(task?.progress??0))),
    kbId:unavailable?null:row.kb_id,docId:state==='ready'?row.doc_id:reviewDoc,available:state==='ready',createdAt:row.created_at.toISOString(),
    ...(state==='blocked'?{decisionRequired,importTaskId:decisionRequired?row.import_task_id:null,canReviewDoc:Boolean(reviewDoc)}:{})};
}

// access.transaction authenticates the current account and session, then sets
// account/scope GUCs. Native import services stay behind createOperations.
export function createSessionMaterials({access,inspectFile,createOperations,startImport}){
  async function facts(tx,row){
    const [base,source,task,doc]=await Promise.all([
      row.kb_id?tx.knowledgeBase.findUnique({where:{id:row.kb_id}}):null,
      row.source_file_id?tx.knowledgeSourceFile.findUnique({where:{id:row.source_file_id}}):null,
      row.import_task_id?tx.knowledgeImportTask.findUnique({where:{id:row.import_task_id}}):null,
      row.doc_id?tx.knowledgeDoc.findUnique({where:{id:row.doc_id}}):null,
    ]);
    return {base,source,task,doc};
  }
  async function refresh(tx,row){
    let current=await facts(tx,row);
    if(row.deleted_at!==null||row.state==='failed')return projectSessionMaterial(row,current);
    const {base,source,task}=current;
    const valid=base?.visibility==='private'&&base.ownerAccountId===row.account_id&&base.tenantId===row.tenant_id&&base.studyGroupId===row.study_group_id&&base.researchProjectId===row.research_project_id&&
      source?.kbId===row.kb_id&&source.tenantId===row.tenant_id&&source.studyGroupId===row.study_group_id&&source.createdBy===row.account_id&&source.sha256===row.source_sha256&&
      task?.sourceFileId===row.source_file_id&&task.kbId===row.kb_id&&task.tenantId===row.tenant_id&&task.studyGroupId===row.study_group_id&&task.createdBy===row.account_id;
    let target=!valid||task?.status==='failed'?'failed':task?.status==='blocked'?'blocked':null;
    let document=null,contentHash=null;
    if(valid&&task.status==='complete'){
      document=task.docId?await tx.knowledgeDoc.findUnique({where:{id:task.docId}}):null;
      if(document&&source.docId===document.id&&document.kbId===row.kb_id&&document.tenantId===row.tenant_id&&document.studyGroupId===row.study_group_id&&document.trashedAt===null&&['draft','published'].includes(document.status)){
        current={...current,doc:document};
        contentHash=createHash('sha256').update(document.contentMd).digest('hex');
        target=task.safetyLevel==='allow'&&document.safetyLevel==='allow'?'ready':'blocked';
      }else target='failed';
    }else if(valid&&row.state==='blocked'&&['queued','processing'].includes(task.status))target='importing';
    if(row.state==='ready'&&(!document||document.id!==row.doc_id||document.version!==row.doc_version||contentHash!==row.content_sha256||target!=='ready'))target='failed';
    if(target==='ready'&&row.state==='blocked'){
      const resumed=await tx.$queryRawUnsafe(`UPDATE rh_ai.session_materials SET state='importing',version=version+1 WHERE id=$1 AND version=$2 RETURNING *`,row.id,row.version);
      if(resumed.length!==1)fail('HUB_MATERIAL_VERSION_CONFLICT');row=resumed[0];
    }
    if(target&&target!==row.state){
      if(target==='ready'){
        const updated=await tx.$queryRawUnsafe(`UPDATE rh_ai.session_materials SET state='ready',doc_id=$1,doc_version=$2,content_sha256=$3,version=version+1 WHERE id=$4 AND version=$5 RETURNING *`,document.id,document.version,contentHash,row.id,row.version);
        if(updated.length!==1)fail('HUB_MATERIAL_VERSION_CONFLICT');row=updated[0];current={...current,doc:document};
      }else{
        const updated=await tx.$queryRawUnsafe(`UPDATE rh_ai.session_materials SET state=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING *`,target,row.id,row.version);
        if(updated.length!==1)fail('HUB_MATERIAL_VERSION_CONFLICT');row=updated[0];
      }
    }
    return projectSessionMaterial(row,current);
  }
  async function ownRow(tx,sessionId,requestKey){
    const rows=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_materials WHERE session_id=$1 AND request_key=$2 FOR UPDATE`,sessionId,requestKey);
    return rows[0]??null;
  }
  return {
    // Internal only: caller already owns current access and the enclosing tx.
    refreshInTx:refresh,
    async upload(user,sessionId,{requestKey,file}){
      if(!id(sessionId)||!id(requestKey)||!file?.path)fail('HUB_MATERIAL_INPUT_INVALID',400);
      await access.transaction(user,sessionId,async()=>undefined);
      const inspected=await inspectFile({path:file.path,filename:file.originalname,declaredMimetype:file.mimetype,size:file.size});
      const fingerprint=materialUploadIdentity(inspected,file.size);
      const result=await access.transaction(user,sessionId,async(tx,current)=>{
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','hub-material:'+current.accountId+':'+sessionId+':'+requestKey);
        const existing=await ownRow(tx,sessionId,requestKey);
        if(existing){if(existing.request_fingerprint!==fingerprint)fail('HUB_MATERIAL_REQUEST_CONFLICT');return {item:await refresh(tx,existing),taskId:null};}
        const materialId='rh-material-'+randomUUID();
        await tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_materials(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,request_fingerprint,source_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,materialId,current.tenantId,current.studyGroupId,current.researchProjectId,current.accountId,sessionId,requestKey,fingerprint,inspected.sha256);
        const ops=createOperations(tx,current);
        const base=await ops.privateBase();
        const queued=await ops.enqueue(base.id,file);
        const task=await tx.knowledgeImportTask.findUnique({where:{id:queued.taskId}});
        if(!task)fail('HUB_MATERIAL_IMPORT_UNAVAILABLE');
        const rows=await tx.$queryRawUnsafe(`UPDATE rh_ai.session_materials SET state='importing',kb_id=$1,source_file_id=$2,import_task_id=$3,version=version+1 WHERE id=$4 AND version=1 RETURNING *`,base.id,task.sourceFileId,task.id,materialId);
        if(rows.length!==1)fail('HUB_MATERIAL_VERSION_CONFLICT');
        return {item:await refresh(tx,rows[0]),taskId:task.id};
      });
      if(result.taskId)startImport({user,sessionId,materialId:result.item.id,taskId:result.taskId});
      return result.item;
    },
    async receipt(user,sessionId,requestKey){
      if(!id(sessionId)||!id(requestKey))fail('HUB_MATERIAL_INPUT_INVALID',400);
      return access.transaction(user,sessionId,async tx=>{const row=await ownRow(tx,sessionId,requestKey);return row?{found:true,item:await refresh(tx,row)}:{found:false};});
    },
    async list(user,sessionId,{limit=20,cursor}={}){
      if(!id(sessionId)||!Number.isSafeInteger(Number(limit))||Number(limit)<1||Number(limit)>50||cursor!==undefined&&!id(cursor))fail('HUB_MATERIAL_INPUT_INVALID',400);
      return access.transaction(user,sessionId,async tx=>{
        let before=null;if(cursor){before=(await tx.$queryRawUnsafe('SELECT created_at,id FROM rh_ai.session_materials WHERE id=$1 AND session_id=$2',cursor,sessionId))[0];if(!before)fail('HUB_MATERIAL_CURSOR_INVALID',400);}
        const rows=before?await tx.$queryRawUnsafe('SELECT * FROM rh_ai.session_materials WHERE session_id=$1 AND (created_at,id)<($2,$3) ORDER BY created_at DESC,id DESC LIMIT $4 FOR UPDATE',sessionId,before.created_at,before.id,Number(limit)+1):await tx.$queryRawUnsafe('SELECT * FROM rh_ai.session_materials WHERE session_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 FOR UPDATE',sessionId,Number(limit)+1);
        const selected=rows.slice(0,Number(limit)),items=[];for(const row of selected)items.push(await refresh(tx,row));
        return {items,nextCursor:rows.length>Number(limit)?selected.at(-1).id:null};
      });
    },
  };
}
