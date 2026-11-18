import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const module=await import('../src/research-assets-read-boundary.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('read failure synchronously interrupts upload continuations and prevents late success after recovery',async()=>{
 assert.equal(typeof module.createAssetReadBoundary,'function');const b=module.createAssetReadBoundary();b.ready();let finish,posted=0;const interrupted=[];
 b.subscribe(e=>interrupted.push(e));
 const api=b.guard({upload:()=>new Promise(r=>{finish=r;}),post:async()=>posted++}),upload=api.upload('/upload',{});b.fail({status:503});b.ready();finish({uploadId:'staged'});
 await assert.rejects(upload,e=>e.status===503);assert.equal(interrupted.length,1);assert.equal(interrupted[0].authorizationLost,false);assert.equal(posted,0);
 const saved=b.guard({post:()=>new Promise(r=>{finish=r;})}).post('/save',{});b.fail({status:403});finish({status:'committed'});await assert.rejects(saved);assert.equal(b.blocked(),true);assert.equal(interrupted[1].authorizationLost,true);
});
test('all four hooks subscribe to the workspace failure boundary instead of only identity changes',()=>{
 const work=readFileSync(new URL('../pages/shared/ResearchAssetCatalogWorkspace.jsx',import.meta.url),'utf8');assert.match(work,/readBoundary\.fail\(e\)/);assert.match(work,/readBoundary\.guard\(/);
 for(const name of ['Registration','Governance','Usage','Lifecycle']){const hook=readFileSync(new URL('../pages/shared/useAsset'+name+'.jsx',import.meta.url),'utf8');assert.match(hook,/readBoundary\??\.subscribe/);assert.match(hook,/authorizationLost/);assert.match(hook,/\.pause\(/);}
});
