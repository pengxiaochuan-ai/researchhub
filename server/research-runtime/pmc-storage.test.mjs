import test from 'node:test';import assert from 'node:assert/strict';import {pmcStorageKey,createPmcObjectReader} from './pmc-storage.mjs';
const asset={localObjectKey:'objects/'+'a'.repeat(64),sha256:'a'.repeat(64),byteCount:3};
test('PMC reader uses the explicitly configured private store and exact tenant/hash namespace',async()=>{
 const expected=Buffer.from('abc');let called=false;const reader=createPmcObjectReader({getBuffer:async(key,max)=>{called=true;assert.equal(key,'tenant/hub-pmc/'+asset.localObjectKey);assert.equal(max,3);return expected;}},'tenant');assert.equal(await reader(asset),expected);assert(called);
});
test('PMC storage rejects traversal, wrong hash, over-limit and unknown-size input before I/O',()=>{
 for(const change of [{localObjectKey:'../objects/'+asset.sha256},{sha256:'b'.repeat(64)},{byteCount:0},{byteCount:50*1024*1024+1}])assert.throws(()=>pmcStorageKey('tenant',{...asset,...change}),/REJECTED/);
});
