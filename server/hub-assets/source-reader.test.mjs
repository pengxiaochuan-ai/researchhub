import test from 'node:test';
import assert from 'node:assert/strict';
import {createHubAssetSourceReader} from './source-reader.mjs';
const hash='a'.repeat(64);
function setup({valid=true}={}){
 const calls=[],base={entryId:'entry',version:1,contentHash:hash,sourceType:'fixed-report',studyId:'study',reportId:'report',reportVersion:1,reportHash:hash};
 const tx={$queryRawUnsafe:async(sql,...args)=>{calls.push([sql,...args]);return sql.includes('report_bundle')?[{data:{actorId:'recipient',opaque:'server-only-current-provenance'}}]:[{data:base}];}};
 const reader=createHubAssetSourceReader({verifyReport:async(bundle,expected)=>{calls.push(['verify',bundle,expected]);if(!valid)throw Object.assign(Error('source changed'),{status:409});return{reportId:expected.reportId,version:1,contentHash:hash,contentMd:'fixed report'};}});
 return{reader,tx,calls};
}
test('fixed reports require native provenance verification before body/copy delivery in the same transaction',async()=>{
 const {reader,tx,calls}=setup();const r=await reader(tx,{id:'entry'},'copy');assert.equal(r.contentMd,'fixed report');assert(calls.some(c=>c[0].includes('report_bundle')&&c[1]==='entry'&&c[2]==='copy'));assert.deepEqual(calls.find(c=>c[0]==='verify')[2],{studyId:'study',reportId:'report',version:1,contentHash:hash});assert(!('opaque'in r));
});
test('metadata and citations still validate upstream but never return report body or raw source rows',async()=>{
 for(const purpose of ['probe','cite']){const {reader,tx,calls}=setup();const r=await reader(tx,{id:'entry'},purpose);assert.equal(r.contentMd,undefined);assert(calls.some(c=>c[0]==='verify'));assert.equal(r.opaque,undefined);}
});
test('invalid report provenance becomes unavailable without fallback to the stored text',async()=>{
 const {reader,tx}=setup({valid:false});assert.equal(await reader(tx,{id:'entry'},'read'),null);
});
test('original source reader retains existing behavior and does not call the report verifier',async()=>{
 let checked=false;const reader=createHubAssetSourceReader({verifyReport:async()=>{checked=true;}}),tx={$queryRawUnsafe:async()=>[{data:{entryId:'original',version:1,contentHash:hash,contentMd:'original'}}]};assert.equal((await reader(tx,{id:'original'},'read')).contentMd,'original');assert.equal(checked,false);
});

test('unsupported or malformed source declarations are rejected without throwing',async()=>{
 const {supportsHubAssetSource}=await import('./source-reader.mjs');
 for(const value of [null,{}, {sourceKind:'artifact'}, {sourceKind:'artifact',sourceBindings:{}}, {sourceKind:'artifact',sourceBindings:[]}, {sourceKind:'author',sourceBindings:[{}]}])assert.equal(supportsHubAssetSource(value),false);
});
