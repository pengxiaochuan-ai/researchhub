import {coreDependencyRequire} from '../research-runtime/dependencies.mjs';
import {BlockList,isIP} from 'node:net';import {lookup as dnsLookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
const require=coreDependencyRequire(),Turndown=require('turndown'),domino=createRequire(require.resolve('turndown'))('@mixmark-io/domino');
const blocked=new BlockList(),v6Global=new BlockList();v6Global.addSubnet('2000::',3,'ipv6');
for(const [ip,prefix]of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(ip,prefix,'ipv4');
for(const [ip,prefix]of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])blocked.addSubnet(ip,prefix,'ipv6');
const fail=code=>{throw Object.assign(Error(code),{code});},hash=text=>createHash('sha256').update(text).digest('hex');
export function isPublicAddress(address){const family=isIP(address);return family===4?!blocked.check(address,'ipv4'):family===6&&v6Global.check(address,'ipv6')&&!blocked.check(address,'ipv6');}
export function publicWebUrl(raw){
 if(typeof raw!=='string'||raw.length>2048)fail('WEB_URL_REJECTED');
 let u;try{u=new URL(raw);}catch{fail('WEB_URL_REJECTED');}
 const host=u.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port||!host||host==='localhost'||/\.(?:localhost|local|internal)$/.test(host)||host==='chictr.org.cn'||host.endsWith('.chictr.org.cn')||isIP(host)&&!isPublicAddress(host))fail('WEB_URL_REJECTED');
 if([...u.searchParams.keys()].some(key=>/^(?:api[_-]?key|access[_-]?token|auth|authorization|password|passwd|secret|token|session(?:id)?|cookie|signature)$/i.test(key)))fail('WEB_URL_REJECTED');
 u.hash='';return u;
}
function pinnedRequest(url,{address,family,signal,maxBytes}){
 return new Promise((resolve,reject)=>{
  // DNS is checked before reaching here. The connection uses that exact IP;
  // TLS still validates the original hostname. No ambient proxy/Cookie/header.
  const req=httpsRequest(url,{method:'GET',agent:false,family,lookup:(_host,opts,cb)=>opts?.all?cb(null,[{address,family}]):cb(null,address,family),signal,headers:{Accept:'text/html,text/plain;q=0.9','Accept-Encoding':'identity','User-Agent':'ResearchHub/1.0 (+mailto:cooperation@pengxc.com)'}},res=>{
   const chunks=[];let size=0;
   res.on('error',reject);res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy();req.destroy();reject(Error('WEB_RESPONSE_TOO_LARGE'));}else chunks.push(chunk);});
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
  });req.on('error',reject);req.end();
 });
}
function pageText(body,contentType){
 const encoding=contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]??'utf-8';let decoded;try{decoded=new TextDecoder(encoding,{fatal:true}).decode(body);}catch{fail('WEB_ENCODING_UNSUPPORTED');}
 if(!/html/i.test(contentType))return{title:null,text:decoded.trim()};
 const document=domino.createDocument(decoded),title=document.title?.trim()||null;
 for(const node of document.querySelectorAll('script,style,noscript,iframe,object,embed,form,input,textarea,button,nav,header,footer,[hidden],[aria-hidden="true"]'))node.remove();
 for(const node of document.querySelectorAll('[style]'))if(/display\s*:\s*none|visibility\s*:\s*hidden/i.test(node.getAttribute('style')))node.remove();
 const main=document.querySelector('main,article')??document.body;
 const converter=new Turndown({headingStyle:'atx'});converter.remove(['script','style','iframe','form']);
 return{title,text:converter.turndown(main).trim()};
}
export async function fetchPublicPage(raw,{authorize,signal:callerSignal,lookup=dnsLookup,request=pinnedRequest,maxBytes=2097152,maxCharacters=16000,timeoutMs=15000}={}){
 if(typeof authorize!=='function')fail('WEB_ACCESS_DENIED');
 const signal=callerSignal?AbortSignal.any([callerSignal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
 const check=async()=>{signal.throwIfAborted();if(await authorize()!==true)fail('WEB_ACCESS_DENIED');signal.throwIfAborted();};
 const original=publicWebUrl(raw);let url=original;const redirects=[];
 for(let hop=0;hop<=3;hop++){
  await check();url=publicWebUrl(url.href);const host=url.hostname.replace(/^\[|\]$/g,'');
  let abort;const cancelled=new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});});let addresses;
  try{addresses=await Promise.race([isIP(host)?[{address:host,family:isIP(host)}]:lookup(host,{all:true,verbatim:true}),cancelled]);}finally{signal.removeEventListener('abort',abort);}
  signal.throwIfAborted();if(!Array.isArray(addresses)||!addresses.length||addresses.length>32||addresses.some(a=>!isPublicAddress(a.address)||isIP(a.address)!==a.family))fail('WEB_ADDRESS_REJECTED');
  await check();const pinned=addresses.find(a=>a.family===4)??addresses[0],response=await request(url,{...pinned,signal,maxBytes});await check();
  if(response.body?.length>maxBytes)fail('WEB_RESPONSE_TOO_LARGE');
  if([301,302,303,307,308].includes(response.status)){
   if(hop===3||typeof response.headers.location!=='string')fail('WEB_REDIRECT_LIMIT');
   const next=publicWebUrl(new URL(response.headers.location,url).href);redirects.push({from:url.href,to:next.href,status:response.status});url=next;continue;
  }
  if(response.status!==200)fail('WEB_HTTP_'+response.status);
  const type=String(response.headers['content-type']??'');if(!/^text\/(?:html|plain)(?:\s*;|$)|^application\/xhtml\+xml(?:\s*;|$)/i.test(type))fail('WEB_CONTENT_TYPE_REJECTED');
  if(response.headers['content-encoding']&&!/^identity$/i.test(response.headers['content-encoding']))fail('WEB_CONTENT_ENCODING_REJECTED');
  const {title,text}=pageText(response.body,type);if(!text||/checking your browser|verify you are human|enable javascript and cookies|人机验证|您的访问被阻断/i.test(text.slice(0,2000)))fail('WEB_PAGE_UNAVAILABLE');
  await check();const selected=text.slice(0,maxCharacters);
  return{kind:'public-web',url:url.href,requestedUrl:original.href,title:title??url.hostname,text:selected,coverage:'webpage-excerpt',truncated:text.length>selected.length,retrievedAt:new Date().toISOString(),rawHash:hash(response.body),textHash:hash(selected),redirects};
 }
 fail('WEB_REDIRECT_LIMIT');
}
