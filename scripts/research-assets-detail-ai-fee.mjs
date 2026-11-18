// A02-only fee receipt adapter. Never creates/renews an approval or edits an old
// module's expiry. The caller must separately prove live task/tenant authority.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,existsSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hashText} from './knowledge-ai-contract.mjs';
const check=(v,c)=>assert.ok(v,c);
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const privateFile=path=>{const s=lstatSync(path);check(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0,'ASSET_DETAIL_AI_FEE_PRIVATE_FILE');};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export class AssetDetailAiFeeGuard{
 constructor({approvalPath,budget}){this.approvalPath=approvalPath;this.path=approvalPath+'.attempts.json';this.budget=budget;}
 approval({fresh=true}={}){
  privateFile(this.approvalPath);const parent=lstatSync(dirname(this.approvalPath));check(parent.isDirectory()&&!parent.isSymbolicLink()&&(parent.mode&0o077)===0,'ASSET_DETAIL_AI_FEE_PRIVATE_FILE');
  const a=JSON.parse(readFileSync(this.approvalPath,'utf8')),q=a.quote,l=a.limits;
  check(a.schema==='rh-asset-detail-ai-fee-approval.v1'&&typeof a.baselineText==='string'&&hashText(a.baselineText)===a.baselineHash,'ASSET_DETAIL_AI_FEE_APPROVAL');
  check(same(l,{totalTasks:20,totalRequests:14,newTasks:4,newRequests:4,totalMicroCny:5000000,inputBytes:8192,maxTokens:1536})&&same(a.oldWindow,{tasks:11,requests:10}),'ASSET_DETAIL_AI_FEE_LIMITS');
  check(q?.url==='https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'&&q.model==='deepseek-v4-pro'&&q.inputMicroCnyPerToken===9&&q.outputMicroCnyPerToken===27&&Number.isFinite(Date.parse(a.approvedAt))&&Date.parse(a.approvedAt)<=Date.now()&&Date.parse(q.checkedAt)>=Date.parse(a.approvedAt)&&Date.parse(q.checkedAt)<=Date.now()&&Date.parse(q.validUntil)>Date.parse(q.checkedAt)&&Date.parse(q.validUntil)-Date.parse(q.checkedAt)<=86400000,'ASSET_DETAIL_AI_FEE_QUOTE');
  if(fresh)check(Date.parse(q.validUntil)>Date.now(),'ASSET_DETAIL_AI_PRICE_EXPIRED');return a;
 }
 attempts(){if(!existsSync(this.path))return[];privateFile(this.path);const v=JSON.parse(readFileSync(this.path));check(v.schema==='rh-asset-detail-ai-attempts.v1'&&Array.isArray(v.records),'ASSET_DETAIL_AI_FEE_ATTEMPTS');return v.records;}
 verify({fresh=true}={}){
  const approval=this.approval({fresh}),baseline=JSON.parse(approval.baselineText),ledger=this.budget.read(),attempts=this.attempts();
  check(baseline.limitMicroCny===5000000&&baseline.records.every(r=>r.status==='known'&&Number.isSafeInteger(r.costMicroCny)&&r.costMicroCny>=0)&&same({...ledger,records:ledger.records.slice(0,baseline.records.length)},baseline),'ASSET_DETAIL_AI_BASELINE_CHANGED');
  const added=ledger.records.slice(baseline.records.length);
  check(added.length===attempts.length&&attempts.length<=4&&new Set(attempts.map(x=>x.reservationId)).size===attempts.length&&new Set(attempts.map(x=>x.jobId)).size===attempts.length,'ASSET_DETAIL_AI_UNREGISTERED_CHARGE');
  for(let i=0;i<added.length;i++){
   const r=added[i],a=attempts[i];check(r.id===a.reservationId&&validId(a.jobId)&&Date.parse(r.startedAt)>=Date.parse(approval.approvedAt)&&['known','reserved','unknown'].includes(r.status)&&Number.isSafeInteger(r.inputBytes)&&r.inputBytes>0&&r.inputBytes<=8192&&Number.isSafeInteger(r.maxTokens)&&r.maxTokens>0&&r.maxTokens<=1536&&r.inputTokensUpper===4*r.inputBytes+8192&&r.reservedMicroCny===r.inputTokensUpper*9+r.maxTokens*27,'ASSET_DETAIL_AI_CHARGE_CHANGED');
   if(r.status==='known')check(Number.isSafeInteger(r.costMicroCny)&&r.costMicroCny>=0&&r.costMicroCny<=r.reservedMicroCny,'ASSET_DETAIL_AI_CHARGE_CHANGED');
  }
  return{approval,ledger,attempts};
 }
 status(){
  const {approval:a,ledger,attempts}=this.verify(),used=ledger.records.reduce((n,r)=>n+(r.status==='known'?r.costMicroCny:r.reservedMicroCny),0),blocked=ledger.records.some(r=>r.status!=='known')||existsSync(this.budget.path+'.lock');
  const perRequestMaxMicroCny=(4*a.limits.inputBytes+8192)*9+a.limits.maxTokens*27;
  return{requests:a.oldWindow.requests+attempts.length,newRequests:attempts.length,requestLimit:14,newRequestLimit:4,providerJobs:attempts.length,remainingMicroCny:5000000-used,blocked,canStart:!blocked&&attempts.length<4&&used+perRequestMaxMicroCny<=5000000};
 }
 // jobs must be read under the caller's common tenant authorization lock and
 // contain every A02 job, including failures before a provider request.
 admitJobs(jobs){const s=this.status(),a=this.approval();check(Array.isArray(jobs)&&jobs.length<=4&&jobs.every(j=>validId(j.id))&&new Set(jobs.map(j=>j.id)).size===jobs.length&&a.oldWindow.tasks+jobs.length<=20,'ASSET_DETAIL_AI_JOB_LIMIT');return{...s,tasks:a.oldWindow.tasks+jobs.length,taskLimit:20};}
 locked(run){const path=this.path+'.lock';let fd;try{fd=openSync(path,'wx',0o600);}catch{throw Error('ASSET_DETAIL_AI_FEE_PENDING');}try{return run();}finally{closeSync(fd);unlinkSync(path);}}
 reserve(jobId,{inputBytes,maxTokens}){
  return this.locked(()=>{
   check(validId(jobId),'ASSET_DETAIL_AI_FEE_INPUT');const old=this.attempts();check(!old.some(r=>r.jobId===jobId),'ASSET_DETAIL_AI_NO_RETRY');
   const s=this.status();check(s.canStart,'ASSET_DETAIL_AI_FEE_BLOCKED');check(Number.isSafeInteger(inputBytes)&&inputBytes>0&&inputBytes<=8192&&Number.isSafeInteger(maxTokens)&&maxTokens>0&&maxTokens<=1536,'ASSET_DETAIL_AI_FEE_INPUT');
   const r=this.budget.reserve({inputBytes,maxTokens,verifyPriceRenewal:()=>{this.approval();return true;}});
   // If persistence fails, the shared pending reservation is deliberately left
   // visible and no provider call may run; do not erase/reset it to retry.
   const records=[...old,{jobId,reservationId:r.id,startedAt:r.startedAt}],temp=this.path+'.'+randomUUID()+'.tmp';
   writeFileSync(temp,JSON.stringify({schema:'rh-asset-detail-ai-attempts.v1',records},null,2),{flag:'wx',mode:0o600});renameSync(temp,this.path);return r;
  });
 }
 settle(id,usage){return this.locked(()=>{const v=this.verify({fresh:false});check(v.attempts.some(r=>r.reservationId===id),'ASSET_DETAIL_AI_UNKNOWN_RESERVATION');return this.budget.settle(id,usage);});}
 unknown(id){return this.locked(()=>{const v=this.verify({fresh:false});check(v.attempts.some(r=>r.reservationId===id),'ASSET_DETAIL_AI_UNKNOWN_RESERVATION');return this.budget.unknown(id);});}
}
