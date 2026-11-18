import test from 'node:test';
import assert from 'node:assert/strict';
import * as edc from './synthetic-edc-contract.mjs';
import {packet,validate} from '../tests/fixtures/synthetic-edc-runtime.mjs';
const meta={id:'quality',accountId:'owner',at:'now'};
test('quality is independently recomputable from actual saved CRF, including missing, range and unrecorded',()=>{
 assert.equal(typeof edc.runSyntheticQuality,'function');const p=packet();p.records[0].answers.value={state:'value',value:11};const q=edc.runSyntheticQuality(p,meta,validate);assert.equal(q.rulesVersion,'synthetic-crf-dq.v1');assert.equal(q.checkedRecordCount,1);assert.equal(q.recordedRecordCount,0);assert.deepEqual(q.findings.map(f=>f.ruleKey).sort(),['D01','D02','D03']);assert(q.findings.every(f=>f.recordId==='record'&&f.subjectKey==='SIM_01'&&f.visitKey==='baseline'&&f.formKey==='crf'));assert.equal(q.findingsHash,edc.edcDigest(q.findings));assert.deepEqual(edc.runSyntheticQuality(p,meta,validate),q);
 const d=edc.runSyntheticQuality({...p,records:[{...p.records[0],answers:{...p.records[0].answers,value:{state:'value',value:0},flag:{state:'value',value:false}},status:'recorded'}]},meta,validate);assert.equal(d.findings.length,0);assert.equal(d.recordedRecordCount,1);assert.notEqual(q.basis.dataHash,d.basis.dataHash);
});
test('quality metadata does not invalidate data; change-back never revives an old snapshot',()=>{
 assert.equal(typeof edc.syntheticQualityCurrent,'function');const p=packet(),q=edc.runSyntheticQuality(p,meta,validate),saved={...p,quality:q};assert(edc.syntheticQualityCurrent(saved));assert(edc.syntheticQualityCurrent({...saved,pending:{jobId:'job'},operations:[{key:'metadata'}],lastChange:{at:'later'}}));
 const changed=edc.applySyntheticDraft(saved,'record',{baseResponseRevision:0,answers:{value:{state:'value',value:0},flag:{state:'value',value:false}}},'owner','later',validate);assert(!edc.syntheticQualityCurrent(changed));const reverted=edc.applySyntheticDraft(changed,'record',{baseResponseRevision:1,answers:p.records[0].answers},'owner','last',validate);assert.deepEqual(reverted.records[0].answers,p.records[0].answers);assert(!edc.syntheticQualityCurrent(reverted));
 assert.notEqual(edc.syntheticDataBasis(p).dataHash,edc.syntheticDataBasis(reverted).dataHash);
});
test('maximum 130 findings are fully returned, not truncated or turned into clinical metrics',()=>{
 assert.equal(typeof edc.runSyntheticQuality,'function');const p=packet();p.config.form.schema.fields=Array.from({length:12},(_,i)=>({key:'field'+i,label:'合成字段',type:'number',required:true}));p.config.mappings=[];p.records=Array.from({length:10},(_,i)=>({...p.records[0],recordId:'record'+i,answers:edc.classifySyntheticAnswers(p.config,{},validate).answers}));const q=edc.runSyntheticQuality(p,meta,validate);assert.equal(q.findings.length,130);assert.equal(new Set(q.findings.map(f=>f.findingId)).size,130);assert(!Object.hasOwn(q,'efficacy'));assert(!Object.hasOwn(q,'validRate'));
});
