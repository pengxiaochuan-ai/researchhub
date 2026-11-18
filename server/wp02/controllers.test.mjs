import test from 'node:test';import assert from 'node:assert/strict';
import {validateWp02Request} from './controllers.mjs';
const request={method:'POST',headers:{host:'127.0.0.1:19501',origin:'http://127.0.0.1:19501','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}};
test('write boundary rejects missing/foreign origin, host spoof, forwarded scope and oversized JSON',()=>{
 assert.equal(validateWp02Request(request,{email:'a@example.test'}).ip,'127.0.0.1');
 for(const headers of [{...request.headers,origin:undefined},{...request.headers,origin:'https://evil.invalid'},{...request.headers,host:'evil.invalid'},{...request.headers,'x-forwarded-host':'evil.invalid'}])assert.throws(()=>validateWp02Request({...request,headers},{}));
 assert.throws(()=>validateWp02Request(request,{text:'a'.repeat(16384)}),e=>e.status===413);
 assert.throws(()=>validateWp02Request({...request,headers:{...request.headers,'content-type':'text/plain'}},{}));
});
