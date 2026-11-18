import test from 'node:test';import assert from 'node:assert/strict';
import {mediaSourceAllowed} from '../server/ai-agent/session-media-origin.mjs';
import {createKnowledgeClient} from '../src/knowledge-session.js';
const origin='http://127.0.0.1:19501',sid='synthetic-session';
const req=(suffix='',type='application/json')=>({method:'POST',originalUrl:`/api/sessions/${sid}/media-uploads${suffix}`,socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:19502',origin:'http://127.0.0.1',referer:origin+'/pages/ai01/','content-type':type,'sec-fetch-site':'same-origin','sec-fetch-mode':'same-origin','sec-fetch-dest':'empty','x-researchhub-request':'session-media-v1'}});
test('local video accepts only fully proven port-stripped same-origin requests and retains exact origin',()=>{
 assert(mediaSourceAllowed({...req(),headers:{...req().headers,origin}}));assert(mediaSourceAllowed(req()));
 assert(mediaSourceAllowed(req('/12345678-1234-4234-a234-123456789012/chunks/0','application/octet-stream')));
 for(const [key,value]of [['origin','null'],['origin','http://127.0.0.1:80'],['origin','http://127.0.0.1:19502'],['origin','http://localhost:19501'],['origin','https://evil.test'],['host','evil.test'],['referer',origin+'@evil.test/'],['referer','http://127.0.0.1:19502/'],['sec-fetch-site','same-site'],['sec-fetch-site','cross-site'],['sec-fetch-mode','cors'],['sec-fetch-dest','document'],['x-researchhub-request','session-v1'],['content-type','text/plain'],['forwarded',''],['x-forwarded-host','127.0.0.1:19501']])assert(!mediaSourceAllowed({...req(),headers:{...req().headers,[key]:value}}),key+'='+value);
 for(const key of ['origin','referer','sec-fetch-site','sec-fetch-mode','sec-fetch-dest','x-researchhub-request']){const q=req();delete q.headers[key];assert(!mediaSourceAllowed(q),key);}
 assert(!mediaSourceAllowed({...req(),socket:{remoteAddress:'192.168.0.1'}}));assert(!mediaSourceAllowed({...req(),originalUrl:'/api/sessions/s/knowledge-messages'}));assert(!mediaSourceAllowed({...req(),originalUrl:req().originalUrl+'?path=x'}));
});
test('a rejected or unknown chunk never advances acknowledged progress or retries itself',async()=>{
 for(const status of [403,503,'network']){
  let calls=0;const progress=[],api=createKnowledgeClient({scope:()=>({studyGroupId:'g',researchProjectId:'p'}),fetchImpl:async()=>{calls++;if(status==='network')throw Error('synthetic disconnect');return new Response('{"code":"MEDIA_ORIGIN_REJECTED","message":"来源核验失败"}',{status,headers:{'Content-Type':'application/json'}});}});
  await assert.rejects(api.upload(`/sessions/${sid}/media-uploads/12345678-1234-4234-a234-123456789012/chunks/0`,new Blob(['synthetic']),{contentType:'application/octet-stream',onProgress:x=>progress.push(x)}));assert.equal(calls,1);assert.deepEqual(progress,[]);
 }
});
test('only media mutations get the dedicated same-origin proof; binary chunks use bounded fetch and acknowledged progress',async()=>{
 const calls=[],progress=[],scope=()=>({studyGroupId:'g',researchProjectId:'p'}),api=createKnowledgeClient({scope,fetchImpl:async(url,init)=>{calls.push({url,init});return new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}});}});
 await api.post(`/sessions/${sid}/media-uploads`,{});assert.equal(calls[0].init.mode,'same-origin');assert.equal(calls[0].init.headers['X-ResearchHub-Request'],'session-media-v1');
 const path=`/sessions/${sid}/media-uploads/12345678-1234-4234-a234-123456789012/chunks/0`,blob=new Blob(['synthetic']);await api.upload(path,blob,{contentType:'application/octet-stream',onProgress:x=>progress.push(x)});
 assert.equal(calls[1].init.body,blob);assert.equal(calls[1].init.mode,'same-origin');assert.equal(calls[1].init.redirect,'error');assert.equal(calls[1].init.credentials,'same-origin');assert.equal(calls[1].init.headers['X-ResearchHub-Request'],'session-media-v1');assert.equal(progress.at(-1).loaded,blob.size);
 await api.post('/sessions/hub-source',{});assert.equal(calls[2].init.headers['X-ResearchHub-Request'],undefined);assert.equal(calls[2].init.mode,undefined);
});
