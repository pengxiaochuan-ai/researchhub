import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

test('account-entry visual reuses the original wheel without playback controls',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
 try{const {default:Visual}=await vite.ssrLoadModule('/pages/shared/LoginResearchVisual.jsx');
  const html=renderToStaticMarkup(React.createElement(Visual));
  assert.match(html,/hero-wheel-transparent\.png/);assert.match(html,/研究证据/);
  assert.doesNotMatch(html,/<button|暂停动画|播放动画|data-paused/);
  assert.doesNotMatch(html,/ls-story-network|LINGSHU RESEARCH COMMUNITY/);
 }finally{await vite.close();}
});
test('login, registration and password recovery select the shared visual; authentication components remain unchanged',()=>{
 const source=readFileSync(new URL('../pages/shared/PublicPages.jsx',import.meta.url),'utf8');
 assert.equal((source.match(/<LoginResearchVisual\/>/g)||[]).length,2);
 assert.doesNotMatch(source,/ls-story-network|LINGSHU RESEARCH COMMUNITY/);
 assert.match(source,/<LoginSession enterDemo=\{enterDemo\} returnTo=/);
});
