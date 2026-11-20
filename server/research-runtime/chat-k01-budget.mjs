import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const fail=code=>{throw Object.assign(Error(code),{code,status:409});};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const at=x=>x instanceof Date?x.getTime():typeof x==='string'?Date.parse(x):NaN;
const sha=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const k01PrefixHash=s=>sha(JSON.stringify(canonical({sessions:s.sessions.slice(0,2),jobs:s.jobs.slice(0,2),dispatches:s.dispatches.slice(0,2)})));
const fee=s=>s.dispatches.reduce((n,d)=>n+(d.state==='known'?d.feeUpperMicros:d.reservedMicros),0);
const accounts=['rh-kb-local-b0e2af9d-admin','rh-kb-local-b0e2af9d-owner'];
export const CITATION_REVIEW_EXTENSION='citation-review-v1';
export const citationReviewPrefixHash=s=>sha(JSON.stringify(canonical({sessions:s.sessions.slice(0,4),jobs:s.jobs.slice(0,6),dispatches:s.dispatches.slice(0,4)})));
export function validateK01Admission(a){
 const e=a?.citationReview,extended=e!==undefined;
 if(extended&&(!e||Object.keys(e).sort().join(',')!=='issuedAt,prefixHash,previousAdmissionSha'||e.previousAdmissionSha!=='6467192bf782f24a16090d365817ff8a811d351c9ae97730465f57d1d4168492'||!/^[a-f0-9]{64}$/.test(e.prefixHash??'')||!Number.isFinite(at(e.issuedAt))||at(e.issuedAt)<at(a.k01?.issuedAt)))fail('HUB_CHAT_ADMISSION_INVALID');
 const old=a?.legacy?.admission,k=a?.k01;
 if(a?.schema!=='hub-chat-admission.v2'||a.campaignId!=='prod-ai-assets-20261120'||a.database!=='researchhub'||a.tenantId!=='rh-kb-local-b0e2af9d-tenant'||
  a.coreDigest!=='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669'||JSON.stringify(a.accounts)!==JSON.stringify(accounts)||
  a.limits?.sessions!==4||a.limits.jobs!==(extended?8:6)||a.limits.dispatches!==(extended?6:4)||a.limits.feeMicros!==1000000||
  old?.schema!=='hub-chat-admission.v1'||old.coreDigest!=='85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135'||
  old.issuedAt!==a.issuedAt||old.tenantId!==a.tenantId||old.database!==a.database||old.campaignId!==a.campaignId||JSON.stringify(old.accounts)!==JSON.stringify(accounts)||
  JSON.stringify(old.model)!==JSON.stringify(a.model)||old.limits?.sessions!==2||old.limits.jobs!==2||old.limits.dispatches!==2||old.limits.feeMicros!==1000000||
  !/^[a-f0-9]{64}$/.test(a.legacy.admissionSha??'')||!/^[a-f0-9]{64}$/.test(a.legacy.prefixHash??'')||
  !Number.isFinite(at(k?.issuedAt))||at(k.issuedAt)<at(a.issuedAt)||k.studyGroupId!=='rh-kb-local-b0e2af9d-group'||k.researchProjectId!=='rh-kb-local-b0e2af9d-project'||
  !Array.isArray(k.bindings)||k.bindings.length!==2||accounts.some(x=>k.bindings.filter(b=>b.accountId===x).length!==1)||
  !k.bindings.every(b=>[b.kbId,b.positiveDocId,b.importTaskId].every(id))||new Set(k.bindings.map(b=>b.kbId)).size!==2||
  new Set(k.bindings.flatMap(b=>[b.positiveDocId,b.importTaskId])).size!==4)fail('HUB_CHAT_ADMISSION_INVALID');
 return a;
}
export function migrateK01Budget({previous,admission,admissionSha}){
 validateK01Admission(admission);
 if(admission.citationReview)fail('HUB_CHAT_MIGRATION_REJECTED');
 if(!/^[a-f0-9]{64}$/.test(admissionSha??'')||previous?.schema!=='hub-chat-budget.v1'||previous.admissionSha!==admission.legacy.admissionSha||previous.campaignId!==admission.campaignId||
  !integer(previous.revision)||['sessions','jobs','dispatches'].some(k=>previous[k]?.length!==2)||previous.dispatches.some(d=>d.state!=='known')||k01PrefixHash(previous)!==admission.legacy.prefixHash)fail('HUB_CHAT_MIGRATION_REJECTED');
 return{...structuredClone(previous),schema:'hub-chat-budget.v2',admissionSha,revision:previous.revision+1,inheritedRevision:previous.revision};
}
export function extendCitationReviewBudget({previous,previousAdmission,previousAdmissionSha,admission,admissionSha}){
 validateK01Admission(previousAdmission);validateK01Admission(admission);
 const {citationReview,limits,...base}=admission;
 if(previousAdmission.citationReview||previousAdmissionSha!==citationReview?.previousAdmissionSha||previous?.admissionSha!==previousAdmissionSha||previous.schema!=='hub-chat-budget.v2'||!['sessions','jobs','dispatches'].every((k,i)=>previous[k]?.length===[4,6,4][i])||previous.dispatches.some(d=>d.state!=='known')||citationReviewPrefixHash(previous)!==citationReview.prefixHash||JSON.stringify(canonical({...base,limits:previousAdmission.limits}))!==JSON.stringify(canonical(previousAdmission))||!/^[a-f0-9]{64}$/.test(admissionSha??''))fail('HUB_CHAT_CITATION_EXTENSION_REJECTED');
 return{...structuredClone(previous),admissionSha,revision:previous.revision+1};
}
export function createK01ChatBudget({admission,admissionSha,directory,now=()=>new Date()}){
 validateK01Admission(admission);
 if(!/^[a-f0-9]{64}$/.test(admissionSha??''))fail('HUB_CHAT_ADMISSION_DIGEST_INVALID');
 const extension=admission.citationReview,jobStart=extension?6:2,dispatchStart=extension?4:2;
 const directoryStat=fs.lstatSync(directory);
 if(!path.isAbsolute(directory)||!directoryStat.isDirectory()||directoryStat.isSymbolicLink()||(directoryStat.mode&0o077)!==0||directoryStat.uid!==process.getuid())fail('HUB_CHAT_LEDGER_DIRECTORY_INVALID');
 const file=path.join(directory,'budget.json'),lock=path.join(directory,'budget.lock');
 const binding=(accountId,contextKey)=>admission.k01.bindings.find(b=>b.accountId===accountId&&contextKey==='kb:'+b.kbId);
 const account=accountId=>{if(!accounts.includes(accountId))fail('HUB_CHAT_CAMPAIGN_ACCOUNT_DENIED');};
 const fresh=value=>Number.isFinite(at(value))&&at(value)>=at(admission.k01.issuedAt);
 const read=()=>{
  let s;try{const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>262144||(st.mode&0o077)!==0||st.uid!==process.getuid())fail('HUB_CHAT_LEDGER_UNSAFE');s=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code?.startsWith('HUB_CHAT_'))throw e;fail('HUB_CHAT_LEDGER_REQUIRED');}
  if(s.schema!=='hub-chat-budget.v2'||s.admissionSha!==admissionSha||s.campaignId!==admission.campaignId||!integer(s.revision)||!integer(s.inheritedRevision)||s.revision<=s.inheritedRevision||
   !['sessions','jobs','dispatches'].every(k=>Array.isArray(s[k])&&s[k].length>=2&&s[k].length<=admission.limits[k])||k01PrefixHash(s)!==admission.legacy.prefixHash)fail('HUB_CHAT_LEDGER_CORRUPT');
  if(extension&&(!['sessions','jobs','dispatches'].every((k,i)=>s[k].length>=[4,6,4][i])||citationReviewPrefixHash(s)!==extension.prefixHash||s.jobs.slice(6).some(j=>at(j.createdAt)<at(extension.issuedAt))||s.dispatches.slice(4).some(d=>at(d.at)<at(extension.issuedAt))))fail('HUB_CHAT_LEDGER_CORRUPT');
  const sessions=s.sessions.slice(2),jobs=s.jobs.slice(2),dispatches=s.dispatches.slice(2);
  if(new Set(sessions.map(x=>x.accountId)).size!==sessions.length||sessions.some(x=>!binding(x.accountId,x.contextKey)||!id(x.requestKey)||!fresh(x.reservedAt)||x.sessionId!==null&&!id(x.sessionId))||
   new Set(s.jobs.map(x=>x.id)).size!==s.jobs.length||jobs.some(x=>!id(x.id)||!id(x.requestKey)||!fresh(x.createdAt)||!sessions.some(y=>y.accountId===x.accountId&&y.sessionId===x.sessionId))||accounts.some(a=>jobs.filter(x=>x.accountId===a).length>(extension?3:2))||
   new Set(s.dispatches.map(x=>x.id)).size!==s.dispatches.length||accounts.some(a=>dispatches.filter(x=>x.accountId===a).length>(extension?2:1)))fail('HUB_CHAT_LEDGER_CORRUPT');
  for(const d of dispatches){
   if(!id(d.id)||!fresh(d.at)||!integer(d.inputBytes)||d.inputBytes>admission.model.maxInputBytes||d.promptUpper!==2*d.inputBytes+4096||!integer(d.maxOutputTokens)||d.maxOutputTokens<1||d.maxOutputTokens>admission.model.maxOutputTokens||
    !['reserved','known','unknown'].includes(d.state)||!jobs.some(j=>j.id===d.jobId&&j.accountId===d.accountId&&j.sessionId===d.sessionId&&j.requestKey===d.requestKey)||d.reservedMicros!==d.promptUpper*9+d.maxOutputTokens*27||d.reservedMicros>500000)fail('HUB_CHAT_LEDGER_CORRUPT');
   const u=d.usage;
   if(d.state==='known'&&(!u||u.model!==admission.model.model||!['promptTokens','completionTokens','totalTokens'].every(k=>integer(u[k]))||u.totalTokens!==u.promptTokens+u.completionTokens||u.promptTokens>d.promptUpper||u.completionTokens>d.maxOutputTokens||d.feeUpperMicros!==u.promptTokens*9+u.completionTokens*27||d.feeUpperMicros>d.reservedMicros))fail('HUB_CHAT_LEDGER_CORRUPT');
  }
  if(!integer(fee(s))||fee(s)>1000000)fail('HUB_CHAT_LEDGER_CORRUPT');return s;
 };
 const update=fn=>{
  let fd;try{fd=fs.openSync(lock,'wx',0o600);}catch{fail('HUB_CHAT_LEDGER_LOCKED');}
  try{const s=read(),result=fn(s);s.revision++;const temporary=path.join(directory,'.budget-'+randomUUID()),next=fs.openSync(temporary,'wx',0o600);try{fs.writeFileSync(next,JSON.stringify(s)+'\n');fs.fsyncSync(next);}finally{fs.closeSync(next);}fs.renameSync(temporary,file);const d=fs.openSync(directory,'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}return result;}
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
 };
 const canEnqueue=(s,accountId,contextKey)=>{
  account(accountId);if(!binding(accountId,contextKey))fail('HUB_CHAT_KB_SCOPE_DENIED');
  if(s.dispatches.some(d=>d.state!=='known'))fail('HUB_CHAT_BUDGET_PENDING');
  if(s.jobs.slice(jobStart).filter(j=>j.accountId===accountId).length>=(extension?1:2)||s.jobs.length>=admission.limits.jobs||s.dispatches.length>=admission.limits.dispatches||fee(s)>=1000000)fail('HUB_CHAT_BUDGET_EXHAUSTED');
 };
 read();
 return{admission,snapshot:read,
  quota(accountId,contextKey){try{if(fs.existsSync(lock))fail('HUB_CHAT_LEDGER_LOCKED');const s=read();canEnqueue(s,accountId,contextKey);if(s.dispatches.slice(dispatchStart).some(d=>d.accountId===accountId))fail('HUB_CHAT_BUDGET_EXHAUSTED');return{blocked:false};}catch{return{blocked:true,message:'当前AI使用额度不可用，请联系管理员。'};}},
  assertCanEnqueue(accountId,replay){const s=read();account(accountId);if(s.jobs.some(j=>j.accountId===accountId&&j.sessionId===replay?.sessionId&&j.requestKey===replay?.requestKey))return;canEnqueue(s,accountId,s.sessions.find(x=>x.accountId===accountId&&x.sessionId===replay?.sessionId)?.contextKey);},
  isAdmittedSession:(accountId,sessionId)=>{account(accountId);return read().sessions.some(x=>x.accountId===accountId&&x.sessionId===sessionId);},
  assertAdmittedSession(accountId,sessionId){if(!this.isAdmittedSession(accountId,sessionId))fail('HUB_CHAT_SESSION_NOT_ADMITTED');},
  reserveSession(accountId,requestKey,contextKey){account(accountId);if(!id(requestKey))fail('HUB_CHAT_REQUEST_KEY_INVALID');return update(s=>{const old=s.sessions.find(x=>x.accountId===accountId&&x.requestKey===requestKey);if(old){if(old.contextKey!==contextKey)fail('HUB_CHAT_KB_SCOPE_DENIED');return old;}canEnqueue(s,accountId,contextKey);if(s.sessions.slice(2).some(x=>x.accountId===accountId))fail('HUB_CHAT_SESSION_LIMIT');const row={accountId,requestKey,contextKey,sessionId:null,reservedAt:now().toISOString()};s.sessions.push(row);return row;});},
  bindSession(accountId,requestKey,session){account(accountId);return update(s=>{const row=s.sessions.slice(2).find(x=>x.accountId===accountId&&x.requestKey===requestKey);if(!row||!id(session?.id)||session.accountId!==accountId||session.tenantId!==admission.tenantId||session.contextKey!==row.contextKey||!fresh(session.createdAt))fail('HUB_CHAT_NEW_SESSION_REQUIRED');if(row.sessionId&&row.sessionId!==session.id)fail('HUB_CHAT_SESSION_BINDING_CHANGED');row.sessionId=session.id;return row;});},
  admitJob(accountId,job){account(accountId);return update(s=>{const old=s.jobs.find(j=>j.id===job?.id);if(old){if(old.accountId!==accountId||old.sessionId!==job.sessionId||old.requestKey!==job.requestKey)fail('HUB_CHAT_JOB_BINDING_CHANGED');return old;}if(s.jobs.some(j=>j.accountId===accountId&&j.sessionId===job?.sessionId&&j.requestKey===job?.requestKey))fail('HUB_CHAT_COMMIT_PENDING');const session=s.sessions.slice(2).find(x=>x.sessionId===job?.sessionId&&x.accountId===accountId);canEnqueue(s,accountId,session?.contextKey);if(!id(job?.id)||!id(job.requestKey)||job.tenantId!==admission.tenantId||job.accountId!==accountId||job.status!=='queued'||job.attempts!==0||!fresh(job.createdAt))fail('HUB_CHAT_NEW_JOB_REQUIRED');const row={id:job.id,accountId,sessionId:job.sessionId,requestKey:job.requestKey,createdAt:new Date(job.createdAt).toISOString()};s.jobs.push(row);return row;});},
  claimScope(){const s=read();return{tenantId:admission.tenantId,AND:[{OR:s.jobs.slice(jobStart).map(x=>({id:x.id,accountId:x.accountId,sessionId:x.sessionId,tenantId:admission.tenantId}))}]};},
  canClaim(sessionId){try{return!fs.existsSync(lock)&&read().sessions.slice(2).some(x=>x.sessionId===sessionId)&&read().dispatches.every(d=>d.state==='known');}catch{return false;}},
  reserveDispatch(proof,messages,model){account(proof?.accountId);if(!Array.isArray(messages)||messages.length>128)fail('HUB_CHAT_DISPATCH_INPUT_REJECTED');const bytes=Buffer.byteLength(JSON.stringify(messages));if(bytes>admission.model.maxInputBytes||model?.provider!=='deepseek'||model.model!==admission.model.model||!integer(model.maxTokens)||model.maxTokens<1||model.maxTokens>2048)fail('HUB_CHAT_DISPATCH_INPUT_REJECTED');const promptUpper=2*bytes+4096,reservedMicros=promptUpper*9+model.maxTokens*27;if(reservedMicros>500000)fail('HUB_CHAT_DISPATCH_COST_REJECTED');return update(s=>{const job=s.jobs.slice(jobStart).find(j=>j.id===proof.jobId&&j.accountId===proof.accountId&&j.sessionId===proof.sessionId&&j.requestKey===proof.requestKey);if(!job||proof.tenantId!==admission.tenantId||s.dispatches.length>=admission.limits.dispatches||s.dispatches.slice(dispatchStart).some(d=>d.accountId===proof.accountId)||s.dispatches.some(d=>d.state!=='known')||fee(s)+reservedMicros>1000000)fail('HUB_CHAT_DISPATCH_DENIED');const row={id:randomUUID(),jobId:job.id,accountId:job.accountId,sessionId:job.sessionId,requestKey:job.requestKey,at:now().toISOString(),inputBytes:bytes,promptUpper,maxOutputTokens:model.maxTokens,reservedMicros,state:'reserved'};s.dispatches.push(row);return row;});},
  markUnknown(dispatchId){return update(s=>{const d=s.dispatches.slice(dispatchStart).find(x=>x.id===dispatchId);if(!d)fail('HUB_CHAT_DISPATCH_SETTLEMENT_INVALID');if(d.state==='reserved')d.state='unknown';return d;});},
  settle(dispatchId,usage){return update(s=>{const d=s.dispatches.slice(dispatchStart).find(x=>x.id===dispatchId);if(!d||d.state!=='reserved'||!usage||usage.model!==admission.model.model||!['promptTokens','completionTokens','totalTokens'].every(k=>integer(usage[k]))||usage.totalTokens!==usage.promptTokens+usage.completionTokens||usage.promptTokens>d.promptUpper||usage.completionTokens>d.maxOutputTokens)fail('HUB_CHAT_USAGE_UNKNOWN');Object.assign(d,{state:'known',usage:{...usage},feeUpperMicros:usage.promptTokens*9+usage.completionTokens*27});return d;});},
 };
}
