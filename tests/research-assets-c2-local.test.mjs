import test from 'node:test';
import assert from 'node:assert/strict';
import {C2_REPORT,c2ReportPolicy,c2ReportActions,assertC2ReportDraft,assertC2ReportEvent} from '../server/research-assets/report-source-local.mjs';
const p={tenantId:C2_REPORT.tenantId,studyGroupId:C2_REPORT.studyGroupId,researchProjectId:C2_REPORT.researchProjectId,accountId:C2_REPORT.ownerAccountId,isTenantAdmin:true};
const policy={sourceValid:true,sourceKind:'artifact',sourceBindings:[{kind:'artifact',id:C2_REPORT.reportId,version:1,contentHash:C2_REPORT.contentHash}]};
const registry={...p,ownerAccountId:p.accountId,assetId:'rhab-00000000-0000-4000-8000-000000000001',kind:'publication',workingVersionNo:1,revision:1,workingState:'draft'};
test('C2 binds exactly the approved native source and only exposes its next of six events',()=>{
 assert(c2ReportPolicy(policy,p));assert(!c2ReportPolicy({...policy,sourceBindings:[{...policy.sourceBindings[0],id:'old-report'}]},p));
 assert(!c2ReportPolicy(policy,{...p,accountId:'other'}));
 for(const [revision,version,state,action]of [[1,1,'draft','submit'],[2,1,'in_review','review'],[3,1,'changes_requested',null],[4,2,'draft','submit'],[5,2,'in_review','review'],[6,2,'approved',null]]){
  const record={registry:{...registry,revision,workingVersionNo:version,workingState:state},policies:[policy]};
  assert.deepEqual(c2ReportActions(record,p),['read','versions',...(action?[action]:[])]);
 }
});
test('C2 rejects release, wrong review decision, third version and any unrelated asset mutation',async()=>{
 const record={registry:{...registry,revision:2,workingState:'in_review'},policies:[policy]};
 assert.throws(()=>assertC2ReportEvent(p,{record:{...record,policies:[{...policy,sourceValid:false}]},action:'review',input:{conclusion:'changes_requested'}}));
 assert.doesNotThrow(()=>assertC2ReportEvent(p,{record,action:'review',input:{conclusion:'changes_requested'}}));
 for(const [action,input]of [['release',{}],['review',{conclusion:'approved'}]])assert.throws(()=>assertC2ReportEvent(p,{record,action,input}));
 assert.throws(()=>assertC2ReportEvent({...p,accountId:'other'},{record,action:'review',input:{conclusion:'changes_requested'}}));
 const value={kind:'publication',...policy,metadata:{title:C2_REPORT.title,limitations:'合成研究'},policy:{discoveryRecipients:[]}};
 await assert.rejects(assertC2ReportDraft({$queryRawUnsafe:async()=>[{asset_id:'existing'}]},p,{action:'create',value}));
 await assert.rejects(assertC2ReportDraft({},p,{action:'revise',value,registry:{...registry,revision:6},next:{workingVersionNo:3}}));
});
