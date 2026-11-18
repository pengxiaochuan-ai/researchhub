import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
const {ClinicalRegistryRow,RealClinicalRegistries}=await vite.ssrLoadModule('/pages/c01/src/RealClinicalRegistries.jsx');
const item={documentId:'rhed-'+'a'.repeat(40),title:'合成日期题名',sourceUpdatedOn:'2023-09-10',studySummaryStatus:'approved',studySummary:{registeredOn:{value:'2023-07-12'}}};
const render=item=>renderToStaticMarkup(React.createElement(ClinicalRegistryRow,{item}));
test('C01 original date cell labels registration and source update independently without a publication or capture claim',()=>{
 const html=render(item);assert.equal((html.match(/<td(?:\s|>)/g)||[]).length,11);
 assert(html.includes('注册：2023-07-12'));assert(html.includes('来源更新：2023-09-10'));
 assert(!html.includes('首次公示'));assert(!html.includes('2026-10-30'));
});
test('pending details hide registration but do not hide the approved bibliographic update date',()=>{
 const html=render({...item,studySummaryStatus:'pending_review'});
 assert(!html.includes('2023-07-12'));assert(html.includes('注册：未提供'));assert(html.includes('来源更新：2023-09-10'));
});
test('legacy or missing dates stay explicitly missing, with no date substitution',()=>{
 for(const current of [{...item,sourceUpdatedOn:null,studySummary:undefined},{...item,sourceUpdatedOn:undefined,studySummary:{}}]){
  const html=render(current);assert(html.includes('注册：未提供'));assert(html.includes('来源更新：未提供'));assert(!html.includes('2023-'));
 }
});
test('C01 header names registration rather than unverified first publication, and currentness is snapshot-limited',()=>{
 const html=renderToStaticMarkup(React.createElement(RealClinicalRegistries));
 assert(html.includes('注册日期 / 来源更新'));assert(!html.includes('首次公示'));assert(html.includes('不代表官网当前状态'));
});
