import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalAiBudget,buildSourceSnapshot,sourceState,assertAnswer,bindKnowledgeSearchArgs} from './knowledge-ai-contract.mjs';

const doc={id:'doc',kbId:'kb',version:2,contentMd:'合成方案，研究者待确认。',reviewed:true,status:'published',safetyLevel:'safe',trashedAt:null};
const chunk={id:'chunk',docId:'doc',kbId:'kb',text:doc.contentMd,reviewed:true,page:null,section:'问题'};
const hit={chunkId:'chunk',docId:'doc',kbId:'kb',docTitle:'合成方案',kbName:'合成资料',snippet:chunk.text,via:'vector'};
test('optional model kbId is bound to the server current library, never widened',()=>{
 assert.deepEqual(JSON.parse(bindKnowledgeSearchArgs('{"query":"q"}','kb','q')),{query:'q',kbId:'kb'});
 assert.throws(()=>bindKnowledgeSearchArgs('{"query":"q","kbId":"foreign"}','kb','q'),/SCOPE/);
 assert.throws(()=>bindKnowledgeSearchArgs('{"query":"changed"}','kb','q'),/QUERY/);
});
test('source binds actual reviewed chunk, content/version and position without invented page',()=>{
 const s=buildSourceSnapshot(hit,doc,chunk);assert.equal(s.version,2);assert.equal(s.chunkId,'chunk');assert.equal(s.page,null);assert.equal(s.quote,chunk.text);assert.match(s.contentHash,/^[a-f0-9]{64}$/);
 assert.equal(sourceState(s,doc,chunk),'current');assert.equal(sourceState(s,{...doc,version:3},chunk),'stale');
 assert.equal(sourceState(s,doc,{...chunk,docId:'foreign'}),'restricted');
 for(const d of [null,{...doc,reviewed:false},{...doc,trashedAt:new Date()},{...doc,status:'draft'}])assert.equal(sourceState(s,d,chunk),'restricted');
 assert.throws(()=>buildSourceSnapshot(hit,{...doc,reviewed:false},chunk));assert.throws(()=>buildSourceSnapshot({...hit,snippet:'旧分块'},doc,chunk));
});
test('AI success requires actual model, evidence, valid numbered citations and no fallback',()=>{
 const r={finalText:'方案仍待确认 [1]。',usedMock:false,providerOutcome:'known',usage:{totalTokens:10},provenance:{}};
 assert.doesNotThrow(()=>assertAnswer(r,[buildSourceSnapshot(hit,doc,chunk)]));
 for(const bad of [{...r,usedMock:true},{...r,providerOutcome:'none'},{...r,finalText:'无来源'},{...r,finalText:'伪造来源 [2]'},{...r,provenance:{deterministicSynthesisFallback:true}}])assert.throws(()=>assertAnswer(bad,[hit]));
 assert.throws(()=>assertAnswer(r,[]));
});
function budget(limit=5_000_000){const path=join(mkdtempSync(join(tmpdir(),'rh-ai-budget-')),'ledger.json');return{path,b:new LocalAiBudget(path,{limitMicroCny:limit})};}
test('expired shared quote still blocks ordinary callers; only a trusted live check can reserve',()=>{
 const {b,path}=budget();const s=b.read();s.priceValidUntil=new Date(Date.now()-1000).toISOString();writeFileSync(path,JSON.stringify(s));
 assert.throws(()=>b.reserve({inputBytes:100,maxTokens:50}),/QA_PRICE_EXPIRED/);
 assert.throws(()=>b.reserve({inputBytes:100,maxTokens:50,verifyPriceRenewal:()=>false}),/QA_PRICE_EXPIRED/);
 const row=b.reserve({inputBytes:100,maxTokens:50,verifyPriceRenewal:()=>true});assert.equal(row.status,'reserved');assert.equal(b.status().pricingExpired,true);
 assert.throws(()=>b.reserve({inputBytes:100,maxTokens:50,verifyPriceRenewal:()=>true}),/QA_CALL_PENDING/);
 b.unknown(row.id);assert.throws(()=>b.reserve({inputBytes:100,maxTokens:50,verifyPriceRenewal:()=>true}),/QA_OUTCOME_UNKNOWN/);
});
test('durable reservations and settled costs share a cap, not reset on restart',()=>{
 const{path,b}=budget();const r=b.reserve({inputBytes:1000,maxTokens:1000});assert.ok(r.reservedMicroCny>0);
 b.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});
 const restarted=new LocalAiBudget(path);assert.equal(restarted.status().spentMicroCny,3600);assert.equal(restarted.status().limitMicroCny,5_000_000);
 const x=restarted.reserve({inputBytes:1000,maxTokens:1000});assert.throws(()=>restarted.reserve({inputBytes:1000,maxTokens:1000}),/PENDING/);
 restarted.unknown(x.id);assert.throws(()=>new LocalAiBudget(path).reserve({inputBytes:1000,maxTokens:1000}),/UNKNOWN/);
 assert.ok(JSON.parse(readFileSync(path)).records.length===2);
});
test('cap rejection happens before dispatch and malformed usage remains unknown',()=>{
 const{b}=budget(100);assert.throws(()=>b.reserve({inputBytes:100,maxTokens:100}),/BUDGET/);
 const{b:c}=budget();const r=c.reserve({inputBytes:100,maxTokens:100});assert.throws(()=>c.settle(r.id,{prompt_tokens:1,completion_tokens:1000,total_tokens:1001}),/USAGE/);assert.equal(c.status().blocked,true);
});
test('a second call cannot exceed the cumulative cap after a known first bill',()=>{
 const{b}=budget(90000);const r=b.reserve({inputBytes:100,maxTokens:100});b.settle(r.id,{prompt_tokens:8500,completion_tokens:100,total_tokens:8600});
 assert.equal(b.status().spentMicroCny,79200);assert.throws(()=>b.reserve({inputBytes:100,maxTokens:100}),/BUDGET/);assert.equal(b.status().calls,1);
});
test('an expired pricing receipt blocks new spend without resetting the ledger',()=>{
 const{b}=budget();b.atomic(s=>{s.priceValidUntil='2000-01-01T00:00:00.000Z';});assert.equal(b.status().pricingExpired,true);assert.throws(()=>b.reserve({inputBytes:100,maxTokens:100}),/PRICE_EXPIRED/);assert.equal(b.status().calls,0);
});
test('verified purpose extension can reserve under ten yuan without changing the original five-yuan ledger cap',()=>{
 const {b,path}=budget();b.atomic(s=>{s.records.push({id:'known-baseline',status:'known',costMicroCny:4_990_000});});const prefix=JSON.stringify(b.read());
 assert.throws(()=>b.reserve({inputBytes:100,maxTokens:100}),/QA_BUDGET_EXCEEDED/);
 const r=b.reserve({inputBytes:100,maxTokens:100,verifyBudgetExtension:()=>10_000_000});assert.equal(r.status,'reserved');assert.equal(b.read().limitMicroCny,5_000_000);assert.equal(JSON.stringify({...b.read(),records:b.read().records.slice(0,1)}),prefix);
 b.settle(r.id,{prompt_tokens:100,completion_tokens:100,total_tokens:200});assert.equal(new LocalAiBudget(path).status().limitMicroCny,5_000_000);
 assert.throws(()=>b.reserve({inputBytes:100,maxTokens:100}),/QA_BUDGET_EXCEEDED/);
});
test('purpose budget extension rejects a false or excessive capability and never allows total beyond ten yuan',()=>{
 for(const value of [false,10_000_001,20_000_000]){const{b}=budget();assert.throws(()=>b.reserve({inputBytes:100,maxTokens:100,verifyBudgetExtension:()=>value}),/QA_BUDGET_EXTENSION/);assert.equal(b.read().records.length,0);}
 const{b}=budget();b.atomic(s=>{s.records.push({id:'prior',status:'known',costMicroCny:9_990_000});});assert.throws(()=>b.reserve({inputBytes:100,maxTokens:100,verifyBudgetExtension:()=>10_000_000}),/QA_BUDGET_EXCEEDED/);assert.equal(b.read().records.length,1);
});
