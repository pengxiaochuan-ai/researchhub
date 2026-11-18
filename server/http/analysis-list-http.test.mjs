import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as createViteServer} from 'vite';
import {configureAnalysisListProxy} from './analysis-list-lifetime.mjs';

const before=process.env.WF07_LIST_DISCONNECT_BEFORE==='explicit';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('reflect-metadata');
const saved='../../docs/testing/evidence/study-workflow-simplification-2026-11-17/wf07/list-disconnect-before/';
const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return{promise,resolve};};
const within=async(promise,ms=2500)=>{let timer;try{return await Promise.race([promise.then(()=>true),new Promise(yes=>{timer=setTimeout(()=>yes(false),ms);})]);}finally{clearTimeout(timer);}};
async function version(path){
 const original=new URL('../'+path,import.meta.url);
 if(!before)return import(original.href);
 const source=readFileSync(new URL(saved+'server/'+path,import.meta.url),'utf8').replace(/(from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g,(_all,prefix,spec)=>prefix+JSON.stringify(new URL(spec,original).href));
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
class UnusedCore{executeHubTaskCommandInTransaction(){}enrollInTransaction(){}fixedReferenceStatusInTransaction(){throw Error('unused');}createProtocolVersionInTransaction(){throw Error('unused');}}
const listen=server=>new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',()=>{server.off('error',no);yes(server.address().port);});});
const close=server=>new Promise(yes=>{server.close(yes);server.closeAllConnections();});

async function fixture({hold=false}={}){
 const [{createT16Runs},{createResearchStudiesController}]=await Promise.all([version('research-analysis/t16-runs.mjs'),version('research-studies/controller.mjs')]);
 const entered=deferred(),finish=deferred(),complete=deferred(),apiClosed=deferred(),done=deferred(),trace={items:[],headers:false};
 const user={tenantId:'tenant',accountId:'actor',authVersion:0},context={tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'};
 const runs=createT16Runs({studies:{withResearchStudyTransaction:async(_u,_s,_op,fn)=>fn({researchMethodRun:{findMany:async()=>[{id:'one'},{id:'two'}]}},context)},methods:{getDescriptiveListItem:async(_u,id)=>{trace.items.push('start:'+id);if(hold&&id==='one'){entered.resolve();await finish.promise;}trace.items.push('finish:'+id);return{id,status:'needs_review'};}}});
 const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction(){throw Error('unused');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'http://127.0.0.1',createAnalysisServices:()=>({analysis:{},runs:{list:(u,id,options)=>{trace.signal=options?.signal;return runs.list(u,id,options);}}})});
 const api=http.createServer(async(req,res)=>{
  trace.apiResponse=res;req.user=user;req.on('end',()=>{trace.incomingComplete=req.complete;complete.resolve();});req.resume();res.once('close',()=>apiClosed.resolve());
  try{const value=await new Controller().analysisRuns(req,res,undefined,{id:'study'},{});trace.value=value;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));}
  catch(error){trace.status=error.getStatus?.()??error.status;trace.code=error.getResponse?.().code??error.code;if(!res.destroyed){res.statusCode=trace.status??500;res.end();}}
  finally{done.resolve();}
 });
 const apiPort=await listen(api),directory=mkdtempSync(join(tmpdir(),'wf07-list-http-'));
 const source=readFileSync(before?new URL(saved+'scripts/local-knowledge.mjs',import.meta.url):new URL('../../scripts/local-knowledge.mjs',import.meta.url),'utf8');
 const expression=source.match(/vite=await createServer\((\{root:.*)\);await vite\.listen\(\);/)[1];
 const runtime=new Function('root','key','ids','configureAnalysisListProxy','return ('+expression+')')(directory+'/','fixture',{tenant:'tenant'},configureAnalysisListProxy);
 const original=runtime.server.proxy['/api'],options=typeof original==='string'?{target:original,changeOrigin:true}:{...original},configure=options.configure;
 options.target='http://127.0.0.1:'+apiPort;options.configure=(proxy,...args)=>{configure?.(proxy,...args);proxy.on('proxyReq',(_upstream,_req,res)=>{trace.proxyResponse=res;});};
 const vite=await createViteServer({configFile:false,root:directory,cacheDir:join(directory,'cache'),logLevel:'silent',server:{middlewareMode:true,hmr:false,watch:null,proxy:{'/api':options}}});
 const proxy=http.createServer(vite.middlewares),proxyPort=await listen(proxy);
 return{trace,entered,finish,complete,apiClosed,done,url:'http://127.0.0.1:'+proxyPort+'/api/research-studies/study/analysis/runs',async cleanup(){finish.resolve();await within(done.promise);await close(proxy);await vite.close();await close(api);rmSync(directory,{recursive:true,force:true});}};
}

test('real Vite proxy and actual API return the complete normal list',async()=>{
 const f=await fixture();try{
  const response=await fetch(f.url);assert.equal(response.status,200);assert.deepEqual(await response.json(),{studyId:'study',items:[{id:'one',status:'needs_review'},{id:'two',status:'needs_review'}],limit:50});
  assert.deepEqual(f.trace.items,['start:one','finish:one','start:two','finish:two']);assert.equal(f.trace.incomingComplete,true);assert.equal(await within(f.apiClosed.promise),true);assert.equal(f.trace.apiResponse.listenerCount('close'),0);
 }finally{await f.cleanup();}
});

test('real GET completed inbound but pre-header client disconnect reaches API and stops only the next item',async()=>{
 const f=await fixture({hold:true});let client;
 try{
  client=http.get(f.url,response=>{f.trace.headers=true;response.resume();});client.on('error',()=>{});
  assert.equal(await within(f.entered.promise),true);assert.equal(await within(f.complete.promise),true);assert.equal(f.trace.incomingComplete,true);assert.equal(f.trace.apiResponse.headersSent,false);assert.equal(f.trace.headers,false);
  client.destroy();
  assert.equal(await within(f.apiClosed.promise),true,'pre-header client disconnect must close the actual API response');
  assert.equal(f.trace.signal?.aborted,true);assert.deepEqual(f.trace.items,['start:one']);
  f.finish.resolve();assert.equal(await within(f.done.promise),true);assert.deepEqual(f.trace.items,['start:one','finish:one']);assert.equal(f.trace.status,499);assert.equal(f.trace.code,'ANALYSIS_LIST_ABORTED');assert.equal(f.trace.value,undefined);
  assert.equal(f.trace.apiResponse.listenerCount('close'),0);assert.equal(f.trace.proxyResponse.listenerCount('close'),0);
 }finally{client?.destroy();await f.cleanup();}
});
