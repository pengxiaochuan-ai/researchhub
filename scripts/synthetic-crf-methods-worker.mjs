// Actual persisted CRF -> original local Python Worker, not the D01 code fixture.
import assert from'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{randomUUID,createHash}from'node:crypto';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root='/Users/mac/aisciencesys/',r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,contexts=[],key='wp07-worker-'+randomUUID().slice(0,8),fixtures={},checks=[];
const dir=root+'docs/test/evidence/2026-10-25-researchhub-wp07-crf-methods/'+key+'/';mkdirSync(dir,{recursive:true,mode:0o700});const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',sha=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=sha();
async function json(res,n){assert.equal(res.status(),n,await res.text());return res.json();}
async function finished(c,path,id){for(let n=0;n<35;n++){const{run}=await json(await c.get(path+'/method-runs/'+id),200);if(!['queued','validating','running'].includes(run.status))return run;await new Promise(ok=>setTimeout(ok,200));}assert.fail('real CRF method never reached an actual terminal result');}
try{
 for(const actor of['owner','admin']){
  const c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project}});contexts.push(c);await json(await c.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}}),201);
  const planId=JSON.parse(readFileSync(root+'.tmp/researchhub-wp05-execution-preparation/e2e-'+actor+'.json')).planId,parent='/api/research-plan-drafts/'+planId,prep=await json(await c.get(parent+'/execution-preparation'),200);
  let{collection:pack}=await json(await c.post(parent+'/synthetic-collections',{data:{parentRootVersionNo:prep.version,preparationRevisionNo:prep.revisionNo,visitKeys:prep.config.visits.slice(0,2).map(v=>v.key),subjectCount:3,requestKey:key+'-'+actor}}),201);const path=parent+'/synthetic-collections/'+pack.id,first=pack.records[0];
  const answers=Object.fromEntries(pack.config.form.schema.fields.filter(f=>['number','integer','boolean'].includes(f.type)).map(f=>[f.key,{state:'value',value:f.type==='boolean'?false:0}]));
  ({collection:pack}=await json(await c.post(path+'/records/'+first.recordId+'/drafts',{data:{baseVersionNo:pack.version,baseResponseRevision:first.responseRevision,answers,requestKey:key+'-save-'+actor}}),201));
  ({collection:pack}=await json(await c.post(path+'/quality-snapshots',{data:{baseVersionNo:pack.version,requestKey:key+'-dq-'+actor}}),201));
  const body={baseVersionNo:pack.version,qualityId:pack.quality.id,requestKey:key+'-run-'+actor},created=await json(await c.post(path+'/method-runs',{data:body}),201),run=await finished(c,path,created.run.id);assert.equal(run.status,'needs_review');assert.equal(run.sourceStatus,'current');assert.equal(run.reviewStatus,'pending_review');assert.equal(run.result.workerVersion,'t19-1');assert.equal(run.result.evidenceGroups.length,pack.config.form.schema.fields.length*2);
  const groups=run.result.evidenceGroups.filter(g=>g.visitKey===pack.records[0].visitKey);for(const g of groups.filter(g=>Object.hasOwn(answers,g.fieldKey))){assert.equal(g.missingRate,0.666667);assert.equal(g.n,3);}
  const trace=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/crf-method-traces/'+run.id+'.json'));assert.equal(trace.httpStatus,200);assert.equal(trace.request.requestId,run.id);assert.equal(trace.request.executorKey,'research-data-quality');assert.equal(trace.inputHash,run.inputHash);assert.equal(trace.manifestHash,run.result.manifestHash);assert(trace.executionToken&&trace.instanceId);assert(!JSON.stringify(trace).includes('x-research-methods-worker-token'));
  const duplicate=await json(await c.post(path+'/method-runs',{data:body}),201);assert.equal(duplicate.run.id,run.id);
  const current=await json(await c.get(path),200);assert.equal(current.version,pack.version);assert.equal(current.dataRevision,pack.dataRevision);assert.deepEqual(current.records,pack.records);
  ({collection:pack}=await json(await c.post(path+'/records/'+first.recordId+'/drafts',{data:{baseVersionNo:pack.version,baseResponseRevision:pack.records[0].responseRevision,answers:{},requestKey:key+'-change-'+actor}}),201));
  const stale=await json(await c.get(path+'/method-runs/'+run.id),200);assert.equal(stale.run.sourceStatus,'stale');assert.equal(stale.run.resultHash,run.resultHash);
  ({collection:pack}=await json(await c.post(path+'/quality-snapshots',{data:{baseVersionNo:pack.version,requestKey:key+'-newdq-'+actor}}),201));
  const next=await json(await c.post(path+'/method-runs',{data:{baseVersionNo:pack.version,qualityId:pack.quality.id,requestKey:key+'-newrun-'+actor}}),201),newRun=await finished(c,path,next.run.id);assert.equal(newRun.status,'needs_review');assert.notEqual(newRun.inputHash,run.inputHash);assert.notEqual(newRun.resultHash,run.resultHash);
  fixtures[actor]={planId,collectionId:pack.id,path,runId:newRun.id,compareRunId:run.id,version:pack.version};checks.push(actor+'-actual-saved-zero-false-python-trace-old-run-stale-explicit-new-run');
 }
 assert.equal(sha(),before);writeFileSync(dir+'result.json',JSON.stringify({passed:true,checks,fixtures,modelCalls:0},null,2));writeFileSync(root+'.tmp/researchhub-wp07-crf-methods/worker.json',JSON.stringify(fixtures),{mode:0o600});console.log(JSON.stringify({passed:true,checks:checks.length,evidence:dir,modelCalls:0}));
}catch(e){writeFileSync(dir+'failure.json',JSON.stringify({passed:false,checks,message:e.message},null,2));throw e;}finally{assert.equal(sha(),before);for(const c of contexts)await c.dispose();}
