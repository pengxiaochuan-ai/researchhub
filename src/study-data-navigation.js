import {subjectUrl} from './research-subjects-session.js';
import {captureUrl} from './formal-capture-session.js';
import {hubAiHref} from './article-ai-session.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=()=>{throw Error('本次研究、被试或访视归属无法核对，请返回原研究重新进入。');};
export function checkStudyDataContext(context){
 if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).some(k=>!['studyId','subjectId','visitId'].includes(k))||!id(context.studyId)||context.subjectId!==undefined&&!id(context.subjectId)||context.visitId!==undefined&&(!id(context.visitId)||!context.subjectId))fail();
 return context;
}
export const studyDataHref=studyId=>subjectUrl('s03',studyId)+'#study-data';
export const subjectDataHref=(studyId,subjectId)=>subjectUrl('s04',studyId,subjectId)+'#subject-data';
export function studyDataAiHref(context){const c=checkStudyDataContext(context);return hubAiHref(undefined,c.studyId,{...(c.subjectId?{uploadSubjectId:c.subjectId}:{}),...(c.visitId?{uploadVisitId:c.visitId}:{})});}
export function studyDataReturnHref(context){const c=checkStudyDataContext(context);return c.visitId?captureUrl('s09',c.studyId,{visitId:c.visitId})+'#capture-files':c.subjectId?subjectDataHref(c.studyId,c.subjectId):studyDataHref(c.studyId);}
export function studyDataHistoryHref(sessionId,currentRoute){return currentRoute?.kind==='hub'&&currentRoute.sessionId===sessionId?hubAiHref(sessionId,currentRoute.uploadStudyId,{...(currentRoute.uploadSubjectId?{uploadSubjectId:currentRoute.uploadSubjectId}:{}),...(currentRoute.uploadVisitId?{uploadVisitId:currentRoute.uploadVisitId}:{})}):hubAiHref(sessionId);}
export function acceptStudyDataContext(context,response,subject){
 const c=checkStudyDataContext(context),study=response?.item;if(study?.study?.id!==c.studyId||typeof study.project?.title!=='string')fail();
 const value={...c,studyName:study.project.title};
 if(c.subjectId){if(subject?.subject?.id!==c.subjectId||typeof subject.subject.subjectId!=='string'||!Array.isArray(subject.visits))fail();value.subjectCode=subject.subject.subjectId;}
 if(c.visitId){const visit=subject.visits.find(v=>v.id===c.visitId);if(!visit||typeof visit.visitPlan?.name!=='string')fail();value.visitName=visit.visitPlan.name;}
 return value;
}
/** Defaults only; native targets remain the authority. Saved operations win in UI. */
export function selectMediaDataContext(targets,context){
 if(!Array.isArray(targets))fail();
 if(context){const c=checkStudyDataContext(context),study=targets.find(s=>s.id===c.studyId);if(!study)fail();const subject=c.subjectId?study.subjects.find(s=>s.id===c.subjectId):study.subjects.length===1?study.subjects[0]:null;if(c.subjectId&&!subject||c.visitId&&!subject?.visits.some(v=>v.id===c.visitId))fail();return {studyId:study.id,subjectId:subject?.id??'',visitId:c.visitId??''};}
 const study=targets.length===1?targets[0]:null;return{studyId:study?.id??'',subjectId:study?.subjects.length===1?study.subjects[0].id:'',visitId:''};
}
