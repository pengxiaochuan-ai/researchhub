import test from'node:test';import assert from'node:assert/strict';import{runtimeBodyKind}from'./body-policy.mjs';
test('multipart parsing is confined to existing bounded upload routes',()=>{
 assert.equal(runtimeBodyKind('POST','/api/knowledge/docs/import','multipart/form-data; boundary=synthetic'),'multipart');
 for(const [method,path,type]of [['PUT','/api/knowledge/docs/import','multipart/form-data; boundary=x'],['POST','/api/auth/login','multipart/form-data; boundary=x'],['POST','/api/knowledge/docs/import','multipart/form-data'],['POST','/api/knowledge/docs/import','application/octet-stream']])assert.equal(runtimeBodyKind(method,path,type),'rejected');
 assert.equal(runtimeBodyKind('PATCH','/api/knowledge/docs/id','application/json; charset=utf-8'),'json');
});
test('shared session material upload accepts multipart only on its exact POST route',()=>{
 assert.equal(runtimeBodyKind('POST','/api/sessions/session-1/materials','multipart/form-data; boundary=synthetic'),'multipart');
 for(const [method,path]of [['PUT','/api/sessions/s/materials'],['POST','/api/sessions/s/materials/receipts/key'],['POST','/api/sessions/s/commands'],['POST','/api/sessions/../materials']])assert.equal(runtimeBodyKind(method,path,'multipart/form-data; boundary=x'),'rejected');
});
