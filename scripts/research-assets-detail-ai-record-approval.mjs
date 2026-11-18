// Run only after the explicit 2026-11-14 human approval. Never resets a receipt.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,lstatSync,existsSync} from 'node:fs';
import {hashText,LocalAiBudget} from './knowledge-ai-contract.mjs';
import {assetDetailAiCases} from './research-assets-detail-ai-cases.mjs';
import {AssetDetailAiFeeGuard} from './research-assets-detail-ai-fee.mjs';
assert.deepEqual(process.argv.slice(2),['--record-approved']);
const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-a02-asset-detail-ai/',path=dir+'fee-approval.json',ledgerPath=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json';
const evidence=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q07/',import.meta.url).pathname;
const admission=JSON.parse(readFileSync(evidence+'admission.json'));assert(admission.passed&&admission.sql.a02Jobs===0&&Date.now()-Date.parse(admission.at)<300000);
const bytes=readFileSync(ledgerPath,'utf8'),s=JSON.parse(bytes);assert.equal(s.records.length,96);assert(s.records.every(r=>r.status==='known'));assert.equal(s.records.reduce((n,r)=>n+r.costMicroCny,0),2166210);assert.equal(s.limitMicroCny,5000000);
const ids=Object.fromEntries(['tenant','group','project','owner','admin'].map(k=>[k,'rh-kb-local-b0e2af9d-'+k]));
mkdirSync(dir,{mode:0o700,recursive:true});const stat=lstatSync(dir);assert(stat.isDirectory()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0);assert(!existsSync(path),'A02_APPROVAL_ALREADY_EXISTS_DO_NOT_RESET');
const now=new Date().toISOString(),approval={schema:'rh-asset-detail-ai-fee-approval.v1',approvedAt:now,approvalSource:'User explicitly approved four-case proposal on 2026-11-14; do not infer further scope',scope:ids,cases:assetDetailAiCases(ids),baselineText:bytes,baselineHash:hashText(bytes),oldWindow:{tasks:11,requests:10},limits:{totalTasks:20,totalRequests:14,newTasks:4,newRequests:4,totalMicroCny:5000000,inputBytes:8192,maxTokens:1536},quote:{url:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',model:'deepseek-v4-pro',inputMicroCnyPerToken:9,outputMicroCnyPerToken:27,checkedAt:now,validUntil:new Date(Date.parse(now)+86400000).toISOString()},revocation:{assetId:'cmwewkt4d0021luy3207ld7x0',version:3,recipient:ids.owner,actions:['read_body','ai'],restore:false},reconciliation:{max:4,knownUsageOnly:true,historical:false}};
writeFileSync(path,JSON.stringify(approval,null,2),{flag:'wx',mode:0o600});assert.equal(readFileSync(ledgerPath,'utf8'),bytes);
const guard=new AssetDetailAiFeeGuard({approvalPath:path,budget:new LocalAiBudget(ledgerPath)}),status=guard.status();assert(status.canStart&&status.requests===10);
writeFileSync(evidence+'approval-recorded.json',JSON.stringify({at:now,approved:true,receiptHash:hashText(readFileSync(path,'utf8')),baselineRecords:96,baselineKnownMicroCny:2166210,oldWindow:approval.oldWindow,limits:approval.limits,cases:approval.cases,status,globalLedgerByteUnchanged:true,providerCalls:0,jobsCreated:0},null,2));
console.log('A02_APPROVAL_RECORDED_NO_CALL_OR_LEDGER_MUTATION');
