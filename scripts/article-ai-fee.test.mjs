import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {LocalAiBudget} from './knowledge-ai-contract.mjs';
const api=await import('./article-ai-fee.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const sha=v=>createHash('sha256').update(v).digest('hex'),ids={tenant:'synthetic',group:'group',project:'project',owner:'owner',admin:'admin'};
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'b07-fee-'));try{
 const now=Date.now(),base={schema:'rh-knowledge-ai-20261022',limitMicroCny:5000000,priceValidUntil:new Date(now-1000).toISOString(),records:Array.from({length:89},(_,i)=>({id:'prior-'+i,status:'known',costMicroCny:i===0?1931292:0}))};
 const path=join(dir,'ledger.json'),approvalPath=join(dir,'approval.json');writeFileSync(path,JSON.stringify(base),{mode:0o600});
 const approval={schema:'rh-article-fee-b07.v1',approvedAt:new Date(now-1000).toISOString(),scope:ids,baselineRecords:89,baselineHash:sha(JSON.stringify(base)),baselineRequests:10,baselineJobIds:Array.from({length:11},(_,i)=>'old-'+i),maxNewTasks:2,maxNewRequests:2,maxTasks:20,maxRequests:12,totalMicroCny:5000000,inputBytes:24000,maxTokens:1536,quote:{url:'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/',model:'deepseek-v4-pro',checkedAt:new Date(now).toISOString(),validUntil:new Date(now+3600000).toISOString(),inputMicroCnyPerToken:9,outputMicroCnyPerToken:27}};
 writeFileSync(approvalPath,JSON.stringify(approval),{mode:0o600});assert.equal(typeof api.LocalArticleFeeGuard,'function','B07 purpose guard missing');const budget=new LocalAiBudget(path),guard=new api.LocalArticleFeeGuard({approvalPath,budget,ids});return fn({guard,budget,path,approvalPath,approval,baseline:readFileSync(path,'utf8')});
 }finally{rmSync(dir,{recursive:true,force:true});}}
test('B07 two scoped requests share old five-yuan ledger without renewing any original price',()=>fixture(({guard,budget,baseline,path})=>{
 assert.equal(guard.status().canStart,true);assert.equal(budget.status().pricingExpired,true);assert.throws(()=>budget.reserve({inputBytes:100,maxTokens:100}),/QA_PRICE_EXPIRED/);
 for(const jobId of ['one','two']){const r=guard.reserve(jobId,{inputBytes:24000,maxTokens:1536});budget.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});}
 assert.equal(guard.status().canStart,false);assert.throws(()=>guard.reserve('three',{inputBytes:100,maxTokens:100}),/ARTICLE_REQUEST_LIMIT/);assert.equal(budget.read().records.length,91);
 const original=JSON.parse(baseline),current=JSON.parse(readFileSync(path));assert.deepEqual({...current,records:current.records.slice(0,89)},original);assert.equal(guard.externalCharges().requests,2);
}));
test('B07 unknown usage, duplicate Provider job, oversized input and unregistered charge fail closed',()=>{
 for(const kind of ['unknown','duplicate','oversize','unregistered'])fixture(({guard,budget,path})=>{
  if(kind==='oversize')return assert.throws(()=>guard.reserve('one',{inputBytes:24001,maxTokens:1536}),/ARTICLE_REQUEST_SIZE/);
  if(kind==='unregistered'){const s=budget.read();s.records.push({id:'forged',status:'known',costMicroCny:0});writeFileSync(path,JSON.stringify(s));return assert.throws(()=>guard.status(),/ARTICLE_UNREGISTERED_CHARGE/);}
  const r=guard.reserve('one',{inputBytes:100,maxTokens:100});if(kind==='unknown'){budget.unknown(r.id);assert.equal(guard.status().canStart,false);assert.throws(()=>guard.reserve('two',{inputBytes:100,maxTokens:100}),/ARTICLE_BUDGET_BLOCKED/);}else{budget.settle(r.id,{prompt_tokens:1,completion_tokens:1,total_tokens:2});assert.throws(()=>guard.reserve('one',{inputBytes:100,maxTokens:100}),/ARTICLE_NO_RETRY/);}
 });
});
test('B07 sealed prefix, expired quote and actor/task limits cannot be bypassed',()=>{
 for(const kind of ['prefix','price','actor','tasks'])fixture(({guard,budget,path,approvalPath,approval})=>{
  if(kind==='prefix'){const s=budget.read();s.records[0].costMicroCny=0;writeFileSync(path,JSON.stringify(s));return assert.throws(()=>guard.status(),/ARTICLE_BASELINE_CHANGED/);}
  if(kind==='price'){approval.approvedAt=new Date(Date.now()-7200000).toISOString();approval.quote.checkedAt=approval.approvedAt;approval.quote.validUntil=new Date(Date.now()-1).toISOString();writeFileSync(approvalPath,JSON.stringify(approval));return assert.equal(guard.status().canStart,false);}
  const jobs=approval.baselineJobIds.map(id=>({id,accountId:'owner',kind:'prior'}));
  if(kind==='actor')assert.throws(()=>guard.admitJobs(jobs,{accountId:'stranger'}),/ARTICLE_ACTOR_REJECTED/);
  else{jobs.push({id:'new-one',accountId:'owner',kind:'article'},{id:'new-two',accountId:'admin',kind:'article'});assert.throws(()=>guard.admitJobs(jobs,{accountId:'owner'}),/ARTICLE_TASK_LIMIT/);}
 });
});
test('B07 same owner in another Study or tenant cannot use the purpose approval',()=>fixture(({guard})=>{
 const user={accountId:ids.owner,tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project};
 guard.assertScope(user);for(const field of ['accountId','tenantId','studyGroupId','researchProjectId'])assert.throws(()=>guard.assertScope({...user,[field]:'other'}),/ARTICLE_ACTOR_REJECTED/);
}));

