import test from 'node:test';
import assert from 'node:assert/strict';
import {buildT17Report,canonicalReportJson,reportDigest} from './t17-report-content.mjs';
const basis={type:'study-analysis-snapshot',studyId:'study',snapshotId:'snapshot',manifestHash:'a'.repeat(64),qualityGateId:'gate',qualityGateVersion:1};
const outputs={manifestHash:basis.manifestHash,rowCount:3,statisticalUnit:'subject',columns:{value:{type:'number',total:3,observed:3,missing:0,status:'available',min:0,max:4,mean:2,median:2,sampleStdDev:2},optional:{type:'number',total:3,observed:1,missing:2,status:'single_observation',min:0,max:0,mean:0,median:0,sampleStdDev:null},completed:{type:'boolean',total:3,observed:3,missing:0,status:'available',trueCount:2,falseCount:1}}};
function run(){const evidence=[];const walk=(x,path='')=>{for(const[k,v]of Object.entries(x)){const p=path?path+'.'+k:k;if(typeof v==='number')evidence.push({name:p,value:v,assumptions:['manifestHash:'+basis.manifestHash]});else if(v&&typeof v==='object')walk(v,p);}};walk(outputs);return {id:'run',skillKey:'descriptive-statistics',skillVersion:1,executorVersion:'descriptive-v1',inputHash:'b'.repeat(64),status:'completed',reviewStatus:'confirmed',dataSources:{analysisBasis:basis},artifactRefs:{outputs},numericEvidence:evidence,environment:{llm:false,workerVersion:'t19-1'}};}
test('fixed report copies existing deterministic numbers with exact JSON paths, preserves zero and null, and has no patient rows',()=>{
 const value=buildT17Report(run(),basis,'合成结果');assert.match(value.contentMd,/0/);assert.match(value.contentMd,/不可估计/);assert.match(value.contentMd,/columns\.completed\.falseCount/);assert.doesNotMatch(value.contentMd,/subjectId|answers|email/);assert.equal(value.sources.length,2);assert.equal(value.sources[0].sourceType,'research_method_run');assert.equal(value.sources[1].sourceId,basis.snapshotId);
 assert.equal(value.contentHash,reportDigest(value.contentMd));assert.equal(value.sourceSnapshotHash,reportDigest(canonicalReportJson(value.sources)));
});
test('report rejects absent/mismatched evidence, stale basis, unconfirmed run, non-finite and unknown output paths',()=>{
 for(const mutate of [r=>r.numericEvidence.pop(),r=>r.numericEvidence[0].value=999,r=>r.dataSources.analysisBasis.manifestHash='c'.repeat(64),r=>r.reviewStatus='pending_review',r=>r.artifactRefs.outputs.columns.value.mean=Infinity,r=>r.artifactRefs.outputs.hidden=1]){const r=structuredClone(run());mutate(r);assert.throws(()=>buildT17Report(r,basis,'合成结果'),e=>e.code==='REPORT_SOURCE_INVALID');}
});
test('canonical JSON remains stable after object-key reordering',()=>{assert.equal(canonicalReportJson({b:0,a:{y:false,x:null}}),canonicalReportJson({a:{x:null,y:false},b:0}));});
