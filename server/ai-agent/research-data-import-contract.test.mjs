import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('./research-data-import-contract.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const input=()=>({mode:'subjects',source:{tenantId:'tenant',accountId:'owner',authVersion:5,sessionId:'session',studyGroupId:'source-group',researchProjectId:'upload-project',preflightId:'preview',version:1,state:'previewed',previewHash:'a'.repeat(64),files:[{id:'file',version:2,sha256:'b'.repeat(64)}]},target:{tenantId:'tenant',studyId:'study-target',projectIntentId:'intent',studyGroupId:'destination-group',executionProjectId:'real-execution'},targetManifestHash:'f'.repeat(64),mapping:[{fileId:'file',sheet:'Sheet1',column:1,targetKey:'subjectCode'}],permissionRef:{kind:'study_grant',id:'grant',version:1}});
test('confirmation binds the selected real Study separately from the upload conversation and is never an execution permit',()=>{
 assert.equal(typeof api.compileImportConfirmation,'function');const p=api.compileImportConfirmation(input());
 assert.equal(p.source.researchProjectId,'upload-project');assert.equal(p.target.executionProjectId,'real-execution');assert.equal(p.target.studyId,'study-target');assert.equal(p.requiresCurrentAuthorization,true);assert.equal(p.confirmationReady,false);assert.equal(p.authorized,undefined);assert.match(p.hash,/^[a-f0-9]{64}$/);
});
test('changed source, selected Study, mapping or current permission version changes the fixed confirmation hash',()=>{
 assert.equal(typeof api.compileImportConfirmation,'function');const original=input(),base=api.compileImportConfirmation(original).hash;
 for(const edit of [x=>x.source.files[0].sha256='c'.repeat(64),x=>x.target.studyId='another-study',x=>x.mapping[0].column=2,x=>x.permissionRef.version=2,x=>x.source.authVersion=6]){const x=structuredClone(original);edit(x);assert.notEqual(api.compileImportConfirmation(x).hash,base);}
 assert.equal(api.compileImportConfirmation(input()).hash,base);assert.equal(original.source.files[0].sha256,'b'.repeat(64));
});
test('cross-tenant, cancelled preflight, duplicate sources and hidden storage/content fields are not confirmable',()=>{
 assert.equal(typeof api.compileImportConfirmation,'function');for(const edit of [x=>x.target.tenantId='other',x=>x.source.state='cancelled',x=>x.source.files.push({...x.source.files[0]}),x=>x.source.storageKey='secret',x=>x.source.files[0].content='raw data',x=>x.mapping[0].fileId='not-selected']){const x=input();edit(x);assert.throws(()=>api.compileImportConfirmation(x),e=>e.code==='DATA_IMPORT_SNAPSHOT_INVALID');}
});
test('visit imports bind the executing protocol, approved policy and exact required published form, never the newest draft',()=>{
 assert.equal(typeof api.compileImportConfirmation,'function');const x=input();x.mode='visit_form';Object.assign(x.target,{protocolVersionId:'executing-v2',protocolVersionNumber:2,protocolStatus:'executing',policyVersionId:'policy',policyHash:'d'.repeat(64),formVersionId:'fixed-form',formStatus:'published',formHash:'e'.repeat(64),requiredFormVersionId:'fixed-form'});
 const p=api.compileImportConfirmation(x);assert.equal(p.target.protocolVersionId,'executing-v2');
 for(const edit of [y=>y.target.protocolStatus='draft',y=>y.target.formStatus='draft',y=>y.target.requiredFormVersionId='other-form',y=>y.target.policyHash='invalid']){const y=structuredClone(x);edit(y);assert.throws(()=>api.compileImportConfirmation(y),e=>e.code==='DATA_IMPORT_SNAPSHOT_INVALID');}
});
test('native admin reference is an identity snapshot, not a fabricated Study membership or reusable authorization flag',()=>{
 assert.equal(typeof api.compileImportConfirmation,'function');const x=input();x.permissionRef={kind:'native_admin',id:'owner',version:5};const p=api.compileImportConfirmation(x);assert.equal(p.permissionRef.kind,'native_admin');assert.equal(p.target.membership,undefined);assert.equal(p.confirmationReady,false);
 x.permissionRef.authorized=true;assert.throws(()=>api.compileImportConfirmation(x));
});
test('a changed row-level target version manifest invalidates the same global Study confirmation',()=>{
 assert.equal(typeof api.compileImportConfirmation,'function');const a=input(),first=api.compileImportConfirmation(a);a.targetManifestHash='1'.repeat(64);assert.notEqual(api.compileImportConfirmation(a).hash,first.hash);delete a.targetManifestHash;assert.throws(()=>api.compileImportConfirmation(a));
});
