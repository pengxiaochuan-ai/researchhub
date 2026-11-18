// New named packets only, actual same-origin HTTP. Never calls a model.
import assert from'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{randomUUID,createHash}from'node:crypto';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root='/Users/mac/aisciencesys/',r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),contexts=[],key='wp07-'+randomUUID().slice(0,12),dir=root+'docs/test/evidence/2026-10-25-researchhub-wp07-crf-methods/'+key+'/',fixtures={},checks=[];
mkdirSync(dir,{recursive:true,mode:0o700});const ledgerFile=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',sha=()=>createHash('sha256').update(readFileSync(ledgerFile)).digest('hex'),before=sha();
async function login(actor){const c=await (pw.request??pw.default.request).newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project}});contexts.push(c);assert.equal((await c.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}})).status(),201);return c;}
async function json(res,want){assert.equal(res.status(),want,await res.text());return res.json();}
try{
 for(const actor of['owner','admin']){
  const c=await login(actor),planId=JSON.parse(readFileSync(root+'.tmp/researchhub-wp05-execution-preparation/e2e-'+actor+'.json')).planId,parent='/api/research-plan-drafts/'+planId;
  const prep=await json(await c.get(parent+'/execution-preparation'),200);assert.equal(prep.sourceStatus,'current');assert.equal(prep.preparationStatus,'current');
  const {collection:created}=await json(await c.post(parent+'/synthetic-collections',{data:{parentRootVersionNo:prep.version,preparationRevisionNo:prep.revisionNo,visitKeys:prep.config.visits.slice(0,2).map(v=>v.key),subjectCount:3,requestKey:key+'-'+actor}}),201),path=parent+'/synthetic-collections/'+created.id;
  const {collection:pack}=await json(await c.post(path+'/quality-snapshots',{data:{baseVersionNo:created.version,requestKey:key+'-dq-'+actor}}),201);
  const preview=await json(await c.get(path+'/method-preview'),200);assert.equal(preview.collectionId,pack.id);assert.equal(preview.dataBasis.dataRevision,pack.dataRevision);assert(preview.groups.every(g=>g.n===3));
  const input={baseVersionNo:pack.version,qualityId:pack.quality.id,requestKey:key+'-run-'+actor};
  const responses=await Promise.all([c.post(path+'/method-runs',{data:input}),c.post(path+'/method-runs',{data:input})]);const a=await json(responses[0],201),b=await json(responses[1],201);assert.equal(a.run.id,b.run.id);assert.equal(a.operation.runId,a.run.id);
  assert.equal((await c.post(path+'/method-runs',{data:{...input,qualityId:'other'}})).status(),409);
  assert.equal((await c.post(path+'/method-runs',{data:{...input,requestKey:key+'-extra-'+actor,manifest:{}}})).status(),400);
  const detail=await json(await c.get(path+'/method-runs/'+a.run.id),200);assert.equal(detail.run.id,a.run.id);assert.equal(detail.run.inputHash,a.run.inputHash);assert.equal(detail.run.ownerAccountId,r.ids[actor]);
  const page=await json(await c.get(path+'/method-runs?limit=20'),200);assert.equal(page.items.length,1);assert.equal(page.items[0].id,a.run.id);
  const after=await json(await c.get(path),200),parentAfter=await json(await c.get(parent+'/execution-preparation'),200);assert.equal(after.version,pack.version);assert.equal(after.dataRevision,pack.dataRevision);assert.deepEqual(after.records,pack.records);assert.equal(parentAfter.version,prep.version);
  const racePack=await json(await c.post(parent+'/synthetic-collections',{data:{parentRootVersionNo:prep.version,preparationRevisionNo:prep.revisionNo,visitKeys:prep.config.visits.slice(0,2).map(v=>v.key),subjectCount:3,requestKey:key+'-race-pack-'+actor}}),201),racePath=parent+'/synthetic-collections/'+racePack.collection.id,raceQuality=await json(await c.post(racePath+'/quality-snapshots',{data:{baseVersionNo:1,requestKey:key+'-race-dq-'+actor}}),201);
  const competing=await Promise.all(['a','b'].map(n=>c.post(racePath+'/method-runs',{data:{baseVersionNo:raceQuality.collection.version,qualityId:raceQuality.collection.quality.id,requestKey:key+'-race-'+n+'-'+actor}})));assert.deepEqual(competing.map(x=>x.status()).sort(),[201,409]);
  assert.equal((await c.get(path+'/method-preview?manifest=evil')).status(),400);assert.equal((await c.get(path+'/method-runs/'+a.run.id+'?unknown=1')).status(),400);
  fixtures[actor]={planId,collectionId:pack.id,path,runId:a.run.id,version:pack.version};checks.push(actor+'-preview-freeze-own-immutable-input-idempotency-CAS-race-no-parent-write');
 }
 const admin=await login('admin');assert.equal((await admin.get(fixtures.owner.path+'/method-runs/'+fixtures.owner.runId)).status(),403);
 for(const actor of['viewer','uninvited']){const c=await login(actor);assert.equal((await c.get(fixtures.owner.path+'/method-preview')).status(),403);}checks.push('cross-owner-viewer-uninvited-rejected');
 assert.equal(sha(),before);writeFileSync(dir+'result.json',JSON.stringify({passed:true,checks,fixtures,modelCalls:0,ledgerUnchanged:true},null,2));
 mkdirSync(root+'.tmp/researchhub-wp07-crf-methods/',{recursive:true,mode:0o700});writeFileSync(root+'.tmp/researchhub-wp07-crf-methods/api.json',JSON.stringify(fixtures),{mode:0o600});console.log(JSON.stringify({passed:true,checks:checks.length,evidence:dir,modelCalls:0}));
}catch(e){writeFileSync(dir+'failure.json',JSON.stringify({passed:false,checks,message:e.message},null,2));throw e;}finally{assert.equal(sha(),before);for(const c of contexts)await c.dispose();}
