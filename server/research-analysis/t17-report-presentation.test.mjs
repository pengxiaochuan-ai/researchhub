import test from 'node:test';import assert from 'node:assert/strict';
import {buildT17Report,canonicalReportJson,reportDigest} from './t17-report-content.mjs';
import {basis,run,presentation,manifest,form,digest} from './t17-presentation-fixture.mjs';
test('legacy complete template/source golden remains byte-identical without presentation',()=>{
 const b=buildT17Report(run(),basis,'合成报告');assert.equal(reportDigest(canonicalReportJson(b)),'35ec0b62c2bfbb6188e7bb23077db3e16b610b1fbb53c0a926862f47d877a8ce');assert.equal(b.contentHash,'e1d94cb99069b3898223a60debb65bb25e2b02211628e84cf325b5f9639b49fd');assert.equal(b.sourceSnapshotHash,'f194205572c93c70304102889ef1fd07468666abca9ebd5a1cbd30a455c906f4');
});
test('new presentation seals approved aliases, schema label/type/unit and preserves exact result/path/evidence',()=>{
 const r=run(),b=buildT17Report(r,basis,'合成报告',presentation);assert.deepEqual(b.contentBlocks[0].presentation,presentation);assert.deepEqual(b.sources[1].snapshot.presentation,presentation);assert.deepEqual(b.sources[0].snapshot.outputs,r.artifactRefs.outputs);assert.deepEqual(b.sources[0].snapshot.numericEvidence,r.numericEvidence);
 const [main,appendix]=b.contentMd.split('## 可复核附录');assert.match(main,/## 观察值\n\n单位：分/);assert.match(main,/## 选填观察值\n\n单位：未声明/);assert.match(main,/\| 样本标准差 \| 不可估计 \|/);assert.match(main,/\| 最小值 \| 0 \|/);assert.doesNotMatch(main,/columns\.|固定结果路径|v1/);assert(appendix);for(const path of ['rowCount','columns.v1.mean','columns.v2.sampleStdDev','columns.v3.falseCount'])assert(appendix.includes(path));for(const text of ['value','optional_value','completed','descriptive-v1',basis.manifestHash,presentation.variables[0].formDefinitionHash])assert(appendix.includes(text));
});
test('presentation marker never downgrades and rejects unknown/missing/duplicate/mismatched output metadata',()=>{
 for(const change of [()=>null,p=>({...p,schemaVersion:'unknown'}),p=>({...p,extra:true}),p=>({...p,variables:p.variables.slice(1)}),p=>{p.variables[1].key='v1';return p;},p=>{p.variables[0].valueType='boolean';return p;},p=>{p.variables[0].label='';return p;},p=>{p.variables[0].unit=undefined;return p;},p=>{p.variables[0].formDefinitionHash='bad';return p;}])assert.throws(()=>buildT17Report(run(),basis,'合成报告',change(structuredClone(presentation))),e=>e.code==='REPORT_SOURCE_INVALID');
});
test('new schema display labels preserve scientific punctuation safely instead of dropping its meaning',()=>{
 const p=structuredClone(presentation);p.variables[0].label='观察值 <阈值|`原样`>&';const b=buildT17Report(run(),basis,'合成报告',p);assert(b.contentMd.includes('观察值 &#60;阈值&#124;&#96;原样&#96;&#62;&amp;'));assert.equal(b.contentBlocks[0].presentation.variables[0].label,p.variables[0].label);
});
test('trusted schema derivation rejects source hash/type/unit/field/row mapping changes and handles duplicate safe labels',async()=>{
 const {deriveT17Presentation}=await import('./t17-report-presentation.mjs');const normalize=x=>structuredClone(x);
 assert.deepEqual(deriveT17Presentation(manifest,[form],normalize,digest),presentation);
 for(const mutate of [m=>m.variables[0].unit=null,m=>m.variables[0].valueType='boolean',m=>m.variables[0].fieldKey='absent',m=>m.rows[0].cells[0].source.formDefinitionHash='0'.repeat(64),m=>m.rows[0].cells.pop(),m=>m.rows[0].cells.push(m.rows[0].cells[0])]){const m=structuredClone(manifest);mutate(m);assert.throws(()=>deriveT17Presentation(m,[form],normalize,digest),e=>e.code==='REPORT_SOURCE_INVALID');}
 const changed=structuredClone(form);changed.schema.fields[0].label='伪造标签';assert.throws(()=>deriveT17Presentation(manifest,[changed],normalize,digest),e=>e.code==='REPORT_SOURCE_INVALID');
 const dup=structuredClone(form);dup.schema.fields[1].label=dup.schema.fields[0].label;const m=structuredClone(manifest);for(const c of m.rows[0].cells)c.source.formDefinitionHash=digest({schema:dup.schema,scoring:null});assert.equal(deriveT17Presentation(m,[dup],normalize,digest).variables[1].label,'观察值');
});
