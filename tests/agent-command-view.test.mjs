import test,{after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
const api=await import('../src/agent-command-view.js').catch(()=>({}));
const a={id:'a',text:'第一条真实问题',status:'waiting'},b={id:'b',text:'第二条真实问题',status:'waiting'};
test('idle FIFO head becomes the conversation message while later questions stay editable in the queue',()=>{
 assert.equal(typeof api.agentCommandView,'function');const items=[a,b],view=api.agentCommandView({items});assert.equal(view.primary,a);assert.deepEqual(view.waiting,[b]);assert.deepEqual(items,[a,b]);
 assert.deepEqual(api.agentCommandView({items:[]}),{primary:null,waiting:[]});
});
test('actual running work, pause and uncertainty never promote queued questions as current execution',()=>{
 assert.equal(typeof api.agentCommandView,'function');
 for(const state of [{items:[a,b],paused:true},{items:[a,b],uncertain:true},{items:[{id:'job',status:'queued'},a,b]},{items:[{id:'job',status:'processing'},a,b]}]){
  const view=api.agentCommandView(state);assert.equal(view.primary,null);assert.deepEqual(view.waiting,[a,b]);
 }
 assert.equal(api.agentCommandView({items:[a]},true).primary,null);assert.deepEqual(api.agentCommandView({items:[a],restricted:true}),{primary:null,waiting:[]});
});
test('clarifications remain actionable without blocking a later independent question, and editing remains in place',()=>{
 assert.equal(typeof api.agentCommandView,'function');const clarification={id:'c',status:'paused',pauseCode:'HUB_SKILL_CLARIFICATION'};
 const view=api.agentCommandView({items:[clarification,a,b],paused:false});assert.equal(view.primary,a);assert.deepEqual(view.waiting,[clarification,b]);
 assert.deepEqual(api.agentCommandView({items:[a,b]},false,'a'),{primary:null,waiting:[a,b]});
});
const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
test('acknowledged pending question is rendered once in the thread, with no editor or duplicate stored message',async()=>{
 const mod=await server.ssrLoadModule('/pages/shared/AgentPendingMessage.jsx').catch(()=>({}));assert.equal(typeof mod.default,'function');
 const render=props=>renderToStaticMarkup(React.createElement(mod.default,props));
 const html=render({command:a});assert(html.includes('第一条真实问题'));assert(html.includes('正在处理'));assert(!html.includes('<button'));assert(!html.includes('<dialog'));
 assert.equal(render({command:a,messages:[{id:'a',content:'第一条真实问题'}]}),'');assert.equal(render({command:null}),'');
 assert(!render({command:{...a,text:'<script>bad()</script>'}}).includes('<script>'));
});
