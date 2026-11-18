// One explicitly approved local renewal; never imported for startup side effects.
import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,lstatSync,existsSync,renameSync}from'node:fs';
import{createHash,randomUUID}from'node:crypto';
import{LocalAiBudget}from'./knowledge-ai-contract.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const approval='2026-10-25-user-WP07-F01-original-CNY5-three-requests-no-topup';
const fourthApproval='2026-10-26-user-WP07-four-total-requests-original-CNY5-no-topup';
export function readCrfCallExtension(path){if(!existsSync(path))return null;const s=lstatSync(path);assert(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0);return JSON.parse(readFileSync(path));}
export function crfRequestLimit(receipt,extension=null){
 if(!extension)return 3;
 assert.equal(extension.approval,fourthApproval);assert.equal(extension.maxNewRequests,4);assert.equal(extension.originalReceiptHash,sha(JSON.stringify(receipt)));assert.equal(extension.priceValidUntil,receipt.priceValidUntil);assert.equal(extension.limitMicroCny,5000000);assert.equal(sha(extension.approvedLedgerText),extension.approvedLedgerHash);
 const prior=JSON.parse(extension.approvedLedgerText),old=JSON.parse(receipt.originalLedgerText);assert.equal(prior.records.length,old.records.length+1);assert.deepEqual(prior.records.slice(0,old.records.length),old.records);assert(prior.records.every(r=>r.status==='known'));return 4;
}
export function assertCrfApprovedLedger(current,receipt,extension=null){
 assert.equal(receipt.approval,approval);assert.equal(receipt.maxNewRequests,3);assert.equal(sha(receipt.originalLedgerText),receipt.originalLedgerHash);
 const limit=crfRequestLimit(receipt,extension);
 const old=JSON.parse(receipt.originalLedgerText);assert.deepEqual({...current,records:undefined,priceValidUntil:undefined},{...old,records:undefined,priceValidUntil:undefined});
 assert.equal(current.limitMicroCny,5000000);assert.equal(current.priceValidUntil,receipt.priceValidUntil);assert(current.records.length>=old.records.length&&current.records.length<=old.records.length+limit);
 if(extension){const prior=JSON.parse(extension.approvedLedgerText);assert(current.records.length>=prior.records.length);assert.deepEqual(current.records.slice(0,prior.records.length),prior.records);}
 assert.deepEqual(current.records.slice(0,old.records.length),old.records);assert(current.records.every(r=>r.status==='known'&&Number.isSafeInteger(r.costMicroCny)&&r.costMicroCny>=0));assert(current.records.reduce((n,r)=>n+r.costMicroCny,0)<=5000000);return true;
}
export async function approveCrfFourthRequest({ledgerPath,scopePath,receiptPath,markerPath,extensionPath,approval:approved,verifyRecordedFailure}){
 assert.equal(approved,fourthApproval);assert(!existsSync(extensionPath),'CALL_EXTENSION_ALREADY_APPLIED');
 for(const f of[ledgerPath,scopePath,receiptPath,markerPath]){const s=lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0);}
 const texts=[ledgerPath,scopePath,receiptPath,markerPath].map(f=>readFileSync(f,'utf8')),[ledger,scope,receipt,marker]=texts.map(t=>JSON.parse(t));assertCrfApprovedLedger(ledger,receipt);assert(Date.parse(receipt.priceValidUntil)>Date.now(),'ORIGINAL_QUOTE_EXPIRED');assert.equal(ledger.records.length,JSON.parse(receipt.originalLedgerText).records.length+1);
 assert.equal(scope.enabled,true);assert.equal(scope.paidAiApproved,false);assert.equal(scope.implementationHold,'model-output-citation-review');assert.equal(marker.status,'blocked_after_paid_output_validation');assert.equal(marker.newModelCalls,1);assert.equal(marker.feePlanConsumed,1);assert.equal(await verifyRecordedFailure(),true,'FAILED_JOB_NOT_VERIFIED');
 [ledgerPath,scopePath,receiptPath,markerPath].forEach((f,i)=>assert.equal(readFileSync(f,'utf8'),texts[i],'APPROVAL_STATE_CHANGED'));
 const extension={approval:fourthApproval,approvedAt:new Date().toISOString(),maxNewRequests:4,limitMicroCny:5000000,priceValidUntil:receipt.priceValidUntil,originalReceiptHash:sha(JSON.stringify(receipt)),approvedLedgerText:texts[0],approvedLedgerHash:sha(texts[0])};assertCrfApprovedLedger(ledger,receipt,extension);
 writeFileSync(extensionPath,JSON.stringify(extension,null,2),{flag:'wx',mode:0o600});
 const save=(file,value)=>{const tmp=file+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});renameSync(tmp,file);};
 save(markerPath,{...marker,status:'four_call_plan_approved',fourCallApproval:fourthApproval,previousStatus:marker.status,remainingApprovedRequests:3,nextActionRequiresFeePlanApproval:false});
 const enabled={...scope,paidAiApproved:true};delete enabled.implementationHold;save(scopePath,enabled);
 assert.equal(readFileSync(ledgerPath,'utf8'),texts[0]);assert.equal(readFileSync(receiptPath,'utf8'),texts[2]);return extension;
}
export function startCrfExtendedRound({ledgerPath,receiptPath,markerPath,extensionPath,key}){
 const ledger=JSON.parse(readFileSync(ledgerPath)),receipt=JSON.parse(readFileSync(receiptPath)),extension=readCrfCallExtension(extensionPath),marker=JSON.parse(readFileSync(markerPath));assert(extension);assertCrfApprovedLedger(ledger,receipt,extension);assert(Date.parse(receipt.priceValidUntil)>Date.now());assert.equal(readFileSync(ledgerPath,'utf8'),extension.approvedLedgerText);
 assert.equal(marker.status,'four_call_plan_approved');assert.equal(marker.fourCallApproval,fourthApproval);assert(!marker.extensionExecutionStartedAt,'NO_AUTOMATIC_PAID_RERUN');assert(typeof key==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(key));const next={...marker,extensionExecutionKey:key,extensionExecutionStartedAt:new Date().toISOString()},temp=markerPath+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(next,null,2),{flag:'wx',mode:0o600});renameSync(temp,markerPath);return next;
}
export function activateCrfMethodsAi({ledgerPath,scopePath,receiptPath,checkedAt}){
 for(const f of [ledgerPath,scopePath]){const s=lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0);}
 const scope=JSON.parse(readFileSync(scopePath)),budget=new LocalAiBudget(ledgerPath);assert(scope.schema==='rh-synthetic-crf-method-scope.v1'&&scope.enabled===true&&scope.accounts.length===2&&['R01','R02','R03'].every(k=>scope.operations.includes(k)));
 if(existsSync(receiptPath)){const r=JSON.parse(readFileSync(receiptPath));assertCrfApprovedLedger(budget.read(),r);assert.equal(scope.paidAiApproved,true,'DO_NOT_RESTORE_REVOKED_APPROVAL');return r;}
 assert.equal(scope.paidAiApproved,false);assert(Number.isFinite(Date.parse(checkedAt))&&Date.parse(checkedAt)<=Date.now()&&Date.now()-Date.parse(checkedAt)<86400000);
 const originalLedgerText=readFileSync(ledgerPath,'utf8'),old=JSON.parse(originalLedgerText);assert.equal(old.limitMicroCny,5000000);assert(old.records.every(r=>r.status==='known'));assert(old.records.reduce((n,r)=>n+r.costMicroCny,0)<5000000);
 const receipt={approval,checkedAt,priceValidUntil:new Date(Date.parse(checkedAt)+86400000).toISOString(),source:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',model:'deepseek-v4-pro',inputMicroCnyPerToken:9,outputMicroCnyPerToken:27,maxNewRequests:3,originalLedgerText,originalLedgerHash:sha(originalLedgerText)};
 writeFileSync(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});budget.atomic(s=>{assert.deepEqual(s,old,'LEDGER_CHANGED_DURING_APPROVAL');s.priceValidUntil=receipt.priceValidUntil;});
 const temp=scopePath+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify({...scope,paidAiApproved:true},null,2),{flag:'wx',mode:0o600});renameSync(temp,scopePath);assertCrfApprovedLedger(budget.read(),receipt);return receipt;
}
// Separate explicit approval: never renew the quote or reset the original three-call allowance.
export async function resumeCrfMethodsAi({ledgerPath,scopePath,receiptPath,markerPath,approval,verifyUnconsumed}){
 assert.equal(approval,'2026-10-25-user-approved-minimal-terminal-storage-fix');
 for(const f of [ledgerPath,scopePath,receiptPath,markerPath]){const s=lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0);}
 const ledgerText=readFileSync(ledgerPath,'utf8'),receiptText=readFileSync(receiptPath,'utf8'),scopeText=readFileSync(scopePath,'utf8'),markerText=readFileSync(markerPath,'utf8'),ledger=JSON.parse(ledgerText),receipt=JSON.parse(receiptText),scope=JSON.parse(scopeText),marker=JSON.parse(markerText);
 assertCrfApprovedLedger(ledger,receipt);assert(Date.parse(receipt.priceValidUntil)>Date.now(),'ORIGINAL_QUOTE_EXPIRED');assert.equal(ledger.records.length,JSON.parse(receipt.originalLedgerText).records.length,'ORIGINAL_ROUND_ALREADY_CONSUMED');
 assert.equal(scope.paidAiApproved,false);assert.equal(scope.implementationHold,'terminal-run-binding-review');assert.equal(scope.enabled,true);assert.equal(marker.status,'blocked_before_provider');assert.equal(marker.newModelCalls,0);assert.equal(marker.feePlanConsumed,0);assert.equal(marker.nextActionRequiresStorageSpecApproval,true);assert(!marker.executionStartedAt);
 assert.equal(await verifyUnconsumed(),true,'ACTUAL_JOB_METADATA_NOT_VERIFIED');
 for(const[f,text]of [[ledgerPath,ledgerText],[receiptPath,receiptText],[scopePath,scopeText],[markerPath,markerText]])assert.equal(readFileSync(f,'utf8'),text,'RESUME_STATE_CHANGED');
 // Record approval first. A crash cannot silently enable a paid endpoint.
 const resumed={...marker,previousStatus:marker.status,status:'resumed_after_storage_approval',resumeApproval:approval,resumedAt:new Date().toISOString(),nextActionRequiresStorageSpecApproval:false};
 const markerTemp=markerPath+'.'+randomUUID()+'.tmp';writeFileSync(markerTemp,JSON.stringify(resumed,null,2),{flag:'wx',mode:0o600});renameSync(markerTemp,markerPath);
 const enabled={...scope,paidAiApproved:true};delete enabled.implementationHold;const temp=scopePath+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(enabled,null,2),{flag:'wx',mode:0o600});renameSync(temp,scopePath);
 assert.equal(readFileSync(ledgerPath,'utf8'),ledgerText);assert.equal(readFileSync(receiptPath,'utf8'),receiptText);return{resumed:true,originalQuotePreserved:true,remainingRequests:3};
}
export function startCrfPaidRound({ledgerPath,receiptPath,markerPath,key}){
 const ledger=JSON.parse(readFileSync(ledgerPath)),receipt=JSON.parse(readFileSync(receiptPath)),marker=JSON.parse(readFileSync(markerPath));assertCrfApprovedLedger(ledger,receipt);assert(Date.parse(receipt.priceValidUntil)>Date.now());assert.equal(ledger.records.length,JSON.parse(receipt.originalLedgerText).records.length);
 assert.equal(marker.status,'resumed_after_storage_approval');assert.equal(marker.resumeApproval,'2026-10-25-user-approved-minimal-terminal-storage-fix');assert.equal(marker.newModelCalls,0);assert.equal(marker.feePlanConsumed,0);assert(!marker.executionStartedAt,'NO_AUTOMATIC_PAID_RERUN');assert(typeof key==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(key));
 const started={...marker,executionKey:key,executionStartedAt:new Date().toISOString()},temp=markerPath+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(started,null,2),{flag:'wx',mode:0o600});renameSync(temp,markerPath);return started;
}
