import test from'node:test';import assert from'node:assert/strict';
import{C2_REPORT_ID,reportAssetCanEdit,reportAssetWriteUncertain,validC2ReportAssetReceipt}from'../src/report-asset-context.js';
test('C2 interrupted draft resumes at first submission; only returned v1 permits notes revision',()=>{
 assert.equal(reportAssetCanEdit(C2_REPORT_ID,{existing:{version:1,workingState:'draft'}}),false);
 assert.equal(reportAssetCanEdit(C2_REPORT_ID,{existing:{version:1,workingState:'changes_requested'}}),true);
 assert.equal(reportAssetCanEdit(C2_REPORT_ID,{existing:{version:2,workingState:'draft'}}),false);
 assert.equal(reportAssetCanEdit(C2_REPORT_ID,{existing:null}),true);
 assert.equal(reportAssetCanEdit('old-report',{existing:{version:1,workingState:'draft'}}),true);
});
test('a committed POST followed by any failed source recheck never discards the request marker',()=>{
 for(const status of [401,403,409,500])assert(reportAssetWriteUncertain({sent:true,received:true,error:{status}}));
 assert(!reportAssetWriteUncertain({sent:true,received:false,error:{status:403}}));
 assert(reportAssetWriteUncertain({sent:true,received:false,error:{status:500}}));
 assert(!reportAssetWriteUncertain({sent:false,received:false,error:Error()}));
});

test('recovery accepts only the original write operation, not another same-asset governance receipt',()=>{
 const assetId='rhab-00000000-0000-4000-8000-000000000001',expected={operation:'created',version:1,revision:1},value={...expected,assetId,status:'committed'},fresh={reportId:C2_REPORT_ID,studyId:'rh-study-72203d59-4db8-4e74-9444-edff3b088b6d',contentHash:'668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b',existing:{assetId,version:2,revision:6}};
 assert(validC2ReportAssetReceipt(value,expected,fresh));
 for(const operation of ['submitted','reviewed','revised'])assert(!validC2ReportAssetReceipt({...value,operation},expected,fresh));
 assert(!validC2ReportAssetReceipt(value,undefined,fresh));
 assert(!validC2ReportAssetReceipt({...value,assetId:'rhab-other'},expected,fresh));
 assert(validC2ReportAssetReceipt({...value,operation:'existing',version:2,revision:6},expected,fresh));
});
