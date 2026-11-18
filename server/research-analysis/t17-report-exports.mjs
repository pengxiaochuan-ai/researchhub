import {randomUUID} from 'node:crypto';
import {researchError} from '../research-studies/contract.mjs';
import {FORMAL_REPORT_PREFIX,reportDigest} from './t17-report-content.mjs';
const MAX_FILE=16*1024*1024;
const invalid=()=>{throw researchError(404,'REPORT_EXPORT_NOT_FOUND','未找到可访问的报告文件任务。');};
const file=f=>f?{id:f.id,filename:f.filename,mimeType:f.mimeType,sizeBytes:Number(f.sizeBytes),sha256:f.sha256}:null;
const present=j=>({jobId:j.id,artifactId:j.artifactId,versionNo:1,status:j.status,format:j.format,errorCode:j.errorCode??null,createdAt:j.createdAt,completedAt:j.completedAt,file:file(j.file)});
/** Uses the shared real export claim and renderer; it does not start a second generic consumer. */
export function createT17ReportExports({transact,current,permission,configured,render,filename,claim,liveClaim,heartbeat,recoverExpiredClaim,owner,deploymentScope,storage}){
 const find=async(tx,s,jobId)=>{const j=await tx.researchArtifactExportJob.findFirst({where:{...s,id:jobId,artifactId:{startsWith:FORMAL_REPORT_PREFIX}},include:{file:true}});if(!j)invalid();return j;};
 async function checked(tx,user,s,studyId,jobId,{originalActor=false}={}){
  const j=await find(tx,s,jobId),c=await current(tx,user,s,studyId,j.artifactId,'artifact.export');
  if(j.artifactVersionId!==c.version.id||c.artifact.status!=='released'||c.artifact.releasedVersionNo!==1)throw researchError(409,'REPORT_RELEASE_REQUIRED','报告当前不可交付，请重新核对。');
  if(originalActor){const audits=await tx.auditLog.findMany({where:{...s,accountId:j.requestedBy,action:'researchhub.analysis.report.export',target:j.artifactId,meta:{path:['jobId'],equals:j.id}},take:2});if(audits.length!==1||j.requestedBy!==user.accountId||audits[0].meta?.authVersion!==user.authVersion||audits[0].meta?.studyId!==studyId)throw researchError(403,'REPORT_EXPORT_ACTOR_CHANGED','原导出请求的身份已变化，不能继续交付。');}
  return {j,c};
 }
 const api={
  readExport:(user,studyId,jobId)=>transact(user,studyId,async(tx,s)=>present((await checked(tx,user,s,studyId,jobId)).j)),
  async processExport(user,studyId,jobId){
   configured();let ref,storageKey,heartbeatTimer;
   try{
    const prepared=await transact(user,studyId,async(tx,s)=>{const {j,c}=await checked(tx,user,s,studyId,jobId,{originalActor:true});if(j.status!=='queued')return null;const owned=await claim(tx,deploymentScope,'research-artifact-export',jobId,owner);return owned?{j,c,owned}:null;});
    if(!prepared)return api.readExport(user,studyId,jobId);ref=prepared.owned;
    const owned=ref;
    heartbeatTimer=setInterval(()=>{void transact(user,studyId,async(tx,s)=>{await checked(tx,user,s,studyId,jobId,{originalActor:true});await heartbeat(tx,deploymentScope,owned);}).catch(()=>undefined);},15000);heartbeatTimer.unref();
    // A separate read after claim commits closes a revocation between queue and dequeue.
    await transact(user,studyId,async(tx,s)=>{await checked(tx,user,s,studyId,jobId,{originalActor:true});await liveClaim(tx,deploymentScope,owned);});
    const {j,c}=prepared,rendered=await render(j.format,{id:c.artifact.id,title:c.artifact.title,status:c.artifact.status,typeKey:c.artifact.typeKey,versionNo:1,contentMd:c.version.contentMd,contentBlocks:c.version.contentBlocks,generatedAt:new Date()});
    if(!Buffer.isBuffer(rendered.buffer)||!rendered.buffer.length||rendered.buffer.length>MAX_FILE)throw Error('REPORT_EXPORT_FILE_INVALID');
    const name=filename(c.artifact.title,1,j.format),digest=reportDigest(rendered.buffer);
    await transact(user,studyId,async(tx,s)=>{await checked(tx,user,s,studyId,jobId,{originalActor:true});await liveClaim(tx,deploymentScope,owned);});
    storageKey=[j.tenantId,'research-artifacts',j.researchProjectId,j.artifactId,'v1',randomUUID()+'-'+name].join('/');
    await storage.put(storageKey,rendered.buffer,rendered.mimeType,{sha256:digest,artifactId:j.artifactId,versionNo:'1'});
    const reread=await storage.getBuffer(storageKey,MAX_FILE);if(reportDigest(reread)!==digest)throw Error('REPORT_EXPORT_STORAGE_DIGEST_MISMATCH');
    await transact(user,studyId,async(tx,s)=>{
     const latest=await checked(tx,user,s,studyId,jobId,{originalActor:true});await liveClaim(tx,deploymentScope,owned);
     if(latest.c.version.contentHash!==c.version.contentHash||latest.c.version.sourceSnapshotHash!==c.version.sourceSnapshotHash)throw Error('REPORT_EXPORT_VERSION_CHANGED');
     const output=await tx.researchArtifactFile.create({data:{...s,artifactId:j.artifactId,artifactVersionId:j.artifactVersionId,role:'rendered_export',storageKey,filename:name,mimeType:rendered.mimeType,sizeBytes:BigInt(rendered.buffer.length),sha256:digest}});
     const terminal=await tx.researchArtifactExportJob.updateMany({where:{...s,id:jobId,status:'rendering',executionToken:owned.executionToken,workerOwner:owned.workerOwner},data:{status:'ready',fileId:output.id,completedAt:new Date()}});if(terminal.count!==1)throw Error('WORKER_TERMINAL_CAS_FAILED');
     await tx.auditLog.create({data:{...s,accountId:user.accountId,action:'researchhub.analysis.report.export_ready',target:jobId,meta:{studyId,artifactId:j.artifactId,fileId:output.id,sha256:digest,sizeBytes:rendered.buffer.length}}});
    });
    return api.readExport(user,studyId,jobId);
   }catch(error){
    // No replay, no false ready. A private object with an unconfirmed commit is
    // retained for reconciliation; deleting it could remove a committed file.
    if(ref)await transact(user,studyId,async(tx,s)=>{await permission(tx,user,s,'artifact.export');const j=await find(tx,s,jobId);if(j.requestedBy!==user.accountId)return;await liveClaim(tx,deploymentScope,ref);await tx.researchArtifactExportJob.updateMany({where:{...s,id:jobId,status:'rendering',executionToken:ref.executionToken,workerOwner:ref.workerOwner},data:{status:'failed',errorCode:'REPORT_EXPORT_BLOCKED',errorMessage:'生成或交付条件已变化，未交付文件。',completedAt:new Date()}});}).catch(()=>undefined);
    throw error;
   }finally{if(heartbeatTimer)clearInterval(heartbeatTimer);}
  },
  async download(user,studyId,jobId){
   configured();const prepared=await transact(user,studyId,async(tx,s)=>{const {j}=await checked(tx,user,s,studyId,jobId);if(j.status!=='ready'||!j.file||j.file.artifactId!==j.artifactId||j.file.artifactVersionId!==j.artifactVersionId)invalid();return j;});
   const buffer=await storage.getBuffer(prepared.file.storageKey,MAX_FILE);if(buffer.length!==Number(prepared.file.sizeBytes)||reportDigest(buffer)!==prepared.file.sha256)throw researchError(409,'REPORT_FILE_DIGEST_MISMATCH','报告文件校验失败，已停止下载。');
   await transact(user,studyId,async(tx,s)=>{const {j}=await checked(tx,user,s,studyId,jobId);if(j.status!=='ready'||j.file?.id!==prepared.file.id||j.file.sha256!==prepared.file.sha256)invalid();await tx.auditLog.create({data:{...s,accountId:user.accountId,action:'researchhub.analysis.report.download',target:j.file.id,meta:{studyId,artifactId:j.artifactId,jobId,sha256:j.file.sha256,sizeBytes:buffer.length}}});});
   return {...file(prepared.file),buffer};
  },
  async resume(user,studyId){configured();const queue=await transact(user,studyId,async(tx,s)=>{
   await permission(tx,user,s,'artifact.export');const where={...s,requestedBy:user.accountId,artifactId:{startsWith:FORMAL_REPORT_PREFIX}};
   const active=await tx.researchArtifactExportJob.findMany({where:{...where,status:'rendering',executionToken:{not:null},workerOwner:{not:null},leaseExpiresAt:{not:null}},select:{id:true},take:20});
   let interrupted=0;for(const row of active)if(await recoverExpiredClaim(tx,deploymentScope,'research-artifact-export',row.id))interrupted++;
   const rows=await tx.researchArtifactExportJob.findMany({where:{...where,status:'queued'},select:{id:true},orderBy:[{createdAt:'asc'},{id:'asc'}],take:20});return {rows,interrupted};
  });const results=[];for(const row of queue.rows){try{results.push(await api.processExport(user,studyId,row.id));}catch(e){results.push({jobId:row.id,status:'blocked',errorCode:e.code??'REPORT_EXPORT_BLOCKED'});}}return {studyId,items:results,interrupted:queue.interrupted,limit:20};},
 };
 return api;
}
