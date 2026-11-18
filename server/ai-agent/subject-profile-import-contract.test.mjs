import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./subject-profile-import-contract.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const sha='a'.repeat(64),before='b'.repeat(64);
const input=()=>({source:{tenantId:'tenant',accountId:'admin',authVersion:5,sessionId:'ordinary-new-session',studyGroupId:'upload-group',researchProjectId:'upload-project',preflightId:'preview',preflightVersion:1,previewHash:sha,refs:[{id:'upload',version:2,sha256:sha}],sheetName:'基本信息'},target:{studyId:'study',studyGroupId:'target-group',researchProjectId:'target-project'},parserRevision:sha,recordBindings:[],rows:[{subjectId:'subject-A',subjectCode:'SYNTH-A',profileHash:before,enrollmentHash:before,values:{episodeCount:0,familyHistory:false,onMedication:false,education:'合成学历'}},{subjectId:'subject-B',subjectCode:'SYNTH-B',profileHash:sha,enrollmentHash:before,values:{currentEpisodeMonths:2.5}}],qualityWarnings:[]});
test('profile confirmation freezes one real source, existing targets, native values and exact parser revision',()=>{
 assert.equal(typeof api.compileSubjectProfileConfirmation,'function');const x=input(),p=api.compileSubjectProfileConfirmation(x);
 assert.equal(p.schema,'hub-subject-profile-confirmation.v1');assert.match(p.hash,/^[a-f0-9]{64}$/);assert.equal(p.source.researchProjectId,'upload-project');assert.equal(p.target.researchProjectId,'target-project');
 assert.equal(p.rows[0].values.episodeCount,0);assert.equal(p.rows[0].values.familyHistory,false);assert.equal(p.rows[1].values.currentEpisodeMonths,2.5);
 assert(!('onsetAge' in p.rows[0].values));x.rows[0].values.episodeCount=99;assert.equal(p.rows[0].values.episodeCount,0);assert(Object.isFrozen(p.rows[0].values));
});
test('duplicate destination rows, absent binding and invented values are refused instead of silently merged',()=>{
 for(const mutate of [x=>x.rows[1].subjectId=x.rows[0].subjectId,x=>x.rows[1].subjectCode=x.rows[0].subjectCode,x=>delete x.rows[0].subjectId,x=>x.rows[0].values={},x=>x.rows[0].values.unknown=1,x=>x.rows[0].values.episodeCount=1.2,x=>x.rows[0].values.episodeCount=2147483648,x=>x.rows[0].values.familyHistory='否',x=>x.rows[0].values.currentEpisodeMonths=NaN]){
  const x=input();mutate(x);assert.throws(()=>api.compileSubjectProfileConfirmation(x),{code:'PROFILE_IMPORT_SNAPSHOT_INVALID'});
 }
});
test('each source/target/version/mapping change changes confirmation; object key order does not',()=>{
 const first=api.compileSubjectProfileConfirmation(input());
 for(const mutate of [x=>x.source.refs[0].version++,x=>x.source.authVersion++,x=>x.target.studyId='other-study',x=>x.parserRevision=before,x=>x.rows[0].profileHash=sha,x=>x.recordBindings=[{recordNumber:1,subjectCode:'SYNTH-A'},{recordNumber:2,subjectCode:'SYNTH-B'}]]){const x=input();mutate(x);assert.notEqual(api.compileSubjectProfileConfirmation(x).hash,first.hash);}
 const x=input();x.rows[0].values={education:'合成学历',onMedication:false,familyHistory:false,episodeCount:0};assert.equal(api.compileSubjectProfileConfirmation(x).hash,first.hash);
});
test('caller authority, storage keys, multiple files and invalid map targets cannot enter a confirmation',()=>{
 for(const mutate of [x=>x.authorized=true,x=>x.source.storageKey='private/key',x=>x.source.refs.push({...x.source.refs[0],id:'another'}),x=>x.target.tenantId='foreign',x=>x.recordBindings=[{recordNumber:1,subjectCode:'missing-subject'}],x=>x.recordBindings=[{recordNumber:1,subjectCode:'SYNTH-A'},{recordNumber:1,subjectCode:'SYNTH-B'}],x=>x.identityMap=[{sourceIdentity:'must-not-persist',subjectCode:'SYNTH-A'}]]){const x=input();mutate(x);assert.throws(()=>api.compileSubjectProfileConfirmation(x),{code:'PROFILE_IMPORT_SNAPSHOT_INVALID'});}
});
