import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFullStudyReport} from './full-study-content.mjs';
import {canonicalReportJson,reportDigest} from '../research-analysis/t17-report-content.mjs';
import {reportBundle} from './full-study-fixture.mjs';

test('full report copies verified child output values with compact tables, explicit denominators and no fake root MethodRun',()=>{
 const bundle=reportBundle(),built=buildFullStudyReport(bundle,bundle.basis,'完整合成模拟报告'),block=built.contentBlocks[0];
 assert.equal(block.schemaVersion,'full-study-report-v2');assert.equal(block.runGroupId,bundle.runGroupId);assert.equal(Object.hasOwn(block,'runId'),false);
 assert(built.contentMd.includes(String(1/3)));assert.match(built.contentMd,/不可估计/);assert.match(built.contentMd,/无有效值/);assert.match(built.contentMd,/不适用/);assert.match(built.contentMd,/后续.*基线/);assert.match(built.contentMd,/特殊9/);assert.match(built.contentMd,/模态.*登记/);assert.doesNotMatch(built.contentMd,/subject-\d|\banswers\b/);
 assert(block.presentation.tables.length<=8);assert(block.presentation.tables.every(table=>table.header.length<=6));
 const methods=built.sources.filter(source=>source.sourceType==='research_method_run'),root=built.sources.filter(source=>source.sourceType==='data_snapshot');
 assert.equal(methods.length,bundle.slices.filter(slice=>slice.actualRun).length);assert.equal(root.length,1);assert.equal(root[0].sourceId,bundle.snapshotId);assert(!methods.some(source=>source.sourceId===bundle.runGroupId));
 assert.equal(built.contentHash,reportDigest(built.contentMd));assert.equal(built.sourceSnapshotHash,reportDigest(canonicalReportJson(built.sources)));
 const paired=root[0].snapshot.slices.find(slice=>slice.kind==='paired_change');assert(paired.sources[0].baselineRef.contentHash);assert(paired.sources[0].followupRef.contentHash);
});
test('changed, absent or unreviewed Worker results and inconsistent slice metadata cannot generate a report',()=>{
 for(const mutate of [b=>b.slices.find(s=>s.actualRun).actualRun.numericEvidence.pop(),b=>b.slices.find(s=>s.actualRun).actualRun.reviewStatus='pending_review',b=>b.slices.find(s=>s.actualRun).outputs.columns.phq9_total.mean=999,b=>b.slices.find(s=>s.actualRun).denominators.valid=0,b=>b.slices.pop(),b=>b.slices.push(b.slices[0]),b=>b.slices.find(s=>s.kind==='paired_change'&&s.actualRun).sources[0].baselineRef=null]){
  const b=reportBundle();mutate(b);assert.throws(()=>buildFullStudyReport(b,b.basis,'合成报告'),error=>error.status===409);
 }
});
test('root identity, complete source hashes and explicit assumptions are bound to report provenance',()=>{
 const b=reportBundle(),original=buildFullStudyReport(b,b.basis,'合成报告');
 assert.throws(()=>buildFullStudyReport(b,{...b.basis,manifestHash:'0'.repeat(64)},'合成报告'),error=>error.status===409);
 b.caseMetadata.assumptions.push('新增模拟假设');const changed=buildFullStudyReport(b,b.basis,'合成报告');assert.notEqual(changed.sourceSnapshotHash,original.sourceSnapshotHash);assert.notEqual(changed.contentHash,original.contentHash);
 const snapshot=changed.sources.find(source=>source.sourceType==='data_snapshot').snapshot;assert.equal(snapshot.quality.modalities.files[0].contentHash,null);
});
