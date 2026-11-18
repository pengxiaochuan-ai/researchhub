import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {configureAnalysisListProxy,withAnalysisListLifetime} from './analysis-list-lifetime.mjs';
import {createT16Runs} from '../research-analysis/t16-runs.mjs';

const deferred=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes;});return{promise,resolve};};
const response=()=>Object.assign(new EventEmitter(),{writableEnded:false,destroyed:false});
const listURL='/api/research-studies/study/analysis/runs';
function proxyFixture(url=listURL,method='GET',res=response()){
 const proxy=new EventEmitter(),upstream=Object.assign(new EventEmitter(),{destroyed:false,destroys:0,destroy(){this.destroyed=true;this.destroys++;this.emit('close');}});
 configureAnalysisListProxy(proxy);proxy.emit('proxyReq',upstream,{method,url},res);
 return{proxy,upstream,res};
}

test('proxy installs downstream response-close cancellation before any upstream headers',()=>{
 const f=proxyFixture(listURL+'?cursor=opaque');
 assert.equal(f.res.listenerCount('close'),1);assert.equal(f.upstream.destroys,0);
 f.res.emit('close');f.res.emit('close');
 assert.equal(f.upstream.destroys,1);assert.equal(f.res.listenerCount('close'),0);
});

test('proxy normal completion and upstream close clean listeners without destroying a live request',()=>{
 const normal=proxyFixture();normal.res.writableEnded=true;normal.res.emit('close');assert.equal(normal.upstream.destroys,0);normal.upstream.emit('close');assert.equal(normal.res.listenerCount('close'),0);
 const early=proxyFixture();early.upstream.emit('close');assert.equal(early.res.listenerCount('close'),0);early.res.emit('close');assert.equal(early.upstream.destroys,0);
});

test('already disconnected proxy response destroys only its original request and leaves no listener',()=>{
 const res=response();res.destroyed=true;const f=proxyFixture(listURL,'GET',res);
 assert.equal(f.upstream.destroys,1);assert.equal(res.listenerCount('close'),0);assert.equal(f.upstream.listenerCount('close'),0);
});

test('other methods, exact run reads, auth and unrelated GETs never gain proxy disconnect hooks',()=>{
 for(const [url,method]of [[listURL,'POST'],[listURL+'/run-one','GET'],[listURL+'/','GET'],['/api/auth/me','GET'],['/api/research-studies/study/due-visits','GET'],['/api/research-studies/study/analysis/plans','GET']]){
  const f=proxyFixture(url,method);assert.equal(f.res.listenerCount('close'),0);assert.equal(f.upstream.listenerCount('close'),0);f.res.emit('close');assert.equal(f.upstream.destroys,0);
 }
});

test('each proxy request owns its listener and one closed response cannot destroy another',()=>{
 const a=proxyFixture(),b=proxyFixture();a.res.emit('close');assert.equal(a.upstream.destroys,1);assert.equal(b.upstream.destroys,0);b.upstream.emit('close');assert.equal(b.res.listenerCount('close'),0);
});

test('lifetime preserves original read failure after disconnect and always removes its listener',async()=>{
 const res=response(),result=deferred(),error=Object.assign(Error('original source failure'),{status:403});
 const pending=withAnalysisListLifetime(res,async()=>{await result.promise;throw error;});res.emit('close');result.resolve();
 await assert.rejects(pending,e=>e===error);assert.equal(res.listenerCount('close'),0);
});

test('proxy-to-target-response-to-native-loop propagation lets the current item finish and starts no next item',async()=>{
 const target=response(),entered=deferred(),finish=deferred(),calls=[];
 const f=proxyFixture();f.upstream.destroy=function(){this.destroyed=true;this.destroys++;target.emit('close');this.emit('close');};
 const api=createT16Runs({studies:{withResearchStudyTransaction:async(_u,_s,_op,fn)=>fn({researchMethodRun:{findMany:async()=>[{id:'one'},{id:'two'}]}},{tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'})},methods:{getDescriptiveListItem:async(_u,id)=>{calls.push('start:'+id);if(id==='one'){entered.resolve();await finish.promise;}calls.push('finish:'+id);return{id};}}});
 const pending=withAnalysisListLifetime(target,signal=>api.list({tenantId:'tenant'},'study',{signal}));
 await entered.promise;f.res.emit('close');assert.deepEqual(calls,['start:one']);finish.resolve();
 await assert.rejects(pending,e=>e.status===499&&e.code==='ANALYSIS_LIST_ABORTED');
 assert.deepEqual(calls,['start:one','finish:one']);assert.equal(target.listenerCount('close'),0);assert.equal(f.res.listenerCount('close'),0);
});

test('actual startup inline proxy object preserves target and installs the narrow configure callback',()=>{
 const source=readFileSync(new URL('../../scripts/local-knowledge.mjs',import.meta.url),'utf8');
 const expression=source.match(/vite=await createServer\((\{root:.*)\);await vite\.listen\(\);/)[1];
 const config=new Function('root','key','ids','configureAnalysisListProxy','return ('+expression+')')('/synthetic/','key',{tenant:'tenant'},configureAnalysisListProxy);
 assert.equal(config.server.host,'127.0.0.1');assert.equal(config.server.port,19501);assert.equal(config.server.strictPort,true);
 assert.equal(config.server.proxy['/api'].target,'http://127.0.0.1:19502');assert.equal(config.server.proxy['/api'].configure,configureAnalysisListProxy);
 assert.equal(config.server.proxy['/api'].changeOrigin,true);assert.equal(config.server.proxy['/api'].rewrite,undefined);assert.equal(config.server.proxy['/api'].rewriteWsOrigin,undefined);
 assert.equal(config.configFile,'/synthetic/researchhub/vite.config.js');assert.deepEqual(Object.keys(config.server.proxy),['/api']);
});
