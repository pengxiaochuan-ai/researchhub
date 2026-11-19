import{test}from'node:test';import assert from'node:assert/strict';import{createServer,request}from'node:http';import{createHash}from'node:crypto';import{once}from'node:events';import{createApiProxy}from'./api-proxy.mjs';
const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;};
const close=server=>new Promise(r=>server.close(r));
function call(port,path,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,method,headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);});req.on('error',reject);if(body)req.write(body);req.end();});}

test('preserves authentication, cookies and original origin while clearing proxy headers',async()=>{
 let seen;const upstream=createServer(async(req,res)=>{const chunks=[];for await(const b of req)chunks.push(b);seen={headers:req.headers,url:req.url,method:req.method,body:Buffer.concat(chunks)};res.writeHead(201,{'set-cookie':['hub_session=one; HttpOnly; Secure; SameSite=Lax','other=two; HttpOnly'],'content-type':'application/json'});res.end('{"ok":true}');});const up=await listen(upstream);
 const proxy=createApiProxy({upstream:`http://127.0.0.1:${up}`,authority:'hub.pengxc.com'});const front=createServer((req,res)=>{if(!proxy(req,res))res.writeHead(404).end();});const port=await listen(front);
 try{const out=await call(port,'/api/auth/login?flow=one',{method:'POST',headers:{host:'hub.pengxc.com',origin:'https://hub.pengxc.com','content-type':'application/json',cookie:'existing=one',forwarded:'host=spoof','x-forwarded-host':'spoof','x-forwarded-proto':'http','x-forwarded-for':'spoof',connection:'keep-alive, x-remove','x-remove':'secret'},body:Buffer.from('{"username":"synthetic"}')});assert.equal(out.status,201);assert.equal(out.headers['set-cookie'].length,2);assert.equal(seen.headers.host,'hub.pengxc.com');assert.equal(seen.headers.origin,'https://hub.pengxc.com');assert.equal(seen.headers.cookie,'existing=one');for(const key of ['forwarded','x-forwarded-host','x-forwarded-proto','x-forwarded-for','x-remove'])assert.equal(seen.headers[key],undefined);assert.equal(seen.url,'/api/auth/login?flow=one');assert.equal(seen.method,'POST');assert.equal(seen.body.toString(),'{"username":"synthetic"}');}finally{await close(front);await close(upstream);}
});

test('streams binary multipart uploads and Range responses without altering bytes',async()=>{
 const body=Buffer.alloc(320000,137);let digest;const upstream=createServer(async(req,res)=>{const h=createHash('sha256');for await(const b of req)h.update(b);digest=h.digest('hex');assert.equal(req.headers.range,'bytes=0-3');assert.match(req.headers['content-type'],/^multipart\/form-data/);res.writeHead(206,{'content-range':'bytes 0-3/4','content-type':'application/octet-stream','content-length':4});res.end(Buffer.from([0,255,10,13]));});const up=await listen(upstream);const proxy=createApiProxy({upstream:`http://127.0.0.1:${up}`,authority:'hub.pengxc.com'});const front=createServer(proxy);const port=await listen(front);
 try{const out=await call(port,'/api/knowledge/upload',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=synthetic',range:'bytes=0-3'},body});assert.equal(digest,createHash('sha256').update(body).digest('hex'));assert.equal(out.status,206);assert.equal(out.headers['content-range'],'bytes 0-3/4');assert.deepEqual(out.body,Buffer.from([0,255,10,13]));}finally{await close(front);await close(upstream);}
});

test('never selects an upstream from the request URL and leaves non API routes alone',async()=>{
 let seen;const up=createServer((req,res)=>{seen=req.url;res.end('ok');});const p=await listen(up);const proxy=createApiProxy({upstream:`http://127.0.0.1:${p}`,authority:'hub.pengxc.com'});const front=createServer((req,res)=>{if(!proxy(req,res))res.writeHead(404).end('static');});const port=await listen(front);
 try{assert.equal((await call(port,'/apiary')).status,404);assert.equal((await call(port,'http://attacker.invalid/api/record?x=1')).status,200);assert.equal(seen,'/api/record?x=1');}finally{await close(front);await close(up);}
});

test('unavailable backend produces a truthful 502 and does not retry the operation',async()=>{
 const unused=createServer();const up=await listen(unused);await close(unused);const proxy=createApiProxy({upstream:`http://127.0.0.1:${up}`,authority:'hub.pengxc.com'});const front=createServer(proxy);const port=await listen(front);
 try{const out=await call(port,'/api/asset',{method:'POST',body:Buffer.from('{}')});assert.equal(out.status,502);assert.equal(JSON.parse(out.body).code,'HUB_BACKEND_UNAVAILABLE');}finally{await close(front);}
});

test('rejects external, credentialed and path-bearing upstream configuration',()=>{for(const upstream of ['https://127.0.0.1:19612','http://example.com:19612','http://user:pass@127.0.0.1:19612','http://127.0.0.1:19612/api','http://127.0.0.1:19612/?token=one'])assert.throws(()=>createApiProxy({upstream,authority:'hub.pengxc.com'}));});

test('closing the browser response closes the unfinished upstream stream',async()=>{
 let resolveClosed;const closed=new Promise(r=>resolveClosed=r);const upstream=createServer((req,res)=>{res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: first\n\n');const timer=setInterval(()=>res.write('data: next\n\n'),10);res.on('close',()=>{clearInterval(timer);resolveClosed();});});const up=await listen(upstream);const proxy=createApiProxy({upstream:`http://127.0.0.1:${up}`,authority:'hub.pengxc.com'});const front=createServer(proxy);const port=await listen(front);
 try{await new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api/stream'},res=>{res.once('data',()=>{res.destroy();resolve();});});req.on('error',reject);req.end();});await Promise.race([closed,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('upstream did not close')),1000);timer.unref();})]);}finally{await close(front);await close(upstream);}
});

test('a stalled upstream is bounded and returns 502 without a second request',async()=>{
 let calls=0;const upstream=createServer((_req,res)=>{calls++;res.on('close',()=>{});});const up=await listen(upstream);const proxy=createApiProxy({upstream:`http://127.0.0.1:${up}`,authority:'hub.pengxc.com',timeoutMs:20});const front=createServer(proxy);const port=await listen(front);
 try{const out=await call(port,'/api/slow',{method:'POST',body:Buffer.from('{}')});assert.equal(out.status,502);assert.equal(calls,1);}finally{await close(front);await close(upstream);}
});
