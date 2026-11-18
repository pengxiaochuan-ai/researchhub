import{subjectUrl}from'./research-subjects-session.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const bad=()=>{throw Error('MEDIA_INGEST_RESPONSE');};
export function mediaIngestBase(sessionId,mediaId){if(!id(sessionId)||!id(mediaId))bad();return`/sessions/${sessionId}/media/${mediaId}`;}
export function mediaIngestSubjectBase(studyId,subjectId){if(!id(studyId)||!id(subjectId))bad();return`/research-studies/${studyId}/subjects/${subjectId}/session-media-ingests`;}
export function assertMediaIngest(row,mediaId){
 if(!id(row?.id)||!Number.isSafeInteger(row.version)||!['planned','committed','cancelled','invalid'].includes(row.state)||!hash(row.confirmationHash)||!id(row.requestKey)||!id(row.source?.mediaId)||mediaId&&row.source.mediaId!==mediaId||!hash(row.source.sha256)||!Number.isSafeInteger(row.source.byteSize)||!id(row.study?.id)||typeof row.study.name!=='string'||!id(row.subject?.id)||typeof row.subject.subjectCode!=='string'||row.visit!=null&&(!id(row.visit.id)||typeof row.visit.name!=='string'))bad();
 if(row.state==='committed'){
  if(!id(row.receipt?.modalityFileId)||row.receipt.confirmationHash!==row.confirmationHash||row.receipt.schema!=='hub-media-ingest-receipt.v1'||!Number.isFinite(Date.parse(row.receipt.registeredAt)))bad();
  if(row.contentHref!=='/api'+mediaIngestSubjectBase(row.study.id,row.subject.id)+'/'+row.id+'/content')bad();
 }
 return row;
}
export function assertMediaIngestTargets(data,mediaId){
 if(!Array.isArray(data?.items)||data.items.length>100||data.items.some(s=>!id(s.id)||typeof s.name!=='string'||!Array.isArray(s.subjects)||s.subjects.length>100||s.subjects.some(p=>!id(p.id)||typeof p.subjectId!=='string'||!Array.isArray(p.visits)||p.visits.some(v=>!id(v.id)||typeof v.name!=='string'))))bad();
 if(data.current)assertMediaIngest(data.current,mediaId);return data;
}
export function readMediaIngestPending(raw){
 try{const r=JSON.parse(raw),b=r?.body;if(r?.schema!=='hub-media-ingest-pending.v1'||Object.keys(r).some(k=>!['schema','requestKey','body','phase'].includes(k))||r.phase!=null&&!['preparing','confirming'].includes(r.phase)||!id(r.requestKey)||!b||Object.keys(b).some(k=>!['requestKey','studyId','subjectId','subjectVisitId','collectedAt'].includes(k))||b.requestKey!==r.requestKey||![b.studyId,b.subjectId].every(id)||b.subjectVisitId!=null&&!id(b.subjectVisitId)||b.collectedAt!=null&&(typeof b.collectedAt!=='string'||!Number.isFinite(Date.parse(b.collectedAt))))return null;return r;}catch{return null;}
}
export function assertMediaIngestPage(data){if(!Array.isArray(data?.items)||data.items.length>20||data.nextCursor!=null&&!id(data.nextCursor))bad();for(const row of data.items)assertMediaIngest(row);return data;}
export function mediaIngestSubjectHref(item){return subjectUrl('s04',item.study.id,item.subject.id);}
