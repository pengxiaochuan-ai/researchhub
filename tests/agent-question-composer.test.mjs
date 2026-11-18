import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({configFile:false,esbuild:{jsx:'automatic'},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
test('composer keeps over-limit input with an associated error instead of native truncation',async()=>{
 const {default:Composer}=await vite.ssrLoadModule('/pages/shared/AgentCommandComposer.jsx');
 const html=renderToStaticMarkup(React.createElement(Composer,{client:{},initialQuestion:'🧪'.repeat(4001)}));
 assert(!html.includes('maxLength=')&&!html.includes('maxlength='));assert(html.includes('🧪'.repeat(4001)));
 assert(html.includes('aria-invalid="true"'));assert(html.includes('aria-describedby="hub-agent-question-error"'));assert(html.includes('role="alert"'));assert(html.includes('4000'));assert.match(html,/<button[^>]*disabled[^>]*>发送/);
 const normal=renderToStaticMarkup(React.createElement(Composer,{client:{},initialQuestion:'科研问题'.repeat(60)}));assert(!normal.includes('role="alert"'));assert(!normal.includes('aria-invalid="true"'));assert(!normal.match(/<button[^>]*disabled[^>]*>发送/));
 const recovering=renderToStaticMarkup(React.createElement(Composer,{client:{},initialQuestion:'保留问题',unavailable:true,inputUnavailable:false}));assert(!recovering.match(/<textarea[^>]*disabled/));assert.match(recovering,/<button[^>]*disabled[^>]*>发送/);
 const denied=renderToStaticMarkup(React.createElement(Composer,{client:{},paused:true,unavailable:true,inputUnavailable:false}));assert.match(denied,/<textarea[^>]*disabled/);
});
