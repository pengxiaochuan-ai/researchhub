import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicActivityReader} from './service.mjs';
const scope={tenantId:'tenant-a',hubKey:'lingshu-xinyu'};
const now=()=>new Date('2026-11-23T06:00:00Z');
const current={category:'researcher',entityKey:'current',title:'公开合成研究者',timeStatus:'historical_undated',firstPublicAt:null,proofRefs:[]};
function setup(overrides={}){return createPublicActivityReader({tenantId:scope.tenantId,transact:fn=>fn({}),findHub:async()=>({key:scope.hubKey}),readSources:async()=>({records:[current],categoryStatuses:{}}),readFacts:async()=>({status:'ready',facts:[]}),readPublicContent:async()=>[],now,...overrides});}
test('existing verified fact dates only current public records; withdrawn snapshots cannot reappear',async()=>{
 const read=setup({readFacts:async()=>({status:'ready',facts:[{...current,timeStatus:'verified',firstPublicAt:'2026-11-22T18:00:00Z',proofRefs:['event:current']},{...current,entityKey:'withdrawn',title:'撤下的私密标题',timeStatus:'verified',firstPublicAt:'2026-11-23T05:00:00Z',proofRefs:['event:withdrawn']}]})});
 const result=await read(scope.hubKey,{limit:'4'});assert.equal(result.items.length,1);assert.equal(result.items[0].count,1);assert.equal(JSON.stringify(result).includes('撤下的私密标题'),false);
});
test('invalid queries fail before all IO; unknown Hub returns explicit missing',async()=>{
 let reads=0;const read=setup({readPublicContent:async()=>{reads++;return[];}});
 await assert.rejects(()=>read(scope.hubKey,{limit:'40'}),/QUERY_INVALID/);assert.equal(reads,0);
 await assert.rejects(()=>setup({findHub:async()=>null})(scope.hubKey,{}),/HUB_NOT_FOUND/);
});
test('content snapshot finishes before scoped transaction to avoid nesting authorization locks',async()=>{
 const events=[];const read=setup({readPublicContent:async()=>{events.push('content');return['actual-public'];},transact:async fn=>{events.push('tx');return fn({});},readSources:async({readPublicContent})=>{assert.deepEqual(await readPublicContent(),['actual-public']);return{records:[],categoryStatuses:{}};}});
 await read(scope.hubKey,{});assert.deepEqual(events,['content','tx']);
});
test('absent ledger is partial and never marks historical data as today',async()=>{
 const result=await setup({readFacts:async()=>({status:'unavailable',facts:[]})})(scope.hubKey,{});
 assert.equal(result.status,'partial');assert.equal(result.ledgerStatus,'unavailable');assert.deepEqual(result.items,[]);
});
test('content failure is passed to source adapter, not converted to success empty data',async()=>{
 const read=setup({readPublicContent:async()=>{throw Error('CONTENT_UNAVAILABLE');},readSources:async({readPublicContent})=>{await assert.rejects(readPublicContent,/CONTENT_UNAVAILABLE/);return{records:[],categoryStatuses:{platform_content:{status:'unavailable',coverage:'unknown'}}};}});
 const result=await read(scope.hubKey,{});assert.equal(result.status,'partial');assert.equal(result.categoryStatuses.platform_content.status,'unavailable');
});
test('real database errors propagate rather than return empty successful result',async()=>{
 await assert.rejects(()=>setup({readSources:async()=>{throw Error('database offline');}})(scope.hubKey,{}),/database offline/);
});
test('verified ledger coverage upgrades historical dates without masking source coverage gaps',async()=>{
 const result=await setup({readSources:async()=>({records:[current],categoryStatuses:{researcher:{status:'ready',coverage:'partial',dateCoverage:'partial'}}}),readFacts:async()=>({status:'ready',facts:[{...current,timeStatus:'verified',firstPublicAt:'2026-11-23T01:00:00Z',proofRefs:['event:verified']}]})})(scope.hubKey,{});
 assert.equal(result.categoryStatuses.researcher.dateCoverage,'complete');assert.equal(result.categoryStatuses.researcher.coverage,'partial');assert.equal(result.items[0].count,1);assert.equal(result.status,'partial');
});
