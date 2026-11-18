import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleProjects,projectPermits,canOpenDesignWorkspace,canOpenPlanFlow,readOverviewPages,createMyResearchOverview} from './my-research-overview.mjs';

test('pagination accepts only bounded singular positive page parameters',()=>{
 assert.deepEqual(readOverviewPages({}),{draftPage:1,taskPage:1});
 assert.deepEqual(readOverviewPages({draftPage:'2',taskPage:'3'}),{draftPage:2,taskPage:3});
 for(const query of [{draftPage:'0'},{taskPage:'1.5'},{draftPage:['1','2']},{draftPage:'100001'},{accountId:'other'},{draftPage:'01'},{draftPage:2}])assert.throws(()=>readOverviewPages(query),/OVERVIEW_QUERY_INVALID/);
});

test('paged reads retain own filters, bounded queries, deterministic order and current authorization',async()=>{
 const calls=[];const tx={account:{findFirst:async()=>({displayName:'本人',tenant:{name:'租户'}})},studyGroupMembership:{findMany:async()=>groups},researchProjectMembership:{findMany:async()=>memberships},researchArtifact:{count:async()=>11,findMany:async q=>{calls.push(['draft',q]);return[];}},studyTask:{count:async()=>6,findMany:async q=>{calls.push(['task',q]);return[];}}};
 let locks=0;const overview=createMyResearchOverview({prisma:{elevated:{$transaction:fn=>fn(tx)}},tenantId:'t1',ids:{},lockAuthorization:async()=>{locks++;}});
 const out=await overview({tenantId:'t1',accountId:'u1',authVersion:1},{draftPage:'2',taskPage:'2'});
 assert.equal(locks,1);assert.deepEqual(out.pagination,{drafts:{page:2,pageSize:5,hasNext:true},tasks:{page:2,pageSize:5,hasNext:false}});
 assert.equal(calls[0][1].skip,5);assert.equal(calls[0][1].take,5);assert.equal(calls[0][1].where.ownerAccountId,'u1');assert.equal(calls[0][1].where.deletedAt,null);
 assert.deepEqual(calls[0][1].where.id,{not:{startsWith:'rh-formal-report-'}});
 assert.equal(calls[1][1].where.assigneeAccountId,'u1');assert.equal(calls[1][1].where.acceptanceFixture,false);assert.deepEqual(calls[1][1].orderBy.at(-1),{id:'desc'});
 tx.account.findFirst=async()=>null;await assert.rejects(overview({tenantId:'t1',accountId:'u1',authVersion:1},{draftPage:'2'}),/OVERVIEW_SESSION_REJECTED/);
});

test('overview attaches workspace hints from the exact current owned version only',async()=>{
 const granted=groups.map(g=>({...g,role:{...g.role,menuPermissions:['knowledge','workbench','artifacts'],buttonPermissions:['chat.use','artifact.read']}}));
 const d={id:'draft1',studyGroupId:'g1',researchProjectId:'p1',typeKey:'research_report',title:'本人核对',updatedAt:new Date(),currentVersionNo:1,ownerAccountId:'u1',createdBy:'u1',idempotencyKey:'rh-asset-applicability-20261026:u1:req1'};
 const tx={account:{findFirst:async()=>({displayName:'本人',tenant:{name:'租户'}})},studyGroupMembership:{findMany:async()=>granted},researchProjectMembership:{findMany:async()=>memberships},researchArtifact:{count:async()=>1,findMany:async()=>[d]},studyTask:{count:async()=>0,findMany:async()=>[]},researchArtifactVersion:{findMany:async()=>[{artifactId:'draft1',versionNo:1,contentBlocks:[{type:'rh-asset-applicability.v1',ownerAccountId:'u1'}]}]}};
 let allowed=true;
 const run=createMyResearchOverview({prisma:{elevated:{$transaction:fn=>fn(tx)}},tenantId:'t1',ids:{group:'g1',project:'p1',owner:'u1',admin:'u2'},lockAuthorization:async()=>{},canOpenApplicability:async()=>allowed});
 assert.deepEqual((await run({tenantId:'t1',accountId:'u1',authVersion:1})).drafts[0].workspace,{kind:'applicability'});
 allowed=false;assert.equal((await run({tenantId:'t1',accountId:'u1',authVersion:1})).drafts[0].canOpenWorkspace,false);
 tx.researchArtifactVersion.findMany=async()=>[{artifactId:'draft1',versionNo:2,contentBlocks:[{type:'rh-asset-applicability.v1',ownerAccountId:'u1'}]}];
 assert.equal((await run({tenantId:'t1',accountId:'u1',authVersion:1})).drafts[0].workspace,null);
});

