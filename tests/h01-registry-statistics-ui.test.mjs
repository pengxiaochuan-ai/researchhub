import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});after(()=>server.close());
const {default:Panel}=await server.ssrLoadModule('/pages/shared/HubRegistryStatistics.jsx');
const render=props=>renderToStaticMarkup(React.createElement(Panel,props));
test('loading, unavailable and no approved records remain distinct, no old trend placeholder',()=>{
 assert(render({loading:true}).includes('正在读取注册统计'));
 assert(render({error:true}).includes('注册统计暂不可用'));
 assert(render({statistics:{total:0,dimensions:{year:{groups:[],missing:0}},records:[]}}).includes('暂无获准展示'));
});
test('annual published scope and counts appear without replacing dates or implying field-wide coverage',()=>{
 const html=render({statistics:{scope:'CURRENT_HUB_APPROVED_PUBLIC_INDEXED',total:3,dimensions:{year:{groups:[{label:'2023',count:2,cumulative:2,recordIds:['source']}],missing:1}},records:[]}});
 for(const value of ['2023','2 项','累计 2 项','未提供或待核对：1','非全领域总量','aria-expanded="false"'])assert(html.includes(value),value);
 assert.equal((html.match(/role="tab"/g)??[]).length,4);
 assert(!html.includes('全域分布'));
});
