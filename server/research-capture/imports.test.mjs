import test from 'node:test';import assert from 'node:assert/strict';import {createCaptureImportService} from './imports.mjs';
function setup(){
 const tx={formVersion:{findFirst:async()=>({id:'form',schema:{fields:[{key:'value',type:'number'}]},scoring:null})},subject:{findFirst:async()=>null},$queryRaw:async()=>[]},ctx={tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'};
 const studies={withResearchStudyTransaction:async(_u,_s,action,fn)=>{assert.equal(action,'read');return fn(tx,ctx);}},core={authorize:async()=>{},normalizeSchema:x=>x,lockScope:async()=>{}};
 return {tx,api:createCaptureImportService({studies,core}),user:{tenantId:'tenant',accountId:'actor',authVersion:1}};
}
test('read-only preview reports a missing pseudonym without creating or silently skipping a row',async()=>{
 const {api,user}=setup();const result=await api.preview(user,'study',{formVersionId:'form',csv:'subject_code,visit_code,value\nSYNTHETIC-1,BASELINE,0'});assert.equal(result.rows.length,1);assert.equal(result.rows[0].answers.value,0);assert.deepEqual(result.errors,[{rowNumber:2,code:'IMPORT_SUBJECT_NOT_FOUND'}]);assert.equal(result.previewHash,null);
});
test('invalid import input and a batch with an invalid row never reach a write',async()=>{
 const {api,user}=setup();await assert.rejects(async()=>api.preview(user,'study',{formVersionId:'form',csv:'subject_code,visit_code,value\nS,B,0',tenantId:'forged'}),e=>e.status===400);
 await assert.rejects(()=>api.commit(user,'study',{requestKey:'valid-request-key',previewHash:'a'.repeat(64),formVersionId:'form',csv:'subject_code,visit_code,value\nS,B,0'}),e=>e.code==='IMPORT_PREVIEW_ERRORS');
});
