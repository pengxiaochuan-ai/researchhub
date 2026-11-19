import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const server=await createServer({configFile:false,plugins:[react()],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});after(()=>server.close());
const asset={id:'asset1',kind:'protocol',version:2,currentVersion:2,revision:2,isHistorical:false,state:'draft',bodyAccess:'allowed',family:'detail',canEditTags:true,owner:{displayName:'合成科研人员'},metadata:{title:'合成方案',summary:'合成摘要',author:'合成作者',tags:['待核对']},contentMd:'合成方案正文',versions:[{version:2,createdAt:'2026-11-13T00:00:00Z'},{version:1,createdAt:'2026-11-12T00:00:00Z'}]};
async function render(extra={}){const{default:View}=await server.ssrLoadModule('/pages/shared/ResearchAssetCatalogDetail.jsx');return renderToStaticMarkup(React.createElement(View,{asset,scope:{studyGroupId:'g1',researchProjectId:'p1'},...extra}));}
test('A02 retains seven tabs and original sidebar order while tag action reflects actual writable fixed version',async()=>{
 const html=await render();for(const s of ['内容概览','版本历史','引用与复用','相关研究','评论与讨论','文件附件','变更记录','500px','待核对','资产编号'])assert(html.includes(s),s);
 assert.match(html,/<button>编辑标签/);assert(html.indexOf('AI 资产解读')<html.indexOf('相关资产推荐'));assert(html.indexOf('相关资产推荐')<html.indexOf('5. 复用此资产'));
 const old=await render({asset:{...asset,family:'catalog',canEditTags:false}});assert.match(old,/<button disabled="">编辑标签/);
});
test('version comparison and activity have distinct same-tab contents, never a copied version list',async()=>{
 assert((await render({initialTab:1})).includes('比较版本'));
 const html=await render({initialTab:6});assert(html.includes('固定版本真实变更记录'));assert(html.includes('正在读取变更记录'));assert(!html.includes('查看固定版本'));
});
test('an unavailable current read hides all private asset content instead of retaining a stale visible panel',async()=>{
 const html=await render({blocked:true});assert(!html.includes('合成方案正文'));assert(!html.includes('合成作者'));assert(html.includes('当前内容暂不可核对'));
});
test('read-only compatibility preserves the fixed body and versions while operation regions remain unavailable',async()=>{
 const readOnly={...asset,compatibilityReadOnly:true,canEditTags:false,canActions:['read','versions'],aiAvailability:'unavailable'};
 const html=await render({asset:readOnly});assert(html.includes('合成方案正文'));assert(html.includes('合成作者'));assert(html.includes('当前推荐暂不可核对'));assert(!html.includes('正在读取推荐'));assert(html.includes('内容概览'));assert(html.includes('文件附件'));
 const history=await render({asset:readOnly,initialTab:1});assert(history.includes('比较版本'));assert(history.includes('查看固定版本'));assert(!history.includes('当前内容暂不可核对，请重新读取'));
});
