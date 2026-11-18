// Q01: explicit, read-only admission. No startup registration, model, DDL or fixture apply.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {assetDigest} from './research-assets-registration-contract.mjs';
import {buildA02Manifest,assertA02Manifest} from './research-assets-a02-preflight-contract.mjs';
import {loadCatalogTarget,readCatalogProtectedSnapshot,readCatalogDefinitionRows} from './research-assets-catalog-schema.mjs';
import {stableCatalogDigest} from './research-assets-fingerprint-proof.mjs';
import {verifyAssetPublicBaseline} from './research-assets-public-baseline.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const evidence=new URL('../docs/planning/research-assets-product-2026-11-12/evidence/a02-q01/',import.meta.url).pathname;
const privateDir=root+'.tmp/researchhub-assets-local/a02-20261113/';
const json=value=>JSON.stringify(value,(_k,v)=>typeof v==='bigint'?v.toString():v,2)+'\n';
async function main(){
 assert.deepEqual(process.argv.slice(2),['--verify'],'EXPLICIT_A02_Q01_VERIFY_REQUIRED');
 const {env,ids}=loadCatalogTarget(),target=await assertFixtureTarget(env);assert.equal(target.databaseName,'wp01_test_full_baseline');
 const manifest=buildA02Manifest(ids),manifestHash=assertA02Manifest(manifest,ids);
 const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
 const old=path=>require(root+'app/server/src/'+path+'.ts');
 const {renderResearchArtifact,artifactExportFilename}=old('research-artifacts/research-artifact-export');
 const {canonicalArtifactJson}=old('research-artifacts/research-artifact-integrity');
 const {buildResearchStudyPlanDraft}=old('research-evidence/research-study-plan');
 const {parseKnowledgeSourceRange}=old('knowledge/knowledge-source-content');
 const {assertKnowledgeImportFile}=old('knowledge/knowledge-file-policy');
 const {ResearchArtifactsService}=old('research-artifacts/research-artifacts.service');
 for(const method of ['create','createVersion','get','fileContent','createExport'])assert.equal(typeof ResearchArtifactsService.prototype[method],'function');
 const opportunity={title:'合成针灸辅助干预研究方案纲要',scientificQuestion:'针灸辅助干预的研究方案应如何定义？',hypothesis:'仅声明待研究者核对的研究假设，不宣称疗效。',recommendedDesign:'研究设计类型尚待方法学确认。',evidenceIdentifiers:['research_asset:'+manifest.assets[0].key+':v1']};
 const outline=buildResearchStudyPlanDraft({topic:opportunity.scientificQuestion,synthesis:{researchOpportunities:[opportunity]},items:[]});
 assert.equal(outline.design.type,'requires_methodologist_confirmation');assert.equal(outline.numericAuthority,'research_method_run_only');assert(outline.unresolvedMethodParameters.length>0);
 const content='# 合成资产固定版本\n\n研究者必须核对适用条件；此处没有真实研究结果。\n\n来源：'+opportunity.evidenceIdentifiers[0];
 const exported=await renderResearchArtifact('markdown',{id:'a02-memory-format-check',title:'合成方案模板',status:'draft',typeKey:'protocol_draft',versionNo:1,contentMd:content,generatedAt:new Date('2026-11-13T00:00:00Z')});
 assert.equal(exported.extension,'md');assert.equal(exported.mimeType,'text/markdown; charset=utf-8');assert(exported.buffer.toString().includes(content));assert(exported.buffer.toString().includes('未经审核'));
 assert(!/[\\/]/.test(artifactExportFilename('../unsafe/name',1,'markdown')));
 await assert.rejects(renderResearchArtifact('markdown',{id:'a02-memory-format-check',title:'合成方案',status:'draft',typeKey:'protocol_draft',versionNo:1,contentMd:content,contentBlocks:[{type:'sample_size',value:10}],generatedAt:new Date()}),/ARTIFACT_EXPORT_NUMERIC_PROVENANCE_INVALID/);
 for(const file of manifest.files){const checked=assertKnowledgeImportFile({filename:file.filename,buffer:Buffer.from(file.content),size:file.byteLength});assert.equal(checked.sha256,file.sha256);}
 mkdirSync(evidence,{recursive:true});
 const uploadPath=root+'.tmp/researchhub-assets-local/uploads/uploads.json',uploadBytes=readFileSync(uploadPath),uploads=JSON.parse(uploadBytes);assert.equal(uploads.items.length,4);assert(uploads.items.every(x=>x.status==='bound'));
 const probePaths=['a01-response-probe-20261113.json','a01-governance-probe-20261113.json','a01-usage-probe-20261113.json','a01-c07-read-window.json','a01-c07-trash-probe.json'];
 const {existsSync}=await import('node:fs');
 const localHashes=()=>Object.fromEntries([uploadPath,...['source-manifest.json','source-preparation.json',...probePaths].map(p=>root+'.tmp/researchhub-assets-local/'+p)].filter(existsSync).map(p=>[p.slice(root.length),assetDigest(readFileSync(p))]));
 const beforeLocal=localHashes();
 async function snapshot(){return withFixtureTransaction(env,'direct',async tx=>{
  const protectedState=await readCatalogProtectedSnapshot(tx,ids);
  const a01=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:'rh-research-asset:catalog-20261112:'}},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},files:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
  const events=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.asset_event WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 ORDER BY asset_id,asset_revision',ids.tenant,ids.group,ids.project);
  const registry=await tx.$queryRawUnsafe('SELECT * FROM rh_asset.asset_registry WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 ORDER BY asset_id',ids.tenant,ids.group,ids.project);
  const d01=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,action:'research_assets_catalog_schema_20261112',target:'rh_asset'},select:{meta:true}});
  const publicProof=await verifyAssetPublicBaseline(tx,{tenantId:ids.tenant,expectedHash:d01.meta.protectedSnapshot.publicDefinitionHash});
  const accounts=await tx.account.findMany({where:{id:{in:[ids.owner,ids.admin]}},select:{id:true,tenantId:true,role:true,status:true,authVersion:true},orderBy:{id:'asc'}});
  const study=await tx.researchProject.findFirst({where:{id:ids.project,tenantId:ids.tenant,studyGroupId:ids.group},select:{id:true,status:true,studyGroupId:true}});assert.equal(study?.status,'active');
  const memberships=await tx.researchProjectMembership.findMany({where:{researchProjectId:ids.project,accountId:{in:[ids.owner,ids.admin]}},select:{accountId:true,status:true,roleKey:true,isDefault:true},orderBy:{accountId:'asc'}});assert(memberships.some(x=>x.accountId===ids.owner&&x.status==='active'));
  const newAssets=await tx.researchArtifact.count({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:'rh-research-asset:detail-20261113:'}}});assert.equal(newAssets,0);
  const b=await tx.researchProject.findUnique({where:{id:manifest.targetStudy.id},select:{id:true}});assert.equal(b,null);
  const columns=await tx.$queryRawUnsafe("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('research_project','research_project_membership','research_artifact','research_artifact_version','research_artifact_file') ORDER BY table_name,ordinal_position");
  const grants=await tx.$queryRawUnsafe("SELECT c.relname AS name,has_table_privilege('aisci_app',c.oid,'SELECT') AS can_read,has_table_privilege('aisci_app',c.oid,'INSERT') AS can_insert FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('research_project','research_project_membership','research_artifact','research_artifact_version','research_artifact_source','research_artifact_file','audit_log') ORDER BY c.relname");assert(grants.every(x=>x.can_read&&x.can_insert));
  const [{value}]=await tx.$queryRawUnsafe('SELECT $1::jsonb AS value',JSON.stringify(outline));assert.equal(canonicalArtifactJson(value),canonicalArtifactJson(outline));
  for(const item of uploads.items){const row=a01.find(a=>a.id===item.binding?.assetId);assert(row);const version=row.versions.find(v=>v.versionNo===item.binding.version);assert(version);assert(row.files.some(f=>f.artifactVersionId===version.id&&f.sha256===item.sha256&&Number(f.sizeBytes)===item.sizeBytes&&f.storageKey===item.storageKey));}
  const sources=JSON.parse(readFileSync(root+'.tmp/researchhub-assets-local/source-manifest.json','utf8'));
  const kb=await tx.knowledgeBase.findUnique({where:{id:sources.kbId}}),docs=await tx.knowledgeDoc.findMany({where:{id:{in:sources.items.map(x=>x.id)},tenantId:ids.tenant},orderBy:{id:'asc'}});assert(kb&&docs.length===2);
  const hash=x=>assetDigest(json(x));
  return{oldAssetsHash:protectedState.oldAssetsHash,roleHash:protectedState.roleHash,publicHash:publicProof.fullDefinitionHash,ownedSchemaHash:stableCatalogDigest(await readCatalogDefinitionRows(tx,'rh_asset',{fullNames:true})),a01Hash:hash(a01),eventsHash:hash(events),registryHash:hash(registry),sourceKbHash:hash(kb),sourceDocsHash:hash(docs),a01Counts:{assets:a01.length,versions:a01.reduce((n,a)=>n+a.versions.length,0),events:events.length,trashed:registry.filter(a=>a.deleted_at).length},accounts,memberships,study,grants,columnHash:hash(columns),jsonbFormatRoundTrip:true,newA02Assets:newAssets,newBExists:false};
 },{readOnly:true});}
 const before=await snapshot();writeFileSync(evidence+'before.json',json(before));assert.deepEqual(before.a01Counts,{assets:10,versions:15,events:39,trashed:0});
 // Reuse real old storage read methods without onModuleInit (which can create a missing bucket).
 const storageEnv=JSON.parse(readFileSync(root+'.tmp/wp01-pre-release/rehearsal-o7gOnS/runtime.json')).profiles[0].env;assert.equal(storageEnv.S3_ENDPOINT,'http://127.0.0.1:19402');
 const {Client}=require('minio'),{StorageService}=old('storage/storage.service');const client=new Client({endPoint:'127.0.0.1',port:19402,useSSL:false,accessKey:storageEnv.S3_ACCESS_KEY,secretKey:storageEnv.S3_SECRET_KEY,region:storageEnv.S3_REGION,pathStyle:true});
 const storageCalls=[];const readClient=new Proxy(client,{get(target,key){assert(['getObject','getPartialObject','statObject'].includes(key),'Q01_STORAGE_READ_ONLY');return(...args)=>{storageCalls.push(String(key));return target[key](...args);};}});
 // local-knowledge.mjs explicitly uses its owned rh-kb-local-* key as bucket,
 // not the separate pre-release profile's bucket. Never call ensureBucket here.
 const bucket=ids.tenant.replace(/-tenant$/,'');assert.match(bucket,/^rh-kb-local-[a-f0-9]{8}$/);
 const storage=Object.assign(Object.create(StorageService.prototype),{ready:true,client:readClient,bucket}),files=[];
 for(const item of uploads.items){assert.equal(item.storageMode,'primary');assert(item.storageKey.startsWith(ids.tenant+'/hub-assets/'));
  const stat=await storage.statObject(item.storageKey),buffer=await storage.getBuffer(item.storageKey,1048576);assert.equal(Number(stat.size),item.sizeBytes);assert.equal(buffer.length,item.sizeBytes);assert.equal(assetDigest(buffer),item.sha256);
  const range=parseKnowledgeSourceRange('bytes=0-15',buffer.length),stream=await storage.getStream(item.storageKey,range.start,range.length),chunks=[];for await(const chunk of stream)chunks.push(chunk);assert.deepEqual(Buffer.concat(chunks),buffer.subarray(0,16));
  assert.throws(()=>parseKnowledgeSourceRange('bytes='+buffer.length+'-',buffer.length));assert.throws(()=>parseKnowledgeSourceRange('bytes=0-1,3-4',buffer.length));assert.throws(()=>parseKnowledgeSourceRange('bytes=-4',buffer.length));
  files.push({assetId:item.binding.assetId,version:item.binding.version,size:item.sizeBytes,sha256:item.sha256,rangeActualBytes:range.length,dbBindingVerified:true});
 }
 const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),origin='http://127.0.0.1:19501',http=[];
 for(const actor of ['owner','admin']){
  let cookie;
  try{
   const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}),signal:AbortSignal.timeout(15000)});assert.equal(login.status,201);cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join(';');
   const headers={Cookie:cookie,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
   const me=await fetch(origin+'/api/auth/me',{headers,signal:AbortSignal.timeout(15000)});assert.equal(me.status,200);const user=await me.json();assert.equal(user.accountId,ids[actor]);
   const list=await fetch(origin+'/api/research-assets/catalog',{headers,signal:AbortSignal.timeout(15000)});assert.equal(list.status,200);const catalog=await list.json();
   for(const kind of ['protocol','dataset','instrument','analysis','publication']){const row=catalog.items.find(x=>x.kind===kind&&x.owner.accountId===ids[actor]);assert(row,'A01 own '+kind);const res=await fetch(origin+'/api/research-assets/catalog/'+row.id+'/versions/'+row.version,{headers,signal:AbortSignal.timeout(15000)});assert.equal(res.status,200);const data=await res.json();assert.equal(data.id,row.id);assert.equal(data.version,row.version);http.push({actor,kind,id:row.id,version:row.version,status:res.status});}
  }finally{if(cookie)await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-ResearchHub-Request':'session-v1'},signal:AbortSignal.timeout(15000)});}
 }
 const after=await snapshot();writeFileSync(evidence+'after.json',json(after));assert.deepEqual(after,before);assert.deepEqual(localHashes(),beforeLocal);assert.deepEqual(readFileSync(uploadPath),uploadBytes);
 mkdirSync(privateDir,{recursive:true,mode:0o700});
 if(existsSync(privateDir+'fixture-plan.json'))assert.equal(assertA02Manifest(JSON.parse(readFileSync(privateDir+'fixture-plan.json','utf8')),ids),manifestHash);
 else writeFileSync(privateDir+'fixture-plan.json',json(manifest),{mode:0o600,flag:'wx'});
 const result={passed:true,at:new Date().toISOString(),syntheticOnly:true,database:target.databaseName,ownedPid:runtime.pid,manifestHash,planned:{assets:16,contentVersions:52,successfulOperations:384,studyB:1,targetDrafts:4,files:4,comments:8},actualCreated:0,ddlApplied:0,modelCalls:0,newBillingJobs:0,oldServicesChanged:false,protectedUnchanged:true,privateManifestsAndProbesUnchanged:true,pureRuntime:{markdownBytes:exported.buffer.length,markdownHash:assetDigest(exported.buffer),draftWatermark:true,unprovenNumbersRejected:true,studyPlanFormat:outline.schemaVersion,designType:outline.design.type,jsonbRoundTrip:true,newDraftCreateNotExecuted:true},files,storageCalls,http,reuse:[{area:'fixed versions/Markdown/study outline/file bytes/Range',status:'runtime_verified'},{area:'A02 comments/purpose/compare/copied candidates',status:'approved_Hub_adaptation_Q02_Q06'},{area:'Study B existing narrow design adapter',status:'Hub_adapter_required_fixed_A_and_KB_binding_do_not_reuse_factory'},{area:'new B draft create/edit and application',status:'not_executed_Q06'},{area:'paid AI',status:'not_authorized_F_AI_stop'}]};
 writeFileSync(evidence+'preflight.json',json(result));writeFileSync(evidence+'fixture-plan-summary.json',json({schema:manifest.schema,manifestHash,assets:manifest.assets.map(({key,actor,kind,mode,maxVersions})=>({key,actor,kind,mode,maxVersions})),targetStudy:manifest.targetStudy,applications:manifest.applications,files:manifest.files.map(({content,...v})=>v),comments:manifest.comments,execution:manifest.execution}));
 console.log(JSON.stringify({passed:true,evidence:evidence+'preflight.json',a01Counts:after.a01Counts,httpReads:http.length,verifiedStorageFiles:files.length,manifestHash,businessWrites:0,modelCalls:0}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{mkdirSync(evidence,{recursive:true});writeFileSync(evidence+'preflight-failure.json',json({passed:false,code:e.code??e.name,message:String(e.message).trim().replace(/postgres(?:ql)?:\/\/\S+/g,'[database URL redacted]').slice(0,1800)}));process.stderr.write('A02_Q01_FAILED: '+(e.code??e.name)+'; inspect local failure evidence\n');process.exitCode=1;});
