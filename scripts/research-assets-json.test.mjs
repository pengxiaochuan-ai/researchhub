import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAssetJson} from './research-assets-json.mjs';
test('asset JSON rejects duplicate keys at every depth including equivalent escaped names',()=>{
 for(const text of ['{"kind":"protocol","kind":"dataset"}','{"metadata":{"title":"a","title":"b"}}','{"items":[{"q":1,"\\u0071":2}]}','{"policy":{"x":{"x":1,"x":2}}}'])assert.throws(()=>parseAssetJson(Buffer.from(text)),e=>e.status===400);
});
test('strings containing JSON examples and repeated names in different objects remain ordinary content',()=>{
 const value={contentMd:'例子：{"q":1,"q":2}\n路径 \\a\\b',items:[{q:1},{q:2}],metadata:{title:'原创合成'}};
 assert.deepEqual(parseAssetJson(Buffer.from(JSON.stringify(value))),value);
});
test('wrong root, malformed JSON, invalid UTF8, oversized and excessive nesting fail at the boundary',()=>{
 for(const text of ['[]','null','true','{','{"x":NaN}','{"nested":'+ '['.repeat(33)+'0'+']'.repeat(33)+'}'])assert.throws(()=>parseAssetJson(Buffer.from(text)),e=>e.status===400);
 assert.throws(()=>parseAssetJson(Buffer.from([255])),e=>e.status===400);assert.throws(()=>parseAssetJson(Buffer.alloc(512*1024+1,32)),e=>e.status===413);
});
