import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./research-assets-detail-read.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return{};});
test('both comparison versions use one current authorization transaction and either restricted version fails closed',async()=>{
 assert.equal(typeof api.createAssetDetailReader,'function');let txs=0,restricted=0;const calls=[];
 const service=api.createAssetDetailReader({withAccess:async(_u,permission,run)=>{txs++;assert.equal(permission,'artifact.read');return run({}, {identityRevision:'a'.repeat(64)});},readFixed:async(_tx,_p,id,v)=>{calls.push(v);return{id,version:v,bodyAccess:v===restricted?'restricted':'allowed',contentMd:'合成正文 '+v,metadata:{title:'合成题名'}};}});
 const r=await service.compare({},'asset1','2',{withVersion:'1'});assert.equal(txs,1);assert.deepEqual(calls,[1,2]);assert.equal(r.before.version,1);assert.equal(r.after.version,2);
 restricted=1;await assert.rejects(service.compare({},'asset1','2',{withVersion:'1'}),e=>e.status===403||e.status===404);
 await assert.rejects(service.compare({},'asset1','2',{withVersion:'1',path:'secret'}),e=>e.status===400);
});
test('a version expiring while the other version loads is not delivered in a comparison',async()=>{
 const deadline=Date.now()-1;const s=api.createAssetDetailReader({withAccess:(_u,_p,run)=>run({},{}),readFixed:async(_t,_p,id,v)=>({id,version:v,bodyAccess:'allowed',bodyExpiresAt:v===1?new Date(deadline).toISOString():null,metadata:{title:'合成'},contentMd:'不能交付的正文'})});
 await assert.rejects(s.compare({},'asset1','2',{withVersion:'1'}),e=>e.status===403);
});
