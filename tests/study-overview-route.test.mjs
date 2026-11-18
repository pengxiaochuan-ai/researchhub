import test from 'node:test';
import assert from 'node:assert/strict';
import {isStudyOverviewRoute,readStudyOverviewLocation,makeStudyOverviewUrl,resolveStudyOverview,studyOverviewHeader} from '../src/study-overview-route.js';
import {realModeRouteState} from '../src/real-mode-route.js';

const scope={studyGroupId:'group-one',researchProjectId:'study-one'};
const overview={studyGroups:[{id:'group-one',name:'合成研究组',projects:[{id:'study-one',name:'真实合成研究',description:'本轮受权内容',status:'active',canOpenDesignWorkspace:false},{id:'other-study',name:'另一研究',status:'active',canOpenDesignWorkspace:true}]},{id:'group-two',name:'其他组',projects:[{id:'study-one',name:'相同项目编号',status:'active',canOpenDesignWorkspace:true}]}]};

test('S01 requires an exact two-part scope and never accepts demo or duplicate parameters',()=>{
  const url=makeStudyOverviewUrl(scope);
  assert.equal(url,'/pages/s01/?studyGroupId=group-one&researchProjectId=study-one');
  assert.deepEqual(readStudyOverviewLocation('?studyGroupId=group-one&researchProjectId=study-one'),scope);
  for(const bad of ['?studyGroupId=group-one','?researchProjectId=study-one','?studyGroupId=group-one&researchProjectId=study-one&projectId=DEMO','?studyGroupId=group-one&researchProjectId=study-one&studyGroupId=group-two','?studyGroupId=group-one&researchProjectId=study-one&extra=1','?studyGroupId=../x&researchProjectId=study-one'])assert.throws(()=>readStudyOverviewLocation(bad));
});

test('S01 resolves only the server-returned current group and project membership',()=>{
  assert.deepEqual(resolveStudyOverview(overview,scope),{group:overview.studyGroups[0],project:overview.studyGroups[0].projects[0]});
  assert.equal(resolveStudyOverview(overview,{studyGroupId:'group-one',researchProjectId:'missing'}),null);
  assert.equal(resolveStudyOverview(overview,{studyGroupId:'missing',researchProjectId:'study-one'}),null);
});

test('only scoped S01 is live while unscoped and explicit demo keep their prior behavior',()=>{
  const real={configured:true,explicitDemo:false};
  assert.equal(isStudyOverviewRoute('s01','?studyGroupId=group-one&researchProjectId=study-one'),true);
  assert.equal(realModeRouteState('s01','?studyGroupId=group-one&researchProjectId=study-one',real),'live');
  assert.equal(realModeRouteState('s01','',real),'pending');
  assert.equal(realModeRouteState('s01','?projectId=DEMO',real),'pending');
  assert.equal(realModeRouteState('s01','?studyGroupId=group-one&researchProjectId=study-one',{configured:true,explicitDemo:true}),'demo');
});

test('live S01 replaces demo values but preserves original action positions and navigation',()=>{
  const header=studyOverviewHeader({title:'演示 Study',description:'入组 66 人',actions:[['正式发布']],nav:[['演示']]});
  assert.equal(header.title,'Study概览');
  assert.equal(header.actions[0][0],'正式发布');
  assert.ok(header.actions[0][3]);
  assert.deepEqual(header.nav,[['演示']]);
  assert.doesNotMatch(JSON.stringify(header),/入组 66 人|演示 Study/);
});
