// Offline QA guards only: no target, fixture, credentials, product session or TS core execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {requireWF03Window,atomicEvidence,assertOriginalAtomicRetry,classifyEvidence,preservePriorUnknown,assertOpaqueQAEvidence,assertAttemptAndSuccessBudget,assertWorkflowOperationBudget,assertProtocolProtection,stableProtocolHash,qaReleaseMutableColumns} from './study-workflow-wf03-qa.mjs';
import {releaseMutableColumns} from './study-workflow-wf03-preserve.mjs';
const hash='a'.repeat(64),other='b'.repeat(64),binding={actorId:'synthetic-admin',authVersion:0,studyId:'synthetic-study',protocolId:'synthetic-protocol'};
const approval=(key='approve-key')=>atomicEvidence('approve',{requestKey:key,expectedRevision:hash,policyVersionId:'synthetic-policy',expectedPolicyHash:other},binding);
const activation=(key='activate-key')=>atomicEvidence('activate',{requestKey:key,expectedRevision:other,migrateExisting:false},binding);
test('WF03 requires its own target window and shared helper window; zero authVersion remains valid',()=>{
 assert.throws(()=>requireWF03Window({}),/ROOT_WF03/);assert.throws(()=>requireWF03Window({STUDY_WORKFLOW_WF03_QA_WINDOW:'explicit'}),/SHARED_HELPER/);
 requireWF03Window({STUDY_WORKFLOW_WF03_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'});assert.equal(approval().authVersion,0);
});
test('native atomic evidence has exact approve/activate bodies and never migrates or persists policy text',()=>{
 assert(assertOpaqueQAEvidence(approval()));assert(assertOpaqueQAEvidence(activation()));
 assert.throws(()=>atomicEvidence('activate',{requestKey:'k',expectedRevision:hash,migrateExisting:true},binding),/MIGRATION/);
 assert.throws(()=>atomicEvidence('approve',{requestKey:'k',expectedRevision:hash,policyVersionId:'p',expectedPolicyHash:hash,sections:{}},binding),/STRICT_NATIVE/);
 assert.throws(()=>assertOpaqueQAEvidence({...approval(),policyBody:{ethics:'private'}}),/MUST_NOT_PERSIST/);assert.throws(()=>assertOpaqueQAEvidence({...approval(),reason:'private'}),/MUST_NOT_PERSIST/);
 assert.throws(()=>assertOpaqueQAEvidence({...approval(),nativeStatus:'200'}),/ACTUAL_NATIVE_STATUS/);
 for(const action of ['check','submit'])assert(assertOpaqueQAEvidence(atomicEvidence(action,{requestKey:action+'-key',expectedRevision:hash,policyVersionId:'synthetic-policy',expectedPolicyHash:other},binding)));
});
test('every retry binds original key/hash/action/actor/version/Study/Protocol and fixed policy',()=>{
 const original=approval();assert(assertOriginalAtomicRetry(original,{...original}));
 for(const patch of [{requestKey:'replacement'},{requestHash:other},{action:'activate'},{actorId:'other'},{authVersion:1},{studyId:'other'},{protocolId:'other'},{policyVersionId:'other'},{policyHash:hash},{expectedRevision:other}])assert.throws(()=>assertOriginalAtomicRetry(original,{...original,...patch}),/ORIGINAL_ATOMIC/);
});
test('native accepted and strict confirmed differ; receipt 404/foundfalse/old weak proof remain unknown',()=>{
 assert.equal(classifyEvidence({kind:'command',status:200}),'native-accepted');assert.equal(classifyEvidence({kind:'command',status:409}),'definite-rejection');
 for(const input of [{status:404},{status:200,found:false},{status:200,found:true},{status:503}])assert.equal(classifyEvidence({kind:'receipt',...input}),'unknown');
 assert.equal(classifyEvidence({kind:'receipt',status:200,found:true,strictBindingVerified:true}),'unknown');
 assert.equal(classifyEvidence({kind:'receipt',status:200,found:true,strictBindingVerified:true,evidenceMode:'strict'}),'strict-confirmed');
});
test('a later explicit retry 4xx never removes an earlier unknown operation',()=>{
 const original={...activation(),everUnknown:true},retry={...original,nativeStatus:409};assert.equal(preservePriorUnknown(original,retry),true);
 assert.equal(preservePriorUnknown({...original,strictConfirmed:true},retry),false);
});
test('network interception, real native success/discard, no approval replay and bounded operations are separate',()=>{
 const a={...approval(),transmission:'forwarded',nativeStatus:200,operationId:'approval-op',responseDiscarded:true};
 const d={...activation(),transmission:'intercepted-before-native',everUnknown:true},retry={...activation(),transmission:'forwarded',nativeStatus:200,operationId:'activation-op',responseDiscarded:true};
 assert.deepEqual(assertAttemptAndSuccessBudget([a,d,retry]),{approve:1,activate:1});
 assert.throws(()=>assertAttemptAndSuccessBudget([{...d,nativeStatus:200}]),/NOT_NATIVE_STATUS/);assert.throws(()=>assertAttemptAndSuccessBudget([a,{...a}]),/MUST_NOT_REPLAY/);
 assert.throws(()=>assertAttemptAndSuccessBudget([a,{...approval(),transmission:'intercepted-before-native'}]),/MUST_NOT_REPLAY/);
 assert.throws(()=>assertAttemptAndSuccessBudget([a],{approve:0,activate:3}),/BUDGET/);
});
test('only named Protocol release columns may change; scientific content, fixed refs, other full rows and dates stay protected',()=>{
 const before=[{id:'target',status:'draft',title:'Synthetic',primaryOutcomes:[{outcomeDefinitionId:'fixed',versionNumber:1}],createdAt:new Date('2026-01-01T00:00:00Z'),updatedAt:new Date('2026-01-01T00:00:00Z')},{id:'old',status:'executing',title:'Original',updatedAt:new Date('2026-01-01T00:00:00Z')}];
 const after=structuredClone(before);Object.assign(after[0],{status:'executing',approvedBy:'admin',approvedPolicyVersionId:'p',approvedPolicyHash:hash,lockedAt:new Date(),effectiveFrom:new Date(),updatedAt:new Date()});assert(assertProtocolProtection(before,after,['target']));
 for(const alter of [rows=>rows[0].title='changed',rows=>rows[0].primaryOutcomes[0].outcomeDefinitionId='other',rows=>rows[1].status='superseded',rows=>rows[0].createdAt=new Date('2026-02-01T00:00:00Z'),rows=>rows.push({id:'new',status:'draft'})]){const rows=structuredClone(after);alter(rows);assert.throws(()=>assertProtocolProtection(before,rows,['target']));}
});
test('persisted policy/check/submit/approve/activate operations share the frozen fifteen-operation budget',()=>{
 const kinds=['policy.save','check','submit','approve','activate'],targets=['target-A','target-B','target-D'];
 const rows=targets.flatMap(targetId=>kinds.map(kind=>({id:targetId+'-'+kind.replace('.','-'),targetId,action:'protocol.'+kind,requestKey:targetId+'-'+kind.replace('.','-'),requestHash:hash})));
 assert.deepEqual(assertWorkflowOperationBudget(rows,targets),{policy:3,check:3,submit:3,approve:3,activate:3,total:15});
 assert.equal(assertWorkflowOperationBudget([...rows,rows[0]],targets).total,15);
 assert.throws(()=>assertWorkflowOperationBudget([...rows,{...rows[0],id:'extra-policy',requestKey:'extra-key'}],targets),/BUDGET/);
 assert.throws(()=>assertWorkflowOperationBudget([{...rows[0],targetId:'other-protocol'}],targets),/NOT_FROZEN/);
});
test('new check/submit strictly bind both policy fields; unpaired or implicit legacy bodies are rejected',()=>{
 for(const action of ['check','submit']){
  const base={requestKey:action+'-key',expectedRevision:hash},body={...base,policyVersionId:'synthetic-policy',expectedPolicyHash:other},evidence=atomicEvidence(action,body,binding);
  assert.equal(evidence.evidenceMode,'strict');assert.equal(evidence.policyVersionId,body.policyVersionId);assert.equal(evidence.policyHash,other);assert(assertOpaqueQAEvidence(evidence));
  for(const bad of [base,{...base,policyVersionId:'synthetic-policy'},{...base,expectedPolicyHash:other}])assert.throws(()=>atomicEvidence(action,bad,binding),/STRICT_NATIVE_BODY/);
  assert.throws(()=>assertOriginalAtomicRetry(evidence,{...evidence,policyVersionId:'later-policy'}),/ORIGINAL_ATOMIC/);assert.throws(()=>assertOriginalAtomicRetry(evidence,{...evidence,policyHash:hash}),/ORIGINAL_ATOMIC/);
  const legacy=atomicEvidence(action,base,binding,{mode:'legacy'});assert.equal(legacy.evidenceMode,'legacy');assert(assertOpaqueQAEvidence(legacy));
  assert.equal(classifyEvidence({kind:'receipt',status:200,found:true,strictBindingVerified:true,evidenceMode:legacy.evidenceMode}),'unknown');assert.throws(()=>assertOpaqueQAEvidence({...legacy,strictConfirmed:true}),/LEGACY_CANNOT/);
  assert.throws(()=>atomicEvidence(action,body,binding,{mode:'legacy'}),/STRICT_NATIVE_BODY/);assert.throws(()=>assertOriginalAtomicRetry(legacy,{...legacy,evidenceMode:'strict'}),/ORIGINAL_ATOMIC/);
 }
});
test('QA and full preserver use the same nine release columns without opening unrelated source rows',()=>{
 assert.deepEqual(qaReleaseMutableColumns,releaseMutableColumns);
 const row={id:'target',status:'draft',title:'Protected science',effectiveTo:null,supersededById:null};
 for(const key of releaseMutableColumns){const after={...row,[key]:key==='status'?'executing':'changed-native-release-metadata'};assert.equal(stableProtocolHash(after,{target:true}),stableProtocolHash(row,{target:true}));assert.notEqual(stableProtocolHash(after),stableProtocolHash(row));}
 assert.notEqual(stableProtocolHash({...row,title:'changed'},{target:true}),stableProtocolHash(row,{target:true}));
});
