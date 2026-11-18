import test from 'node:test';import assert from 'node:assert/strict';import {createCaptureImportService} from '../research-capture/imports.mjs';
test('P05 typed rows reuse native import planning without a CSV round trip or a nested transaction',async()=>{
 const calls=[],tx={formVersion:{findFirst:async()=>({id:'form',schema:{fields:[{key:'value',type:'number',required:true},{key:'completed',type:'boolean',required:true}]},scoring:{}})},subject:{findFirst:async()=>null}};
 const api=createCaptureImportService({studies:{},core:{authorize:async()=>calls.push('current-authority'),normalizeSchema:s=>s,lockScope:async()=>{}}});
 assert.equal(typeof api.prepareRowsInTransaction,'function');
 const result=await api.prepareRowsInTransaction(tx,{accountId:'actor',authVersion:1},{tenantId:'t',studyGroupId:'g',researchProjectId:'p'},'study',{formVersionId:'form',sourceHash:'a'.repeat(64),rows:[{rowNumber:2,subjectCode:'SYNTHETIC',visitCode:'BASELINE',answers:{value:0,completed:false}}]});
 assert.deepEqual(result.rows[0].answers,{value:0,completed:false});assert.deepEqual(calls,['current-authority']);assert.equal(result.errors[0].code,'IMPORT_SUBJECT_NOT_FOUND');
});
