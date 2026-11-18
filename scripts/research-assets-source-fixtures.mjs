// Explicit F03 only: exactly two new original docs in the already approved KB.
// Never runs from server startup, restores permissions or retries an unknown POST.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {loadCatalogTarget,assertCatalogIds,readCatalogProtectedSnapshot} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {ASSET_SOURCE_KB,assertAssetSourceManifest} from './research-assets-knowledge-sources.mjs';
import {assetDigest} from './research-assets-registration-contract.mjs';

export const ASSET_SOURCE_DEFINITIONS=Object.freeze([
 {key:'protocol-notes',title:'A01 本轮原创合成研究设计说明 · 20261112',contentMd:'# 原创合成研究设计说明\n\n本材料由本轮开发测试原创编写，仅用于合成方法讨论，不含患者、真实疗效或外部版权正文。\n\n## 研究设计核对\n\n明确研究问题、目标人群、干预与比较条件，说明结局指标及观察时点。研究者逐项核对方案中的定义、缺失处理和来源；本说明不替代伦理审核或实际方案审批。\n\n## 复用说明\n\n允许在本轮具名合成Study整理为资产固定快照，并在原两个合成账号之间按已确认期限阅读正文或引用。不得冒称已执行研究或临床证据。',rightsEvidence:'本轮原创合成材料；允许整理为资产固定快照，并仅在原两个合成账号之间按已确认范围阅读正文和引用。'},
 {key:'dictionary-notes',title:'A01 本轮原创合成数据字典说明 · 20261112',contentMd:'# 原创合成数据字典说明\n\n本材料由本轮开发测试原创编写，仅描述合成数据字段，不含患者资料、数值结果或第三方量表全文。\n\n| 字段 | 含义 | 缺失说明 |\n| --- | --- | --- |\n| synthetic_subject_code | 合成对象代号 | 不填补缺失代号 |\n| synthetic_visit_label | 合成观察时点名称 | 缺失时登记待核对 |\n| synthetic_note | 人工方法备注 | 保留原始空值 |\n\n本字典不构成真实被试库、真实CRF配置或统计执行结果。允许本轮原两个合成账号整理为资产固定快照、限定阅读及引用。',rightsEvidence:'本轮原创合成字段说明；允许整理为资产固定快照，并仅在原两个合成账号之间按已确认范围阅读正文和引用。'}
]);
const phases=['planned','create_sent','created','update_sent','updated','review_sent','reviewed'];
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export function assertAssetSourcePreparation(s,ids){
 assertCatalogIds(ids);
 assert(s?.schemaVersion==='rh-asset-source-preparation.v1'&&['tenant','group','project','owner','admin'].every(k=>s.ids?.[k]===ids[k])&&Number.isFinite(Date.parse(s.startedAt))&&typeof s.complete==='boolean'&&Array.isArray(s.items)&&s.items.length===2,'ASSET_SOURCE_PREPARATION_REJECTED');
 for(const [i,item]of s.items.entries())assert(item.key===ASSET_SOURCE_DEFINITIONS[i].key&&item.title===ASSET_SOURCE_DEFINITIONS[i].title&&phases.includes(item.phase)&&(!item.id||valid(item.id)),'ASSET_SOURCE_PREPARATION_REJECTED');
 return s;
}
const root=fileURLToPath(new URL('../../',import.meta.url)),directory=root+'.tmp/researchhub-assets-local/';
const stateFile=directory+'source-preparation.json',manifestFile=directory+'source-manifest.json';
function save(file,value){const next=file+'.'+randomUUID()+'.tmp';writeFileSync(next,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});renameSync(next,file);}
export async function executeAssetSourceFixtures({prepare=false}={}){
 const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const origin='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
 assert.equal(runtime.ready,true,'LOCAL_ASSET_SOURCE_RUNTIME_REQUIRED');
 // Existing local synthetic embedding only. This probe never provisions/changes a service.
 const embed=await fetch('http://127.0.0.1:19504/health',{signal:AbortSignal.timeout(3000)});assert.equal(embed.status,200,'LOCAL_SYNTHETIC_EMBED_REQUIRED');const embedding=await embed.json();assert(embedding.ok===true&&embedding.model==='BAAI/bge-small-zh-v1.5'&&embedding.dim===512,'LOCAL_EMBED_PROFILE_CHANGED');
 const direct=cb=>withFixtureTransaction(env,'direct',cb,{readOnly:true});
 const snapshot=await direct(async tx=>{
  const kb=await tx.knowledgeBase.findUnique({where:{id:ASSET_SOURCE_KB}});assert(kb&&kb.tenantId===ids.tenant&&kb.studyGroupId===ids.group&&kb.researchProjectId===ids.project&&kb.createdBy===ids.admin&&kb.visibility==='tenant'&&!kb.ownerAccountId,'NAMED_SHARED_SOURCE_KB_CHANGED');
  const admin=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active'}});assert.equal(admin?.role,'tenant_admin','CURRENT_SYNTHETIC_ADMIN_REQUIRED');
  const oldDocs=await tx.knowledgeDoc.findMany({where:{kbId:ASSET_SOURCE_KB,title:{notIn:ASSET_SOURCE_DEFINITIONS.map(d=>d.title)}},select:{id:true,title:true,version:true,contentMd:true,reviewed:true,status:true,safetyLevel:true,trashedAt:true},orderBy:{id:'asc'}});
  return{kbHash:assetDigest(kb),oldDocIds:oldDocs.map(d=>d.id),oldDocsHash:assetDigest(oldDocs.map(d=>({...d,trashedAt:d.trashedAt?.toISOString()??null}))),protected:await readCatalogProtectedSnapshot(tx,ids)};
 });
 const headers={Accept:'application/json',Origin:origin,'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project};
 const call=async(path,init={})=>fetch(origin+'/api'+path,{redirect:'error',signal:AbortSignal.timeout(20000),...init,headers:{...headers,...init.headers}});
 const login=await call('/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:'admin@example.org',password:runtime.password})});assert.equal(login.status,201,'SOURCE_ADMIN_LOGIN_FAILED');
 headers.Cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join(';');assert(headers.Cookie);
 const json=async(path,method,body)=>{const response=await call(path,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});assert(response.ok,'SOURCE_HTTP_'+response.status);return response.json();};
 const bases=await json('/knowledge/bases','GET');assert(Array.isArray(bases)&&bases.some(b=>b.id===ASSET_SOURCE_KB),'SOURCE_KB_NOT_VISIBLE');
 if(!existsSync(stateFile)){
  assert(prepare,'SOURCE_PREPARATION_NOT_CREATED');mkdirSync(directory,{recursive:true,mode:0o700});
  const conflicts=await direct(tx=>tx.knowledgeDoc.count({where:{kbId:ASSET_SOURCE_KB,title:{in:ASSET_SOURCE_DEFINITIONS.map(d=>d.title)}}}));assert.equal(conflicts,0,'UNKNOWN_NAMED_SOURCE_ALREADY_EXISTS');
  save(stateFile,{schemaVersion:'rh-asset-source-preparation.v1',ids,startedAt:new Date().toISOString(),complete:false,snapshot,items:ASSET_SOURCE_DEFINITIONS.map(d=>({key:d.key,title:d.title,phase:'planned',contentMd:d.contentMd,rightsEvidence:d.rightsEvidence}))});
  save(manifestFile,{schemaVersion:'rh-asset-source-manifest.v1',ids,kbId:ASSET_SOURCE_KB,items:[]});
 }
 const state=assertAssetSourcePreparation(JSON.parse(readFileSync(stateFile,'utf8')),ids),manifest=assertAssetSourceManifest(JSON.parse(readFileSync(manifestFile,'utf8')),ids);
 // Repeated invocations never re-review a completed fixture or overwrite a changed document.
 if(!state.complete&&prepare)for(const item of state.items){
  const definition=ASSET_SOURCE_DEFINITIONS.find(d=>d.key===item.key);assert.equal(item.contentMd,definition.contentMd,'SOURCE_ORIGINAL_CONTENT_CHANGED');
  const matches=await direct(tx=>tx.knowledgeDoc.findMany({where:{kbId:ASSET_SOURCE_KB,createdBy:ids.admin,title:item.title},select:{id:true,createdAt:true}}));assert(matches.length<=1,'DUPLICATE_NAMED_SOURCE');
  if(!item.id&&matches.length){assert(item.phase==='create_sent'&&matches[0].createdAt>=new Date(state.startedAt),'UNKNOWN_NAMED_SOURCE_ALREADY_EXISTS');item.id=matches[0].id;item.phase='created';save(stateFile,state);}
  if(item.phase==='planned'){
   item.phase='create_sent';save(stateFile,state);const created=await json('/knowledge/docs','POST',{kbId:ASSET_SOURCE_KB,title:item.title});assert(valid(created.id));item.id=created.id;item.phase='created';save(stateFile,state);
  }
  assert(item.id,'SOURCE_CREATE_OUTCOME_UNKNOWN_DO_NOT_REPEAT');
  let doc=await json('/knowledge/docs/'+item.id,'GET');assert.equal(doc.kbId,ASSET_SOURCE_KB);assert.equal(doc.title,item.title);assert.equal(doc.createdBy,ids.admin);
  if(item.phase==='update_sent'&&doc.version===2&&doc.contentMd===item.contentMd){item.phase='updated';save(stateFile,state);}
  if(item.phase==='created'){
   assert.equal(doc.version,1);assert.equal(doc.contentMd,'');item.phase='update_sent';save(stateFile,state);
   doc=await json('/knowledge/docs/'+item.id,'PATCH',{baseVersion:1,contentMd:item.contentMd});item.phase='updated';save(stateFile,state);
  }
  assert.equal(doc.version,2,'SOURCE_VERSION_OR_UPDATE_OUTCOME_CHANGED');assert.equal(doc.contentMd,item.contentMd);
  if(item.phase==='review_sent'&&doc.reviewed===true&&doc.status==='published'){item.phase='reviewed';save(stateFile,state);}
  if(item.phase==='updated'){
   assert.equal(doc.reviewed,false);item.phase='review_sent';save(stateFile,state);doc=await json('/knowledge/docs/'+item.id+'/review','PATCH',{reviewed:true});item.phase='reviewed';save(stateFile,state);
  }
  assert.equal(item.phase,'reviewed','SOURCE_REVIEW_OUTCOME_UNKNOWN_DO_NOT_REPEAT');assert.equal(doc.reviewed,true);assert.equal(doc.status,'published');
  const contentHash=assetDigest(item.contentMd);
  const captured=await withFixtureTransaction(env,'direct',async tx=>{
   await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",'wp01:tenant:'+ids.tenant);
   const current=await tx.knowledgeDoc.findUnique({where:{id:item.id}}),admin=await tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active',role:'tenant_admin'}});assert(admin&&current?.reviewed&&current.version===2&&current.status==='published'&&assetDigest(current.contentMd)===contentHash,'CURRENT_SOURCE_REVIEW_CHANGED');
   const original=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,OR:[{researchProjectId:ids.project},{researchProjectId:null}],accountId:ids.admin,action:'review_kb_doc',target:item.title+':pass',createdAt:{gte:new Date(state.startedAt)}},orderBy:{createdAt:'desc'}});assert(original,'REAL_SOURCE_REVIEW_AUDIT_MISSING');
   if(original.researchProjectId===ids.project)return{id:original.id,target:original.target};
   const sourceAudit=Object.fromEntries(['id','tenantId','studyGroupId','researchProjectId','accountId','action','target'].map(k=>[k,original[k]]));sourceAudit.createdAt=original.createdAt.toISOString();
   const meta={docId:item.id,kbId:ASSET_SOURCE_KB,version:2,contentHash,sourceAudit,sourceAuditHash:assetDigest(sourceAudit),purpose:'F03 original synthetic source only'};
   const existing=await tx.auditLog.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:'hub_asset_source_review_recorded',target:item.id},orderBy:{createdAt:'desc'}});
   if(existing){assert.equal(assetDigest(existing.meta),assetDigest(meta),'SOURCE_REVIEW_PROJECTION_CHANGED');return{id:existing.id,target:item.id};}
   return{id:(await tx.auditLog.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.admin,action:'hub_asset_source_review_recorded',target:item.id,meta}})).id,target:item.id};
  });
  const entry={key:item.key,id:item.id,title:item.title,createdBy:ids.admin,rightsEvidence:item.rightsEvidence,allowedRecipients:[ids.owner,ids.admin],versions:[{version:2,contentHash,reviewAuditId:captured.id,reviewTarget:captured.target}]};
  const index=manifest.items.findIndex(x=>x.key===item.key);if(index<0)manifest.items.push(entry);else assert.equal(assetDigest(manifest.items[index]),assetDigest(entry),'SOURCE_MANIFEST_CHANGED');save(manifestFile,manifest);
 }
 if(prepare&&!state.complete){assert.equal(manifest.items.length,2);state.complete=true;save(stateFile,state);}
 const verified=await direct(async tx=>{
  const kb=await tx.knowledgeBase.findUnique({where:{id:ASSET_SOURCE_KB}});assert.equal(assetDigest(kb),state.snapshot.kbHash);
  const oldDocs=await tx.knowledgeDoc.findMany({where:{id:{in:state.snapshot.oldDocIds}},select:{id:true,title:true,version:true,contentMd:true,reviewed:true,status:true,safetyLevel:true,trashedAt:true},orderBy:{id:'asc'}});assert.equal(assetDigest(oldDocs.map(d=>({...d,trashedAt:d.trashedAt?.toISOString()??null}))),state.snapshot.oldDocsHash);
  assert.deepEqual(await readCatalogProtectedSnapshot(tx,ids),state.snapshot.protected);
  const docs=await tx.knowledgeDoc.findMany({where:{id:{in:manifest.items.map(x=>x.id)},kbId:ASSET_SOURCE_KB},select:{id:true,version:true,reviewed:true,status:true,contentMd:true}});
  return docs.map(d=>({id:d.id,version:d.version,reviewed:d.reviewed,status:d.status,currentManifestMatch:manifest.items.find(x=>x.id===d.id)?.versions.some(v=>v.version===d.version&&v.contentHash===assetDigest(d.contentMd))===true}));
 });
 return{syntheticOnly:true,prepared:state.complete,kbId:ASSET_SOURCE_KB,items:verified,oldKbAndDocumentsUnchanged:true,oldAssetsAndRolesUnchanged:true,llmCalls:0,localEmbedding:'existing BAAI/bge-small-zh-v1.5 on 127.0.0.1:19504',newKnowledgeBases:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert(['--prepare','--verify'].includes(process.argv[2]),'EXPLICIT_F03_SOURCE_MODE_REQUIRED');
 console.log(JSON.stringify(await executeAssetSourceFixtures({prepare:process.argv[2]==='--prepare'}),null,2));
}
