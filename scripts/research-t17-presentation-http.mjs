// PREPARED ONLY. The author ran node --check, not this scenario.
// Execute only after root explicitly confirms the reloaded runtime and identities:
// node scripts/research-t17-presentation-http.mjs --local-synthetic --execute-after-root-ready
// Reuses the D6 alternate synthetic cohort's real confirmed Methods Run. No UI,
// main-subject/answer writes, legacy report updates, identity changes or email.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {setContext} from '../server/research-studies/repository.mjs';
import {buildT17Report,canonicalReportJson,reportDigest} from '../server/research-analysis/t17-report-content.mjs';
import {deriveT17Presentation} from '../server/research-analysis/t17-report-presentation.mjs';

assert.deepEqual(process.argv.slice(2),['--local-synthetic','--execute-after-root-ready']);
const base='http://127.0.0.1:19501',hub=workspaceRoot+'researchhub/';
const hash=x=>createHash('sha256').update(x).digest('hex');
const readJson=p=>JSON.parse(readFileSync(p,'utf8'));
const pinned=(relative,sha)=>{const bytes=readFileSync(hub+relative);assert.equal(hash(bytes),sha,'PINNED_EVIDENCE_CHANGED: '+relative);return JSON.parse(bytes);};
const source=pinned('docs/testing/evidence/research-t15-2026-11-12/rh-t15-http-d6e26d6a/result.json','d9cdfdae4e394168efa33989facfa1f5e53b88bd06cb73ec84b0bff1b3b6dfa0');
const method=pinned('docs/testing/evidence/research-t16-2026-11-12/rh-t16-http-37fe04a1/result.json','55775df4a988e11885b3dfaa1a0f9ef4c1d2210193656a2663aa930756224888');
const legacy=pinned('docs/testing/evidence/research-t17-2026-11-12/rh-t17-http-2a6c2f05/result.json','1c31ee96598ebb952f255a650aa9e4c5512205752ecfb8eb267ec4874af5a593');
const legacyBytes=readFileSync(hub+'docs/testing/evidence/research-t17-2026-11-12/rh-t17-http-2a6c2f05/report.docx');
assert.equal(hash(legacyBytes),'d5ea2fce939bd6234e67556520b96361d5fdf74e8c5da809d17c766f66815ffd');
for(const x of [source,method,legacy])assert(x.passed&&x.syntheticOnly);
assert.equal(source.mainThreeChannelBenchmark,false);assert.equal(method.mainThreeChannelBenchmark,false);
assert.equal(source.runId,'rh-t15-http-d6e26d6a');
assert.equal(method.methodRunId,'cmwd5ueyg002alu4etltfv96b');
assert.equal(legacy.artifactId,'rh-formal-report-73f4048d-596e-4393-ada5-dff3713f9839');
for(const x of [method,legacy]){assert.equal(x.studyId,source.studyId);assert.equal(x.snapshotId,source.snapshotId);}
assert.equal(legacy.methodRunId,method.methodRunId);assert.equal(method.manifestHash,source.manifestHash);
assert.equal(legacy.document.sha256,hash(legacyBytes));
const benchmark=readJson(readJson(workspaceRoot+'.tmp/researchhub-workflow/benchmark-current.json').acceptedFile);
assert(benchmark.passed&&benchmark.syntheticOnly);assert.equal(benchmark.runId,'rh-workflow-benchmark-747c689d');
const mainSubjectIds=new Set(benchmark.analysisSubjectIds),subjectIds=source.subjects.map(x=>x.subjectId).sort();
assert.equal(subjectIds.length,3);assert.equal(new Set(subjectIds).size,3);assert(subjectIds.every(id=>!mainSubjectIds.has(id)),'D6_MUST_NOT_USE_MAIN_THREE');
const runtime=readJson(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json');
assert(runtime.ready===true&&Number.isSafeInteger(runtime.pid));assert.equal(runtime.ids.tenant,source.scope.tenantId);assert.equal(runtime.ids.group,source.scope.studyGroupId);
const reader=readJson(workspaceRoot+'.tmp/researchhub-workflow/t17-reader-session.json');
assert(reader.syntheticOnly);assert.equal(reader.runId,'rh-t17-reader-bb2262c1');assert.equal(reader.studyId,source.studyId);assert.equal(reader.artifactId,legacy.artifactId);
const privateCookies=readJson(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json');
const cookies={admin:privateCookies.admin,owner:privateCookies.owner,reader:reader.cookie,uninvited:privateCookies.uninvited};
for(const cookie of Object.values(cookies))assert(typeof cookie==='string'&&cookie.length>10,'EXISTING_SESSION_REQUIRED_NO_AUTO_LOGIN');
const env=fixtureEnvironment(),apiRoot='/research-studies/'+source.studyId,reportRoot=apiRoot+'/analysis/reports';
const runId='rh-t17-presentation-http-'+randomUUID().slice(0,8),out=hub+'docs/testing/evidence/research-t17-2026-11-12/'+runId+'/';
mkdirSync(out,{recursive:true,mode:0o700});
const statePath=workspaceRoot+'.tmp/researchhub-workflow/t17-presentation-http-state.json';
const guard={schemaVersion:'t17-presentation-http-v1',studyId:source.studyId,methodRunId:method.methodRunId,snapshotId:source.snapshotId,legacyArtifactId:legacy.artifactId,legacyJobId:legacy.jobId,legacyDocxSha256:legacy.document.sha256};
const journal=existsSync(statePath)?readJson(statePath):{guard,campaignId:randomUUID(),pending:null,steps:{},denied:{},history:[]};
assert.deepEqual(journal.guard,guard);assert(Array.isArray(journal.history)&&journal.steps&&journal.denied);
let stage='target-preflight';const network=[],checks=[];
const save=(name,value)=>writeFileSync(out+name,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const saveJournal=()=>{const temporary=statePath+'.'+runId+'.tmp';writeFileSync(temporary,JSON.stringify(journal,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(temporary,statePath);};
const require=createRequire(workspaceRoot+'app/server/package.json');
require('ts-node').register({project:workspaceRoot+'app/server/tsconfig.json',transpileOnly:true});
const normalizeSchema=require('./src/study-operations/study-forms-policy.ts').normalizeFormSchema;
const canonicalManifestHash=require('./src/research-methods/data-quality-release-policy.ts').canonicalManifestHash;
const {unzipSync,strFromU8}=createRequire(require.resolve('docx'))('fflate');
const {XMLParser}=require('fast-xml-parser');
const caps=value=>{assert.deepEqual(Object.keys(value).sort(),['canCreate','canExport','canRelease','canReview']);return value;};
const allCaps={canCreate:true,canReview:true,canRelease:true,canExport:true},noCaps={canCreate:false,canReview:false,canRelease:false,canExport:false};
// Current owner is a group-scope artifact reader/creator, without data.analyze.
// Metadata is allowed; formal source detail remains blocked by current T15 use authority.
const ownerCaps={canCreate:true,canReview:false,canRelease:false,canExport:false};
const receiptPath=entry=>apiRoot+'/analysis/report-receipts/'+entry.body.requestKey+'?'+new URLSearchParams({action:'analysis.report.'+entry.action,targetId:entry.targetId});

async function request(path,{method='GET',body,role='admin',binary=false}={}){
 const entry={at:new Date().toISOString(),stage,role,method,path:'/api'+path,...(body?{body}:{} )};network.push(entry);
 try{
  const r=await fetch(base+'/api'+path,{method,redirect:'error',headers:{Cookie:cookies[role],Origin:base,...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const bytes=Buffer.from(await r.arrayBuffer());entry.status=r.status;entry.responseSha256=hash(bytes);
  let value;if(!binary){try{value=JSON.parse(bytes.toString('utf8'));}catch{entry.invalidJson=true;throw Error('INVALID_JSON_RESPONSE');}entry.code=value?.code??null;}
  return {status:r.status,value,buffer:binary?bytes:undefined,headers:r.headers};
 }catch(error){entry.failure=error.name+': '+error.message;throw error;}
}
async function get(path,{role='admin',status=200,binary=false}={}){
 const r=await request(path,{role,binary});assert.equal(r.status,status,JSON.stringify({stage,path,role,status:r.status,code:r.value?.code}));return binary?r:r.value;
}
function validateReceipt(value,entry){
 assert.equal(value.studyId,source.studyId);assert.equal(value.receipt?.requestKey,entry.body.requestKey);assert.equal(value.receipt?.action,'analysis.report.'+entry.action);assert.equal(value.receipt?.targetId,entry.targetId);
 assert.equal(value.versionNo,1);assert(typeof value.artifactId==='string'&&value.artifactId.startsWith('rh-formal-report-'));assert.notEqual(value.artifactId,legacy.artifactId);
 if(entry.action==='create'){assert.equal(value.runId,method.methodRunId);assert.equal(value.snapshotId,source.snapshotId);assert.equal(value.status,'in_review');}
 else{assert.equal(value.artifactId,journal.steps.create.artifactId);if(entry.action==='review'){assert.equal(value.status,'approved');assert(value.reviewId);}if(entry.action==='release')assert.equal(value.status,'released');if(entry.action==='export'){assert.equal(value.status,'queued');assert(value.jobId);}}
}
async function recoverOnly(entry){
 let recovered;
 try{const response=await request(receiptPath(entry),{role:entry.role});recovered={status:response.status,code:response.value?.code??null};if(response.status===200&&!entry.expectedDenied){validateReceipt(response.value,entry);journal.steps[entry.action]=response.value;journal.history.push({...entry,recoveredAt:new Date().toISOString(),result:response.value});journal.pending=null;saveJournal();recovered.result=response.value;}}
 catch(error){recovered={readFailed:true,message:error.message};}
 save('unknown-recovery.json',{original:entry,recovered,newPostAttempts:0});
 throw Error('UNKNOWN_OPERATION_READ_ONLY_RECOVERY_STOP; inspect original receipt/state before another explicit invocation');
}
async function mutate(action,path,body,{role='admin',expectedDenied=false}={}){
 assert.equal(journal.pending,null,'UNKNOWN_OPERATION_FORBIDS_ANY_POST');
 const liveRuntime=readJson(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json');assert.equal(liveRuntime.pid,runtime.pid,'RUNTIME_CHANGED_STOP_BEFORE_POST');assert.equal(liveRuntime.ready,true);assert.deepEqual(liveRuntime.ids,runtime.ids);
 assert(['create','review','release','export'].includes(action));assert.equal(body.requestKey.length,36);
 const targetId=action==='create'?method.methodRunId:journal.steps.create?.artifactId;
 assert(targetId);assert.notEqual(targetId,legacy.artifactId);
 assert.equal(path,action==='create'?reportRoot:reportRoot+'/'+targetId+({review:'/reviews',release:'/releases',export:'/exports'}[action]));
 if(action==='create')assert.equal(body.runId,method.methodRunId);
 const pending={campaignId:journal.campaignId,attemptRunId:runId,evidenceDirectory:out,stage,role,action,targetId,path,body,expectedDenied,at:new Date().toISOString()};
 journal.pending=pending;saveJournal();let response;
 try{response=await request(path,{method:'POST',body,role});}catch{return recoverOnly(pending);}
 if(expectedDenied){
  if(response.status!==403||response.value?.code!=='REPORT_FORBIDDEN')return recoverOnly(pending);
  journal.denied[action]={status:response.status,code:response.value.code,requestKey:body.requestKey};journal.history.push({...pending,confirmedDeniedAt:new Date().toISOString(),result:journal.denied[action]});journal.pending=null;saveJournal();return response.value;
 }
 if(response.status!==200)return recoverOnly(pending);
 try{validateReceipt(response.value,pending);const original=await get(receiptPath(pending),{role});validateReceipt(original,pending);assert.deepEqual(original,response.value);}catch{return recoverOnly(pending);}
 journal.steps[action]=response.value;journal.history.push({...pending,confirmedAt:new Date().toISOString(),result:response.value});journal.pending=null;saveJournal();return response.value;
}

async function facts(){
 return withFixtureTransaction(env,'direct',async tx=>{
  const marker=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${runtime.key}`;assert(marker[0]?.manifest?.syntheticOnly);
  const admin=await tx.account.findFirst({where:{id:runtime.ids.admin,tenantId:source.scope.tenantId,status:'active'}});assert(admin?.isTenantAdmin&&admin.role==='tenant_admin');
  await setContext(tx,{tenantId:admin.tenantId,accountId:admin.id,authVersion:admin.authVersion},source.scope.studyGroupId,source.scope.researchProjectId);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const run=await tx.researchMethodRun.findFirst({where:{...source.scope,id:method.methodRunId,skillKey:'descriptive-statistics'}});assert(run);assert.equal(run.status,'completed');assert.equal(run.reviewStatus,'confirmed');assert.equal(run.inputSummary.studyId,source.studyId);assert.equal(run.inputSummary.snapshotId,source.snapshotId);assert.equal(run.environment.llm,false);assert.equal(run.environment.workerVersion,'t19-1');
  const snapshot=(await tx.$queryRaw`SELECT manifest,manifest_hash FROM rh_analysis.snapshot WHERE id=${source.snapshotId} AND tenant_id=${source.scope.tenantId} AND study_group_id=${source.scope.studyGroupId} AND research_project_id=${source.scope.researchProjectId} AND study_id=${source.studyId}`)[0];assert(snapshot);assert.equal(snapshot.manifest_hash,source.manifestHash);assert.deepEqual(snapshot.manifest.rows.map(x=>x.subjectId).sort(),subjectIds);assert(snapshot.manifest.rows.every(x=>!mainSubjectIds.has(x.subjectId)));
  const forms=await tx.formVersion.findMany({where:{...source.scope,id:{in:[...new Set(snapshot.manifest.variables.map(x=>x.formVersionId))]}}});
  const artifact=await tx.researchArtifact.findFirst({where:{...source.scope,id:legacy.artifactId}}),version=await tx.researchArtifactVersion.findFirst({where:{...source.scope,artifactId:legacy.artifactId,versionNo:1},include:{sources:true}}),job=await tx.researchArtifactExportJob.findFirst({where:{...source.scope,id:legacy.jobId,artifactId:legacy.artifactId},include:{file:true}});
  assert(artifact&&version&&job?.file);assert.equal(artifact.status,'released');assert.equal(artifact.currentVersionNo,1);assert.equal(job.status,'ready');assert.equal(job.file.sha256,legacy.document.sha256);assert.equal(job.file.sizeBytes.toString(),String(legacy.document.sizeBytes));assert.equal(Object.hasOwn(version.contentBlocks[0],'presentation'),false);
  // Keep private storage keys out of every saved record and console message.
  const {storageKey:_storageKey,...file}=job.file;const {file:_file,...jobMeta}=job;
  let currentReport=null;
  if(journal.steps.create){const id=journal.steps.create.artifactId,a=await tx.researchArtifact.findFirst({where:{...source.scope,id}}),v=await tx.researchArtifactVersion.findFirst({where:{...source.scope,artifactId:id,versionNo:1},include:{sources:true}});assert(a&&v);currentReport={artifact:a,version:v};}
  return {run,manifest:snapshot.manifest,forms,legacyFixed:{artifact,version,job:jobMeta,file:{...file,sizeBytes:file.sizeBytes.toString()}},currentReport};
 },{readOnly:true});
}
function checkBuilt(version,built){
 assert.equal(version.contentMd,built.contentMd);assert.equal(version.contentHash,built.contentHash);assert.equal(version.sourceSnapshotHash,built.sourceSnapshotHash);assert.equal(canonicalReportJson(version.contentBlocks),canonicalReportJson(built.contentBlocks));assert.equal(version.sources.length,built.sources.length);
 for(const source of built.sources){const saved=version.sources.find(x=>x.sourceType===source.sourceType&&x.sourceId===source.sourceId);assert(saved);assert.equal(saved.sourceVersion,source.sourceVersion);assert.equal(saved.hash,reportDigest(canonicalReportJson(source.snapshot)));assert.equal(canonicalReportJson(saved.snapshot),canonicalReportJson(source.snapshot));}
}
function inspectWord(buffer,outputs,presentation){
 const zip=unzipSync(buffer),xml=strFromU8(zip['word/document.xml']),word=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:false}).parse(xml),body=word['w:document']['w:body'],tables=body['w:tbl'];
 assert(Array.isArray(tables));assert.equal(tables.length,presentation.variables.length*2);
 const cellText=c=>{const t=c['w:p']['w:r']['w:t'];return typeof t==='string'?t:t['#text'];};
 const compared=[];
 for(const [index,v]of presentation.variables.entries()){
  const c=outputs.columns[v.key],stats=['total','observed','missing',...(c.type==='number'?['min','max','mean','median','sampleStdDev']:['trueCount','falseCount'])],values=tables[index]['w:tr'].slice(1).map(r=>cellText(r['w:tc'][1]));
  assert.deepEqual(values,stats.map(k=>c[k]===null?'不可估计':String(c[k])));
  for(const stat of stats)assert(xml.includes('columns.'+v.key+'.'+stat));
  for(const text of [v.formVersionId,v.fieldKey,v.formDefinitionHash])assert(xml.includes(text));
  compared.push({key:v.key,label:v.label,fieldKey:v.fieldKey,valueType:v.valueType,unit:v.unit,values,paths:stats.map(stat=>'columns.'+v.key+'.'+stat)});
 }
 assert(xml.includes('rowCount'));assert(xml.includes(method.methodRunId));assert(xml.includes(source.snapshotId));assert(xml.includes(source.manifestHash));assert(xml.includes('未声明'));assert(!xml.includes('SYNTHETIC-ONSITE-747c689d'));
 assert.equal(body['w:sectPr']['w:pgSz']['@_w:w'],'11906');assert.equal(body['w:sectPr']['w:pgSz']['@_w:h'],'16838');
 for(const t of tables){assert.equal(t['w:tblPr']['w:tblW']['@_w:w'],'9026');assert.equal(t['w:tblPr']['w:tblW']['@_w:type'],'dxa');assert.deepEqual(t['w:tblGrid']['w:gridCol'].map(x=>x['@_w:w']),['4513','4513']);for(const r of t['w:tr'])for(const c of r['w:tc'])assert.equal(c['w:tcPr']['w:tcW']['@_w:w'],'4513');}
 return {zipValid:true,tables:tables.length,a4:true,dxaWidthsConsistent:true,allMainCellsExactPersistedRun:true,allFixedPathsPreserved:true,compared};
}

try{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 // Never auto-login, reconfigure, resume a queue or replay a pending POST.
 if(journal.pending){stage='readonly-unknown-recovery';await recoverOnly(journal.pending);}
 const profiles={};for(const role of ['admin','reader','owner','uninvited'])profiles[role]=await get('/auth/me',{role});
 for(const role of Object.keys(profiles))assert.equal(profiles[role].tenantId,source.scope.tenantId);
 assert.equal(profiles.admin.accountId,runtime.ids.admin);assert(profiles.admin.isTenantAdmin&&profiles.admin.role==='tenant_admin');assert.equal(profiles.reader.accountId,reader.accountId);assert.equal(profiles.owner.accountId,runtime.ids.owner);assert.equal(profiles.uninvited.accountId,runtime.ids.uninvited);
 const before=await facts(),snapshot=await get(apiRoot+'/analysis/snapshots/'+source.snapshotId),run=await get(apiRoot+'/analysis/runs/'+method.methodRunId);
 assert.equal(snapshot.basis.snapshotId,source.snapshotId);assert.equal(snapshot.basis.manifestHash,source.manifestHash);assert.equal(canonicalReportJson(snapshot.manifest),canonicalReportJson(before.manifest));assert.equal(canonicalManifestHash(snapshot.manifest),source.manifestHash);assert.equal(run.status,'completed');assert.equal(run.reviewStatus,'confirmed');assert.deepEqual(run.outputs,before.run.artifactRefs.outputs);
 const oldBuilt=buildT17Report(before.run,snapshot.basis,before.legacyFixed.artifact.title);checkBuilt(before.legacyFixed.version,oldBuilt);
 const legacyFingerprint=hash(canonicalReportJson(before.legacyFixed)),runFingerprint=hash(canonicalReportJson(before.run));
 if(journal.legacyFingerprint)assert.equal(journal.legacyFingerprint,legacyFingerprint);else journal.legacyFingerprint=legacyFingerprint;
 if(journal.runFingerprint)assert.equal(journal.runFingerprint,runFingerprint);else journal.runFingerprint=runFingerprint;saveJournal();
 save('preflight.json',{runtimePid:runtime.pid,runtimeReady:runtime.ready,guard,sourceSubjectsDistinctFromMain:true,subjectIds,runFingerprint,legacyFingerprint,legacyContentHash:oldBuilt.contentHash,legacySourceSnapshotHash:oldBuilt.sourceSnapshotHash,profiles:Object.fromEntries(Object.entries(profiles).map(([k,v])=>[k,{accountId:v.accountId,tenantId:v.tenantId,role:v.role,isTenantAdmin:v.isTenantAdmin}]))});
 stage='legacy-read-and-byte-invariance';
 const oldPath=reportRoot+'/'+legacy.artifactId,oldAdmin=await get(oldPath),oldReader=await get(oldPath,{role:'reader'});
 for(const d of [oldAdmin,oldReader]){assert.equal(d.contentMd,oldBuilt.contentMd);assert.equal(d.contentHash,oldBuilt.contentHash);assert.equal(d.runId,method.methodRunId);assert.equal(d.snapshotId,source.snapshotId);}
 assert.deepEqual(caps(oldAdmin.capabilities),allCaps);assert.deepEqual(caps(oldReader.capabilities),noCaps);assert.equal(oldAdmin.docxExportStatus,'available');
 const oldFile=await get(apiRoot+'/analysis/report-exports/'+legacy.jobId+'/file',{binary:true});assert.equal(oldFile.headers.get('x-file-sha256'),legacy.document.sha256);assert.equal(hash(oldFile.buffer),legacy.document.sha256);assert(oldFile.buffer.equals(legacyBytes));
 writeFileSync(out+'legacy-original-byte-copy.docx',oldFile.buffer,{mode:0o600,flag:'wx'});save('legacy-read.json',{admin:oldAdmin,reader:oldReader,byteIdentical:true,sha256:legacy.document.sha256});
 stage='current-role-metadata';
 const adminList=await get(reportRoot),readerList=await get(reportRoot,{role:'reader'});assert.deepEqual(caps(adminList.capabilities),allCaps);assert.deepEqual(caps(readerList.capabilities),noCaps);assert.equal(adminList.docxExportStatus,'available');assert.equal(readerList.docxExportStatus,'available');
 for(const list of [adminList,readerList]){assert(list.items.some(x=>x.artifactId===legacy.artifactId&&x.analysisState==='current'));assert(!/"(?:answers|rows|outputs|numericEvidence|contentMd|contentBlocks)"\s*:/.test(JSON.stringify(list)));}
 const ownerList=await get(reportRoot,{role:'owner'});assert.deepEqual(caps(ownerList.capabilities),ownerCaps);assert.equal(ownerList.items.find(x=>x.artifactId===legacy.artifactId)?.analysisState,'blocked');assert(!/"(?:answers|rows|outputs|numericEvidence|contentMd|contentBlocks)"\s*:/.test(JSON.stringify(ownerList)));
 assert.equal((await get(oldPath,{role:'owner',status:403})).code,'RESEARCH_FORBIDDEN');
 for(const path of [reportRoot,oldPath])assert.equal((await get(path,{role:'uninvited',status:404})).code,'RESEARCH_NOT_FOUND');
 await get(reportRoot+'/rh-formal-report-unknown-'+randomUUID(),{status:404});await get(apiRoot+'/analysis/report-exports/unknown-'+randomUUID(),{status:404});await get(apiRoot+'/analysis/report-receipts/'+randomUUID()+'?'+new URLSearchParams({action:'analysis.report.create',targetId:method.methodRunId}),{status:404});
 save('role-metadata.json',{admin:adminList,reader:readerList,owner:ownerList,ownerSourceDetailBlocked:true,uninvitedStudyAccessDenied:true});checks.push('legacy_exact_md_hash_sources_bytes_current_admin_reader_owner_metadata_and_uninvited_unknown_permissions');
 stage='new-presentation-create';
 if(!journal.steps.create)await mutate('create',reportRoot,{requestKey:randomUUID(),runId:method.methodRunId,title:'合成报告专业可读性 HTTP 核验 '+journal.campaignId});
 const created=journal.steps.create,p=reportRoot+'/'+created.artifactId;
 assert.notEqual(created.artifactId,legacy.artifactId);assert.equal(created.runId,method.methodRunId);assert.equal(created.snapshotId,source.snapshotId);
 // A known prior successful step is only read, never submitted again.
 const createdAdmin=await get(p),createdReader=await get(p,{role:'reader'});assert.deepEqual(caps(createdAdmin.capabilities),allCaps);assert.deepEqual(caps(createdReader.capabilities),noCaps);assert.equal(createdAdmin.contentHash,createdReader.contentHash);assert.equal((await get(p,{role:'owner',status:403})).code,'RESEARCH_FORBIDDEN');assert.equal((await get(p,{role:'uninvited',status:404})).code,'RESEARCH_NOT_FOUND');
 // Verify the trusted new envelope/body/sources before any approval or delivery.
 const preReview=await facts(),prePresentation=deriveT17Presentation(preReview.manifest,preReview.forms,normalizeSchema,canonicalManifestHash),preBuilt=buildT17Report(preReview.run,snapshot.basis,preReview.currentReport.artifact.title,prePresentation);checkBuilt(preReview.currentReport.version,preBuilt);assert.equal(createdAdmin.contentMd,preBuilt.contentMd);assert.equal(createdAdmin.contentHash,preBuilt.contentHash);save('new-pre-review.json',{artifactId:created.artifactId,presentation:prePresentation,contentHash:preBuilt.contentHash,sourceSnapshotHash:preBuilt.sourceSnapshotHash,bodyAndBothSourcesVerifiedAgainstCurrentPersistedRun:true});
 stage='reader-writes-denied';
 for(const action of ['create','review','release','export'])if(!journal.denied[action]){
  const body=action==='create'?{requestKey:randomUUID(),runId:method.methodRunId}:action==='review'?{requestKey:randomUUID(),versionNo:1,decision:'approved',reason:'合成只读身份权限反例'}:action==='release'?{requestKey:randomUUID(),versionNo:1,reason:'合成只读身份权限反例'}:{requestKey:randomUUID(),versionNo:1,format:'docx'};
  await mutate(action,action==='create'?reportRoot:p+({review:'/reviews',release:'/releases',export:'/exports'}[action]),body,{role:'reader',expectedDenied:true});
 }
 stage='actual-review-release-export';
 if(!journal.steps.review)await mutate('review',p+'/reviews',{requestKey:randomUUID(),versionNo:1,decision:'approved',reason:'合成软件核验：逐格对照已确认实际 Methods 运行和固定字段标签，不代替临床签认'});
 if(!journal.steps.release)await mutate('release',p+'/releases',{requestKey:randomUUID(),versionNo:1,reason:'已核对固定合成来源和统计，准许受控文件核验'});
 if(!journal.steps.export)await mutate('export',p+'/exports',{requestKey:randomUUID(),versionNo:1,format:'docx'});
 const exported=journal.steps.export,job=await get(apiRoot+'/analysis/report-exports/'+exported.jobId);assert.equal(job.status,'ready','DO_NOT_RESUME_OR_REPOST_UNKNOWN_EXPORT');assert.equal(job.artifactId,created.artifactId);assert(job.file?.sha256);assert.equal('storageKey'in job.file,false);
 const downloaded=await get(apiRoot+'/analysis/report-exports/'+exported.jobId+'/file',{binary:true}),sha256=hash(downloaded.buffer);assert.equal(downloaded.headers.get('x-file-sha256'),sha256);assert.equal(job.file.sha256,sha256);assert.equal(job.file.sizeBytes,downloaded.buffer.length);assert.equal(downloaded.buffer.subarray(0,2).toString(),'PK');
 const after=await facts();assert.equal(hash(canonicalReportJson(after.legacyFixed)),legacyFingerprint);assert.equal(hash(canonicalReportJson(after.run)),runFingerprint);
 const presentation=deriveT17Presentation(after.manifest,after.forms,normalizeSchema,canonicalManifestHash),built=buildT17Report(after.run,snapshot.basis,after.currentReport.artifact.title,presentation);checkBuilt(after.currentReport.version,built);
 const detail=await get(p);assert.equal(detail.status,'released');assert.equal(detail.contentMd,built.contentMd);assert.equal(detail.contentHash,built.contentHash);assert.deepEqual(caps(detail.capabilities),allCaps);assert.deepEqual(caps((await get(p,{role:'reader'})).capabilities),noCaps);
 const document=inspectWord(downloaded.buffer,after.run.artifactRefs.outputs,presentation);writeFileSync(out+'new-presentation.docx',downloaded.buffer,{mode:0o600,flag:'wx'});writeFileSync(out+'new-content.md',built.contentMd,{mode:0o600,flag:'wx'});
 const oldFinal=await get(apiRoot+'/analysis/report-exports/'+legacy.jobId+'/file',{binary:true});assert(oldFinal.buffer.equals(legacyBytes));assert.equal(hash(oldFinal.buffer),legacy.document.sha256);
 assert.equal(journal.pending,null);checks.push('unique_new_report_original_receipts_reader_four_write_403_actual_review_release_ready_controlled_minio_download_word_cells_exact_run_and_full_appendix');
 const result={passed:true,at:new Date().toISOString(),runId,syntheticOnly:true,runtimePid:runtime.pid,studyId:source.studyId,methodRunId:method.methodRunId,snapshotId:source.snapshotId,artifactId:created.artifactId,jobId:job.jobId,legacy:{artifactId:legacy.artifactId,jobId:legacy.jobId,contentHash:oldBuilt.contentHash,sourceSnapshotHash:oldBuilt.sourceSnapshotHash,sha256:legacy.document.sha256,bytesUnchanged:true,dbFixedRowsUnchanged:true},source:{subjectIds,mainThreeChannelBenchmark:false,runFingerprint,manifestHash:source.manifestHash,presentation},document:{filename:'new-presentation.docx',sha256,sizeBytes:downloaded.buffer.length,storageReadVia:'target controlled HTTP download using current StorageService path',...document},journal:{campaignId:journal.campaignId,pending:journal.pending,steps:journal.steps,denied:journal.denied},checks,network,browserAcceptance:false,clinicalAcceptance:false,productionAcceptance:false};
 save('result.json',result);writeFileSync(workspaceRoot+'.tmp/researchhub-workflow/t17-presentation-http-current.json',JSON.stringify({acceptedFile:out+'result.json'})+'\n',{mode:0o600});console.log(JSON.stringify({passed:true,evidence:out+'result.json',artifactId:created.artifactId,jobId:job.jobId}));
}catch(error){
 save('failure.json',{passed:false,at:new Date().toISOString(),runId,stage,message:error.message,guard,checks,network,pending:journal.pending,knownSteps:journal.steps,automaticPostReplayAttempted:false});console.error(JSON.stringify({passed:false,stage,message:error.message.slice(0,1000),evidence:out+'failure.json'}));process.exitCode=1;
}
