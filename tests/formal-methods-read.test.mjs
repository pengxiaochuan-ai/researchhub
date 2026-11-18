import test from 'node:test';
import assert from 'node:assert/strict';
import {readMethodsCurrent,createMethodsListReader} from '../src/formal-methods-read.js';

const hash='a'.repeat(64),basis={studyId:'study',planId:'plan',snapshotId:'snap',manifestHash:hash};
const source={basis,manifest:{rowCount:1,subjectCount:1,statisticalUnit:'subject',variables:[{key:'value',valueType:'number'},{key:'completed',valueType:'boolean'}]}};
const caps={studyId:'study',runId:'run',status:'needs_review',reviewStatus:'pending_review',capabilities:{canReview:true,canCancel:true}};
function fixture(){
 const outputs={manifestHash:hash,rowCount:1,statisticalUnit:'subject',columns:{value:{type:'number',total:1,observed:1,missing:0,status:'single_observation',min:0,max:0,mean:0,median:0,sampleStdDev:null},completed:{type:'boolean',total:1,observed:1,missing:0,status:'available',trueCount:0,falseCount:1}}};
 const numericEvidence=[{name:'rowCount',value:1,operator:'descriptive-summary',operatorVersion:'descriptive-v1',assumptions:['manifestHash:'+hash]}];
 for(const[key,column]of Object.entries(outputs.columns))for(const[name,value]of Object.entries(column))if(typeof value==='number')numericEvidence.push({name:'columns.'+key+'.'+name,value,operator:'descriptive-summary',operatorVersion:'descriptive-v1',assumptions:['manifestHash:'+hash]});
 return {id:'run',studyId:'study',skillKey:'descriptive-statistics',status:caps.status,reviewStatus:caps.reviewStatus,inputHash:hash,inputSummary:{studyId:'study',snapshotId:'snap'},dataSources:{analysisBasis:basis},executorName:'descriptive-summary',executorVersion:'descriptive-v1',skillVersion:1,environment:{llm:false,workerVersion:'t19-1'},outputs,numericEvidence};
}
const options=(extra={})=>({studyId:'study',ids:{runId:'run'},request:async path=>path.endsWith('/capabilities')?caps:fixture(),readSource:async()=>source,...extra});
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
const list=(studyId='study')=>({studyId,limit:50,items:[]});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('exact Run completes without reading or awaiting the independent recent list; original zero/null/false counts survive',async()=>{
 const hold=deferred(),calls=[];const pendingList=hold.promise;let listFinished=false;pendingList.then(()=>listFinished=true);
 const value=await readMethodsCurrent(options({request:async path=>{calls.push(path);assert(!path.endsWith('/runs'));return path.endsWith('/capabilities')?caps:fixture();}}));
 assert.equal(listFinished,false);assert.equal(value.sourceCurrent,true);assert.equal(value.resultValid,true);assert.deepEqual(calls,['/research-studies/study/analysis/runs/run/capabilities','/research-studies/study/analysis/runs/run']);assert.equal(value.run.outputs.columns.value.mean,0);assert.equal(value.run.outputs.columns.value.sampleStdDev,null);assert.equal(value.run.outputs.columns.completed.falseCount,1);hold.resolve();
});
test('exact snapshot uses its source without a list request, while no exact selection is not a fabricated list',async()=>{
 const value=await readMethodsCurrent(options({ids:{planId:'plan',snapshotId:'snap'},request:async()=>assert.fail('no Run or list request expected')}));assert.equal(value.source,source);assert.equal(value.sourceCurrent,true);
 assert.deepEqual(await readMethodsCurrent(options({ids:{},request:async()=>assert.fail('list belongs to independent reader')})),{});
});
test('source409 removes outputs; auth403 propagates; quiet changed input cannot retain previous numbers',async()=>{
 const stale=Object.assign(Error('固定来源已变化'),{status:409,code:'ANALYSIS_VISIT_CHANGED'});
 const blocked=await readMethodsCurrent(options({readSource:async()=>{throw stale;}}));assert.equal(blocked.resultValid,false);assert.equal(blocked.sourceCurrent,false);assert.equal(blocked.run.outputs,undefined);
 await assert.rejects(readMethodsCurrent(options({readSource:async()=>{throw Object.assign(Error('无权限'),{status:403});}})),{status:403});
 const changed=await readMethodsCurrent(options({quiet:true,current:{run:{inputHash:'b'.repeat(64)}}}));assert.equal(changed.resultValid,false);assert.equal(changed.run.outputs,undefined);
});
test('only the fixed recent-list GET has a 60000ms bound, same-origin no-store and metadata-only projection',async()=>{
 const calls=[],timeouts=[];const reader=createMethodsListReader({timeoutSignal:ms=>{timeouts.push(ms);return new AbortController().signal;},fetchImpl:async(path,init)=>{calls.push({path,init});return response({...list(),items:[{...fixture(),createdAt:'2026-11-13T00:00:00Z'}]});}});
 const value=await reader.read('study');assert.deepEqual(timeouts,[60000]);assert.equal(calls[0].path,'/api/research-studies/study/analysis/runs');assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.cache,'no-store');assert.equal(value.items[0].outputs,undefined);assert.equal(value.items[0].numericEvidence,undefined);assert.equal(value.items[0].id,'run');
});
test('late list response after identity invalidation cannot publish old scope, and fresh scope remains readable',async()=>{
 const hold=deferred();let first=true;const reader=createMethodsListReader({fetchImpl:async()=>first?(first=false,hold.promise):response(list('other'))});
 const previous=reader.read('study');reader.invalidate();const next=await reader.read('other');hold.resolve(response(list()));await assert.rejects(previous,e=>e.stale===true);assert.equal(next.studyId,'other');
});
test('list503 is independent of selected detail; list401/403 stay explicit authorization failures',async()=>{
 const reader=createMethodsListReader({fetchImpl:async()=>response({message:'暂不可用',code:'UNAVAILABLE'},503)});
 await assert.rejects(reader.read('study'),{status:503});assert.equal((await readMethodsCurrent(options())).resultValid,true);
 for(const status of [401,403])await assert.rejects(createMethodsListReader({fetchImpl:async()=>response({message:'无权限',code:'RESEARCH_FORBIDDEN'},status)}).read('study'),{status,code:'RESEARCH_FORBIDDEN'});
});
test('invalid parent or leaking blocked rows cannot be accepted as a true empty or safe list',async()=>{
 for(const data of [list('other'),{...list(),items:[{...fixture(),analysisState:'blocked',createdAt:'2026-11-13T00:00:00Z'}]}])await assert.rejects(createMethodsListReader({fetchImpl:async()=>response(data)}).read('study'),/列表暂不可核对/);
});
