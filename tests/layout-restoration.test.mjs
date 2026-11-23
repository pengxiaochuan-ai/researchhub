import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { studyOverviewHeader,studyOverviewNavUrl } from '../src/study-overview-route.js';
import {validateResearchDirectory} from '../src/research-directory-session.js';

const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)),
  configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr:false }, appType: 'custom', logLevel: 'error' });
after(() => server.close());
const render = component => renderToStaticMarkup(React.createElement(component));

test('real AI keeps history and chat but no invented context or fixed capability cards before authentication resolves', async () => {
  const { default: RealAiWorkspace } = await server.ssrLoadModule('/pages/shared/RealAiWorkspace.jsx');
  const html = render(RealAiWorkspace);
  for (const region of ['conversationList', 'chat', 'composer']) assert.ok(html.includes(region), region);
  assert.doesNotMatch(html,/contextRail|当前研究上下文|可用能力|参考范围与不确定性/);
  assert.doesNotMatch(html, /中心 03|王教授|67%|基于 8 条证据/);
});

test('real Study overview keeps metric, chart, detail, bottom and right-rail regions while loading', async () => {
  const { StudyOverviewLayout } = await server.ssrLoadModule('/pages/shared/RealStudyOverview.jsx');
  const html = render(StudyOverviewLayout);
  for (const region of ['dashboard-grid', 'metrics-row', 'charts-row', 'details-row', 'bottom-row', 'right-dashboard']) assert.ok(html.includes(region), region);
  for (const title of ['入组进度', '入组趋势', '研究中心列表', '研究信息', '里程碑']) assert.ok(html.includes(title), title);
  assert.doesNotMatch(html, /42 \/ 120|中心 02|ChiCTR2300087654/);
});

test('Study header retains confirmed navigation and action positions without restoring demo values', () => {
  const config = { title: '演示研究', meta: '入组66人', nav: [['概览', 's01'], ['研究设计', 's02']],
    actions: [['分享'], ['编辑', 's02', true]] };
  const header = studyOverviewHeader(config);
  assert.deepEqual(header.nav, config.nav);
  assert.deepEqual(header.actions.map(item => item[0]), ['分享', '编辑']);
  assert.doesNotMatch(JSON.stringify(header), /入组66人|演示研究/);
});

test('real evidence search retains filter, results and selected-paper regions while loading', async () => {
  const { RealEvidence } = await server.ssrLoadModule('/pages/e01/src/RealEvidence.jsx');
  const html = render(RealEvidence);
  for (const region of ['paper-work', 'paper-filters', 'paper-filter-foot', 'paper-list', 'paper-detail', '应用筛选']) assert.ok(html.includes(region), region);
  assert.doesNotMatch(html, /JAMA Psychiatry|8,624|IF 25/);
});

test('real registry list retains its original list region, filter bar and columns while deferred views are hidden', async () => {
  const { RealClinicalRegistries } = await server.ssrLoadModule('/pages/c01/src/RealClinicalRegistries.jsx');
  const html=render(RealClinicalRegistries);
  for(const region of ['reg-view-row','reg-filters','reg-panel','研究列表','研究题目','研究状态'])assert.ok(html.includes(region),region);
  assert.doesNotMatch(html,/研究分布地图|趋势分析/);
  assert(!html.includes('招募状态'));
  assert.doesNotMatch(html,/NCT04567890|64 项|68 项/);
});

test('personal overview uses the four confirmed metric roles and judgement/brief layout with real profile', async () => {
  const {default:Overview}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');
  const html=renderToStaticMarkup(React.createElement(Overview,{data:{profile:{displayName:'合成审核员',tenantName:'合成租户'},summary:{projectCount:0,ownDraftCount:0,myOpenTaskCount:0},studyGroups:[],drafts:[],tasks:[],activity:[]}}));
  for(const region of ['hubMain','hubResearchLink','attention','attGrid','aiAnalysis','briefs'])assert.ok(html.includes(region),region);
  for(const label of ['我的课题','需要判断','待我处理','岐研 AI'])assert.ok(html.includes(label));
  assert.match(html,/合成审核员/);assert.doesNotMatch(html,/王教授|67%|42.*120|12 条新证据/);
});

test('P01 tasks link to their exact Study and task, and drafts expose bounded browsing in place',async()=>{
 const {default:Overview}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');
 const data={profile:{displayName:'本人',tenantName:'租户'},summary:{projectCount:0,ownDraftCount:8,myOpenTaskCount:1},studyGroups:[],drafts:[],tasks:[{id:'task-one',studyGroupId:'g1',researchProjectId:'p1',title:'核对资料',status:'open',dueAt:null}],activity:[],pagination:{drafts:{page:1,pageSize:5,hasNext:true},tasks:{page:1,pageSize:5,hasNext:false}}};
 const html=renderToStaticMarkup(React.createElement(Overview,{data}));
 assert.match(html,/\/pages\/s08\/\?studyGroupId=g1&amp;researchProjectId=p1&amp;taskId=task-one/);
 assert.match(html,/待处理/);assert.match(html,/查看全部草稿/);assert.doesNotMatch(html,/>open</);
});

