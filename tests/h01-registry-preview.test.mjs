import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {initialFive} from '../server/hub-sources/initial-five.mjs';
import {extractRegistryDetails} from '../server/hub-sources/registry-detail-contract.mjs';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
async function render(path,props){const {default:Component}=await server.ssrLoadModule(path);return renderToStaticMarkup(React.createElement(Component,props));}
const item={documentId:'rhed-'+'a'.repeat(40),title:'合成注册题名',externalKey:'ChiCTR2300073486',registrationSummaryStatus:'approved',registrationSummary:{registeredOn:{value:'2023-07-12'},leadInstitution:{value:'中国中医科学院针灸研究所'},registrationStatus:{value:'预注册'},researchStatus:'not_reported'}};
test('H01 original five-column table shows approved date/unit but keeps research progress unknown',async()=>{
 const html=await render('/pages/shared/HubRegistryPreview.jsx',{items:[item]});
 assert.equal((html.match(/<th>/g)??[]).length,5);assert(html.includes('2023-07-12'));assert(html.includes('中国中医科学院针灸研究所'));
 assert(html.includes('>未报告</td>'));assert(!html.includes('>预注册</td>'));assert(!html.includes('进行中'));assert(!html.includes('已完成'));
 assert(html.includes('/pages/c03/?documentId='+item.documentId));assert(html.includes('href="/pages/c01/"'));assert(html.includes('来源顺序'));
});
test('unapproved or failed snapshots never leak registration summary values or demo records',async()=>{
 for(const props of [{items:[{...item,registrationSummaryStatus:'pending_review'}]},{items:null,error:true},{items:[]}]){
  const html=await render('/pages/shared/HubRegistryPreview.jsx',props);
  assert(!html.includes('2023-07-12'));assert(!html.includes('中国中医科学院针灸研究所'));assert(!html.includes('>预注册</td>'));
 }
});
test('C03 and admin reuse the existing expandable provenance area for full new field positions',async()=>{
 const source=initialFive.find(x=>x.externalKey==='ChiCTR2300073486');
 const details={...extractRegistryDetails(readFileSync(new URL('../docs/'+source.fileName,import.meta.url)),source,{includeRegistration:true}),fileName:source.fileName,sourceSha256:source.expectedSha256,extractionVersion:2,reviewVersion:'synthetic'};
 const html=await render('/pages/shared/RegistryStructuredDetails.jsx',{details,section:'design'});
 assert(html.includes('2023-07-12'));assert(html.includes('中国中医科学院针灸研究所'));assert(html.includes('注册号状态'));assert(html.includes('>预注册</p>'));
 assert(html.includes('第 113 行'));assert(html.includes('第 538 行'));assert(html.includes('研究进度'));
 const legacy={...details,...extractRegistryDetails(readFileSync(new URL('../docs/'+source.fileName,import.meta.url)),source)};delete legacy.registration;
 assert(!(await render('/pages/shared/RegistryStructuredDetails.jsx',{details:legacy,section:'design'})).includes('2023-07-12'));
});
