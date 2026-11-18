// PREPARATION IN PROGRESS: intentionally fails closed; do not execute.
// Root must independently review before any main-case operation.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workspaceRoot} from './research-creation-fixture.mjs';
import {createUiFreezeGuard} from './research-t18-ui-freeze-guard.mjs';
import {assertBlockedRunMetadata,assertNoSensitive,assertSourceError,assertOriginalCapture,assertVisitEvidence,assertPreviewRows} from './research-t18-correction-guards.mjs';
const args=process.argv.slice(2);
assert.equal(args.length,4);assert.deepEqual(args.slice(0,3),['--local-synthetic','--execute-after-confirmed-unlock','--report-proof']);
assert(existsSync(args[3]),'REQUIRED_REPORT_PROOF_MISSING');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const report=read(args[3]);
assert(report.passed&&report.syntheticOnly&&report.versionNo===1&&report.status==='released'&&report.job?.status==='ready');
for(const action of ['create','review','release','export']){const actor=report.actors?.[action];assert(actor&&actor.sessionRole==='admin'&&typeof actor.accountId==='string'&&Number.isSafeInteger(actor.authVersion),'REPORT_ORIGINAL_ACTOR_REQUIRED');}
for(const k of ['studyId','artifactId','runId','snapshotId','contentHash','createRequestKey','reviewRequestKey','releaseRequestKey','exportRequestKey'])assert.equal(typeof report[k],'string',`REPORT_${k}_MISSING`);
for(const k of ['id','sha256','sizeBytes','mimeType','filename'])assert(report.job?.file?.[k],`REPORT_FILE_${k}_MISSING`);
assert(typeof report.job.jobId==='string'&&report.job.artifactId===report.artifactId);assert.equal(report.job.format,'docx');assert.equal(report.job.file.mimeType,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
assert(report.downloadPath&&existsSync(report.downloadPath));assert.equal(digest(report.downloadPath),report.job.file.sha256);assert.equal(readFileSync(report.downloadPath).length,report.job.file.sizeBytes);
const basisFile=read(workspaceRoot+'.tmp/researchhub-workflow/t18-main-basis-current.json').acceptedFile,methodFile=read(workspaceRoot+'.tmp/researchhub-workflow/t18-main-method-current.json').acceptedFile;
const basis=read(basisFile),method=read(methodFile);assert.equal(method.basisSha,digest(basisFile));
assert(basis.passed&&basis.syntheticOnly&&method.passed&&method.syntheticOnly);
assert.equal(report.studyId,basis.studyId);assert.equal(report.snapshotId,basis.snapshotId);assert.equal(method.studyId,basis.studyId);assert.equal(method.planId,basis.planId);assert.equal(method.snapshotId,basis.snapshotId);assert.equal(report.runId,method.runId);assert.equal(method.status,'completed');assert.equal(method.reviewStatus,'confirmed');
assert(method.createRequestKey&&method.reviewRequestKey);
// Root approved the actual baseline Report proof and unique synthetic ONSITE correction.
// All code below remains unreachable while the fail-closed marker above exists.
// Directly read only the three authorized synthetic cases and frozen sources.

// The remainder is being assembled; no mutation is reachable above this sentinel.
const benchmark=read(read(workspaceRoot+'.tmp/researchhub-workflow/benchmark-current.json').acceptedFile);
const captureFile=read(workspaceRoot+'.tmp/researchhub-workflow/t18-main-capture-current.json').acceptedFile;assert.equal(captureFile,basis.captureFile);const capture=read(captureFile);
assert(benchmark.passed&&benchmark.syntheticOnly&&benchmark.runId==='rh-workflow-benchmark-747c689d');
assert(capture.passed&&capture.syntheticOnly&&capture.noCorrectionPerformed);assert.equal(digest(basis.captureFile),basis.captureSha256);
assert.equal(benchmark.study.id,basis.studyId);assert.equal(capture.studyId,basis.studyId);
const oraclePath=workspaceRoot+'researchhub/docs/testing/fixtures/research-study/generic-v2/oracle.json';
assert.equal(digest(oraclePath),'f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b');
const oracle=read(oraclePath);assert(oracle.syntheticOnly&&oracle.correction);assert.equal(method.oracleSha256,digest(oraclePath));
const h5Path=workspaceRoot+'researchhub/docs/testing/fixtures/research-study/generic-v2/h5-source.json';
assert.equal(digest(h5Path),oracle.h5EvidenceSha256);
assert.deepEqual(capture.h5Original.ref,capture.final.H5.capture.response.ref);
for(const name of ['ONSITE','CSV','H5']){
 const old=capture.final[name];assert.deepEqual(old.subject,benchmark.cases[name].subject);
 assert(old.subject.subjectId.startsWith('SYNTHETIC-'+name+'-747c689d'));
 assert.equal(old.capture.response.ref.revisionNo,1);assert(old.capture.response.locked&&old.capture.response.review==='review_approved');
 assert.equal(old.visit.status,'completed');assert.equal(old.visit.completionIntegrity,'current');
}
assert.equal(capture.final.ONSITE.capture.response.answers.value,0);
assert.equal(capture.final.ONSITE.capture.response.answers.optional_value,0);
assert.equal(capture.final.ONSITE.capture.response.answers.completed,false);
const {writeFileSync,mkdirSync}=await import('node:fs');
const {randomUUID}=await import('node:crypto');
const {createRequire}=await import('node:module');
const {fixtureEnvironment}=await import('./research-creation-fixture.mjs');
const {assertFixtureTarget,withFixtureTransaction}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
const {validAnalysisPreview,validAnalysisSnapshot,validAnalysisResult}=await import('../src/formal-analysis-session.js');
assert.equal((await assertFixtureTarget(fixtureEnvironment())).databaseName,'wp01_test_full_baseline');
const uiFreezeProof=read(workspaceRoot+'.tmp/researchhub-workflow/t18-ui-freeze-proof.json');assert(uiFreezeProof.approved&&uiFreezeProof.syntheticOnly);const uiSourceCurrent=createUiFreezeGuard({workspaceRoot,manifestFile:uiFreezeProof.manifestFile,manifestSha256:uiFreezeProof.manifestSha256});uiSourceCurrent();
const base='http://127.0.0.1:19501',api='/research-studies/'+basis.studyId,A=api+'/analysis';
const runtimePath=workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json',runtime=read(runtimePath);assert(runtime.ready===true&&Number.isSafeInteger(runtime.pid));assert.equal(runtime.ids.tenant,benchmark.scope.tenantId);const runtimeCurrent=()=>{const next=read(runtimePath);return next.ready===true&&next.pid===runtime.pid&&JSON.stringify(next.ids)===JSON.stringify(runtime.ids);};
const cookie=read(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json').admin;
const researcherCookie=read(workspaceRoot+'.tmp/researchhub-workflow/t16-method-session.json').cookie;
const aid=capture.final.ONSITE.capture.assignment.id,vid=capture.final.ONSITE.visit.id;
const runId='after-confirmed-unlock-'+randomUUID().slice(0,8),out=workspaceRoot+'researchhub/docs/testing/evidence/research-t18-2026-11-12/'+runId+'/';
const originalStatePath=workspaceRoot+'.tmp/researchhub-workflow/t18-main-correction-state.json',originalState=read(originalStatePath),originalJournalSha=digest(originalStatePath);assert.equal(originalState.studyId,basis.studyId);assert.equal(originalState.oldSnapshotId,basis.snapshotId);assert.equal(originalState.pending,null);assert.equal(originalState.history.length,1);const initialFailure=read(workspaceRoot+'researchhub/docs/testing/evidence/research-t18-2026-11-12/main-correction-33c9a4e8/failure.json');assert.equal(initialFailure.passed,false);assert.equal(initialFailure.stage,'unlock');assert.equal(initialFailure.pending,null);assert.deepEqual(originalState.history,initialFailure.history);const unlockedOriginal=originalState.history[0];assert.equal(unlockedOriginal.action,'unlock');assert.equal(unlockedOriginal.requestKey,'73a01ef4-7fb0-457d-a038-574dadd14435');assert.equal(unlockedOriginal.response?.studyId,basis.studyId);assert.equal(unlockedOriginal.response?.receipt?.action,'form.unlock');assert.equal(unlockedOriginal.response?.receipt?.targetId,aid);assert.equal(unlockedOriginal.response?.receipt?.requestKey,unlockedOriginal.requestKey);assert.equal(unlockedOriginal.path,api+'/assignments/'+aid+'/unlock');assert.equal(unlockedOriginal.receiptPath,api+'/assignments/'+aid+'/receipts/'+unlockedOriginal.requestKey+'?operation=unlock');assert.equal(unlockedOriginal.body?.requestKey,unlockedOriginal.requestKey);assert.equal(unlockedOriginal.response?.result?.assignmentId,aid);assert.equal(unlockedOriginal.response?.result?.responseId,capture.final.ONSITE.capture.response.ref.responseId);assert.equal(unlockedOriginal.body?.expectedVersion,3);assert.deepEqual(unlockedOriginal.body.expectedRef,capture.final.ONSITE.capture.response.ref);assert.equal(unlockedOriginal.response?.result?.version,4);assert.equal(unlockedOriginal.response?.result?.locked,false);assert.deepEqual(unlockedOriginal.response?.result?.ref,capture.final.ONSITE.capture.response.ref);
const statePath=workspaceRoot+'.tmp/researchhub-workflow/t18-after-confirmed-unlock-state.json';
const pointerPath=workspaceRoot+'.tmp/researchhub-workflow/t18-main-correction-current.json';
const state=existsSync(statePath)?read(statePath):{studyId:basis.studyId,oldSnapshotId:basis.snapshotId,originalJournalSha,pending:null,history:[unlockedOriginal],newSnapshotId:null};
assert.equal(state.studyId,basis.studyId);assert.equal(state.oldSnapshotId,basis.snapshotId);assert.equal(state.originalJournalSha,originalJournalSha);assert(Array.isArray(state.history));
mkdirSync(out,{recursive:true});
const saveState=()=>writeFileSync(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const network=[],errors=[],checks=[];let stage='preflight';
async function get(path,{status=200,raw=false,role='admin'}={}){
 const r=await fetch(base+'/api'+path,{headers:{Cookie:role==='researcher'?researcherCookie:cookie},redirect:'error',signal:AbortSignal.timeout(20000)});
 const value=raw?null:await r.json();network.push({at:new Date().toISOString(),stage,method:'GET',path:'/api'+path,status:r.status,code:value?.code??null});
 assert.equal(r.status,status,JSON.stringify({path,status:r.status,code:value?.code}));return raw?r:value;
}
async function originalSubjects(){
 for(const name of ['H5','CSV']){
  const original=capture.final[name],now=await get(api+'/assignments/'+original.capture.assignment.id);
  assertOriginalCapture(now,original.capture);
  assert.equal(now.response.locked,true);assert.equal(now.response.review,'review_approved');
  const v=(await get(api+'/visits/'+original.visit.id)).visit;
  assert.equal(v.actualCompletedAt,original.visit.actualCompletedAt);assert.equal(v.version,original.visit.version);assert.equal(v.status,'completed');assert.equal(v.completionIntegrity,'current');
  const ref=original.capture.response.ref;
  if(name==='CSV'){const proof=original.importSource;assert(proof?.receipt?.requestKey);const imported=await get(api+'/imports/receipts/'+proof.receipt.requestKey);assert.deepEqual(imported.receipt,proof.receipt);assert.deepEqual(imported.source,proof.source);assert(imported.rows.some(row=>JSON.stringify(row)===JSON.stringify(proof.row)));}
  const history=(await get(api+'/assignments/'+ref.assignmentId+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}))).revision;
  for(const key of ['ref','answers','source','actorKind','actorId','sourceSubmittedAt','createdAt'])assert.deepEqual(history[key],original.revision[key]);if(name==='H5')for(const [key,value] of Object.entries(capture.h5Original))assert.deepEqual(history[key],value);
 }
}
async function readonlyDb(){
 return withFixtureTransaction(fixtureEnvironment(),'direct',async tx=>{
  const where={tenantId:benchmark.scope.tenantId,studyGroupId:benchmark.scope.studyGroupId,researchProjectId:benchmark.scope.researchProjectId};
  const [visitEvidence,fulfillments,jobs,files,version,sourceRows,methodRow,snapshotRows]=await Promise.all([
   tx.subjectVisit.findFirst({where:{...where,id:vid},select:{id:true,evidenceRefs:true}}),
   tx.visitRequirementFulfillment.findMany({where:{...where,subjectVisitId:vid},select:{id:true,evidenceRefs:true}}),
   tx.researchArtifactExportJob.findMany({where:{...where,artifactId:report.artifactId},select:{id:true,status:true,fileId:true},orderBy:{id:'asc'}}),
   tx.researchArtifactFile.findMany({where:{...where,artifactId:report.artifactId},select:{id:true,sha256:true},orderBy:{id:'asc'}}),
   tx.researchArtifactVersion.findFirst({where:{...where,artifactId:report.artifactId,versionNo:1},select:{contentHash:true,sourceSnapshotHash:true}}),
   tx.researchArtifactSource.findMany({where:{...where,artifactVersion:{artifactId:report.artifactId}},select:{sourceType:true,sourceId:true,hash:true},orderBy:{id:'asc'}}),
   tx.researchMethodRun.findFirst({where:{...where,id:method.runId},select:{id:true,status:true,reviewStatus:true,inputSummary:true,inputHash:true,artifactRefs:true}}),
   tx.$queryRaw`SELECT id,manifest_hash,quality_gate_id,plan_id,review_id FROM rh_analysis.snapshot WHERE tenant_id=${where.tenantId} AND study_group_id=${where.studyGroupId} AND research_project_id=${where.researchProjectId} AND study_id=${basis.studyId} AND id=${basis.snapshotId}`
  ]);return {visitEvidence,fulfillments,jobs,files,version,sourceRows,methodRow,snapshotRows};
 },{readOnly:true});
}
async function oldBasisBlocked(final=false){
 for(const path of [A+'/snapshots/'+basis.snapshotId,A+'/runs/'+method.runId,A+'/run-receipts/'+method.createRequestKey,A+'/reports/'+report.artifactId,A+'/report-exports/'+report.job.jobId,A+'/report-exports/'+report.job.jobId+'/file']){
  const r=await fetch(base+'/api'+path,{headers:{Cookie:path===A+'/run-receipts/'+method.createRequestKey?researcherCookie:cookie},redirect:'error',signal:AbortSignal.timeout(20000)});
  const value=await r.json();network.push({at:new Date().toISOString(),stage,method:'GET',path:'/api'+path,status:r.status,code:value?.code??null});
  assert.equal(r.status,409,JSON.stringify({path,status:r.status,code:value?.code}));
  assertSourceError(value,final&&path===A+'/snapshots/'+basis.snapshotId);
 }
 const runs=await get(A+'/runs'),run=runs.items.find(x=>x.id===method.runId);assert(run&&run.analysisState==='blocked'&&(!run.outputs||Object.keys(run.outputs).length===0));
 assertBlockedRunMetadata(run);const caps=await get(A+'/runs/'+method.runId+'/capabilities');assertNoSensitive(caps);assert.equal(caps.status,'completed');assert.equal(caps.reviewStatus,'confirmed');assert.deepEqual(Object.keys(caps).sort(),['capabilities','reviewStatus','runId','status','studyId'].sort());
 const reports=await get(A+'/reports'),item=reports.items.find(x=>x.artifactId===report.artifactId);assert(item&&item.analysisState==='blocked'&&!item.contentMd);assertNoSensitive(item);assert(Object.keys(item).every(k=>['artifactId','title','status','versionNo','createdAt','analysisState'].includes(k)),'UNEXPECTED_REPORT_METADATA');
 for(const [action,target,key] of [['analysis.report.create',method.runId,report.createRequestKey],['analysis.report.review',report.artifactId,report.reviewRequestKey],['analysis.report.release',report.artifactId,report.releaseRequestKey],['analysis.report.export',report.artifactId,report.exportRequestKey]]){
  const path=A+'/report-receipts/'+key+'?'+new URLSearchParams({action,targetId:target});const r=await fetch(base+'/api'+path,{headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(20000)});const v=await r.json();network.push({stage,method:'GET',path:'/api'+path,status:r.status,code:v?.code??null});assert.equal(r.status,409);assertSourceError(v);
 }
}
async function negativeExport(){
 const before=await readonlyDb(),key=randomUUID(),path=A+'/reports/'+report.artifactId+'/exports';
 const operations=()=>withFixtureTransaction(fixtureEnvironment(),'direct',tx=>tx.$queryRaw`SELECT id FROM rh_research.operation WHERE tenant_id=${benchmark.scope.tenantId} AND actor_id=${report.actors.export.accountId} AND request_key=${key}`,{readOnly:true});assert.equal((await operations()).length,0);
 assert.equal(state.pending,null);state.pending={action:'negative_export',requestKey:key,receiptPath:A+'/report-receipts/'+key+'?'+new URLSearchParams({action:'analysis.report.export',targetId:report.artifactId})};saveState();
 assert(runtimeCurrent(),'RUNTIME_CHANGED_BEFORE_NEGATIVE_EXPORT');uiSourceCurrent();const r=await fetch(base+'/api'+path,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({requestKey:key,versionNo:1,format:'docx'}),redirect:'error',signal:AbortSignal.timeout(20000)});
 const v=await r.json();network.push({stage,method:'POST',path:'/api'+path,status:r.status,code:v?.code??null});
 assert.equal(r.status,409);assertSourceError(v);
 const after=await readonlyDb();assert.equal((await operations()).length,0);assert.deepEqual(after.jobs,before.jobs);assert.deepEqual(after.files,before.files);assert.deepEqual(after.version,before.version);assert.deepEqual(after.sourceRows,before.sourceRows);
 state.history.push({...state.pending,rejectedCode:v.code,confirmedAt:new Date().toISOString()});state.pending=null;saveState();return {before,after};
}
const {chromium}=createRequire(workspaceRoot+'app/package.json')('./node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');
let browser,context,page,armed=null;
async function startBrowser(){
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video'}});
 const i=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,i),value:cookie.slice(i+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'}]);
 await context.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url());try{
   assert.equal(u.origin,base);if(req.method()==='GET'||req.method()==='POST'&&u.pathname==='/api/auth/renew')return await route.continue();
   assert(armed&&!armed.used&&req.method()==='POST'&&u.pathname==='/api'+armed.path,'UNARMED_MUTATION');assert(runtimeCurrent(),'RUNTIME_CHANGED_BEFORE_WRITE');uiSourceCurrent();
   const body=req.postDataJSON();armed.validate(body);assert.equal(state.pending,null);assert(typeof body.requestKey==='string');armed.used=true;
   state.pending={action:armed.action,requestKey:body.requestKey,path:armed.path,receiptPath:armed.receiptPath(body.requestKey),body,at:new Date().toISOString()};saveState();assert(runtimeCurrent(),'RUNTIME_CHANGED_AT_DISPATCH');uiSourceCurrent();return await route.continue();
  }catch(e){errors.push({stage,message:e.message});return route.abort('blockedbyclient');}
 });
 page=await context.newPage();page.on('pageerror',e=>errors.push({stage,message:e.message}));page.on('dialog',async d=>{errors.push({stage,message:'unexpected native dialog '+d.type()});await d.dismiss();});
 page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({at:new Date().toISOString(),stage,method:r.request().method(),path:u.pathname+u.search,status:r.status()});});
}
async function phase(action,path,receiptPath,validate,click){
 assert.equal(state.pending,null);uiSourceCurrent();await originalSubjects();await page.waitForLoadState('networkidle');armed={action,path,receiptPath,validate,used:false};
 const promise=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api'+path);promise.catch(()=>{});
 try{await click();const response=await promise,value=await response.json();assert.equal(response.status(),200);assert(armed.used&&state.pending);
  const p=state.pending,receipt=await get(p.receiptPath);assert.equal(receipt.studyId,basis.studyId);assert.equal(receipt.receipt?.requestKey,p.requestKey);assert.equal(receipt.receipt?.action,action==='release'?'analysis.release':(action==='reverify'?'visit.':'form.')+action);assert.equal(receipt.receipt?.targetId,action==='release'?basis.planId:action==='reverify'?vid:aid);
  if(action==='release')assert(validAnalysisResult(receipt,{studyId:basis.studyId,planId:basis.planId,action:'release',requestKey:p.requestKey}));
  else assert.deepEqual(receipt,value);
  state.history.push({...p,confirmedAt:new Date().toISOString(),response:receipt});state.pending=null;saveState();await originalSubjects();return receipt;
 }finally{armed=null;}
}
async function confirm(name,action,validate){
 const path=action==='reverify'?api+'/visits/'+vid+'/reverify':api+'/assignments/'+aid+'/'+action;
 const receipt=key=>action==='reverify'?api+'/visits/'+vid+'/receipts/'+key+'?operation=reverify':api+'/assignments/'+aid+'/receipts/'+key+'?operation='+action;
 await page.getByRole('button',{name,exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 const result=await phase(action,path,receipt,validate,()=>dialog.getByRole('button',{name:'确认',exact:true}).click());await page.getByText('已保存并核对当前状态。',{exact:true}).waitFor();return result;
}
try{
 const me=await get('/auth/me');assert.equal(me.tenantId,benchmark.scope.tenantId);assert(me.role==='tenant_admin'&&me.isTenantAdmin);for(const actor of Object.values(report.actors)){assert.equal(actor.accountId,me.accountId);assert.equal(actor.authVersion,me.authVersion);}
 if(state.pending){stage='prior-unknown-original-receipt';const p=state.pending;const r=await fetch(base+'/api'+p.receiptPath,{headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(20000)});network.push({stage,method:'GET',path:'/api'+p.receiptPath,status:r.status});
  if(r.status===200){const v=await r.json(),expectedAction=p.action==='release'?'analysis.release':p.action==='negative_export'?'analysis.report.export':(p.action==='reverify'?'visit.':'form.')+p.action,target=p.action==='release'?basis.planId:p.action==='negative_export'?report.artifactId:p.action==='reverify'?vid:aid;assert.equal(v.studyId,basis.studyId);assert.equal(v.receipt?.requestKey,p.requestKey);assert.equal(v.receipt?.action,expectedAction);assert.equal(v.receipt?.targetId,target);state.history.push({...p,readOnlyRecoveredAt:new Date().toISOString(),response:v});state.pending=null;saveState();}
  throw Error('PRIOR_UNKNOWN_GET_ONLY_STOP_FOR_ROOT_REVIEW');
 }
 assert.equal(state.history.length,1,'PRIOR_PARTIAL_JOURNAL_STOP_FOR_ROOT_REVIEW');assert.deepEqual(state.history[0],unlockedOriginal);
 stage='confirmed-unlock-preflight';assert.equal(me.accountId,report.actors.create.accountId);assert.equal(me.authVersion,5);
 const unlockReceipt=await get(unlockedOriginal.receiptPath);assert.deepEqual(unlockReceipt,unlockedOriginal.response);assert.equal(unlockReceipt.receipt.action,'form.unlock');assert.equal(unlockReceipt.receipt.targetId,aid);
 const fixedRun=read(method.runFile);assert.equal(fixedRun.id,method.runId);assert.equal(fixedRun.status,'completed');assert.equal(fixedRun.reviewStatus,'confirmed');assert.deepEqual(fixedRun.dataSources.analysisBasis,basis.snapshot.basis);
 const dbBefore=await readonlyDb();assert.equal(dbBefore.version.contentHash,report.contentHash);assert.equal(dbBefore.methodRow?.id,method.runId);assert.equal(dbBefore.methodRow.status,'completed');assert.equal(dbBefore.methodRow.reviewStatus,'confirmed');assert.equal(dbBefore.methodRow.inputHash,fixedRun.inputHash);assert.deepEqual(dbBefore.methodRow.inputSummary,fixedRun.inputSummary);assert.deepEqual(dbBefore.methodRow.artifactRefs,fixedRun.artifactRefs);assert.equal(dbBefore.snapshotRows.length,1);assert.equal(dbBefore.snapshotRows[0].manifest_hash,basis.snapshot.basis.manifestHash);assert.equal(dbBefore.snapshotRows[0].review_id,basis.snapshot.basis.planReviewId);assert.equal(dbBefore.snapshotRows[0].quality_gate_id,basis.snapshot.basis.qualityGateId);assert(dbBefore.jobs.some(x=>x.id===report.job.jobId&&x.status==='ready'&&x.fileId===report.job.file.id));assert(dbBefore.files.some(x=>x.id===report.job.file.id&&x.sha256===report.job.file.sha256));assert(dbBefore.sourceRows.some(x=>x.sourceType==='research_method_run'&&x.sourceId===method.runId));assert(dbBefore.sourceRows.some(x=>x.sourceType==='data_snapshot'&&x.sourceId===basis.snapshotId));
 await originalSubjects();const initial=await get(api+'/assignments/'+aid);assert.equal(initial.assignment.id,aid);assert.equal(initial.assignment.subjectId,capture.final.ONSITE.capture.assignment.subjectId);assert.equal(initial.assignment.subjectVisitId,vid);assert.equal(initial.response.id,capture.final.ONSITE.capture.response.id);assert.equal(initial.response.status,capture.final.ONSITE.capture.response.status);assert.equal(initial.response.version,4);assert.equal(initial.response.locked,false);assert.deepEqual(initial.response.ref,capture.final.ONSITE.capture.response.ref);assert.deepEqual(initial.response.answers,capture.final.ONSITE.capture.response.answers);
 const originalVisit=(await get(api+'/visits/'+vid)).visit;assert.equal(originalVisit.actualCompletedAt,capture.final.ONSITE.visit.actualCompletedAt);assert.equal(originalVisit.version,capture.final.ONSITE.visit.version);assert.equal(originalVisit.status,'completed');assert.equal(originalVisit.completionIntegrity,'requires_review');
 const originalPlan=await get(A+'/plans/'+basis.planId+'?limit=20');assert.deepEqual(originalPlan.definition,basis.definition);assert.equal(originalPlan.contentHash,basis.plan.contentHash);assert.equal(originalPlan.review.decision,'approved');assert.equal(originalPlan.review.reviewId,basis.plan.review.reviewId);assert.equal(originalPlan.review.sequence,basis.plan.review.sequence);await oldBasisBlocked();
 await startBrowser();await page.goto(base+'/pages/s09/?'+new URLSearchParams({formalCapture:'1',studyId:basis.studyId,visitId:vid,assignmentId:aid}));
 await page.waitForFunction(()=>{const m=document.querySelector('main.rh-formal-capture');return m&&m.getAttribute('aria-busy')==='false'&&!m.textContent.includes('正在读取当前研究');});
 async function reviewPanel(){const d=page.locator('details.fc-review');if(!await d.evaluate(e=>e.open))await page.getByText('更正与审阅',{exact:true}).click();}
 function expected(body,current){assert.equal(body.expectedVersion,current.response.version);assert.deepEqual(body.expectedRef,current.response.ref);}
 const unlocked=initial;await originalSubjects();
 stage='correct';await reviewPanel();await page.getByLabel('审阅或解锁原因').fill('合成验收：核对原解锁与固定来源后继续审阅。');await page.getByRole('button',{name:'更正记录',exact:true}).click();await page.getByLabel('观察值（必填）').fill('1');await page.getByLabel('更正原因').fill('合成验收：核对来源后仅将观察值由0更正为1。');
 await page.getByRole('button',{name:'核对并保存更正',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('table.fc-diff tbody tr').count(),1);assert.equal(await dialog.locator('table.fc-diff tbody tr th').innerText(),'观察值');assert.equal(await dialog.getByRole('cell',{name:'0',exact:true}).count(),1);assert.equal(await dialog.getByRole('cell',{name:'1',exact:true}).count(),1);
 await phase('correct',api+'/assignments/'+aid+'/correct',key=>api+'/assignments/'+aid+'/receipts/'+key+'?operation=correct',b=>{expected(b,unlocked);assert.deepEqual(b.answers,{...initial.response.answers,value:1});assert(b.reason?.trim());},()=>dialog.getByRole('button',{name:'确认',exact:true}).click());
 await page.getByText('已保存并核对当前状态。',{exact:true}).waitFor();let corrected=await get(api+'/assignments/'+aid);assert.equal(corrected.response.ref.revisionNo,2);assert.equal(corrected.response.ref.responseId,initial.response.ref.responseId);assert.notEqual(corrected.response.ref.contentHash,initial.response.ref.contentHash);assert.deepEqual(corrected.response.answers,{...initial.response.answers,value:1});
 const oldRef=initial.response.ref,oldRevision=(await get(api+'/assignments/'+aid+'/revisions/1?'+new URLSearchParams({responseId:oldRef.responseId,contentHash:oldRef.contentHash}))).revision;
 assert.deepEqual(oldRevision.ref,oldRef);assert.deepEqual(oldRevision.answers,initial.response.answers);
 let visit=(await get(api+'/visits/'+vid)).visit;assert.equal(visit.completionIntegrity,'requires_review');assert.equal(visit.actualCompletedAt,originalVisit.actualCompletedAt);
 stage='review';await reviewPanel();await confirm('审核通过','review',b=>{expected(b,corrected);assert.equal(b.decision,'approved');});corrected=await get(api+'/assignments/'+aid);assert.equal(corrected.response.review,'review_approved');
 stage='lock';await reviewPanel();await confirm('锁定表单','lock',b=>expected(b,corrected));corrected=await get(api+'/assignments/'+aid);assert(corrected.response.locked);assert.equal(corrected.response.ref.revisionNo,2);
 stage='reverify';visit=(await get(api+'/visits/'+vid)).visit;await page.getByLabel('重新核对原因').fill('合成验收重新核对当前修订与完成依据。');await confirm('重新核对完成依据','reverify',b=>{assert.equal(b.expectedVersion,visit.version);assert(b.reason?.trim());});
 visit=(await get(api+'/visits/'+vid)).visit;assert.equal(visit.completionIntegrity,'current');assert.equal(visit.actualCompletedAt,originalVisit.actualCompletedAt);const reverifyReceipt=state.history.find(x=>x.action==='reverify');assert.equal(visit.version,reverifyReceipt.response.visit.version);assert.equal(visit.version,reverifyReceipt.body.expectedVersion+1);await oldBasisBlocked(true);
 const postCorrection=await readonlyDb();assert.deepEqual(postCorrection.version,dbBefore.version);assert.deepEqual(postCorrection.sourceRows,dbBefore.sourceRows);assert.deepEqual(postCorrection.methodRow,dbBefore.methodRow);assert.deepEqual(postCorrection.snapshotRows,dbBefore.snapshotRows);
 const hasRef=(rows,ref)=>rows.some(f=>f.evidenceRefs.some(e=>e.type==='formal_response_revision'&&Object.entries(ref).every(([k,v])=>e[k]===v)));
 assert(hasRef([dbBefore.visitEvidence],oldRef));assertVisitEvidence(dbBefore.visitEvidence.evidenceRefs,postCorrection.visitEvidence.evidenceRefs,corrected.response.ref,corrected.response.version);const oldFulfillments=dbBefore.fulfillments.filter(f=>hasRef([f],oldRef));assert.equal(oldFulfillments.length,1);const newFulfillment=postCorrection.fulfillments.find(f=>f.id===oldFulfillments[0].id);assert(newFulfillment&&hasRef([newFulfillment],corrected.response.ref));
 stage='negative-export';const noExport=await negativeExport();checks.push('old_basis_blocked_and_no_export_job_or_file_added');
 stage='new-basis';await page.goto(base+'/pages/s05/?'+new URLSearchParams({formalAnalysis:'1',studyId:basis.studyId,planId:basis.planId}));
 const plan=await get(A+'/plans/'+basis.planId+'?limit=20');assert.equal(plan.review.decision,'approved');assert.deepEqual(plan.definition,basis.definition);assert.equal(plan.review.reviewId,basis.plan.review.reviewId);assert.equal(plan.review.sequence,basis.plan.review.sequence);assert.equal(plan.contentHash,basis.plan.contentHash);
 const wait=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api'+A+'/plans/'+basis.planId+'/preview');
 await page.getByRole('button',{name:'核对当前分析数据',exact:true}).click();const response=await wait;assert.equal(response.status(),200);const preview=await response.json();assert(validAnalysisPreview(preview,plan));assert.equal(preview.evaluation.status,'review_required');assert.equal(preview.evaluation.blockingCount,0);assert.notEqual(preview.manifestHash,basis.snapshot.basis.manifestHash);
 assertPreviewRows(preview.manifest,['ONSITE','CSV','H5'].map(name=>({subjectId:benchmark.cases[name].subject.id,visitId:capture.final[name].visit.id,enrollmentId:capture.final[name].visit.enrollmentId,visitVersion:name==='ONSITE'?visit.version:capture.final[name].visit.version,responseVersion:name==='ONSITE'?corrected.response.version:capture.final[name].capture.response.version})));
 for(const name of ['ONSITE','CSV','H5']){const subject=benchmark.cases[name].subject.id,row=preview.manifest.rows.find(r=>r.subjectId===subject);assert(row);const expectedAnswers=name==='ONSITE'?corrected.response.answers:capture.final[name].capture.response.answers,ref=name==='ONSITE'?corrected.response.ref:capture.final[name].capture.response.ref;for(const variable of basis.definition.variables){const cell=row.cells.find(c=>c.key===variable.key);assert(cell);assert.deepEqual(cell.source.ref,ref);const has=Object.prototype.hasOwnProperty.call(expectedAnswers,variable.fieldKey),raw=expectedAnswers[variable.fieldKey];assert.deepEqual(cell.value,has?raw:null);assert.equal(cell.missing,!has?'not_recorded':raw===null?'null':null);}}
 await page.getByLabel('分析快照放行理由',{exact:true}).fill('核对唯一更正、其他原来源及当前完成依据后放行合成快照。');await page.getByRole('button',{name:'核对并放行快照',exact:true}).click();dialog=page.getByRole('dialog');await dialog.waitFor();
 const released=await phase('release',A+'/plans/'+basis.planId+'/snapshots',key=>A+'/receipts/'+key+'?'+new URLSearchParams({action:'analysis.release',targetId:basis.planId}),b=>{assert.equal(b.previewHash,preview.manifestHash);assert(b.reason?.trim());},()=>dialog.getByRole('button',{name:'确认放行快照',exact:true}).click());
 assert.notEqual(released.snapshotId,basis.snapshotId);assert.equal(released.manifestHash,preview.manifestHash);const snapshot=await get(A+'/snapshots/'+released.snapshotId);assert(validAnalysisSnapshot(snapshot,plan,released.snapshotId));assert.notEqual(snapshot.basis.qualityGateId,basis.snapshot.basis.qualityGateId);assert.equal(snapshot.basis.qualityGateId,released.qualityGateId);assert.deepEqual(snapshot.manifest,preview.manifest);const updatedPlan=await get(A+'/plans/'+basis.planId+'?limit=20');assert.deepEqual(updatedPlan.definition,basis.definition);assert.equal(updatedPlan.contentHash,basis.plan.contentHash);assert.equal(updatedPlan.review.decision,'approved');assert.equal(updatedPlan.review.reviewId,basis.plan.review.reviewId);assert.equal(updatedPlan.review.sequence,basis.plan.review.sequence);assert(updatedPlan.snapshots.some(x=>x.snapshotId===basis.snapshotId));assert(updatedPlan.snapshots.some(x=>x.snapshotId===released.snapshotId));await oldBasisBlocked(true);await originalSubjects();
 await page.screenshot({path:out+'new-basis.png',fullPage:true});uiSourceCurrent();assert.equal(digest(originalStatePath),originalJournalSha,'ORIGINAL_JOURNAL_CHANGED');assert.deepEqual(errors,[]);state.newSnapshotId=released.snapshotId;saveState();
 await context.close();await browser.close();writeFileSync(out+'confirmed-journal.json',JSON.stringify(state,null,2)+'\n',{mode:0o600});const result={uiFreezeProof,passed:true,syntheticOnly:true,clinicalAcceptance:false,productionAcceptance:false,studyId:basis.studyId,planId:basis.planId,oldSnapshotId:basis.snapshotId,newSnapshotId:released.snapshotId,oldRef,newRef:corrected.response.ref,preview,oldRevision,dbBefore,postCorrection,noExport,checks,network,journal:out+'confirmed-journal.json',inputSha256:{capture:digest(captureFile),basis:digest(basisFile),method:digest(methodFile),report:digest(args[3])},runtimePid:runtime.pid,phase:'correction-and-new-basis-only',resumedAfterConfirmedUnlock:true,originalJournalSha};
 writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});writeFileSync(pointerPath,JSON.stringify({acceptedFile:out+'result.json'})+'\n',{mode:0o600});console.log(JSON.stringify({passed:true,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,message:error.message,pending:state.pending,history:state.history,network,errors},null,2)+'\n',{mode:0o600});if(page)await page.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});if(context)await context.close();if(browser)await browser.close();throw error;}
