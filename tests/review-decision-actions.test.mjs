import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
const {ReviewDecisionActions}=await server.ssrLoadModule('/pages/shared/HubSourceWorkbench.jsx');
test('pending review has an unselected range and one disabled explicit confirmation, never defaults public',()=>{
  assert.equal(typeof ReviewDecisionActions,'function');
  const html=renderToStaticMarkup(React.createElement(ReviewDecisionActions,{disabled:false,status:'pending',onDecide:()=>{}}));
  assert.equal((html.match(/<button/g)||[]).length,1);assert.equal((html.match(/<select/g)||[]).length,1);
  assert.match(html,/<option value="" selected="">请选择可见范围<\/option>/);assert.match(html,/确认保存/);
  assert.match(html,/尚未选择范围/);assert.equal((html.match(/disabled=""/g)||[]).length,1);
  for(const name of ['公开页面与AI','仅租户内页面与AI','暂不放行'])assert.ok(html.includes(name));
  assert.ok(!html.includes('type="checkbox"'));assert.ok(!html.includes('role="dialog"'));
});
test('current saved decision is selected with its associated explanation; busy blocks both select and confirm',()=>{
  assert.equal(typeof ReviewDecisionActions,'function');
  const render=props=>renderToStaticMarkup(React.createElement(ReviewDecisionActions,{onDecide:()=>{},...props}));
  assert.equal((render({disabled:true,status:'pending'}).match(/disabled=""/g)||[]).length,2);
  assert.equal((render({disabled:false,status:'tenant'}).match(/disabled=""/g)||[]).length,1);
  for(const [value,text] of [['public','任何访客'],['tenant','已登录成员'],['withheld','不供AI检索']]){
    const html=render({disabled:false,status:value});assert.match(html,new RegExp('<option value="'+value+'" selected="">'));
    assert.ok(html.includes(text));assert.match(html,/aria-describedby=/);
  }
});
test('display-only is an explicit extra choice only for the server-approved clinical scope and has no extra controls',()=>{
  const render=props=>renderToStaticMarkup(React.createElement(ReviewDecisionActions,{disabled:false,onDecide:()=>{},...props}));
  const pending=render({status:'withheld',allowDisplayOnly:true});
  assert.match(pending,/仅更新公开展示（AI不变）/);
  assert.equal((pending.match(/<button/g)||[]).length,1);assert.equal((pending.match(/<select/g)||[]).length,1);
  const saved=render({status:'public_display',allowDisplayOnly:true});
  assert.match(saved,/<option value="public_display" selected="">/);assert.match(saved,/不会新增或修改AI/);
  assert(!render({status:'pending'}).includes('public_display'));
});
