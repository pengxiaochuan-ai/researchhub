// Approved named family only; all business changes are rolled back.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {loadCatalogTarget,executeCatalogSchema,readCatalogProtectedSnapshot} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createCatalogAccess} from '../../scripts/research-assets-catalog-access.mjs';
import {createAssetLifecycle} from '../../scripts/local-research-assets-lifecycle.mjs';
import {createAssetViewReader} from '../../scripts/research-assets-catalog-views.mjs';
import {createAssetCatalogReader} from '../../scripts/local-research-assets-catalog-read.mjs';
import {createAssetUsage} from '../../scripts/local-research-assets-access.mjs';
import {createAssetRegistration} from '../../scripts/local-research-assets-registration.mjs';
assert.equal(process.argv[2],'--rollback','EXPLICIT_C06_ROLLBACK_REQUIRED');
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeCatalogSchema()).action,'verified');
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});const{lockAuthorizationMutation}=require('./src/common/worker-publication.ts');
const expected=Error('C06_EXPECTED_ROLLBACK');let result;
try{await withFixtureTransaction(env,'direct',async tx=>{
 const before=await readCatalogProtectedSnapshot(tx,ids),accounts=await tx.account.findMany({where:{tenantId:ids.tenant,id:{in:[ids.owner,ids.admin]}},select:{id:true,role:true,authVersion:true}});
 for(const [key,value]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project]])await tx.$executeRawUnsafe('SELECT set_config($1,$2,true)',key,value);
 await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');const [actualRole]=await tx.$queryRawUnsafe('SELECT current_user AS role,r.rolsuper,r.rolbypassrls FROM pg_roles r WHERE rolname=current_user');assert.equal(actualRole.role,'aisci_app');assert(!actualRole.rolsuper&&!actualRole.rolbypassrls);
 const user=who=>({tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[who],role:accounts.find(x=>x.id===ids[who]).role,authVersion:accounts.find(x=>x.id===ids[who]).authVersion});
 const access=createCatalogAccess({ids,transaction:async(_u,run)=>{await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});const value=await run(tx);await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');await tx.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');return value;}}),lifecycle=createAssetLifecycle({withAccess:access}),views=createAssetViewReader({withAccess:access}),reader=createAssetCatalogReader({withAccess:access});
 const [asset]=await access(user('owner'),'artifact.read',t=>t.$queryRawUnsafe("SELECT asset_id FROM rh_asset.asset_registry WHERE owner_account_id=$1 AND asset_kind='instrument'",ids.owner));assert(asset);
 const contribution=await views.read(user('owner'),'contributions',{kind:'instrument'});assert.equal(contribution.totals.created,1,'real event actor must participate in contributions');
 const collaboration=createAssetUsage({ids,withAccess:access}),received=await collaboration.collaborations(user('owner'),{collaborationView:'received'});assert.equal(received.total,2);assert.equal(received.counts.requested,2);
 const registration=createAssetRegistration({ids,withAccess:access}),citeKeys=await access(user('owner'),'artifact.read',t=>t.$queryRawUnsafe("SELECT request_key FROM rh_asset.asset_event WHERE tenant_id=$1 AND actor_account_id=$2 AND event_type='cited'",ids.tenant,ids.owner));assert.equal(citeKeys.length,2);
 for(const key of citeKeys){const r=await registration.operation(user('owner'),key.request_key);assert.equal(r.status,'committed');assert.equal(r.contentAccess,'restricted');assert(!Object.hasOwn(r,'citation'));}
 let counter=0;const build=async(action,who='owner')=>{const o=await lifecycle.options(user(who),asset.asset_id,1);return{action,version:1,expectedRevision:o.expectedRevision,identityRevision:o.identityRevision,contentHash:o.contentHash,policyHash:o.policyHash,requestKey:'c06-pg-original-'+(++counter),reason:'合成回收与恢复验证'};};
 async function rejected(fn,predicate){await tx.$executeRawUnsafe('SAVEPOINT denied');try{await assert.rejects(fn,predicate);}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT denied');}}
 const original=await build('trash'),receipt=await lifecycle.execute(user('owner'),asset.asset_id,original);assert.equal(receipt.operation,'trashed');assert.deepEqual(await lifecycle.execute(user('owner'),asset.asset_id,original),receipt);
 await rejected(()=>reader.detail(user('owner'),asset.asset_id,1),e=>e.status===404);const trash=await views.read(user('owner'),'trash',{});assert(trash.items.some(x=>x.id===asset.asset_id));
 const restore=await build('restore');await rejected(()=>lifecycle.execute(user('owner'),asset.asset_id,{...restore,expectedRevision:restore.expectedRevision-1}),e=>e.status===409);
 const restored=await lifecycle.execute(user('owner'),asset.asset_id,restore);assert.equal(restored.operation,'restored');assert.equal((await reader.detail(user('owner'),asset.asset_id,1)).bodyAccess,'allowed');
 assert(!(await views.read(user('owner'),'trash',{})).items.some(x=>x.id===asset.asset_id));
 const broken=createAssetLifecycle({withAccess:(u,permission,run)=>access(u,permission,(t,p)=>run(new Proxy(t,{get(target,k){return k==='auditLog'?{create:async()=>{throw Error('C06_AUDIT_FAILURE');}}:target[k];}}),p))});const pre=await lifecycle.options(user('owner'),asset.asset_id,1),bad=await build('trash');await rejected(()=>broken.execute(user('owner'),asset.asset_id,bad),/C06_AUDIT_FAILURE/);assert.equal((await lifecycle.options(user('owner'),asset.asset_id,1)).expectedRevision,pre.expectedRevision);
 const [published]=await tx.$queryRawUnsafe("SELECT asset_id FROM rh_asset.asset_registry WHERE owner_account_id=$1 AND asset_kind='protocol'",ids.admin),o=await lifecycle.options(user('admin'),published.asset_id,1);assert.equal(o.allowed,false);
 await access(user('admin'),'artifact.read',t=>t.$executeRawUnsafe('SELECT 1'));await tx.$executeRawUnsafe('RESET ROLE');assert.deepEqual(await readCatalogProtectedSnapshot(tx,ids),before);
 result={syntheticOnly:true,actualRole,checks:['actual event actors','two revoked citation receipts currently redacted','owner soft recycle','same key once','recycled body 404','real trash membership','stale restore CAS refused','restore fixed body','restored removed from trash','audit failure rolls back','published history blocked','old data roles public unchanged'],businessTransactionRolledBack:true,modelCalls:0};throw expected;
 });}catch(e){if(e!==expected)throw e;}
console.log(JSON.stringify(result,null,2));
