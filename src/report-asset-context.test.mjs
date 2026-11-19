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
test('verified native report context drives new Study registration and safe return routes without fixture identities',()=>{
 const user={accountId:'new-admin',role:'tenant_admin',isTenantAdmin:true},studyId='new-study',report={studyId,artifactId:'rh-formal-report-00000000-0000-4000-8000-000000000001',ownerAccountId:user.accountId,studyGroupId:'new-group',researchProjectId:'new-project',versionNo:1,status:'released',contentHash:'a'.repeat(64),capabilities:{canCreate:true}};
 assert(canRegisterReportAsset({user,studyId,report}));for(const change of [{ownerAccountId:'other'},{studyId:'other'},{status:'in_review'},{capabilities:{canCreate:false}},{studyGroupId:'bad/group'}])assert(!canRegisterReportAsset({user,studyId,report:{...report,...change}}));assert(!canRegisterReportAsset({user:{...user,isTenantAdmin:false},studyId,report}));
 const context={studyId,scope:{studyGroupId:report.studyGroupId,researchProjectId:report.researchProjectId}},url=reportAssetReviewUrl(report.artifactId,context);assert.equal(new URL(url,'http://local').searchParams.get('studyId'),studyId);assert.equal(safeSessionReturn(url),url);assert.equal(safeSessionReturn(url+'&studyId=other'),'/pages/p01/');
});
test('portable report routes admit only a single explicit Study and fixed report source operation',()=>{const root='/research-assets/report-sources/rh-formal-report-new';for(const [method,path]of [['GET',root+'?studyId=new-study'],['POST',root+'/registrations?studyId=new-study'],['POST',root+'/revisions?studyId=new-study']])assert(reportAssetRequestAllowed(method,path));for(const [method,path]of [['GET',root+'?studyId=x&studyId=y'],['GET',root+'?studyId=x&extra=1'],['POST',root+'?studyId=x'],['DELETE',root+'/registrations?studyId=x'],['GET','//evil.test'+root+'?studyId=x'],['GET',root+'?studyId=../other']])assert(!reportAssetRequestAllowed(method,path));});
test('portable acknowledgement binds the new asset receipt to its current native report source',async()=>{const{validPortableReportAssetReceipt}=await import('./report-asset-context.js'),binding={reportId:'rh-formal-report-new',studyId:'new-study',contentHash:'a'.repeat(64)},value={assetId:'rhab-00000000-0000-4000-8000-000000000001',operation:'created',version:1,revision:1,status:'committed'},fresh={...binding,existing:{assetId:value.assetId,version:1,revision:1}},expected={operation:'created',version:1,revision:1};assert(validPortableReportAssetReceipt(value,expected,fresh,binding));for(const change of [{assetId:'rhab-invalid'},{operation:'revised'},{version:2},{revision:2},{status:'pending'}])assert(!validPortableReportAssetReceipt({...value,...change},expected,fresh,binding));for(const change of [{studyId:'other'},{contentHash:'b'.repeat(64)},{existing:{...fresh.existing,assetId:'other'}}])assert(!validPortableReportAssetReceipt(value,expected,{...fresh,...change},binding));assert(validPortableReportAssetReceipt({...value,operation:'existing'},expected,fresh,binding));assert(!validPortableReportAssetReceipt(value,null,fresh,binding));});
