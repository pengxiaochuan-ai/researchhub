// Real separate PG transactions; only WP08 creates. All injected failures abort.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {crfMethodAssetsRuntime} from '../tests/fixtures/crf-method-assets-runtime.mjs';
import {CRF_ASSET_PREFIX} from './crf-method-assets-contract.mjs';
const api=await import('./local-crf-method-assets.mjs');
const [mode,environment,flag,which]=process.argv.slice(2);assert(mode==='--mode'&&environment==='local-synthetic'&&flag==='--case'&&['atomic-create','source-head','notes-lineage','capacity-cross-keys','sources'].includes(which));
assert.equal(typeof api.createCrfMethodAssets,'function','new asset transaction adapter missing');
const root='/Users/mac/aisciencesys/',ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',sha=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=sha();
const out=root+'docs/test/evidence/2026-10-26-researchhub-wp08-crf-method-assets/'+which+'-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});
let fault=null,matched=false,pause=null,corruptParentId=null;const checks=[];
const wrap=tx=>new Proxy(tx,{get(t,name){
 if(name==='researchArtifactVersion'&&corruptParentId)return new Proxy(t[name],{get(m,k){const fn=m[k];return k==='findUnique'?async args=>{const v=await fn.call(m,args);if(v?.sources&&v.artifactId===corruptParentId){const copy=structuredClone(v);copy.sources[0].hash='damaged';return copy;}return v;}:typeof fn==='function'?fn.bind(m):fn;}});
 if(['auditLog','researchArtifactSource'].includes(name))return new Proxy(t[name],{get(m,k){const fn=m[k];return typeof fn==='function'?async args=>{
  const hit=name==='auditLog'&&k==='create'&&args.data.action===fault||name==='researchArtifactSource'&&k==='createMany'&&fault==='source_create';
  if(hit){matched=true;throw Error('WP08_CONTROLLED_ROLLBACK');}if(name==='auditLog'&&k==='create')await pause?.(args.data);return fn.call(m,args);
 }:fn;}});
 const v=t[name];return typeof v==='function'?v.bind(t):v;
}});
const rt=await crfMethodAssetsRuntime({wrap,afterTransaction:()=>{if(fault)throw Error('WP08_UNHIT_ROLLBACK');}});
const assets=api.createCrfMethodAssets({...rt,storage:{},scope:rt.dir+'wp08-scope.json'}),f=rt.fixtures.owner,u=rt.users.owner,key='wp08-atomic-'+randomUUID().slice(0,12);
const base=await rt.plans.withScope(u,'artifact.read',tx=>rt.reports.inReport(tx,u,f.planId,f.collectionId,f.runId,f.reportId));
const ownWhere={tenantId:u.tenantId,ownerAccountId:u.accountId,idempotencyKey:{startsWith:CRF_ASSET_PREFIX}};
async function counts(){return rt.transact(async tx=>({artifacts:await tx.researchArtifact.count({where:ownWhere}),receipts:await tx.auditLog.count({where:{tenantId:u.tenantId,accountId:u.accountId,action:'local_crf_method_asset_request'}})}));}
try{
 if(which==='sources'){
  const {verifyMethodAssetSources}=await import('./crf-method-assets-source-checks.mjs');await verifyMethodAssetSources({rt,assets,checks,key});assert.equal(sha(),before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0,ledgerUnchanged:true,onlyNewA04PacketChanged:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,actualPg:true,modelCalls:0}));
 }else if(which==='source-head'){
  const fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-wp08-crf-method-assets/a04-fixtures.json')).accounts.owner[1];
  assert(fixture&&fixture.reports.length===2);const s=api.readCrfMethodAssetScope(rt.dir+'wp08-scope.json',rt.ids,u,'A04');
  const rows=await rt.transact(tx=>tx.researchArtifact.findMany({where:{id:{in:[fixture.collectionId,...fixture.reports]}},select:{id:true,createdAt:true,ownerAccountId:true}}));assert(rows.length===3&&rows.every(r=>r.createdAt.getTime()>=Date.parse(s.approvedAt)&&r.ownerAccountId===u.accountId));
  const first=fixture.reports[0],second=fixture.reports[1],args=id=>[u,fixture.planId,fixture.collectionId,fixture.runId,id];
  let reached,release;const blocked=new Promise(ok=>{reached=ok;}),go=new Promise(ok=>{release=ok;});
  pause=async data=>{if(data.action==='research_artifact_version_create'&&data.target===first){reached();await go;}};
  const writer=rt.reports.save(...args(first),{baseVersionNo:1,notes:'WP08新夹具：来源先换版。',requestKey:key+'-source-before'});await blocked;
  let done=false;const candidate=assets.create(...args(first),{baseReportVersionNo:1,requestKey:key+'-source-after'}).then(v=>{done=true;return{value:v};},error=>{done=true;return{error};});
  await new Promise(ok=>setTimeout(ok,100));assert.equal(done,false,'candidate must wait for source writer');release();await writer;const rejected=await candidate;assert.equal(rejected.error?.getResponse?.().code,'CRF_ASSET_SOURCE_CHANGED');pause=null;checks.push('source_change_before_lock_rejected: actual writer commits then blocked candidate rereads new head');
  let acquired,unlock;const got=new Promise(ok=>{acquired=ok;}),leave=new Promise(ok=>{unlock=ok;});
  pause=async data=>{if(data.action==='local_crf_method_asset_create'){acquired();await leave;}};
  const made=assets.create(...args(second),{baseReportVersionNo:1,requestKey:key+'-snapshot-first'});await got;
  let writerDone=false;const later=rt.reports.save(...args(second),{baseVersionNo:1,notes:'WP08新夹具：候选提交之后换版。',requestKey:key+'-writer-later'}).then(v=>{writerDone=true;return v;});
  await new Promise(ok=>setTimeout(ok,100));assert.equal(writerDone,false,'source writer must wait while candidate holds origin');unlock();const result=await made;await later;pause=null;
  const stale=await assets.read(u,result.asset.id);assert.equal(stale.sourceStatus,'stale');assert.equal(stale.canEdit,false);assert.equal(stale.snapshot.report.versionNo,1);checks.push('source_writer_waits_for_snapshot_then_marks_stale: commit order and fixed report version retained');
  await rt.reports.save(...args(second),{baseVersionNo:2,notes:'',requestKey:key+'-report-change-back'});assert.equal((await assets.read(u,result.asset.id)).sourceStatus,'stale');checks.push('root-report-notes-changed-back-still-stale-by-version');
  assert.equal(sha(),before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0,ledgerUnchanged:true,onlyNewA04ReportsChanged:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,actualPg:true,modelCalls:0}));
 }else if(which==='capacity-cross-keys'){
  api.readCrfMethodAssetScope(rt.dir+'wp08-scope.json',rt.ids,u,'A04');
  const original=JSON.parse(readFileSync(root+'.tmp/researchhub-wp08-crf-method-assets/api-fixtures.json')).owner.assetId,parent=await assets.read(u,original);
  const fixtures=JSON.parse(readFileSync(root+'.tmp/researchhub-wp08-crf-method-assets/a04-fixtures.json')).accounts.owner,other=fixtures[1],report=await rt.plans.withScope(u,'artifact.read',tx=>rt.reports.inReport(tx,u,other.planId,other.collectionId,other.runId,other.reports[0]));
  const baseline=await counts(),observed=[];
  function probePlans(target,onEntered){return {...rt.plans,withScope:(user,permission,cb)=>rt.plans.withScope(user,permission,async tx=>{
   api.readCrfMethodAssetScope(rt.dir+'wp08-scope.json',rt.ids,user,'A04');
   const n=await tx.researchArtifact.count({where:ownWhere});assert(n<=target);
   // Uncommitted metadata-only occupancy slots test the real PG count/lock.
   // They have no report/AI content and are NEVER committed or delivered.
   const data=Array.from({length:target-n},(_,i)=>({id:randomUUID(),tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,ownerAccountId:u.accountId,createdBy:u.accountId,typeKey:'research_report',status:'draft',title:'未提交WP08容量夹具（必须回滚）',idempotencyKey:CRF_ASSET_PREFIX+u.accountId+':capacity-probe:'+randomUUID()+':'+i}));
   if(data.length)await tx.researchArtifact.createMany({data});await onEntered?.();
   const result=await cb(tx);assert.equal(await tx.researchArtifact.count({where:ownWhere}),100);observed.push(result);throw Error('WP08_CAPACITY_PROBE_ROLLBACK');
  })};}
  const factory=plans=>api.createCrfMethodAssets({...rt,plans,storage:{},scope:rt.dir+'wp08-scope.json'});
  let entered,release;const paused=new Promise(ok=>{entered=ok;}),go=new Promise(ok=>{release=ok;});let secondEntered=false;
  const firstFactory=factory(probePlans(99,async()=>{entered();await go;})),secondFactory=factory(probePlans(99,async()=>{secondEntered=true;}));
  const firstProbe=firstFactory.derive(u,parent.id,{baseVersionNo:parent.version,requestKey:key+'-capacity-derive'}).catch(e=>e);await paused;
  const secondProbe=secondFactory.create(u,other.planId,other.collectionId,other.runId,other.reports[0],{baseReportVersionNo:report.report.version,requestKey:key+'-capacity-create'}).catch(e=>e);
  await new Promise(ok=>setTimeout(ok,100));assert.equal(secondEntered,false,'different root/run must wait on original tenant advisory lock');release();
  assert.equal((await firstProbe).message,'WP08_CAPACITY_PROBE_ROLLBACK');assert.equal((await secondProbe).message,'WP08_CAPACITY_PROBE_ROLLBACK');assert.equal(observed.length,2);assert.deepEqual(await counts(),baseline);checks.push('different_roots_capacity_serialized: real PG 99-to-100 slots, distinct roots/runs, both probes roll back');
  const full=factory(probePlans(100));await assert.rejects(()=>full.derive(u,parent.id,{baseVersionNo:parent.version,requestKey:key+'-at-100'}),e=>e.getStatus?.()===429&&e.getResponse?.().code==='CRF_ASSET_CAPACITY');assert.deepEqual(await counts(),baseline);checks.push('real-PG-100-capacity-rejects-new-candidate-no-slot-or-write-residue');
  const oldReceipt=await rt.transact(tx=>tx.auditLog.findFirst({where:{tenantId:u.tenantId,accountId:u.accountId,action:'local_crf_method_asset_request',meta:{path:['operation','assetId'],equals:parent.id}},orderBy:{createdAt:'asc'}}));assert(oldReceipt?.meta?.operation);
  const oldOp=oldReceipt.meta.operation,originalSource=rt.fixtures.owner;
  await assert.rejects(()=>full.create(u,originalSource.planId,originalSource.collectionId,originalSource.runId,originalSource.reportId,{baseReportVersionNo:parent.rootReference.reportVersionNo,requestKey:oldOp.id}),/WP08_CAPACITY_PROBE_ROLLBACK/);
  assert.deepEqual(observed.at(-1),oldOp);assert.deepEqual(await counts(),baseline);checks.push('successful-persisted-create-retry-survives-real-PG-full-capacity');
  const fixture=fixtures[0],a=await rt.transact(tx=>tx.researchArtifact.findUnique({where:{tenantId_idempotencyKey:{tenantId:u.tenantId,idempotencyKey:CRF_ASSET_PREFIX+u.accountId+':report:'+fixture.reports[0]+':1'}}}));assert(a);
  let notesRoot=await assets.read(u,a.id);assert(notesRoot.canEdit,'FRESH_NOTES_FIXTURE_REQUIRED');
  const sharedKey=key+'-cross-root-action',race=await Promise.allSettled([assets.derive(u,parent.id,{baseVersionNo:parent.version,requestKey:sharedKey}),assets.save(u,notesRoot.id,{baseVersionNo:notesRoot.version,notes:key+'-跨根动作并发',requestKey:sharedKey})]);
  assert.equal(race.filter(v=>v.status==='fulfilled').length,1);assert.equal(race.find(v=>v.status==='rejected').reason.getResponse?.().code,'CRF_ASSET_KEY_CONFLICT');checks.push('same_key_different_actions_serialized: independent connections/different roots and runs, one success one conflict');
  notesRoot=await assets.read(u,a.id);let lastBody,lastOperation;while(notesRoot.version<30){lastBody={baseVersionNo:notesRoot.version,notes:key+'-版本容量-'+notesRoot.version,requestKey:key+'-version-'+notesRoot.version};const saved=await assets.save(u,a.id,lastBody);notesRoot=saved.asset;lastOperation=saved.operation;}
  assert.equal(notesRoot.canEdit,false);await assert.rejects(()=>assets.save(u,a.id,{baseVersionNo:30,notes:key+'-不允许31版',requestKey:key+'-version-31'}),e=>e.getStatus?.()===429&&e.getResponse?.().code==='CRF_ASSET_CAPACITY');assert.deepEqual((await assets.save(u,a.id,lastBody)).operation,lastOperation);assert.equal((await assets.read(u,a.id)).versions.length,30);checks.push('actual-original-Artifact-versions-reach-30-cap-and-legal-retry-does-not-create-31');
  assert.equal(sha(),before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0,ledgerUnchanged:true,capacityFixture:'uncommitted metadata-only occupancy slots; not usable assets',capacitySlotsAllRolledBack:true,versionCapFixtureId:a.id},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,actualPg:true,modelCalls:0}));
 }else if(which==='notes-lineage'){
  assert.equal(typeof assets.save,'function','asset notes transaction missing');assert.equal(typeof assets.derive,'function','asset derivation transaction missing');
  const fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-wp08-crf-method-assets/a04-fixtures.json')).accounts.owner[0],reportId=fixture.reports[0];
  const made=await assets.create(u,fixture.planId,fixture.collectionId,fixture.runId,reportId,{baseReportVersionNo:1,requestKey:key+'-notes-root'}),original=made.asset,assetId=original.id;
  const body={baseVersionNo:original.version,notes:key+'-本人复用说明',requestKey:key+'-notes'};
  const saved=await assets.save(u,assetId,body);assert.equal(saved.operation.versionNo,original.version+1);assert.equal(saved.asset.notes,body.notes);assert.equal(saved.asset.snapshotHash,original.snapshotHash);assert.equal((await assets.read(u,assetId,original.version)).notes,original.notes);
  assert.deepEqual((await assets.save(u,assetId,body)).operation,saved.operation);
  await assert.rejects(()=>assets.save(u,assetId,{...body,baseVersionNo:saved.asset.version,requestKey:key+'-noop'}),e=>e.getStatus?.()===422&&e.getResponse?.().code==='CRF_ASSET_NO_CHANGE');
  await assert.rejects(()=>assets.derive(u,assetId,{baseVersionNo:saved.asset.version,requestKey:body.requestKey}),e=>e.getResponse?.().code==='CRF_ASSET_KEY_CONFLICT');checks.push('notes-CAS-hash-history-idempotency-noop422-and-cross-action-key-conflict');
  const current=await assets.read(u,assetId),raced=await Promise.allSettled(['a','b'].map(k=>assets.save(u,assetId,{baseVersionNo:current.version,notes:key+'-race-'+k,requestKey:key+'-race-'+k})));
  assert.equal(raced.filter(v=>v.status==='fulfilled').length,1);assert.equal(raced.find(v=>v.status==='rejected').reason.getStatus(),409);checks.push('independent-connections-notes-CAS-one-success-one-conflict');
  const beforeFault=await assets.read(u,assetId),priorVersions=beforeFault.versions.length;
  for(const hook of ['research_artifact_version_create','local_crf_method_asset_request','not-a-real-hook']){
   fault=hook;matched=false;await assert.rejects(()=>assets.save(u,assetId,{baseVersionNo:beforeFault.version,notes:key+'-fail-'+hook,requestKey:key+'-fail-'+hook}),new RegExp(hook==='not-a-real-hook'?'WP08_UNHIT_ROLLBACK':'WP08_CONTROLLED_ROLLBACK'));assert.equal(matched,hook!=='not-a-real-hook');fault=null;
   const after=await assets.read(u,assetId);assert.equal(after.version,beforeFault.version);assert.equal(after.notes,beforeFault.notes);assert.equal(after.versions.length,priorVersions);
  }checks.push('notes-version-Sources-Audit-receipt-atomic-rollback-and-unhit-abort');
  const deriveBody={baseVersionNo:beforeFault.version,requestKey:key+'-derive'},first=await assets.derive(u,assetId,deriveBody);assert.equal(first.asset.notes,'');assert.equal(first.asset.snapshotHash,original.snapshotHash);assert.equal(first.asset.lineage.at(-1).version,beforeFault.version);assert.deepEqual((await assets.derive(u,assetId,deriveBody)).operation,first.operation);
  let child=first.asset;for(let depth=2;depth<=8;depth++)child=(await assets.derive(u,child.id,{baseVersionNo:child.version,requestKey:key+'-depth-'+depth})).asset;
  assert.equal(child.lineage.length,8);assert.equal(child.canDerive,false);await assert.rejects(()=>assets.derive(u,child.id,{baseVersionNo:child.version,requestKey:key+'-depth-9'}),e=>e.getStatus?.()===429&&e.getResponse?.().code==='CRF_ASSET_CAPACITY');checks.push('private-fixed-parent-derivation-eight-level-cap-no-parent-or-root-snapshot-write');
  corruptParentId=assetId;await assert.rejects(()=>assets.read(u,child.id),e=>e.getResponse?.().code==='CRF_ASSET_CONTEXT_INVALID');corruptParentId=null;checks.push('ancestor-native-source-fault-hides-descendant-no-storage-tamper');
  const changed=await assets.save(u,assetId,{baseVersionNo:beforeFault.version,notes:key+'-parent-changed',requestKey:key+'-parent-change'});await assets.save(u,assetId,{baseVersionNo:changed.asset.version,notes:beforeFault.notes,requestKey:key+'-parent-back'});
  assert.equal((await assets.read(u,child.id)).sourceStatus,'stale');await assert.rejects(()=>assets.save(u,child.id,{baseVersionNo:child.version,notes:'不能改过期派生',requestKey:key+'-stale-edit'}),e=>e.getResponse?.().code==='CRF_ASSET_SOURCE_CHANGED');
  const retry=await assets.derive(u,assetId,deriveBody);assert.deepEqual(retry.operation,first.operation);assert.equal(retry.asset.sourceStatus,'stale');checks.push('parent-changed-back-does-not-revive-and-successful-old-retry-is-readonly');
  assert.equal(sha(),before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0,ledgerUnchanged:true,rootAssetId:assetId,deepestAssetId:child.id},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,actualPg:true,modelCalls:0}));
 }else{
 const original=await counts();assert.equal(original.artifacts,0,'FRESH_ATOMIC_ROOT_REQUIRED');
 for(const hook of ['research_artifact_create','source_create','local_crf_method_asset_request','not-a-real-hook']){
  fault=hook;matched=false;await assert.rejects(()=>assets.create(u,f.planId,f.collectionId,f.runId,f.reportId,{baseReportVersionNo:base.report.version,requestKey:key+'-'+hook}),new RegExp(hook==='not-a-real-hook'?'WP08_UNHIT_ROLLBACK':'WP08_CONTROLLED_ROLLBACK'));
  assert.equal(matched,hook!=='not-a-real-hook');fault=null;assert.deepEqual(await counts(),original);
 }checks.push('create-Artifact-Version-Sources-Audit-and-receipt-rollback-including-unhit-injection');
 const body={baseReportVersionNo:base.report.version,requestKey:key+'-first'},responses=await Promise.all([assets.create(u,f.planId,f.collectionId,f.runId,f.reportId,body),assets.create(u,f.planId,f.collectionId,f.runId,f.reportId,{...body,requestKey:key+'-second'})]);
 assert.equal(responses[0].asset.id,responses[1].asset.id);assert.equal(responses[0].operation.versionNo,1);assert.equal(responses[1].operation.versionNo,1);
 const found=await counts();assert.equal(found.artifacts,1);assert.equal(found.receipts,original.receipts+2);
 assert.equal(await rt.transact(tx=>tx.researchArtifactVersion.count({where:{artifactId:responses[0].asset.id}})),1);checks.push('same-report-independent-connections-different-keys-one-root-one-version');
 const retry=await assets.create(u,f.planId,f.collectionId,f.runId,f.reportId,body);assert.deepEqual(retry.operation,responses[0].operation);assert.deepEqual(await counts(),found);
 await assert.rejects(()=>assets.create(u,f.planId,f.collectionId,f.runId,f.reportId,{...body,baseReportVersionNo:1}),e=>e.getResponse?.().code==='CRF_ASSET_KEY_CONFLICT');checks.push('persisted-retry-and-changed-body-conflict');
 assert.equal(sha(),before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0,ledgerUnchanged:true,ownerAssetId:responses[0].asset.id},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,actualPg:true,modelCalls:0}));
 }
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,message:e.message,modelCalls:0},null,2));throw e;}finally{fault=null;assert.equal(sha(),before);}
