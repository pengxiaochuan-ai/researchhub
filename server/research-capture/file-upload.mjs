import {createHash} from 'node:crypto';
import {invalid,only,researchError,validateMutation} from '../research-studies/contract.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),scope=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const MAX_BYTES=128*1024;
function input(body){only(body,['requestKey','filename','modality','contentBase64']);validateMutation(body);if(typeof body.filename!=='string'||!/^[-A-Za-z0-9_]{1,80}\.(csv|json)$/i.test(body.filename)||typeof body.modality!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(body.modality)||typeof body.contentBase64!=='string'||body.contentBase64.length>Math.ceil(MAX_BYTES/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.contentBase64))invalid();const buffer=Buffer.from(body.contentBase64,'base64');if(!buffer.length||buffer.length>MAX_BYTES||buffer.toString('base64')!==body.contentBase64)invalid();return buffer;}
async function objectIntegrity(storage,key,expected){
 if(!key||typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected))return {status:'unknown'};
 let stream,timer,expired=false;try{
  const pending=Promise.resolve(storage.getStream(key));pending.then(value=>{if(expired)value.destroy();}).catch(()=>{});
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;stream?.destroy(new Error('object read timeout'));reject(Error('object read timeout'));},5000);});
  stream=await Promise.race([pending,timeout]);const read=(async()=>{const hash=createHash('sha256');let bytes=0;for await(const chunk of stream){bytes+=chunk.length;if(bytes>MAX_BYTES){stream.destroy();return {status:'unknown'};}hash.update(chunk);}return {status:hash.digest('hex')===expected?'verified':'mismatch'};})();return await Promise.race([read,timeout]);
 }catch{return {status:'unknown'};}finally{clearTimeout(timer);}
}
export function createVisitFileUploadService({studies,core,storage}){
 async function binding(user,studyId,visitId,callback){if(!id(visitId))invalid();return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
  const s=scope(ctx);await core.readVisit(tx,user,s,visitId);await core.authorizeUpload(tx,user,s);
  const visit=await tx.subjectVisit.findFirst({where:{...s,id:visitId,acceptanceFixture:false,subject:{...s,acceptanceFixture:false,deletedAt:null}},select:{id:true,subjectId:true,enrollmentId:true,protocolVersionId:true,subject:{select:{subjectId:true}}}});if(!visit)throw researchError(404,'VISIT_NOT_FOUND','访视不可用。');
  const enrollment=await tx.studyEnrollment.findFirst({where:{...s,id:visit.enrollmentId,subjectId:visit.subjectId,acceptanceFixture:false},select:{id:true,subjectId:true,protocolVersionId:true,status:true}});if(!enrollment||enrollment.protocolVersionId!==visit.protocolVersionId)throw researchError(409,'FILE_BINDING_CHANGED','访视来源已变化，请重新核对。');
  await core.lockBinding(tx,s,{subjectId:visit.subjectId,enrollmentId:visit.enrollmentId,subjectVisitId:visit.id,expectedEnrollment:enrollment,requireCurrentConsent:true});
  return callback(tx,s,visit);
 });}
 async function verify(user,studyId,visitId,value,mark=false){return binding(user,studyId,visitId,async(tx,s,visit)=>{
  const file=await tx.modalityFile.findFirst({where:{tenantId:s.tenantId,id:value.fileId,subjectId:visit.subjectId,subjectVisitId:visitId,deletedAt:null},select:{id:true,storageKey:true,meta:true}});if(!file)throw researchError(409,'FILE_SOURCE_CHANGED','文件来源已变化，请重新核对。');
  if(mark)await tx.$queryRaw`SELECT id FROM public.modality_file WHERE "tenantId"=${s.tenantId} AND id=${file.id} FOR UPDATE`;else await tx.$queryRaw`SELECT id FROM public.modality_file WHERE "tenantId"=${s.tenantId} AND id=${file.id} FOR SHARE`;
  const locked=await tx.modalityFile.findFirst({where:{tenantId:s.tenantId,id:file.id,subjectId:visit.subjectId,subjectVisitId:visitId,deletedAt:null},select:{id:true,storageKey:true,meta:true}});if(!locked)throw researchError(409,'FILE_SOURCE_CHANGED','文件来源已变化，请重新核对。');
  const digest=locked.meta?.sha256,storageIntegrity=typeof value.sourceSha256==='string'&&digest!==value.sourceSha256?{status:'mismatch'}:await objectIntegrity(storage,locked.storageKey,value.sourceSha256);
  if(mark&&storageIntegrity.status==='verified'&&locked.meta?.storageVerifiedSha256!==digest){const verifiedAt=new Date().toISOString();await tx.modalityFile.update({where:{id:locked.id},data:{meta:{...locked.meta,storageVerifiedSha256:digest,storageVerifiedAt:verifiedAt}}});await tx.auditLog.create({data:{...s,accountId:user.accountId,action:'researchhub.file.storage_verify',target:locked.id,meta:{visitId,requestKey:value.receipt?.requestKey??null,sha256:digest,verifiedAt}}});}
  if(mark&&storageIntegrity.status==='mismatch'&&locked.meta?.storageVerifiedSha256){const {storageVerifiedSha256,storageVerifiedAt,...meta}=locked.meta;await tx.modalityFile.update({where:{id:locked.id},data:{meta}});await tx.auditLog.create({data:{...s,accountId:user.accountId,action:'researchhub.file.storage_verification_invalidated',target:locked.id,meta:{visitId,requestKey:value.receipt?.requestKey??null,sha256:digest}}});}
  let recorded=locked.meta?.storageVerifiedSha256===digest&&typeof digest==='string';
  if(mark&&storageIntegrity.status==='verified')recorded=true;
  if(mark&&storageIntegrity.status==='mismatch')recorded=false;
  return {...value,storageIntegrity:{...storageIntegrity,recorded}};
 });}
 async function savedReceipt(user,studyId,visitId,key){validateMutation({requestKey:key});return binding(user,studyId,visitId,async(tx,s,visit)=>{
   const [saved]=await tx.$queryRaw`SELECT action,target_id,result FROM rh_research.operation WHERE tenant_id=${s.tenantId} AND actor_id=${user.accountId} AND request_key=${key}`;
   const out=saved?.result;if(!saved||saved.action!=='file.preprocessed'||saved.target_id!==visitId||out?.studyId!==studyId||out.visitId!==visitId||out.receipt?.requestKey!==key||out.receipt?.action!=='file.preprocessed'||out.receipt?.targetId!==visitId||out.receipt?.studyId!==studyId||!id(out.fileId)||!id(out.taskId))throw researchError(404,'FILE_RECEIPT_NOT_FOUND','尚未查到导入回执，请保留原操作状态。');
   const task=await tx.processingTask.findFirst({where:{...s,id:out.taskId,subjectId:visit.subjectId,modalityFileId:out.fileId},select:{id:true}});if(!task)throw researchError(409,'FILE_SOURCE_CHANGED','原导入来源已变化，请重新核对。');return out;
  });}
 return {
  upload:async(user,studyId,visitId,body)=>{const buffer=input(body);const base=await binding(user,studyId,visitId,async(_tx,s,visit)=>({s,subjectCode:visit.subject.subjectId}));
   const value=await core.ingest({...user,...base.s},{subjectId:base.subjectCode,subjectVisitId:visitId,modality:body.modality,bindMode:'existing'},{originalname:body.filename,mimetype:body.filename.toLowerCase().endsWith('.json')?'application/json':'text/csv',buffer},{studyId,visitId,requestKey:body.requestKey});
   return verify(user,studyId,visitId,value,true);
  },
  receipt:async(user,studyId,visitId,key)=>verify(user,studyId,visitId,await savedReceipt(user,studyId,visitId,key)),
  reverify:async(user,studyId,visitId,key)=>verify(user,studyId,visitId,await savedReceipt(user,studyId,visitId,key),true),
 };
}
