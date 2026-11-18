import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./public-web-fetch.mjs').catch(()=>({}));
test('public address validation rejects private, reserved and mapped IPv6 before opening any request',()=>{
 assert.equal(typeof api.isPublicAddress,'function');
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.2.1','192.168.1.1','100.64.0.1','192.0.2.1','198.18.0.1','224.0.0.1','0.0.0.0','::1','fc00::1','fe80::1','::ffff:8.8.8.8','2001:db8::1','2002:7f00:1::'])assert.equal(api.isPublicAddress(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(api.isPublicAddress(address),true,address);
});
test('reader pins validated DNS, reauthorizes and rechecks every redirect without following private targets',async()=>{
 assert.equal(typeof api.fetchPublicPage,'function');const requests=[],lookups=[];let authorized=0;
 const options={authorize:async()=>{authorized++;return true;},lookup:async host=>{lookups.push(host);return[{address:'8.8.8.8',family:4}];},request:async(url,options)=>{requests.push({url:url.href,address:options.address});return{status:302,headers:{location:'https://127.0.0.1/'},body:Buffer.alloc(0)};}};
 await assert.rejects(api.fetchPublicPage('https://public.example/',options),/WEB_URL_REJECTED/);assert.equal(requests.length,1);assert.equal(requests[0].address,'8.8.8.8');assert.equal(lookups.length,1);assert(authorized>0);
 for(const url of ['http://public.example/','https://user:pass@public.example/','https://public.example:444/','https://2130706433/','https://[::ffff:127.0.0.1]/','https://www.chictr.org.cn/searchproj.html','https://public.example/?api_key=secret','https://public.example/?token=secret'])await assert.rejects(api.fetchPublicPage(url,options),/WEB_URL_REJECTED/);
 assert.equal(requests.length,1);
});
test('mixed DNS, oversized/binary/challenge/empty responses and revoked/cancelled delivery never become page evidence',async()=>{
 const opts={authorize:async()=>true,lookup:async()=>[{address:'8.8.8.8',family:4}],request:async()=>({status:200,headers:{'content-type':'text/plain'},body:Buffer.from('public page')})};let sent=0;
 await assert.rejects(api.fetchPublicPage('https://public.example/',{...opts,lookup:async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}],request:async()=>{sent++;}}),/WEB_ADDRESS_REJECTED/);assert.equal(sent,0);
 for(const response of [{status:200,headers:{'content-type':'application/pdf'},body:Buffer.from('x')},{status:200,headers:{'content-type':'text/plain'},body:Buffer.alloc(2097153)},{status:403,headers:{},body:Buffer.from('challenge')},{status:200,headers:{'content-type':'text/html'},body:Buffer.from('<html><body></body></html>')}])await assert.rejects(api.fetchPublicPage('https://public.example/',{...opts,request:async()=>response}));
 const controller=new AbortController();await assert.rejects(api.fetchPublicPage('https://public.example/',{...opts,signal:controller.signal,request:async()=>{controller.abort();return opts.request();}}));
 let n=0;await assert.rejects(api.fetchPublicPage('https://public.example/',{...opts,authorize:async()=>++n<3}),/WEB_ACCESS_DENIED/);
});
test('HTML parsing preserves substantive text and title but strips scripts, forms and hidden material',async()=>{
 const html='<html><head><title>Public &amp; Research</title><script>STEAL_KEY</script></head><body><nav>NAVIGATION</nav><main><h1>Evidence</h1><p>Public research text.</p><form>PRIVATE_FORM</form><p hidden>HIDDEN_SECRET</p><div style="display:none">CSS_HIDDEN</div></main></body></html>';
 const result=await api.fetchPublicPage('https://public.example/article#part',{authorize:async()=>true,lookup:async()=>[{address:'8.8.8.8',family:4}],request:async()=>({status:200,headers:{'content-type':'text/html; charset=utf-8'},body:Buffer.from(html)})});
 assert.equal(result.title,'Public & Research');assert(result.text.includes('Public research text.'));assert(!/STEAL_KEY|PRIVATE_FORM|HIDDEN_SECRET|CSS_HIDDEN|NAVIGATION/.test(result.text));assert.equal(result.url,'https://public.example/article');assert.match(result.rawHash,/^[a-f0-9]{64}$/);assert.match(result.textHash,/^[a-f0-9]{64}$/);
});
