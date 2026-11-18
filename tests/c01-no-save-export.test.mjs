import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
const {RealClinicalRegistries}=await vite.ssrLoadModule('/pages/c01/src/RealClinicalRegistries.jsx');
const {FilterBar,EMPTY_FILTERS}=await vite.ssrLoadModule('/pages/c01/src/chrome.jsx');
const render=(component,props={})=>renderToStaticMarkup(React.createElement(component,props));
const deferred=/保存检索|保存筛选|已保存筛选|导出/;
test('phase-one real C01 omits save/export entries while retaining search, reset, four filters and eleven columns',()=>{
 const html=render(RealClinicalRegistries);assert.doesNotMatch(html,deferred);
 assert(html.includes('搜索当前获准来源'));assert(html.includes('重置'));assert(html.includes('研究状态（暂不可用）'));
 assert.equal((html.match(/<select/g)||[]).length,4);assert.equal((html.match(/<th(?:\s|>)/g)||[]).length,11);
});
test('explicit demo has no save/export or fake saved state, but retains field settings, sorting and reset',()=>{
 for(const saved of [false,true]){
  const html=render(FilterBar,{query:'',filters:EMPTY_FILTERS,sort:'综合排序',hidden:new Set(),resultCount:0,saved});
  assert.doesNotMatch(html,deferred);for(const label of ['字段设置','排序','重置'])assert(html.includes(label));
 }
});
