// Prepared for root review only. Sentinel blocks all IO below.
// node scripts/research-t18-corrected-method.mjs --local-synthetic --execute-corrected-method
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {createUiFreezeGuard} from './research-t18-ui-freeze-guard.mjs';
import {assertOriginalCapture,assertSourceError,assertPreviewRows} from './research-t18-correction-guards.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';

assert.deepEqual(process.argv.slice(2),['--local-synthetic','--execute-confirm-created-method']);
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=workspaceRoot, base='http://127.0.0.1:19501';
const benchmark=json(json(root+'.tmp/researchhub-workflow/benchmark-current.json').acceptedFile);
const basisFile=json(root+'.tmp/researchhub-workflow/t18-main-basis-current.json').acceptedFile;
const basisBytes=readFileSync(basisFile), baselineBasis=JSON.parse(basisBytes);
const correctionFile=json(root+'.tmp/researchhub-workflow/t18-main-correction-current.json').acceptedFile;
const correctionBytes=readFileSync(correctionFile),correction=JSON.parse(correctionBytes);
const originalMethodFile=json(root+'.tmp/researchhub-workflow/t18-main-method-current.json').acceptedFile,originalMethod=json(originalMethodFile);
const originalReportFile=json(root+'.tmp/researchhub-workflow/t18-main-report-current.json').acceptedFile,originalReport=json(originalReportFile);
assert(correction.passed&&correction.syntheticOnly&&correction.phase==='correction-and-new-basis-only');
assert.equal(correction.studyId,baselineBasis.studyId);assert.equal(correction.planId,baselineBasis.planId);
assert.equal(correction.oldSnapshotId,baselineBasis.snapshotId);assert.notEqual(correction.newSnapshotId,baselineBasis.snapshotId);
for(const [key,file] of [['basis',basisFile],['method',originalMethodFile],['report',originalReportFile]])assert.equal(correction.inputSha256[key],hash(readFileSync(file)));
assert(originalMethod.passed&&originalMethod.syntheticOnly&&originalMethod.status==='completed'&&originalMethod.reviewStatus==='confirmed');
assert(originalReport.passed&&originalReport.syntheticOnly&&originalReport.runId===originalMethod.runId&&originalReport.status==='released');
const basis={...baselineBasis,snapshotId:correction.newSnapshotId,snapshot:{manifest:correction.preview.manifest}};
const oracleBytes=readFileSync(root+'researchhub/docs/testing/fixtures/research-study/generic-v2/oracle.json');
const oracleSha=hash(oracleBytes), oracle=JSON.parse(oracleBytes);
assert.equal(oracleSha,'f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b');
assert(benchmark.passed&&benchmark.syntheticOnly&&benchmark.runId==='rh-workflow-benchmark-747c689d');
assert(basis.passed&&basis.syntheticOnly&&basis.originalMainSourcesUnchanged&&!basis.analysisExecuted&&!basis.reportExecuted);
assert.equal(basis.studyId,benchmark.study.id);assert.equal(basis.oracleSha256,oracleSha);
assert.equal((await assertFixtureTarget(fixtureEnvironment())).databaseName,'wp01_test_full_baseline');
const uiFreezeProof=json(root+'.tmp/researchhub-workflow/t18-ui-freeze-proof.json');assert(uiFreezeProof.approved&&uiFreezeProof.syntheticOnly);const uiSourceCurrent=createUiFreezeGuard({workspaceRoot:root,manifestFile:uiFreezeProof.manifestFile,manifestSha256:uiFreezeProof.manifestSha256});uiSourceCurrent();
const vars=basis.snapshot.manifest.variables;
assert.deepEqual(vars.map(v=>v.fieldKey).sort(),['completed','optional_value','value'].sort());
assert.deepEqual(vars,basis.definition.variables);
const runtime=json(root+'.tmp/researchhub-knowledge-local/runtime.json');
assert(runtime.ready===true&&Number.isSafeInteger(runtime.pid));
assert.equal(runtime.ids.tenant,benchmark.scope.tenantId);
const runtimeCurrent=()=>{const next=json(root+'.tmp/researchhub-knowledge-local/runtime.json');return next.ready===true&&next.pid===runtime.pid&&JSON.stringify(next.ids)===JSON.stringify(runtime.ids);};
const statePath=root+'.tmp/researchhub-workflow/t18-corrected-method-state.json';
const pointerPath=root+'.tmp/researchhub-workflow/t18-corrected-method-current.json';
const state=existsSync(statePath)?json(statePath):{studyId:basis.studyId,planId:basis.planId,snapshotId:basis.snapshotId,basisSha:hash(basisBytes),correctionSha:hash(correctionBytes),pending:null,runId:null,reviewed:false};
const reusedExistingAtStart=!!state.runId;
assert.deepEqual([state.studyId,state.planId,state.snapshotId,state.basisSha,state.correctionSha],[basis.studyId,basis.planId,basis.snapshotId,hash(basisBytes),hash(correctionBytes)]);
if(existsSync(pointerPath)){const prior=json(json(pointerPath).acceptedFile);assert(prior.passed&&prior.syntheticOnly&&prior.studyId===basis.studyId&&prior.snapshotId===basis.snapshotId&&prior.basisSha===state.basisSha&&prior.correctionSha===state.correctionSha);if(state.runId)assert.equal(state.runId,prior.runId);else{assert(!state.pending,'PENDING_OPERATION_MUST_BE_RESOLVED_FIRST');assert(prior.createRequestKey&&prior.reviewRequestKey,'ORIGINAL_KEYS_MISSING');state.runId=prior.runId;state.reviewed=true;state.createRequestKey=prior.createRequestKey;state.reviewRequestKey=prior.reviewRequestKey;assert(prior.actors?.create&&prior.actors?.review,'ORIGINAL_ACTORS_MISSING');state.actors=prior.actors;}}
const saveState=()=>writeFileSync(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const runName='corrected-method-'+randomUUID().slice(0,8), out=root+'researchhub/docs/testing/evidence/research-t18-2026-11-12/'+runName+'/';
mkdirSync(out,{recursive:true});
const cookies=json(root+'.tmp/researchhub-19501-integration/preflight-cookie.json');
cookies.researcher=json(root+'.tmp/researchhub-workflow/t16-method-session.json').cookie;
const api='/research-studies/'+basis.studyId, analysis=api+'/analysis', network=[],errors=[],checks=[],contexts=[];
let stage='preflight';
async function get(path,role='admin',allow404=false){
 const r=await fetch(base+'/api'+path,{headers:{Cookie:cookies[role]},redirect:'error',signal:AbortSignal.timeout(20000)});
 const value=await r.json(); network.push({stage,via:'readonly-fetch',role,method:'GET',path:'/api'+path,status:r.status,code:value?.code??null});
 if(allow404&&r.status===404)return null; assert.equal(r.status,200,JSON.stringify({path,status:r.status,code:value?.code}));return value;
}
function receiptPath(p){return analysis+(p.action==='create'?'/run-receipts/'+p.key:'/runs/'+p.runId+'/review-receipts/'+p.key);}
async function recover(){
 if(!state.pending)return;
 const p=state.pending,role=p.action==='create'?'researcher':'admin',me=await get('/auth/me',role);assert(p.actor&&p.actor.accountId===me.accountId&&p.actor.authVersion===me.authVersion,'ORIGINAL_ACTOR_CHANGED');const r=await get(receiptPath(p),role,true);
 assert(r,'ORIGINAL_RECEIPT_UNKNOWN: stop; do not repeat any POST');
 assert.equal(r.studyId,basis.studyId);assert.equal(r.receipt.requestKey,p.key);
 assert.equal(r.receipt.action,p.action==='create'?'analysis.run.create':'analysis.run.review');
 if(p.action==='create'){assert.equal(r.dataSources.analysisBasis.snapshotId,basis.snapshotId);assert.equal(r.dataSources.analysisBasis.planId,basis.planId);state.runId=r.id;state.createRequestKey=p.key;}
 else {assert.equal(r.runId,p.runId);state.reviewed=true;state.reviewRequestKey=p.key;}
 state.actors={...state.actors,[p.action]:p.actor};state.operations=[...(state.operations??[]),{action:p.action,requestKey:p.key,actor:p.actor,at:new Date().toISOString(),receiptPath:receiptPath(p)}];state.pending=null;saveState();
}
// An earlier uncertain phase is GET-only and stops for root review.
if(state.pending){await recover();throw Error('PRIOR_UNKNOWN_GET_ONLY_STOP_FOR_ROOT_REVIEW');}
assert.equal(state.runId,'cmwdq0636001jlud6scho3s1q');assert.equal(state.createRequestKey,'4d702e3b-de76-49ea-9196-c495f39a6af5');assert.equal(state.pending,null);assert.equal(state.reviewed,false);assert.equal(state.reviewRequestKey,undefined);assert.deepEqual(state.actors.create,{accountId:'rh-kb-local-b0e2af9d-method-researcher',authVersion:0});
const creator=await get('/auth/me','researcher');assert.equal(creator.accountId,state.actors.create.accountId);assert.equal(creator.authVersion,state.actors.create.authVersion);const originalCreate=await get(analysis+'/run-receipts/'+state.createRequestKey,'researcher');assert.equal(originalCreate.id,state.runId);assert.equal(originalCreate.receipt.requestKey,state.createRequestKey);assert.equal(originalCreate.dataSources.analysisBasis.snapshotId,basis.snapshotId);
const capture=json(baselineBasis.captureFile);assert.equal(hash(readFileSync(baselineBasis.captureFile)),baselineBasis.captureSha256);
assert.equal(correction.inputSha256.capture,hash(readFileSync(baselineBasis.captureFile)));
assert.deepEqual(capture.h5Original.ref,capture.final.H5.capture.response.ref);
let expectedSourceBasis=null;
async function assertMainSources(){
 const plan=await get(analysis+'/plans/'+basis.planId+'?limit=20');
 assert.deepEqual(plan.definition,baselineBasis.definition);assert.equal(plan.contentHash,baselineBasis.plan.contentHash);
 assert.equal(plan.review.decision,'approved');assert.equal(plan.review.reviewId,baselineBasis.plan.review.reviewId);assert.equal(plan.review.sequence,baselineBasis.plan.review.sequence);
 const current=await get(analysis+'/snapshots/'+basis.snapshotId);assert.deepEqual(current.manifest,correction.preview.manifest);assert.equal(current.basis.manifestHash,correction.preview.manifestHash);assert.equal(current.basis.planReviewId,baselineBasis.snapshot.basis.planReviewId);assert.notEqual(current.basis.qualityGateId,baselineBasis.snapshot.basis.qualityGateId);if(expectedSourceBasis)assert.deepEqual(current.basis,expectedSourceBasis);else expectedSourceBasis=current.basis;
 const expectations=[];
 for(const name of ['ONSITE','CSV','H5']){
  const original=capture.final[name],a=await get(api+'/assignments/'+original.capture.assignment.id);
  if(name==='ONSITE'){
   assert.equal(a.assignment.id,original.capture.assignment.id);assert.equal(a.assignment.subjectId,original.capture.assignment.subjectId);assert.equal(a.assignment.subjectVisitId,original.visit.id);
   assert.equal(a.response.id,original.capture.response.id);assert.deepEqual(a.response.ref,correction.newRef);assert.equal(a.response.ref.revisionNo,2);
   assert.deepEqual(a.response.answers,{...original.capture.response.answers,value:oracle.correction.newValue});
   const oldRef=original.capture.response.ref;
   const historical=(await get(api+'/assignments/'+a.assignment.id+'/revisions/1?'+new URLSearchParams({responseId:oldRef.responseId,contentHash:oldRef.contentHash}))).revision;
   for(const key of ['ref','answers','source','actorKind','actorId','sourceSubmittedAt','createdAt'])assert.deepEqual(historical[key],original.revision[key]);
  }else{
   assertOriginalCapture(a,original.capture);
   const ref=original.capture.response.ref;
   const history=(await get(api+'/assignments/'+ref.assignmentId+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}))).revision;
   for(const key of ['ref','answers','source','actorKind','actorId','sourceSubmittedAt','createdAt'])assert.deepEqual(history[key],original.revision[key]);
   if(name==='H5')for(const [key,value] of Object.entries(capture.h5Original))assert.deepEqual(history[key],value);
   if(name==='CSV'){const proof=original.importSource;assert(proof?.receipt?.requestKey);const imported=await get(api+'/imports/receipts/'+proof.receipt.requestKey);assert.deepEqual(imported.receipt,proof.receipt);assert.deepEqual(imported.source,proof.source);assert(imported.rows.some(row=>JSON.stringify(row)===JSON.stringify(proof.row)));}
  }
  assert.equal(a.response.locked,true);assert.equal(a.response.review,'review_approved');
  const v=(await get(api+'/visits/'+original.visit.id)).visit;
  assert.equal(v.actualCompletedAt,original.visit.actualCompletedAt);assert.equal(v.status,'completed');assert.equal(v.completionIntegrity,'current');
  if(name!=='ONSITE')assert.equal(v.version,original.visit.version);
  expectations.push({subjectId:benchmark.cases[name].subject.id,visitId:v.id,enrollmentId:v.enrollmentId,visitVersion:v.version,responseVersion:a.response.version});
  const row=current.manifest.rows.find(x=>x.subjectId===benchmark.cases[name].subject.id);assert(row);
  for(const variable of vars){const cell=row.cells.find(c=>c.key===variable.key);assert(cell);assert.deepEqual(cell.source.ref,a.response.ref);const has=Object.hasOwn(a.response.answers,variable.fieldKey),raw=a.response.answers[variable.fieldKey];assert.deepEqual(cell.value,has?raw:null);assert.equal(cell.missing,!has?'not_recorded':raw===null?'null':null);}
 }
 assertPreviewRows(current.manifest,expectations);
 for(const path of [analysis+'/snapshots/'+baselineBasis.snapshotId,analysis+'/runs/'+originalMethod.runId,analysis+'/reports/'+originalReport.artifactId]){
  const r=await fetch(base+'/api'+path,{headers:{Cookie:cookies.admin},redirect:'error',signal:AbortSignal.timeout(20000)});const value=await r.json();network.push({stage,via:'readonly-fetch',role:'admin',method:'GET',path:'/api'+path,status:r.status,code:value?.code});
  assert.equal(r.status,409);assertSourceError(value,path===analysis+'/snapshots/'+baselineBasis.snapshotId);
 }
}
await assertMainSources();
const {chromium}=createRequire(root+'app/package.json')('./node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let allowed=null;
async function page(role){
 const c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+role+'-video'}});contexts.push(c);
 const cookie=cookies[role],i=cookie.indexOf('=');await c.addCookies([{name:cookie.slice(0,i),value:cookie.slice(i+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'}]);
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{if(d.type()==='beforeunload')await d.accept();else{errors.push('native '+d.type());await d.dismiss();}});
 p.on('response',r=>{if(r.url().includes('/api/'))network.push({stage,via:'browser',role,method:r.request().method(),path:new URL(r.url()).pathname,status:r.status()});});
 await p.route('**/api/**',async route=>{
  const req=route.request();if(!['POST','PUT','PATCH','DELETE'].includes(req.method()))return route.continue();
  const path=new URL(req.url()).pathname;
  if(req.method()==='POST'&&path==='/api/auth/renew')return route.continue();
  const body=req.postDataJSON();
  if(!runtimeCurrent()){errors.push('Runtime changed before write; no POST dispatched');return route.abort();}uiSourceCurrent();
  if(!allowed||allowed.role!==role||path!=='/api'+allowed.path||req.method()!=='POST'||state.pending){errors.push('unexpected write '+path);return route.abort();}
  assert.equal(typeof body.requestKey,'string');
  if(allowed.action==='create')assert.equal(body.snapshotId,basis.snapshotId);
  const me=await get('/auth/me',role);assert.equal(me.tenantId,benchmark.scope.tenantId);if(allowed.action==='review')assert(me.role==='tenant_admin'&&me.isTenantAdmin);await assertMainSources();assert(runtimeCurrent(),'RUNTIME_CHANGED_AT_DISPATCH');uiSourceCurrent();state.pending={action:allowed.action,key:body.requestKey,runId:allowed.runId??null,actor:{accountId:me.accountId,authVersion:me.authVersion}};saveState();uiSourceCurrent();allowed=null;return route.continue();
 });return p;
}
const url=id=>base+'/pages/s06/?'+new URLSearchParams({formalMethods:'1',studyId:basis.studyId,...(id?{runId:id}:{planId:basis.planId,snapshotId:basis.snapshotId})});
function checkNumbers(run){
 assert.deepEqual(run.dataSources.analysisBasis,expectedSourceBasis);assert.equal(run.dataSources.analysisBasis.snapshotId,basis.snapshotId);assert.equal(run.dataSources.analysisBasis.planId,basis.planId);assert.equal(run.environment.llm,false);
 for(const v of vars){const c=run.outputs.columns[v.key],expected=oracle.correction.expected[v.fieldKey];assert(c&&expected);
  if(v.valueType==='number'){
   assert.equal(c.total,expected.totalRows);for(const k of ['observed','missing','min','max','mean','median'])assert(Math.abs(c[k]-expected[k])<1e-12,`${v.fieldKey}.${k}`);
   assert(Math.abs(c.sampleStdDev-expected.sampleStandardDeviation)<1e-12);
  }else{assert.equal(c.trueCount,expected.true);assert.equal(c.falseCount,expected.false);assert.equal(c.missing,expected.missing);}
 }
}
try{
 const researcher=await page('researcher');
 if(!state.runId){
  stage='s05-entry';await researcher.goto(base+'/pages/s05/?'+new URLSearchParams({formalAnalysis:'1',studyId:basis.studyId,planId:basis.planId,snapshotId:basis.snapshotId}));
  await researcher.getByRole('link',{name:'运行描述统计',exact:true}).click();await researcher.getByRole('button',{name:'运行描述统计',exact:true}).waitFor();
  stage='create';await researcher.getByRole('button',{name:'运行描述统计',exact:true}).click();allowed={role:'researcher',action:'create',path:analysis+'/runs'};
  await researcher.getByRole('dialog').getByRole('button',{name:'确认运行',exact:true}).click();
  await researcher.getByRole('table',{name:'数值变量描述统计',exact:true}).waitFor({timeout:60000});await recover();
  assert.equal(new URL(researcher.url()).searchParams.get('runId'),state.runId);assert.notEqual(state.runId,originalMethod.runId);
 }else await researcher.goto(url(state.runId));
 await researcher.getByRole('table',{name:'数值变量描述统计',exact:true}).waitFor({timeout:90000});
 stage='verify-run';const run=await get(analysis+'/runs/'+state.runId,'researcher');checkNumbers(run);
 assert(['needs_review','completed'].includes(run.status));assert.equal(await researcher.getByLabel('分析结果核对意见',{exact:true}).count(),0);
 const trace=readFileSync(root+'.tmp/researchhub-workflow/method-worker-http.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(x=>x.requestId===state.runId);
 assert.equal(trace.filter(x=>x.phase==='dispatch').length,1);assert.equal(trace.filter(x=>x.phase==='response'&&x.httpStatus===200&&x.executorVersion==='descriptive-v1'&&x.workerVersion==='t19-1').length,1);
 await researcher.screenshot({path:out+'researcher-result.png',fullPage:true});checks.push('new_fixed_manifest_aliases_against_independent_correction_python_oracle_and_one_real_worker_dispatch');
 if(!state.reviewed){
  assert.equal(run.status,'needs_review');stage='admin-review';const admin=await page('admin');await admin.goto(url(state.runId));
  await admin.getByLabel('分析结果核对意见',{exact:true}).fill('通用合成软件验收：已核对固定来源与独立统计基准，不构成临床签认。',{timeout:90000});
  await admin.getByRole('button',{name:'保存核对结论',exact:true}).click();allowed={role:'admin',action:'review',runId:state.runId,path:analysis+'/runs/'+state.runId+'/reviews'};
  await admin.getByRole('dialog').getByRole('button',{name:'确认保存核对',exact:true}).click();
  await admin.getByText('审核记录已保存，当前运行已核对。',{exact:true}).waitFor();await recover();
  await admin.screenshot({path:out+'admin-confirmed.png',fullPage:true});
 }
 stage='read-confirmed';await assertMainSources();assert.notEqual(state.runId,originalMethod.runId);assert(state.createRequestKey&&state.reviewRequestKey,'ORIGINAL_KEYS_MISSING');saveState();const final=await get(analysis+'/runs/'+state.runId,'researcher');assert.equal(final.status,'completed');assert.equal(final.reviewStatus,'confirmed');checkNumbers(final);uiSourceCurrent();assert.deepEqual(errors,[]);
 checks.push('current_admin_confirmation_then_researcher_read_completed');
 for(const c of contexts)await c.close();await browser.close();
 writeFileSync(out+'confirmed-journal.json',JSON.stringify(state,null,2)+'\n',{mode:0o600});
 writeFileSync(out+'run.json',JSON.stringify(final,null,2)+'\n',{mode:0o600});
 const result={continuedOriginalCreatedRun:true,originalCreateFailure:"corrected-method-9864ce85/failure.json",uiFreezeProof,passed:true,syntheticOnly:true,actors:state.actors,oldSnapshotId:baselineBasis.snapshotId,oldRunId:originalMethod.runId,correctionFile,correctionSha:hash(correctionBytes),at:new Date().toISOString(),runtimePid:runtime.pid,reusedExistingAtStart,studyId:basis.studyId,planId:basis.planId,snapshotId:basis.snapshotId,runId:state.runId,createRequestKey:state.createRequestKey,reviewRequestKey:state.reviewRequestKey,status:final.status,reviewStatus:final.reviewStatus,confirmedJournal:out+'confirmed-journal.json',runFile:out+'run.json',basisSha:state.basisSha,oracleSha256:oracleSha,checks,network,workerHttp:trace,errors,clinicalAcceptance:false,productionAcceptance:false};
 writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});writeFileSync(pointerPath,JSON.stringify({acceptedFile:out+'result.json'})+'\n',{mode:0o600});
 console.log(JSON.stringify({passed:true,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,error:String(error),pending:state.pending,network,errors},null,2)+'\n',{mode:0o600});for(const c of contexts)await c.close();await browser.close();throw error;}
