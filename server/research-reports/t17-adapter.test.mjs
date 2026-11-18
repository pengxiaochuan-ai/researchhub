import test from 'node:test';
import assert from 'node:assert/strict';
import {createT17Reports} from '../research-analysis/t17-reports.mjs';
import {canonicalReportJson,reportDigest} from '../research-analysis/t17-report-content.mjs';
import {basis,run,manifest,schema} from '../research-analysis/t17-presentation-fixture.mjs';

function fixture(custom=true){
 const user={accountId:'actor',authVersion:1},store={reads:0},scope={tenantId:'tenant',studyGroupId:'group',executionProjectId:'project'};
 const row={...run(),inputSummary:{studyId:'study',snapshotId:basis.snapshotId}};
 const tx={account:{findFirst:async()=>({id:'actor',status:'active',role:'tenant_admin',isTenantAdmin:true,authVersion:1,tenant:{status:'active'}})},
  researchArtifact:{create:async({data})=>(store.artifact={...data,currentVersionNo:1,createdAt:new Date('2026-11-13T00:00:00Z')}),findFirst:async()=>store.artifact},
  researchArtifactVersion:{create:async({data})=>(store.version={...data,id:'version',sources:[]}),findFirst:async()=>store.version},
  researchArtifactSource:{createMany:async({data})=>{store.version.sources=data;return {count:data.length};}},researchArtifactReview:{findMany:async()=>[]},auditLog:{create:async()=>({})},
  researchMethodRun:{findFirst:async()=>{if(custom)throw Error('FAKE_ROOT_METHOD_RUN_QUERY_FORBIDDEN');return row;}},researchMethodReview:{findFirst:async()=>({conclusion:'confirmed',comment:'synthetic'})},
  formVersion:{findMany:async()=>[{id:'form',status:'published',schema,scoring:null}]},
  $queryRaw:async strings=>strings.join('?').includes('FROM public.form_version')?[{id:'form'}]:[],$executeRaw:async()=>1,
 };
 const studies={withResearchStudyTransaction:(_u,_id,_op,fn)=>fn(tx,scope)},analysis={assertCurrent:async()=>({basis,manifest})};
 const load=(path,name)=>name==='canonicalManifestHash'?value=>reportDigest(canonicalReportJson(value)):name==='normalizeFormSchema'?value=>value:()=>{};
 const source={runGroupId:'group-run',snapshotId:basis.snapshotId};
 const adapter={schemaVersion:'full-study-report-v2',sourceField:'runGroupId',defaultTitle:'合成整课题报告',
  readSource:async(_tx,_user,_s,studyId,sourceId)=>{assert.equal(studyId,'study');assert.equal(sourceId,'group-run');store.reads++;return {source,basis};},
  buildContent:(value,b,title)=>{const contentMd='固定整课题来源',sources=[{sourceType:'data_snapshot',sourceId:b.snapshotId,sourceVersion:b.manifestHash,snapshot:{runGroupId:value.runGroupId}}];return{title,contentMd,contentBlocks:[{schemaVersion:'full-study-report-v2',analysisBasis:b,runGroupId:value.runGroupId}],contentHash:reportDigest(contentMd),sourceSnapshotHash:reportDigest(canonicalReportJson(sources)),sources};},
  blockSourceId:block=>block.runGroupId,presentSource:(value,b)=>({runGroupId:value.runGroupId,snapshotId:b.snapshotId}),
 };
 return{user,store,tx,deps:{studies,analysis,load,...(custom?{reportAdapter:adapter}:{})}};
}
test('trusted adapter creates and revalidates a run-group report without any fake MethodRun root or public runId',async()=>{
 const f=fixture(),api=createT17Reports(f.deps),created=await api.create(f.user,'study',{requestKey:'report-group-request',runGroupId:'group-run'});
 assert.equal(created.runGroupId,'group-run');assert.equal(Object.hasOwn(created,'runId'),false);assert.equal(f.store.version.contentBlocks[0].schemaVersion,'full-study-report-v2');
 const read=await api.read(f.user,'study',created.artifactId);assert.equal(read.runGroupId,'group-run');assert.equal(Object.hasOwn(read,'runId'),false);assert.equal(f.store.reads,2);
 f.store.version.sources[0].snapshot.runGroupId='tampered';await assert.rejects(api.read(f.user,'study',created.artifactId),error=>error.code==='REPORT_INTEGRITY_INVALID');
});
test('default T17 report creation and read retain their real MethodRun identity and schema',async()=>{
 const f=fixture(false),api=createT17Reports(f.deps),created=await api.create(f.user,'study',{requestKey:'report-v1-request',runId:'run'});
 assert.equal(created.runId,'run');assert.equal(Object.hasOwn(created,'runGroupId'),false);assert.equal(f.store.version.contentBlocks[0].schemaVersion,'formal-analysis-report-v1');assert.equal((await api.read(f.user,'study',created.artifactId)).runId,'run');
});
test('malformed trusted adapters and cross-contract source inputs fail before creating artifacts',async()=>{
 const f=fixture();assert.throws(()=>createT17Reports({...f.deps,reportAdapter:{sourceField:'runGroupId'}}),/T17_REPORT_ADAPTER_INVALID/);
 await assert.rejects(createT17Reports(f.deps).create(f.user,'study',{requestKey:'bad-report-request',runId:'group-run'}),error=>error.code==='RESEARCH_INPUT_INVALID');assert.equal(f.store.artifact,undefined);
});

