import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
after(()=>server.close());
const {default:ConfirmDialog}=await server.ssrLoadModule('/pages/shared/ConfirmDialog.jsx');
const render=props=>renderToStaticMarkup(React.createElement(ConfirmDialog,{title:'发布成功',onConfirm(){},onCancel(){},...props},'已返回资讯与活动列表。'));

test('existing confirmation retains cancel and confirmation actions',()=>{
 const html=render({confirmLabel:'确认发布'});
 assert.equal((html.match(/<button\b/g)??[]).length,2);
 assert.match(html,/取消/);assert.match(html,/确认发布/);
});

test('completed operation feedback offers one acknowledgement without a cancel action',()=>{
 const html=render({acknowledgeOnly:true,confirmLabel:'知道了',danger:false});
 assert.equal((html.match(/<button\b/g)??[]).length,1);
 assert.match(html,/知道了/);assert.doesNotMatch(html,/取消/);
 assert.match(html,/aria-labelledby=/);assert.match(html,/aria-describedby=/);
});
