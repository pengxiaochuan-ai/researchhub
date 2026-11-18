// Offline only: no fixture imports, target HTTP, PG, private accounts, or browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs,bodyHash,mutationAction,expectedNativeStatus,successfulNativeStatus,knownRejected,receiptCandidate,receiptPath,verifyReceipt,assertOpaqueMarker,mayExecuteStep,createJournal,assertOldHashes} from './study-workflow-wf01-qa.mjs';
const window={STUDY_WORKFLOW_WF01_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'};
test('target window and exact one case/step are required before target imports',()=>{
 assert.deepEqual(parseArgs(['--help'],{}),{help:true});
 assert.throws(()=>parseArgs(['--local-synthetic','--audit'],{}),/ROOT_WF01_IO_WINDOW_REQUIRED/);
 assert.throws(()=>parseArgs(['--local-synthetic','--audit'],{STUDY_WORKFLOW_WF01_QA_WINDOW:'explicit'}),/SHARED_HELPER_WINDOW_REQUIRED/);
 assert.deepEqual(parseArgs(['--local-synthetic','--case','D','--step','study-loss'],window),{mode:'case',code:'D',step:'study-loss'});
 assert.deepEqual(parseArgs(['--local-synthetic','--verify-ui','A.create'],window),{mode:'verify-ui',code:'A',step:'create'});
 assert.throws(()=>parseArgs(['--local-synthetic','--case','E','--step','create'],window));
 assert.throws(()=>parseArgs(['--local-synthetic','--case','D','--step','create'],window));
});
test('receipt hashes bind canonical body including original opaque request key',()=>{
 assert.equal(bodyHash({requestKey:'one',pico:{o:'',p:'P'}}),bodyHash({pico:{p:'P',o:''},requestKey:'one'}));
 assert.notEqual(bodyHash({requestKey:'one',title:'T'}),bodyHash({requestKey:'two',title:'T'}));
 const request={requestKey:'one',requestHash:bodyHash({title:'T'}),action:'intent.update',targetId:'p'};
 assert.equal(receiptPath(request),'/api/research-projects/receipts/one?action=intent.update&requestHash='+request.requestHash+'&targetId=p');
 const out={item:{id:'p',version:2,title:'T'},receipt:{requestKey:'one',requestHash:request.requestHash,action:request.action,targetId:'p',authVersion:3}};
 assert.equal(verifyReceipt(request,out,3).id,'p');
 assert.throws(()=>verifyReceipt(request,{...out,receipt:{...out.receipt,authVersion:undefined}},3),/Expected values/);
 assert.throws(()=>verifyReceipt(request,out,4));
});
test('only three original native mutations can be armed',()=>{
 assert.equal(mutationAction('POST','/api/research-projects'),'intent.create');assert.equal(mutationAction('PATCH','/api/research-projects/p'),'intent.update');assert.equal(mutationAction('POST','/api/research-projects/p/studies'),'study.create');
 for(const[method,path]of [['DELETE','/api/research-projects/p'],['POST','/api/research-studies/p/start'],['POST','/api/accounts'],['POST','/api/research-projects/p']])assert.equal(mutationAction(method,path),null);
});
test('native create is 201, other actions 200; old wrong 201 rejection can never authorize replay',()=>{
 assert.equal(expectedNativeStatus('intent.create'),201);assert.equal(expectedNativeStatus('intent.update'),200);assert.equal(expectedNativeStatus('study.create'),200);
 for(const status of [200,201]){assert(successfulNativeStatus(status));assert.equal(knownRejected({nativeStatus:status}),false);}
 assert.equal(successfulNativeStatus(202),false);assert(knownRejected({nativeStatus:409}));assert.equal(knownRejected({nativeStatus:503}),false);
 const oldWrongRecord={dispatched:true,nativeStatus:201,rejected:true,expectedStatus:200};assert(receiptCandidate(oldWrongRecord));assert.throws(()=>mayExecuteStep({status:'intent',requests:[oldWrongRecord]}),/RECONCILE_ONLY/);
 assert.deepEqual(parseArgs(['--local-synthetic','--case','A','--step','continue-child'],window),{mode:'case',code:'A',step:'continue-child'});
});
test('marker validation refuses form bodies and unknown sensitive fields',()=>{
 const marker={schema:1,actor:JSON.stringify(['a',3]),origin:'new',prepare:true,groupId:'g',pending:{path:'/research-projects',method:'POST',action:'intent.create',requestKey:'key',requestHash:'a'.repeat(64)}};
 const entry=x=>[['researchhub:project-preparation:v1:opaque:new',JSON.stringify(x)]];
 assert(assertOpaqueMarker(entry(marker)));
 assert.throws(()=>assertOpaqueMarker(entry({...marker,title:'patient data'})),/MARKER_MUST_NOT_PERSIST_FORM_BODY/);
 assert.throws(()=>assertOpaqueMarker(entry({...marker,pending:{...marker.pending,body:{title:'T'}}})));
});
test('durable checkpoints cannot replay dispatched native intents even after accepted 200',()=>{
 assert.equal(mayExecuteStep(),true);assert.equal(mayExecuteStep({status:'verified'}),false);
 assert.throws(()=>mayExecuteStep({status:'intent',requests:[{dispatched:true}]}),/RECONCILE_ONLY/);
 assert.throws(()=>mayExecuteStep({status:'native-confirmed-ui-unverified',requests:[{dispatched:true,nativeStatus:200}]}),/RECONCILE_ONLY/);
 assert.equal(mayExecuteStep({status:'intent',requests:[{dispatched:true,rejected:true,nativeStatus:409}]}),true);
 const dir=mkdtempSync(join(tmpdir(),'wf01-guards-'));
 try{const path=join(dir,'journal.json'),one=createJournal(path),step=one.intent('A.create',{role:'admin'});step.requests.push({dispatched:true,requestKey:'original'});one.persist();const two=createJournal(path);assert.throws(()=>two.intent('A.create'),/RECONCILE_ONLY/);two.verified(two.journal.steps['A.create']);assert.equal(createJournal(path).intent('A.create').status,'verified');}finally{rmSync(dir,{recursive:true,force:true});}
});
test('all old original IDs must keep their complete DB-side row digest',()=>{
 assert(assertOldHashes({t:[{id:'old',hash:'x'}]},{t:[{id:'old',hash:'x'},{id:'new',hash:'y'}]}));
 assert.throws(()=>assertOldHashes({t:[{id:'old',hash:'x'}]},{t:[{id:'old',hash:'changed'}]}),/ORIGINAL_ROW_CHANGED/);
 assert.throws(()=>assertOldHashes({t:[{id:'old',hash:'x'}]},{t:[]}),/ORIGINAL_ROW_CHANGED/);
});
