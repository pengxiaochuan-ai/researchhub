import {validReportResult,validReportDetail} from './formal-reports-session.js';
import {validFullStudyGroup} from './full-study-ui-session.js';
export const fullReportSourceBody=runGroupId=>({runGroupId});
export const validConfirmedFullStudyGroup=(v,studyId,runGroupId)=>validFullStudyGroup(v,studyId)&&v.id===runGroupId&&v.remaining===0&&v.status==='completed'&&v.reviewStatus==='confirmed';
export function validFullReportResult(v,p){return validReportResult(p.action==='create'?{...v,runId:v?.runGroupId}:v,p)&&!(p.action==='create'&&Object.hasOwn(v,'runId'));}
export function validFullReportDetail(v,scope){return !Object.hasOwn(v??{},'runId')&&validReportDetail({...v,runId:v?.runGroupId},scope);}
export async function verifiedFullReportDetail(v,scope){if(!validFullReportDetail(v,scope))return false;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v.contentMd)))].map(x=>x.toString(16).padStart(2,'0')).join('')===v.contentHash;}
// The verified v2 generator uses this exact heading; stored Markdown stays intact.
export function splitFullStudyReportMarkdown(md){const boundary='\n## 可复核来源\n',at=md.lastIndexOf(boundary);return at>=0?{body:md.slice(0,at),appendix:md.slice(at),legacy:false}:{body:'',appendix:md,legacy:true};}
