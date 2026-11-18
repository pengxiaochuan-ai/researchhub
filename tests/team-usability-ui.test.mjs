import test,{after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import{renderToStaticMarkup}from'react-dom/server';import{createServer}from'vite';import{fileURLToPath}from'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
test('default new member starts with name/role, existing search is optional and archive explanation is not repeated',async()=>{
 const{TeamFields}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');const html=render(TeamFields,{data:{name:'甲',directions:[],members:[{key:'a',name:'乙',role:'lead',rank:'',organization:null}],evidence:[]},client:{},onChange:()=>{}});
 assert(html.includes('选择已有研究者'));assert(html.includes('<details'));assert(!html.includes('已有机构资料只读'));assert(html.includes('人员1姓名'));
});
test('removed evidence workflow exposes no source picker or redundant selection',async()=>{
 const{TeamFields}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');const html=render(TeamFields,{data:{name:'甲',directions:[],members:[],evidence:[]},client:{},onChange:()=>{}});
 assert(!html.includes('aria-label="选择资料"'));assert(!html.includes('请选择已有获准资料'));assert(!html.includes('补充资料依据（选填）'));
});
test('scope and optional review note are inline, public confirmation is brief and does not repeat the form',async()=>{
 const{TeamReviewContent,TeamReviewControls}=await server.ssrLoadModule('/pages/shared/TeamReviewDialog.jsx');
 const controls=render(TeamReviewControls,{reason:'',audience:'tenant',onReason:()=>{},onAudience:()=>{}});
 assert(controls.includes('审核展示范围'));assert(controls.includes('审核备注（选填）'));assert(!controls.includes('required=""'));assert(!controls.includes('核实说明'));
 const html=render(TeamReviewContent,{preview:{data:{name:'甲'},changes:[]}});
 assert(html.includes('甲'));assert(html.includes('未登录访客'));assert(!html.includes('<select'));assert(!html.includes('<textarea'));assert(!html.includes('拟展示内容'));assert(!html.includes('type="checkbox"'));
});
test('manual method keeps the three original sections and does not demand external search or per-fact selections',async()=>{
 const {TeamFields}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');const html=render(TeamFields,{data:{name:'甲',directions:[],members:[],evidence:[],verificationMethod:'administrator'},client:{},onChange:()=>{}});
 assert(!html.includes('aria-label="资料核实方式"'));assert(!html.includes('补充资料依据（选填）'));assert(!html.includes('资料题名检索'));assert(!html.includes('type="checkbox"'));assert(!html.includes('待补材料说明'));assert(html.includes('负责人和成员'));assert(html.includes('3. 核实与审核'));
});
