// Explicit live transport check; synthetic model, real native search and reader.
import {fileURLToPath} from 'node:url';import {writeFile} from 'node:fs/promises';
import {runSmartSearch} from '../server/ai-agent/smart-search-runtime.mjs';
if(process.argv[2]!=='--live')throw Error('EXPLICIT_LIVE_REQUIRED');
const root=fileURLToPath(new URL('../',import.meta.url));let calls=0;
const url='https://www.who.int/news-room/fact-sheets/detail/depression';
try{
 const result=await runSmartSearch({root,tenantId:'synthetic-smart-search-s05',query:'Search WHO depression fact sheet, then read its official webpage.',networkEnabled:true,authorize:async()=>true,authorizeNetwork:async()=>true,tokenBudget:100000,recordUsage:()=>{},providerCall:async messages=>{
  calls++;let toolCalls=[],content=null;
  if(calls===1)toolCalls=[{id:'probe_search',name:'websearch',arguments:JSON.stringify({query:'World Health Organization depression fact sheet',numResults:3})}];
  else if(calls===2)toolCalls=[{id:'probe_read',name:'hub_public_webfetch',arguments:JSON.stringify({url})}];
  else{const source=JSON.parse(messages.at(-1).content).sources.find(s=>s.coverage==='webpage-excerpt');content=JSON.stringify({answer:'WHO提供抑郁障碍的公开资料。['+source.id+']',sourceIds:[source.id],limitations:'本次读取网页选段，非完整系统综述。'});}
  return{content,toolCalls,usedMock:false,usage:{promptTokens:0,completionTokens:0,totalTokens:0}};
 }});
 await writeFile(root+'.tmp/smart-search-2026-11-12/s05-native-loop.json',JSON.stringify({...result,probeOnly:true,realModelCalls:0},null,2));
 console.log(JSON.stringify({passed:true,realModelCalls:0,syntheticResponses:calls,tools:result.tools.map(t=>({tool:t.tool,status:t.status,url:t.url}))}));
}catch(error){console.error(JSON.stringify({passed:false,realModelCalls:0,syntheticResponses:calls,error:error.message}));process.exitCode=1;}
