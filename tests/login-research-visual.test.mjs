import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('account-entry visual reuses the original wheel without playback controls',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{const {default:Visual}=await vite.ssrLoadModule('/pages/shared/LoginResearchVisual.jsx');
  const html=renderToStaticMarkup(React.createElement(Visual));
  assert.match(html,/hero-wheel-transparent\.[a-f0-9]{16}\.webp/);assert.match(html,/研究证据/);
  assert.match(html,/width="1360" height="1156"/);
  assert.match(html,/--ls-login-story-background:url/);
  assert.match(html,/section-background\.[a-f0-9]{16}\.webp/);
  assert.doesNotMatch(html,/src="[^"]*\.png/);
  assert.doesNotMatch(html,/<button|暂停动画|播放动画|data-paused/);
  assert.doesNotMatch(html,/ls-story-network|LINGSHU RESEARCH COMMUNITY/);
 }finally{await vite.close();}
});
test('login, registration and password recovery select the shared visual; authentication components remain unchanged',()=>{
 const source=readFileSync(new URL('../pages/shared/PublicPages.jsx',import.meta.url),'utf8');
 assert.equal((source.match(/<LoginResearchVisual\/>/g)||[]).length,2);
 assert.doesNotMatch(source,/ls-story-network|LINGSHU RESEARCH COMMUNITY/);
 assert.match(source,/<LoginSession returnTo=/);
});

test('shared header renders the independently sized logo crop',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const {default:Header}=await vite.ssrLoadModule('/pages/shared/AccountPortalHeader.jsx');
  for(const page of ['p003','p004','p005','p007','p008','p009','p011']){
   const html=renderToStaticMarkup(React.createElement(Header,{page}));
   assert.match(html,/ref1-75-99-66-67\.[a-f0-9]{16}\.webp/);
   assert.match(html,/width="66" height="67"/);
   assert.doesNotMatch(html,/reference-1\.png/);
   assert.match(html,/aria-label="公共门户导航"/);
  }
 }finally{await vite.close();}
});

test('production login renders only real account entry actions',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
 try{
  const {default:Login}=await vite.ssrLoadModule('/pages/shared/LoginSession.jsx');
  const html=renderToStaticMarkup(React.createElement(Login));
  assert.doesNotMatch(html,/演示|enterDemo/);
  assert.match(html,/type="submit"[^>]*>登录</);
  for(const href of ['/pages/p004/','/pages/p005/','/pages/p008/'])assert(html.includes(href));
  assert.match(html,/autoComplete="current-password"|autocomplete="current-password"/);
 }finally{await vite.close();}
});
