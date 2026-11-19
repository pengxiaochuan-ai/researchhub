import{request as httpRequest}from'node:http';
const hop=new Set(['connection','proxy-connection','keep-alive','te','trailer','transfer-encoding','upgrade','proxy-authorization','proxy-authenticate']);
function headers(source){
 const blocked=new Set([...hop,...String(source.connection??'').split(',').map(x=>x.trim().toLowerCase())]);
 return Object.fromEntries(Object.entries(source).filter(([key])=>!blocked.has(key.toLowerCase())&&key.toLowerCase()!=='forwarded'&&!key.toLowerCase().startsWith('x-forwarded-')));
}
export function createApiProxy({upstream,authority,timeoutMs=120000}){
 let target,host;try{target=new URL(upstream);host=new URL('http://'+authority);}catch{throw Error('HUB_API_PROXY_CONFIG_INVALID');}
 if(target.protocol!=='http:'||!['127.0.0.1','researchhub-api'].includes(target.hostname)||target.username||target.password||target.pathname!=='/'||target.search||target.hash||!target.port||host.host!==authority||host.username||host.password||host.pathname!=='/'||host.search||host.hash)throw Error('HUB_API_PROXY_CONFIG_INVALID');
 return(req,res)=>{
  let incoming;try{incoming=new URL(req.url??'/','http://127.0.0.1');}catch{res.writeHead(400).end();return true;}
  if(incoming.pathname!=='/api'&&!incoming.pathname.startsWith('/api/'))return false;
  const unavailable=()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}).end(JSON.stringify({code:'HUB_BACKEND_UNAVAILABLE',message:'服务暂时不可用，请稍后重试。'}));else res.destroy();};
  // The configured private target is never replaced by a client URL or header.
  const out=httpRequest({hostname:target.hostname,port:Number(target.port),method:req.method,path:incoming.pathname+incoming.search,headers:{...headers(req.headers),host:authority}},upstreamResponse=>{
   res.writeHead(upstreamResponse.statusCode??502,headers(upstreamResponse.headers));
   upstreamResponse.on('error',()=>res.destroy());upstreamResponse.pipe(res);
  });
  out.setTimeout(timeoutMs,()=>out.destroy());out.on('error',unavailable);
  req.on('aborted',()=>out.destroy());req.on('error',()=>out.destroy());
  res.on('close',()=>{if(!res.writableFinished)out.destroy();});req.pipe(out);return true;
 };
}
