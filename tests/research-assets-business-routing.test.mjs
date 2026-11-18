import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalBusinessAssetCatalog} from '../server/research-assets/business-local-catalog.mjs';
const ids={tenant:'t',group:'g',project:'a',owner:'owner',admin:'admin'},user={tenantId:'t',studyGroupId:'g',researchProjectId:'a',accountId:'owner'};
const id='rhab-11111111-1111-4111-8111-111111111111';
function setup(){const calls=[],blocked=Error('new current authorization boundary'),legacy=Object.fromEntries(['reader','registration','views','details','governance','lifecycle','usage'].map(key=>[key,Object.fromEntries((key==='reader'?['detail','preview','catalog']:key==='registration'?['options','register','revise','edit','operation']:key==='views'?['read']:key==='details'?['compare','activity','tags']:['options','execute']).map(name=>[name,async(...args)=>{calls.push({key,name,args});return 'legacy';}]))]));legacy.assertSources=async()=>false;return{calls,blocked,service:createLocalBusinessAssetCatalog({ids,legacy,transaction:async()=>{throw blocked;}})};}
test('legacy fixed versions, options, upload edits and replay remain on their original adapters',async()=>{
 const{service,calls}=setup();assert.equal(await service.registration.options(user,'legacy-file'),'legacy');assert.equal(await service.registration.edit(user,'legacy-file',2),'legacy');assert.equal(await service.reader.detail(user,'old-report',1),'legacy');assert.equal(await service.details.activity(user,'old-report',1,{}),'legacy');assert.equal(calls.length,4);
});
test('new business identifiers and default registration never enter the old fixture service',async()=>{
 const{service,calls,blocked}=setup();await assert.rejects(service.registration.options(user),e=>e===blocked);await assert.rejects(service.reader.detail(user,id,1),e=>e===blocked);await assert.rejects(service.details.compare(user,id,2,{withVersion:'1'}),e=>e===blocked);assert.equal(calls.length,0);
});
test('unapproved local identity or Study is rejected before the database',async()=>{
 const{service,calls}=setup();await assert.rejects(service.registration.options({...user,accountId:'third'}),e=>e.status===403);await assert.rejects(service.reader.detail({...user,researchProjectId:'other'},id,1),e=>e.status===403);assert.equal(calls.length,0);
});
test('usage routes old objects to their old adapter and new objects to current business authorization',async()=>{
 const{service,calls,blocked}=setup();assert.equal(await service.usage.options(user,'legacy-file',2),'legacy');
 await assert.rejects(service.usage.options(user,id,3),e=>e===blocked);assert.equal(calls.length,1);assert.equal(calls[0].key,'usage');
});
