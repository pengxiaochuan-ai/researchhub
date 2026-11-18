import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
const known=value=>({value,status:'approved_public_indexed',scope:'CURRENT_HUB_APPROVED_PUBLIC_INDEXED'});
const metrics={registrations:known(2),publications:{value:null,status:'unverified_scope_or_entity'},guides:known(3),institutions:known(3),researchers:known(3)};
async function render(props={}){const {default:View}=await server.ssrLoadModule('/pages/shared/HubMetrics.jsx');return renderToStaticMarkup(React.createElement(View,{metrics,...props}));}
test('five original KPI cards consume real backend numbers and preserve order; uncertain papers stay unknown',async()=>{
 const html=await render();assert.equal((html.match(/class="hub-kpi"/g)??[]).length,5);
 assert(html.includes('<b>2<em>项</em></b>'));assert(html.includes('<b>3<em>份</em></b>'));
 assert(html.includes('论文去重与领域纳入待核验'));assert(html.includes('当前Hub已公开机构档案'));
 assert(html.indexOf('临床注册研究')<html.indexOf('研究论文'));assert(html.indexOf('指南与教材')<html.indexOf('研究机构'));
 assert(!html.includes('13<em>篇'));assert(!html.includes('同比'));
});
test('known zero differs from loading, failure, unverified and malformed statistics without stale numbers',async()=>{
 const zero=await render({metrics:{...metrics,registrations:known(0)}});assert(zero.includes('<b>0<em>项</em></b>'));
 for(const props of [{loading:true},{error:true},{metrics:null},{metrics:{...metrics,registrations:known(-1)}}]){
  const html=await render(props);assert(!html.includes('<b>2<em>项</em></b>'));
 }
 assert((await render({loading:true})).includes('正在读取统计'));
 assert((await render({error:true})).includes('读取失败，请重试'));
 for(const value of [NaN,Infinity,1.5,'2'])assert(!(await render({metrics:{...metrics,registrations:known(value)}})).includes('<em>项</em>'));
});
test('included publication count and pending scope cases use the existing paper card, not candidate totals',async()=>{
 const html=await render({metrics:{...metrics,publications:{...known(9),pendingVisibleCount:2}}});
 assert(html.includes('<b>9<em>篇</em></b>'));assert(html.includes('规则纳入 · 待核验2项'));
 assert.equal((html.match(/class="hub-kpi"/g)??[]).length,5);assert(!html.includes('13<em>篇'));
});
test('eleven confirmed papers with no pending cases keep the original card and clear the obsolete pending caption',async()=>{
 const html=await render({metrics:{...metrics,publications:{...known(11),pendingVisibleCount:0}}});
 assert(html.includes('<b>11<em>篇</em></b>'));assert(html.includes('按已确认领域规则纳入'));
 assert(!html.includes('待核验2项'));assert.equal((html.match(/class="hub-kpi"/g)??[]).length,5);
});