function followup(f){
 for(const id of ['b07-owner','b07-admin']){const r=f.guard.reserve(id,{inputBytes:100,maxTokens:100});f.budget.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});}
 const now=Date.now(),approvalPath=f.approvalPath+'.b08',base=f.budget.read();
 const approval={...f.approval,schema:'rh-article-fee-b08.v1',approvedAt:new Date(now-1).toISOString(),baselineRecords:91,baselineRequests:12,maxRequests:14,baselineHash:sha(JSON.stringify(base)),baselineJobIds:[...f.approval.baselineJobIds,'b07-owner','b07-admin'],previousApprovalHash:f.guard.approval().approvalHash,previousAttemptsHash:sha(JSON.stringify(f.guard.attempts())),quote:{...f.approval.quote,checkedAt:new Date(now).toISOString(),validUntil:new Date(now+3600000).toISOString()}};
 writeFileSync(approvalPath,JSON.stringify(approval),{mode:0o600});return{guard:new api.LocalArticleFeeGuard({approvalPath,budget:f.budget,ids,previous:f.guard}),approvalPath,approval,baseline:JSON.stringify(base)};
}
test('B08 appends only two requests to sealed B07 without changing old receipt, attempts or price',()=>fixture(f=>{
 const p=followup(f),oldReceipt=readFileSync(f.approvalPath,'utf8'),oldAttempts=JSON.stringify(f.guard.attempts());
 assert.equal(p.guard.status().canStart,true);assert.equal(p.guard.status().requests,12);assert.equal(p.guard.status().requestLimit,14);
 const jobs=p.approval.baselineJobIds.map(id=>({id,kind:'prior',accountId:'owner'}));
 for(const [accountId,jobId]of [['owner','b08-owner'],['admin','b08-admin']]){
  p.guard.admitJobs(jobs,{accountId});const r=p.guard.reserve(jobId,{inputBytes:100,maxTokens:100});f.budget.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});jobs.push({id:jobId,accountId,kind:'article'});assert.throws(()=>p.guard.admitJobs(jobs,{accountId}),/ARTICLE_TASK_LIMIT/);
 }
 assert.equal(p.guard.status().requests,14);assert.equal(p.guard.status().canStart,false);assert.throws(()=>p.guard.reserve('extra',{inputBytes:100,maxTokens:100}),/ARTICLE_REQUEST_LIMIT/);
 assert.equal(p.guard.externalCharges().requests,4);assert.equal(p.guard.externalCharges().accountedRequestLimit,14);
 assert.equal(readFileSync(f.approvalPath,'utf8'),oldReceipt);assert.equal(JSON.stringify(f.guard.attempts()),oldAttempts);assert.equal(JSON.stringify({...f.budget.read(),records:f.budget.read().records.slice(0,91)}),p.baseline);assert.equal(f.budget.status().pricingExpired,true);
}));
test('B08 rejects changed previous receipt or baseline, expired own price, unknown usage and previous job reuse',()=>{
 for(const kind of ['receipt','prefix','price','old-job','unknown'])fixture(f=>{
  const p=followup(f);
  if(kind==='receipt'){p.approval.previousApprovalHash='0'.repeat(64);writeFileSync(p.approvalPath,JSON.stringify(p.approval));return assert.throws(()=>p.guard.status(),/ARTICLE_FEE_PREVIOUS/);}
  if(kind==='prefix'){const s=f.budget.read();s.records[90].costMicroCny=0;writeFileSync(f.path,JSON.stringify(s));return assert.throws(()=>p.guard.status(),/ARTICLE_BASELINE_CHANGED/);}
  if(kind==='price'){const now=Date.now;try{Date.now=()=>now()+7200000;assert.equal(p.guard.status().canStart,false);}finally{Date.now=now;}return;}
  if(kind==='old-job')return assert.throws(()=>p.guard.reserve('b07-owner',{inputBytes:100,maxTokens:100}),/ARTICLE_JOB_INVALID/);
  const r=p.guard.reserve('b08-owner',{inputBytes:100,maxTokens:100});f.budget.unknown(r.id);assert.equal(p.guard.status().canStart,false);
 });
});
test('B08 delivery failure permanently pauses this phase without erasing the unused request',()=>fixture(f=>{
 const p=followup(f),r=p.guard.reserve('failed-delivery',{inputBytes:100,maxTokens:100});f.budget.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});
 assert.equal(typeof p.guard.halt,'function');p.guard.halt('ARTICLE_VALIDATION_FAILED');
 const restored=new api.LocalArticleFeeGuard({approvalPath:p.approvalPath,budget:f.budget,ids,previous:f.guard});
 assert.equal(restored.status().remainingRequests,1);assert.equal(restored.status().requests,13);assert.equal(restored.status().code,'ARTICLE_VALIDATION_HALTED');assert.equal(restored.status().canStart,false);
 assert.throws(()=>restored.reserve('admin-unused',{inputBytes:100,maxTokens:100}),/ARTICLE_BUDGET_BLOCKED/);assert.equal(restored.attempts().length,1);
}));
function resumeRemaining(f,p){
 const r=p.guard.reserve('failed-owner',{inputBytes:100,maxTokens:100});f.budget.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});p.guard.halt('ARTICLE_VALIDATION_FAILED');
 const now=Date.now(),receipt={schema:'rh-article-resume-b08.v1',approvedAt:new Date(now).toISOString(),approvalHash:p.guard.approval().approvalHash,haltHash:sha(readFileSync(p.approvalPath+'.halt.json','utf8')),attemptsPrefixHash:sha(JSON.stringify(p.guard.attempts().slice(0,1))),approvedAfterRequests:13,approvedAfterJobs:14,remainingRequests:1,maxRequests:14,maxTasks:20,totalMicroCny:5000000,quote:{...p.approval.quote,checkedAt:new Date(now).toISOString(),validUntil:new Date(now+3600000).toISOString()}};
 writeFileSync(p.approvalPath+'.resume.json',JSON.stringify(receipt),{mode:0o600});return receipt;
}
test('explicit B08 continuation resumes only the one unused request and preserves the failure and old prices',()=>fixture(f=>{
 const p=followup(f),receipt=resumeRemaining(f,p),halt=readFileSync(p.approvalPath+'.halt.json','utf8');
 assert.equal(p.guard.status().canStart,true);assert.equal(p.guard.status().requests,13);assert.equal(p.guard.status().remainingRequests,1);
 const jobs=[...p.approval.baselineJobIds.map(id=>({id,kind:'prior',accountId:'owner'})),{id:'failed-owner',kind:'article',accountId:'owner'}];assert.throws(()=>p.guard.admitJobs(jobs,{accountId:'owner'}),/ARTICLE_TASK_LIMIT/);assert(p.guard.admitJobs(jobs,{accountId:'admin'}).resumeHash);
 const r=p.guard.reserve('remaining-admin',{inputBytes:100,maxTokens:100});f.budget.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});assert.equal(p.guard.status().requests,14);assert.equal(p.guard.status().canStart,false);assert.throws(()=>p.guard.reserve('third',{inputBytes:100,maxTokens:100}),/ARTICLE_REQUEST_LIMIT/);
 assert.equal(readFileSync(p.approvalPath+'.halt.json','utf8'),halt);assert.equal(f.budget.status().pricingExpired,true);assert.equal(receipt.maxRequests,14);
}));
test('B08 continuation rejects altered bindings, expanded caps, unknown usage and expired effective quote',()=>{
 for(const mutation of ['halt','attempts','cap','unknown','price'])fixture(f=>{
  const p=followup(f),receipt=resumeRemaining(f,p);
  if(mutation==='unknown'){const s=f.budget.read();s.records.at(-1).status='unknown';writeFileSync(f.path,JSON.stringify(s));return assert.equal(p.guard.status().canStart,false);}
  if(mutation==='price'){const now=Date.now;try{Date.now=()=>now()+7200000;assert.equal(p.guard.status().canStart,false);}finally{Date.now=now;}return;}
  receipt[mutation==='halt'?'haltHash':mutation==='attempts'?'attemptsPrefixHash':'maxRequests']=mutation==='cap'?15:'0'.repeat(64);writeFileSync(p.approvalPath+'.resume.json',JSON.stringify(receipt));assert.throws(()=>p.guard.status(),/ARTICLE_RESUME_INVALID/);
 });
});
