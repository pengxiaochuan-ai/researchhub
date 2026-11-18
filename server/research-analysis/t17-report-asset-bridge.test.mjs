import test from 'node:test';
import assert from 'node:assert/strict';
import {createT17Reports} from './t17-reports.mjs';
test('asset source bridge reuses caller transaction and native Study resolution before fixed report read',async()=>{
 const tx={},calls=[];
 const reports=createT17Reports({studies:{withResearchStudyTransaction(){throw Error('NESTED_TRANSACTION');},async resolveResearchStudyInTransaction(...args){calls.push(args);return {tenantId:'t',studyGroupId:'g',executionProjectId:'wrong'};}},analysis:{assertCurrent(){}},load:()=>()=>{}});
 assert.equal(typeof reports.readForAssetInTransaction,'function');
 await assert.rejects(()=>reports.readForAssetInTransaction(tx,{tenantId:'t'},{tenantId:'t',studyGroupId:'g',researchProjectId:'p'},'study','report'),e=>e.code==='REPORT_ASSET_SCOPE_CHANGED');
 assert.equal(calls.length,1);assert.equal(calls[0][0],tx);assert.equal(calls[0][2],'study');
});
