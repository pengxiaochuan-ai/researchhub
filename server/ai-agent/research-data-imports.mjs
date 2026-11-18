import {randomUUID,createHash} from 'node:crypto';import {materialDigest} from './session-material-contract.mjs';import {compileDataMapping,describeDataMapping} from './research-data-import-mapping.mjs';import {compileImportConfirmation} from './research-data-import-contract.mjs';
import {GENERAL_TABULAR_RULES,mappingDescription} from './research-data-tabular.mjs';
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function only(body,keys){if(!body||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k)))fail('DATA_IMPORT_INPUT_INVALID',400);}
const rowScope='tenant_id=$1 AND account_id=$2 AND session_id=$3';
/** The P04 caller already holds current source authority and the tenant lock.
 * Protect every dependent import of this private source, including another
 * round. Cancelling a preview is never a rollback of committed Study data. */
export async function assertSourcePreflightCancellableInTx(tx,user,sid,preflightId){
 const rows=await tx.$queryRawUnsafe(`SELECT state FROM rh_ai.research_data_imports WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND source_preflight_id=$4 AND source_study_group_id=$5 AND source_research_project_id=$6 AND state IN ('planned','committed') FOR SHARE`,user.tenantId,user.accountId,sid,preflightId,user.studyGroupId,user.researchProjectId);
 if(rows.some(r=>r.state==='committed'))fail('DATA_ALREADY_IMPORTED');
 if(rows.some(r=>r.state==='planned'))fail('DATA_IMPORT_PENDING');
}
/** Session-private adaptation; native Study transactions own every write. */
export function createResearchDataImports({studies,sourceAccess,authority,native,engine,storage,scopeKey,allowedStudyIds}){
 if(!id(scopeKey)||!Array.isArray(allowedStudyIds)||!allowedStudyIds.length)throw Error('DATA_IMPORT_SCOPE_REQUIRED');
 const targetOf=ctx=>({studyId:ctx.studyId,studyGroupId:ctx.studyGroupId,executionProjectId:ctx.executionProjectId,projectIntentId:ctx.projectIntentId});
 const setTarget=(tx,u,t)=>tx.$queryRawUnsafe(`SELECT set_config('app.study_group_id',$1,true),set_config('app.research_project_id',$2,true),set_config('app.account_id',$3,true)`,t.studyGroupId,t.executionProjectId,u.accountId);
 async function inSource(tx,user,sid,target,fn){try{return await sourceAccess.inTransaction(tx,user,sid,fn);}finally{await setTarget(tx,user,target);}}
 const run=(user,sid,studyId,fn)=>{
  if(!id(sid)||!allowedStudyIds.includes(studyId))fail('DATA_IMPORT_TARGET_UNAVAILABLE',403);
  return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
   const target=targetOf(ctx),current=await inSource(tx,user,sid,target,async(_tx,u)=>u),source={sessionId:sid,studyGroupId:current.studyGroupId,researchProjectId:current.researchProjectId};
   return fn(tx,current,target,source);
  });
 };
 const audit=async(tx,u,t,action,target)=>{const auditId='rh-audit-'+randomUUID();await tx.auditLog.create({data:{id:auditId,tenantId:u.tenantId,studyGroupId:t.studyGroupId,researchProjectId:t.executionProjectId,accountId:u.accountId,action:'researchhub.data.import.'+action,target,meta:{scopeKey}}});return auditId;};
 async function sourceInTx(tx,u,t,source,pid,version){
  return inSource(tx,u,source.sessionId,t,async()=>{
   const [p]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_preflights WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND id=$4 AND study_group_id=$5 AND research_project_id=$6`,u.tenantId,u.accountId,source.sessionId,pid,source.studyGroupId,source.researchProjectId);
   if(!p||p.state!=='previewed'||p.version!==version)fail('DATA_IMPORT_SOURCE_CHANGED');
   const files=[];let bytes=0;
   for(const ref of p.source_refs){
    const [file]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND account_id=$2 AND session_id=$3 AND id=$4 AND study_group_id=$5 AND research_project_id=$6`,u.tenantId,u.accountId,source.sessionId,ref.id,source.studyGroupId,source.researchProjectId);
    if(!file||file.state!=='ready'||file.version!==ref.version||file.source_sha256!==ref.sha256)fail('DATA_IMPORT_SOURCE_CHANGED');
    bytes+=file.byte_size;if(bytes>50*1024*1024)fail('DATA_IMPORT_CAPACITY',413);
    const buffer=await storage.getBuffer(file.storage_key,25*1024*1024);if(buffer.length!==file.byte_size||createHash('sha256').update(buffer).digest('hex')!==file.source_sha256)fail('DATA_IMPORT_SOURCE_CHANGED');
    files.push({fileId:file.id,filename:file.filename,buffer});
   }
   const preview=engine.preview({...u,sessionId:source.sessionId},{files,destinations:[],rulesVersion:p.result?.rulesVersion??'legacy.v1'});if(preview.previewHash!==p.preview_hash)fail('DATA_IMPORT_SOURCE_CHANGED');return{row:p,preview};
  });
 }
 async function prepareInTx(tx,u,t,source,preflightId,version,mapping,permissionRef,{allowChoices=false,mappingHash,requestKey}={}){
  const loaded=await sourceInTx(tx,u,t,source,preflightId,version),info=await native.targetInTx(tx,u,t);
  async function currentChoice(){
   const draft=describeDataMapping(loaded.preview,info.fields);
   if(!draft)return null;
   const current=await authority.currentInTx(tx,u,t,source,{scopeKey,capability:'visit.import'});return{draft,hash:materialDigest({previewHash:loaded.preview.previewHash,studyId:t.studyId,formHash:info.formHash,protocol:info.protocol,policy:info.policy,permissionRef:current.permissionRef,draft})};
  }
  if(allowChoices&&mapping!==undefined&&loaded.preview.rulesVersion===GENERAL_TABULAR_RULES){
   const choice=await currentChoice();
   if(choice){
    if(mappingHash!==choice.hash)fail('DATA_IMPORT_MAPPING_CHANGED');
    const {draft}=choice;
    const same=(a,b)=>a.fileId===b.fileId&&a.sheet===b.sheet&&a.column===b.column&&a.targetKey===b.targetKey;
    if(draft.automatic.some(a=>!mapping.some(m=>same(a,m)))||mapping.some(m=>!draft.automatic.some(a=>same(a,m))&&!draft.columns.some(c=>c.fileId===m.fileId&&c.sheet===m.sheet&&c.column===m.column&&c.targetKeys.includes(m.targetKey))))fail('DATA_IMPORT_MAPPING_REQUIRED');
   }else if(mappingHash!==undefined)fail('DATA_IMPORT_MAPPING_CHANGED');
  }
  let mapped;
  try{mapped=compileDataMapping(loaded.preview,info.fields,mapping,{studyId:t.studyId});}
  catch(e){
   if(!allowChoices||mapping!==undefined||e.code!=='DATA_IMPORT_MAPPING_REQUIRED')throw e;
   const choice=await currentChoice();if(!choice)throw e;
   const [title]=await tx.$queryRawUnsafe('SELECT title FROM rh_research.project_intent WHERE tenant_id=$1 AND id=$2',u.tenantId,t.projectIntentId);
   return{choice:{state:'mapping_required',confirmationReady:false,requestKey,preflight:{id:preflightId,version},study:{id:t.studyId,name:title?.title??'当前研究'},mapping:{schema:'hub-data-mapping-choice.v1',hash:choice.hash,...choice.draft}}};
  }
  const options={scopeKey,info,sourceHash:materialDigest(loaded.row.source_refs),...(permissionRef?{permissionRef}:{})};
  const prepared=await native.prepareInTx(tx,u,t,source,options,mapped),target={tenantId:u.tenantId,...t};
  if(mapped.mode==='visit_form')Object.assign(target,{protocolVersionId:info.protocol.id,protocolVersionNumber:info.protocol.versionNumber,protocolStatus:info.protocol.status,policyVersionId:info.policy.id,policyHash:info.policy.contentHash,formVersionId:info.form.id,formStatus:info.form.status,formHash:info.formHash,requiredFormVersionId:info.form.id});
  const p=loaded.row,snapshot=compileImportConfirmation({mode:mapped.mode,source:{tenantId:u.tenantId,accountId:u.accountId,authVersion:u.authVersion,sessionId:source.sessionId,studyGroupId:source.studyGroupId,researchProjectId:source.researchProjectId,preflightId:p.id,version:p.version,state:p.state,previewHash:p.preview_hash,files:p.source_refs},target,targetManifestHash:materialDigest(prepared.manifest),mapping:mapped.mapping,permissionRef:prepared.current.permissionRef});
  return{snapshot,prepared,mapped,options};
 }
 async function view(tx,u,t,source,row){
  await authority.currentInTx(tx,u,t,source,{scopeKey,capability:row.state==='committed'?'result.read':row.snapshot.mode==='subjects'?'profile.create':'visit.import'});
  if(row.receipt){
   for(const ref of row.receipt.subjects){const subject=await tx.subject.findFirst({where:{tenantId:u.tenantId,studyGroupId:t.studyGroupId,researchProjectId:t.executionProjectId,id:ref.id,subjectId:ref.subjectCode,createdBy:u.accountId,deletedAt:null,acceptanceFixture:false},select:{id:true}});if(!subject)fail('DATA_IMPORT_RESULT_RESTRICTED',403);}
   for(const ref of row.receipt.visits){
    const records=await tx.$queryRawUnsafe(`SELECT rev.id FROM public.form_response_revision rev JOIN public.form_response r ON r.id=rev."responseId" JOIN public.form_assignment a ON a.id=r."assignmentId" JOIN public.subject_visit v ON v.id=a."subjectVisitId" WHERE a.id=$1 AND a."tenantId"=$2 AND a."studyGroupId"=$3 AND a."researchProjectId"=$4 AND a."createdBy"=$5 AND a."subjectId"=$6 AND v.id=$7 AND v."subjectId"=a."subjectId" AND v."enrollmentId"=a."enrollmentId" AND rev."revisionNo"=$8 AND rev."contentHash"=$9 AND r.id=$10`,ref.assignmentId,u.tenantId,t.studyGroupId,t.executionProjectId,u.accountId,ref.subjectId,ref.id,ref.ref.revisionNo,ref.ref.contentHash,ref.ref.responseId);if(records.length!==1)fail('DATA_IMPORT_RESULT_RESTRICTED',403);
   }
  }
  const [name]=await tx.$queryRawUnsafe(`SELECT title FROM rh_research.project_intent WHERE tenant_id=$1 AND id=$2`,u.tenantId,t.projectIntentId);
  const [p]=await inSource(tx,u,source.sessionId,t,()=>tx.$queryRawUnsafe(`SELECT result FROM rh_ai.research_data_preflights WHERE id=$1 AND tenant_id=$2 AND account_id=$3 AND session_id=$4`,row.source_preflight_id,u.tenantId,u.accountId,source.sessionId));
  const unmapped=(p?.result?.files??[]).flatMap(f=>(f.fields??[]).filter(h=>!row.snapshot.mapping.some(m=>m.fileId===f.fileId&&m.sheet===h.sheet&&m.column===h.column)).map(h=>h.name));
  let transforms;
  if(p?.result?.rulesVersion===GENERAL_TABULAR_RULES){const info=await native.targetInTx(tx,u,t);if(row.snapshot.mode==='visit_form'&&info.formHash!==row.snapshot.target.formHash)fail('DATA_IMPORT_FORM_CHANGED');transforms=row.snapshot.mapping.flatMap(m=>{const field=info.fields.find(f=>f.key===m.targetKey),header=p.result.files.find(f=>f.fileId===m.fileId)?.fields.find(h=>h.sheet===m.sheet&&h.column===m.column);return field&&header?[{fileId:m.fileId,sheet:m.sheet,column:m.column,...mappingDescription(header.name,field,info.fields)}]:[];});}
  return{id:row.id,requestKey:row.request_key,version:row.version,hash:row.confirmation_hash,state:row.state,confirmationReady:row.state==='planned',preflight:{id:row.source_preflight_id,version:row.source_preflight_version},study:{id:t.studyId,name:name?.title??'当前研究',protocolVersion:row.snapshot.target.protocolVersionNumber??null},mode:row.snapshot.mode,summary:{subjects:new Set(row.target_manifest.map(r=>r.subjectCode)).size,visits:row.snapshot.mode==='visit_form'?row.target_manifest.length:0,fields:[...new Set(transforms?transforms.map(m=>m.targetLabel+(m.targetDisambiguator?' · '+m.targetDisambiguator:'')):row.snapshot.mapping.map(m=>m.targetKey).filter(k=>!['subjectCode','visitCode'].includes(k)))],unmapped,...(transforms?{transforms}:{})},...(row.receipt?{receipt:row.receipt}:{})};
 }
 async function meta(user,sid,{planId,key,preflightId}={}){return sourceAccess.transaction(user,sid,async tx=>{const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_imports WHERE ${rowScope} AND scope_key=$4${planId?' AND id=$5':key?' AND request_key=$5':preflightId?' AND source_preflight_id=$5':''} ORDER BY created_at DESC,id DESC LIMIT 1`,user.tenantId,user.accountId,sid,scopeKey,...(planId?[planId]:key?[key]:preflightId?[preflightId]:[]));return row??null;});}
 async function getInTx(tx,u,t,source,{planId,key,lock=false}){const [row]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_imports WHERE ${rowScope} AND scope_key=$4 AND study_id=$5 AND ${planId?'id':'request_key'}=$6${lock?' FOR UPDATE':''}`,u.tenantId,u.accountId,source.sessionId,scopeKey,t.studyId,planId??key);if(!row||row.study_group_id!==t.studyGroupId||row.research_project_id!==t.executionProjectId||row.source_study_group_id!==source.studyGroupId||row.source_research_project_id!==source.researchProjectId)fail('DATA_IMPORT_NOT_FOUND',404);return row;}
 async function read(user,sid,query){const old=await meta(user,sid,query);if(!old)return null;return run(user,sid,old.study_id,async(tx,u,t,source)=>{const row=await getInTx(tx,u,t,source,{planId:old.id});await sourceInTx(tx,u,t,source,row.source_preflight_id,row.source_preflight_version);return view(tx,u,t,source,row);});}
 return{
  async targets(user,sid){const items=[];for(const studyId of allowedStudyIds){try{const value=await run(user,sid,studyId,async(tx,u,t,source)=>{await authority.currentInTx(tx,u,t,source,{scopeKey,capability:'profile.create'});const info=await native.targetInTx(tx,u,t),[title]=await tx.$queryRawUnsafe('SELECT title FROM rh_research.project_intent WHERE tenant_id=$1 AND id=$2',u.tenantId,t.projectIntentId);return{id:studyId,name:title?.title??'当前研究',protocolVersion:info.protocol.versionNumber};});items.push(value);}catch(e){if((e.status??e.getStatus?.())!==403&&e.status!==404)throw e;}}return{items};},
  prepare(user,sid,body){
   only(body,['requestKey','studyId','preflightId','preflightVersion','mapping','mappingHash']);if(!id(body.requestKey)||!id(body.studyId)||!id(body.preflightId)||!Number.isSafeInteger(body.preflightVersion)||body.preflightVersion<1||body.mapping!==undefined&&(!Array.isArray(body.mapping)||!body.mapping.length||body.mapping.length>10000||body.mapping.some(m=>!m||typeof m!=='object'||Object.keys(m).sort().join(',')!=='column,fileId,sheet,targetKey'||!id(m.fileId)||typeof m.sheet!=='string'||!m.sheet.trim()||!Number.isSafeInteger(m.column)||m.column<1||m.column>100||!id(m.targetKey)))||body.mappingHash!==undefined&&(!hash(body.mappingHash)||!Array.isArray(body.mapping)))fail('DATA_IMPORT_INPUT_INVALID',400);
   return run(user,sid,body.studyId,async(tx,u,t,source)=>{
    const [saved]=await tx.$queryRawUnsafe(`SELECT * FROM rh_ai.research_data_imports WHERE ${rowScope} AND request_key=$4`,u.tenantId,u.accountId,sid,body.requestKey);
    if(saved){if(saved.study_id!==t.studyId||saved.source_preflight_id!==body.preflightId||saved.source_preflight_version!==body.preflightVersion||body.mapping&&materialDigest([...body.mapping].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))!==materialDigest([...saved.snapshot.mapping].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))))fail('DATA_IMPORT_REQUEST_CONFLICT');await sourceInTx(tx,u,t,source,saved.source_preflight_id,saved.source_preflight_version);return view(tx,u,t,source,saved);}
    const result=await prepareInTx(tx,u,t,source,body.preflightId,body.preflightVersion,body.mapping,undefined,{allowChoices:true,mappingHash:body.mappingHash,requestKey:body.requestKey});if(result.choice)return result.choice;
    const {snapshot,prepared}=result,planId='rh-import-'+randomUUID(),auditId=await audit(tx,u,t,'planned',planId);
    const [row]=await tx.$queryRawUnsafe(`INSERT INTO rh_ai.research_data_imports(id,tenant_id,account_id,session_id,source_study_group_id,source_research_project_id,study_id,study_group_id,research_project_id,scope_key,source_preflight_id,source_preflight_version,request_key,confirmation_hash,snapshot,target_manifest,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17) RETURNING *`,planId,u.tenantId,u.accountId,sid,source.studyGroupId,source.researchProjectId,t.studyId,t.studyGroupId,t.executionProjectId,scopeKey,body.preflightId,body.preflightVersion,body.requestKey,snapshot.hash,JSON.stringify(snapshot),JSON.stringify(prepared.manifest),auditId);
    return view(tx,u,t,source,row);
   });
  },
  async get(user,sid,planId){if(!id(planId))fail('DATA_IMPORT_INPUT_INVALID',400);const row=await read(user,sid,{planId});if(!row)fail('DATA_IMPORT_NOT_FOUND',404);return row;},
  async analysis(user,sid,planId){
   if(!id(planId))fail('DATA_IMPORT_INPUT_INVALID',400);const old=await meta(user,sid,{planId});if(!old)fail('DATA_IMPORT_NOT_FOUND',404);
   return run(user,sid,old.study_id,async(tx,u,t,source)=>{const row=await getInTx(tx,u,t,source,{planId:old.id});if(row.state!=='committed'||!row.receipt)fail('DATA_ANALYSIS_NOT_IMPORTED');const loaded=await sourceInTx(tx,u,t,source,row.source_preflight_id,row.source_preflight_version),item=await view(tx,u,t,source,row);return native.analysisInTx(tx,u,t,source,row,item,loaded);});
  },
  current:async(user,sid)=>{
   // Current means the current P04 batch, not the last operation on any older
   // batch. An older receipt still remains available by its original key.
   const preflight=await sourceAccess.transaction(user,sid,async tx=>(await tx.$queryRawUnsafe(`SELECT id FROM rh_ai.research_data_preflights WHERE ${rowScope} ORDER BY created_at DESC,id DESC LIMIT 1`,user.tenantId,user.accountId,sid))[0]);
   return{item:preflight?await read(user,sid,{preflightId:preflight.id}):null};
  },
  receipt:async(user,sid,key)=>{if(!id(key))fail('DATA_IMPORT_INPUT_INVALID',400);const item=await read(user,sid,{key});return{found:Boolean(item),item};},
  async confirm(user,sid,planId,body){
   only(body,['version','hash']);if(!id(planId)||!Number.isSafeInteger(body.version)||body.version<1||!hash(body.hash))fail('DATA_IMPORT_INPUT_INVALID',400);const old=await meta(user,sid,{planId});if(!old)fail('DATA_IMPORT_NOT_FOUND',404);
   return run(user,sid,old.study_id,async(tx,u,t,source)=>{
    const row=await getInTx(tx,u,t,source,{planId,lock:true});if(row.confirmation_hash!==body.hash)fail('DATA_IMPORT_CONFIRMATION_CHANGED');
    if(row.state==='committed'&&row.version===body.version+1){await sourceInTx(tx,u,t,source,row.source_preflight_id,row.source_preflight_version);return view(tx,u,t,source,row);}
    if(row.state!=='planned'||row.version!==body.version)fail('DATA_IMPORT_CONFIRMATION_CHANGED');
    const prepared=await prepareInTx(tx,u,t,source,row.source_preflight_id,row.source_preflight_version,row.snapshot.mapping,row.snapshot.permissionRef);
    if(prepared.snapshot.hash!==row.confirmation_hash||materialDigest(prepared.prepared.manifest)!==row.snapshot.targetManifestHash)fail('DATA_IMPORT_CONFIRMATION_CHANGED');
    const result=await native.commitInTx(tx,u,t,source,prepared.options,prepared.mapped,prepared.prepared,row.request_key),receipt={schema:'hub-data-import-receipt.v1',confirmationHash:row.confirmation_hash,studyId:t.studyId,...result},auditId=await audit(tx,u,t,'committed',row.id);
    const [saved]=await tx.$queryRawUnsafe(`UPDATE rh_ai.research_data_imports SET state='committed',version=version+1,receipt=$1::jsonb,audit_id=$2 WHERE id=$3 AND version=$4 AND state='planned' RETURNING *`,JSON.stringify(receipt),auditId,row.id,row.version);if(!saved)fail('DATA_IMPORT_CONFIRMATION_CHANGED');return view(tx,u,t,source,saved);
   });
  },
  async cancel(user,sid,planId,body){only(body,['version']);if(!id(planId)||!Number.isSafeInteger(body.version)||body.version<1)fail('DATA_IMPORT_INPUT_INVALID',400);const old=await meta(user,sid,{planId});if(!old)fail('DATA_IMPORT_NOT_FOUND',404);return run(user,sid,old.study_id,async(tx,u,t,source)=>{const row=await getInTx(tx,u,t,source,{planId,lock:true});if(row.state==='cancelled'&&row.version===body.version+1)return view(tx,u,t,source,row);if(row.state!=='planned'||row.version!==body.version)fail('DATA_IMPORT_CONFIRMATION_CHANGED');const auditId=await audit(tx,u,t,'cancelled',row.id),[updated]=await tx.$queryRawUnsafe(`UPDATE rh_ai.research_data_imports SET state='cancelled',version=version+1,audit_id=$1 WHERE id=$2 AND version=$3 RETURNING *`,auditId,row.id,row.version);return view(tx,u,t,source,updated);});},
 };
}
