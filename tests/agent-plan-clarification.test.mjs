import test,{after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
test('trusted planning clarification is visible in the original status position; internal failures stay private',async()=>{
 const {default:Messages}=await server.ssrLoadModule('/pages/shared/AgentMessages.jsx');
 const render=job=>renderToStaticMarkup(React.createElement(Messages,{messages:[{id:'u',role:'user',content:'我的检索问题'}],jobs:[{id:'j',status:'failed',userMessageId:'u',...job}]}));
 const html=render({errorCode:'HUB_LITERATURE_PLAN_CLARIFICATION',errorMessage:'希望限定哪类研究人群？'});assert(html.includes('希望限定哪类研究人群？'));assert(html.includes('问题已保留'));
 const privateHtml=render({errorCode:'INTERNAL_ERROR',errorMessage:'secret database stack'});assert(!privateHtml.includes('secret database'));assert(privateHtml.includes('未交付'));
 assert(!render({errorCode:'HUB_LITERATURE_PLAN_CLARIFICATION',errorMessage:'<script>bad</script>'}).includes('<script>'));
});
