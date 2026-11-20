import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createK01ChatBudget,validateK01Admission} from './chat-k01-budget.mjs';

const fail=code=>{throw Object.assign(Error(code),{code,status:409});};
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const milliseconds=x=>x instanceof Date?x.getTime():typeof x==='string'?Date.parse(x):NaN;
const digest=raw=>createHash('sha256').update(raw).digest('hex');
export function validateChatAdmission(a){
 if(a?.schema==='hub-chat-admission.v2'){validateK01Admission(a);validateChatAdmission(a.legacy.admission);return a;}
 if(a?.schema!=='hub-chat-admission.v1'||a.campaignId!=='prod-ai-assets-20261120'||a.database!=='researchhub'||a.tenantId!=='rh-kb-local-b0e2af9d-tenant'||
   !Array.isArray(a.accounts)||a.accounts.length!==2||new Set(a.accounts).size!==2||!a.accounts.every(x=>['rh-kb-local-b0e2af9d-admin','rh-kb-local-b0e2af9d-owner'].includes(x))||
   a.limits?.sessions!==2||a.limits.jobs!==2||a.limits.dispatches!==2||a.limits.feeMicros!==1000000||typeof a.issuedAt!=='string'||!Number.isFinite(milliseconds(a.issuedAt)))fail('HUB_CHAT_ADMISSION_INVALID');
 const m=a.model;
 if(m?.provider!=='deepseek'||m.model!=='deepseek-v4-pro'||m.baseUrl!=='https://api.deepseek.com'||m.secretRef!=='DEEPSEEK_API_KEY'||m.inputMicrosPerMillion!==9000000||m.outputMicrosPerMillion!==27000000||m.maxInputBytes!==20000||m.maxOutputTokens!==2048)fail('HUB_CHAT_PRICE_ADMISSION_INVALID');
 return a;
}

export function initialChatBudget(admission,admissionSha){
 if(admission?.schema==='hub-chat-admission.v2')fail('HUB_CHAT_MIGRATION_REQUIRED');
 validateChatAdmission(admission);if(!/^[a-f0-9]{64}$/.test(admissionSha))fail('HUB_CHAT_ADMISSION_DIGEST_INVALID');
 return{schema:'hub-chat-budget.v1',campaignId:admission.campaignId,admissionSha,revision:0,sessions:[],jobs:[],dispatches:[]};
}

