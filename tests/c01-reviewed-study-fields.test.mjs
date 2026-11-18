import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
const {ClinicalRegistryRow}=await vite.ssrLoadModule('/pages/c01/src/RealClinicalRegistries.jsx');
const item={documentId:'rhed-'+'a'.repeat(40),title:'合成题名',externalKey:'ChiCTR-synthetic',sourceName:'已核验来源',sourceUrl:'https://example.org/registry',sourceTargetCondition:'合成疾病',studySummaryStatus:'approved',studySummary:{studyType:{value:'干预性研究'},leadInstitution:{value:'中国中医科学院针灸研究所'},interventions:[{id:'arm-1',intervention:{value:'经皮耳迷走神经电刺激+艾司西酞普兰片'}},{id:'arm-2',intervention:{value:'经皮耳迷走神经电刺激+安慰剂'}}]}};
test('phase-one C01 row has eleven cells and complete literal interventions with unchanged links and unknown other fields',()=>{
 assert.equal(typeof ClinicalRegistryRow,'function');
 const html=renderToStaticMarkup(React.createElement(ClinicalRegistryRow,{item}));
 assert.equal((html.match(/<td(?:\s|>)/g)||[]).length,11);
 for(const value of ['干预性研究','中国中医科学院针灸研究所',...item.studySummary.interventions.map(x=>x.intervention.value)])assert(html.includes(value));
 assert(html.includes('并非全部研究中心'));assert(html.includes('/pages/c03/?documentId='+item.documentId));
 assert.equal((html.match(/>未提供<\/td>/g)||[]).length,2);
 assert(html.includes('注册：未提供'));assert(html.includes('来源更新：未提供'));
 assert(!html.includes('进行中'));assert(!html.includes('预注册'));assert(!html.includes('2023-'));
});
test('unapproved and legacy responses keep the three cells missing, never reuse supplied but unauthorized summary',()=>{
 for(const current of [{...item,studySummaryStatus:'pending_review'},{...item,studySummary:undefined,studySummaryStatus:undefined}]){
  const html=renderToStaticMarkup(React.createElement(ClinicalRegistryRow,{item:current}));
  assert(!html.includes('干预性研究'));assert(!html.includes('中国中医科学院针灸研究所'));assert(!html.includes('艾司西酞普兰片'));
 }
});
