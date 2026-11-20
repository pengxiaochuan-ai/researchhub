import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaIngestNative} from '../../scripts/ai-session-media-ingest-native.mjs';
const user={tenantId:'tenant',accountId:'owner',authVersion:1},ctx={studyId:'study',studyGroupId:'group',executionProjectId:'project',projectIntentId:'intent'},source={sessionId:'new-session',studyGroupId:'source-group',researchProjectId:'source-project'};
function fixture({enabled=true,native=true}={}){
 const seen=[],grant={id:'grant',version:1,subject_ids:['owned'],visit_ids:[]};
 const tx={$queryRawUnsafe:async sql=>sql.includes('session_media_ingest_access')?[grant]:[{title:'Study'}],subject:{findFirst:async q=>{seen.push(q.where);return q.where.createdBy?{id:'owned',subjectId:'OWN'}:{id:'other',subjectId:'OTHER'};},findMany:async q=>{seen.push(q.where);return[{id:q.where.createdBy?'owned':'other',subjectId:'S01'}];}},studyEnrollment:{findFirst:async()=>null},subjectVisit:{findMany:async()=>[]}};
 const load=(path)=>path==='ingest/ingest-authorization'?async()=>{if(!native)throw Object.assign(Error('denied'),{status:403});}:async()=>{};
 const api=createMediaIngestNative({load,scopeKey:'scope',allowNativeTargets:enabled,boundary:()=>({mediaIds:['old-media'],subjectIds:['owned'],visitIds:[]})});
 return{api,tx,seen};
}
test('opted-in current native ingest authorizes a new own source and noncreator target; defaults retain fixed boundary',async()=>{
 const f=fixture(),permission=await f.api.currentInTx(f.tx,user,ctx,source,{capability:'media.register',mediaId:'new-media',subjectId:'other'});
 const target=await f.api.targetInTx(f.tx,user,ctx,'other',null,null,{permission});assert.equal(target.subject.id,'other');assert.equal(f.seen[0].createdBy,undefined);
 const candidates=await f.api.candidatesInTx(f.tx,user,ctx,permission);assert.equal(candidates.subjects[0].id,'other');assert.equal(f.seen[1].createdBy,undefined);
 const legacy=fixture({enabled:false});await assert.rejects(legacy.api.currentInTx(legacy.tx,user,ctx,source,{capability:'media.register',mediaId:'new-media',subjectId:'other'}),e=>e.code==='MEDIA_INGEST_PERMISSION');
});
test('absent native ingest retains the old exact grant, creator filter and boundary',async()=>{
 const f=fixture({native:false});await assert.rejects(f.api.currentInTx(f.tx,user,ctx,source,{capability:'media.register',mediaId:'new-media',subjectId:'other'}),e=>e.code==='MEDIA_INGEST_PERMISSION');
 const permission=await f.api.currentInTx(f.tx,user,ctx,source,{capability:'media.register',mediaId:'old-media',subjectId:'owned'});assert.equal(permission.permissionRef.kind,'grant');
 await f.api.targetInTx(f.tx,user,ctx,'owned',null,null,{permission});assert.equal(f.seen[0].createdBy,'owner');
});
