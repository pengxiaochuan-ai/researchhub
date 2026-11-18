import {createHash} from 'node:crypto';
import {ATTEMPT_SCHEMA} from './attempt-protection.mjs';
const fields=['tenantId','accountId','reservationId','jobId','sessionId','executionToken','workerOwner'];
const sameBinding=(meta,binding)=>meta?.schema===ATTEMPT_SCHEMA&&fields.every(k=>typeof binding[k]==='string'&&meta[k]===binding[k]);
const validUsage=u=>u&&['promptTokens','completionTokens','totalTokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0&&u[k]<=2147483647)&&u.totalTokens===u.promptTokens+u.completionTokens;
const usageValues=u=>u?[u.promptTokens,u.completionTokens,u.totalTokens]:null;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function verifiedUsage(events,binding){
 const starts=new Map(),ends=new Map();let seal;
 for(const e of events){
  if(!sameBinding(e.meta,binding))return null;
  const m=e.meta;
  if(e.action==='hub.token.execution.sealed'){
   if(seal&&JSON.stringify(seal.attemptIds)!==JSON.stringify(m.attemptIds))return null;
   seal=m;continue;
  }
  if(typeof m.attemptId!=='string'||!m.attemptId)return null;
  if(e.action==='hub.token.attempt.started'){
   if(starts.has(m.attemptId)&&starts.get(m.attemptId)!==m.model)return null;
   if(typeof m.model!=='string'||!m.model.trim())return null;
   starts.set(m.attemptId,m.model);
  }else if(e.action==='hub.token.attempt.completed'){
   if(m.httpStatus!==200||!validUsage(m.usage))return null;
   const normalized={model:m.model,usage:{promptTokens:m.usage.promptTokens,completionTokens:m.usage.completionTokens,totalTokens:m.usage.totalTokens}};
   if(ends.has(m.attemptId)&&JSON.stringify(ends.get(m.attemptId))!==JSON.stringify(normalized))return null;
   ends.set(m.attemptId,normalized);
  }else return null;
 }
 const ids=[...starts.keys()].sort();
 if(!seal||!ids.length||JSON.stringify(seal.attemptIds)!==JSON.stringify(ids)||ends.size!==starts.size)return null;
 const byModel={};let promptTokens=0,completionTokens=0,totalTokens=0;
 for(const id of ids){
  const m=starts.get(id),end=ends.get(id);if(!end||end.model!==m)return null;
  const u=end.usage;promptTokens+=u.promptTokens;completionTokens+=u.completionTokens;totalTokens+=u.totalTokens;
  const item=byModel[m]??={prompt:0,completion:0,total:0,calls:0};item.prompt+=u.promptTokens;item.completion+=u.completionTokens;item.total+=u.totalTokens;item.calls++;
 }
 if(!validUsage({promptTokens,completionTokens,totalTokens}))return null;
 return{promptTokens,completionTokens,totalTokens,callCount:ids.length,byModel,model:Object.keys(byModel).sort((a,b)=>byModel[b].total-byModel[a].total||a.localeCompare(b))[0],receiptHash:hash(ids.map(id=>[id,ends.get(id)]))};
}

// These append-only operations accept trusted, server-owned bindings, not HTTP DTOs.
export async function finishAttempt(tx,binding,{httpStatus,usage}={}){
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${binding.reservationId},0))`;
 const start=await tx.auditLog.findFirst({where:{tenantId:binding.tenantId,target:binding.reservationId,action:'hub.token.attempt.started',meta:{path:['attemptId'],equals:binding.attemptId}}});
 if(!start||!sameBinding(start.meta,binding)||start.meta.model!==binding.model)throw Error('HUB_TOKEN_ATTEMPT_NOT_STARTED');
 const known=httpStatus===200&&validUsage(usage);
 const action='hub.token.attempt.'+(known?'completed':'unknown');
 const meta={...start.meta,httpStatus:Number.isInteger(httpStatus)?httpStatus:null,...(known?{usage}:{} )};
 const prior=await tx.auditLog.findMany({where:{tenantId:binding.tenantId,target:binding.reservationId,action:{in:['hub.token.attempt.completed','hub.token.attempt.unknown']},meta:{path:['attemptId'],equals:binding.attemptId}}});
 if(prior.length){if(prior.length!==1||prior[0].action!==action||JSON.stringify(usageValues(prior[0].meta?.usage))!==JSON.stringify(usageValues(meta.usage))||prior[0].meta?.httpStatus!==meta.httpStatus)throw Error('HUB_TOKEN_ATTEMPT_CONFLICT');return prior[0];}
 return tx.auditLog.create({data:{tenantId:binding.tenantId,accountId:binding.accountId,studyGroupId:start.studyGroupId,researchProjectId:start.researchProjectId,action,target:binding.reservationId,meta}});
}

export async function sealExecution(tx,binding){
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${binding.reservationId},0))`;
 const events=await tx.auditLog.findMany({where:{tenantId:binding.tenantId,target:binding.reservationId,action:{in:['hub.token.attempt.started','hub.token.attempt.completed','hub.token.attempt.unknown','hub.token.execution.sealed','hub.token.execution.inconsistent']}}});
 if(events.some(e=>!sameBinding(e.meta,binding)))throw Error('HUB_TOKEN_BINDING_CONFLICT');
 let seal=events.find(e=>e.action==='hub.token.execution.sealed');
 if(!seal){
  const attemptIds=[...new Set(events.filter(e=>e.action==='hub.token.attempt.started').map(e=>e.meta.attemptId))].sort();
  seal=await tx.auditLog.create({data:{tenantId:binding.tenantId,accountId:binding.accountId,action:'hub.token.execution.sealed',target:binding.reservationId,meta:{schema:ATTEMPT_SCHEMA,...Object.fromEntries(fields.map(k=>[k,binding[k]])),attemptIds}}});
  events.push(seal);
 }
 return{events,usage:verifiedUsage(events,binding)};
}

export async function blockExecution(tx,binding){
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${binding.reservationId},0))`;
 const first=await tx.auditLog.findFirst({where:{tenantId:binding.tenantId,target:binding.reservationId,action:'hub.token.attempt.started'}});
 if(!first||!sameBinding(first.meta,binding))throw Error('HUB_TOKEN_BINDING_CONFLICT');
 const existing=await tx.auditLog.findFirst({where:{tenantId:binding.tenantId,target:binding.reservationId,action:'hub.token.execution.inconsistent'}});
 if(existing)return existing;
 return tx.auditLog.create({data:{tenantId:binding.tenantId,accountId:binding.accountId,studyGroupId:first.studyGroupId,researchProjectId:first.researchProjectId,action:'hub.token.execution.inconsistent',target:binding.reservationId,meta:{schema:ATTEMPT_SCHEMA,...Object.fromEntries(fields.map(k=>[k,binding[k]])),reason:'native-usage-mismatch'}}});
}
