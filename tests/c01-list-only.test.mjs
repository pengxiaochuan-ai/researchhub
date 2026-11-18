import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const vite=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>vite.close());
const {RealClinicalRegistries}=await vite.ssrLoadModule('/pages/c01/src/RealClinicalRegistries.jsx');
const {ViewTabs}=await vite.ssrLoadModule('/pages/c01/src/chrome.jsx');
const render=(component,props={})=>renderToStaticMarkup(React.createElement(component,props));
test('real C01 always opens the original eleven-column list, including old map and trend fragments',()=>{
 const old=globalThis.location;
 try{for(const hash of ['', '#map','#trend']){
  globalThis.location={hash};const html=render(RealClinicalRegistries);
  assert(!html.includes('研究分布地图'));assert(!html.includes('趋势分析'));
  assert(html.includes('研究列表'));assert(html.includes('搜索当前获准来源'));assert(html.includes('重置'));
  assert.equal((html.match(/<th(?:\s|>)/g)||[]).length,11);
  assert.equal((html.match(/<select/g)||[]).length,4);
 }}finally{if(old===undefined)delete globalThis.location;else globalThis.location=old;}
});
test('explicit demo has only the original list tab even if passed a historical view',()=>{
 for(const view of ['list','map','trend']){
  const html=render(ViewTabs,{view,onChange:()=>{}});
  assert(!html.includes('研究分布地图'));assert(!html.includes('趋势分析'));
  assert.equal((html.match(/role="tab"/g)||[]).length,1);
  assert(html.includes('aria-selected="true"'));assert(html.includes('研究列表'));
 }
});
test('actual C01 entry normalizes initial and successive deferred hashes, preserves query and leaves unknown fragments alone',()=>{
 const source=readFileSync(new URL('../pages/c01/src/main.jsx',import.meta.url),'utf8');
 const start=source.indexOf('function normalizeDeferredView()'),end=source.indexOf('createRoot(document');
 assert(start>=0&&end>start);
 const calls=[],listeners={};
 const location={pathname:'/pages/c01/',search:'?q=%E6%8A%91%E9%83%81&check=a%2Bb',hash:'#map'};
 const window={location,addEventListener:(event,listener)=>{listeners[event]=listener;},history:{replaceState:(_state,_title,url)=>{calls.push(url);location.hash='';}}};
 runInNewContext(source.slice(start,end),{window});
 assert.deepEqual(calls,['/pages/c01/'+location.search]);
 assert.equal(typeof listeners.hashchange,'function');
 location.hash='#trend';listeners.hashchange();
 assert.equal(calls.length,2);assert.equal(calls[1],'/pages/c01/'+location.search);
 location.hash='#source-note';listeners.hashchange();
 assert.equal(calls.length,2);assert.equal(location.hash,'#source-note');
});
