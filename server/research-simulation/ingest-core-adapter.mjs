import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {researchError} from '../research-studies/contract.mjs';

/** Per-instance upload extension; the legacy publisher and its saved result remain authoritative. */
export function simulationIngestServiceClass({Service,simulation,HttpException}){
 const request=new AsyncLocalStorage();
 const rethrow=error=>{if(HttpException&&error?.status&&!error.getStatus)throw new HttpException({code:error.code,message:error.message},error.status);throw error;};
 return class SimulationIngestService extends Service{
  ingestPreprocessed(user,metadata,file,formal){
   if(!formal)return super.ingestPreprocessed(user,metadata,file,formal);
   return request.run({metadata,file,formal},()=>super.ingestPreprocessed(user,metadata,file,formal));
  }
  withUploadPublication(user,metadata,prepared,publish,beforeLock){
   const current=request.getStore();if(!current)return super.withUploadPublication(user,metadata,prepared,publish,beforeLock);
   const s={tenantId:user.tenantId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId};
   const before=async tx=>{try{await simulation.withExecutionTx(tx,user,s,async()=>{});await beforeLock?.(tx);}catch(error){rethrow(error);}};
   return super.withUploadPublication(user,metadata,prepared,async(tx,binding)=>{
    const {formal,file}=current,digest=createHash('sha256').update(file.buffer).digest('hex');
    const hash=createHash('sha256').update(JSON.stringify({parserVersion:'parseFormalFeatureFile-v1',studyId:formal.studyId,visitId:formal.visitId,subjectId:binding.subject.id,modality:metadata.modality,filename:file.originalname,digest})).digest('hex');
    const [saved]=await tx.$queryRaw`SELECT request_hash,action,target_id FROM rh_research.operation WHERE tenant_id=${user.tenantId} AND actor_id=${user.accountId} AND request_key=${formal.requestKey}`;
    try{
     if(saved){if(saved.request_hash!==hash||saved.action!=='file.preprocessed'||saved.target_id!==formal.visitId)throw researchError(409,'RESEARCH_REQUEST_KEY_CONFLICT','该请求已用于其他内容。');}
     else await simulation.guardVisitSchedule(tx,s,formal.visitId,{operation:'upload'});
    }catch(error){
     // The legacy ingest publisher cleans staged storage for HttpException rejections.
     rethrow(error);
    }
    return publish(tx,binding);
   },before);
  }
 };
}
