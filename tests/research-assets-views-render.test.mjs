import {test,after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';import react from '@vitejs/plugin-react';
import {readCatalogListLocation} from '../src/research-assets-catalog-session.js';
const server=await createServer({configFile:false,plugins:[react()],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});after(()=>server.close());
test('a failed page never labels blocked recommendations and trend as still loading',async()=>{
 const {AssetRecommendations,AssetTrend}=await server.ssrLoadModule('/pages/shared/ResearchAssetViews.jsx');
 for(const View of [AssetRecommendations,AssetTrend]){const html=renderToStaticMarkup(React.createElement(View,{blocked:true}));assert(!html.includes('正在读取'),html);assert(html.includes('当前内容不可用'));assert(!html.includes('引用 0'));}
});
test('collaboration distinguishes actual loading, failed or inaccessible reads, and a verified empty list',async()=>{
 const {default:Catalog}=await server.ssrLoadModule('/pages/shared/ResearchAssetCatalog.jsx'),route=readCatalogListLocation('?tab=collaborations&studyGroupId=g&researchProjectId=p');
 const render=state=>renderToStaticMarkup(React.createElement(Catalog,{state,route,returnTo:'/pages/a01/'}));
 assert(render({status:'loading'}).includes('正在核对当前用途申请'));
 for(const status of ['error','signed-out','choose-study']){const html=render({status,message:'服务暂不可用'});assert(!html.includes('正在核对当前用途申请'),status);assert(html.includes('当前内容不可用，请先处理页面提示。'),status);assert(!html.includes('暂无符合当前条件的用途申请'));}
 const empty={schemaVersion:'rh-asset-collaborations.v1',items:[],page:1,pageSize:20,total:0,counts:{all:0,sent:0,received:0,requested:0,pending:0}};
 const html=render({status:'ready',collaborations:empty});assert(html.includes('暂无符合当前条件的用途申请或许可'));assert(!html.includes('正在核对当前用途申请'));
});
