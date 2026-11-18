import test,{after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const vite=await createServer({configFile:false,cacheDir:mkdtempSync(join(tmpdir(),'rh-material-ssr-')),esbuild:{jsx:'automatic'},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
test('material list is task-focused and links to the actual scoped private document',async()=>{
 const {AgentMaterialsView}=await vite.ssrLoadModule('/pages/shared/AgentMaterials.jsx');
 const materials={items:[{id:'material',version:3,state:'ready',available:true,name:'Synthetic evidence',kbId:'base',docId:'doc'}],pending:[],uploading:false,error:'',nextCursor:null};
 const html=renderToStaticMarkup(React.createElement(AgentMaterialsView,{materials,scope:{studyGroupId:'group',researchProjectId:'project'}}));
 assert(html.includes('aria-label="本会话资料"'));assert(html.includes('已保存，可查看'));assert(html.includes('docId=doc'));assert(html.includes('kbId=base'));assert(!html.includes('SHA256')&&!html.includes('数据库')&&!html.includes('本轮授权'));
 const unknown=renderToStaticMarkup(React.createElement(AgentMaterialsView,{materials:{...materials,items:[],pending:['request-key']},scope:{}}));
 assert(unknown.includes('核对上传'));assert(!unknown.includes('request-key'));assert(!unknown.includes('重试上传'));
});
