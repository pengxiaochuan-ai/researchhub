// Prepared for root review only. No request is made until explicitly executed.
// node scripts/research-t18-main-method.mjs --local-synthetic --execute-main-method
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';

assert.deepEqual(process.argv.slice(2),['--local-synthetic','--execute-main-method']);
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=workspaceRoot, base='http://127.0.0.1:19501';
const benchmark=json(json(root+'.tmp/researchhub-workflow/benchmark-current.json').acceptedFile);
const basisFile=json(root+'.tmp/researchhub-workflow/t18-main-basis-current.json').acceptedFile;
const basisBytes=readFileSync(basisFile), basis=JSON.parse(basisBytes);
const oracleBytes=readFileSync(root+'researchhub/docs/testing/fixtures/research-study/generic-v2/oracle.json');
const oracleSha=hash(oracleBytes), oracle=JSON.parse(oracleBytes);
assert.equal(oracleSha,'f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b');
assert(benchmark.passed&&benchmark.syntheticOnly&&benchmark.runId==='rh-workflow-benchmark-747c689d');
assert(basis.passed&&basis.syntheticOnly&&basis.originalMainSourcesUnchanged&&!basis.analysisExecuted&&!basis.reportExecuted);
assert.equal(basis.studyId,benchmark.study.id);assert.equal(basis.oracleSha256,oracleSha);
assert.equal((await assertFixtureTarget(fixtureEnvironment())).databaseName,'wp01_test_full_baseline');
const vars=basis.snapshot.manifest.variables;
assert.deepEqual(vars.map(v=>v.fieldKey).sort(),['completed','optional_value','value'].sort());
assert.deepEqual(vars,basis.definition.variables);
const runtime=json(root+'.tmp/researchhub-knowledge-local/runtime.json');
assert(runtime.ready===true&&Number.isSafeInteger(runtime.pid));
assert.equal(runtime.ids.tenant,benchmark.scope.tenantId);
const runtimeCurrent=()=>{const next=json(root+'.tmp/researchhub-knowledge-local/runtime.json');return next.ready===true&&next.pid===runtime.pid&&JSON.stringify(next.ids)===JSON.stringify(runtime.ids);};
const statePath=root+'.tmp/researchhub-workflow/t18-main-method-state.json';
const pointerPath=root+'.tmp/researchhub-workflow/t18-main-method-current.json';
const state=existsSync(statePath)?json(statePath):{studyId:basis.studyId,planId:basis.planId,snapshotId:basis.snapshotId,basisSha:hash(basisBytes),pending:null,runId:null,reviewed:false};
const reusedExistingAtStart=!!state.runId;
assert.deepEqual([state.studyId,state.planId,state.snapshotId,state.basisSha],[basis.studyId,basis.planId,basis.snapshotId,hash(basisBytes)]);
if(existsSync(pointerPath)){const prior=json(json(pointerPath).acceptedFile);assert(prior.passed&&prior.syntheticOnly&&prior.studyId===basis.studyId&&prior.snapshotId===basis.snapshotId&&prior.basisSha===state.basisSha);if(state.runId)assert.equal(state.runId,prior.runId);else{assert(!state.pending,'PENDING_OPERATION_MUST_BE_RESOLVED_FIRST');assert(prior.createRequestKey&&prior.reviewRequestKey,'ORIGINAL_KEYS_MISSING');state.runId=prior.runId;state.reviewed=true;state.createRequestKey=prior.createRequestKey;state.reviewRequestKey=prior.reviewRequestKey;}}
const saveState=()=>writeFileSync(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});
const runName='main-method-'+randomUUID().slice(0,8), out=root+'researchhub/docs/testing/evidence/research-t18-2026-11-12/'+runName+'/';
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
 const p=state.pending,r=await get(receiptPath(p),p.action==='create'?'researcher':'admin',true);
 assert(r,'ORIGINAL_RECEIPT_UNKNOWN: stop; do not repeat any POST');
 assert.equal(r.studyId,basis.studyId);assert.equal(r.receipt.requestKey,p.key);
 assert.equal(r.receipt.action,p.action==='create'?'analysis.run.create':'analysis.run.review');
 if(p.action==='create'){assert.equal(r.dataSources.analysisBasis.snapshotId,basis.snapshotId);assert.equal(r.dataSources.analysisBasis.planId,basis.planId);state.runId=r.id;state.createRequestKey=p.key;}
 else {assert.equal(r.runId,p.runId);state.reviewed=true;state.reviewRequestKey=p.key;}
 state.pending=null;saveState();
}
// Never make another write until any earlier result has been resolved by GET only.
await recover();
const current=await get(analysis+'/snapshots/'+basis.snapshotId);
assert.deepEqual(current.manifest,basis.snapshot.manifest);
const capture=json(basis.captureFile);assert.equal(hash(readFileSync(basis.captureFile)),basis.captureSha256);
for(const name of ['ONSITE','CSV','H5']){
 const original=capture.final[name], a=await get(api+'/assignments/'+original.capture.assignment.id);
 assert.deepEqual(a.response.ref,original.capture.response.ref);assert.deepEqual(a.response.answers,original.capture.response.answers);
 assert.equal(a.response.locked,true);assert.equal(a.response.review,'review_approved');
}
assert.deepEqual(capture.h5Original.ref,capture.final.H5.capture.response.ref);
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
  if(!runtimeCurrent()){errors.push('Runtime changed before write; no POST dispatched');return route.abort();}
  if(!allowed||allowed.role!==role||path!=='/api'+allowed.path||req.method()!=='POST'||state.pending){errors.push('unexpected write '+path);return route.abort();}
  assert.equal(typeof body.requestKey,'string');
  if(allowed.action==='create')assert.equal(body.snapshotId,basis.snapshotId);
  state.pending={action:allowed.action,key:body.requestKey,runId:allowed.runId??null};saveState();allowed=null;return route.continue();
 });return p;
}
const url=id=>base+'/pages/s06/?'+new URLSearchParams({formalMethods:'1',studyId:basis.studyId,...(id?{runId:id}:{planId:basis.planId,snapshotId:basis.snapshotId})});
function checkNumbers(run){
 assert.equal(run.dataSources.analysisBasis.snapshotId,basis.snapshotId);assert.equal(run.dataSources.analysisBasis.planId,basis.planId);assert.equal(run.environment.llm,false);
 for(const v of vars){const c=run.outputs.columns[v.key],expected=oracle.expected[v.fieldKey];assert(c&&expected);
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
  assert.equal(new URL(researcher.url()).searchParams.get('runId'),state.runId);
 }else await researcher.goto(url(state.runId));
 stage='verify-run';const run=await get(analysis+'/runs/'+state.runId,'researcher');checkNumbers(run);
 assert(['needs_review','completed'].includes(run.status));assert.equal(await researcher.getByLabel('分析结果核对意见',{exact:true}).count(),0);
 const trace=readFileSync(root+'.tmp/researchhub-workflow/method-worker-http.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(x=>x.requestId===state.runId);
 assert.equal(trace.filter(x=>x.phase==='dispatch').length,1);assert.equal(trace.filter(x=>x.phase==='response'&&x.httpStatus===200&&x.executorVersion==='descriptive-v1'&&x.workerVersion==='t19-1').length,1);
 await researcher.screenshot({path:out+'researcher-result.png',fullPage:true});checks.push('fixed_manifest_aliases_against_independent_python_oracle_and_one_real_worker_dispatch');
 if(!state.reviewed){
  assert.equal(run.status,'needs_review');stage='admin-review';const admin=await page('admin');await admin.goto(url(state.runId));
  await admin.getByLabel('分析结果核对意见',{exact:true}).fill('通用合成软件验收：已核对固定来源与独立统计基准，不构成临床签认。');
  await admin.getByRole('button',{name:'保存核对结论',exact:true}).click();allowed={role:'admin',action:'review',runId:state.runId,path:analysis+'/runs/'+state.runId+'/reviews'};
  await admin.getByRole('dialog').getByRole('button',{name:'确认保存核对',exact:true}).click();
  await admin.getByText('审核记录已保存，当前运行已核对。',{exact:true}).waitFor();await recover();
  await admin.screenshot({path:out+'admin-confirmed.png',fullPage:true});
 }
 stage='read-confirmed';assert(state.createRequestKey&&state.reviewRequestKey,'ORIGINAL_KEYS_MISSING');saveState();const final=await get(analysis+'/runs/'+state.runId,'researcher');assert.equal(final.status,'completed');checkNumbers(final);assert.deepEqual(errors,[]);
 checks.push('current_admin_confirmation_then_researcher_read_completed');
 for(const c of contexts)await c.close();await browser.close();
 writeFileSync(out+'confirmed-journal.json',JSON.stringify(state,null,2)+'\n',{mode:0o600});
 writeFileSync(out+'run.json',JSON.stringify(final,null,2)+'\n',{mode:0o600});
 const result={passed:true,syntheticOnly:true,at:new Date().toISOString(),runtimePid:runtime.pid,reusedExistingAtStart,studyId:basis.studyId,planId:basis.planId,snapshotId:basis.snapshotId,runId:state.runId,createRequestKey:state.createRequestKey,reviewRequestKey:state.reviewRequestKey,status:final.status,reviewStatus:final.reviewStatus,confirmedJournal:out+'confirmed-journal.json',runFile:out+'run.json',basisSha:state.basisSha,oracleSha256:oracleSha,checks,network,workerHttp:trace,errors,clinicalAcceptance:false,productionAcceptance:false};
 writeFileSync(out+'result.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});writeFileSync(pointerPath,JSON.stringify({acceptedFile:out+'result.json'})+'\n',{mode:0o600});
 console.log(JSON.stringify({passed:true,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,error:String(error),pending:state.pending,network,errors},null,2)+'\n',{mode:0o600});for(const c of contexts)await c.close();await browser.close();throw error;}
