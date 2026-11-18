import test from 'node:test';import assert from 'node:assert/strict';
import {assetDigest} from '../scripts/research-assets-registration-contract.mjs';
import {fragmentReport,searchReportFragments,assertReportFragmentsCurrent} from '../server/research-assets/report-ai-search.mjs';
const md='# 合成研究报告\n\n仅供合成软件验证。\n\n## 数据质量\n\n单位：条\n\n| 指标 | 结果 |\n| --- | --- |\n| 总数 | 3 |\n| 缺失数 | 0 |\n\n## 使用限制\n\n仅为合成材料，不作为临床结论。\n\n## 数据来源\n\n固定合成运行，不重新计算。';
test('fixed report fragments retain full tables, units, line locators and reproducible identifiers',()=>{
 const orphan='## 开始\n\n合成。';assert(fragmentReport(orphan,assetDigest(orphan))[0].headingPath.every(x=>typeof x==='string'));
 const p=fragmentReport(md,assetDigest(md));assert.deepEqual(p,fragmentReport(md,assetDigest(md)));
 const table=p.find(f=>f.kind==='table');assert(table.text.includes('单位：条'));assert(table.text.includes('| 缺失数 | 0 |'));assert(table.headingPath.includes('数据质量'));assert(table.startLine<table.endLine);
 for(const f of p){assert.equal(assetDigest(f.text),f.quoteHash);assert.equal(f.text,md.split('\n').slice(f.startLine-1,f.endLine).join('\n'));}
 assert.throws(()=>fragmentReport(md,'0'.repeat(64)));assert.throws(()=>fragmentReport('# report\n\n```\nincomplete',assetDigest('# report\n\n```\nincomplete')));
});
test('different keyword and natural questions select evidence; unknown efficacy never falls back to the entire report',()=>{
 const parts=fragmentReport(md,assetDigest(md));
 const a=searchReportFragments('请概括这份报告的数据完整性和使用限制，并引用原文',parts);assert(a.evidence.some(f=>f.kind==='table'));assert(a.evidence.some(f=>f.headingPath.includes('使用限制')));assert.equal(a.toolName,'asset_version_search');
 assert.equal(searchReportFragments('报告的数据完整性和使用限制是什么？',parts).status,'ready');
 assert.equal(searchReportFragments('报告的一年随访疗效是什么？',parts).status,'no_evidence');
 const b=searchReportFragments('缺失数',parts);assert.equal(b.evidence.length,1);assert.equal(b.evidence[0].kind,'table');
 const empty=searchReportFragments('一年随访疗效',parts);assert.equal(empty.status,'no_evidence');assert.deepEqual(empty.evidence,[]);
 const seed=searchReportFragments('这份报告',parts,{seedAsset:true});assert.equal(seed.toolName,'asset_fixed_version_read');assert.equal(seed.evidence.length,parts.length);
 assert.equal(searchReportFragments('这份报告',parts).status,'no_evidence');
});
test('bounds never silently cut table rows or unknown blocks; stale fragment identity is refused',()=>{
 const parts=fragmentReport(md,assetDigest(md));assert.throws(()=>searchReportFragments('缺失数',parts,{maxCharacters:20}));
 assert.throws(()=>assertReportFragmentsCurrent(parts,[{...parts[0],quoteHash:'0'.repeat(64)},...parts.slice(1)]));
 const giant=Array.from({length:9},(_,i)=>({id:'f'+i,kind:'paragraph',text:'合成'+i,quoteHash:assetDigest('合成'+i),headingPath:[],startLine:i+1,endLine:i+1}));assert.throws(()=>searchReportFragments('这份报告',giant,{seedAsset:true}));
});
test('unit captions adjoining explanatory prose or following a table remain in the same exact quote',()=>{
 for(const body of ['说明段落\n单位：mg\n| 指标 | 值 |\n| --- | --- |\n| 合成 | 1 |','| 指标 | 值 |\n| --- | --- |\n| 合成 | 1 |\n\n单位：mg']){
  const p=fragmentReport(body,assetDigest(body)),table=p.find(f=>f.kind==='table');assert(table.text.includes('单位：mg'));assert.equal(table.text,body.split('\n').slice(table.startLine-1,table.endLine).join('\n'));assert.equal(table.quoteHash,assetDigest(table.text));
 }
});
