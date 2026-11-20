import {materialDigest} from './session-material-contract.mjs';
import {mediaIsImage,mediaImageDimensions} from './session-media.mjs';
import {mediaIsAudio,mediaAudioFactsValid,projectAudioFacts} from './session-audio-contract.mjs';
import {mediaIsEeglab,validEeglabFacts,projectEeglabFacts} from './session-eeglab-contract.mjs';
export const mediaIngestError=(code,status=409)=>Object.assign(Error(code),{code,status});
export const mediaIngestFail=(code,status)=>{throw mediaIngestError(code,status);};
export const mediaIngestId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export function mediaIngestOnly(value,fields){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fields.includes(k)))mediaIngestFail('MEDIA_INGEST_INPUT',400);}
export function normalizeMediaIngest(body){
 mediaIngestOnly(body,['requestKey','studyId','subjectId','subjectVisitId','collectedAt']);
 if(![body.requestKey,body.studyId,body.subjectId].every(mediaIngestId)||body.subjectVisitId!=null&&!mediaIngestId(body.subjectVisitId))mediaIngestFail('MEDIA_INGEST_INPUT',400);
 let collectedAt=null;
 if(body.collectedAt!=null){if(typeof body.collectedAt!=='string'||body.collectedAt.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.collectedAt)||!Number.isFinite(Date.parse(body.collectedAt)))mediaIngestFail('MEDIA_INGEST_INPUT',400);collectedAt=new Date(body.collectedAt).toISOString();}
 return{requestKey:body.requestKey,studyId:body.studyId,subjectId:body.subjectId,subjectVisitId:body.subjectVisitId??null,collectedAt};
}
export function mediaInspectionRef(media){
 if(media?.archive_state!=='archived'||media.inspection_state!=='complete'||media.inspection_classification!=='valid'||!/^[a-f0-9]{64}$/.test(media.source_sha256??'')||!Number.isSafeInteger(Number(media.byte_size)))mediaIngestFail('MEDIA_INGEST_SOURCE_UNAVAILABLE');
 if(mediaIsEeglab(media)){
  if(!validEeglabFacts(media.inspection))mediaIngestFail('MEDIA_INGEST_SOURCE_UNAVAILABLE');
  return{version:media.version,attemptId:media.inspection_attempt_id,classification:'valid',...projectEeglabFacts(media.inspection)};
 }
 if(mediaIsAudio(media)){
  if(!mediaAudioFactsValid(media.inspection,media.extension))mediaIngestFail('MEDIA_INGEST_SOURCE_UNAVAILABLE');
  return{version:media.version,attemptId:media.inspection_attempt_id,classification:'valid',...projectAudioFacts(media.inspection)};
 }
 if(mediaIsImage(media)){
  if(media.inspection?.hasImage!==true||media.inspection.hasVideo!==false||media.inspection.hasAudio!==false||!mediaImageDimensions(media.inspection))mediaIngestFail('MEDIA_INGEST_SOURCE_UNAVAILABLE');
  return{version:media.version,attemptId:media.inspection_attempt_id,classification:'valid',hasVideo:false,hasAudio:false,hasImage:true,width:media.inspection.width,height:media.inspection.height};
 }
 if(media.inspection?.hasVideo!==true||media.inspection?.hasImage===true)mediaIngestFail('MEDIA_INGEST_SOURCE_UNAVAILABLE');
 return{version:media.version,attemptId:media.inspection_attempt_id,classification:'valid',hasVideo:true,hasAudio:media.inspection.hasAudio===true,...(Number.isFinite(media.inspection.durationSeconds)?{durationSeconds:media.inspection.durationSeconds}:{})};
}
export function mediaIngestSnapshot(media,target,permissionRef){
 const body={schema:'hub-media-ingest-confirmation.v1',source:{mediaId:media.id,sessionId:media.session_id,accountId:media.account_id,studyGroupId:media.study_group_id,researchProjectId:media.research_project_id,sha256:media.source_sha256,byteSize:Number(media.byte_size),...(mediaIsEeglab(media)?{modality:'eeg'}:mediaIsAudio(media)?{modality:'audio'}:mediaIsImage(media)?{modality:'tongue'}:{}),inspection:mediaInspectionRef(media)},target,permissionRef};
 return{...body,hash:materialDigest(body)};
}
