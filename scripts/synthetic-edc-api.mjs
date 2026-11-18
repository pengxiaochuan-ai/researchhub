// Actual HTTP on the existing local synthetic runtime; never starts an AI job.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
const root='/Users/mac/aisciencesys/',r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const mode=process.argv[3];assert.equal(process.argv[2],'--case');assert(['collection','draft','correction','quality'].includes(mode));
const key='edc-'+randomUUID().slice(0,12),dir=root+'docs/test/evidence/2026-10-23-researchhub-wp06-synthetic-edc/'+mode+'-'+key+'/';mkdirSync(dir,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,contexts=[];
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',hash=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=hash(),checks=[],fixtures={};
const runtimeAccount=actor=>r.ids[actor];
async function login(actor){const c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project}});contexts.push(c);assert.equal((await c.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}})).status(),201);return c;}
async function json(res,status){assert.equal(res.status(),status,await res.text());return res.json();}
try{
 for(const actor of ['owner','admin']){
  const c=await login(actor),prior=JSON.parse(readFileSync(root+'.tmp/researchhub-wp05-execution-preparation/e2e-'+actor+'.json')),planId=prior.planId,path='/api/research-plan-drafts/'+planId+'/synthetic-collections';
  const prep=await json(await c.get('/api/research-plan-drafts/'+planId+'/execution-preparation'),200);assert.equal(prep.preparationStatus,'current');assert.equal(prep.sourceStatus,'current');
  await json(await c.get(path+'?limit=20'),200); // RED: missing endpoint must not fall back to demo.
  const input={parentRootVersionNo:prep.version,preparationRevisionNo:prep.revisionNo,visitKeys:prep.config.visits.slice(0,2).map(v=>v.key),subjectCount:3,requestKey:key+'-'+actor};
  const competing=await Promise.all([c.post(path,{data:input}),c.post(path,{data:input})]),created=await json(competing[0],201),duplicate=await json(competing[1],201),v=created.collection;assert.equal(duplicate.collection.id,v.id);
  assert.equal(v.records.length,6);assert.equal(v.sourceStatus,'current');assert.equal(v.dataRevision,0);assert.equal(v.ownerAccountId,r.ids[actor]);
  const repeat=await json(await c.post(path,{data:input}),201);assert.equal(repeat.collection.id,v.id);assert.equal(repeat.collection.version,v.version);
  assert.equal((await c.post(path,{data:{...input,subjectCount:4}})).status(),409);
  assert.equal((await c.post(path,{data:{...input,requestKey:key+'-bad-'+actor,ownerAccountId:r.ids.admin}})).status(),400);
  const reread=await json(await c.get(path+'/'+v.id),200);assert.deepEqual(reread.records,v.records);
  const parent=await json(await c.get('/api/research-plan-drafts/'+planId+'/execution-preparation'),200);assert.equal(parent.version,prep.version);assert.equal(parent.preparationStatus,'current');
  const history=await json(await c.get(path+'/'+v.id+'/versions/1'),200);assert.equal(history.version,1);
  checks.push(actor+'-own-package-real-persistence-idempotency-history-parent-unchanged');fixtures[actor]={planId,id:v.id,path:path+'/'+v.id,version:v.version,recordId:v.records[0].recordId};
  if(mode==='draft'){
   const endpoint=fixtures[actor].path+'/records/'+v.records[0].recordId+'/drafts',field=v.config.form.schema.fields.find(f=>f.type==='number'||f.type==='integer');assert(field&&Number.isFinite(field.max));
   const body={baseVersionNo:v.version,baseResponseRevision:0,requestKey:key+'-save-'+actor,answers:{[field.key]:{state:'value',value:field.max+1}}};
   const saved=await json(await c.post(endpoint,{data:body}),201);assert.equal(saved.collection.dataRevision,1);assert.equal(saved.collection.records[0].responseRevision,1);assert.equal(saved.collection.records[0].answers[field.key].value,field.max+1);assert(saved.collection.records[0].validation.findings.some(f=>f.ruleKey==='D02'));
   const again=await json(await c.post(endpoint,{data:body}),201);assert.equal(again.collection.version,saved.collection.version);
   assert.equal((await c.post(endpoint,{data:{...body,requestKey:key+'-stale-'+actor}})).status(),409);
   for(const answers of [{unknown:{state:'value',value:1}},{[field.key]:{state:'value',value:'wrong'}}])assert.equal((await c.post(endpoint,{data:{...body,baseVersionNo:saved.collection.version,baseResponseRevision:1,requestKey:key+'-invalid-'+actor,answers}})).status(),400);
   const after=await json(await c.get(fixtures[actor].path),200);assert.equal(after.version,saved.collection.version);assert.deepEqual(after.records,saved.collection.records);checks.push(actor+'-range-preserved-types-hard-reject-cas-repeat');
  }
  if(mode==='correction'){
   const record=v.records[0],endpoint=fixtures[actor].path+'/records/'+record.recordId,body={baseVersionNo:v.version,baseResponseRevision:0,requestKey:key+'-complete-'+actor,acknowledgeFindingsHash:record.validation.findingsHash};
   assert.equal((await c.post(endpoint+'/completions',{data:{...body,acknowledgeFindingsHash:'wrong'}})).status(),422);
   const completed=await json(await c.post(endpoint+'/completions',{data:body}),201),r=completed.collection.records[0];assert.equal(r.status,'recorded');assert.equal(r.responseRevision,1);assert(r.validation.findings.length>0);
   assert.equal((await c.post(endpoint+'/drafts',{data:{baseVersionNo:completed.collection.version,baseResponseRevision:1,requestKey:key+'-illegal-'+actor,answers:{}}})).status(),409);
   const correction={baseVersionNo:completed.collection.version,baseResponseRevision:1,requestKey:key+'-correct-'+actor,answers:Object.fromEntries(v.config.form.schema.fields.map(f=>[f.key,{state:'value',value:f.type==='boolean'?false:0}])),reason:'本轮具名合成记录原因更正测试'};
   assert.equal((await c.post(endpoint+'/corrections',{data:{...correction,reason:'七字'}})).status(),400);
   const corrected=await json(await c.post(endpoint+'/corrections',{data:correction}),201);assert.equal(corrected.collection.dataRevision,2);assert.equal(corrected.collection.records[0].responseRevision,2);assert.equal(corrected.collection.lastChange.author,runtimeAccount(actor));assert(corrected.collection.lastChange.changes.length>0);
   const old=await json(await c.get(fixtures[actor].path+'/versions/'+completed.collection.version),200);assert.equal(old.records[0].responseRevision,1);assert.equal(old.records[0].answers[v.config.form.schema.fields[0].key].state,'missing');
   const race={...correction,baseVersionNo:corrected.collection.version,baseResponseRevision:2};const statuses=await Promise.all(['a','b'].map(n=>c.post(endpoint+'/corrections',{data:{...race,requestKey:key+'-race-'+n+'-'+actor}}).then(x=>x.status())));assert.deepEqual(statuses.sort(),[201,409]);checks.push(actor+'-completion-ack-correction-diff-immutable-history-concurrent-cas');
   if(actor==='owner'){
    let current=await json(await c.get(fixtures[actor].path),200);for(let i=0;i<19;i++){const result=await json(await c.post(endpoint+'/corrections',{data:{...correction,baseVersionNo:current.version,baseResponseRevision:current.records[0].responseRevision,requestKey:key+'-page-'+i}}),201);assert.equal(result.collection.dataRevision,current.dataRevision);current=result.collection;}
    assert.equal(current.versions.length,20);assert(current.nextVersionCursor);const page=await json(await c.get(fixtures[actor].path+'?versionsBefore='+current.nextVersionCursor),200);assert(page.versions.length>0);assert(page.versions.every(v=>v.versionNo<current.nextVersionCursor));assert.equal(page.versions.at(-1).versionNo,1);checks.push('own-bounded-version-pagination-and-noop-data-stability');
   }
  }
  if(mode==='quality'){
   const endpoint=fixtures[actor].path,first=await json(await c.post(endpoint+'/quality-snapshots',{data:{baseVersionNo:v.version,requestKey:key+'-dq-'+actor}}),201),q=first.collection.quality;assert.equal(q.status,'current');assert.equal(q.checkedRecordCount,6);assert.equal(q.recordedRecordCount,0);assert(q.findings.some(f=>f.ruleKey==='D01')&&q.findings.some(f=>f.ruleKey==='D03'));assert.equal(first.collection.dataRevision,0);
   const record=first.collection.records[0],field=v.config.form.schema.fields.find(f=>f.type==='number'||f.type==='integer'),saved=await json(await c.post(endpoint+'/records/'+record.recordId+'/drafts',{data:{baseVersionNo:first.collection.version,baseResponseRevision:record.responseRevision,requestKey:key+'-dq-data-'+actor,answers:{[field.key]:{state:'value',value:field.max+1}}}}),201);assert.equal(saved.collection.quality.status,'stale');
   const second=await json(await c.post(endpoint+'/quality-snapshots',{data:{baseVersionNo:saved.collection.version,requestKey:key+'-dq-again-'+actor}}),201);assert.equal(second.collection.quality.status,'current');assert.equal(second.collection.dataRevision,1);assert.notEqual(second.collection.quality.id,q.id);assert(second.collection.quality.findings.some(f=>f.ruleKey==='D02'&&f.recordId===record.recordId&&f.fieldKey===field.key));const history=await json(await c.get(endpoint+'/versions/'+first.collection.version),200);assert.equal(history.quality.id,q.id);assert(!history.quality.findings.some(f=>f.ruleKey==='D02'));checks.push(actor+'-saved-only-dynamic-dq-new-snapshot-stale-and-history');
  }
 }
 const admin=await login('admin');assert.equal((await admin.get(fixtures.owner.path)).status(),403);
 for(const actor of ['viewer','uninvited']){const c=await login(actor);assert.equal((await c.get(fixtures.owner.path)).status(),403);}
 checks.push('cross-owner-readonly-uninvited-refused');
 assert.equal(hash(),before);writeFileSync(dir+'result.json',JSON.stringify({passed:true,mode,checks,fixtures,paidCalls:0},null,2));
 mkdirSync(root+'.tmp/researchhub-wp06-synthetic-edc/',{recursive:true,mode:0o700});writeFileSync(root+'.tmp/researchhub-wp06-synthetic-edc/'+mode+'.json',JSON.stringify(fixtures),{mode:0o600});
 console.log(JSON.stringify({passed:true,mode,checks:checks.length,evidence:dir}));
}catch(e){writeFileSync(dir+'failure.json',JSON.stringify({passed:false,mode,checks,message:e.message},null,2));throw e;}finally{assert.equal(hash(),before);for(const c of contexts)await c.dispose();}
