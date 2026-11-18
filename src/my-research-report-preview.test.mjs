import {test} from 'node:test';
import assert from 'node:assert/strict';
import {myResearchReportPath,fetchMyResearchReport} from './my-research-report-preview.js';
const draft={id:'report1',studyGroupId:'g1',researchProjectId:'p1',version:2,workspace:{kind:'method-report',planId:'plan1',collectionId:'collection1',runId:'run1'}};
const value={id:'report1',version:2,currentVersion:3,sourceStatus:'stale',contentMd:'# 历史草稿',sourceRows:[{sourceType:'data_snapshot',sourceId:'version1',sourceVersion:'1',hash:'a'.repeat(64)}]};
test('report preview uses the specialized guarded fixed-version reader, not generic artifacts',async()=>{
 let request;const result=await fetchMyResearchReport(draft,{fetchImpl:async(...args)=>{request=args;return{ok:true,json:async()=>value};}});
 assert.equal(request[0],'/api/research-plan-drafts/plan1/synthetic-collections/collection1/method-runs/run1/report-drafts/report1/versions/2');
 assert.equal(request[1].headers['X-Research-Project-Id'],'p1');assert.equal(request[1].cache,'no-store');assert.equal(result.contentMd,value.contentMd);assert.equal(result.sourceStatus,'stale');
 assert.equal(myResearchReportPath({...draft,workspace:{kind:'applicability'}}),null);
});
test('preview refuses swapped objects, versions, restricted sources and permission failures',async()=>{
 for(const bad of [{...value,id:'other'},{...value,version:1},{...value,sourceStatus:'restricted'},{...value,sourceRows:null}])await assert.rejects(fetchMyResearchReport(draft,{fetchImpl:async()=>({ok:true,json:async()=>bad})}));
 await assert.rejects(fetchMyResearchReport(draft,{fetchImpl:async()=>({ok:false,status:403})}),/当前无法读取/);
 assert.throws(()=>myResearchReportPath({...draft,workspace:{...draft.workspace,planId:'//foreign'}}));
 for(const kind of ['trial-report','edc-report','method-report']){
  const w={kind,planId:'plan1',collectionId:'collection1',runId:'run1'};
  for(const version of [0,31])assert.throws(()=>myResearchReportPath({...draft,version,workspace:w}));
  for(const key of ['planId',...(kind==='trial-report'?['runId']:kind==='edc-report'?['collectionId']:['collectionId','runId'])])for(const missing of [null,undefined])assert.throws(()=>myResearchReportPath({...draft,workspace:{...w,[key]:missing}}));
 }
});
