import test,{after}from'node:test';
import assert from'node:assert/strict';
import React from'react';
import{renderToStaticMarkup}from'react-dom/server';
import{createServer}from'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
const{ClinicalRegistryFilters}=await vite.ssrLoadModule('/pages/c01/src/RealClinicalRegistries.jsx');
const options={studyType:['干预性研究'],disease:['抑郁症','轻度认知障碍'],intervention:['经皮耳迷走神经电刺激+艾司西酞普兰片','经皮耳穴非迷走神经电刺激']};
const props={query:'',filters:{studyType:'',disease:'抑郁症',intervention:options.intervention[0]},options,onQuery:()=>{},onFilter:()=>{},onReset:()=>{},disabled:false};
test('phase-one four selects stay in order; only three enable and literal options retain original control width',()=>{
 assert.equal(typeof ClinicalRegistryFilters,'function');
 const html=renderToStaticMarkup(React.createElement(ClinicalRegistryFilters,props));
 assert.equal((html.match(/<select/g)||[]).length,4);assert.equal((html.match(/<select[^>]*disabled=""/g)||[]).length,1);assert(!html.includes('招募'));
 assert.equal((html.match(/<button/g)||[]).length,1);assert.equal((html.match(/<input/g)||[]).length,1);
 assert(html.includes('aria-label="研究类型"'));assert(html.includes('aria-label="疾病"'));assert(html.includes('aria-label="干预方式"'));
 assert(html.includes('style="width:65px"'));assert(html.includes('title="'+options.intervention[0]+'"'));
 assert(html.includes('value="抑郁症" selected=""'));assert(!html.includes('value="预注册"'));
});
test('loading or failed current data disables all selectors without adding controls',()=>{
 const html=renderToStaticMarkup(React.createElement(ClinicalRegistryFilters,{...props,disabled:true}));
 assert.equal((html.match(/<select[^>]*disabled=""/g)||[]).length,4);
});
