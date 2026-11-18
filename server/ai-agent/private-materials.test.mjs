import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const api=await import('./private-materials.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return null;throw error;});
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const sha=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function fixture(){
 const body={schema:'hub-private-materials.v1',principal:{tenantId:'tenant',accountId:'owner',studyGroupId:'group',researchProjectId:'project'},sessionId:'session',materials:[{materialId:'material',version:3,kbId:'base',sourceFileId:'source',sourceSha256:'a'.repeat(64),docId:'doc',docVersion:1,contentSha256:'b'.repeat(64)}]};
 return {snapshot:{...body,hash:sha(body)},metadata:[{materialId:'material',title:'本人文献',reviewed:false,contentLength:30000,lineCount:100}]};
}
test('private read planning is bounded and includes head, middle and tail without calling it a full review',()=>{
 assert.ok(api,'private material reader is missing');const {snapshot,metadata}=fixture();
 const plans=api.planPrivateMaterialReads(snapshot,metadata,{maxChars:1200});
 assert.equal(plans.length,3);assert.equal(plans[0].start,0);assert.equal(plans.at(-1).start+plans.at(-1).length,30000);
 assert(plans[1].start<15000&&plans[1].start+plans[1].length>15000);
 assert.equal(plans.reduce((sum,p)=>sum+p.length,0),1200);
 assert.throws(()=>api.planPrivateMaterialReads(snapshot,metadata,{maxChars:1000000}),/HUB_PRIVATE_READING_LIMIT/);
});
test('private pack binds exact source versions, real line ranges and unreviewed ownership without storage paths',()=>{
 const {snapshot,metadata}=fixture(),plans=api.planPrivateMaterialReads(snapshot,metadata,{maxChars:1200});
 const fragments=plans.map((p,i)=>({...p,text:'x'.repeat(p.length),lineStart:1+i*20,lineEnd:10+i*20}));
 const pack=api.assemblePrivateMaterialPack(snapshot,metadata,plans,fragments,{maxChars:1200});
 assert.equal(pack.schema,'hub-private-material-pack.v1');assert.equal(pack.sources[0].reviewed,false);
 assert.equal(pack.sources[0].coverage.complete,false);assert.equal(pack.sources[0].coverage.readCharacters,1200);
 assert.equal(pack.sources[0].sourceType,'owner-uploaded-draft');assert.equal(pack.sources[0].fragments[1].lineStart,21);
 assert.equal(pack.binding.materials[0].docVersion,1);assert(!JSON.stringify(pack).includes('storageKey'));
 metadata[0].title='changed';fragments[0].text='changed';snapshot.materials[0].docVersion=999;
 assert.equal(pack.sources[0].title,'本人文献');assert.equal(pack.binding.materials[0].docVersion,1);
 assert.equal(api.assertPrivateMaterialPack(pack),pack);assert.deepEqual(api.assertPrivateMaterialPack(canonical(pack)),canonical(pack));assert(Object.isFrozen(pack.sources[0].fragments[0]));
});
test('missing, duplicate or invented excerpts and changed pack hashes are rejected',()=>{
 const {snapshot,metadata}=fixture(),plans=api.planPrivateMaterialReads(snapshot,metadata,{maxChars:1200});
 const rows=plans.map((p,i)=>({...p,text:'x'.repeat(p.length),lineStart:i+1,lineEnd:i+1}));
 assert.throws(()=>api.assemblePrivateMaterialPack(snapshot,metadata,plans,rows.slice(1),{maxChars:1200}),/HUB_PRIVATE_FRAGMENT_CHANGED/);
 assert.throws(()=>api.assemblePrivateMaterialPack(snapshot,metadata,plans,[...rows,rows[0]],{maxChars:1200}),/HUB_PRIVATE_FRAGMENT_CHANGED/);
 assert.throws(()=>api.assemblePrivateMaterialPack(snapshot,metadata,plans,rows.map((r,i)=>i? r:{...r,text:'invented'}),{maxChars:1200}),/HUB_PRIVATE_FRAGMENT_CHANGED/);
 const pack=api.assemblePrivateMaterialPack(snapshot,metadata,plans,rows,{maxChars:1200});assert.throws(()=>api.assertPrivateMaterialPack({...pack,packHash:'0'.repeat(64)}),/HUB_PRIVATE_PACK_CHANGED/);
 assert.throws(()=>api.planPrivateMaterialReads({...snapshot,sessionId:'other'},metadata),/HUB_PRIVATE_BINDING_CHANGED/);
});
