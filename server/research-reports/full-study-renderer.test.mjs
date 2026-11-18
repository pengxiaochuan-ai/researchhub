import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFullStudyRenderer} from './full-study-renderer.mjs';
import {buildFullStudyReport} from './full-study-content.mjs';
import {reportBundle} from './full-study-fixture.mjs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {buildT17Report} from '../research-analysis/t17-report-content.mjs';
import {run,basis,presentation} from '../research-analysis/t17-presentation-fixture.mjs';

const deps=runtimeDependencies(),legacy=deps.load('research-artifacts/research-artifact-export','renderResearchArtifact');
const {unzipSync,strFromU8}=createRequire(deps.require.resolve('docx'))('fflate');
const input=b=>({id:'rh-formal-report-unit',title:b.title,status:'released',typeKey:'analysis_report',versionNo:1,contentMd:b.contentMd,contentBlocks:b.contentBlocks,generatedAt:new Date('2026-11-13T00:00:00Z')});
test('private v2 business renderer creates compact real Word tables and preserves exact numeric text and provenance',async()=>{
 const bundle=reportBundle(),built=buildFullStudyReport(bundle,bundle.basis,'整课题合成报告'),render=createFullStudyRenderer(deps);
 const result=await render('docx',input(built)),zip=unzipSync(result.buffer),xml=strFromU8(zip['word/document.xml']);
 assert(result.buffer.length>0);assert.equal(result.mimeType,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
 assert.equal((xml.match(/<w:tbl>/g)||[]).length,built.contentBlocks[0].presentation.tables.length);
 const tables=xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g)||[];assert(tables.every(table=>(table.match(/<w:gridCol /g)||[]).length<=6));
 for(const text of [String(1/3),'不可估计','无有效值','不适用','特殊9','后续','基线',bundle.manifestHash])assert(xml.includes(text),text);
 assert.match(xml,/<w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);assert(Object.keys(zip).some(key=>key.startsWith('word/header')));assert(Object.keys(zip).some(key=>key.startsWith('word/footer')));
});
test('private v2 graph does not replace the legacy renderer and leaves old Word tables valid',async()=>{
 const render=createFullStudyRenderer(deps);assert.equal(deps.load('research-artifacts/research-artifact-export','renderResearchArtifact'),legacy);
 const old=buildT17Report(run(),basis,'旧合成报告',presentation),result=await render('docx',input(old)),xml=strFromU8(unzipSync(result.buffer)['word/document.xml']);
 assert.equal((xml.match(/<w:tbl>/g)||[]).length,6);assert(xml.includes('columns.v1.mean'));
});
test('v2 Word renderer refuses corrupted compact-table structure instead of rendering misleading paragraphs',async()=>{
 const bundle=reportBundle(),built=buildFullStudyReport(bundle,bundle.basis,'整课题合成报告'),render=createFullStudyRenderer(deps),value=input(built);
 await assert.rejects(render('docx',{...value,contentMd:value.contentMd.replace('| 组别/时点 |','| 篡改列 |')}),/FULL_STUDY_DOCX_INVALID/);
 const blocks=structuredClone(value.contentBlocks);blocks[0].presentation.tables[0].rows[0][2]='999';await assert.rejects(render('docx',{...value,contentBlocks:blocks}),/FULL_STUDY_DOCX_INVALID/);
});
