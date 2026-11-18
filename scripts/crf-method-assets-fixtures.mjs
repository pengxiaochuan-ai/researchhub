// A04 only: new named synthetic packets/runs/reports. No prior object mutation.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {crfMethodAssetsRuntime} from '../tests/fixtures/crf-method-assets-runtime.mjs';
import {readCrfMethodAssetScope} from './local-crf-method-assets.mjs';
import {edcDigest} from './synthetic-edc-contract.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const rt=await crfMethodAssetsRuntime(),{root,dir,ids,users}=rt,scopePath=dir+'wp08-scope.json',file=root+'.tmp/researchhub-wp08-crf-method-assets/a04-fixtures.json';
const r=JSON.parse(readFileSync(dir+'runtime.json')),ledger=dir+'ai-budget-20261022.json',sha=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=sha();
const manifest=existsSync(file)?JSON.parse(readFileSync(file)):{schema:'rh-wp08-a04-fixtures.v1',key:'wp08-fixture-'+randomUUID().slice(0,10),accounts:{owner:[],admin:[]}};
assert.equal(manifest.schema,'rh-wp08-a04-fixtures.v1');const save=()=>writeFileSync(file,JSON.stringify(manifest,null,2),{mode:0o600});save();
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,contexts=[];
const json=async(res,want)=>{assert.equal(res.status(),want,await res.text());return res.json();};
function permitted(actor){return readCrfMethodAssetScope(scopePath,ids,users[actor],'A04');}
async function register(actor,f,reportId){
 const u=users[actor],s=permitted(actor),tuple={accountId:u.accountId,planId:f.planId,collectionId:f.collectionId,runId:f.runId,reportId};
 const approvedAt=Date.parse(s.approvedAt);
 await rt.plans.withScope(u,'artifact.read',async tx=>{
  const b=await rt.reports.inReport(tx,u,f.planId,f.collectionId,f.runId,reportId);assert.equal(b.report.sourceStatus,'current');assert.equal(b.report.facts.ai.status,'not_requested');
  for(const id of [f.collectionId,reportId]){const a=await tx.researchArtifact.findUnique({where:{id},select:{createdAt:true}});assert(a.createdAt.getTime()>=approvedAt,'ONLY_NEW_A04_OBJECT');}
  const where={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:u.accountId,action:'local_crf_method_asset_source_registered',target:reportId};
  if(!await tx.auditLog.findFirst({where}))await tx.auditLog.create({data:{...where,meta:{...tuple,newNamedA04Fixture:true,modelCalls:0}}});
 });
 const text=readFileSync(scopePath,'utf8'),scope=JSON.parse(text);
 if(!scope.sourceRoots.some(v=>edcDigest(v)===edcDigest(tuple))){scope.sourceRoots.push(tuple);assert(scope.sourceRoots.filter(v=>v.accountId===u.accountId).length<=18);assert.equal(readFileSync(scopePath,'utf8'),text);const temp=scopePath+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(scope,null,2),{flag:'wx',mode:0o600});renameSync(temp,scopePath);}
}
try{
 for(const actor of ['owner','admin']){
  const u=users[actor],parent=rt.fixtures[actor].planId,c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project}});contexts.push(c);
  await json(await c.post('/api/auth/login',{data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:r.password}}),201);
  const post=async(path,body)=>{permitted(actor);return json(await c.post(path,{data:body}),201);};
  const prep=await json(await c.get('/api/research-plan-drafts/'+parent+'/execution-preparation'),200);assert.equal(prep.sourceStatus,'current');assert.equal(prep.preparationStatus,'current');
  assert(manifest.accounts[actor].length<=2);
  for(let index=0;index<2;index++){
   let f=manifest.accounts[actor][index];
   if(!f){const key=manifest.key+'-'+actor+'-'+index,body={parentRootVersionNo:prep.version,preparationRevisionNo:prep.revisionNo,visitKeys:prep.config.visits.slice(0,2).map(v=>v.key),subjectCount:3,requestKey:key};
    const {collection}=await post('/api/research-plan-drafts/'+parent+'/synthetic-collections',body);
    f={key,planId:parent,collectionId:collection.id,path:'/api/research-plan-drafts/'+parent+'/synthetic-collections/'+collection.id,created:true};manifest.accounts[actor][index]=f;save();
   }
   let pack=await json(await c.get(f.path),200);assert.equal(pack.subjects.length,3);assert.equal(pack.records.length,6);
   if(!f.captured){const row=pack.records[0],answers={};for(const field of pack.config.form.schema.fields){
     const v=field.type==='boolean'?false:['number','integer'].includes(field.type)?(Number.isFinite(field.min)?field.min:0):field.type==='select'?(typeof field.options[0]==='string'?field.options[0]:field.options[0].value):'WP08具名合成软件夹具';answers[field.key]={state:'value',value:v};
    }
    ({collection:pack}=await post(f.path+'/records/'+row.recordId+'/drafts',{baseVersionNo:pack.version,baseResponseRevision:row.responseRevision,answers,requestKey:f.key+'-capture'}));f.captured=true;save();
   }
   if(!f.quality){({collection:pack}=await post(f.path+'/quality-snapshots',{baseVersionNo:pack.version,requestKey:f.key+'-quality'}));f.quality=true;save();}
   if(!f.runId){const {run}=await post(f.path+'/method-runs',{baseVersionNo:pack.version,qualityId:pack.quality.id,requestKey:f.key+'-method'});f.runId=run.id;save();}
   let run;for(let i=0;i<80;i++){({run}=await json(await c.get(f.path+'/method-runs/'+f.runId),200));if(!['queued','validating','running'].includes(run.status))break;await new Promise(ok=>setTimeout(ok,125));}
   assert.equal(run.status,'needs_review','ACTUAL_LOCAL_WORKER_REQUIRED');assert.equal(run.sourceStatus,'current');f.reports??=[];
   for(let reportIndex=0;reportIndex<2;reportIndex++){
    if(!f.reports[reportIndex]){const {report}=await post(f.path+'/method-runs/'+f.runId+'/report-drafts',{baseRunVersion:run.runVersion,resultHash:run.resultHash,interpretationMessageId:null,requestKey:f.key+'-report-'+reportIndex});assert.equal(report.facts.ai.status,'not_requested');f.reports[reportIndex]=report.id;save();}
    await register(actor,f,f.reports[reportIndex]);
   }
  }
 }
 assert.equal(sha(),before);console.log(JSON.stringify({passed:true,newPackets:4,actualWorkerRuns:4,newReports:8,subjectsPerPacket:3,visitsPerPacket:2,modelCalls:0,priorObjectsReadOnly:true,ledgerUnchanged:true}));
}finally{for(const c of contexts)await c.dispose();assert.equal(sha(),before);}
