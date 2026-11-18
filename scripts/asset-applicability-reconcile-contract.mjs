import assert from 'node:assert/strict';
const check=v=>assert.ok(v,'APPLICABILITY_RECONCILIATION_MISMATCH');
export function verifiedReconciliation({caseName,job,reservation,approved,attempt,fee,http,audit}){
 check(['owner','admin','owner-confirmed','owner-paired','revoke','revoke-final'].includes(caseName)&&approved.caseName===caseName);
 if(caseName==='revoke-final')check(job.errorCode==='APPLICABILITY_SCOPE_RESTRICTED');
 check(job.id===approved.jobId&&job.accountId===approved.accountId&&job.status==='failed'&&job.assistantMessageId===null);
 check(reservation.id===approved.reservationId&&reservation.tenantId===approved.tenantId&&reservation.accountId===approved.accountId&&reservation.requestKey==='chat:'+job.sessionId+':'+job.requestKey&&reservation.status==='reconciliation_required');
 check(attempt.jobId===job.id&&attempt.reservationId===fee.id&&fee.status==='known'&&http.jobId===job.id&&http.httpStatus===200&&http.request.model==='deepseek-v4-pro');
 const u=fee.usage,h=http.usage;check(u&&h&&['promptTokens','completionTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0)&&u.totalTokens===u.promptTokens+u.completionTokens&&u.promptTokens===h.prompt_tokens&&u.completionTokens===h.completion_tokens&&u.totalTokens===h.total_tokens);
 const a=audit?.meta;check(a?.model===http.request.model&&a.partialUsage?.length===1);const p=a.partialUsage[0];check(p.model===http.request.model&&p.promptTokens===u.promptTokens&&p.completionTokens===u.completionTokens&&p.totalTokens===u.totalTokens);
 return{action:'settle',promptTokens:u.promptTokens,completionTokens:u.completionTokens,model:http.request.model,callCount:1};
}
