// Offline only: synthetic values and temporary JSON; no fixture, PG, HTTP or browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {purpose,action,expectedNativeStatus,bodyHash,parseArgs,validateManifest,manifestFromResources,mutationAction,knownRejected,receiptCandidate,requestMetadata,receiptPath,verifyReceipt,mayExecuteStep,createJournal} from './study-workflow-wf02-qa.mjs';
import {installNativeImportGate,validatePendingPopupLink,assertPendingMarkerPreserved,verifyPendingPopup} from './study-workflow-wf02-browser.mjs';
import {checkpointPrerequisite,runWF02Checkpoint} from './study-workflow-wf02-run.mjs';
const window={STUDY_WORKFLOW_WF02_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'};
const hash='a'.repeat(64),targetHash='b'.repeat(64);
function manifest(){return{schema:1,purpose,syntheticOnly:true,phase:'primary',state:'frozen',approvedAt:'2026-11-17T00:00:00Z',tenantId:'synthetic-tenant',
 sources:{S1:{studyId:'source',protocolId:'source-protocol',versionNumber:1,revision:hash,fingerprint:hash,status:'approved',formVersionIds:['form1','form2'],outcomeDefinitionIds:['outcome1']}},
 cases:Object.fromEntries(['A','B','D'].map(code=>[code,{role:code==='B'?'reviewer':'admin',actorId:code==='B'?'researcher':'admin',authVersion:0,studyId:'target-'+code,executionProjectId:'project-'+code,sourceId:'S1',targetFingerprint:targetHash}])),
 limits:{importSuccesses:3,newStudies:0,newSubjects:0,newAnswers:0,newAccounts:0,newRoles:0,newPolicies:0,newLicenses:0,newApplicability:0},
 protection:{baselinePath:'/private/synthetic-protection.json',wf01BaselinePath:'/private/synthetic-wf01.json'}};}
function input(key='original'){return{method:'POST',path:'/api/research-studies/target-A/protocol-template-imports',actorId:'admin',authVersion:0,
 body:{requestKey:key,sourceStudyId:'source',sourceProtocolId:'source-protocol',sourceFingerprint:hash,targetFingerprint:targetHash}};}
function result(request){return{found:true,protocol:{id:'new-draft',status:'draft'},origin:{sourceStudyId:'source',sourceProtocolId:'source-protocol',sourceFingerprint:hash,targetFingerprint:targetHash,sourceRevision:hash,sourceVersionNumber:1,
 forms:[{sourceVersionId:'form1',targetVersionId:'copy1',reused:false},{sourceVersionId:'form2',targetVersionId:'copy2',reused:true}],outcomes:[{sourceOutcomeId:'outcome1',targetOutcomeId:'copy-outcome1',reused:false}]},
 receipt:{id:'op1',requestKey:request.requestKey,requestHash:request.requestHash,action,authVersion:0,targetId:'new-draft',studyId:'target-A',sourceStudyId:'source',sourceProtocolId:'source-protocol',sourceFingerprint:hash,targetFingerprint:targetHash}};}
const actor={actorId:'admin',authVersion:0};
test('one case/checkpoint, root window and frozen manifest path are explicit',()=>{
 assert.deepEqual(parseArgs(['--help'],{}),{help:true});
 assert.throws(()=>parseArgs(['--local-synthetic','--manifest','/m','--audit'],{}),/ROOT_WF02/);
 assert.throws(()=>parseArgs(['--local-synthetic','--manifest','/m','--audit'],{STUDY_WORKFLOW_WF02_QA_WINDOW:'explicit'}),/SHARED_HELPER/);
 assert.deepEqual(parseArgs(['--local-synthetic','--manifest','/m','--case','D','--step','recover'],window),{mode:'case',manifestPath:'/m',code:'D',step:'recover'});
 assert.throws(()=>parseArgs(['--local-synthetic','--manifest','/m','--case','D','--step','import'],window),/UNKNOWN/);
 assert.throws(()=>parseArgs(['--local-synthetic','--manifest','relative','--audit'],window),/ABSOLUTE/);
});
test('frozen primary and reviewer-reuse phases permit authVersion zero without old permission changes',()=>{
 assert(validateManifest(manifest()));
 const reuse=manifest();reuse.phase='reviewer-reuse';reuse.cases={B:{...reuse.cases.B,studyId:'source'}};reuse.limits.importSuccesses=1;assert(validateManifest(reuse));
 const seed=manifest();seed.cases.Bseed={...seed.cases.B,role:'admin',actorId:'admin'};delete seed.cases.B;assert(validateManifest(seed));
 for(const alter of [m=>m.state='draft',m=>m.limits.newStudies=1,m=>m.cases.B.authVersion=-1,m=>m.cases.D.studyId=m.cases.A.studyId,m=>m.sources.S1.schema={patient:'data'},m=>m.cases.A.password='secret',m=>m.sources.S1.revision=1,m=>m.sources.S1.versionNumber=hash]){
  const m=manifest();alter(m);assert.throws(()=>validateManifest(m));
 }
});
test('strict native import is 200 and key/hash/source/target/actor bind the request',()=>{
 const m=manifest(),request=requestMetadata(input(),m,'A');
 assert.equal(expectedNativeStatus,200);assert.equal(mutationAction('POST',input().path),action);
 for(const [method,path]of [['PATCH',input().path],['POST','/api/research-studies/target-A/start'],['POST','/api/accounts'],['POST','/api/research-projects/p/studies']])assert.equal(mutationAction(method,path),null);
 assert.equal(request.requestHash,bodyHash(input().body));assert.notEqual(request.requestHash,bodyHash(input('other').body));
 assert.equal(receiptPath(request),'/api/research-studies/target-A/protocol-template-imports/receipts/original?requestHash='+request.requestHash);
 for(const alter of [i=>i.actorId='other',i=>i.authVersion=1,i=>i.body.sourceProtocolId='other',i=>i.body.targetFingerprint=hash,i=>i.body.schema={private:true}]){const i=input();alter(i);assert.throws(()=>requestMetadata(i,m,'A'));}
});
test('receipt must prove exact authVersion, draft, fixed source versions and copy/reuse mapping',()=>{
 const request=requestMetadata(input(),manifest(),'A'),out=result(request);
 assert.equal(verifyReceipt(request,out,actor).protocolId,'new-draft');
 assert.throws(()=>verifyReceipt(request,{found:false},actor),/UNRESOLVED_NO_REPLAY/);
 assert.throws(()=>verifyReceipt(request,out,{...actor,authVersion:1}));
 for(const alter of [o=>o.receipt.requestHash=targetHash,o=>o.receipt.targetId='other',o=>o.protocol.status='approved',o=>o.origin.forms.pop(),o=>o.origin.forms[0].body={secret:true},o=>o.origin.forms[0].reused=null]){const o=result(request);alter(o);assert.throws(()=>verifyReceipt(request,o,actor));}
});
test('200/201, 5xx, missing responses and false rejected flags never authorize replay',()=>{
 for(const nativeStatus of [undefined,200,201,500,503]){
  const request={dispatched:true,nativeStatus,rejected:true};assert.equal(knownRejected(request),false);assert(receiptCandidate(request));
  assert.throws(()=>mayExecuteStep({status:'intent',requests:[request]}),/RECONCILE_ONLY/);
 }
 assert(knownRejected({nativeStatus:409}));assert.equal(receiptCandidate({dispatched:true,nativeStatus:409}),false);
 assert.equal(mayExecuteStep({status:'verified'}),false);
});
test('checkpoint persists before dispatch, separates accepted from verified and blocks crash replay',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wf02-guards-'));try{
  const m=manifest(),path=join(dir,'checkpoint.json'),ledger=createJournal(path,m),step=ledger.begin('A','import');
  const request=ledger.beforeRequest(step,input());assert.throws(()=>createJournal(path,m).begin('A','import'),/RECONCILE_ONLY/);
  assert.equal(ledger.responded(step,request,200),'native-accepted');assert.throws(()=>ledger.verified(step),/NOT_UI_VERIFIED/);
  assert.throws(()=>ledger.begin('Bseed','import'),/CASE_NOT_IN_FROZEN_PHASE/);
  assert.throws(()=>ledger.beforeRequest(ledger.begin('B','import'),input()),/UNRESOLVED_NATIVE_WRITE_RECONCILE_ONLY/);
  ledger.confirmed(step,request,result(request),actor);ledger.verified(step);assert.equal(createJournal(path,m).begin('A','import').status,'verified');
  assert.throws(()=>ledger.beforeRequest(step,input()),/VERIFIED_STEP/);
  const changed=manifest();changed.approvedAt='2026-11-17T01:00:00Z';assert.throws(()=>createJournal(path,changed),/FROZEN_MANIFEST_CHANGED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('known 4xx retry remains original intent and readonly checkpoints cannot write',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wf02-retry-'));try{
  const ledger=createJournal(join(dir,'checkpoint.json'),manifest()),step=ledger.begin('A','import'),first=ledger.beforeRequest(step,input());
  assert.equal(ledger.responded(step,first,409),'rejected');assert.throws(()=>ledger.beforeRequest(step,input('replacement')),/ORIGINAL_KEY/);
  assert.equal(ledger.beforeRequest(step,input()).requestHash,first.requestHash);
  assert.throws(()=>ledger.beforeRequest(ledger.begin('B','preview'),input()),/READONLY/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('browser gate forwards one real-button request, records acceptance before discarding and blocks doubleclick',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wf02-gate-'));try{
  const m=manifest(),ledger=createJournal(join(dir,'checkpoint.json'),m),step=ledger.begin('A','import');
  const context={async route(pattern,handler){this.handler=handler;},async unroute(){this.unrouted=true;}};
  const gate=await installNativeImportGate(context,{manifest:m,code:'A',actor,ledger,outputDir:dir,env:window});
  const calls={fetch:0,fulfill:0,abort:0};
  const route=()=>({request:()=>({url:()=>'http://127.0.0.1:19501'+input().path,method:()=>'POST',postDataJSON:()=>input().body}),
   async fetch(){calls.fetch++;assert.equal(JSON.parse((await import('node:fs')).readFileSync(join(dir,'checkpoint.json'),'utf8')).steps['A.import'].requests[0].dispatched,true);return{status:()=>200};},
   async fulfill(){calls.fulfill++;},async abort(){calls.abort++;}});
  gate.arm(step,{dropResponse:true});await context.handler(route());await gate.settle();
  assert.equal(calls.fetch,1);assert.equal(calls.fulfill,0);assert.equal(calls.abort,1);assert.equal(step.requests[0].nativeStatus,200);assert.equal(step.requests[0].responseDiscarded,true);assert.equal(step.status,'intent');
  await context.handler(route());await gate.settle();assert.equal(calls.fetch,1);assert.equal(gate.report.blocked.length,1);gate.disarm();await gate.close();assert.equal(context.unrouted,true);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('browser gate delivers expected native 409 without converting it into a network unknown',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wf02-gate-reject-'));try{
  const m=manifest(),ledger=createJournal(join(dir,'checkpoint.json'),m),step=ledger.begin('A','import');
  const context={async route(pattern,handler){this.handler=handler;},async unroute(){}};
  const gate=await installNativeImportGate(context,{manifest:m,code:'A',actor,ledger,outputDir:dir,env:window});let fulfilled=0,aborted=0;
  gate.arm(step,{expectedStatus:409});
  await context.handler({request:()=>({url:()=>'http://127.0.0.1:19501'+input().path,method:()=>'POST',postDataJSON:()=>input().body}),fetch:async()=>({status:()=>409}),fulfill:async()=>{fulfilled++;},abort:async()=>{aborted++;}});
  await gate.settle();assert.equal(fulfilled,1);assert.equal(aborted,0);assert.equal(step.requests[0].state,'rejected');await gate.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('public resource plan uses original B manager and a separate ready source without seed or policy writes',()=>{
 const m=manifest(),s=m.sources.S1,resource={readOnly:true,writes:0,tenantId:m.tenantId,source:{...s,fixedReady:true},reviewer:{actorId:'researcher',authVersion:0},targets:Object.fromEntries(Object.entries(m.cases).map(([k,c])=>[k,{id:c.studyId,executionProjectId:c.executionProjectId,protocolCount:0,canConfigure:true}]))};
 const reviewerSource={...s,studyId:'reviewer-source',protocolId:'reviewer-protocol',actorId:'researcher',readOnly:true,writes:0,canConfigure:true,fixedReady:true};
 const options={admin:actor,previews:Object.fromEntries(['A','B','D'].map(c=>[c,{sourceFingerprint:hash,targetFingerprint:targetHash}])),protection:m.protection,approvedAt:m.approvedAt};
 const actual=manifestFromResources(resource,reviewerSource,options);assert.deepEqual(Object.keys(actual.cases),['A','B','D']);assert.equal(actual.cases.B.role,'reviewer');assert.equal(actual.sources.qa.studyId,'reviewer-source');assert.equal(actual.limits.importSuccesses,3);assert.equal(actual.limits.newPolicies,0);
 assert.throws(()=>manifestFromResources({...resource,writes:1},reviewerSource,options));
});
test('runner prerequisites distinguish intentional lost-response observation, receipt proof and UI verification',async()=>{
 assert.throws(()=>checkpointPrerequisite({steps:{}},'A','import'),/PREVIEW/);
 const original={status:'unknown-ui-observed',requests:[{dispatched:true,nativeStatus:200,responseDiscarded:true}]},j={steps:{'D.import-loss':original}};
 assert.equal(checkpointPrerequisite(j,'D','recover'),original);assert.throws(()=>checkpointPrerequisite(j,'D','readback'),/UI_MUST_BE_VERIFIED/);
 assert.throws(()=>checkpointPrerequisite(j,'D','verify-ui'),/RECEIPT_PROOF/);original.requests[0].proof={protocolId:'p'};assert.equal(checkpointPrerequisite(j,'D','verify-ui'),original);
 await assert.rejects(runWF02Checkpoint({manifest:manifest(),code:'A',step:'preview',outputDir:'/not-used',env:{}}),/ROOT_WF02/);
});
test('pending popup link must stay on exact target S02 and use a separate noopener tab',()=>{
 const config={origin:'http://127.0.0.1:19501',studyId:'target-D'},href='/pages/s02/?formalPreparation=1&studyId=target-D';
 assert.equal(validatePendingPopupLink(href,'_blank','noopener noreferrer',config),config.origin+href);
 for(const [url,target,rel]of [['https://other.example'+href,'_blank','noopener noreferrer'],[href.replace('target-D','other'),'_blank','noopener noreferrer'],[href+'&protocolId=other','_blank','noopener noreferrer'],[href,'_self','noopener noreferrer'],[href,'_blank','noopener']])assert.throws(()=>validatePendingPopupLink(url,target,rel,config));
});
test('popup checks retain original opaque pending marker bytes, actor/version/URL and original key/hash',()=>{
 const request=requestMetadata(input(),manifest(),'A'),url='/pages/s11/?formalPreparation=1&studyId=target-A';
 const marker={schema:1,...Object.fromEntries(['action','authVersion','requestHash','requestKey','sourceFingerprint','sourceProtocolId','sourceStudyId','studyId','targetFingerprint'].map(k=>[k,request[k]]))};
 const key='researchhub:protocol-template:v1:'+encodeURIComponent(JSON.stringify([request.actorId,0,request.studyId,url])),entries=[[key,JSON.stringify(marker)]];
 assert.match(assertPendingMarkerPreserved(entries,structuredClone(entries),request,url).markerHash,/^[a-f0-9]{64}$/);
 assert.throws(()=>assertPendingMarkerPreserved(entries,[],request,url),/REAL_ORIGINAL_PENDING/);
 assert.throws(()=>assertPendingMarkerPreserved(entries,[[key,JSON.stringify(marker,null,2)]],request,url),/BYTES_MUST_REMAIN/);
 assert.throws(()=>assertPendingMarkerPreserved(entries,[[key,JSON.stringify({...marker,body:{title:'private'}})]],request,url),/OPAQUE/);
 assert.throws(()=>assertPendingMarkerPreserved(entries,entries,request,url+'&changed=1'));
});
test('popup verification refuses missing root window before touching supplied page or context',async()=>{
 await assert.rejects(verifyPendingPopup({env:{}}),/ROOT_WF02/);
});
