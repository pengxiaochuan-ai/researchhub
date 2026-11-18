import test from 'node:test';import assert from 'node:assert/strict';
import {draftInput,validatePublication,publicView,eventPhase,safeUrl,contentCard} from './policy.mjs';
test('draft only needs a title; default members; deterministic summary and strict fields',()=>{
 const d=draftInput({title:'合成资讯',body:'第一段\n\n第二段'});assert.equal(d.audience,'members');assert.equal(d.summary,'第一段');
 assert.throws(()=>draftInput({title:'x',tenantId:'spoof'}));assert.throws(()=>validatePublication(d));
});
test('public projection never contains member resource metadata or rights/private revisions',()=>{
 const d=draftInput({title:'合成活动',body:'正文',source:'验收材料',rights:'仅用于合成软件验证',audience:'public',resources:[{label:'合成内部资料',url:'https://example.org/internal',audience:'members',rights:'仅成员软件验证'}]});
 validatePublication(d);const view=publicView({id:'one',...d,publishedAt:'2026-11-18T00:00:00Z'},false);assert.deepEqual(view.resources,[]);assert.equal('rights'in view,false);assert.equal(JSON.stringify(view).includes('internal'),false);
 const card=contentCard(view);assert.equal('body'in card,false);assert.equal('resources'in card,false);assert.equal('sourceUrl'in card,false);
});
test('event phases use server clock; unsafe links and invalid event ranges are rejected',()=>{
 assert.equal(eventPhase({startAt:'2026-11-18T01:00:00Z',endAt:'2026-11-18T02:00:00Z'},Date.parse('2026-11-18T02:00:00Z')),'past');
 for(const url of ['javascript:alert(1)','https://a.example/?token=secret','https://user:password@example.org/'])assert.throws(()=>safeUrl(url));
 assert.equal(safeUrl('https://example.org/document.pdf#page=5'),'https://example.org/document.pdf#page=5');assert.throws(()=>safeUrl('https://example.org/document#access_token=secret'));
 assert.throws(()=>draftInput({title:'x',type:'event',event:{startAt:'bad',endAt:'bad'}}));
 assert.throws(()=>draftInput({title:'x',type:'event',event:{startAt:'2026-02-31T09:00:00Z',endAt:'2026-03-04T10:00:00Z'}}));
});
