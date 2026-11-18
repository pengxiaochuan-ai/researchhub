import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,openSync,closeSync,unlinkSync,renameSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';

export const hashText=text=>createHash('sha256').update(text).digest('hex');
export function bindKnowledgeSearchArgs(args,kbId,query){
 const input=JSON.parse(args);assert.ok(input&&typeof input==='object'&&!Array.isArray(input),'QA_TOOL_ARGS');
 assert.ok(!input.kbId||input.kbId===kbId,'QA_SCOPE_CHANGED');assert.equal(input.query,query,'QA_QUERY_CHANGED');
 return JSON.stringify({...input,kbId});
}
const fail=code=>{throw new Error(code);};
const published=doc=>doc&&doc.reviewed===true&&doc.status==='published'&&!doc.trashedAt&&doc.safetyLevel!=='blocked';
export function buildSourceSnapshot(hit,doc,chunk){
  assert.ok(published(doc)&&chunk?.reviewed&&hit.docId===doc.id&&hit.kbId===doc.kbId&&chunk.docId===doc.id&&chunk.kbId===doc.kbId&&chunk.id===hit.chunkId&&chunk.text.slice(0,500)===hit.snippet,'QA_SOURCE_CHANGED');
  return{docId:doc.id,kbId:doc.kbId,chunkId:chunk.id,docTitle:hit.docTitle,kbName:hit.kbName,version:doc.version,contentHash:hashText(doc.contentMd),chunkHash:hashText(chunk.text),quote:hit.snippet.replace(/\s+/g,' ').slice(0,200),page:hit.page??null,section:hit.section??null,via:hit.via,retrievedAt:new Date().toISOString()};
}
export function sourceState(source,doc,chunk){
  if(!published(doc)||doc.id!==source.docId||doc.kbId!==source.kbId)return'restricted';
  if(chunk&&(chunk.id!==source.chunkId||chunk.docId!==doc.id||chunk.kbId!==doc.kbId))return'restricted';
  if(doc.version!==source.version||hashText(doc.contentMd)!==source.contentHash||!chunk?.reviewed||hashText(chunk.text)!==source.chunkHash)return'stale';
  return'current';
}
export function assertAnswer(result,sources){
  assert.ok(result.providerOutcome==='known'&&result.usedMock===false&&result.usage&&sources.length&&!result.provenance?.deterministicSynthesisFallback&&!result.provenance?.dataBoundaryBlocked&&!result.provenance?.numericBoundaryBlocked,'QA_MODEL_NOT_DELIVERABLE');
  const refs=[...result.finalText.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
  assert.ok(refs.length&&refs.every(n=>Number.isSafeInteger(n)&&n>=1&&n<=sources.length),'QA_CITATION_INVALID');
}

// Local, single-host cap; intentionally not a new production billing subsystem.
export class LocalAiBudget{
  constructor(path,{limitMicroCny=5_000_000}={}){
    assert.ok(Number.isSafeInteger(limitMicroCny)&&limitMicroCny>=0&&limitMicroCny<=5_000_000,'QA_BUDGET_LIMIT');
    this.path=path;
    if(!existsSync(path))writeFileSync(path,JSON.stringify({schema:'rh-knowledge-ai-20261022',limitMicroCny,priceValidUntil:new Date(Date.now()+86400000).toISOString(),records:[]}),{flag:'wx',mode:0o600});
    if(!this.read().priceValidUntil)this.atomic(s=>{s.priceValidUntil=new Date(Date.parse(s.records[0]?.startedAt??new Date().toISOString())+86400000).toISOString();});
  }
  read(){const s=JSON.parse(readFileSync(this.path,'utf8'));assert.ok(s.schema==='rh-knowledge-ai-20261022'&&Number.isSafeInteger(s.limitMicroCny)&&s.limitMicroCny<=5_000_000&&s.limitMicroCny>=0&&Array.isArray(s.records),'QA_BUDGET_LEDGER_REJECTED');return s;}
  atomic(change){
    let fd;try{fd=openSync(this.path+'.lock','wx',0o600);}catch{fail('QA_BUDGET_LOCKED');}
    try{const s=this.read(),result=change(s),temp=this.path+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(s,null,2),{flag:'wx',mode:0o600});renameSync(temp,this.path);return result;}
    finally{closeSync(fd);unlinkSync(this.path+'.lock');}
  }
  status(){const s=this.read(),spent=s.records.reduce((n,r)=>n+(r.status==='known'?r.costMicroCny:0),0),held=s.records.reduce((n,r)=>n+(r.status!=='known'?r.reservedMicroCny:0),0),pricingExpired=!(Date.parse(s.priceValidUntil)>Date.now());return{limitMicroCny:s.limitMicroCny,spentMicroCny:spent,heldMicroCny:held,remainingMicroCny:Math.max(0,s.limitMicroCny-spent-held),calls:s.records.length,pricingExpired,priceValidUntil:s.priceValidUntil,blocked:pricingExpired||s.records.some(r=>r.status!=='known')||existsSync(this.path+'.lock')};}
  reserve({inputBytes,maxTokens,verifyPriceRenewal,verifyBudgetExtension}){
    return this.atomic(s=>{
      // Only a caller holding a separately validated, purpose-scoped receipt may renew this one reservation.
      if(!(Date.parse(s.priceValidUntil)>Date.now())&&(typeof verifyPriceRenewal!=='function'||verifyPriceRenewal()!==true))fail('QA_PRICE_EXPIRED');
      if(s.records.some(r=>r.status==='unknown'))fail('QA_OUTCOME_UNKNOWN');
      if(s.records.some(r=>r.status==='reserved'))fail('QA_CALL_PENDING');
      assert.ok(Number.isSafeInteger(inputBytes)&&inputBytes>0&&inputBytes<=64_000&&Number.isSafeInteger(maxTokens)&&maxTokens>0&&maxTokens<=2048,'QA_REQUEST_SIZE');
      const inputTokensUpper=4*inputBytes+8192,reservedMicroCny=inputTokensUpper*9+maxTokens*27;
      const limit=verifyBudgetExtension===undefined?s.limitMicroCny:verifyBudgetExtension();
      if(verifyBudgetExtension!==undefined&&limit!==10_000_000)fail('QA_BUDGET_EXTENSION');
      if(s.records.reduce((n,r)=>n+(r.status==='known'?r.costMicroCny:r.reservedMicroCny),0)+reservedMicroCny>limit)fail('QA_BUDGET_EXCEEDED');
      const row={id:randomUUID(),status:'reserved',startedAt:new Date().toISOString(),inputBytes,maxTokens,inputTokensUpper,reservedMicroCny};s.records.push(row);return row;
    });
  }
  settle(id,usage){
    this.atomic(s=>{const r=s.records.find(r=>r.id===id);assert.ok(r?.status==='reserved','QA_USAGE_RECORD');r.status='unknown';});
    return this.atomic(s=>{
      const r=s.records.find(r=>r.id===id);
      assert.ok(usage&&['prompt_tokens','completion_tokens','total_tokens'].every(k=>Number.isSafeInteger(usage[k])&&usage[k]>=0)&&usage.total_tokens===usage.prompt_tokens+usage.completion_tokens&&usage.prompt_tokens<=r.inputTokensUpper&&usage.completion_tokens<=r.maxTokens,'QA_USAGE_INVALID');
      Object.assign(r,{status:'known',usage:{promptTokens:usage.prompt_tokens,completionTokens:usage.completion_tokens,totalTokens:usage.total_tokens},costMicroCny:usage.prompt_tokens*9+usage.completion_tokens*27,endedAt:new Date().toISOString()});
    });
  }
  unknown(id){return this.atomic(s=>{const r=s.records.find(r=>r.id===id);assert.ok(r,'QA_USAGE_RECORD');if(r.status==='reserved')r.status='unknown';});}
}
