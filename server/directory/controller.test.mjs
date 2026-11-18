import test from 'node:test';import assert from 'node:assert/strict';
import {directoryQuery,validateDirectoryRequest} from './controller.mjs';
const req=(query='',method='GET')=>({method,originalUrl:'/api/hubs/lingshu-xinyu/teams'+query,headers:{host:'127.0.0.1:19501',origin:'http://127.0.0.1:19501','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});
test('directory queries reject duplicate, unknown and foreign-scope fields before Express can flatten them',()=>{assert.deepEqual(directoryQuery(req('?q=针灸'),['q']),{q:'针灸'});for(const q of ['?q=a&q=b','?accountId=other','?tenantId=other'])assert.throws(()=>directoryQuery(req(q),['q']),{status:400});});
test('directory writes enforce local same-origin JSON and UTF8 size while reads remain anonymous',()=>{assert.doesNotThrow(()=>validateDirectoryRequest(req()));const r=req('','POST');assert.doesNotThrow(()=>validateDirectoryRequest(r,{}));r.headers.origin='https://evil.test';assert.throws(()=>validateDirectoryRequest(r,{}),{status:403});assert.throws(()=>validateDirectoryRequest(req('','POST'),{text:'测'.repeat(16384)}),{status:413});});
const browserWrite=()=>{const r=req('','POST');Object.assign(r.headers,{origin:'http://127.0.0.1',referer:'http://127.0.0.1:19501/pages/g02/?view=directory-review','sec-fetch-site':'same-origin','sec-fetch-mode':'same-origin','sec-fetch-dest':'empty','x-researchhub-request':'team-workspace-v1'});return r;};
test('team writes accept the observed port-stripped Origin only with complete independent browser same-origin proof',()=>{
 assert.doesNotThrow(()=>validateDirectoryRequest(browserWrite(),{},{teamWorkspaceWrite:true}));
 assert.throws(()=>validateDirectoryRequest(browserWrite(),{}),{status:403},'other consumers never opt in implicitly');
});
test('team compatibility cannot authorize cross-origin, incomplete, navigated or non-JSON requests',()=>{
 for(const [key,value]of [['origin','https://evil.test'],['origin','http://127.0.0.1:80'],['origin','null'],['origin',undefined],['referer','http://127.0.0.1/pages/g02/'],['referer','http://127.0.0.1:19503/pages/g02/'],['referer','http://127.0.0.1:19501.evil.test/'],['referer','bad-url'],['referer',undefined],['sec-fetch-site','same-site'],['sec-fetch-site','cross-site'],['sec-fetch-site',undefined],['sec-fetch-mode','cors'],['sec-fetch-mode','navigate'],['sec-fetch-mode',undefined],['sec-fetch-dest','document'],['sec-fetch-dest',undefined],['x-researchhub-request','other'],['x-researchhub-request',undefined],['content-type','text/plain'],['host','evil.test'],['x-forwarded-host','127.0.0.1:19501']]){
  const r=browserWrite();if(value===undefined)delete r.headers[key];else r.headers[key]=value;
  assert.throws(()=>validateDirectoryRequest(r,{},{teamWorkspaceWrite:true}),{status:403},key+': '+value);
 }
 const remote=browserWrite();remote.socket.remoteAddress='192.168.1.2';assert.throws(()=>validateDirectoryRequest(remote,{},{teamWorkspaceWrite:true}),{status:403});
 assert.throws(()=>validateDirectoryRequest(browserWrite(),{text:'测'.repeat(16384)},{teamWorkspaceWrite:true}),{status:413});
});
