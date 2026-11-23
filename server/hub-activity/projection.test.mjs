import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPublicActivity,readActivityQuery} from './projection.mjs';
const now=new Date('2026-11-23T08:00:00Z');
const row=(category,entityKey,at,extra={})=>({category,entityKey,title:'公开合成资料',timeStatus:'verified',firstPublicAt:at,proofRefs:['event:test'],...extra});
const project=records=>projectPublicActivity({records,now,limit:6});
test('Beijing day boundary and whole collection aggregation precede preview limit',()=>{
 const records=Array.from({length:70},(_,i)=>row('registration','r'+i,'2026-11-22T16:00:00Z'));
 records.push(row('registration','yesterday','2026-11-22T15:59:59Z'));
 const result=project(records);
 assert.equal(result.items[0].count,70);assert.equal(result.items[0].day,'2026-11-23');
 assert.equal(result.items[1].day,'2026-11-22');assert.equal(result.items[1].count,1);
});
test('unknown historic date and future event are never made into today',()=>{
 const result=project([row('researcher','unknown',null,{timeStatus:'historical_undated'}),row('researcher','future','2026-11-24T00:00:00Z')]);
 assert.deepEqual(result.items,[]);assert.equal(result.status,'partial');
});
test('same canonical identity is counted once at earliest evidenced public time',()=>{
 const result=project([row('publication','doi:10.1/a','2026-11-22T16:00:00Z'),row('publication','doi:10.1/a','2026-11-23T01:00:00Z')]);
 assert.equal(result.items.length,1);assert.equal(result.items[0].count,1);assert.equal(result.items[0].eventAt,'2026-11-22T16:00:00.000Z');
});
test('six categories have separate identities; platform titles are individual',()=>{
 const kinds=['registration','publication','guidance','organization','researcher','platform_content'];
 const records=kinds.map(k=>row(k,'same','2026-11-23T01:00:00Z',{title:k}));
 const result=project([...records,row('platform_content','second','2026-11-23T02:00:00Z',{title:'第二条公开资讯',href:'/pages/p011/?contentId=two'})]);
 assert.equal(result.items.length,6);assert.equal(result.items[0].title,'第二条公开资讯');
 assert.equal(result.items[0].href,'/pages/p011/?contentId=two');assert.equal(result.items[0].kind,'content');
 assert.ok(result.items.some(i=>i.category==='registration'&&i.title==='新增临床注册研究1项'));
});
test('public response contains neither proof refs nor entity keys nor raw extra data',()=>{
 const text=JSON.stringify(project([row('publication','private-internal-key','2026-11-23T01:00:00Z',{secret:'not-public'})]));
 for(const value of ['event:test','private-internal-key','not-public'])assert.equal(text.includes(value),false);
});
test('unverified date without proof cannot become verified just by a timestamp',()=>{
 assert.deepEqual(project([row('organization','o','2026-11-23T01:00:00Z',{proofRefs:[]})]).items,[]);
});
test('conflicting canonical metadata is excluded and visible as incomplete',()=>{
 const r=row('publication','paper','2026-11-23T01:00:00Z');
 const result=project([r,{...r,title:'different current title'}]);
 assert.deepEqual(result.items,[]);assert.equal(result.status,'partial');
});
test('links are only supplied for content and unsafe links are omitted',()=>{
 const result=project([row('platform_content','unsafe','2026-11-23T01:00:00Z',{href:'https://evil.example/'}),row('registration','r','2026-11-23T02:00:00Z',{href:'/pages/c01/'})]);
 assert.ok(result.items.every(r=>!r.href));
});
test('category failures and partial scope never turn into complete empty success',()=>{
 const result=projectPublicActivity({records:[],now,limit:4,categoryStatuses:{publication:{status:'unavailable',coverage:'unknown'}}});
 assert.equal(result.status,'partial');assert.equal(result.categoryStatuses.publication.status,'unavailable');
});
test('query is strict and exposes only approved preview sizes',()=>{
 assert.equal(readActivityQuery({}).limit,6);assert.equal(readActivityQuery({limit:'4'}).limit,4);
 for(const q of [{limit:'0'},{limit:['4']},{limit:'40'},{tenant:'other'},{limit:'4',cursor:'x'}])assert.throws(()=>readActivityQuery(q));
});
test('nonexistent calendar days cannot be normalized into another day',()=>{
 const result=project([row('registration','bad-date','2026-02-30T01:00:00Z')]);
 assert.deepEqual(result.items,[]);assert.equal(result.status,'partial');
});
