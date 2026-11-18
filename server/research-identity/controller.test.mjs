import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIdentityRequest,identityRoute} from './controller.mjs';
const req=(method='GET',query='')=>({method,originalUrl:'/api/account-access/research-profile'+query,headers:{host:'127.0.0.1:19501',origin:'http://127.0.0.1:19501','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},user:{accountId:'self'}});
test('local identity routes reject foreign scope, duplicate and unknown queries',()=>{
  assert.equal(validateIdentityRequest(req()).user.accountId,'self');
  for(const q of ['?accountId=other','?tenantId=t','?baseVersion=0','?x=1'])assert.throws(()=>validateIdentityRequest(req('GET',q)),{status:400});
  const receipt=req('GET','?baseVersion=0');assert.equal(validateIdentityRequest(receipt,undefined,true).baseVersion,0);
  for(const q of ['?baseVersion=0&baseVersion=0','?baseVersion=-1','?baseVersion=1.5','?baseVersion=1&accountId=x',''])assert.throws(()=>validateIdentityRequest(req('GET',q),undefined,true),{status:400});
});
test('only exact scoped JSON body parser and loopback origins are allowed',()=>{
  assert.ok(identityRoute('/api/account-access/research-profile'));
  assert.ok(identityRoute('/api/account-access/research-profile/establishments'));
  assert.equal(identityRoute('/api/account-access/profile'),false);
  assert.equal(identityRoute('/api/account-access/research-profile-unsafe'),false);
  for(const modify of [r=>r.headers.origin='https://evil.test',r=>r.headers.host='evil.test',r=>r.headers.forwarded='host=evil.test',r=>r.socket.remoteAddress='10.0.0.1',r=>r.headers['content-type']='text/plain']){const r=req('PATCH');modify(r);assert.throws(()=>validateIdentityRequest(r,{}),{status:403});}
  assert.doesNotThrow(()=>validateIdentityRequest(req('PATCH'),{text:'a'.repeat(18000)}));
  assert.throws(()=>validateIdentityRequest(req('PATCH'),{text:'a'.repeat(49152)}),{status:413});
});
