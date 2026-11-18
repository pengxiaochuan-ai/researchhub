// Explicit one-time local fee approval; not called by server startup or polling.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,lstatSync,renameSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {LocalAiBudget} from './knowledge-ai-contract.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),approval='2026-10-25-user-WP06-C06-CNY5-cumulative-no-topup';
export function assertApprovedEdcLedger(current,receipt){
 assert.equal(receipt.approval,approval);assert.equal(sha(receipt.originalLedgerText),receipt.originalLedgerHash);const old=JSON.parse(receipt.originalLedgerText);
 assert.deepEqual({...current,records:undefined,priceValidUntil:undefined},{...old,records:undefined,priceValidUntil:undefined});assert.equal(current.limitMicroCny,5000000);assert.equal(current.priceValidUntil,receipt.priceValidUntil);assert(current.records.length>=old.records.length);assert.deepEqual(current.records.slice(0,old.records.length),old.records);
 assert(current.records.every(r=>r.status==='known'&&Number.isSafeInteger(r.costMicroCny)&&r.costMicroCny>=0));assert(current.records.reduce((n,r)=>n+r.costMicroCny,0)<=5000000);return true;
}
export function activateSyntheticEdcAi({ledgerPath,scopePath,receiptPath,checkedAt}){
 for(const file of [ledgerPath,scopePath]){const s=lstatSync(file);assert(!s.isSymbolicLink()&&(s.mode&0o077)===0,'PRIVATE_LOCAL_FILE_REQUIRED');}
 const scope=JSON.parse(readFileSync(scopePath)),budget=new LocalAiBudget(ledgerPath);assert(scope.schema==='rh-synthetic-edc-scope.v1'&&scope.enabled===true&&scope.accounts.length===2&&scope.operations.includes('explain'),'CURRENT_SCOPE_REQUIRED');
 if(existsSync(receiptPath)){const r=JSON.parse(readFileSync(receiptPath));assertApprovedEdcLedger(budget.read(),r);assert.equal(scope.paidAiApproved,true,'DO_NOT_RESTORE_REVOKED_APPROVAL');return r;}
 assert(scope.paidAiApproved===false);assert(Number.isFinite(Date.parse(checkedAt))&&Date.parse(checkedAt)<=Date.now()&&Date.now()-Date.parse(checkedAt)<86400000,'FRESH_PUBLIC_PRICE_REQUIRED');
 const originalLedgerText=readFileSync(ledgerPath,'utf8'),old=JSON.parse(originalLedgerText);assert.equal(old.limitMicroCny,5000000);assert(old.records.every(r=>r.status==='known'));assert(old.records.reduce((n,r)=>n+r.costMicroCny,0)<5000000);
 const receipt={approval,checkedAt,priceValidUntil:new Date(Date.parse(checkedAt)+86400000).toISOString(),source:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',model:'deepseek-v4-pro',inputMicroCnyPerToken:9,outputMicroCnyPerToken:27,originalLedgerHash:sha(originalLedgerText),originalLedgerText,scopeBefore:scope};
 writeFileSync(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});budget.atomic(s=>{assert.deepEqual(s,old,'LEDGER_CHANGED_DURING_APPROVAL');s.priceValidUntil=receipt.priceValidUntil;});
 const tmp=scopePath+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify({...scope,paidAiApproved:true},null,2),{flag:'wx',mode:0o600});renameSync(tmp,scopePath);assertApprovedEdcLedger(budget.read(),receipt);return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.deepEqual(process.argv.slice(2),['--approve-20261025-C06']);const dir='/Users/mac/aisciencesys/.tmp/researchhub-knowledge-local/';
 const r=activateSyntheticEdcAi({ledgerPath:dir+'ai-budget-20261022.json',scopePath:dir+'wp06-scope.json',receiptPath:dir+'wp06-ai-approval-20261025.json',checkedAt:'2026-10-25T02:59:56.000Z'});
 console.log(JSON.stringify({approved:true,originalLedgerHash:r.originalLedgerHash,priceValidUntil:r.priceValidUntil,scope:'original-two-accounts-current-study-own-packets',topup:false}));
}
