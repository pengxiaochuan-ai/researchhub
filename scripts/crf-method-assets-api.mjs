import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {crfMethodAssetsRuntime} from '../tests/fixtures/crf-method-assets-runtime.mjs';
import {buildCrfMethodAssetSnapshot} from './crf-method-assets-contract.mjs';
import {readCrfMethodAssetScope} from './local-crf-method-assets.mjs';
import {edcDigest} from './synthetic-edc-contract.mjs';
const [mode,value,flag,which]=process.argv.slice(2);assert(mode==='--mode'&&value==='local-synthetic'&&flag==='--case'&&['readiness','bridge','activate','create-read-list','post-query','notes-derive'].includes(which));
const root='/Users/mac/aisciencesys/',ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',sha=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=sha();
const out=root+'docs/test/evidence/2026-10-26-researchhub-wp08-crf-method-assets/'+which+'-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});
const checks=[];let runtime;
try{
 const originalScope=root+'.tmp/researchhub-knowledge-local/wp07-scope.json',originalScopeText=readFileSync(originalScope,'utf8');
 const isolated=mkdtempSync(root+'.tmp/researchhub-wp08-crf-method-assets/bridge-'),scopePath=isolated+'/wp07-isolated.json';writeFileSync(scopePath,originalScopeText,{mode:0o600});
 let corrupt=false,probeReport;
 const wrap=tx=>new Proxy(tx,{get(t,name){
  if(name==='researchArtifactVersion')return new Proxy(t[name],{get(m,k){if(k==='findUnique')return async args=>{const v=await m.findUnique(args);if(corrupt&&v?.sources&&v.artifactId===probeReport){const copy=structuredClone(v);copy.sources[0].hash='damaged';return copy;}return v;};const method=m[k];return typeof method==='function'?method.bind(m):method;}});
  const value=t[name];return typeof value==='function'?value.bind(t):value;
 }});
 runtime=await crfMethodAssetsRuntime({scopePath,wrap});const {users,fixtures,plans,methods,reports,transact}=runtime;
 for(const actor of ['owner','admin']){
  const u=users[actor],f=fixtures[actor];
  if(which==='readiness'){
   const report=await reports.read(u,f.planId,f.collectionId,f.runId,f.reportId),{run}=await methods.read(u,f.planId,f.collectionId,f.runId);
   const version=await transact(tx=>tx.researchArtifactVersion.findUnique({where:{artifactId_versionNo:{artifactId:f.reportId,versionNo:report.version}},select:{id:true}}));
   const {snapshot}=buildCrfMethodAssetSnapshot({report,reportVersionId:version.id,run});assert.equal(snapshot.report.versionNo,report.currentVersion);assert.equal(snapshot.historicalFacts.ai.status,'current');assert(!Object.hasOwn(snapshot.reuseRecipe,'result'));
   checks.push(actor+'-actual-validated-report-version-Sources-hash-and-new-snapshot-compatible');
  }else{
   assert.equal(typeof reports.inReport,'function','same-transaction report bridge missing');
   await plans.withScope(u,'artifact.read',async tx=>{const v=await reports.inReport(tx,u,f.planId,f.collectionId,f.runId,f.reportId);assert.equal(v.report.id,f.reportId);assert.equal(v.run.id,f.runId);assert(v.reportVersionId&&v.nativeSources.length);});checks.push(actor+'-report_bridge_same_tx_no_parent_write');
   const key='wp08-bridge-rollback-'+randomUUID();
   await assert.rejects(()=>plans.withScope(u,'artifact.read',async tx=>{
    await tx.auditLog.create({data:{tenantId:u.tenantId,studyGroupId:u.studyGroupId,researchProjectId:u.researchProjectId,accountId:u.accountId,action:'test_crf_method_assets_probe',target:key}});
    await reports.inReport(tx,u,f.planId,f.collectionId,f.runId,'wrong-report');
   }),e=>e.getStatus?.()===403);
   assert.equal(await transact(tx=>tx.auditLog.count({where:{action:'test_crf_method_assets_probe',target:key}})),0);checks.push(actor+'-bridge-rejection-rolls-back-actual-probe-in-same-transaction');
   for(const tuple of [['wrong-plan',f.collectionId,f.runId,f.reportId],[f.planId,'wrong-packet',f.runId,f.reportId],[f.planId,f.collectionId,'wrong-run',f.reportId]])await assert.rejects(()=>plans.withScope(u,'artifact.read',tx=>reports.inReport(tx,u,...tuple)),e=>e.getStatus?.()===403);
   await assert.rejects(()=>plans.withScope(users[actor==='owner'?'admin':'owner'],'artifact.read',tx=>reports.inReport(tx,users[actor==='owner'?'admin':'owner'],f.planId,f.collectionId,f.runId,f.reportId)),e=>e.getStatus?.()===403);checks.push(actor+'-wrong-parent-or-cross-owner-denied');
   corrupt=true;probeReport=f.reportId;await assert.rejects(()=>plans.withScope(u,'artifact.read',tx=>reports.inReport(tx,u,f.planId,f.collectionId,f.runId,f.reportId)),e=>e.getResponse?.().code==='CRF_REPORT_CONTEXT_INVALID');corrupt=false;checks.push(actor+'-real-PG-source-read-in-memory-fault-rejected-no-stored-source-change');
   const scope=JSON.parse(originalScopeText);
   writeFileSync(scopePath,JSON.stringify({...scope,operations:scope.operations.filter(x=>x!=='R02')}));
   await assert.rejects(()=>plans.withScope(u,'artifact.read',tx=>reports.inReport(tx,u,f.planId,f.collectionId,f.runId,f.reportId)),e=>e.getStatus?.()===403);
   const unselected=await plans.withScope(u,'artifact.read',tx=>reports.inReport(tx,u,f.planId,f.collectionId,f.runId,f.withoutAiReportId));assert.equal(unselected.report.facts.ai.status,'not_selected');checks.push(actor+'-selected-AI-requires-R02-but-no-AI-does-not');
   for(const op of ['R01','R03']){writeFileSync(scopePath,JSON.stringify({...scope,operations:scope.operations.filter(x=>x!==op)}));await assert.rejects(()=>plans.withScope(u,'artifact.read',tx=>reports.inReport(tx,u,f.planId,f.collectionId,f.runId,f.reportId)),e=>e.getStatus?.()===403);}checks.push(actor+'-isolated-original-R01-R03-revocation-denied');
   writeFileSync(scopePath,originalScopeText);
  }
 }
 if(['create-read-list','post-query','notes-derive'].includes(which)){
  const privateRuntime=JSON.parse(readFileSync(runtime.dir+'runtime.json')),pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,saved={};
  const contexts=[];const json=async(res,want)=>{assert.equal(res.status(),want,'HTTP status mismatch at '+new URL(res.url()).pathname);return res.json();};
  try{for(const actor of ['owner','admin']){
   const u=users[actor],f=fixtures[actor],c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':u.studyGroupId,'X-Research-Project-Id':u.researchProjectId}});contexts.push(c);
   await json(await c.post('/api/auth/login',{data:{tenantSlug:u.tenantId,username:actor+'@example.org',password:privateRuntime.password}}),201);
   const report=await json(await c.get(f.reportPath),200),body={baseReportVersionNo:report.version,requestKey:'wp08-http-'+randomUUID().slice(0,12)+'-'+actor},endpoint=f.reportPath+'/asset-drafts';
   if(which==='post-query'){await json(await c.post(endpoint+'?unexpected=1',{data:body}),400);checks.push(actor+'-POST-query-rejected-before-write');continue;}
   const made=await json(await c.post(endpoint,{data:body}),201);assert.equal(made.asset.status,'draft');assert.equal(made.asset.typeKey,'research_report');assert.equal(made.asset.rootReference.reportId,f.reportId);assert.equal(made.asset.rootReference.reportVersionNo,report.version);assert.equal(made.asset.snapshot.historicalFacts.ai.status,'current');
   if(which==='notes-derive'){
    const path='/api/crf-method-asset-drafts/'+made.asset.id,note={baseVersionNo:made.asset.version,notes:body.requestKey+' 本人HTTP复用说明',requestKey:body.requestKey+'-notes'};
    const updated=await json(await c.post(path+'/notes',{data:note}),201);assert.equal(updated.asset.version,made.asset.version+1);assert.equal(updated.asset.snapshotHash,made.asset.snapshotHash);assert.equal(updated.asset.notes,note.notes);
    await json(await c.post(path+'/notes?unknown=1',{data:{...note,requestKey:body.requestKey+'-bad-q'}}),400);
    const derive={baseVersionNo:updated.asset.version,requestKey:body.requestKey+'-derive'},child=await json(await c.post(path+'/derivations',{data:derive}),201);assert.equal(child.asset.notes,'');assert.equal(child.asset.lineage.at(-1).id,made.asset.id);assert.equal(child.asset.snapshotHash,made.asset.snapshotHash);
    await json(await c.post(path+'/derivations?unknown=1',{data:{...derive,requestKey:body.requestKey+'-bad-derive-q'}}),400);
    const retry=await json(await c.post(path+'/derivations',{data:derive}),201);assert.deepEqual(retry.operation,child.operation);
    const history=await json(await c.get(path+'/versions/'+made.asset.version),200);assert.equal(history.notes,made.asset.notes);assert.equal(history.readOnly,true);
    const huge=' '.repeat(33000)+JSON.stringify({...note,baseVersionNo:updated.asset.version,requestKey:body.requestKey+'-huge'}),blocked=await json(await c.post(path+'/notes',{data:huge,headers:{'Content-Type':'application/json'}}),400);assert.equal(blocked.code,'CRF_ASSET_REQUEST_TOO_LARGE');
    const encoded=path.replace(/\/([A-Za-z])(?=[A-Za-z0-9_-]*$)/,(_all,c)=>'/'+encodeURIComponent(c).replace(c,'%'+c.charCodeAt(0).toString(16)));const also=await json(await c.post(encoded+'/notes',{data:huge,headers:{'Content-Type':'application/json'}}),400);assert.equal(also.code,'CRF_ASSET_REQUEST_TOO_LARGE');
    checks.push(actor+'-real-HTTP-notes-history-derive-retry-POST-query-and-raw32KiB-encoded-ID-boundaries');continue;
   }
   const duplicate=await json(await c.post(endpoint,{data:body}),201);assert.deepEqual(duplicate.operation,made.operation);assert.equal(duplicate.asset.id,made.asset.id);
   await json(await c.post(endpoint,{data:{...body,extra:true}}),400);await json(await c.post(endpoint,{data:{...body,baseReportVersionNo:1}}),409);
   const path='/api/crf-method-asset-drafts/'+made.asset.id,current=await json(await c.get(path),200);assert.equal(current.id,made.asset.id);
   const history=await json(await c.get(path+'/versions/1'),200);assert.equal(history.readOnly,true,'explicit historical route is always read-only');assert.equal(history.canEdit,false);assert.equal(history.canDerive,false);
   const list=await json(await c.get('/api/crf-method-asset-drafts?limit=20'),200);assert(list.items.some(v=>v.id===made.asset.id));
   for(const bad of ['/api/crf-method-asset-drafts?limit=21','/api/crf-method-asset-drafts?limit=20&limit=20',path+'?extra=1',path+'/versions/31'])await json(await c.get(bad),400);
   const huge=' '.repeat(33000)+JSON.stringify(body);await json(await c.post(endpoint,{data:huge,headers:{'Content-Type':'application/json'}}),400);
   saved[actor]={assetId:made.asset.id,path,root:f,reportVersionNo:report.version};checks.push(actor+'-real-HTTP-create-idempotency-detail-history-list-strict-input-raw-body-limit');
  }
  if(which==='create-read-list'){await json(await contexts[1].get(saved.owner.path),403);checks.push('real-HTTP-admin-cannot-read-other-private-candidate');writeFileSync(root+'.tmp/researchhub-wp08-crf-method-assets/api-fixtures.json',JSON.stringify(saved),{mode:0o600});}
  }finally{for(const c of contexts)await c.dispose();}
 }
 if(which==='activate'){
  await plans.withScope(users.admin,'artifact.read',async tx=>{
   const s=readCrfMethodAssetScope(runtime.dir+'wp08-scope.json',runtime.ids,users.admin,'A01');
   const where={tenantId:runtime.ids.tenant,studyGroupId:runtime.ids.group,researchProjectId:runtime.ids.project,action:'local_crf_method_asset_authorized',target:runtime.ids.project};
   const hash=edcDigest(s),prior=await tx.auditLog.findFirst({where});
   if(prior)assert.equal(prior.meta.initialScopeHash,hash,'PURPOSE_ACTIVATION_CONFLICT');
   else await tx.auditLog.create({data:{...where,accountId:users.admin.accountId,meta:{approvedAt:s.approvedAt,accounts:s.accounts,operations:s.operations,marker:s.marker,prefix:s.prefix,initialScopeHash:hash,roleChanges:false,paidAiApproved:false,scope:'own-new-candidates-and-new-named-synthetic-fixtures-only'}}});
  });checks.push('explicit-approved-purpose-activation-audited-once-no-grants');
 }
 assert.equal(sha(),before);assert.equal(readFileSync(originalScope,'utf8'),originalScopeText);writeFileSync(out+'result.json',JSON.stringify({passed:true,which,checks,actualPg:true,modelCalls:0,ledgerUnchanged:true,liveOriginalScopeUnchanged:true},null,2));console.log(JSON.stringify({passed:true,which,checks:checks.length,actualPg:true,evidence:out,modelCalls:0}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,which,checks,code:e.getResponse?.()?.code??e.code??e.name,message:e instanceof assert.AssertionError?e.message:'本轮检查失败；无凭证输出',modelCalls:0},null,2));throw e;}
finally{assert.equal(sha(),before);}
