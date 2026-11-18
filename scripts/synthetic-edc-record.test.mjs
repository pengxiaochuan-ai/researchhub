import test from 'node:test';
import assert from 'node:assert/strict';
import * as edc from './synthetic-edc-contract.mjs';
import {packet,validate} from '../tests/fixtures/synthetic-edc-runtime.mjs';
const input=()=>({baseResponseRevision:0,answers:{value:{state:'value',value:11},flag:{state:'value',value:false}}});
test('draft revisions advance only for real saved answer changes',()=>{
 assert.equal(typeof edc.applySyntheticDraft,'function');const p=packet(),before=structuredClone(p),next=edc.applySyntheticDraft(p,'record',input(),'owner','now',validate);assert.deepEqual(p,before);assert.equal(next.dataRevision,1);assert.equal(next.records[0].responseRevision,1);assert.equal(next.records[0].answers.value.value,11);assert.equal(next.records[0].answers.flag.value,false);
 const repeat=edc.applySyntheticDraft(next,'record',{...input(),baseResponseRevision:1},'owner','later',validate);assert.deepEqual(repeat,next);
});
test('unknown fields, wrong types, foreign records and stale responses never save',()=>{
 assert.equal(typeof edc.applySyntheticDraft,'function');const p=packet();for(const answers of [{unknown:{state:'value',value:1}},{value:{state:'value',value:'11'}}])assert.throws(()=>edc.applySyntheticDraft(p,'record',{...input(),answers},'owner','now',validate));
 assert.throws(()=>edc.applySyntheticDraft(p,'foreign',input(),'owner','now',validate),/RECORD_NOT_FOUND/);assert.throws(()=>edc.applySyntheticDraft(p,'record',{...input(),baseResponseRevision:1},'owner','now',validate),/RESPONSE_CONFLICT/);
 p.records[0].status='recorded';assert.throws(()=>edc.applySyntheticDraft(p,'record',input(),'owner','now',validate),/RECORD_STATE/);
});
export {packet,validate};

test('completion acknowledges the actual saved response and is not quality approval',()=>{
 assert.equal(typeof edc.completeSyntheticRecord,'function');const p=packet(),r=p.records[0],validation=edc.syntheticRecordValidation(p.config,r,validate);
 assert.throws(()=>edc.completeSyntheticRecord(p,'record',{baseResponseRevision:0,acknowledgeFindingsHash:'wrong'},'owner','now',validate),/ACK_REQUIRED/);
 const n=edc.completeSyntheticRecord(p,'record',{baseResponseRevision:0,acknowledgeFindingsHash:validation.findingsHash},'owner','now',validate);assert.equal(n.records[0].status,'recorded');assert.equal(n.dataRevision,1);assert.equal(n.records[0].responseRevision,1);assert.equal(n.records[0].recordedBy,'owner');assert.equal(p.records[0].status,'draft');assert(edc.syntheticRecordValidation(n.config,n.records[0],validate).findings.length>0);
 assert.throws(()=>edc.applySyntheticDraft(n,'record',{baseResponseRevision:1,answers:{}},'owner','later',validate),/RECORD_STATE/);
});
test('correction requires saved response CAS and reason; immutable diff and no-op keep semantics',()=>{
 assert.equal(typeof edc.correctSyntheticRecord,'function');const p=packet();p.records[0].status='recorded';const input={baseResponseRevision:0,answers:{value:{state:'value',value:0},flag:{state:'value',value:false}},reason:'合成更正原因长度符合要求'};
 for(const reason of ['x'.repeat(7),'x'.repeat(501),' '.repeat(8)])assert.throws(()=>edc.correctSyntheticRecord(p,'record',{...input,reason},'owner','now',validate),/REASON/);
 const n=edc.correctSyntheticRecord(p,'record',input,'owner','now',validate);assert.equal(n.records[0].status,'recorded');assert.equal(n.lastChange.recordId,'record');assert.equal(n.lastChange.author,'owner');assert.equal(n.lastChange.changes.length,2);assert.deepEqual(n.lastChange.changes[0].before,{state:'missing'});assert.equal(n.records[0].answers.value.value,0);assert.equal(n.dataRevision,1);
 assert.throws(()=>edc.correctSyntheticRecord(n,'record',input,'owner','later',validate),/RESPONSE_CONFLICT/);const same=edc.correctSyntheticRecord(n,'record',{...input,baseResponseRevision:1},'owner','later',validate);assert.equal(same.dataRevision,1);assert.equal(same.records[0].responseRevision,1);
 assert.equal(p.records[0].answers.value.state,'missing');
});
