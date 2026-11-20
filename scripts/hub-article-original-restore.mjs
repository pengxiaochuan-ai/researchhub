// One approved production object. Executed once inside the existing Hub API.
import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{readResearchRuntimeConfig}from'./server/research-runtime/config.mjs';
import{runtimeDependencies}from'./server/research-runtime/dependencies.mjs';
import{bindRuntimeTransactions,withDeploymentTransaction}from'./server/database/transactions.mjs';
import{storageSettings,createRuntimeStorage}from'./server/research-runtime/storage.mjs';
import{getCurrentPmcAiHit}from'./server/hub-sources/pmc-visible.mjs';
import{loadArticleEvidence}from'./server/hub-sources/article-evidence.mjs';
import{createPmcObjectReader}from'./server/research-runtime/pmc-storage.mjs';
const sha='48556afca3235223e18adf8f82b03b46223d34b3af29be13a0b0e01a80944967',tenant='rh-kb-local-b0e2af9d-tenant',length=150195,hash=b=>createHash('sha256').update(b).digest('hex'),raw=fs.readFileSync(0);let prisma;
try{
 assert(raw.length===length&&hash(raw)===sha,'ARTICLE_ORIGINAL_INPUT_REJECTED');
 const config=readResearchRuntimeConfig(process.env);assert(config.identity.database==='researchhub'&&config.identity.tenantId===tenant,'ARTICLE_ORIGINAL_TARGET_REJECTED');
 const{load,require}=runtimeDependencies(config.core);prisma=new(load('prisma/prisma.service','PrismaService'))();await prisma.app.$connect();await prisma.elevated.$connect();const env=bindRuntimeTransactions({prisma,expected:config.identity});
 const actor=await withDeploymentTransaction(env,'direct',tx=>tx.account.findUnique({where:{id:tenant.replace(/-tenant$/,'-admin')},select:{id:true,role:true,isTenantAdmin:true,authVersion:true}}),{readOnly:true});
 assert(actor?.role==='tenant_admin'&&actor.isTenantAdmin,'ARTICLE_ORIGINAL_ACTOR_REJECTED');
 const user={tenantId:tenant,accountId:actor.id,role:actor.role,isTenantAdmin:actor.isTenantAdmin,authVersion:actor.authVersion,studyGroupId:tenant.replace(/-tenant$/,'-group'),researchProjectId:tenant.replace(/-tenant$/,'-project')};
 const read=fn=>withDeploymentTransaction(env,'app',async tx=>{await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true),set_config('app.account_id',$2,true),set_config('app.auth_version',$3,true),set_config('app.study_group_id',$4,true),set_config('app.research_project_id',$5,true)",tenant,user.accountId,String(user.authVersion),user.studyGroupId,user.researchProjectId);return fn(tx)},{readOnly:true});
 await read(async db=>{const hit=await getCurrentPmcAiHit({db,principal:user,tenantId:tenant,hubKey:'lingshu-xinyu',recordId:'pmc-PMC13691533'});assert(hit?.articleVersion==='PMC13691533.1'&&hit.rawSha256===sha&&hit.body,'ARTICLE_ORIGINAL_CURRENT_PURPOSE_REJECTED');const rows=await db.$queryRaw`SELECT a.byte_count AS bytes,a.local_object_key AS key FROM rh_source.pmc_asset a JOIN rh_source.pmc_candidate_version v ON v.id=a.version_id AND v.tenant_id=a.tenant_id AND v.hub_key=a.hub_key WHERE a.tenant_id=${tenant} AND a.hub_key='lingshu-xinyu' AND v.pmcid='PMC13691533' AND v.article_version='PMC13691533.1' AND v.raw_sha256=${sha} AND a.asset_kind='jats' AND a.object_sha256=${sha}`;assert(rows.length&&rows.every(r=>Number(r.bytes)===length&&r.key==='objects/'+sha),'ARTICLE_ORIGINAL_METADATA_REJECTED');});
 const storage=createRuntimeStorage({load,require,settings:storageSettings(process.env)});await storage.onModuleInit();const key=tenant+'/hub-pmc/objects/'+sha;let existed=false;
 try{const old=await storage.getBuffer(key,length);assert(old.length===length&&hash(old)===sha,'ARTICLE_ORIGINAL_EXISTING_MISMATCH');existed=true}catch(e){if(e.code!=='NoSuchKey')throw e}
 if(!existed){const versioning=await storage.client.getBucketVersioning(storage.bucket);assert(!versioning.Status,'ARTICLE_ORIGINAL_VERSIONING_REJECTED');const response=await storage.client.makeRequestAsync({method:'PUT',bucketName:storage.bucket,objectName:key,headers:{'content-type':'application/xml','content-md5':createHash('md5').update(raw).digest('base64'),'x-oss-forbid-overwrite':'true'}},raw,[200]);response.resume();}
 const actual=await storage.getBuffer(key,length);assert(actual.length===length&&hash(actual)===sha,'ARTICLE_ORIGINAL_READBACK_REJECTED');
 const pack=await read(async db=>(await loadArticleEvidence({db,principal:user,tenantId:tenant,hubKey:'lingshu-xinyu',recordId:'pmc-PMC13691533',readPmcAsset:createPmcObjectReader(storage,tenant)})).pack);
 console.log(JSON.stringify({status:'article-original-restored',objectWrites:existed?0:1,bytes:length,sha256:sha,binding:pack.binding,fragments:pack.fragments.length,databaseWrites:0,modelCalls:0,workersStarted:0}));
}catch(e){console.log(JSON.stringify({status:'stopped',code:/^[A-Za-z][A-Za-z0-9_:.-]{0,100}$/.test(e.code||e.message||'')?(e.code||e.message):e.name||'ARTICLE_ORIGINAL_FAILED',automaticRetry:false}));process.exitCode=1}finally{await prisma?.app?.$disconnect();await prisma?.elevated?.$disconnect()}
