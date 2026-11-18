import test from 'node:test';import assert from 'node:assert/strict';
import {assertMaterialUploadRetry} from '../src/session-material-recovery.js';
test('explicit retry retains its original request and cannot move to another session, actor or file family',()=>{
 const retry={key:'research-data-original',sessionId:'session',identity:'actor',client:{}},current={...retry},file={name:'synthetic.xlsx'};
 assert.equal(assertMaterialUploadRetry(retry,current,[file]),retry.key);
 for(const ctx of[{...current,identity:'other'},{...current,sessionId:'other'},{...current,client:{}}])assert.throws(()=>assertMaterialUploadRetry(retry,ctx,[file]));
 assert.throws(()=>assertMaterialUploadRetry(retry,current,[{name:'other.pdf'}]));assert.throws(()=>assertMaterialUploadRetry(retry,current,[file,file]));
 assert.equal(assertMaterialUploadRetry(null,current,[file]),null);
});
test('document recovery cannot turn into a video upload with a different idempotency protocol',()=>{
 const r={key:'material-original',sessionId:'s',identity:'a',client:{}},current={...r};
 for(const name of ['other.mp4','other.mov','other.webm','other.xlsx','other.exe'])assert.throws(()=>assertMaterialUploadRetry(r,current,[{name}]));
 for(const name of ['original.pdf','original.docx','original.txt','original.MD','original.markdown'])assert.equal(assertMaterialUploadRetry(r,current,[{name}]),r.key);
});
