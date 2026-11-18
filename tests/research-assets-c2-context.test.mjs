import test from 'node:test';import assert from 'node:assert/strict';
import {C2_REPORT} from '../server/research-assets/report-source-local.mjs';
import {canRegisterReportAsset,reportAssetReviewUrl,reportAssetSourcePath,reportAssetRequestAllowed,validReportAssetReview} from '../src/report-asset-context.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';
test('C2 fixed source uses isolated routes, exact review context and safe login return',()=>{
 const c=C2_REPORT,user={accountId:c.ownerAccountId,role:'tenant_admin'},report={artifactId:c.reportId,contentHash:c.contentHash,versionNo:1,status:'released'};
 assert(canRegisterReportAsset({user,studyId:c.studyId,report}));
 const path=reportAssetSourcePath(c.reportId);assert(reportAssetRequestAllowed('GET',path));assert(reportAssetRequestAllowed('POST',reportAssetSourcePath(c.reportId,'registrations')));
 for(const bad of[path+'&extra=1',path.replace(c.studyId,'other'),path+'#x'])assert(!reportAssetRequestAllowed('GET',bad));
 const review=reportAssetReviewUrl(c.reportId);assert(validReportAssetReview(new URL(review,'http://local').searchParams));assert.equal(safeSessionReturn(review),review);
 assert(!validReportAssetReview(new URL(review+'&reportId='+c.reportId,'http://local').searchParams));
});
