import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const server=await createServer({configFile:false,plugins:[react()],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>server.close());
const base={kind:'publication',bodyAccess:'allowed',contentMd:'# 正文标题\n\nPRIVATE_REPORT_BODY\n\n| 指标 | 结果 |\n| --- | --- |\n| 单位 | kg |\n\n[不可信链接](https://example.invalid/source)\n\n![不可信图片](https://example.invalid/image.png)',sourceKind:'artifact',metadata:{purpose:'用途的原文',limitations:'限制的原文',summary:'摘要原文'},sourceOrigin:{studyId:'rh-study-72203d59-4db8-4e74-9444-edff3b088b6d',reportId:'rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe',reportVersion:1}};
async function show(asset){const {default:View}=await server.ssrLoadModule('/pages/shared/AssetContentPreview.jsx');return renderToStaticMarkup(React.createElement(View,{asset}));}
test('all five kinds keep full use conditions exactly once before their body and retain metadata/summary afterwards',async()=>{
 for(const kind of ['publication','protocol','dataset','instrument','analysis']){
  const html=await show({...base,kind});assert(html.includes(({publication:'论文/报告',protocol:'研究方案',dataset:'数据集',instrument:'量表/工具',analysis:'分析结果'})[kind]));assert.equal(html.split('用途的原文').length-1,1);assert.equal(html.split('限制的原文').length-1,1);assert(html.indexOf('限制的原文')<html.indexOf('PRIVATE_REPORT_BODY'));assert(html.indexOf('PRIVATE_REPORT_BODY')<html.indexOf('核心信息'));assert(html.includes('摘要原文'));assert(html.includes('已有科研产物固定版本'));
 }
});
test('unauthorized preview never renders private markdown, does not invent source links, and retains full long restrictions',async()=>{
 const long='重要限制原文'.repeat(300),html=await show({...base,bodyAccess:'restricted',sourceOrigin:null,metadata:{...base.metadata,limitations:long}});
 assert(!html.includes('PRIVATE_REPORT_BODY'));assert(!html.includes('查看原方法报告'));assert(html.includes(long));assert(html.includes('当前仅获准查看摘要'));
});
test('verified report backlink stays separate from untrusted markdown URLs and images',async()=>{
 const html=await show(base);assert(html.includes('formalReports=1'));assert(html.includes('查看原方法报告'));assert(!html.includes('href="https://example.invalid'));assert(!html.includes('<img'));assert(html.includes('<table'));
});
