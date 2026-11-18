import {materialDigest as hash} from './session-material-contract.mjs';
const scope=['tenantId','accountId','studyGroupId','researchProjectId'];
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fail=(code,message='本次资料已变化，请核对后重新发送问题。',status=409)=>{throw Object.assign(Error(code),{code,publicMessage:message,status});};
export function freezeMaterialSelection(user,sessionId,rows){
 if(!scope.every(k=>id(user?.[k]))||!id(sessionId)||!Array.isArray(rows))fail('HUB_PRIVATE_SELECTION_INVALID');
 const materials=[];
 for(const r of rows){
  if(r.tenant_id!==user.tenantId||r.account_id!==user.accountId||r.study_group_id!==user.studyGroupId||r.research_project_id!==user.researchProjectId||r.session_id!==sessionId)fail('HUB_PRIVATE_SELECTION_INVALID');
  if(r.deleted_at!==null||!['staged','importing','ready'].includes(r.state))continue;
  if(![r.id,r.kb_id,r.source_file_id,r.import_task_id].every(id)||!sha(r.source_sha256)||!Number.isSafeInteger(r.version)||r.version<1||r.purpose!=='knowledge')fail('HUB_PRIVATE_SELECTION_INVALID');
  if(r.state==='ready'&&(!id(r.doc_id)||!Number.isSafeInteger(r.doc_version)||r.doc_version<1||!sha(r.content_sha256)))fail('HUB_PRIVATE_SELECTION_INVALID');
  materials.push({materialId:r.id,version:r.version,kbId:r.kb_id,sourceFileId:r.source_file_id,importTaskId:r.import_task_id,sourceSha256:r.source_sha256,
   docId:r.state==='ready'?r.doc_id:null,docVersion:r.state==='ready'?r.doc_version:null,contentSha256:r.state==='ready'?r.content_sha256:null});
 }
 if(materials.length>20)fail('HUB_PRIVATE_SELECTION_LIMIT','本会话可用资料超过20份，请在新会话按批次上传后提问。');
 if(rows.some(r=>r.deleted_at===null)&&!materials.length)fail('HUB_PRIVATE_NO_USABLE_MATERIAL','本会话暂无可供分析的资料，请先核对资料状态。');
 materials.sort((a,b)=>a.materialId.localeCompare(b.materialId,'en'));
 const body={schema:'hub-private-selection.v1',principal:Object.fromEntries(scope.map(k=>[k,user[k]])),sessionId,materials};
 return {...body,hash:hash(body)};
}
export function assertMaterialSelection(value,user,sessionId){
 if(value?.schema!=='hub-private-selection.v1')fail('HUB_PRIVATE_SELECTION_CHANGED');
 const {hash:digest,...body}=value;
 if(hash(body)!==digest||value.sessionId!==sessionId||!scope.every(k=>value.principal?.[k]===user?.[k])||!Array.isArray(value.materials)||value.materials.length>20)fail('HUB_PRIVATE_SELECTION_CHANGED');
 return value;
}

// Only trusted server-side command admission creates this selection. A client
// cannot supply source paths, facts, an evidence pack, or a different upload set.
export function createPrivateMaterialSelection({access,refreshInTx,reader}){
 const currentRows=async(tx,user,sid,ids)=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.account_id',$1,true)`,user.accountId);
  return tx.$queryRawUnsafe(`SELECT * FROM rh_ai.session_materials WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5 ${ids?'AND id=ANY($6::text[])':''} ORDER BY id FOR UPDATE`,user.tenantId,user.studyGroupId,user.researchProjectId,user.accountId,sid,...(ids?[ids]:[]));
 };
 return {
  async captureInTx(tx,user,sid){
   const rows=await currentRows(tx,user,sid);
   if(!rows.some(r=>r.deleted_at===null))return freezeMaterialSelection(user,sid,[]);
   return access.inTransaction(tx,user,sid,async(db,actor)=>{
    for(const r of rows)await refreshInTx(db,r);
    return freezeMaterialSelection(actor,sid,await currentRows(db,actor,sid));
   });
  },
  async prepareInTx(tx,user,sid,selection){
   assertMaterialSelection(selection,user,sid);if(!selection.materials.length)return null;
   return access.inTransaction(tx,user,sid,async(db,actor)=>{
    let rows=await currentRows(db,actor,sid,selection.materials.map(m=>m.materialId));
    if(rows.length!==selection.materials.length)fail('HUB_PRIVATE_SOURCE_CHANGED');
    for(const r of rows)await refreshInTx(db,r);
    rows=await currentRows(db,actor,sid,selection.materials.map(m=>m.materialId));
    let pending=false;const refs=[];
    for(const m of selection.materials){
     const r=rows.find(r=>r.id===m.materialId);
     if(!r||r.deleted_at!==null||r.kb_id!==m.kbId||r.source_file_id!==m.sourceFileId||r.import_task_id!==m.importTaskId||r.source_sha256!==m.sourceSha256||r.version<m.version)fail('HUB_PRIVATE_SOURCE_CHANGED');
     if(['staged','importing'].includes(r.state)){if(m.docId)fail('HUB_PRIVATE_SOURCE_CHANGED');pending=true;continue;}
     if(r.state!=='ready'||m.docId&&(r.version!==m.version||r.doc_id!==m.docId||r.doc_version!==m.docVersion||r.content_sha256!==m.contentSha256))fail('HUB_PRIVATE_SOURCE_CHANGED');
     refs.push({materialId:r.id,version:r.version});
    }
    if(pending)fail('HUB_PRIVATE_MATERIAL_PARSING','资料正在解析，完成后将自动执行本条问题。');
    return reader.prepareInTx(db,actor,sid,refs);
   });
  },
 };
}
