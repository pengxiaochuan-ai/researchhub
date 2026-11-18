import {test} from 'node:test';
import assert from 'node:assert/strict';
import {draftWorkspace} from './my-research-draft-workspace.mjs';
import {myResearchDraftLink} from '../src/my-research-draft-route.js';
test('research_report is routed by its real family, never by generic type or title',()=>{
 const d={id:'draft1',studyGroupId:'g1',researchProjectId:'p1',typeKey:'research_report',ownerAccountId:'u1',createdBy:'u1',currentVersionNo:1,idempotencyKey:'rh-asset-applicability-20261026:u1:request1'};
 const b={type:'rh-asset-applicability.v1',ownerAccountId:'u1'};
 const w=draftWorkspace(d,[b],'u1',true);assert.deepEqual(w,{kind:'applicability'});
 assert.match(myResearchDraftLink({...d,workspace:w}).href,/assetApplicability=1/);
 for(const [row,blocks,actor,allowed] of [[d,[b],'u2',true],[d,[b],'u1',false],[{...d,createdBy:'u2'},[b],'u1',true],[{...d,idempotencyKey:'other:u1:x'},[b],'u1',true],[d,[{...b,type:'other'}],'u1',true],[d,[b,b],'u1',true]])assert.equal(draftWorkspace(row,blocks,actor,allowed),null);
});
test('report routes retain exact immutable parent identifiers and reject malformed hints',()=>{
 const d={id:'report1',studyGroupId:'g1',researchProjectId:'p1',typeKey:'data_quality_report',ownerAccountId:'u1',createdBy:'u1',currentVersionNo:2,idempotencyKey:'rh-crf-method-report-20261025:u1:run1:req1'};
 const b={type:'rh-synthetic-crf-method-report.v1',ownerAccountId:'u1',planId:'plan1',collectionId:'collection1',runId:'run1'};
 const w=draftWorkspace(d,[b],'u1',true),url=new URL(myResearchDraftLink({...d,version:2,workspace:w}).href,'http://local');
 assert.equal(url.searchParams.get('methodReportId'),'report1');assert.equal(url.searchParams.get('runId'),'run1');assert.equal(url.searchParams.get('methodReportVersion'),'2');
 assert.equal(draftWorkspace(d,[{...b,planId:'//evil'}],'u1',true),null);
 assert.throws(()=>myResearchDraftLink({...d,workspace:{kind:'invented'}}));
});
