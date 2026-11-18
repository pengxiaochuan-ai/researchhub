import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {assetRegistrationDraft} from '../src/research-assets-registration.js';
const server=await createServer({configFile:false,plugins:[react()],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});after(()=>server.close());
const user={accountId:'owner',displayName:'原创作者'},model={open:true,phase:'editing',dirty:false,draft:assetRegistrationDraft(user),options:{actors:[{accountId:'owner',displayName:'原创作者',isSelf:true},{accountId:'admin',displayName:'管理员',isSelf:false}],ownAssets:[],sourcesStatus:'ready',sources:[],uploadsStatus:'ready',pendingUploads:[]},fields:{}};
const handlers={onChange:()=>{},onSource:()=>{},onFile:()=>{},onSave:()=>{},onLookup:()=>{},onClose:()=>{},onDiscard:()=>{}};
test('registration reuses app dialog with visible labels, source choices and fixed draft meaning, not developer inputs',async()=>{
 const {default:View}=await server.ssrLoadModule('/pages/shared/ResearchAssetRegistrationDialog.jsx');
 const html=renderToStaticMarkup(React.createElement(View,{model,...handlers}));
 for(const label of ['ui-confirm-dialog','登记资产','题名','摘要','用途','适用限制','作者','研究领域','内容来源','TXT／Markdown文件','已审核资料','手工整理','来源与用途依据','审核后允许发现摘要的人','保存草稿'])assert(html.includes(label),label);
 assert(html.includes('type="file"'));assert(html.includes('accept=".txt,.md,text/plain,text/markdown"'));
 for(const token of ['requestKey','ownerAccountId','storageKey','5元','本轮开发','接口接线'])assert(!html.includes(token),token);
 const manual=renderToStaticMarkup(React.createElement(View,{model:{...model,draft:{...model.draft,kind:'analysis',mode:'manual',contentMd:'原始方法'}},...handlers}));
 assert(manual.includes('方法说明'));assert(manual.includes('不代表已执行结果'));assert(manual.includes('原始方法'));assert(manual.includes('asset-registration-reading'));
});
test('unknown save has one explicit lookup action, frozen input, visible error and no fake success',async()=>{
 const {default:View}=await server.ssrLoadModule('/pages/shared/ResearchAssetRegistrationDialog.jsx');
 const html=renderToStaticMarkup(React.createElement(View,{model:{...model,phase:'unknown',message:'保存结果尚未确认，输入已保留。',dirty:true},...handlers}));
 assert(html.includes('核对保存结果'));assert(html.includes('role="alert"'));assert.match(html,/<fieldset disabled=""/);assert(!html.includes('已保存为私有草稿'));
 assert(!html.includes('放弃输入'));
 const recovered=renderToStaticMarkup(React.createElement(View,{model:{...model,phase:'retryable',dirty:true},...handlers}));assert(recovered.includes('原内容重试'));assert(recovered.includes('放弃输入'));
 const invalid=renderToStaticMarkup(React.createElement(View,{model:{...model,fields:{title:'请填写题名'},message:'请先补齐'},...handlers}));
 assert(invalid.includes('aria-invalid="true"'));assert(invalid.includes('aria-describedby="asset-registration-title-error"'));assert(invalid.includes('id="asset-registration-title-error"'));
});
test('registration unavailable state hides protected text while retaining the caller model and disabling save',async()=>{
 const {default:useRegistration}=await server.ssrLoadModule('/pages/shared/useAssetRegistration.jsx');
 function Probe(){return useRegistration({current:{ready:false,user:null,scope:null},apiFactory:()=>assert.fail(),onSaved:()=>{}}).dialog;}
 assert.equal(renderToStaticMarkup(React.createElement(Probe)),'');
 const {default:View}=await server.ssrLoadModule('/pages/shared/ResearchAssetRegistrationDialog.jsx');const html=renderToStaticMarkup(React.createElement(View,{model:{...model,draft:{...model.draft,mode:'manual',contentMd:'保留未保存正文'}},unavailable:true,...handlers}));
 assert(!html.includes('保留未保存正文'));assert(html.includes('当前资产状态未核对'));assert.match(html,/<button[^>]*disabled=""[^>]*>保存草稿<\/button>/);
});