for(const custom of [false,true])test('WF09 '+(custom?'full-study':'ordinary')+' preview verifies exact source without creating any artifact and saving repeats its source check',async()=>{
 const f=fixture(custom),api=createT17Reports(f.deps),selector=custom?{runGroupId:'group-run'}:{runId:'run'};
 const preview=await api.preview(f.user,'study',selector);
 assert.equal(preview.status,'preview');assert.equal(preview.studyId,'study');assert.equal(preview[custom?'runGroupId':'runId'],Object.values(selector)[0]);
 assert.equal(preview.contentHash,reportDigest(preview.contentMd));assert.match(preview.previewHash,/^[a-f0-9]{64}$/);assert.equal(f.store.artifact,undefined);assert.equal(f.store.version,undefined);
 const saved=await api.create(f.user,'study',{requestKey:'preview-save-request',...selector,previewHash:preview.previewHash,title:'经核对的合成报告'});
 assert.equal(saved.status,'in_review');assert.equal(f.store.version.contentMd,preview.contentMd);assert.equal(f.store.version.contentHash,preview.contentHash);assert.equal(f.store.artifact.title,'经核对的合成报告');
});
test('WF09 rejects wrong or mixed selectors, missing read permission and changed preview before any report write',async()=>{
 const f=fixture(),api=createT17Reports(f.deps);
 for(const selector of [{},{runId:'run'},{runGroupId:'group-run',runId:'run'},{runGroupId:'group-run',title:'injected'},{runGroupId:['group-run']}])await assert.rejects(api.preview(f.user,'study',selector),e=>e.code==='RESEARCH_INPUT_INVALID');
 await assert.rejects(api.create(f.user,'study',{requestKey:'changed-preview-save',runGroupId:'group-run',previewHash:'0'.repeat(64)}),e=>e.code==='REPORT_PREVIEW_CHANGED');assert.equal(f.store.artifact,undefined);
 f.tx.account.findFirst=async()=>({id:'actor',status:'active',role:'researcher',isTenantAdmin:false,authVersion:1,tenant:{status:'active'}});f.tx.studyGroupMembership={findFirst:async()=>({role:{key:'reader',menuPermissions:['artifacts'],buttonPermissions:['artifact.read']}})};
 const preview=await api.preview(f.user,'study',{runGroupId:'group-run'});assert.equal(preview.capabilities.canCreate,false);assert.equal(preview.capabilities.canReview,false);assert.equal(f.store.artifact,undefined);
 await assert.rejects(api.create(f.user,'study',{requestKey:'reader-preview-save',runGroupId:'group-run',previewHash:preview.previewHash}),e=>e.code==='REPORT_FORBIDDEN');
 f.tx.studyGroupMembership.findFirst=async()=>null;await assert.rejects(api.preview(f.user,'study',{runGroupId:'group-run'}),e=>e.code==='REPORT_FORBIDDEN');assert.equal(f.store.artifact,undefined);
});
test('WF09 authVersion zero remains valid and revoked/unfinished source never becomes a preview',async()=>{
 const f=fixture(false);f.user.authVersion=0;f.tx.account.findFirst=async()=>({id:'actor',status:'active',role:'tenant_admin',isTenantAdmin:true,authVersion:0,tenant:{status:'active'}});
 const api=createT17Reports(f.deps);assert.equal((await api.preview(f.user,'study',{runId:'run'})).status,'preview');
 f.tx.researchMethodReview.findFirst=async()=>({conclusion:'returned',comment:'not confirmed'});await assert.rejects(api.preview(f.user,'study',{runId:'run'}),e=>e.code==='REPORT_METHOD_REVIEW_REQUIRED');
 f.tx.researchMethodReview.findFirst=async()=>({conclusion:'confirmed',comment:'synthetic'});f.deps.analysis.assertCurrent=async()=>{throw Object.assign(Error('revoked'),{status:409,code:'ANALYSIS_PLAN_NOT_APPROVED'});};await assert.rejects(api.preview(f.user,'study',{runId:'run'}),e=>e.code==='ANALYSIS_PLAN_NOT_APPROVED');assert.equal(f.store.artifact,undefined);
});