test('asset registration families are excluded before counting and paging without losing legacy drafts or Study scope',async()=>{
 const queries=[];
 const tx={account:{findFirst:async()=>({displayName:'本人',tenant:{name:'租户'}})},studyGroupMembership:{findMany:async()=>groups},researchProjectMembership:{findMany:async()=>memberships},researchArtifact:{count:async q=>{queries.push(q);return 0;},findMany:async q=>{queries.push(q);return[];}},studyTask:{count:async()=>0,findMany:async()=>[]}};
 const run=createMyResearchOverview({prisma:{elevated:{$transaction:fn=>fn(tx)}},tenantId:'t1',ids:{},lockAuthorization:async()=>{}});
 const out=await run({tenantId:'t1',accountId:'u1',authVersion:1});
 assert.equal(out.summary.ownDraftCount,0);assert.deepEqual(out.drafts,[]);assert.deepEqual(out.activity,[]);
 assert.equal(queries.length,2);assert.deepEqual(queries[0].where,queries[1].where);
 for(const {where}of queries){
  assert.deepEqual(where.OR,[{studyGroupId:'g1',researchProjectId:'p1'}]);
  assert.deepEqual(where.idempotencyKey,{not:{startsWith:'rh-research-asset:'}});
  assert.deepEqual(where.id,{not:{startsWith:'rh-formal-report-'}});
  assert.equal(where.ownerAccountId,'u1');assert.equal(where.tenantId,'t1');assert.equal(where.status,'draft');
 }
});

const groups=[
 {tenantId:'t1',studyGroupId:'g1',status:'active',studyGroup:{id:'g1',tenantId:'t1',name:'我的组',status:'active'},role:{tenantId:'t1',status:'active',menuPermissions:['workbench','artifacts'],buttonPermissions:['artifact.read']}},
 {tenantId:'t1',studyGroupId:'g2',status:'inactive',studyGroup:{id:'g2',tenantId:'t1',name:'失效组',status:'active'},role:{tenantId:'t1',status:'active',menuPermissions:['workbench','artifacts'],buttonPermissions:['artifact.read']}},
];
const memberships=[
 {tenantId:'t1',studyGroupId:'g1',status:'active',researchProject:{id:'p1',tenantId:'t1',name:'本人研究',description:null,status:'active',studyGroupId:'g1'}},
 {tenantId:'t1',studyGroupId:'g2',status:'active',researchProject:{id:'p2',tenantId:'t1',name:'不得显示',description:null,status:'active',studyGroupId:'g2'}},
 {tenantId:'t1',studyGroupId:'g1',status:'inactive',researchProject:{id:'p3',tenantId:'t1',name:'撤销项目',description:null,status:'active',studyGroupId:'g1'}},
 {tenantId:'t1',studyGroupId:'g1',status:'active',researchProject:{id:'p4',tenantId:'t1',name:'跨组脏关联',description:null,status:'active',studyGroupId:'g9'}},
];
test('overview requires both active group and project memberships with matching parent',()=>{
 const visible=visibleProjects(groups,memberships,'t1');
 assert.deepEqual(visible.map(x=>x.projects.map(p=>p.id)),[['p1']]);
 assert.equal(visible[0].name,'我的组');
});
test('a project membership does not grant draft access without existing role permission',()=>{
 const project=visibleProjects(groups,memberships,'t1')[0].projects[0];
 assert.equal(projectPermits(project,'artifacts','artifact.read'),true);
 assert.equal(projectPermits(project,'artifacts','artifact.edit'),false);
 assert.equal(projectPermits(project,'unknown'),false);
});
test('no membership means no private study',()=>assert.deepEqual(visibleProjects([],memberships,'t1'),[]));
test('dirty cross-tenant group, role and project associations never enter the overview',()=>{
 const dirtyGroups=[...groups,{...groups[0],studyGroupId:'g3',studyGroup:{id:'g3',tenantId:'t2',name:'外租户',status:'active'}},{...groups[0],studyGroupId:'g4',role:{...groups[0].role,tenantId:'t2'}},{...groups[0],studyGroupId:'g5',tenantId:'t2'}];
 const dirtyProjects=[...memberships,{...memberships[0],researchProject:{...memberships[0].researchProject,id:'p5',tenantId:'t2'}},{...memberships[0],tenantId:'t2',researchProject:{...memberships[0].researchProject,id:'p6'}}];
 assert.deepEqual(visibleProjects(dirtyGroups,dirtyProjects,'t1').map(g=>g.id),['g1']);
 assert.deepEqual(visibleProjects(dirtyGroups,dirtyProjects,'t1')[0].projects.map(p=>p.id),['p1']);
});
test('local design links require exact approved study, accounts and role grants',()=>{
 const p=visibleProjects(groups,memberships,'t1')[0].projects[0],ids={tenant:'t1',group:'g1',project:'p1',owner:'u1',admin:'u2'};
 assert.equal(canOpenDesignWorkspace(p,'u1',ids),false);
 const granted={...p,permissions:{menus:['knowledge','workbench','artifacts'],buttons:['chat.use','artifact.read']}};
 assert.equal(canOpenDesignWorkspace(granted,'u1',ids),true);
 assert.equal(canOpenDesignWorkspace(granted,'u3',ids),false);
 assert.equal(canOpenDesignWorkspace({...granted,id:'other'},'u1',ids),false);
 assert.equal(canOpenPlanFlow({typeKey:'protocol_draft',ownerAccountId:'u1',createdBy:'u1',idempotencyKey:'rh-plan-20261022:u1:x'},'u1',true),true);
 assert.equal(canOpenPlanFlow({typeKey:'protocol_draft',ownerAccountId:'u1',createdBy:'u1',idempotencyKey:'other'},'u1',true),false);
});
