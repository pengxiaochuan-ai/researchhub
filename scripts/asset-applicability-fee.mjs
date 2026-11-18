// Local WP09 guard only; charges remain in the original five-yuan ledger.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,openSync,closeSync,unlinkSync,renameSync,statSync,lstatSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hashText} from './knowledge-ai-contract.mjs';
const check=(v,c)=>assert.ok(v,c);
export class LocalApplicabilityFeeGuard{
 constructor({approvalPath,budget,externalCharges=()=>({reservationIds:[],requests:0,jobs:0})}){this.approvalPath=approvalPath;this.path=approvalPath+'.attempts.json';this.budget=budget;this.externalCharges=externalCharges;}
 approval(){
  for(const p of [this.approvalPath,dirname(this.approvalPath)])check((statSync(p).mode&0o077)===0,'APPLICABILITY_FEE_PRIVATE_FILE');
  const a=JSON.parse(readFileSync(this.approvalPath,'utf8'));
  check(a.schema==='rh-wp09-fee-approval.v1'&&hashText(a.baselineText)===a.baselineHash,'APPLICABILITY_FEE_APPROVAL');
  const l=a.limits,q=a.quote;check(l.jobs===4&&l.requests===8&&l.inputBytes===8192&&l.maxTokens===1536&&l.totalMicroCny===5000000,'APPLICABILITY_FEE_LIMITS');
  check(q.model==='deepseek-v4-pro'&&q.url==='https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'&&q.inputMicroCnyPerToken===9&&q.outputMicroCnyPerToken===27&&Date.parse(q.checkedAt)<=Date.now()&&Date.parse(q.validUntil)-Date.parse(q.checkedAt)<=86400000&&Date.parse(a.approvedAt)<=Date.now(),'APPLICABILITY_FEE_QUOTE');
  check(Array.isArray(a.excludedFreeJobs)&&a.excludedFreeJobs.length===2,'APPLICABILITY_FEE_BASELINE');return a;
 }
 attempts(){if(!existsSync(this.path))return[];check((statSync(this.path).mode&0o077)===0,'APPLICABILITY_FEE_PRIVATE_FILE');const s=JSON.parse(readFileSync(this.path));check(s.schema==='rh-wp09-provider-attempts.v1'&&Array.isArray(s.records),'APPLICABILITY_FEE_ATTEMPTS');return s.records;}
 legacyJobLimit(){
  const path=this.approvalPath+'.jobs-extension.json';if(!existsSync(path))return 4;
  const stat=lstatSync(path);check(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'APPLICABILITY_JOB_EXTENSION_INVALID');
  const e=JSON.parse(readFileSync(path)),a=this.approval();check(e.schema==='rh-wp09-job-extension.v1'&&e.originalApprovalHash===hashText(readFileSync(this.approvalPath,'utf8'))&&e.maxJobs===10&&e.maxRequests===8&&e.totalMicroCny===5000000&&Date.parse(e.approvedAt)>=Date.parse(a.approvedAt)&&Date.parse(e.approvedAt)<=Date.now(),'APPLICABILITY_JOB_EXTENSION_INVALID');return e.maxJobs;
 }
 admitJobs(jobs,{jobId,accountId}){const s=this.status();check(Array.isArray(jobs)&&jobs.length<=s.jobLimit&&!s.blocked&&(jobId?jobs.some(j=>j.id===jobId&&j.accountId===accountId):s.canStart&&jobs.length<s.jobLimit),'APPLICABILITY_JOB_LIMIT');return s;}
 requestLimit(){
  const path=this.approvalPath+'.requests-extension.json';if(!existsSync(path))return 8;
  const stat=lstatSync(path);check(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'APPLICABILITY_REQUEST_EXTENSION_INVALID');
  const e=JSON.parse(readFileSync(path)),jobsPath=this.approvalPath+'.jobs-extension.json';check(existsSync(jobsPath)&&this.legacyJobLimit()===10,'APPLICABILITY_REQUEST_EXTENSION_INVALID');
  const jobs=JSON.parse(readFileSync(jobsPath)),attempts=this.attempts();check(e.schema==='rh-wp09-request-extension.v1'&&e.originalApprovalHash===hashText(readFileSync(this.approvalPath,'utf8'))&&e.jobExtensionHash===hashText(readFileSync(jobsPath,'utf8'))&&e.approvedAfterRequests===8&&attempts.length>=8&&e.attemptsPrefixHash===hashText(JSON.stringify(attempts.slice(0,8)))&&e.maxRequests===12&&e.maxJobs===10&&e.totalMicroCny===5000000&&Date.parse(e.approvedAt)>=Date.parse(jobs.approvedAt)&&Date.parse(e.approvedAt)<=Date.now(),'APPLICABILITY_REQUEST_EXTENSION_INVALID');return 12;
 }
 acceptanceExtension(){
  const path=this.approvalPath+'.acceptance-extension-20261028.json';if(!existsSync(path))return null;
  const stat=lstatSync(path);check(stat.isFile()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0&&stat.size<=65536,'APPLICABILITY_ACCEPTANCE_EXTENSION_INVALID');
  const e=JSON.parse(readFileSync(path,'utf8')),a=this.approval(),jobsPath=this.approvalPath+'.jobs-extension.json',requestsPath=this.approvalPath+'.requests-extension.json',attempts=this.attempts(),ledger=this.budget.read(),q=e.quote;
  check(this.legacyJobLimit()===10&&this.requestLimit()===12&&existsSync(jobsPath)&&existsSync(requestsPath),'APPLICABILITY_ACCEPTANCE_EXTENSION_INVALID');
  check(e.schema==='rh-wp09-acceptance-extension.v1'&&e.originalApprovalHash===hashText(readFileSync(this.approvalPath,'utf8'))&&e.jobExtensionHash===hashText(readFileSync(jobsPath,'utf8'))&&e.requestExtensionHash===hashText(readFileSync(requestsPath,'utf8'))&&e.approvedAfterRequests===9&&attempts.length>=9&&e.attemptsPrefixHash===hashText(JSON.stringify(attempts.slice(0,9)))&&e.approvedAfterCharges===88&&ledger.records.length>=88&&e.ledgerPrefixHash===hashText(JSON.stringify({...ledger,records:ledger.records.slice(0,88)}))&&e.maxJobs===20&&e.maxRequests===12&&e.inputBytes===8192&&e.maxTokens===1536&&e.totalMicroCny===5000000&&Date.parse(e.approvedAt)>Date.parse(a.approvedAt)&&Date.parse(e.approvedAt)<=Date.now()&&q?.url==='https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'&&q.model==='deepseek-v4-pro'&&q.inputMicroCnyPerToken===9&&q.outputMicroCnyPerToken===27&&Date.parse(q.checkedAt)>=Date.parse(e.approvedAt)&&Date.parse(q.checkedAt)<=Date.now()&&Date.parse(q.validUntil)>Date.parse(q.checkedAt)&&Date.parse(q.validUntil)-Date.parse(q.checkedAt)<=86400000,'APPLICABILITY_ACCEPTANCE_EXTENSION_INVALID');
  return e;
 }
 jobLimit(){return this.acceptanceExtension()?.maxJobs??this.legacyJobLimit();}
 verifyLedger(){
  const a=this.approval(),base=JSON.parse(a.baselineText),s=this.budget.read(),attempts=this.attempts();
  check(base.records.length===79&&base.limitMicroCny===5000000&&base.records.every(r=>r.status==='known')&&base.records.reduce((n,r)=>n+r.costMicroCny,0)===1518966,'APPLICABILITY_FEE_BASELINE');
  check(JSON.stringify({...s,records:s.records.slice(0,79)})===JSON.stringify(base),'APPLICABILITY_BASELINE_CHANGED');
  const external=this.externalCharges(s);check(Array.isArray(external.reservationIds)&&external.reservationIds.length===external.requests&&Number.isSafeInteger(external.requests)&&external.requests>=0&&Number.isSafeInteger(external.jobs)&&external.jobs>=0&&external.jobs<=external.requests&&external.reservationIds.every(id=>s.records.slice(79).some(r=>r.id===id)),'APPLICABILITY_UNREGISTERED_CHARGE');
  check(external.accountedRequestLimit===undefined||[14,19].includes(external.accountedRequestLimit),'APPLICABILITY_UNREGISTERED_CHARGE');
  const added=s.records.slice(79).filter(r=>!external.reservationIds.includes(r.id));check(added.length===attempts.length&&attempts.length+external.requests<=(external.accountedRequestLimit??this.requestLimit())&&new Set(attempts.map(r=>r.reservationId)).size===attempts.length&&new Set(attempts.map(r=>r.jobId)).size+external.jobs<=this.jobLimit(),'APPLICABILITY_UNREGISTERED_CHARGE');
  for(let i=0;i<added.length;i++){
   const r=added[i];check(r.id===attempts[i].reservationId&&typeof attempts[i].jobId==='string'&&!a.excludedFreeJobs.includes(attempts[i].jobId)&&Date.parse(r.startedAt)>=Date.parse(a.approvedAt),'APPLICABILITY_UNREGISTERED_CHARGE');
   check(['known','reserved','unknown'].includes(r.status)&&Number.isSafeInteger(r.inputBytes)&&r.inputBytes>0&&r.inputBytes<=8192&&Number.isSafeInteger(r.maxTokens)&&r.maxTokens>0&&r.maxTokens<=1536&&r.inputTokensUpper===4*r.inputBytes+8192&&r.reservedMicroCny===r.inputTokensUpper*9+r.maxTokens*27,'APPLICABILITY_CHARGE_INTEGRITY');
   if(r.status==='known'){const u=r.usage;check(u&&['promptTokens','completionTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0)&&u.totalTokens===u.promptTokens+u.completionTokens&&u.promptTokens<=r.inputTokensUpper&&u.completionTokens<=r.maxTokens&&r.costMicroCny===u.promptTokens*9+u.completionTokens*27,'APPLICABILITY_CHARGE_INTEGRITY');}
  }
  return{approval:a,attempts,baselineHash:a.baselineHash,added,external};
 }
 status(){const v=this.verifyLedger(),b=this.budget.status(),a=v.approval,e=this.acceptanceExtension(),q=e?.quote??a.quote;check(Date.parse(q.validUntil)>Date.now(),'APPLICABILITY_PRICE_EXPIRED');const requestLimit=this.requestLimit(),requests=v.attempts.length+v.external.requests,worstCaseMicroCny=(requestLimit-requests)*((4*8192+8192)*9+1536*27),blocked=e?this.budget.read().records.some(r=>r.status!=='known')||existsSync(this.budget.path+'.lock'):b.blocked;return{requestLimit,requests,jobs:new Set(v.attempts.map(r=>r.jobId)).size,jobLimit:this.jobLimit()-v.external.jobs,worstCaseMicroCny,remainingMicroCny:b.remainingMicroCny,canStart:!blocked&&requests<requestLimit&&worstCaseMicroCny<=b.remainingMicroCny,blocked,approvedAt:a.approvedAt};}
 reserve(jobId,{inputBytes,maxTokens}){
  let fd;try{fd=openSync(this.path+'.lock','wx',0o600);}catch{throw Error('APPLICABILITY_FEE_LOCKED');}
  try{
   const a=this.approval();check(typeof jobId==='string'&&!a.excludedFreeJobs.includes(jobId),'APPLICABILITY_PREAPPROVAL_JOB');
   const s=this.status();check(s.requests<s.requestLimit,'APPLICABILITY_REQUEST_LIMIT');check(!s.blocked&&s.canStart,'APPLICABILITY_BUDGET_BLOCKED');
   const records=this.attempts();check(records.some(r=>r.jobId===jobId)||s.jobs<s.jobLimit,'APPLICABILITY_JOB_LIMIT');
   check(Number.isSafeInteger(inputBytes)&&inputBytes>0&&inputBytes<=8192&&Number.isSafeInteger(maxTokens)&&maxTokens>0&&maxTokens<=1536,'APPLICABILITY_REQUEST_SIZE');
   const receipt=this.acceptanceExtension();const r=this.budget.reserve({inputBytes,maxTokens,verifyPriceRenewal:receipt?()=>{const fresh=this.acceptanceExtension();return Boolean(fresh&&Date.parse(fresh.quote.validUntil)>Date.now());}:undefined});records.push({jobId,reservationId:r.id,startedAt:r.startedAt});const temp=this.path+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify({schema:'rh-wp09-provider-attempts.v1',records},null,2),{flag:'wx',mode:0o600});renameSync(temp,this.path);return r;
  }finally{closeSync(fd);unlinkSync(this.path+'.lock');}
 }
}
