// Explicit genuine AI verification. Never imported by free gates or startup.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {LocalAiBudget} from './knowledge-ai-contract.mjs';
assert.equal(process.argv[2],'--case');const mode=process.argv[3];assert(['preflight','answer','inflight'].includes(mode));
const root='/Users/mac/aisciencesys/',local=root+'.tmp/researchhub-knowledge-local/',r=JSON.parse(readFileSync(local+'runtime.json')),key='edc-ai-'+randomUUID().slice(0,12),out=root+'docs/test/evidence/2026-10-23-researchhub-wp06-synthetic-edc/'+mode+'-'+key+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,contexts=[],checks=[],ledger=new LocalAiBudget(local+'ai-budget-20261022.json'),before=ledger.read(),hash=()=>createHash('sha256').update(readFileSync(ledger.path)).digest('hex'),beforeHash=hash();
async function json(res,status){assert.equal(res.status(),status,await res.text());return res.json();}
const fixtures={};
try{
 for(const actor of mode==='preflight'?['owner','admin']:['owner']){
  const c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project}});contexts.push(c);await json(await c.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}}),201);
  const parent=JSON.parse(readFileSync(root+'.tmp/researchhub-wp05-execution-preparation/e2e-'+actor+'.json')),planId=parent.planId,prep=await json(await c.get('/api/research-plan-drafts/'+planId+'/execution-preparation'),200),path='/api/research-plan-drafts/'+planId+'/synthetic-collections';
  let v=(await json(await c.post(path,{data:{parentRootVersionNo:prep.version,preparationRevisionNo:prep.revisionNo,visitKeys:prep.config.visits.slice(0,2).map(v=>v.key),subjectCount:3,requestKey:key+'-'+actor}}),201)).collection;const endpoint=path+'/'+v.id;
  v=(await json(await c.post(endpoint+'/quality-snapshots',{data:{baseVersionNo:v.version,requestKey:key+'-dq-'+actor}}),201)).collection;
  const body={baseVersionNo:v.version,requestKey:key+'-explain-'+actor,qualityId:v.quality.id,findingIds:[v.quality.findings[0].findingId]},url=endpoint+'/explanation-jobs';
  if(mode==='preflight'){
   assert.equal((await c.post(url,{data:{...body,extra:1}})).status(),400);assert.equal((await c.post(url,{data:body})).status(),403);assert.equal((await json(await c.get(endpoint),200)).version,v.version);checks.push(actor+'-strict-body-no-fee-without-local-approval-no-version-change');continue;
  }
  assert(!ledger.status().blocked);const queued=(await json(await c.post(url,{data:body}),201)).collection;assert(queued.job?.id);assert.equal(queued.dataRevision,v.dataRevision);assert.equal(queued.version,v.version+1);const duplicate=(await json(await c.post(url,{data:body}),201)).collection;assert.equal(duplicate.job.id,queued.job.id);assert.equal(duplicate.version,queued.version);checks.push('same-key-same-job-atomic-pending-parent-not-advanced');
  if(mode==='inflight'){
   const deadline=Date.now()+90000;while(ledger.read().records.length===before.records.length&&Date.now()<deadline){await new Promise(ok=>setTimeout(ok,300));}assert(ledger.read().records.length>before.records.length,'PROVIDER_NOT_STARTED');
   const current=await json(await c.get(endpoint),200),record=current.records[0],number=current.config.form.schema.fields.find(f=>['number','integer'].includes(f.type));assert(number);await json(await c.post(endpoint+'/records/'+record.recordId+'/drafts',{data:{baseVersionNo:current.version,baseResponseRevision:record.responseRevision,requestKey:key+'-edit-inflight',answers:{[number.key]:{state:'value',value:0}}}}),201);checks.push('real-provider-request-inflight-data-edit');
  }
  const deadline=Date.now()+150000;let result;
  do{await new Promise(ok=>setTimeout(ok,500));result=await json(await c.get(endpoint),200);}while(['queued','processing'].includes(result.job?.status)&&Date.now()<deadline);
  writeFileSync(out+'packet-result.json',JSON.stringify(result,null,2));
  if(mode==='answer'){
   assert.equal(result.job?.status,'completed',JSON.stringify(result.job));assert.equal(result.explanation?.status,'current');assert(result.explanation.items.length>0);assert(result.explanation.items.every(i=>body.findingIds.includes(i.findingId)));const e=result.explanation;
   const state=await json(await c.get('/api/sessions/'+e.sessionId+'/knowledge-state?limit=100'),200),m=state.messages.find(m=>m.id===e.resultMessageId);assert.equal(m?.meta?.sourceStatus,'current');const source=await json(await c.get('/api/sessions/'+e.sessionId+'/knowledge-sources/'+e.resultMessageId+'/1'),200);assert.equal(source.status,'current');assert.equal(source.quote,e.sources[0].quote);checks.push('real-agent-known-provider-kb-search-cited-json-and-both-old-read-routes');
   const record=result.records[0],number=result.config.form.schema.fields.find(f=>['number','integer'].includes(f.type));await json(await c.post(endpoint+'/records/'+record.recordId+'/drafts',{data:{baseVersionNo:result.version,baseResponseRevision:record.responseRevision,requestKey:key+'-after-answer',answers:{[number.key]:{state:'value',value:0}}}}),201);
   const stale=await json(await c.get(endpoint),200);assert.equal(stale.explanation.status,'stale');const staleState=await json(await c.get('/api/sessions/'+e.sessionId+'/knowledge-state?limit=100'),200);assert.equal(staleState.messages.find(m=>m.id===e.resultMessageId)?.meta?.sourceStatus,'stale');const oldSource=await json(await c.get('/api/sessions/'+e.sessionId+'/knowledge-sources/'+e.resultMessageId+'/1'),200);assert.equal(oldSource.status,'stale');assert.equal(oldSource.historical,true);assert.equal(oldSource.quote,source.quote);checks.push('actual-data-change-stales-packet-message-and-original-source-without-swapping');
  }else{assert.equal(result.job?.status,'failed',JSON.stringify(result.job));assert.equal(result.explanation,null);checks.push('actual-inflight-edit-prevents-assistant-publication');}
  const afterParent=await json(await c.get('/api/research-plan-drafts/'+planId+'/execution-preparation'),200);assert.equal(afterParent.version,prep.version);fixtures[actor]={planId,id:v.id,path:endpoint,jobId:queued.job.id,request:body,sessionId:v.binding.sessionId};
 }
 const after=ledger.read();assert.deepEqual(after.records.slice(0,before.records.length),before.records);assert.equal(after.limitMicroCny,5000000);assert(after.records.every(r=>r.status==='known'));if(mode==='preflight')assert.equal(hash(),beforeHash);
 writeFileSync(out+'result.json',JSON.stringify({passed:true,mode,checks,fixtures,newCalls:after.records.length-before.records.length,budget:ledger.status()},null,2));writeFileSync(root+'.tmp/researchhub-wp06-synthetic-edc/ai-'+mode+'.json',JSON.stringify(fixtures),{mode:0o600});console.log(JSON.stringify({passed:true,mode,checks:checks.length,newCalls:after.records.length-before.records.length,budget:ledger.status(),evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,mode,checks,message:e.message,budget:ledger.status()},null,2));throw e;}finally{for(const c of contexts)await c.dispose();}
