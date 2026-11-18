// S01 only. Real native WebSearch, synthetic loopback model responses. No BYOK,
// billing, database, user session, old workspace or persistent server involved.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareHubWorkspace,hubChildEnvironment} from '../server/ai-agent/opencode-runtime.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=root+'.tmp/smart-search-2026-11-12/';
export function probeIntent(argv){if(argv.some(a=>a!=='--live')||argv.length>1)throw Error('PROBE_ARGUMENTS');return{live:argv[0]==='--live',query:'World Health Organization depression fact sheet'};}
export function assessNativeProbe(messages){
 const tools=messages.flatMap(m=>m.parts??[]).filter(p=>p.type==='tool'&&p.tool==='websearch').map(p=>({tool:p.tool,...p.state}));
 const passed=tools.length===1&&tools[0].status==='completed'&&/https:\/\/[^\s)]+/.test(tools[0].output??'');
 return{passed,tools};
}
export async function nativeProbe(){
 mkdirSync(out,{recursive:true,mode:0o700});const requests=[];let paths,child,client,port,sessionId;
 const proxy=createServer(async(req,res)=>{
  try{
   assert.equal(req.method,'POST');assert.equal(req.url,'/v1/chat/completions');
   let body='';for await(const c of req){body+=c;if(body.length>256000)throw Error('PROBE_INPUT_LIMIT');}
   const input=JSON.parse(body);requests.push(input);
   assert(requests.length<=2,'No automatic probe retry');
   assert(input.tools?.some(t=>t.function?.name==='websearch'),'Native websearch is not visible');
   const first=requests.length===1,tool={id:'native_probe_search',type:'function',function:{name:'websearch',arguments:JSON.stringify({query:probeIntent(['--live']).query,numResults:3,contextMaxCharacters:5000,type:'fast'})}};
   const message=first?{role:'assistant',content:null,tool_calls:[tool]}:{role:'assistant',content:'S01_NATIVE_PROBE_COMPLETE'};
   const common={id:'probe-'+requests.length,created:Math.floor(Date.now()/1000),model:'deepseek-v4-pro'};
   if(input.stream){
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    res.write('data: '+JSON.stringify({...common,object:'chat.completion.chunk',choices:[{index:0,delta:first?{role:'assistant',tool_calls:[{index:0,...tool}]}:{role:'assistant',content:message.content},finish_reason:null}]})+'\n\n');
    res.write('data: '+JSON.stringify({...common,object:'chat.completion.chunk',choices:[{index:0,delta:{},finish_reason:first?'tool_calls':'stop'}],usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0}})+'\n\n');res.end('data: [DONE]\n\n');
   }else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({...common,object:'chat.completion',choices:[{index:0,message,finish_reason:first?'tool_calls':'stop'}],usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0}}));}
  }catch(e){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:e.message}}));}
 });
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 try{
  paths=await prepareHubWorkspace({root,tenantId:'synthetic-smart-search-s01',deploymentId:'hub-smart-search-probe',mode:'preflight',provider:{model:'deepseek-v4-pro',baseURL:`http://127.0.0.1:${proxy.address().port}/v1`,apiKey:'not-a-provider-key'}});
  const config=JSON.parse(readFileSync(paths.configPath));config.permission={...config.permission,websearch:'allow'};Object.assign(config.agent.qiyan,{permission:{'*':'deny',websearch:'allow'},steps:2});writeFileSync(paths.configPath,JSON.stringify(config),{mode:0o600});
  const env={...hubChildEnvironment(paths),OPENCODE_ENABLE_EXA:'true',OPENCODE_WEBSEARCH_PROVIDER:'exa',OPENCODE_DISABLE_DEFAULT_PLUGINS:'true'};
  child=spawn('/Users/mac/.opencode/bin/opencode.real',['serve','--port','0','--hostname','127.0.0.1','--log-level','WARN'],{cwd:paths.workspace,env,stdio:['ignore','pipe','pipe'],detached:true});let log='';child.stdout.on('data',c=>{log+=c;});child.stderr.on('data',c=>{log+=c;});
  port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('PROBE_READY_TIMEOUT')),45000);child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error('PROBE_EARLY_EXIT'));});child.stdout.on('data',()=>{const match=log.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});});
  const require=createRequire(root+'../app/server/package.json'),{OpencodeClient}=require(root+'../app/server/dist/orchestrator/opencode/opencode-client.js');client=new OpencodeClient(port);
  assert.equal((await client.getPath()).directory,paths.workspace);
  const session=await client.createSession('Synthetic native WebSearch probe, no model charge');sessionId=session.id;
  const response=await client.sendMessage(sessionId,{agent:'qiyan',providerID:'deepseek',modelID:'deepseek-v4-pro',text:'Execute the single supplied public search. This is a synthetic tool transport probe.',timeoutMs:45000,tools:{websearch:true}});
  const messages=await client.listMessages(sessionId),result={...assessNativeProbe(messages),at:new Date().toISOString(),opencode:'1.18.27',requestedProvider:'exa',realModelCalls:0,syntheticModelResponses:requests.length,databaseWrites:0,workspace:paths.workspace,sessionId,error:response.info?.error??null};
  writeFileSync(out+'s01-native-messages.json',JSON.stringify(messages,null,2));writeFileSync(out+'s01-native-inputs.json',JSON.stringify(requests,null,2));writeFileSync(out+'s01-native-result.json',JSON.stringify(result,null,2));writeFileSync(out+'s01-opencode.log',log);
  return result;
 }finally{
  if(sessionId)await client?.abortSession(sessionId).catch(()=>{});
  if(child?.pid&&child.exitCode===null&&child.signalCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));try{process.kill(-child.pid,'SIGTERM');}catch{}await Promise.race([stopped,new Promise(resolve=>setTimeout(resolve,3000))]);if(child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,'SIGKILL');}catch{}}
  proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const intent=probeIntent(process.argv.slice(2));if(!intent.live)console.log(JSON.stringify({live:false,realModelCalls:0,externalRequests:0}));else{const r=await nativeProbe();console.log(JSON.stringify({passed:r.passed,realModelCalls:0,tools:r.tools.map(({tool,status,input,error})=>({tool,status,input,error}))}));if(!r.passed)process.exitCode=3;}
}
