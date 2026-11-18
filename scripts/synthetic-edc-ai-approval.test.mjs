import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {activateSyntheticEdcAi,assertApprovedEdcLedger} from './synthetic-edc-ai-approval.mjs';
test('one approved price revalidation preserves original calls and cap; never tops up or silently extends',()=>{
 const dir=mkdtempSync(tmpdir()+'/rh-edc-approval-'),ledgerPath=dir+'/budget.json',scopePath=dir+'/scope.json',receiptPath=dir+'/receipt.json',checkedAt=new Date().toISOString();
 const original={schema:'rh-knowledge-ai-20261022',limitMicroCny:5000000,priceValidUntil:'2000-01-01T00:00:00Z',records:[{id:'old',status:'known',costMicroCny:20}]},scope={schema:'rh-synthetic-edc-scope.v1',enabled:true,accounts:['owner','admin'],operations:['capture','explain','report'],paidAiApproved:false};
 writeFileSync(ledgerPath,JSON.stringify(original),{mode:0o600});writeFileSync(scopePath,JSON.stringify(scope),{mode:0o600});
 activateSyntheticEdcAi({ledgerPath,scopePath,receiptPath,checkedAt});const first=readFileSync(ledgerPath,'utf8'),r=JSON.parse(readFileSync(receiptPath));assert.deepEqual(JSON.parse(first).records,original.records);assert.equal(JSON.parse(first).limitMicroCny,5000000);assert.deepEqual(JSON.parse(readFileSync(scopePath)),{...scope,paidAiApproved:true});assertApprovedEdcLedger(JSON.parse(first),r);
 activateSyntheticEdcAi({ledgerPath,scopePath,receiptPath,checkedAt:new Date(Date.now()+1000).toISOString()});assert.equal(readFileSync(ledgerPath,'utf8'),first);
 for(const bad of [{...JSON.parse(first),records:[]},{...JSON.parse(first),limitMicroCny:5000001},{...JSON.parse(first),priceValidUntil:'2099-01-01'},{...JSON.parse(first),records:[...original.records,{status:'unknown',reservedMicroCny:100}]}])assert.throws(()=>assertApprovedEdcLedger(bad,r));
});
