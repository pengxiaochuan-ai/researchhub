import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createFullStudyReportAdapter,createFullStudyReports} from './full-study-adapter.mjs';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {reportBundle} from './full-study-fixture.mjs';

const deps=runtimeDependencies();
test('full adapter reads the real confirmed bundle in the caller transaction and exposes only runGroupId',async()=>{
 const bundle=reportBundle();let count=0;
 const adapter=createFullStudyReportAdapter({...deps,runs:{confirmedBundleInTransaction:async(tx,user,s,studyId,id)=>{assert.equal(tx.marker,true);assert.equal(studyId,bundle.studyId);assert.equal(id,bundle.runGroupId);count++;return bundle;}}});
 const cache={runs:new Map(),bases:new Map()},args=[{marker:true},{},{},bundle.studyId,bundle.runGroupId,'export',cache,true];
 const a=await adapter.readSource(...args),b=await adapter.readSource(...args);assert.equal(a.source,b.source);assert.equal(count,1);assert.deepEqual(adapter.presentSource(a.source,a.basis),{runGroupId:bundle.runGroupId,snapshotId:bundle.snapshotId});assert.equal(adapter.sourceField,'runGroupId');assert.equal(adapter.schemaVersion,'full-study-report-v2');
});

test('the existing artifact create/review/release/export/storage/download chain actually invokes the v2 Word renderer',async()=>{
 const bundle=reportBundle(),user={accountId:'actor',authVersion:1},state={audit:[],reviews:[],objects:new Map(),sources:[]};
 const tx={account:{findFirst:async()=>({id:'actor',role:'tenant_admin',isTenantAdmin:true,authVersion:1,tenant:{status:'active'}})},
  researchArtifact:{create:async({data})=>(state.artifact={...data,currentVersionNo:1,createdAt:new Date()}),findFirst:async()=>state.artifact,update:async({data})=>Object.assign(state.artifact,data)},
  researchArtifactVersion:{create:async({data})=>(state.version={...data,id:'version',sources:state.sources}),findFirst:async()=>state.version},researchArtifactSource:{createMany:async({data})=>state.sources.push(...data)},
  researchArtifactReview:{findFirst:async()=>state.reviews.at(-1),findMany:async()=>state.reviews,create:async({data})=>{const value={...data,id:'review',createdAt:new Date(),reviewer:{id:'actor',displayName:'合成审核者'}};state.reviews.push(value);return value;}},
  researchArtifactExportJob:{create:async({data})=>(state.job={...data,id:'job',status:'queued',createdAt:new Date()}),findFirst:async()=>state.job,updateMany:async({data})=>{Object.assign(state.job,data);return {count:1};}},
  researchArtifactFile:{create:async({data})=>(state.job.file={...data,id:'file'})},
  auditLog:{create:async({data})=>{state.audit.push(data);return data;},findMany:async({where})=>state.audit.filter(row=>row.accountId===where.accountId&&row.action===where.action&&row.target===where.target)},
  researchMethodRun:{findFirst:async()=>{throw Error('FAKE_ROOT_METHOD_RUN_FORBIDDEN');}},$queryRaw:async()=>[],$executeRaw:async()=>1,
 };
 const load=(path,name)=>name==='claim'?async()=>{state.job.status='rendering';return {executionToken:'token',workerOwner:'owner'};}:name==='assertLiveClaim'?async()=>{assert.equal(state.job.status,'rendering');}:['heartbeat','recoverExpiredClaim'].includes(name)?async()=>true:deps.load(path,name);
 const api=createFullStudyReports({studies:{withResearchStudyTransaction:(_u,_id,_op,fn)=>fn(tx,{...bundle.caseMetadata.scope,executionProjectId:'project'})},analysis:{assertCurrent:async()=>{throw Error('USE_CONFIRMED_BUNDLE');}},runs:{confirmedBundleInTransaction:async()=>bundle},load,require:deps.require,deploymentScope:{allowedTenantIds:['tenant'],enabledWorkerKinds:['research-artifact-export']},storage:{available:true,put:async(key,buffer)=>state.objects.set(key,buffer),getBuffer:async key=>state.objects.get(key)}});
 const preview=await api.preview(user,'study',{runGroupId:bundle.runGroupId});assert.equal(preview.status,'preview');assert.equal(preview.runGroupId,bundle.runGroupId);assert.equal(state.artifact,undefined);assert.equal(state.version,undefined);assert.equal(state.audit.length,0);assert.equal(state.objects.size,0);assert(preview.contentMd.includes('无有效值'));
 const created=await api.create(user,'study',{requestKey:'full-report-create',runGroupId:bundle.runGroupId,previewHash:preview.previewHash});assert.equal(created.runGroupId,bundle.runGroupId);assert.equal(Object.hasOwn(created,'runId'),false);assert.equal(state.version.contentHash,preview.contentHash);assert.equal(state.version.contentMd,preview.contentMd);
 await api.review(user,'study',created.artifactId,{requestKey:'full-report-review',versionNo:1,decision:'approved',reason:'合成固定来源核对'});
 await api.release(user,'study',created.artifactId,{requestKey:'full-report-release',versionNo:1,reason:'合成软件验收'});
 const queued=await api.export(user,'study',created.artifactId,{requestKey:'full-report-export',versionNo:1,format:'docx'});
 assert.equal((await api.processExport(user,'study',queued.jobId)).status,'ready');const downloaded=await api.download(user,'study',queued.jobId);
 const {unzipSync,strFromU8}=createRequire(deps.require.resolve('docx'))('fflate'),xml=strFromU8(unzipSync(downloaded.buffer)['word/document.xml']);
 assert((xml.match(/<w:tbl>/g)||[]).length>0);assert(xml.includes('无有效值'));assert(xml.includes(bundle.manifestHash));assert(state.audit.some(row=>row.action==='researchhub.analysis.report.download'));
});