// Runtime only loads a pre-existing, operator-initialized ledger. No missing-file,
// date, release or restart path can create/reset quota.
export function createChatBudget({admission,admissionSha,directory,now=()=>new Date()}){
 validateChatAdmission(admission);
 if(admission.schema==='hub-chat-admission.v2')return createK01ChatBudget({admission,admissionSha,directory,now});
 if(!/^[a-f0-9]{64}$/.test(admissionSha))fail('HUB_CHAT_ADMISSION_DIGEST_INVALID');
 const directoryStat=fs.lstatSync(directory);
 if(!path.isAbsolute(directory)||!directoryStat.isDirectory()||directoryStat.isSymbolicLink()||(directoryStat.mode&0o077)!==0||directoryStat.uid!==process.getuid())fail('HUB_CHAT_LEDGER_DIRECTORY_INVALID');
 const file=path.join(directory,'budget.json'),lock=path.join(directory,'budget.lock');
 const read=()=>{
  let raw;try{const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>262144||(st.mode&0o077)!==0||st.uid!==process.getuid())fail('HUB_CHAT_LEDGER_UNSAFE');raw=fs.readFileSync(file,'utf8');}catch(e){if(e.code?.startsWith('HUB_CHAT_'))throw e;fail('HUB_CHAT_LEDGER_REQUIRED');}
  let s;try{s=JSON.parse(raw);}catch{fail('HUB_CHAT_LEDGER_CORRUPT');}
  if(s.schema!=='hub-chat-budget.v1'||s.campaignId!==admission.campaignId||s.admissionSha!==admissionSha||!integer(s.revision)||!['sessions','jobs','dispatches'].every(k=>Array.isArray(s[k])&&s[k].length<=2))fail('HUB_CHAT_LEDGER_CORRUPT');
  if(new Set(s.sessions.map(x=>x.accountId)).size!==s.sessions.length||new Set(s.jobs.map(x=>x.accountId)).size!==s.jobs.length||new Set(s.dispatches.map(x=>x.accountId)).size!==s.dispatches.length||
   [...s.sessions,...s.jobs,...s.dispatches].some(x=>!admission.accounts.includes(x.accountId))||s.dispatches.some(x=>!integer(x.reservedMicros)||x.reservedMicros>500000)||s.dispatches.reduce((n,x)=>n+x.reservedMicros,0)>admission.limits.feeMicros)fail('HUB_CHAT_LEDGER_CORRUPT');
  const fresh=value=>Number.isFinite(milliseconds(value))&&milliseconds(value)>=milliseconds(admission.issuedAt);
  if(s.sessions.some(x=>!validId(x.requestKey)||!fresh(x.reservedAt)||x.sessionId!==null&&!validId(x.sessionId))||
   new Set(s.jobs.map(x=>x.id)).size!==s.jobs.length||s.jobs.some(x=>!validId(x.id)||!validId(x.requestKey)||!validId(x.sessionId)||!fresh(x.createdAt)||!s.sessions.some(y=>y.accountId===x.accountId&&y.sessionId===x.sessionId))||
   new Set(s.dispatches.map(x=>x.id)).size!==s.dispatches.length||s.dispatches.some(x=>!validId(x.id)||!fresh(x.at)||!integer(x.inputBytes)||x.inputBytes>admission.model.maxInputBytes||x.promptUpper!==2*x.inputBytes+4096||(!integer(x.maxOutputTokens)||x.maxOutputTokens<1||x.maxOutputTokens>admission.model.maxOutputTokens)||!['reserved','known','unknown'].includes(x.state)||!s.jobs.some(y=>y.id===x.jobId&&y.accountId===x.accountId&&y.sessionId===x.sessionId&&y.requestKey===x.requestKey)))fail('HUB_CHAT_LEDGER_CORRUPT');
  for(const d of s.dispatches){
   const expected=Math.ceil(d.promptUpper*admission.model.inputMicrosPerMillion/1000000+d.maxOutputTokens*admission.model.outputMicrosPerMillion/1000000);
   if(d.reservedMicros!==expected)fail('HUB_CHAT_LEDGER_CORRUPT');
   if(d.state==='known'&&(!d.usage||d.usage.model!==admission.model.model||!['promptTokens','completionTokens','totalTokens'].every(k=>integer(d.usage[k]))||d.usage.totalTokens!==d.usage.promptTokens+d.usage.completionTokens||d.usage.promptTokens>d.promptUpper||d.usage.completionTokens>d.maxOutputTokens||d.feeUpperMicros!==Math.ceil((d.usage.promptTokens*admission.model.inputMicrosPerMillion+d.usage.completionTokens*admission.model.outputMicrosPerMillion)/1000000)||d.feeUpperMicros>d.reservedMicros))fail('HUB_CHAT_LEDGER_CORRUPT');
  }
  return s;
 };
 const update=fn=>{
  let fd;try{fd=fs.openSync(lock,'wx',0o600);}catch{fail('HUB_CHAT_LEDGER_LOCKED');}
  try{
   const s=read(),value=fn(s);s.revision++;
   const temporary=path.join(directory,'.budget-'+randomUUID());let next;
   try{next=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(next,JSON.stringify(s)+'\n');fs.fsyncSync(next);}finally{if(next!==undefined)fs.closeSync(next);}
   fs.renameSync(temporary,file);const dir=fs.openSync(directory,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
   return value;
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
 };
 const account=id=>{if(!admission.accounts.includes(id))fail('HUB_CHAT_CAMPAIGN_ACCOUNT_DENIED');};
 const canEnqueue=(s,id)=>{account(id);if(s.dispatches.some(x=>x.state!=='known'))fail('HUB_CHAT_BUDGET_PENDING');if(s.jobs.some(x=>x.accountId===id)||s.jobs.length>=2||s.dispatches.length>=2||s.dispatches.reduce((n,x)=>n+x.reservedMicros,0)>=1000000)fail('HUB_CHAT_BUDGET_EXHAUSTED');};
 read();
 return{
  admission,
  snapshot:read,
  quota(accountId){try{const s=read();if(fs.existsSync(lock))fail('HUB_CHAT_LEDGER_LOCKED');canEnqueue(s,accountId);return{blocked:false};}catch{return{blocked:true,message:'当前AI使用额度不可用，请联系管理员。'};}},
  assertCanEnqueue(accountId,replay){const s=read();account(accountId);if(replay&&s.jobs.some(x=>x.accountId===accountId&&x.sessionId===replay.sessionId&&x.requestKey===replay.requestKey))return;canEnqueue(s,accountId);},
  isAdmittedSession(accountId,sessionId){account(accountId);return read().sessions.some(x=>x.accountId===accountId&&x.sessionId===sessionId);},
  assertAdmittedSession(accountId,sessionId){if(!this.isAdmittedSession(accountId,sessionId))fail('HUB_CHAT_SESSION_NOT_ADMITTED');},
  canClaim(sessionId){try{if(fs.existsSync(lock))return false;const s=read();return s.jobs.some(x=>x.sessionId===sessionId)&&s.dispatches.every(x=>x.state==='known');}catch{return false;}},
  reserveSession(accountId,requestKey){account(accountId);if(!validId(requestKey))fail('HUB_CHAT_REQUEST_KEY_INVALID');return update(s=>{const old=s.sessions.find(x=>x.accountId===accountId&&x.requestKey===requestKey);if(old)return old;canEnqueue(s,accountId);if(s.sessions.some(x=>x.accountId===accountId)||s.sessions.length>=2)fail('HUB_CHAT_SESSION_LIMIT');const next={accountId,requestKey,sessionId:null,reservedAt:now().toISOString()};s.sessions.push(next);return next;});},
  bindSession(accountId,requestKey,session){account(accountId);return update(s=>{const slot=s.sessions.find(x=>x.accountId===accountId&&x.requestKey===requestKey);if(!slot||!validId(session?.id)||session.accountId!==accountId||session.tenantId!==admission.tenantId||!Number.isFinite(milliseconds(session.createdAt))||milliseconds(session.createdAt)<milliseconds(admission.issuedAt))fail('HUB_CHAT_NEW_SESSION_REQUIRED');if(slot.sessionId&&slot.sessionId!==session.id)fail('HUB_CHAT_SESSION_BINDING_CHANGED');slot.sessionId=session.id;return slot;});},
  admitJob(accountId,job){account(accountId);return update(s=>{const previous=s.jobs.find(x=>x.id===job?.id);if(previous){if(previous.accountId!==accountId||previous.sessionId!==job.sessionId||previous.requestKey!==job.requestKey)fail('HUB_CHAT_JOB_BINDING_CHANGED');return previous;}if(s.jobs.some(x=>x.accountId===accountId&&x.sessionId===job?.sessionId&&x.requestKey===job?.requestKey))fail('HUB_CHAT_COMMIT_PENDING');canEnqueue(s,accountId);if(!validId(job?.id)||!validId(job.requestKey)||job.tenantId!==admission.tenantId||job.accountId!==accountId||job.status!=='queued'||job.attempts!==0||!Number.isFinite(milliseconds(job.createdAt))||milliseconds(job.createdAt)<milliseconds(admission.issuedAt)||!s.sessions.some(x=>x.sessionId===job.sessionId&&x.accountId===accountId))fail('HUB_CHAT_NEW_JOB_REQUIRED');const next={id:job.id,accountId,sessionId:job.sessionId,requestKey:job.requestKey,createdAt:new Date(job.createdAt).toISOString()};s.jobs.push(next);return next;});},
  claimScope(){const s=read();return{tenantId:admission.tenantId,AND:[{OR:s.jobs.map(x=>({id:x.id,accountId:x.accountId,sessionId:x.sessionId,tenantId:admission.tenantId}))}]};},
  reserveDispatch(proof,messages,model){account(proof?.accountId);if(!Array.isArray(messages)||messages.length>128)fail('HUB_CHAT_DISPATCH_INPUT_REJECTED');const bytes=Buffer.byteLength(JSON.stringify(messages));if(bytes>admission.model.maxInputBytes||model?.model!==admission.model.model||model.provider!=='deepseek'||(!integer(model.maxTokens)||model.maxTokens<1||model.maxTokens>admission.model.maxOutputTokens))fail('HUB_CHAT_DISPATCH_INPUT_REJECTED');
   const promptUpper=2*bytes+4096,reservedMicros=Math.ceil(promptUpper*admission.model.inputMicrosPerMillion/1000000+model.maxTokens*admission.model.outputMicrosPerMillion/1000000);if(reservedMicros>500000)fail('HUB_CHAT_DISPATCH_COST_REJECTED');
   return update(s=>{const job=s.jobs.find(x=>x.id===proof.jobId&&x.accountId===proof.accountId&&x.sessionId===proof.sessionId&&x.requestKey===proof.requestKey);if(!job||proof.tenantId!==admission.tenantId||s.dispatches.length>=2||s.dispatches.some(x=>x.accountId===proof.accountId||x.state!=='known')||s.dispatches.reduce((n,x)=>n+x.reservedMicros,0)+reservedMicros>1000000)fail('HUB_CHAT_DISPATCH_DENIED');const next={id:randomUUID(),jobId:job.id,accountId:job.accountId,sessionId:job.sessionId,requestKey:job.requestKey,at:now().toISOString(),inputBytes:bytes,promptUpper,maxOutputTokens:model.maxTokens,reservedMicros,state:'reserved'};s.dispatches.push(next);return next;});
  },
  markUnknown(dispatchId){return update(s=>{const d=s.dispatches.find(x=>x.id===dispatchId);if(!d)fail('HUB_CHAT_DISPATCH_SETTLEMENT_INVALID');if(d.state==='reserved')d.state='unknown';return d;});},
  settle(dispatchId,usage){return update(s=>{const d=s.dispatches.find(x=>x.id===dispatchId);if(!d||d.state!=='reserved')fail('HUB_CHAT_DISPATCH_SETTLEMENT_INVALID');if(!usage||usage.model!==admission.model.model||!['promptTokens','completionTokens','totalTokens'].every(k=>integer(usage[k]))||usage.totalTokens!==usage.promptTokens+usage.completionTokens||usage.promptTokens>d.promptUpper||usage.completionTokens>d.maxOutputTokens)fail('HUB_CHAT_USAGE_UNKNOWN');const feeUpperMicros=Math.ceil((usage.promptTokens*admission.model.inputMicrosPerMillion+usage.completionTokens*admission.model.outputMicrosPerMillion)/1000000);if(feeUpperMicros>d.reservedMicros)fail('HUB_CHAT_USAGE_EXCEEDED');d.state='known';d.usage={...usage};d.feeUpperMicros=feeUpperMicros;return d;});},
 };
}

export function loadChatAdmission(file,expectedSha){
 if(!path.isAbsolute(file)||!/^[a-f0-9]{64}$/.test(expectedSha))fail('HUB_CHAT_ADMISSION_FILE_INVALID');
 const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>262144)fail('HUB_CHAT_ADMISSION_FILE_INVALID');
 const raw=fs.readFileSync(file);if(digest(raw)!==expectedSha)fail('HUB_CHAT_ADMISSION_DIGEST_CHANGED');
 return validateChatAdmission(JSON.parse(raw));
}
