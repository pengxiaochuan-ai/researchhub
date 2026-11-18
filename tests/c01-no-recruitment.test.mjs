import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
const {RealClinicalRegistries,ClinicalRegistryRow,ClinicalRegistryFilters}=await vite.ssrLoadModule('/pages/c01/src/RealClinicalRegistries.jsx');
const {FILTERS,COLUMNS,FilterBar,EMPTY_FILTERS}=await vite.ssrLoadModule('/pages/c01/src/chrome.jsx');
const {MapView}=await vite.ssrLoadModule('/pages/c02/src/main.jsx');
const render=(component,props={})=>renderToStaticMarkup(React.createElement(component,props));
test('phase-one real list has eleven aligned columns and no recruitment control or promise',()=>{
 const html=render(RealClinicalRegistries);
 assert(!html.includes('招募'));assert.equal((html.match(/<th(?:\s|>)/g)||[]).length,11);
 assert(html.includes('研究状态'));assert(html.includes('注册日期 / 来源更新'));
 const row=render(ClinicalRegistryRow,{item:{documentId:'rhed-'+'a'.repeat(40),title:'具名合成来源',sourceUpdatedOn:'2023-09-10',studySummaryStatus:'approved',studySummary:{registeredOn:{value:'2023-07-12'}}}});
 assert.equal((row.match(/<td(?:\s|>)/g)||[]).length,11);assert(row.includes('注册：2023-07-12'));assert(row.includes('来源更新：2023-09-10'));assert(row.includes('查看方案'));
});
test('phase-one real filters keep three available fields and the original unavailable research state',()=>{
 const html=render(ClinicalRegistryFilters,{query:'',filters:{studyType:'',disease:'',intervention:''},options:{studyType:[],disease:[],intervention:[]},disabled:false});
 assert(!html.includes('招募'));assert.equal((html.match(/<select/g)||[]).length,4);
 assert.equal((html.match(/<select[^>]*disabled=""/g)||[]).length,1);assert(html.includes('研究状态（暂不可用）'));
});
test('explicit demo filter and field settings cannot re-enable the deferred recruitment field',()=>{
 assert(!FILTERS.some(x=>x[0]==='recruit'));assert(!COLUMNS.some(x=>x[0]==='recruit'));
 const html=render(FilterBar,{query:'',filters:EMPTY_FILTERS,sort:'综合排序',hidden:new Set(),resultCount:0});assert(!html.includes('招募'));
});
test('C01 scoped demo map hides recruitment markers, modes, metrics and sections without changing the shared default',()=>{
 const registry={query:'',filters:EMPTY_FILTERS};
 const html=render(MapView,{registry,showRecruitment:false});
 assert(!html.includes('招募'));assert(!html.includes('class="recruit"'));assert(html.includes('国内研究机构分布'));assert(html.includes('地区分布明细'));
 assert(render(MapView,{registry}).includes('招募状态'));
});
