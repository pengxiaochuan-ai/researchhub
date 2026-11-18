import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareHubWorkspace,startHubPreflightRuntime} from './opencode-runtime.mjs';
import {routeDigest} from './skill-routing.mjs';

// One fixed-evidence synthesis, not an autonomous tool loop. Real BYOK remains
// in the Hub provider; the child receives only a per-run loopback capability.
export async function runOpenCodeSynthesis({root,tenantId,instruction,text,authorize,providerCall,signal}){
 if(typeof authorize!=='function'||await authorize()!==true)throw Error('HUB_OPENCODE_ACCESS_DENIED');
 signal?.throwIfAborted();
 const token=randomBytes(32).toString('hex');let calls=0,known,runtime,paths,proxyError,providerPending;
 const proxy=createServer(async(req,res)=>{
  try{
   if(req.method!=='POST'||req.url!=='/v1/chat/completions'||req.headers.authorization!==`Bearer ${token}`)throw Error('HUB_PROXY_ACCESS_DENIED');
   if(calls)throw Error('HUB_OPENCODE_NO_AUTOMATIC_RETRY');
   let body='';for await(const chunk of req){body+=chunk;if(body.length>256000)throw Error('HUB_PROXY_INPUT_LIMIT');}
   const input=JSON.parse(body);
   if(!Array.isArray(input.messages)||!input.messages.some(m=>m.role==='user'&&typeof m.content==='string'&&m.content.includes(text))||input.tools?.length)throw Error('HUB_OPENCODE_INPUT_CHANGED');
   if(await authorize()!==true)throw Error('HUB_OPENCODE_ACCESS_DENIED');signal?.throwIfAborted();calls++;
   // The harness may append cwd/OS metadata and final-step prompts. None are
   // literature evidence or authorized public model input. Bind exactly the
   // selected method and task that this proxy was created to synthesize.
   providerPending=providerCall([{role:'system',content:instruction},{role:'user',content:text}]);known=await providerPending;
   if(!known||known.usedMock||!known.usage||typeof known.text!=='string')throw Error('HUB_OPENCODE_PROVIDER_UNKNOWN');
   const id='hub-'+randomUUID(),usage={prompt_tokens:known.usage.promptTokens,completion_tokens:known.usage.completionTokens,total_tokens:known.usage.totalTokens};
   if(input.stream){
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    const common={id,object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:'deepseek-v4-pro'};
    res.write('data: '+JSON.stringify({...common,choices:[{index:0,delta:{role:'assistant',content:known.text},finish_reason:null}]})+'\n\n');
    res.write('data: '+JSON.stringify({...common,choices:[{index:0,delta:{},finish_reason:'stop'}],usage})+'\n\n');res.end('data: [DONE]\n\n');
   }else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id,object:'chat.completion',model:'deepseek-v4-pro',choices:[{index:0,message:{role:'assistant',content:known.text},finish_reason:'stop'}],usage}));}
  }catch(error){proxyError??=error;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'HUB_MODEL_EXECUTION_UNAVAILABLE',type:'server_error'}}));}
 });
 await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',resolve);});
 try{
  paths=await prepareHubWorkspace({root,tenantId,deploymentId:'hub-literature',mode:'literature',instruction,provider:{baseURL:`http://127.0.0.1:${proxy.address().port}/v1`,apiKey:token,model:'deepseek-v4-pro'}});
  runtime=await startHubPreflightRuntime({bin:'/Users/mac/.opencode/bin/opencode.real',paths,oldServerRoot:fileURLToPath(new URL('../../../app/server/',import.meta.url))});
  const session=await runtime.client.createSession('Hub fixed public literature synthesis');
  const response=await runtime.client.sendMessage(session.id,{agent:'qiyan',providerID:'deepseek',modelID:'deepseek-v4-pro',text,timeoutMs:100000,signal,tools:{}});
  if(proxyError)throw proxyError;
  if(response.info?.error||calls!==1||!known)throw Error('HUB_OPENCODE_EXECUTION_FAILED');
  const output=response.parts.filter(p=>p.type==='text').map(p=>p.text).join('');
  if(output.trim()!==known.text.trim())throw Error('HUB_OPENCODE_RESULT_CHANGED');
  if(await authorize()!==true)throw Error('HUB_OPENCODE_ACCESS_DENIED');signal?.throwIfAborted();
  return{...known,runtimeEvidence:{runtime:'hub-opencode',sessionId:session.id,workspace:paths.workspace,providerCalls:calls,promptHash:routeDigest({instruction,text}),responseHash:routeDigest(response)}};
 }catch(error){
  if(providerPending)try{known??=await providerPending;}catch(cause){proxyError??=cause;}
  const reason=proxyError??error;if(known)reason.knownProviderResult=known;throw reason;
 }
 finally{await runtime?.stop();proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
}
