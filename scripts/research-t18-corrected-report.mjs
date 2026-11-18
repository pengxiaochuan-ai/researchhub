// PREPARED ONLY. Root must review, close S10 write window and explicitly remove sentinel.
// Corrected-only: node scripts/research-t18-corrected-report.mjs --local-synthetic --execute-corrected-report
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertOriginalCapture,assertPreviewRows,assertSourceError} from './research-t18-correction-guards.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createUiFreezeGuard} from './research-t18-ui-freeze-guard.mjs';
import {validAnalysisSnapshot} from '../src/formal-analysis-session.js';
import {validReportResult,validReportDetail,validReportJob} from '../src/formal-reports-session.js';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--execute-corrected-report']);
const root=workspaceRoot,base='http://127.0.0.1:19501';
const json=p=>JSON.parse(readFileSync(p,'utf8')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const benchmarkFile=json(root+'.tmp/researchhub-workflow/benchmark-current.json').acceptedFile;
const captureFile=json(root+'.tmp/researchhub-workflow/t18-main-capture-current.json').acceptedFile;
const basisFile=json(root+'.tmp/researchhub-workflow/t18-main-basis-current.json').acceptedFile;
const methodFile=json(root+'.tmp/researchhub-workflow/t18-corrected-method-current.json').acceptedFile;
const correctionFile=json(root+'.tmp/researchhub-workflow/t18-main-correction-current.json').acceptedFile, originalMethodFile=json(root+'.tmp/researchhub-workflow/t18-main-method-current.json').acceptedFile,originalReportFile=json(root+'.tmp/researchhub-workflow/t18-main-report-current.json').acceptedFile;
const benchmark=json(benchmarkFile),capture=json(captureFile),originalBasis=json(basisFile),method=json(methodFile),correction=json(correctionFile),originalMethod=json(originalMethodFile),originalReport=json(originalReportFile);
assert(correction.passed&&correction.syntheticOnly&&correction.phase==='correction-and-new-basis-only'&&originalReport.passed&&originalReport.syntheticOnly&&originalReport.status==='released'&&originalReport.runId===originalMethod.runId);
for(const [key,file] of [['capture',captureFile],['basis',basisFile],['method',originalMethodFile],['report',originalReportFile]])assert.equal(correction.inputSha256[key],sha(readFileSync(file)));assert.equal(method.correctionSha,sha(readFileSync(correctionFile)));assert.equal(method.basisSha,sha(readFileSync(basisFile)));
const methodStored=json(method.runFile),basis={...originalBasis,snapshotId:correction.newSnapshotId,snapshot:{basis:methodStored.dataSources.analysisBasis,manifest:correction.preview.manifest}};
assert.equal(correction.studyId,basis.studyId);assert.equal(correction.planId,basis.planId);assert.equal(correction.oldSnapshotId,originalBasis.snapshotId);assert.notEqual(correction.newSnapshotId,originalBasis.snapshotId);assert.notEqual(method.runId,originalMethod.runId);assert.equal(originalReport.snapshotId,originalBasis.snapshotId);assert(originalReport.downloadPath&&originalReport.job?.file?.sha256);assert.equal(sha(readFileSync(originalReport.downloadPath)),originalReport.job.file.sha256);
const oracleBytes=readFileSync(root+'researchhub/docs/testing/fixtures/research-study/generic-v2/oracle.json'),oracle=JSON.parse(oracleBytes),oracleSha=sha(oracleBytes);
assert.equal(oracleSha,'f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b');
assert(oracle.syntheticOnly&&benchmark.syntheticOnly&&benchmark.passed&&benchmark.runId==='rh-workflow-benchmark-747c689d');
assert(capture.passed&&capture.syntheticOnly&&capture.noCorrectionPerformed&&basis.passed&&basis.syntheticOnly&&method.passed&&method.syntheticOnly);
assert.equal(basis.captureFile,captureFile);assert.equal(basis.captureSha256,sha(readFileSync(captureFile)));assert.equal(method.basisSha,sha(readFileSync(basisFile)));assert.equal(method.oracleSha256,oracleSha);
assert.equal(capture.studyId,benchmark.study.id);assert.equal(basis.studyId,benchmark.study.id);assert.equal(method.studyId,basis.studyId);assert.equal(method.planId,basis.planId);assert.equal(method.snapshotId,basis.snapshotId);assert.equal(method.status,'completed');assert.equal(method.reviewStatus,'confirmed');
assert(method.createRequestKey&&method.reviewRequestKey);assert.equal(sha(readFileSync(root+'researchhub/docs/testing/fixtures/research-study/generic-v2/h5-source.json')),oracle.h5EvidenceSha256);
assert.deepEqual(capture.h5Original.ref,capture.final.H5.capture.response.ref);
const vars=basis.snapshot.manifest.variables;assert.deepEqual(vars,basis.definition.variables);assert.deepEqual(vars.map(v=>v.fieldKey).sort(),['completed','optional_value','value'].sort());
for(const n of ['ONSITE','CSV','H5']){const f=capture.final[n];assert.deepEqual(f.subject,benchmark.cases[n].subject);assert(f.subject.subjectId.startsWith('SYNTHETIC-'+n+'-747c689d'));assert.equal(f.capture.response.ref.revisionNo,1);assert(f.capture.response.locked&&f.capture.response.review==='review_approved');assert(f.visit.status==='completed'&&f.visit.completionIntegrity==='current');}
assert.equal((await assertFixtureTarget(fixtureEnvironment())).databaseName,'wp01_test_full_baseline');
const uiFreezeProof=json(root+'.tmp/researchhub-workflow/t18-ui-freeze-proof.json');assert(uiFreezeProof.approved&&uiFreezeProof.syntheticOnly,'REVIEWED_UI_PROOF_REQUIRED');const uiSourceCurrent=createUiFreezeGuard({workspaceRoot:root,manifestFile:uiFreezeProof.manifestFile,manifestSha256:uiFreezeProof.manifestSha256});uiSourceCurrent();
const runtimePath=root+'.tmp/researchhub-knowledge-local/runtime.json',runtime=json(runtimePath);assert(runtime.ready===true&&Number.isSafeInteger(runtime.pid));assert.equal(runtime.ids.tenant,benchmark.scope.tenantId);
const runtimeCurrent=()=>{const now=json(runtimePath);return now.ready===true&&now.pid===runtime.pid&&JSON.stringify(now.ids)===JSON.stringify(runtime.ids);};
const statePath=root+'.tmp/researchhub-workflow/t18-corrected-report-state.json',pointerPath=root+'.tmp/researchhub-workflow/t18-corrected-report-current.json';
const state=existsSync(statePath)?json(statePath):{studyId:basis.studyId,runId:method.runId,snapshotId:basis.snapshotId,methodSha:sha(readFileSync(methodFile)),pending:null,history:[],artifactId:null,jobId:null};
assert.deepEqual([state.studyId,state.runId,state.snapshotId,state.methodSha],[basis.studyId,method.runId,basis.snapshotId,sha(readFileSync(methodFile))]);assert(Array.isArray(state.history));
const saveState=()=>writeFileSync(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const runName='corrected-report-'+randomUUID().slice(0,8),out=root+'researchhub/docs/testing/evidence/research-t18-2026-11-12/'+runName+'/';mkdirSync(out,{recursive:true});
const cookies=json(root+'.tmp/researchhub-19501-integration/preflight-cookie.json'),researcher=json(root+'.tmp/researchhub-workflow/t16-method-session.json').cookie;
const cookie=cookies.admin,api='/research-studies/'+basis.studyId,A=api+'/analysis',network=[],errors=[],checks=[];let stage='preflight',actor,armed=null,browser,context,page;
const save=(name,v)=>writeFileSync(out+name,JSON.stringify(v,null,2)+'\n',{mode:0o600});
async function get(path,{role='admin',allow404=false}={}){
 const r=await fetch(base+'/api'+path,{headers:{Cookie:role==='researcher'?researcher:cookie},redirect:'error',signal:AbortSignal.timeout(20000)}),v=await r.json();network.push({at:new Date().toISOString(),stage,method:'GET',role,path:'/api'+path,status:r.status,code:v?.code??null});
 if(allow404&&r.status===404)return null;assert.equal(r.status,200,JSON.stringify({path,status:r.status,code:v?.code}));return v;
}
function receiptPath(p){return A+'/report-receipts/'+p.key+'?'+new URLSearchParams({action:'analysis.report.'+p.action,targetId:p.targetId});}
async function receipt(p){const v=await get(receiptPath(p),{allow404:true});if(!v)return null;assert(validReportResult(v,{studyId:basis.studyId,action:p.action,targetId:p.targetId,requestKey:p.key}));return v;}
async function facts(){
 const snapshot=await get(A+'/snapshots/'+basis.snapshotId);assert.deepEqual(snapshot.basis,basis.snapshot.basis);assert.deepEqual(snapshot.manifest,correction.preview.manifest);
 const expectations=[];
 for(const n of ['ONSITE','CSV','H5']){
  const old=capture.final[n],assignment=await get(api+'/assignments/'+old.capture.assignment.id),visit=(await get(api+'/visits/'+old.visit.id)).visit;
  for(const k of ['id','subjectId','subjectVisitId'])assert.deepEqual(assignment.assignment[k],old.capture.assignment[k]);
  if(n==='ONSITE'){assert.equal(assignment.response.id,old.capture.response.id);assert.equal(assignment.response.status,old.capture.response.status);assert.deepEqual(assignment.response.ref,correction.newRef);assert.equal(assignment.response.ref.revisionNo,2);assert.deepEqual(assignment.response.answers,{...old.capture.response.answers,value:oracle.correction.newValue});assert(assignment.response.locked&&assignment.response.review==='review_approved');}
  else assertOriginalCapture(assignment,old.capture);
  for(const k of ['id','actualCompletedAt','enrollmentId'])assert.deepEqual(visit[k],old.visit[k]);assert.equal(visit.status,'completed');assert.equal(visit.completionIntegrity,'current');if(n!=='ONSITE')assert.equal(visit.version,old.visit.version);
  const ref=old.capture.response.ref,h=(await get(api+'/assignments/'+ref.assignmentId+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}))).revision;
  for(const k of ['ref','answers','source','actorKind','actorId','sourceSubmittedAt','createdAt'])assert.deepEqual(h[k],old.revision[k]);
  if(n==='H5')for(const [k,v] of Object.entries(capture.h5Original))assert.deepEqual(h[k],v);
  if(n==='CSV'){const proof=old.importSource,imported=await get(api+'/imports/receipts/'+proof.receipt.requestKey);assert.deepEqual(imported.receipt,proof.receipt);assert.deepEqual(imported.source,proof.source);assert(imported.rows.some(r=>JSON.stringify(r)===JSON.stringify(proof.row)));}
  const row=snapshot.manifest.rows.find(x=>x.subjectId===old.subject.id);assert(row);const expectedRef=n==='ONSITE'?correction.newRef:old.capture.response.ref;
  for(const variable of vars){const cell=row.cells.find(x=>x.key===variable.key),answers=assignment.response.answers,has=Object.prototype.hasOwnProperty.call(answers,variable.fieldKey),raw=answers[variable.fieldKey];assert(cell);assert.deepEqual(cell.source.ref,expectedRef);assert.deepEqual(cell.value,has?raw:null);assert.equal(cell.missing,!has?'not_recorded':raw===null?'null':null);}
  expectations.push({subjectId:old.subject.id,visitId:visit.id,enrollmentId:visit.enrollmentId,visitVersion:visit.version,responseVersion:assignment.response.version});
 }
 assertPreviewRows(snapshot.manifest,expectations);
}
async function oldBoundary(){
 for(const path of [A+'/snapshots/'+originalBasis.snapshotId,A+'/runs/'+originalMethod.runId,A+'/reports/'+originalReport.artifactId,A+'/report-exports/'+originalReport.job.jobId,A+'/report-exports/'+originalReport.job.jobId+'/file']){
  const response=await fetch(base+'/api'+path,{headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(20000)}),value=await response.json();network.push({at:new Date().toISOString(),stage,method:'GET',path:'/api'+path,status:response.status,code:value?.code??null});assert.equal(response.status,409);assertSourceError(value,path===A+'/snapshots/'+originalBasis.snapshotId);
 }
}
function verifyRun(run){
 assert.equal(run.id,method.runId);assert.equal(run.status,'completed');assert.equal(run.reviewStatus,'confirmed');assert.deepEqual(run.dataSources.analysisBasis,basis.snapshot.basis);assert.equal(run.environment.llm,false);
 for(const v of vars){const c=run.outputs.columns[v.key],e=oracle.correction.expected[v.fieldKey];assert(c&&e);if(v.valueType==='boolean'){assert.equal(c.trueCount,e.true);assert.equal(c.falseCount,e.false);assert.equal(c.missing,e.missing);}else{assert.equal(c.total,e.totalRows);for(const k of ['observed','missing','min','max','mean','median'])assert(Math.abs(c[k]-e[k])<1e-12);assert(Math.abs(c.sampleStdDev-e.sampleStandardDeviation)<1e-12);}}
}
const actionTarget=action=>action==='create'?method.runId:state.artifactId;
const commandPath=action=>A+'/reports'+(action==='create'?'':'/'+state.artifactId+{review:'/reviews',release:'/releases',export:'/exports'}[action]);
async function begin(){
 browser=await createRequire(root+'app/package.json')('./node_modules/.pnpm/playwright@1.63.0/node_modules/playwright').chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,recordVideo:{dir:out+'video'}});
 const i=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,i),value:cookie.slice(i+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'}]);
 await context.route('**/api/**',async route=>{const req=route.request(),u=new URL(req.url());try{
  assert.equal(u.origin,base);if(req.method()==='GET'||req.method()==='POST'&&u.pathname==='/api/auth/renew')return await route.continue();
  assert(armed&&!armed.used&&req.method()==='POST'&&u.pathname==='/api'+armed.path&&!state.pending,'UNARMED_BUSINESS_WRITE');assert(runtimeCurrent(),'RUNTIME_CHANGED_BEFORE_WRITE');uiSourceCurrent();
  const body=req.postDataJSON();assert(typeof body.requestKey==='string');armed.validate(body);armed.used=true;
  state.pending={action:armed.action,targetId:armed.targetId,key:body.requestKey,body,actor,at:new Date().toISOString()};saveState();assert(runtimeCurrent(),'RUNTIME_CHANGED_AT_DISPATCH');uiSourceCurrent();await route.continue();
 }catch(e){errors.push({stage,message:e.message});await route.abort('blockedbyclient');}});
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push({stage,message:e.message}));page.on('dialog',async d=>{errors.push({stage,message:'native '+d.type()});await d.dismiss();});
 page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({at:new Date().toISOString(),stage,method:r.request().method(),path:u.pathname+u.search,status:r.status()});});
}
async function phase(action,openButton,confirmButton,validate){
 await facts();assert(!state.pending);assert(runtimeCurrent());uiSourceCurrent();const currentMe=await get('/auth/me');assert.equal(currentMe.accountId,actor.accountId);assert.equal(currentMe.authVersion,actor.authVersion);assert.equal(currentMe.tenantId,benchmark.scope.tenantId);assert(currentMe.role==='tenant_admin'&&currentMe.isTenantAdmin);await page.waitForLoadState('networkidle');
 const targetId=actionTarget(action),path=commandPath(action);armed={action,targetId,path,validate,used:false};
 await page.getByRole('button',{name:openButton,exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api'+path);response.catch(()=>{});
 try{await dialog.getByRole('button',{name:confirmButton,exact:true}).click();const r=await response,v=await r.json();assert.equal(r.status(),200);assert(armed.used&&state.pending);const p=state.pending;
  assert(validReportResult(v,{studyId:basis.studyId,action,targetId,requestKey:p.key}));const saved=await receipt(p);assert(saved,'ORIGINAL_RECEIPT_UNKNOWN');assert.deepEqual(saved,v);
  state.history.push({...p,confirmedAt:new Date().toISOString(),receipt:saved});if(action==='create')state.artifactId=saved.artifactId;if(action==='export')state.jobId=saved.jobId;state.pending=null;saveState();await facts();return saved;
 }finally{armed=null;}
}
const metricNames={total:'总数',observed:'有记录数',missing:'缺失数',min:'最小值',max:'最大值',mean:'均值',median:'中位数',sampleStdDev:'样本标准差',trueCount:'是',falseCount:'否'};
function expectedWord(run){
 const schema=capture.final.ONSITE.capture.assignment.formVersion.schema;
 assert.equal(run.dataSources.analysisBasis.studyId,basis.studyId);assert.equal(run.dataSources.analysisBasis.snapshotId,basis.snapshotId);assert.equal(run.outputs.rowCount,basis.snapshot.manifest.rowCount);
 return {studyId:basis.studyId,runId:run.id,executorVersion:run.executorVersion,snapshotId:basis.snapshotId,manifestHash:run.dataSources.analysisBasis.manifestHash,rowCount:String(run.outputs.rowCount),columns:vars.map(v=>{
  const field=schema.fields.find(x=>x.key===v.fieldKey);assert(field&&field.type===v.valueType);const c=run.outputs.columns[v.key],cells=basis.snapshot.manifest.rows.map(row=>row.cells.find(x=>x.key===v.key));assert(cells.length&&cells.every(x=>x&&x.source.formVersionId===v.formVersionId&&x.source.fieldKey===v.fieldKey&&/^[a-f0-9]{64}$/.test(x.source.formDefinitionHash)&&x.source.formDefinitionHash===cells[0].source.formDefinitionHash));
  const stats=c.type==='number'?['min','max','mean','median','sampleStdDev']:['trueCount','falseCount'];return {key:v.key,label:field.label,unit:v.unit,fieldKey:v.fieldKey,valueType:v.valueType,formVersionId:v.formVersionId,formDefinitionHash:cells[0].source.formDefinitionHash,rows:['total','observed','missing',...stats].map(k=>({label:metricNames[k],value:c[k]===null?'不可估计':String(c[k]),path:'columns.'+v.key+'.'+k}))};
 })};
}
function checkTrace(){const trace=method.workerHttp;assert(Array.isArray(trace));assert.equal(trace.filter(x=>x.requestId===method.runId&&x.phase==='dispatch').length,1);assert.equal(trace.filter(x=>x.requestId===method.runId&&x.phase==='response'&&x.httpStatus===200&&x.executorVersion==='descriptive-v1'&&x.workerVersion==='t19-1').length,1);return trace;}
try{
 const me=await get('/auth/me');assert.equal(me.tenantId,benchmark.scope.tenantId);assert(me.role==='tenant_admin'&&me.isTenantAdmin&&Number.isSafeInteger(me.authVersion));actor={sessionRole:'admin',accountId:me.accountId,authVersion:me.authVersion};
 if(state.pending){stage='unknown-original-receipt-read-only';assert.deepEqual(state.pending.actor,actor);const original=await receipt(state.pending);save('unknown-original-receipt.json',{pending:state.pending,receipt:original,newBusinessWrites:0});throw Error('ORIGINAL_RESULT_CHECKED_STOP_FOR_ROOT_REVIEW');}
 if(existsSync(pointerPath)){
  const prior=json(json(pointerPath).acceptedFile);assert(prior.passed&&prior.syntheticOnly&&prior.studyId===basis.studyId&&prior.runId===method.runId&&prior.snapshotId===basis.snapshotId);
  assert(state.artifactId===prior.artifactId&&state.jobId===prior.job.jobId,'POINTER_JOURNAL_MISMATCH_STOP');
  throw Error('CORRECTED_REPORT_ALREADY_DELIVERED_READ_ONLY_STOP');
 }
 assert.equal(state.history.length,0,'PRIOR_PARTIAL_JOURNAL_STOP_FOR_ROOT_REVIEW');
 stage='fixed-source-preflight';await facts();await oldBoundary();const plan=await get(A+'/plans/'+basis.planId+'?limit=20');assert.deepEqual(plan.definition,basis.definition);assert.equal(plan.contentHash,basis.plan.contentHash);assert.equal(plan.review.reviewId,basis.plan.review.reviewId);assert.equal(plan.review.sequence,basis.plan.review.sequence);assert.equal(plan.review.decision,'approved');
 const snapshot=await get(A+'/snapshots/'+basis.snapshotId);assert(validAnalysisSnapshot(snapshot,plan,basis.snapshotId));assert.deepEqual(snapshot.manifest,correction.preview.manifest);assert.deepEqual(snapshot.basis,basis.snapshot.basis);assert.equal(snapshot.basis.planReviewId,originalBasis.snapshot.basis.planReviewId);assert.notEqual(snapshot.basis.qualityGateId,originalBasis.snapshot.basis.qualityGateId);
 const run=await get(A+'/runs/'+method.runId);verifyRun(run);const originalRun=json(method.runFile);for(const key of ['id','status','reviewStatus','inputHash','skillVersion','executorVersion','dataSources','outputs','numericEvidence'])assert.deepEqual(run[key],originalRun[key]);save('fixed-run.json',run);
 const researcherMe=await get('/auth/me',{role:'researcher'});assert.equal(method.actors.create.accountId,researcherMe.accountId);assert.equal(method.actors.create.authVersion,researcherMe.authVersion);assert.equal(method.actors.review.accountId,me.accountId);assert.equal(method.actors.review.authVersion,me.authVersion);const methodCreate=await get(A+'/run-receipts/'+method.createRequestKey,{role:'researcher'});assert.equal(methodCreate.id,method.runId);assert.equal(methodCreate.receipt.requestKey,method.createRequestKey);
 const methodReview=await get(A+'/runs/'+method.runId+'/review-receipts/'+method.reviewRequestKey);assert.equal(methodReview.runId,method.runId);assert.equal(methodReview.receipt.requestKey,method.reviewRequestKey);assert.equal(methodReview.conclusion,'confirmed');
 const workerTrace=checkTrace();save('original-worker-trace.json',workerTrace);
 const list=await get(A+'/reports');assert.equal(list.studyId,basis.studyId);assert(Array.isArray(list.items)&&list.items.length<50,'REPORT_DIRECTORY_AT_BOUND_STOP');
 const blocked=[];for(const item of list.items){if(item.analysisState==='current'){const existing=await get(A+'/reports/'+item.artifactId);assert.notEqual(existing.runId,method.runId,'EXISTING_UNJOURNALED_MAIN_REPORT_STOP');}else{assert.equal(item.analysisState,'blocked');blocked.push(item.artifactId);}}
 if(blocked.length){const matches=await withFixtureTransaction(fixtureEnvironment(),'direct',tx=>tx.researchArtifactVersion.findMany({where:{tenantId:benchmark.scope.tenantId,studyGroupId:benchmark.scope.studyGroupId,researchProjectId:benchmark.scope.researchProjectId,artifactId:{in:blocked},versionNo:1},select:{artifactId:true,contentBlocks:true}}),{readOnly:true});assert.equal(matches.length,blocked.length,'BLOCKED_REPORT_SOURCE_UNRESOLVED');for(const row of matches){const block=row.contentBlocks?.[0];assert(block?.type==='formal_analysis'&&block.schemaVersion==='formal-analysis-report-v1'&&typeof block.runId==='string'&&typeof block.analysisBasis?.studyId==='string','BLOCKED_REPORT_SOURCE_UNRESOLVED');assert(!(block.analysisBasis.studyId===basis.studyId&&block.runId===method.runId),'EXISTING_UNJOURNALED_MAIN_REPORT_STOP');}save('blocked-report-run-bindings.json',matches.map(row=>({artifactId:row.artifactId,studyId:row.contentBlocks[0].analysisBasis.studyId,runId:row.contentBlocks[0].runId})));}
 checks.push('corrected_ref2_and_two_original_refs_current_approved_basis_confirmed_worker_run_match_generic_v2_correction');
 stage='s06-to-s10';await begin();await page.goto(base+'/pages/s06/?'+new URLSearchParams({formalMethods:'1',studyId:basis.studyId,runId:method.runId}));await page.getByRole('link',{name:'生成固定报告',exact:true}).waitFor({timeout:90000});await page.getByRole('link',{name:'生成固定报告',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('formalReports'),'1');
 const title='通用合成研究更正后描述统计报告';await page.getByLabel('报告标题（可选）',{exact:true}).fill(title);
 stage='create';const created=await phase('create','生成固定报告','确认生成报告',body=>{assert.equal(body.runId,method.runId);assert.equal(body.title,title);});assert.equal(created.snapshotId,basis.snapshotId);assert.notEqual(created.artifactId,originalReport.artifactId);
 await page.getByText('固定报告已生成并进入待审核，请核对正文与来源。',{exact:true}).waitFor();let report=await get(A+'/reports/'+state.artifactId);assert(validReportDetail(report,{studyId:basis.studyId,artifactId:state.artifactId,runId:method.runId}));assert.equal(sha(Buffer.from(report.contentMd)),report.contentHash);assert.equal(report.status,'in_review');assert.equal(report.snapshotId,basis.snapshotId);
 stage='review';await page.getByLabel('报告审核结论',{exact:true}).selectOption('approved');await page.getByLabel('报告审核理由',{exact:true}).fill('逐项核对通用合成来源、人工确认方法及独立统计基准。');
 const reviewed=await phase('review','保存审核结论','确认保存审核',body=>{assert.equal(body.versionNo,1);assert.equal(body.decision,'approved');assert(body.reason?.trim());});assert.equal(reviewed.status,'approved');await page.getByText('审核记录已保存，当前报告已核对。',{exact:true}).waitFor();report=await get(A+'/reports/'+state.artifactId);assert.equal(report.status,'approved');assert.equal(sha(Buffer.from(report.contentMd)),report.contentHash);
 stage='release';await page.getByLabel('报告发布理由',{exact:true}).fill('已核对固定合成报告及审核结果，仅供软件流程验收。');await phase('release','发布固定报告','确认发布报告',body=>{assert.equal(body.versionNo,1);assert(body.reason?.trim());});
 await page.getByText('本研究固定报告已发布，尚未公开共享或沉淀为资产。',{exact:true}).waitFor();report=await get(A+'/reports/'+state.artifactId);assert.equal(report.status,'released');assert.equal(sha(Buffer.from(report.contentMd)),report.contentHash);
 stage='export';const exported=await phase('export','生成Word文件','确认生成Word',body=>{assert.equal(body.versionNo,1);assert.equal(body.format,'docx');});assert.equal(exported.status,'queued');
 await page.getByText('DOCX文件已就绪，下载前仍将核对当前权限与来源。',{exact:true}).waitFor({timeout:90000});const job=await get(A+'/report-exports/'+state.jobId);assert(validReportJob(job,{studyId:basis.studyId,artifactId:state.artifactId,jobId:state.jobId}));assert.equal(job.status,'ready');
 stage='download';await facts();const downloadPromise=page.waitForEvent('download',{timeout:90000}),fileResponse=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api'+A+'/report-exports/'+state.jobId+'/file',{timeout:30000});await page.getByRole('button',{name:'下载Word文件',exact:true}).click();const download=await downloadPromise,fileHttp=await fileResponse;assert.equal(fileHttp.status(),200);const headers=await fileHttp.allHeaders();assert.equal(headers['x-file-sha256'],job.file.sha256);assert.equal(headers['content-type'].split(';')[0].trim(),job.file.mimeType);if(headers['content-length'])assert.equal(Number(headers['content-length']),job.file.sizeBytes);assert.equal(download.suggestedFilename(),job.file.filename);const downloadPath=out+'corrected-report.docx';await download.saveAs(downloadPath);const bytes=readFileSync(downloadPath);assert.equal(bytes.length,job.file.sizeBytes);assert.equal(sha(bytes),job.file.sha256);
 const freshReport=await get(A+'/reports/'+state.artifactId),freshJob=await get(A+'/report-exports/'+state.jobId),freshMe=await get('/auth/me');assert.equal(freshMe.accountId,actor.accountId);assert.equal(freshMe.authVersion,actor.authVersion);assert.equal(freshReport.contentHash,report.contentHash);assert.equal(freshReport.status,'released');assert.deepEqual(freshJob.file,job.file);await facts();await oldBoundary();
 const wordExpected=expectedWord(run);save('word-expected.json',wordExpected);const verifier=spawnSync('python3',[root+'researchhub/scripts/research-t18-report-docx-verify.py',downloadPath,out+'word-expected.json',out+'word-verified.json'],{encoding:'utf8',timeout:20000});assert.equal(verifier.status,0,verifier.stderr);assert(json(out+'word-verified.json').passed);await page.screenshot({path:out+'released-report.png',fullPage:true});uiSourceCurrent();assert.deepEqual(errors,[]);
 checks.push('real_admin_create_review_release_docx_ready_fresh_download_and_word_table_exact_fixed_run_values');
 await context.close();await browser.close();save('confirmed-journal.json',state);
 const keys=Object.fromEntries(state.history.map(x=>[x.action,x.key])),actors=Object.fromEntries(state.history.map(x=>[x.action,x.actor]));
 const technical={uiFreezeProof,passed:false,technicalPassed:true,rootDocxReviewPending:true,syntheticOnly:true,clinicalAcceptance:false,productionAcceptance:false,studyId:basis.studyId,artifactId:state.artifactId,runId:method.runId,snapshotId:basis.snapshotId,versionNo:1,status:'released',contentHash:report.contentHash,createRequestKey:keys.create,reviewRequestKey:keys.review,releaseRequestKey:keys.release,exportRequestKey:keys.export,actors,job,downloadPath,runFile:out+'fixed-run.json',confirmedJournal:out+'confirmed-journal.json',inputSha256:{benchmark:sha(readFileSync(benchmarkFile)),capture:sha(readFileSync(captureFile)),basis:sha(readFileSync(basisFile)),originalMethod:sha(readFileSync(originalMethodFile)),originalReport:sha(readFileSync(originalReportFile)),correction:sha(readFileSync(correctionFile)),method:sha(readFileSync(methodFile)),oracle:oracleSha},checks,network,workerHttp:workerTrace,runtimePid:runtime.pid};
 save('technical-result.json',technical);console.log(JSON.stringify({technicalPassed:true,rootDocxReviewPending:true,evidence:out+'technical-result.json',pointerWritten:false}));
}catch(e){save('failure.json',{passed:false,stage,message:e.message,pending:state.pending,history:state.history,network,errors,automaticReplay:false});if(page)await page.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});if(context)await context.close();if(browser)await browser.close();throw e;}
