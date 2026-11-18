import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {longHttpFetch} from './full-study-long-http.mjs';

async function local(t,handler){
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 return 'http://127.0.0.1:'+server.address().port;
}
test('delayed headers succeed within explicit deadline and preserve Response and separate cookies',async t=>{
 let posts=0,received='';
 const url=await local(t,(req,res)=>{posts++;assert.equal(req.method,'POST');assert.equal(req.headers['x-synthetic'],'only');req.setEncoding('utf8');req.on('data',chunk=>received+=chunk);req.on('end',()=>setTimeout(()=>{res.writeHead(201,{'content-type':'application/json','set-cookie':['a=one; HttpOnly','b=two; SameSite=Strict']});res.end(JSON.stringify({synthetic:true}));},80));});
 const result=await longHttpFetch(url,{method:'POST',headers:{'x-synthetic':'only'},body:'synthetic-body',timeoutMs:1000});
 assert(result instanceof Response);assert.equal(result.status,201);assert.equal(result.ok,true);assert.equal(result.headers.get('content-type'),'application/json');assert.deepEqual(result.headers.getSetCookie(),['a=one; HttpOnly','b=two; SameSite=Strict']);assert.deepEqual(await result.json(),{synthetic:true});assert.equal(posts,1);assert.equal(received,'synthetic-body');
});
test('short total deadline expires before response headers and never retries the POST',async t=>{
 let posts=0;const url=await local(t,(req,res)=>{posts++;req.resume();setTimeout(()=>res.end('{}'),120);});
 await assert.rejects(longHttpFetch(url,{method:'POST',body:'synthetic',timeoutMs:35}),e=>e.name==='TimeoutError');
 await new Promise(resolve=>setTimeout(resolve,150));assert.equal(posts,1);
});
test('deadline includes a stalled response body after headers',async t=>{
 let posts=0;const url=await local(t,(req,res)=>{posts++;req.resume();res.writeHead(200,{'content-type':'application/json'});res.write('{');});
 await assert.rejects(longHttpFetch(url,{method:'POST',body:'synthetic',timeoutMs:50}),e=>e.name==='TimeoutError');assert.equal(posts,1);
});
test('redirects are returned without sending a second request, and 204 has no body',async t=>{
 let calls=0;const url=await local(t,(req,res)=>{calls++;if(req.url==='/empty'){res.writeHead(204);res.end();}else{res.writeHead(302,{location:'http://example.invalid/private'});res.end('redirect');}});
 const result=await longHttpFetch(url,{timeoutMs:1000});assert.equal(result.status,302);assert.equal(result.headers.get('location'),'http://example.invalid/private');assert.equal(calls,1);
 const empty=await longHttpFetch(url+'/empty',{timeoutMs:1000});assert.equal(empty.status,204);assert.equal(await empty.text(),'');
});
test('rejects unsafe destinations and absent or invalid deadlines before sending',async()=>{
 for(const url of ['https://127.0.0.1/','http://localhost/','http://192.0.2.1/','http://user:password@127.0.0.1/'])await assert.rejects(longHttpFetch(url,{timeoutMs:1000}),/LOCAL_HTTP_URL_REQUIRED/);
 for(const timeoutMs of [undefined,null,0,-1,600001,1.2,'600000',NaN,Infinity])await assert.rejects(longHttpFetch('http://127.0.0.1/',{timeoutMs}),/LOCAL_HTTP_DEADLINE_INVALID/);
});
test('an explicit abort stops the request without retrying',async t=>{
 let calls=0;const controller=new AbortController();const url=await local(t,(req,res)=>{calls++;req.resume();controller.abort();});
 await assert.rejects(longHttpFetch(url,{method:'POST',body:'synthetic',timeoutMs:1000,signal:controller.signal}),e=>e.name==='AbortError');assert.equal(calls,1);
});
