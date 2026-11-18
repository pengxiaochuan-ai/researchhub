import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const api=await import('../scripts/ai-session-media-ingest-scope.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const c=JSON.parse(readFileSync(new URL('../.tmp/ai-video-binding-2026-11-16/authorized-scope.json',import.meta.url))),{ids}=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url))),checkpoint=JSON.parse(readFileSync(new URL('../.tmp/ai-media-origin-2026-11-16/live/checkpoint.json',import.meta.url))),registered=JSON.parse(readFileSync(new URL('../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url))).registeredObjects;
test('local fixture boundary stays pinned to approved actors, saved originals and registered target objects',()=>{
 assert(api,'scope validator missing');assert.equal(api.validateMediaIngestScope(c,ids,{checkpoint,registered}),c);
 for(const mutate of [x=>x.actors.owner.accountId=ids.admin,x=>x.actors.owner.mediaId=x.actors.admin.mediaId,x=>x.actors.owner.subjectId=x.actors.admin.subjectId,x=>x.target.executionProjectId='other',x=>x.source.researchProjectId='other']){const changed=structuredClone(c);mutate(changed);assert.throws(()=>api.validateMediaIngestScope(changed,ids,{checkpoint,registered}),/MEDIA_INGEST_SCOPE/);}
});
