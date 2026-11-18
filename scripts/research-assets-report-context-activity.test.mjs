import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetDetailReader} from './research-assets-detail-read.mjs';
test('missing source review facts are refused rather than returned as a successful partial review',async()=>{
 const s=createAssetDetailReader({withAccess:(_u,_p,run)=>run({$queryRawUnsafe:async()=>[{asset_revision:6,event_type:'reviewed',version_no:2,created_at:new Date(),actor_name:'admin',reason:null,conclusion:'approved'}]},{}),readFixed:async()=>({bodyAccess:'allowed',family:'report_context',identityRevision:'a'.repeat(64)})});
 await assert.rejects(()=>s.activity({},'asset',2),e=>e.status===409);
});
test('report context activity carries its actual review conclusion/reason; old family projections stay unchanged',async()=>{
 let family='report_context',access='allowed',queries=0;
 const service=createAssetDetailReader({withAccess:(_u,_p,run)=>run({$queryRawUnsafe:async()=>{queries++;return[{asset_revision:6,event_type:'reviewed',version_no:2,created_at:new Date('2026-11-16T00:00:00Z'),actor_name:'真实管理员',reason:'核对历史来源后通过',conclusion:'approved'}];}},{}),readFixed:async()=>({bodyAccess:access,family,identityRevision:'a'.repeat(64)})});
 const v=await service.activity({},'asset',2);assert.equal(v.items[0].reason,'核对历史来源后通过');assert.equal(v.items[0].conclusion,'approved');
 family='catalog';const old=await service.activity({},'asset',2);assert(!Object.hasOwn(old.items[0],'reason'));
 access='restricted';await assert.rejects(()=>service.activity({},'asset',2),e=>e.status===403);assert.equal(queries,2);
});
