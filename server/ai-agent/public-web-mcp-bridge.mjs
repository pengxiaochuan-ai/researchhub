// Per-run stdio bridge. No database, Provider key, cookies or ambient credentials.
import {createInterface} from 'node:readline';
import {readFileSync} from 'node:fs';
const {url,token}=JSON.parse(readFileSync('public-bridge.json','utf8'));
const endpoint=new URL(url);
if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||endpoint.pathname!=='/tools/read'||!/^[a-f0-9]{64}$/.test(token))throw Error('BRIDGE_CONFIGURATION');
const tools=[{name:'webfetch',description:'读取本轮搜索返回或用户给出的公开HTTPS网页。',inputSchema:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false}}];
const respond=(id,result,error)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,...(error?{error}:{result})})+'\n');
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
 let message;
 try{
  if(line.length>16384)throw Error('BRIDGE_INPUT_LIMIT');message=JSON.parse(line);
  if(message.id===undefined)continue;
  if(message.method==='initialize')respond(message.id,{protocolVersion:message.params?.protocolVersion??'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'hub-public-reader',version:'1.0.0'}});
  else if(message.method==='ping')respond(message.id,{});
  else if(message.method==='tools/list')respond(message.id,{tools});
  else if(message.method==='tools/call'){
   if(message.params?.name!=='webfetch')throw Error('BRIDGE_TOOL_DENIED');
   const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(message.params.arguments),signal:AbortSignal.timeout(18000)});
   const text=await response.text();if(!response.ok)throw Error('PUBLIC_PAGE_UNAVAILABLE');
   respond(message.id,{content:[{type:'text',text}]});
  }else respond(message.id,null,{code:-32601,message:'Method not found'});
 }catch{if(message?.id!==undefined)respond(message.id,null,{code:-32000,message:'PUBLIC_PAGE_UNAVAILABLE'});}
}
