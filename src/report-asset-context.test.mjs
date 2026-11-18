import test from 'node:test';
import assert from 'node:assert/strict';
import {reportAssetRequestAllowed,canRegisterReportAsset,reportAssetScope,reportAssetReviewUrl} from './report-asset-context.js';
import {safeSessionReturn} from './session-lifecycle.js';
test('login returns to the approved governance context but rejects scope substitution and duplicate parameters',()=>{
 const url=reportAssetReviewUrl();assert.equal(safeSessionReturn(url),url);
 for(const wrong of [url+'&view=asset-review',url.replace(reportAssetScope.researchProjectId,'other-project'),url+'&extra=1',url+'#private'])assert.equal(safeSessionReturn(wrong),'/pages/p01/');
});
test('only three exact report context routes are admitted through both client fences',()=>{
 for(const [m,p]of [['GET','/research-assets/report-context-source'],['POST','/research-assets/report-context-registrations'],['POST','/research-assets/report-context-revisions']])assert(reportAssetRequestAllowed(m,p));
 for(const p of ['/research-assets/report-context-source?all=1','//evil.test/research-assets/report-context-source','/research-assets/report-context-source/','/research-assets/report-context-registrations/extra'])assert(!reportAssetRequestAllowed('GET',p));
 assert(!reportAssetRequestAllowed('DELETE','/research-assets/report-context-source'));
});
test('registration is shown only for named verified fixed report and actual admin identity',()=>{
 const report={artifactId:'rh-formal-report-adc609b3-0d50-4176-9e63-c5a6d5c390fe',versionNo:1,status:'released',contentHash:'668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b'},user={accountId:'rh-kb-local-b0e2af9d-admin',role:'tenant_admin'},studyId='rh-study-72203d59-4db8-4e74-9444-edff3b088b6d';
 assert(canRegisterReportAsset({user,studyId,report}));assert(!canRegisterReportAsset({user:{...user,role:'researcher'},studyId,report}));
 assert(!canRegisterReportAsset({user,studyId:'other',report}));assert(!canRegisterReportAsset({user,studyId,report:{...report,contentHash:'0'.repeat(64)}}));
 assert.equal(new URL(reportAssetReviewUrl(),'http://local').searchParams.get('researchProjectId'),reportAssetScope.researchProjectId);
});
