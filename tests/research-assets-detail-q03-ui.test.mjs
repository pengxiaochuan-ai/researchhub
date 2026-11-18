import {test,after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';import react from '@vitejs/plugin-react';
const server=await createServer({configFile:false,plugins:[react()],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});after(()=>server.close());
test('a restricted fixed asset directs the user to its same-page application, and connection content retains the original card inset',async()=>{
 const {default:View}=await server.ssrLoadModule('/pages/shared/ResearchAssetCatalogDetail.jsx');const asset={id:'asset',kind:'protocol',version:3,currentVersion:3,revision:11,state:'released',bodyAccess:'restricted',canActions:['read','versions','request_access'],family:'detail',metadata:{title:'合成方案',summary:'合成摘要'},versions:[{version:3}]};const props={asset,scope:{studyGroupId:'g',researchProjectId:'p'}};
 const h=renderToStaticMarkup(React.createElement(View,props));assert(!h.includes('请返回资产中心申请'));assert(h.includes('本页'));assert(h.includes('申请使用'));
 const related=renderToStaticMarkup(React.createElement(View,{...props,initialTab:3}));assert.match(related,/class="form-block asset-detail-connections"[^>]*><p role="status">正在读取引用与复用记录/);
});
