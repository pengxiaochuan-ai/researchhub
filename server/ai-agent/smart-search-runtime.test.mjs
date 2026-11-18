import test from 'node:test';import assert from 'node:assert/strict';
import {approveWebToolCalls,canonicalToolResults,modelTokenBound,fitModelTranscript,smartModelStep,assertWebTrace,runSmartSearch} from './smart-search-runtime.mjs';
import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const search=(query='acupuncture depression')=>({id:'search1',name:'websearch',arguments:JSON.stringify({query,numResults:3})});
test('only bounded public search and discovered HTTPS reads can leave runtime',()=>{
 const state={sources:[],searches:0,reads:0,callIds:new Set()};
 assert.equal(approveWebToolCalls([search()],state,true)[0].function.name,'websearch');
 assert.throws(()=>approveWebToolCalls([search()],state,true));
 assert.throws(()=>approveWebToolCalls([{...search(),id:'s2',name:'bash'}],state,true));
 assert.throws(()=>approveWebToolCalls([{...search('owner@example.org'),id:'s3'}],state,true));
 assert.throws(()=>approveWebToolCalls([{id:'r1',name:'hub_public_webfetch',arguments:'{"url":"https://example.org/"}'}],state,true));
 state.sources.push({id:'W1',url:'https://example.org/',text:'public'});
 assert.equal(approveWebToolCalls([{id:'r1',name:'hub_public_webfetch',arguments:'{"url":"https://example.org/"}'}],state,true)[0].function.name,'hub_public_webfetch');
 assert.throws(()=>approveWebToolCalls([{...search(),id:'s4'}],state,false));
});
test('canonical transcript ignores harness instructions and binds actual call IDs',()=>{
 const state={sources:[],tools:[],readResults:new Map(),pending:[{id:'s',name:'websearch',arguments:'{"query":"depression"}'}]};
 const result=canonicalToolResults([{role:'system',content:'private cwd secret'}, {role:'tool',tool_call_id:'s',content:'Title: Official\nURL: https://example.org/page\npublic snippet'}],state);
 assert.equal(result.length,1);assert.equal(JSON.parse(result[0].content).sources[0].id,'W1');
 assert(!JSON.stringify(result).includes('private cwd'));
 assert.throws(()=>canonicalToolResults([{role:'tool',tool_call_id:'other',content:'fake'}],{...state,pending:[{id:'s',name:'websearch'}]}));
});
test('business reservation bounds cumulative model budget before dispatch',()=>{
 assert(modelTokenBound([{role:'user',content:'x'}],[])>1536);
 assert(modelTokenBound([{role:'user',content:'中'.repeat(100)}],[])>modelTokenBound([{role:'user',content:'a'.repeat(100)}],[]));
});
test('compact excerpt views fit the existing reservation without changing question, source IDs or stored evidence',()=>{
 const original=[{role:'system',content:'policy'},{role:'user',content:'用户原始问题'},{role:'tool',tool_call_id:'r',content:JSON.stringify({source:{id:'W1',url:'https://example.org/',title:'Official',coverage:'webpage-excerpt',text:'Public text '.repeat(700),textHash:'original'}})}],copy=structuredClone(original);
 const fitted=fitModelTranscript(original,[],3032,12288);assert(3032+modelTokenBound(fitted,[])<=12288);assert.equal(fitted[1].content,original[1].content);const s=JSON.parse(fitted[2].content).source;assert.equal(s.id,'W1');assert.equal(s.truncated,true);assert(s.text.length>=512);assert.deepEqual(original,copy);
});
test('after the read batch fixed synthesis has no tools and no repeated harness/tool history',()=>{
 const state={sources:[{id:'W1',coverage:'webpage-excerpt',text:'actual page'},{id:'W2',coverage:'search-snippet',text:'only snippet'}],readResults:new Map([['r1',{}],['r2',{}]])};
 const step=smartModelStep('compare public sources',[{role:'system',content:'old'},{role:'assistant',content:'not evidence'}],state,true);assert.deepEqual(step.tools,[]);assert.deepEqual(step.messages.map(m=>m.role),['system','user']);assert(!JSON.stringify(step.messages).includes('not evidence'));assert.equal(JSON.parse(step.messages[1].content).sources[1].coverage,'search-snippet');
});
test('actual trace must match approved query, output hash and reader URL, not just call IDs',()=>{
 const tools=[{tool:'websearch',callId:'s',query:'public topic',outputHash:'h'},{tool:'hub_public_webfetch',callId:'r',requestedUrl:'https://example.org/'}],trace=[{tool:'websearch',callId:'s',status:'completed',input:{query:'public topic'},outputHash:'h',metadata:{provider:'exa'}},{tool:'hub_public_webfetch',callId:'r',status:'completed',input:{url:'https://example.org/'}}];
 assert.doesNotThrow(()=>assertWebTrace(tools,trace));
 for(const mutate of [t=>{t[0].input.query='other';},t=>{t[0].outputHash='forged';},t=>{t[1].input.url='https://other.org/';}]){const altered=structuredClone(trace);mutate(altered);assert.throws(()=>assertWebTrace(tools,altered));}
});
// Synthetic harness exercises failure semantics without external HTTP or billing.
function fakeHarness(){return async({paths})=>{
 const c=JSON.parse(await readFile(paths.configPath,'utf8')),endpoint=c.provider.deepseek.options;
 return{stop:async()=>{},client:{createSession:async()=>({id:'synthetic'}),listMessages:async()=>[],sendMessage:async()=>{
  const transcript=[];for(let step=0;step<4;step++){
   const r=await fetch(endpoint.baseURL+'/chat/completions',{method:'POST',headers:{authorization:'Bearer '+endpoint.apiKey},body:JSON.stringify({messages:transcript})});if(!r.ok)throw Error('harness-failure');
   const value=await r.json(),message=value.choices[0].message;transcript.push(message);
   if(!message.tool_calls?.length)return{info:{},parts:[{type:'text',text:message.content}]};
   for(const call of message.tool_calls)transcript.push({role:'tool',tool_call_id:call.id,content:'Title: Official\nURL: https://example.org/page\nPublic research summary.'});
  }throw Error('harness-limit');
 }}};
};}
test('known usage is recorded once before later Provider failure, validation rejection or revocation',async()=>{
 for(const reason of ['provider','validation','revoke']){
  let calls=0,current=true;const recorded=[],failure=Error('real-provider-failure');
  await assert.rejects(runSmartSearch({root:fileURLToPath(new URL('../../',import.meta.url)),tenantId:'synthetic-smart-failure-'+reason,query:'public topic',networkEnabled:true,authorize:async()=>current,authorizeNetwork:async()=>true,tokenBudget:30000,startRuntime:fakeHarness(),recordUsage:r=>recorded.push(r.usage.totalTokens),providerCall:async()=>{
   calls++;if(calls===2&&reason==='provider')throw failure;if(reason==='revoke')current=false;
   return{content:calls===1?'':JSON.stringify({answer:'forged',sourceIds:['W999'],limitations:'unknown'}),toolCalls:calls===1?[search()]:[],usedMock:false,usage:{promptTokens:10,completionTokens:5,totalTokens:15}};
  }}));
  assert.deepEqual(recorded,reason==='validation'?[15,15]:[15]);assert.equal(calls,reason==='revoke'?1:2);
 }
});
test('a recoverable unread page is not source evidence and preserves its actual failure',()=>{
 const failure={sourceId:'W2',url:'https://example.org/missing',code:'WEB_HTTP_403',hash:'failed-read-hash'},state={pending:[{id:'bad',name:'hub_public_webfetch',arguments:'{}'}],sources:[],tools:[],readResults:new Map(),readFailures:new Map([['bad',failure]])};
 const result=canonicalToolResults([{role:'tool',tool_call_id:'bad',content:JSON.stringify({failure})}],state);assert.equal(JSON.parse(result[0].content).unavailableSource.code,'WEB_HTTP_403');assert.equal(state.sources.length,0);
});
test('actual isolated OpenCode completes two reads and partial fixed synthesis without a second external phase',{timeout:60000},async()=>{
 const recorded=[];let calls=0,reads=0;
 const result=await runSmartSearch({root:fileURLToPath(new URL('../../',import.meta.url)),tenantId:'synthetic-smart-partial',query:'读取 https://example.org/good 与 https://example.org/blocked 并比较来源',networkEnabled:true,authorize:async()=>true,authorizeNetwork:async()=>true,tokenBudget:12288,recordUsage:r=>recorded.push(r.usage.totalTokens),readPage:async(url,options)=>{
  await options.authorize();reads++;if(url.endsWith('/blocked'))throw Object.assign(Error('WEB_HTTP_403'),{code:'WEB_HTTP_403'});return{url,title:'Synthetic public fixture',text:'Synthetic public evidence for transport testing only.',coverage:'webpage-excerpt',retrievedAt:new Date().toISOString(),textHash:'synthetic-page-hash'};
 },providerCall:async(messages,tools)=>{
  calls++;if(calls===1)return{content:'',toolCalls:[{id:'good',name:'hub_public_webfetch',arguments:'{"url":"https://example.org/good"}'},{id:'blocked',name:'hub_public_webfetch',arguments:'{"url":"https://example.org/blocked"}'}],usedMock:false,usage:{promptTokens:10,completionTokens:5,totalTokens:15}};
  assert.deepEqual(tools,[]);assert.equal(messages.length,2);const input=JSON.parse(messages[1].content);assert.equal(input.sources.length,1);assert.equal(input.unavailableSources.length,1);
  return{content:JSON.stringify({claims:[{kind:'source_fact',text:'仅能说明已读取来源。',sourceIds:['W1'],quotes:[{sourceId:'W1',text:'Synthetic public evidence for transport testing only.'}]}],limitations:'另一页未读，不能完整比较。'}),toolCalls:[],usedMock:false,usage:{promptTokens:10,completionTokens:5,totalTokens:15}};
 }});
 assert.equal(calls,2);assert.equal(reads,2);assert.deepEqual(recorded,[15,15]);assert.equal(result.validation.status,'partial');assert(result.text.includes('https://example.org/blocked'));assert.equal(result.tools.filter(t=>t.status==='failed').length,1);
});
test('no source proof or missing business reservation cannot become a successful web run',async()=>{
 let calls=0;await assert.rejects(runSmartSearch({root:fileURLToPath(new URL('../../',import.meta.url)),tenantId:'synthetic-smart-no-reserve',query:'public topic',networkEnabled:true,authorize:async()=>true,authorizeNetwork:async()=>true,tokenBudget:undefined,startRuntime:fakeHarness(),recordUsage:()=>{},providerCall:async()=>{calls++;}}),/SMART_RESERVATION_LIMIT/);assert.equal(calls,0);
});
test('a new fixed-source run cannot accept the old free-form answer without paragraph grounding',async()=>{
 const recorded=[];
 await assert.rejects(runSmartSearch({root:fileURLToPath(new URL('../../',import.meta.url)),tenantId:'synthetic-grounding-no-fallback',query:'解释固定来源',sources:[{id:'W1',url:'https://example.org/',title:'Public source',text:'A real public research excerpt.',coverage:'webpage-excerpt'}],networkEnabled:false,authorize:async()=>true,authorizeNetwork:async()=>{throw Error('must not network');},tokenBudget:30000,startRuntime:fakeHarness(),recordUsage:r=>recorded.push(r.usage.totalTokens),providerCall:async()=>({content:JSON.stringify({answer:'随意概括。[W1]',sourceIds:['W1'],limitations:'固定选段'}),toolCalls:[],usedMock:false,usage:{promptTokens:10,completionTokens:5,totalTokens:15}})}),/SMART_OUTPUT_INVALID/);
 assert.deepEqual(recorded,[15]);
});
