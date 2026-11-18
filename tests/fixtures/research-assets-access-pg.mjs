// Named C05 capability proof. Entire DDL and business transaction is always rolled back.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadCatalogTarget,executeCatalogSchema,readCatalogProtectedSnapshot} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createCatalogAccess} from '../../scripts/research-assets-catalog-access.mjs';
import {createAssetUsage} from '../../scripts/local-research-assets-access.mjs';
import {createAssetCatalogReader} from '../../scripts/local-research-assets-catalog-read.mjs';
import {accessGuardStatements} from '../../scripts/research-assets-access-schema.mjs';
assert(['--baseline','--dry-run','--installed'].includes(process.argv[2]),'EXPLICIT_ACCESS_ROLLBACK_REQUIRED');
const{env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeCatalogSchema()).action,'verified');
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});const{lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
const expected=new Error('EXPECTED_ACCESS_ROLLBACK');let result;
try{await withFixtureTransaction(env,'direct',async tx=>{
 const before=await readCatalogProtectedSnapshot(tx,ids);
 if(process.argv[2]==='--dry-run')for(const sql of accessGuardStatements(ids))await tx.$executeRawUnsafe(sql);
 for(const[k,v]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project]])await tx.$queryRawUnsafe('SELECT set_config($1,$2,true)',k,v);
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');const [identity]=await tx.$queryRawUnsafe('SELECT current_user AS role,r.rolsuper,r.rolbypassrls FROM pg_roles r WHERE rolname=current_user');assert.equal(identity.role,'aisci_app');assert.equal(identity.rolsuper,false);assert.equal(identity.rolbypassrls,false);
 const accounts=await tx.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.owner,ids.admin]}},select:{id:true,role:true,authVersion:true}});
 const user=who=>({...{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project},accountId:ids[who],role:accounts.find(x=>x.id===ids[who]).role,authVersion:accounts.find(x=>x.id===ids[who]).authVersion});
 const current=createCatalogAccess({ids,transaction:async(_u,run)=>{await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});const value=await run(tx);await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');return value;}});
 const service=createAssetUsage({ids,withAccess:current}),reader=createAssetCatalogReader({withAccess:current});
 const [asset]=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:'rh-research-asset:catalog-20261112:admin:protocol'},select:{id:true}});assert(asset);
 let count=0;const build=async(who,action,extra={})=>{const o=await service.options(user(who),asset.id,1);return{action,version:1,expectedRevision:o.expectedRevision,identityRevision:o.identityRevision,contentHash:o.contentHash,policyHash:o.policyHash,requestKey:'c05-pg-'+(++count),...extra};};
 async function rejected(fn,predicate){await tx.$executeRawUnsafe('SAVEPOINT rejected_operation');try{await assert.rejects(fn,predicate);}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT rejected_operation');}}
 const original=await build('owner','request',{actions:['read_body','cite'],purpose:'仅合成方法核对和书目引用',ttlDays:1});
 const requested=await service.execute(user('owner'),asset.id,original);assert.equal(requested.operation,'requested');assert.equal((await service.execute(user('owner'),asset.id,original)).revision,requested.revision);
 await rejected(()=>service.execute(user('owner'),asset.id,{...original,purpose:'不同内容'}),e=>e.code==='ASSET_CATALOG_REQUEST_KEY_CONFLICT');
 assert.equal((await reader.detail(user('owner'),asset.id,1)).bodyAccess,'restricted');
 const duplicate=await build('owner','request',{actions:['cite'],purpose:'重复',ttlDays:1});await rejected(()=>service.execute(user('owner'),asset.id,duplicate),e=>e.code==='ASSET_CATALOG_DUPLICATE_REQUEST');
 const grant=await build('admin','decide',{requestId:requested.requestId,expectedRequestRevision:1,conclusion:'approved',actions:['read_body','cite'],reason:'核对当前固定版合成用途'});
 await rejected(async()=>service.execute(user('owner'),asset.id,{...grant,identityRevision:(await service.options(user('owner'),asset.id,1)).identityRevision}),e=>e.status===403);
 await tx.$executeRawUnsafe('SAVEPOINT recipient_inactive');
 await tx.researchProjectMembership.updateMany({where:{tenantId:ids.tenant,researchProjectId:ids.project,accountId:ids.owner},data:{status:'disabled'}});
 await rejected(()=>service.execute(user('admin'),asset.id,grant),e=>e.code==='ASSET_CATALOG_RIGHTS_REQUIRED');
 await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT recipient_inactive');
 const approved=await service.execute(user('admin'),asset.id,grant);assert.equal(approved.operation,'decided');assert.equal((await reader.detail(user('owner'),asset.id,1)).bodyAccess,'allowed');
 const beforeCitation=await build('owner','cite');
 await rejected(()=>service.execute(user('owner'),asset.id,{...beforeCitation,expectedRevision:beforeCitation.expectedRevision-1}),e=>e.code==='ASSET_CATALOG_VERSION_CONFLICT');
 await rejected(()=>service.execute(user('owner'),asset.id,{...beforeCitation,contentHash:'0'.repeat(64)}),e=>e.code==='ASSET_CATALOG_VERSION_CONFLICT');
 await tx.$executeRawUnsafe('SAVEPOINT actor_disabled');
 await tx.account.update({where:{id:ids.owner},data:{status:'disabled'}});
 await rejected(()=>service.execute(user('owner'),asset.id,beforeCitation),e=>e.status===401);
 await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT actor_disabled');
 const cite=await build('owner','cite'),citation=await service.execute(user('owner'),asset.id,cite);assert.equal(citation.operation,'cited');assert.equal(citation.citation.excerptIncluded,false);assert(citation.citation.url.includes('assetVersion=1'));assert(citation.citation.text.endsWith('[科研资产，v1]．'));assert.equal((await service.execute(user('owner'),asset.id,cite)).revision,citation.revision);
 await service.execute(user('admin'),asset.id,await build('admin','revoke',{requestId:requested.requestId,expectedRequestRevision:2,reason:'结束本次合成用途核对'}));
 assert.equal((await reader.detail(user('owner'),asset.id,1)).bodyAccess,'restricted');
 const denied=await build('owner','cite');await rejected(()=>service.execute(user('owner'),asset.id,denied),e=>e.status===403);
 const shared=await service.execute(user('admin'),asset.id,await build('admin','share',{recipientAccountId:ids.owner,actions:['cite'],purpose:'仅书目引用',ttlDays:1,reason:'限定引用不授正文'}));assert(shared.requestId);
 assert.equal((await reader.detail(user('owner'),asset.id,1)).bodyAccess,'restricted');assert.equal((await service.options(user('owner'),asset.id,1)).canCite,true);
 const future=Date.now()+2*86400000,expiredService=createAssetUsage({ids,withAccess:current,now:()=>future}),expiredReader=createAssetCatalogReader({withAccess:current,now:()=>future});
 assert.equal((await expiredService.options(user('owner'),asset.id,1)).canCite,false);assert.equal((await expiredReader.detail(user('owner'),asset.id,1)).bodyAccess,'restricted');
 await rejected(async()=>expiredService.execute(user('owner'),asset.id,await build('owner','cite')),e=>e.status===403);
 const stateBefore=await service.options(user('admin'),asset.id,1);
 // Audit failure occurs after event insertion; the whole attempted mutation must disappear.
 const badService=createAssetUsage({ids,withAccess:(u,permission,run)=>current(u,permission,(t,p)=>run(new Proxy(t,{get(target,key){return key==='auditLog'?{create:async()=>{throw Error('EXPECTED_AUDIT_FAILURE');}}:target[key];}}),p))});
 const revoke=await build('admin','revoke',{requestId:shared.requestId,expectedRequestRevision:1,reason:'注入审计失败验证'});
 await rejected(()=>badService.execute(user('admin'),asset.id,revoke),/EXPECTED_AUDIT_FAILURE/);assert.equal((await service.options(user('admin'),asset.id,1)).expectedRevision,stateBefore.expectedRevision);assert.equal((await service.options(user('owner'),asset.id,1)).canCite,true);
 // Direct pending->approved rewrite without a corresponding actor-bound event is rejected.
 await rejected(async()=>{await current(user('owner'),'artifact.read',async t=>{await t.$executeRawUnsafe("UPDATE rh_asset.access_request SET approved_actions=ARRAY['read_body'],state='approved',decided_by=$1,decision_reason='forged',revision=revision+1 WHERE request_id=$2",ids.owner,shared.requestId);});},e=>Boolean(e));
 await current(user('admin'),'artifact.read',t=>t.$queryRawUnsafe('SELECT 1'));await tx.$executeRawUnsafe('RESET ROLE');assert.deepEqual(await readCatalogProtectedSnapshot(tx,ids),before);
 result={syntheticOnly:true,actorRole:'aisci_app',superuser:false,bypassRls:false,checks:['same-key before CAS','changed payload refused','no body before grant','duplicate pending refused','recipient cannot approve','inactive recipient cannot receive grant','atomic grant and true body read','stale CAS refused','changed content seal refused','current disabled actor refused','fixed citation without invented publication year or excerpt','citation stored once','revoke stops body/cite','direct cite-only share keeps body restricted','expired grant stops body/cite using injected local clock only','audit failure rolls back registry and event','forged direct grant rejected','old assets roles public unchanged'],persistentBusinessWrites:0,modelsCalled:0};throw expected;
 });}catch(e){if(e!==expected)throw e;}
console.log(JSON.stringify({...result,transactionRolledBack:true},null,2));
