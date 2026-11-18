import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {buildT17Report} from './t17-report-content.mjs';import {basis,run,presentation} from './t17-presentation-fixture.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});const {renderResearchArtifact}=require('./src/research-artifacts/research-artifact-export.ts');const {unzipSync,strFromU8}=createRequire(require.resolve('docx'))('fflate');
const input=b=>({id:'rh-formal-report-test',title:b.title,status:'released',typeKey:'analysis_report',versionNo:1,contentMd:b.contentMd,contentBlocks:b.contentBlocks,generatedAt:new Date('2026-11-12T00:00:00Z')});
test('only marked new formal DOCX has actual exact-width A4 Word tables and copies original values/appendix',async()=>{
 const b=buildT17Report(run(),basis,'合成报告',presentation),rendered=await renderResearchArtifact('docx',input(b)),zip=unzipSync(rendered.buffer),xml=strFromU8(zip['word/document.xml']);
 assert.match(xml,/<w:tbl>/);assert.match(xml,/<w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);assert.match(xml,/<w:tblW w:type="dxa" w:w="9026"\/>/);assert.match(xml,/<w:gridCol w:w="4513"\/>/);assert.match(xml,/<w:tcW w:type="dxa" w:w="4513"\/>/);for(const text of ['观察值','选填观察值','未声明','不可估计','columns.v1.mean','columns.v2.sampleStdDev','columns.v3.falseCount',basis.manifestHash])assert(xml.includes(text));assert(strFromU8(zip['word/styles.xml']).includes('Hiragino Sans GB'));assert.doesNotMatch(xml,/\| 指标 \|/);assert(Object.keys(zip).some(k=>k.startsWith('word/header')));assert(Object.keys(zip).some(k=>k.startsWith('word/footer')));
});
test('legacy formal and unrelated artifacts retain plain-paragraph renderer',async()=>{
 const legacy=buildT17Report(run(),basis,'合成报告');for(const i of [input(legacy),{...input(legacy),typeKey:'other',contentBlocks:[{type:'formal_analysis',presentation}]}]){const z=unzipSync((await renderResearchArtifact('docx',i)).buffer);assert.doesNotMatch(strFromU8(z['word/document.xml']),/<w:tbl>/);}
});
test('marked controlled DOCX rejects malformed table instead of silently producing a misleading paragraph',async()=>{
 const b=buildT17Report(run(),basis,'合成报告',presentation);await assert.rejects(()=>renderResearchArtifact('docx',{...input(b),contentMd:b.contentMd.replace('| 指标 | 结果 |','| 指标 | 结果 | 多余 |')}),/FORMAL_REPORT_DOCX_INVALID/);
});
test('new Word heading preserves escaped scientific label characters without Markdown interpretation',async()=>{
 const p=structuredClone(presentation);p.variables[0].label='观察值 <阈值|`原样`>&';const b=buildT17Report(run(),basis,'合成报告',p),z=unzipSync((await renderResearchArtifact('docx',input(b))).buffer),xml=strFromU8(z['word/document.xml']);assert(xml.includes('观察值 &lt;阈值|`原样`&gt;&amp;'));
});