test('P01 current projects expose one list footer and exact same-directory destinations',async()=>{
 const {default:Overview}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');
 const data={profile:{displayName:'本人',tenantName:'租户'},summary:{projectCount:9,ownDraftCount:0,myOpenTaskCount:0},studyGroups:[{id:'legacy-group',name:'旧概览研究组',projects:[{id:'legacy-project',name:'不可借用的旧课题'}]}],drafts:[],tasks:[],activity:[]};
 const projectDirectory={kind:'ready',total:1,nextCursor:null,items:[{
  key:'execution:project-old',kind:'execution',id:'project-old',title:'原研究',summary:'已授权研究简介',status:'active',updatedAt:'2026-11-11T01:00:00Z',
  studyGroupId:'group-old',studyGroupName:'原研究组',executionProjectId:'project-old',
  links:{primary:'/pages/s01/?studyGroupId=group-old&researchProjectId=project-old'},capabilities:{canEdit:false,canOpenStudy:true},
 }],capabilities:{canCreateProject:true}};
 validateResearchDirectory(projectDirectory);
 const html=renderToStaticMarkup(React.createElement(Overview,{data,projectDirectory}));
 assert.doesNotMatch(html,/>新建课题<|>全部课题</);
 assert.match(html,/href="\/pages\/q02\/\?researchProjects=1"[^>]*>查看更多课题 →/);
 assert.match(html,/studyGroupId=group-old&amp;researchProjectId=project-old/);
 assert.doesNotMatch(html,/不可借用的旧课题|legacy-project|9 项/);
 assert.equal((html.match(/1 项/g)||[]).length,3);
 assert.ok(html.indexOf('查看更多课题 →')<html.indexOf('personal-draft-details'));
 const {PersonalOverviewSkeleton}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');
 const pending=render(PersonalOverviewSkeleton);assert.doesNotMatch(pending,/researchCreation=1|researchProjects=1/);
});

test('Study navigation retains exact authorized scope and connects the approved S08 route',()=>{
  const search='?studyGroupId=group-one&researchProjectId=project-one';
  assert.equal(studyOverviewNavUrl('研究设计',search),'/pages/s02/?designWorkspace=1&studyGroupId=group-one&researchProjectId=project-one');
  assert.match(studyOverviewNavUrl('团队与设置',search),/members=1&studyGroupId=group-one&researchProjectId=project-one/);
  assert.equal(studyOverviewNavUrl('研究执行',search),'/pages/s08/'+search);
  assert.equal(studyOverviewNavUrl('研究设计',search+'&studyGroupId=other'),null);
});

test('real clinical detail retains seven content tabs, facts rail and AI rail without fake conclusions',async()=>{
  const {RegistryDetailLayout}=await server.ssrLoadModule('/pages/c03/src/RealClinicalRegistryDetail.jsx');
  const html=renderToStaticMarkup(React.createElement(RegistryDetailLayout,{item:{title:'合成注册快照',externalKey:'TEST-ONLY',reviewVersion:'1'}}));
  for(const marker of ['trial-head','trial-tabs','trial-split','trial-main','trial-facts','trial-ai-panel','研究者与机构','未来研究方向'])assert.ok(html.includes(marker),marker);
  assert.doesNotMatch(html,/NCT04567890|高度证据|Phase 3/);
});

test('default asset and design entries use the original boards without generating demo records',async()=>{
  const {RealAssetEntry,RealDesignEntry}=await server.ssrLoadModule('/pages/shared/RealEntryLayouts.jsx');
  const props={state:{kind:'loading'},links:[],retry:()=>{}};
  const assets=renderToStaticMarkup(React.createElement(RealAssetEntry,props));
  for(const marker of ['stats-6','real-assets-grid','资产列表','资产详情','版本历史','推荐资产','资产使用趋势'])assert.ok(assets.includes(marker),marker);
  const designs=renderToStaticMarkup(React.createElement(RealDesignEntry,props));
  for(const marker of ['wf-panel','wf-toolbar','wf-list','我的课题与草稿'])assert.ok(designs.includes(marker),marker);
  assert.doesNotMatch(assets+designs,/AS–2024|王教授|共 128 条/);
});

test('connected paper filters retain confirmed groups and native controls, adding explicit unknown values',async()=>{
  const {default:Filters}=await server.ssrLoadModule('/pages/e01/src/EvidenceFilterSkeleton.jsx');
  const html=render(Filters);
  for(const label of ['近 1 年','近 3 年','近 5 年','自定义范围','系统综述 / Meta分析','非随机对照','病例对照研究','真实世界研究','电针','艾灸','疾病/研究领域'])assert.ok(html.includes(label),label);
  assert.equal((html.match(/type="radio"/g)||[]).length,5);
  assert.equal((html.match(/type="checkbox"/g)||[]).length,25);
  assert.equal((html.match(/type="date"/g)||[]).length,2);
  assert.doesNotMatch(html,/\(1,|128条/);
  assert.doesNotMatch(html,/disabled=""/);
});

test('unverified detail and personal states retain their page regions without zero metrics',async()=>{
  const {EvidenceDetailSkeleton}=await server.ssrLoadModule('/pages/e02/src/RealEvidenceDetail.jsx');
  const paper=render(EvidenceDetailSkeleton);
  for(const region of ['detail-paper','detail-actions','detail-tabs','detail-split','detail-side'])assert.ok(paper.includes(region),region);
  const {RegistryDetailLayout}=await server.ssrLoadModule('/pages/c03/src/RealClinicalRegistryDetail.jsx');
  const registry=render(RegistryDetailLayout);
  for(const region of ['trial-head','trial-tabs','trial-split','trial-ai-panel'])assert.ok(registry.includes(region),region);
  const {PersonalOverviewSkeleton}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');
  const personal=render(PersonalOverviewSkeleton);
  for(const region of ['hubMain','stats','attention','briefs','railCard'])assert.ok(personal.includes(region),region);
  assert.doesNotMatch(personal,/已授权课题 0|待我处理.*0 项|暂无已授权的私有课题/);
});
