import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublicActivity,validatePublicActivity,activityDate} from '../src/public-activity.js';
const statuses=Object.fromEntries(['registration','publication','guidance','organization','researcher','platform_content'].map(key=>[key,{status:'ready',coverage:'complete',dateCoverage:'complete'}]));
const payload=()=>({scope:'CURRENT_HUB_APPROVED_PUBLIC_INDEXED',timezone:'Asia/Shanghai',status:'ready',calculatedAt:'2026-11-23T00:00:00Z',categoryStatuses:statuses,items:[{id:'daily-registration',category:'registration',kind:'aggregate',day:'2026-11-23',eventAt:'2026-11-22T16:00:00Z',title:'新增临床注册研究2项',summary:'涉及抑郁症',count:2}]});
test('public request is a bounded no-store anonymous GET independent of account',async()=>{
 let call;const data=await fetchPublicActivity({hubKey:'lingshu-xinyu',limit:4,fetchImpl:async(...args)=>{call=args;return{ok:true,json:async()=>payload()};}});
 assert.equal(data.items.length,1);assert.equal(call[0],'/api/hubs/lingshu-xinyu/public-activity?limit=4');assert.equal(call[1].credentials,'omit');assert.equal(call[1].cache,'no-store');assert.equal(call[1].method,'GET');
});
test('failure, malformed response and partial coverage are never relabelled as ready empty',async()=>{
 await assert.rejects(fetchPublicActivity({fetchImpl:async()=>({ok:false,status:503})}),/暂时无法读取/);
 assert.throws(()=>validatePublicActivity({...payload(),items:[{...payload().items[0],count:0}]}));
 assert.throws(()=>validatePublicActivity({...payload(),categoryStatuses:{}}));
 const partial={...payload(),status:'partial',items:[],categoryStatuses:{...statuses,guidance:{status:'ready',coverage:'partial',dateCoverage:'unknown'}}};assert.equal(validatePublicActivity(partial).status,'partial');
});
test('reject unsafe content links and a date inconsistent with Beijing event time',()=>{
 assert.throws(()=>validatePublicActivity({...payload(),items:[{...payload().items[0],kind:'content',category:'platform_content',href:'javascript:alert(1)'}]}));
 assert.throws(()=>validatePublicActivity({...payload(),items:[{...payload().items[0],day:'2026-11-22'}]}));
});
test('today is determined by server calculation time in Beijing rather than browser timezone',()=>{
 assert.equal(activityDate('2026-11-23','2026-11-22T16:00:00Z'),'今天');assert.equal(activityDate('2026-11-22','2026-11-22T16:00:00Z'),'2026-11-22');
});
test('aborted requests and invalid limits never continue with previous data',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(fetchPublicActivity({signal:controller.signal}));
 await assert.rejects(fetchPublicActivity({limit:100,fetchImpl:async()=>{throw Error('must not call');}}),/参数/);
});
