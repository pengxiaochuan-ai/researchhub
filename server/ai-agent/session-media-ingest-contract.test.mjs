import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./session-media-ingest-contract.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const media=()=>({id:'media',account_id:'owner',session_id:'session',study_group_id:'source-g',research_project_id:'source-p',version:5,source_sha256:'a'.repeat(64),byte_size:100,inspection_state:'complete',inspection_classification:'valid',archive_state:'archived',inspection_attempt_id:'attempt',inspection:{hasVideo:true,hasAudio:false,durationSeconds:1.5}});
const target=()=>({studyId:'study',studyGroupId:'group',researchProjectId:'execution',subject:{id:'subject',subjectId:'SYNTHETIC-01'},visit:null,enrollment:null,protocol:null,collectedAt:null});
test('MVB contract requires an existing exact target and rejects client paths, extra authority and malformed dates',()=>{
 assert(api,'MVB contract missing');const valid={requestKey:'key',studyId:'study',subjectId:'subject'};
 assert.deepEqual(api.normalizeMediaIngest(valid),{...valid,subjectVisitId:null,collectedAt:null});
 for(const patch of [{storageKey:'private/path'},{subjectId:''},{subjectId:'../other'},{createSubject:true},{collectedAt:'yesterday'},{subjectVisitId:12}])assert.throws(()=>api.normalizeMediaIngest({...valid,...patch}),e=>e.code==='MEDIA_INGEST_INPUT');
 assert.equal(api.normalizeMediaIngest({...valid,collectedAt:'2026-11-16T08:00:00+08:00'}).collectedAt,'2026-11-16T00:00:00.000Z');
});
test('MVB evidence uses only a real readable video check; silent video remains valid',()=>{
 assert(api,'MVB contract missing');assert.equal(api.mediaInspectionRef(media()).hasAudio,false);
 for(const patch of [{archive_state:'pending'},{inspection_state:'running'},{inspection_classification:'corrupt'},{inspection:{hasVideo:false,hasAudio:true}},{source_sha256:null}])assert.throws(()=>api.mediaInspectionRef({...media(),...patch}),e=>e.code==='MEDIA_INGEST_SOURCE_UNAVAILABLE');
});
test('confirmation freezes source, target, check, current authority and actual collection time without scientific invention',()=>{
 assert(api,'MVB contract missing');const permissionRef={kind:'grant',id:'permit',version:1};
 const initial=api.mediaIngestSnapshot(media(),target(),permissionRef);
 assert.equal(initial.hash,api.mediaIngestSnapshot(media(),target(),permissionRef).hash);assert.equal(initial.target.collectedAt,null);
 for(const m of [{...media(),version:6},{...media(),inspection_attempt_id:'new'}])assert.notEqual(initial.hash,api.mediaIngestSnapshot(m,target(),permissionRef).hash);
 for(const t of [{...target(),subject:{id:'other',subjectId:'S2'}},{...target(),collectedAt:'2026-01-01T00:00:00.000Z'}])assert.notEqual(initial.hash,api.mediaIngestSnapshot(media(),t,permissionRef).hash);
 assert.notEqual(initial.hash,api.mediaIngestSnapshot(media(),target(),{...permissionRef,version:2}).hash);
 assert.equal(JSON.stringify(initial).includes('storageKey'),false);assert.equal(Object.hasOwn(initial,'features'),false);
});
