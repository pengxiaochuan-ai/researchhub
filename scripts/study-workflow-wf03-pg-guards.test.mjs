// Offline guards/proof predicates/SQL-order recorder only. This is not real PostgreSQL or native-core evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyHash} from './study-workflow-wf03-qa.mjs';
import {parseWF03PgArgs,withWF03LogicalSavepoint,assertWF03NativeProof,redactedWF03PgError,runWF03PgPrediction} from './study-workflow-wf03-pg.mjs';
const windows={STUDY_WORKFLOW_WF03_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'},hash='a'.repeat(64),policyHash='b'.repeat(64);
const args=(code='A',mode='full')=>['--local-synthetic','--rollback-predict','--case',code,'--mode',mode];
test('PG prediction guards scope, explicit window and exact case/mode before any injected dependency',async()=>{
 assert.deepEqual(parseWF03PgArgs(['--help'],{}),{help:true});assert.throws(()=>parseWF03PgArgs(args(),{}),/ROOT_WF03/);
 for(const c of ['A','B','D'])assert.deepEqual(parseWF03PgArgs(args(c),windows),{code:c,mode:'full'});
 for(const a of [args('B','policy-race'),args('D','activate-rollback'),args('A','reviewer-approver'),args('A','commit'),[...args(),'--all']])assert.throws(()=>parseWF03PgArgs(a,windows));
 let touched=0;await assert.rejects(runWF03PgPrediction({args:args(),windowEnv:{},readProtection:()=>{touched++;},withFixtureTransaction:()=>{touched++;}}),/ROOT_WF03/);assert.equal(touched,0);
});
test('logical request success emits immediate/deferred constraint boundary then releases savepoint',async()=>{
 const sql=[],tx={$executeRawUnsafe:async text=>{sql.push(text);}};
 const value=await withWF03LogicalSavepoint(tx,1,async()=>{sql.push('NATIVE_CALLBACK');return'completed';},{windowEnv:windows});assert.equal(value,'completed');
 assert.deepEqual(sql,['SAVEPOINT wf03_native_1','NATIVE_CALLBACK','SET CONSTRAINTS ALL IMMEDIATE','SET CONSTRAINTS ALL DEFERRED','RELEASE SAVEPOINT wf03_native_1']);
});
test('native failure and deferred-constraint failure both rollback only their savepoint before continuing',async()=>{
 for(const constraintFailure of [false,true]){
  const sql=[],failure=Error('OFFLINE_CONTROL_FLOW_ONLY'),tx={$executeRawUnsafe:async text=>{sql.push(text);if(constraintFailure&&text==='SET CONSTRAINTS ALL IMMEDIATE')throw failure;}};
  await assert.rejects(withWF03LogicalSavepoint(tx,2,async()=>{sql.push('NATIVE_CALLBACK');if(!constraintFailure)throw failure;},{windowEnv:windows}),e=>e===failure);
  assert.deepEqual(sql.slice(-3),['ROLLBACK TO SAVEPOINT wf03_native_2','SET CONSTRAINTS ALL DEFERRED','RELEASE SAVEPOINT wf03_native_2']);
  assert.equal(sql.some(s=>s==='COMMIT'||s==='ROLLBACK'),false);
 }
 let touched=false;await assert.rejects(withWF03LogicalSavepoint({$executeRawUnsafe:()=>{touched=true;}},'1;COMMIT',async()=>{},{windowEnv:windows}),/SERIAL/);assert.equal(touched,false);
});
function proofFixture(action='approve'){
 const principal={accountId:'synthetic-admin',authVersion:0},policy={id:'synthetic-policy',contentHash:policyHash},body={requestKey:action+'-key',expectedRevision:hash,...(action==='activate'?{migrateExisting:false}:{policyVersionId:policy.id,expectedPolicyHash:policyHash})};
 const result={protocol:{id:'synthetic-protocol',revision:hash,status:{check:'draft',submit:'pending_review',approve:'approved',activate:'executing'}[action]},policy:{...policy,status:['approve','activate'].includes(action)?'approved':'draft'},approvedPolicy:['approve','activate'].includes(action)?policy:null,
 receipt:{proofVersion:1,id:'native-operation',requestKey:body.requestKey,requestHash:bodyHash(body),authVersion:0,actorId:principal.accountId,studyId:'synthetic-study',action:'protocol.'+action,targetId:'synthetic-protocol'}};
 return{action,body,result,binding:{principal,studyId:'synthetic-study',protocolId:'synthetic-protocol',policy}};
}
test('new native proof binds actor/version zero, full request hash, original target/status and exact approved policy',()=>{
 for(const action of ['check','submit','approve','activate']){const f=proofFixture(action);assert.equal(assertWF03NativeProof(f.action,f.body,f.result,f.binding).authVersion,0);}
 for(const change of [f=>delete f.result.receipt.proofVersion,f=>f.result.receipt.authVersion=1,f=>f.result.receipt.actorId='other',f=>f.result.receipt.requestHash=policyHash,f=>f.result.receipt.studyId='other',f=>f.result.protocol.status='executing',f=>f.result.policy.id='later-policy',f=>f.result.approvedPolicy={id:'other',contentHash:policyHash}]){const f=proofFixture();change(f);assert.throws(()=>assertWF03NativeProof(f.action,f.body,f.result,f.binding));}
});
test('redacted PG errors contain no original message, stack, connection string or arbitrary status/code',()=>{
 const error={name:'PrismaClientInitializationError',message:'postgres://user:DUMMY_PRIVATE@host/db',stack:'private stack',status:'postgres://private',code:'postgres://private'};
 assert.deepEqual(redactedWF03PgError(error),{name:'PrismaClientInitializationError',code:null,status:null});assert.equal(JSON.stringify(redactedWF03PgError(error)).includes('DUMMY_PRIVATE'),false);
});
