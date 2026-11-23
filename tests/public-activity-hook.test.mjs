import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,render} from './fixtures/media-component-runtime.mjs';
const bundle=await compile('PublicActivity.jsx',{'Components.jsx':"export const Button='button';",'public-activity.js':"export const activityDate=day=>day;export const fetchPublicActivity=options=>new Promise((resolve,reject)=>globalThis.__activityRequests.push({options,resolve,reject}));"});
const data=title=>({status:'ready',calculatedAt:'2026-11-23T00:00:00Z',items:[{id:'row',kind:'aggregate',day:'2026-11-23',title,summary:'核验摘要'}]});
test('changing Hub aborts prior read and late replies never replace the new scope',async()=>{
 globalThis.__activityRequests=[];const ui=render(bundle,'default',{hubKey:'first',limit:4});
 try{const old=__activityRequests[0];ui.update({hubKey:'second'});assert(old.options.signal.aborted);old.resolve(data('旧Hub'));await ui.flush();assert(!ui.text.includes('旧Hub'));assert(ui.text.includes('正在读取'));__activityRequests[1].resolve(data('新Hub'));await ui.flush();assert(ui.text.includes('新Hub'));}
 finally{ui.dispose();delete globalThis.__activityRequests;}
});
test('focus clears old contents, failure gives retry, retry reads current data',async()=>{
 globalThis.__activityRequests=[];const ui=render(bundle,'default',{hubKey:'first',limit:6});
 try{__activityRequests[0].resolve(data('已撤下的旧条目'));await ui.flush();assert(ui.text.includes('已撤下'));ui.focus();assert(!ui.text.includes('已撤下'));__activityRequests[1].reject(Error('network'));await ui.flush();assert(ui.text.includes('暂时无法读取'));assert(!ui.text.includes('暂无公开'));ui.click(/重试/);__activityRequests[2].resolve(data('恢复后的当前条目'));await ui.flush();assert(ui.text.includes('恢复后的当前条目'));}
 finally{ui.dispose();delete globalThis.__activityRequests;}
});
test('unmount aborts request and removes focus listener',()=>{
 globalThis.__activityRequests=[];const ui=render(bundle,'default',{limit:4});const request=__activityRequests[0];ui.dispose();assert(request.options.signal.aborted);ui.focus();assert.equal(__activityRequests.length,1);delete globalThis.__activityRequests;
});
