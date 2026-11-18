import http from 'node:http';

/** Acceptance tooling only. Buffered Response; one request, no redirects or retries. */
export async function longHttpFetch(input,{timeoutMs,method='GET',headers,body,signal}={}){
 let url;try{url=new URL(input);}catch{throw new Error('LOCAL_HTTP_URL_REQUIRED');}
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password)throw new Error('LOCAL_HTTP_URL_REQUIRED');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw new RangeError('LOCAL_HTTP_DEADLINE_INVALID');
 if(body!==undefined&&body!==null&&typeof body!=='string'&&!(body instanceof Uint8Array)&&!(body instanceof ArrayBuffer))throw new TypeError('LOCAL_HTTP_BODY_UNSUPPORTED');
 const requestHeaders=Object.fromEntries(new Headers(headers)),payload=body instanceof ArrayBuffer?new Uint8Array(body):body;
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  let request,response,settled=false;
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
  const fail=error=>{if(settled)return;settled=true;cleanup();request?.destroy();response?.destroy();reject(error);};
  const abort=()=>fail(signal.reason??new DOMException('Request aborted','AbortError'));
  const timer=setTimeout(()=>fail(new DOMException('Local HTTP total deadline exceeded','TimeoutError')),timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  try{
   // A private one-shot agent avoids shared pool settings and Undici header timers.
   request=http.request(url,{method,headers:requestHeaders,agent:false},incoming=>{
    response=incoming;const chunks=[];
    incoming.on('data',chunk=>chunks.push(chunk));
    incoming.on('error',fail);
    incoming.on('aborted',()=>fail(new Error('LOCAL_HTTP_RESPONSE_ABORTED')));
    incoming.on('end',()=>{
     if(settled)return;
     try{
      const resultHeaders=new Headers();
      for(let i=0;i<incoming.rawHeaders.length;i+=2)resultHeaders.append(incoming.rawHeaders[i],incoming.rawHeaders[i+1]);
      const status=incoming.statusCode,empty=method.toUpperCase()==='HEAD'||[204,205,304].includes(status);
      const result=new Response(empty?null:Buffer.concat(chunks),{status,statusText:incoming.statusMessage,headers:resultHeaders});
      settled=true;cleanup();resolve(result);
     }catch(error){fail(error);}
    });
   });
   request.on('error',fail);
   request.end(payload);
  }catch(error){fail(error);}
 });
}
