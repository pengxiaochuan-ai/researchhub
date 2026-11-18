import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {createT16Runs} from './t16-runs.mjs';
import {createFullStudyRuns} from './full-study-runs.mjs';
import {createResearchStudiesController} from '../research-studies/controller.mjs';
import {dispatchStudyService} from '../../scripts/local-full-study-simulation.mjs';

const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('reflect-metadata');
const user={tenantId:'tenant',accountId:'actor',authVersion:0};
const context={tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const stopped=e=>e.status===499&&e.code==='ANALYSIS_LIST_ABORTED';

function listFixture({ids=['one','two'],query,item}={}){
 const calls=[],studies={withResearchStudyTransaction:async(_user,_study,operation,fn)=>{
  calls.push('study:'+operation);
  return fn({researchMethodRun:{findMany:async args=>{calls.push('ids');assert.equal(args.take,50);return query?query(args):ids.map(id=>({id}));}}},context);
 }};
 const methods={getDescriptiveListItem:async(actor,id)=>{assert.equal(actor.researchProjectId,'project');calls.push('item:'+id);return item?item(id):{id,status:'needs_review'};}};
 return{calls,api:createT16Runs({studies,methods})};
}

test('a pre-disconnected list starts no Study query or Methods item',async()=>{
 const f=listFixture(),abort=new AbortController();abort.abort();
 await assert.rejects(f.api.list(user,'study',{signal:abort.signal}),stopped);
 assert.deepEqual(f.calls,[]);
});

test('disconnect during ID query completes that query but starts no item',async()=>{
 const entered=deferred(),rows=deferred(),abort=new AbortController();
 const f=listFixture({query:async()=>{entered.resolve();return rows.promise;}}),pending=f.api.list(user,'study',{signal:abort.signal});
 await entered.promise;abort.abort();rows.resolve([{id:'one'}]);
 await assert.rejects(pending,stopped);assert.deepEqual(f.calls,['study:read','ids']);
});

test('disconnect during one Methods item lets it settle and rejects the whole list before the next',async()=>{
 const entered=deferred(),finish=deferred(),abort=new AbortController();let settled=false;
 const f=listFixture({item:async id=>{if(id==='one'){entered.resolve();await finish.promise;settled=true;}return{id};}});
 const pending=f.api.list(user,'study',{signal:abort.signal});await entered.promise;abort.abort();
 assert.equal(settled,false);assert.equal(f.calls.includes('item:two'),false);finish.resolve();
 await assert.rejects(pending,stopped);assert.equal(settled,true);assert.equal(f.calls.includes('item:two'),false);
});

test('disconnect between items also refuses the next item and never returns an accumulated prefix',async()=>{
 const abort=new AbortController(),f=listFixture({item:async id=>{abort.abort();return{id};}});
 await assert.rejects(f.api.list(user,'study',{signal:abort.signal}),stopped);
 assert.deepEqual(f.calls,['study:read','ids','item:one']);
});

test('normal list keeps the native complete order and current item errors stay authoritative',async()=>{
 const f=listFixture();assert.deepEqual(await f.api.list(user,'study'),{studyId:'study',items:[{id:'one',status:'needs_review'},{id:'two',status:'needs_review'}],limit:50});
 const error=Object.assign(Error('native source forbidden'),{status:403}),abort=new AbortController();
 const failed=listFixture({item:async()=>{abort.abort();throw error;}});
 await assert.rejects(failed.api.list(user,'study',{signal:abort.signal}),e=>e===error);
 assert.equal(failed.calls.includes('item:two'),false);
});

class UnusedCore{executeHubTaskCommandInTransaction(){}enrollInTransaction(){}fixedReferenceStatusInTransaction(){throw Error('unused');}createProtocolVersionInTransaction(){throw Error('unused');}}
function controller(list){
 const Controller=createResearchStudiesController({require,load:()=>UnusedCore,formAdapter:{load:()=>UnusedCore,policy:{}},prisma:{withTenantTransaction:()=>{throw Error('unused');}},scope:{product:'researchhub',allowedTenantIds:['tenant']},origin:'http://127.0.0.1:19501',createAnalysisServices:()=>({analysis:{},runs:{list}})});
 const req=Object.assign(new EventEmitter(),{user}),res=Object.assign(new EventEmitter(),{writableEnded:false,destroyed:false,setHeader(){}});
 return{req,res,read:()=>new Controller().analysisRuns(req,res,undefined,{id:'study'},{}),Controller};
}

test('real Nest passthrough controller forwards bounded signal and discards a disconnected complete result',async()=>{
 const result=deferred();let options;
 const f=controller(async(actor,study,received)=>{assert.equal(actor,user);assert.equal(study,'study');options=received;return result.promise;});
 const pending=f.read();f.res.emit('close');result.resolve({studyId:'study',items:[{id:'one'}],limit:50});
 await assert.rejects(pending,e=>e.getStatus()===499&&e.getResponse().code==='ANALYSIS_LIST_ABORTED');
 assert.equal(options.signal.aborted,true);assert.equal(f.res.listenerCount('close'),0);
});

test('normal incoming req close and completed response close do not cancel, and normal/error exits clean listeners',async()=>{
 const result=deferred();let options;
 const f=controller(async(_u,_s,received)=>{options=received;return result.promise;});
 const pending=f.read();f.req.emit('close');f.res.writableEnded=true;f.res.emit('close');result.resolve({items:[]});
 assert.deepEqual(await pending,{items:[]});assert.equal(options.signal.aborted,false);assert.equal(f.res.listenerCount('close'),0);
 const failed=controller(async()=>{throw Object.assign(Error('native forbidden'),{status:403,code:'ORIGINAL_FORBIDDEN'});});
 await assert.rejects(failed.read(),e=>e.getStatus()===403&&e.getResponse().code==='ORIGINAL_FORBIDDEN');assert.equal(failed.res.listenerCount('close'),0);
});

test('already destroyed response refuses the list before its first service call',async()=>{
 let calls=0;const f=controller(async()=>{calls++;return{items:[]};});f.res.destroyed=true;
 await assert.rejects(f.read(),e=>e.getStatus()===499);assert.equal(calls,0);assert.equal(f.res.listenerCount('close'),0);
});

test('actual full metadata list keeps its two-argument contract through dispatcher with optional internal signal',async()=>{
 const rows=[{id:'group-one',createdAt:'time',meta:{snapshotId:'snapshot',planId:'plan'}}],calls=[];
 const studies={withResearchStudyTransaction:async(_u,id,_op,fn)=>{calls.push(id);return fn({$executeRaw:async()=>1,auditLog:{findMany:async args=>{assert.equal(args.take,50);return rows;}}},context);}};
 const full=createFullStudyRuns({studies,analysis:{assertCurrent(){throw Error('list must not project');}},methods:{createFromWorkbench(){throw Error('list must not execute');}}});
 const ordinary={list:async(_u,id,options)=>({id,signal:options.signal})},dispatch=dispatchStudyService({admission:{isTarget:id=>id==='full-study'},primary:full,legacy:ordinary}),signal=new AbortController().signal;
 assert.deepEqual(await dispatch.list(user,'full-study',{signal}),{studyId:'full-study',items:[{id:'group-one',runGroupId:'group-one',snapshotId:'snapshot',planId:'plan',createdAt:'time'}],limit:50});
 assert.deepEqual(await dispatch.list(user,'ordinary-study',{signal}),{id:'ordinary-study',signal});assert.deepEqual(calls,['full-study']);
});
