import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prepareHubWorkspace,startHubPreflightRuntime} from './opencode-runtime.mjs';
import {SMART_INSTRUCTION,SMART_TOOLS,safePublicQuery,parseWebCandidates} from './smart-search-contract.mjs';
import {acceptGroundedAnswer} from './smart-search-grounding.mjs';
import {fetchPublicPage,publicWebUrl} from './public-web-fetch.mjs';
import {routeDigest} from './skill-routing.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export const modelTokenBound=(messages,tools)=>Buffer.byteLength(JSON.stringify({messages,tools}))+2048;
export function smartModelStep(query,messages,state,networkEnabled){
 const fixed=state.readResults.size>0||!networkEnabled;
 return{tools:fixed?[]:SMART_TOOLS,messages:fixed?[{role:'system',content:SMART_INSTRUCTION},{role:'user',content:JSON.stringify({question:query,scope:'本批实际网页证据已固定，不再调用工具；仅搜索摘要不作全文依据，多源比较若仅部分已读须明确未完成范围。',sources:state.sources.filter(s=>s.text?.trim()),unavailableSources:[...(state.readFailures?.values()??[])]})}]:messages};
}
export function assertWebTrace(tools,trace){
 for(const tool of tools){
  const actual=trace.find(t=>t.callId===tool.callId&&t.tool===tool.tool&&t.status==='completed');
  if(!actual||(tool.tool==='websearch'?(actual.metadata?.provider!=='exa'||actual.input?.query!==tool.query||actual.outputHash!==tool.outputHash):actual.input?.url!==tool.requestedUrl))fail('SMART_TOOL_TRACE_MISSING');
 }
}
export function fitModelTranscript(messages,tools,knownTokens,budget){
 if(!Number.isSafeInteger(budget))fail('SMART_RESERVATION_LIMIT');
 for(const limit of [3000,2000,1000,512]){
  const sourceView=s=>({id:s.id,url:s.url,title:s.title,text:s.text.slice(0,s.coverage==='search-snippet'?Math.min(limit,200):limit),coverage:s.coverage,truncated:!!s.truncated||s.text.length>(s.coverage==='search-snippet'?Math.min(limit,200):limit),retrievedAt:s.retrievedAt});
  const result=messages.map(m=>{
   if(!['user','tool'].includes(m.role))return m;
   let value;try{value=JSON.parse(m.content);}catch{return m;}
   if(value.source)value={...value,source:sourceView(value.source)};
   if(value.sources)value={...value,sources:value.sources.map(sourceView)};
   return{...m,content:JSON.stringify(value)};
  });
  if(knownTokens+modelTokenBound(result,tools)<=budget)return result;
 }
 fail('SMART_RESERVATION_LIMIT');
}
export function approveWebToolCalls(calls,state,networkEnabled){
 if(!networkEnabled||!Array.isArray(calls)||!calls.length||calls.length>2)fail('SMART_TOOL_DENIED');
 const approved=[];
 for(const call of calls){
  if(typeof call.id!=='string'||!/^[\w-]{1,160}$/.test(call.id)||state.callIds.has(call.id))fail('SMART_TOOL_DENIED');
  let args;try{args=JSON.parse(call.arguments);}catch{fail('SMART_TOOL_INPUT');}
  if(!args||Array.isArray(args)||typeof args!=='object')fail('SMART_TOOL_INPUT');
  if(call.name==='websearch'){
   if(Object.keys(args).some(k=>!['query','numResults'].includes(k))||state.searches>=2||!Number.isInteger(args.numResults??3)||(args.numResults??3)<1||(args.numResults??3)>5)fail('SMART_TOOL_LIMIT');
   args={query:safePublicQuery(args.query),numResults:args.numResults??3};state.searches++;
  }else if(call.name==='hub_public_webfetch'){
   if(Object.keys(args).join(',')!=='url'||state.reads>=4)fail('SMART_TOOL_LIMIT');
   args={url:publicWebUrl(args.url).href};
   if(!state.sources.some(s=>s.url===args.url))fail('SMART_SOURCE_NOT_DISCOVERED');state.reads++;
  }else fail('SMART_TOOL_DENIED');
  state.callIds.add(call.id);approved.push({id:call.id,type:'function',function:{name:call.name,arguments:JSON.stringify(args)}});
 }
 return approved;
}
export function canonicalToolResults(messages,state){
 return state.pending.map(call=>{
  const found=messages.filter(m=>m.role==='tool'&&m.tool_call_id===call.id);if(found.length!==1||typeof found[0].content!=='string')fail('SMART_TOOL_RESULT_MISSING');
  let content;
  if(call.name==='websearch'){
   const candidates=parseWebCandidates(found[0].content);if(!candidates.length)fail('SMART_SEARCH_UNAVAILABLE');
   for(const source of candidates)if(!state.sources.some(s=>s.url===source.url))state.sources.push({...source,id:'W'+(state.sources.length+1)});
   content={sources:candidates.map(s=>state.sources.find(t=>t.url===s.url))};
   state.tools.push({tool:call.name,callId:call.id,query:JSON.parse(call.arguments).query,status:'completed',at:new Date().toISOString(),outputHash:routeDigest(found[0].content),urls:candidates.map(s=>s.url)});
  }else{
   const failure=state.readFailures?.get(call.id),source=state.readResults.get(call.id);
   if(failure){if(!found[0].content.includes(failure.hash))fail('SMART_READ_NOT_EXECUTED');content={unavailableSource:failure,notRead:true};}
   else{if(!source||!found[0].content.includes(source.textHash))fail('SMART_READ_NOT_EXECUTED');content={source};}
  }
  return{role:'tool',tool_call_id:call.id,content:JSON.stringify(content)};
 });
}
function reply(res,input,message,usage){
 const common={id:'hub-'+randomUUID(),model:'deepseek-v4-pro',created:Math.floor(Date.now()/1000)},finish=message.tool_calls?.length?'tool_calls':'stop';
 if(!input.stream){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({...common,object:'chat.completion',choices:[{index:0,message,finish_reason:finish}],usage}));return;}
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const delta={role:'assistant',...(message.content?{content:message.content}:{}),...(message.tool_calls?{tool_calls:message.tool_calls.map((c,index)=>({...c,index}))}:{})};
 res.write('data: '+JSON.stringify({...common,object:'chat.completion.chunk',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');
 res.write('data: '+JSON.stringify({...common,object:'chat.completion.chunk',choices:[{index:0,delta:{},finish_reason:finish}],usage})+'\n\n');res.end('data: [DONE]\n\n');
}
// All model calls and tools run inside a fresh Hub-owned OpenCode session.
// Harness metadata is never forwarded; the canonical transcript is server-owned.
export async function runSmartSearch({root,tenantId,query,sources=[],networkEnabled,authorize,authorizeNetwork,providerCall,recordUsage,tokenBudget,signal,filterText,readPage=fetchPublicPage,startRuntime=startHubPreflightRuntime}){
 const check=async external=>{signal?.throwIfAborted();if(await authorize()!==true)fail('SMART_ACCESS_DENIED');if(external&&(!networkEnabled||await authorizeNetwork()!==true))fail('HUB_NETWORK_DISABLED');};
 await check(false);
 const token=randomBytes(32).toString('hex'),state={sources:structuredClone(sources),tools:[],searches:0,reads:0,callIds:new Set(),pending:[],readResults:new Map(),readFailures:new Map()};
 if(networkEnabled)for(const match of query.matchAll(/https:\/\/[^\s，。；）)]+/g)){const url=publicWebUrl(match[0]).href;if(!state.sources.some(s=>s.url===url))state.sources.push({id:'W'+(state.sources.length+1),url,title:url,text:'',coverage:'user-url',retrievedAt:new Date().toISOString()});}
 const messages=[{role:'system',content:SMART_INSTRUCTION},{role:'user',content:JSON.stringify({question:query,scope:networkEnabled?'公开网页检索':'仅本次固定网页证据，不联网',sources:state.sources})}];
 const modelInputs=[];let runtime,paths,proxyError,active=false,calls=0,knownTokens=0,final,finalRaw,providerPending;
 const proxy=createServer(async(req,res)=>{
  try{
   if(req.method!=='POST'||req.headers.authorization!==`Bearer ${token}`||!['/v1/chat/completions','/tools/read'].includes(req.url)||proxyError)fail('SMART_PROXY_DENIED');
   let body='';for await(const chunk of req){body+=chunk;if(body.length>256000)fail('SMART_PROXY_LIMIT');}const input=JSON.parse(body);
   if(req.url==='/tools/read'){
    await check(true);
    const pending=state.pending.find(c=>c.name==='hub_public_webfetch'&&JSON.parse(c.arguments).url===input.url&&!state.readResults.has(c.id));if(!pending||Object.keys(input).join(',')!=='url')fail('SMART_READ_NOT_REQUESTED');
    let page;
    try{page=await readPage(input.url,{authorize:async()=>{await check(true);return true;},signal,maxCharacters:4500});}
    catch(error){
     await check(true);const code=error.code??error.message;
     if(!/^WEB_(?:HTTP_\d+|PAGE_UNAVAILABLE|CONTENT_TYPE_REJECTED|CONTENT_ENCODING_REJECTED|ENCODING_UNSUPPORTED|RESPONSE_TOO_LARGE)$|^(?:ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|ECONNREFUSED)$/.test(code)&&error.name!=='TimeoutError')throw error;
     const body={sourceId:state.sources.find(s=>s.url===input.url)?.id,url:input.url,code:error.name==='TimeoutError'?'WEB_TIMEOUT':code,at:new Date().toISOString()},failure={...body,hash:routeDigest(body)};
     state.readFailures.set(pending.id,failure);state.tools.push({tool:'hub_public_webfetch',callId:pending.id,status:'failed',at:body.at,requestedUrl:input.url,error:failure.code,failureHash:failure.hash});
     res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({failure}));return;
    }
    await check(true);
    const original=state.sources.find(s=>s.url===input.url);if(!original)fail('SMART_SOURCE_NOT_DISCOVERED');
    const source={...page,id:original.id,discoveredUrl:original.url};Object.assign(original,source);state.readResults.set(pending.id,source);
    state.tools.push({tool:'hub_public_webfetch',callId:pending.id,status:'completed',at:new Date().toISOString(),url:source.url,requestedUrl:input.url,textHash:source.textHash});
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({source}));return;
   }
   if(active||final||calls>=5||!Array.isArray(input.messages))fail('SMART_NO_AUTOMATIC_RETRY');active=true;
   await check(false);
   if(state.pending.length){messages.push(...canonicalToolResults(input.messages,state));state.pending=[];}
   if(state.readFailures.size&&!state.readResults.size)fail('SMART_NO_PAGE_EVIDENCE');
   const step=smartModelStep(query,messages,state,networkEnabled),bound=fitModelTranscript(step.messages,step.tools,knownTokens,tokenBudget);
   calls++;modelInputs.push({step:calls,hash:routeDigest(bound)});providerPending=providerCall(structuredClone(bound),step.tools);const result=await providerPending;
   if(!result||result.usedMock||!result.usage||typeof result.content!=='string'&&result.content!==null&&result.content!==undefined)fail('SMART_PROVIDER_UNKNOWN');
   recordUsage(result);knownTokens+=result.usage.totalTokens;
   await check(false);
   const approved=result.toolCalls?.length?approveWebToolCalls(result.toolCalls,state,networkEnabled&&step.tools.length>0):[];
   if(approved.length){await check(true);state.pending=approved.map(c=>({id:c.id,name:c.function.name,arguments:c.function.arguments}));}
   else{if(!state.sources.some(s=>s.text?.trim()))fail('SMART_NO_EVIDENCE');final=acceptGroundedAnswer(result.content,state.sources,filterText?(text=>filterText(text,state.sources)):undefined);finalRaw=result.content;
    if(state.readFailures.size){final.text+='\n\n部分网页未能读取，本次未完成这些来源的正文核对：\n'+[...state.readFailures.values()].map(f=>`- [未读取的网页](${f.url}) · ${f.code==='WEB_TIMEOUT'?'读取超时':'网站限制或内容暂不可读取'}；不得据此作完整比较。`).join('\n');final.validation={...final.validation,status:'partial',textHash:routeDigest(final.text)};}
   }
   const message={role:'assistant',content:result.content??null,...(approved.length?{tool_calls:approved}:{})};messages.push(message);
   reply(res,input,message,{prompt_tokens:result.usage.promptTokens,completion_tokens:result.usage.completionTokens,total_tokens:result.usage.totalTokens});active=false;
  }catch(error){proxyError??=error;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'SMART_EXECUTION_UNAVAILABLE',type:'server_error'}}));}
 });
 await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',resolve);});
 try{
  paths=await prepareHubWorkspace({root,tenantId,deploymentId:'hub-smart-search',mode:'smart-search',instruction:SMART_INSTRUCTION,mcp:networkEnabled?{hub_public:{type:'local',command:[process.execPath,fileURLToPath(new URL('./public-web-mcp-bridge.mjs',import.meta.url))],enabled:true,timeout:20000}}:{},provider:{baseURL:`http://127.0.0.1:${proxy.address().port}/v1`,apiKey:token,model:'deepseek-v4-pro'}});
  await writeFile(paths.workspace+'/public-bridge.json',JSON.stringify({url:`http://127.0.0.1:${proxy.address().port}/tools/read`,token}),{mode:0o600,flag:'wx'});
  runtime=await startRuntime({bin:'/Users/mac/.opencode/bin/opencode.real',paths,oldServerRoot:fileURLToPath(new URL('../../../app/server/',import.meta.url))});
  const session=await runtime.client.createSession('Hub public smart search');
  const response=await runtime.client.sendMessage(session.id,{agent:'qiyan',providerID:'deepseek',modelID:'deepseek-v4-pro',text:query,timeoutMs:120000,signal,tools:networkEnabled?{websearch:true,hub_public_webfetch:true}:{}});
  if(proxyError)throw proxyError;
  if(response.info?.error||!final||state.pending.length)fail('SMART_EXECUTION_FAILED');
  if(response.parts.filter(p=>p.type==='text').map(p=>p.text).join('').trim()!==finalRaw.trim())fail('SMART_RESULT_CHANGED');
  const actual=await runtime.client.listMessages(session.id),trace=actual.flatMap(m=>m.parts??[]).filter(p=>p.type==='tool').map(p=>({tool:p.tool,callId:p.callID,status:p.state?.status,input:p.state?.input,outputHash:routeDigest(p.state?.output??''),metadata:p.state?.metadata}));
  assertWebTrace(state.tools,trace);
  if(networkEnabled&&!state.tools.length)fail('SMART_TOOL_NOT_EXECUTED');
  await check(false);
  return{...final,sources:state.sources,tools:state.tools,runtimeEvidence:{runtime:'hub-opencode',sessionId:session.id,workspace:paths.workspace,providerCalls:calls,modelInputs,trace,traceHash:routeDigest(trace),responseHash:routeDigest(response),completedAt:new Date().toISOString()}};
 }catch(error){if(providerPending)await providerPending.catch(()=>{});if(paths)await writeFile(paths.workspace+'/failure.json',JSON.stringify({at:new Date().toISOString(),code:(proxyError??error).code??(proxyError??error).message,providerCalls:calls,knownTokens,modelInputs,tools:state.tools,sources:state.sources},null,2),{mode:0o600}).catch(()=>{});throw proxyError??error;}
 finally{await runtime?.stop();proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
}
