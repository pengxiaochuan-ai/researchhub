const stopped=()=>Object.assign(Error('读取已停止。'),{status:499,code:'ANALYSIS_LIST_ABORTED'});

export function assertAnalysisListLive(signal){if(signal?.aborted)throw stopped();}

function observeDisconnect(res,disconnect){
 let disposed=false,observed=false;
 const close=()=>{if(!disposed&&!observed&&!res.writableEnded){observed=true;disconnect();}};
 res.once('close',close);
 if(res.destroyed&&!res.writableEnded)close();
 return()=>{disposed=true;res.off('close',close);};
}

// Only the wrapper observes this signal. An in-flight native item keeps its transaction.
export async function withAnalysisListLifetime(res,read){
 const controller=new AbortController(),dispose=observeDisconnect(res,()=>controller.abort());
 try{assertAnalysisListLive(controller.signal);const value=await read(controller.signal);assertAnalysisListLive(controller.signal);return value;}
 finally{dispose();}
}

// Vite's default response-close hook starts after upstream headers; register before them.
export function configureAnalysisListProxy(proxy){
 proxy.on('proxyReq',(proxyReq,req,res)=>{
  if(req.method!=='GET'||!/^\/api\/research-studies\/[A-Za-z0-9_-]{1,160}\/analysis\/runs$/.test((req.url??'').split('?')[0]))return;
  let dispose=()=>{},finished=false;
  const finish=()=>{finished=true;dispose();};
  proxyReq.once('close',finish);
  dispose=observeDisconnect(res,()=>proxyReq.destroy());
  if(finished||proxyReq.destroyed)finish();
 });
}
