import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});after(()=>server.close());
const {PublicActivityList}=await server.ssrLoadModule('/pages/shared/PublicActivity.jsx');
const {default:PersonalOverview}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');
const {default:HubSourceCatalog}=await server.ssrLoadModule('/pages/shared/HubSourceCatalog.jsx');
const render=state=>renderToStaticMarkup(React.createElement(PublicActivityList,{state,onRetry(){}}));
test('loading, failed, partial and true empty each explain the actual state',()=>{
 assert.match(render({kind:'loading'}),/正在读取领域动态/);assert.match(render({kind:'error'}),/重试/);
 assert.match(render({kind:'ready',data:{status:'partial',items:[],calculatedAt:'2026-11-23T00:00:00Z'}}),/暂无可展示的新增动态/);
 assert.match(render({kind:'ready',data:{status:'ready',items:[],calculatedAt:'2026-11-23T00:00:00Z'}}),/暂无公开领域动态/);
});
test('aggregate rows do not invent date-list links; content links preserve actual titles',()=>{
 const html=render({kind:'ready',data:{status:'partial',calculatedAt:'2026-11-23T00:00:00Z',items:[{id:'a',kind:'aggregate',day:'2026-11-23',title:'新增研究论文23篇',summary:'涉及已核验研究方向'},{id:'b',kind:'content',day:'2026-11-22',title:'公开活动标题',summary:'内容摘要',href:'/pages/p011/?contentId=one'}]}});
 assert.match(html,/新增研究论文23篇/);assert.match(html,/今天/);assert.match(html,/部分动态暂时无法读取/);assert.match(html,/href="\/pages\/p011\/\?contentId=one"/);assert.equal((html.match(/href=/g)||[]).length,1);
});
test('P01 all action goes directly to H01 and H01 preserves the original paper catalog entry',()=>{
 const html=renderToStaticMarkup(React.createElement(PersonalOverview,{unverified:true,data:{profile:{tenantName:'合成Hub'},summary:{ownDraftCount:0,myOpenTaskCount:0},studyGroups:[],drafts:[],tasks:[],activity:[]}}));
 const region=html.split('class="hubNews"')[1].split('</section>')[0];assert.match(region,/href="\/pages\/h01\/">查看全部/);assert.match(region,/正在读取领域动态/);assert(!region.includes('个性化领域动态'));
 const hub=renderToStaticMarkup(React.createElement(HubSourceCatalog,{hubKey:'lingshu-xinyu'}));assert.match(hub,/href="\/pages\/e01\/">研究论文/);assert.match(hub,/领域动态/);assert(!hub.includes('section=updates'));
});
