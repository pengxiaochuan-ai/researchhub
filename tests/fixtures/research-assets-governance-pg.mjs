// Uses only the ten approved new assets; every business change is rolled back.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createCatalogAccess} from '../../scripts/research-assets-catalog-access.mjs';
import {loadCatalogTarget,readCatalogProtectedSnapshot,executeCatalogSchema} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {composeAssetCatalog} from '../../scripts/local-research-assets-catalog.mjs';
import {createAssetGovernance} from '../../scripts/local-research-assets-governance.mjs';
import {createAssetKnowledgeSources} from '../../scripts/research-assets-knowledge-sources.mjs';
assert.equal(process.argv[2],'--dry-run','EXPLICIT_GOVERNANCE_ROLLBACK_REQUIRED');
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeCatalogSchema()).action,'verified');
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {lockAuthorizationMutation}=require('./src/common/worker-publication.ts'),{withCurrentKnowledgeRead}=require('./src/knowledge/retrieval.service.ts'),{KnowledgeService}=require('./src/knowledge/knowledge.service.ts');
const expected=new Error('EXPECTED_GOVERNANCE_ROLLBACK');let result;
try{await withFixtureTransaction(env,'app',async tx=>{
 for(const[k,v]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project]])await tx.$queryRawUnsafe('SELECT set_config($1,$2,true)',k,v);
 const before=await readCatalogProtectedSnapshot(tx,ids),accounts=await tx.account.findMany({where:{id:{in:[ids.owner,ids.admin]}},select:{id:true,authVersion:true,role:true}});
 const user=who=>({...Object.fromEntries([['tenantId',ids.tenant],['studyGroupId',ids.group],['researchProjectId',ids.project]]),accountId:ids[who],...Object.fromEntries(['authVersion','role'].map(k=>[k,accounts.find(a=>a.id===ids[who])[k]]))});
 const owner=user('owner'),admin=user('admin');
 const access=createCatalogAccess({ids,transaction:async(_u,run)=>{await lockAuthorizationMutation(tx,ids.tenant,{includeOfficial:true});return run(tx);}});
 const bound={forTenant:()=>tx,withTenantTransaction:(_t,_g,_p,run)=>run(tx),elevated:tx},knowledge=new KnowledgeService(bound);
 const sources=createAssetKnowledgeSources({ids,manifest:()=>JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-assets-local/source-manifest.json',import.meta.url),'utf8')),withKnowledgeRead:(_tx,p,run)=>withCurrentKnowledgeRead(bound,p,run,undefined,'knowledge'),readVisibleDoc:(_tx,p,id)=>knowledge.requireVisibleDoc(p,id,tx)});
 // Only protocol/author sources are exercised; no file staging, binding or writes.
 const services=composeAssetCatalog({ids,withAccess:access,knowledgeSources:sources,uploads:{assertSources:async()=>false}}),governance=createAssetGovernance({ids,withAccess:access,assertSources:services.assertSources});
 const baseline=await access(admin,'artifact.read',t=>t.$queryRawUnsafe('SELECT asset_id,revision,working_state FROM rh_asset.asset_registry ORDER BY asset_id'));assert.equal(baseline.length,10);
 const assets=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,idempotencyKey:{startsWith:'rh-research-asset:catalog-20261112:'}},select:{id:true,ownerAccountId:true,idempotencyKey:true}});
 const find=(who,kind)=>assets.find(x=>x.ownerAccountId===ids[who]&&x.idempotencyKey.endsWith(':'+kind)).id;
 const target=find('owner','protocol'),self=find('admin','instrument');let key=0;
 assert([target,self].every(id=>baseline.find(r=>r.asset_id===id)?.working_state==='draft'),'GOVERNANCE_PG_REQUIRES_UNSUBMITTED_OWNER_PROTOCOL_AND_ADMIN_INSTRUMENT');
 const options=(who,id=target,version=2)=>governance.options(user(who),id,version);
 const action=async(who,id,version,type,extra={})=>{const o=await options(who,id,version);return{action:type,version,expectedRevision:o.expectedRevision,requestKey:'catalog-governance-pg-'+(++key),contentHash:o.contentHash,policyHash:o.policyHash,identityRevision:o.identityRevision,...extra};};
 const submitted=await action('owner',target,2,'submit');assert.equal((await governance.execute(owner,target,submitted)).operation,'submitted');assert.equal((await governance.execute(owner,target,submitted)).revision,3);
 const approval=await action('admin',target,2,'review',{conclusion:'approved',reason:'核对固定版及原创用途',contentChecked:true,rightsChecked:true});
 await assert.rejects(governance.execute(owner,target,{...approval,identityRevision:(await options('owner')).identityRevision}),e=>e.status===403);
 await assert.rejects(governance.execute({...admin,authVersion:admin.authVersion+1},target,approval),e=>e.status===401);
 await assert.rejects(governance.execute(admin,target,{...approval,policyHash:'c'.repeat(64)}),e=>e.status===409);
 const reviewed=await governance.execute(admin,target,approval);assert(reviewed.reviewId);assert.equal((await tx.researchArtifactReview.findUnique({where:{id:reviewed.reviewId}})).roleKey,'tenant_admin');
 const release=await action('admin',target,2,'release',{reason:'限原两账号核对摘要',discoveryRecipients:[ids.admin],ttlDays:7});
 const released=await governance.execute(admin,target,release);assert.equal(released.operation,'released');assert.equal((await governance.execute(admin,target,release)).revision,released.revision);
 await assert.rejects(governance.execute(admin,target,{...release,expectedRevision:released.revision,requestKey:'catalog-governance-pg-second-release'}),e=>e.code==='ASSET_CATALOG_ALREADY_RELEASED');
 const editor=await services.registration.edit(owner,target,2);
 const revised=await services.registration.revise(owner,target,{kind:editor.kind,metadata:{...editor.metadata,summary:editor.metadata.summary+'（回滚中修订）'},sourceKind:editor.sourceKind,sourceBindings:editor.sourceBindings,policy:editor.policy,contentMd:editor.contentMd,baseVersion:2,expectedRevision:editor.expectedRevision,requestKey:'catalog-governance-pg-after-release-revise'});assert.equal(revised.version,3);
 // A still-approved KB v2 snapshot and the released asset v2 remain valid after a new asset v3.
 assert.equal((await services.reader.detail(owner,target,2)).version,2);
 const pending=await action('owner',target,3,'submit');await governance.execute(owner,target,pending);
 const stale=await action('admin',target,3,'review',{conclusion:'approved',reason:'待审核',contentChecked:true,rightsChecked:true});
 const edit3=await services.registration.edit(owner,target,3);
 await services.registration.revise(owner,target,{kind:edit3.kind,metadata:edit3.metadata,sourceKind:edit3.sourceKind,sourceBindings:edit3.sourceBindings,policy:edit3.policy,contentMd:edit3.contentMd,baseVersion:3,expectedRevision:edit3.expectedRevision,requestKey:'catalog-governance-pg-pending-edit'});
 await assert.rejects(governance.execute(admin,target,stale),e=>e.status===409);
 // Retain fixed v2 release while source is valid; revoke current F03 review inside this rollback only.
 const binding=editor.sourceBindings[0];await knowledge.reviewDoc(admin,binding.id,false);
 await assert.rejects(services.reader.detail(owner,target,2),e=>e.status===404);
 const withdrawal=await action('admin',target,2,'withdraw',{reason:'上游资料撤审，停止本版使用'});assert.equal((await governance.execute(admin,target,withdrawal)).operation,'withdrawn');
 const state=await tx.$queryRawUnsafe('SELECT release_state,released_version_no FROM rh_asset.asset_registry WHERE asset_id=$1',target);assert.equal(state[0].release_state,'withdrawn');assert.equal(state[0].released_version_no,null);
 // Self review is allowed only with the recorded acknowledgment; rejected attempts do not insert rows.
 await governance.execute(admin,self,await action('admin',self,1,'submit'));
 const selfApproval=await action('admin',self,1,'review',{conclusion:'approved',reason:'本人原创合成说明，经逐项核对',contentChecked:true,rightsChecked:true});
 await assert.rejects(governance.execute(admin,self,selfApproval),e=>e.code==='ASSET_CATALOG_SELF_REVIEW_REQUIRED');
 const selfResult=await governance.execute(admin,self,{...selfApproval,selfReviewAcknowledged:true});
 const event=await tx.$queryRawUnsafe('SELECT payload FROM rh_asset.asset_event WHERE asset_id=$1 AND asset_revision=$2',self,selfResult.revision);assert.equal(event[0].payload.selfReview,true);
 assert.equal(await tx.researchArtifactReview.count({where:{artifactId:{in:[target,self]}}}),2);
 await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');assert.deepEqual(await readCatalogProtectedSnapshot(tx,ids),before);
 result={syntheticOnly:true,checks:['existing scoped assets only','same-key receipt before CAS','current role and token checks','policy seal check','real legacy Review with administrator identity','single fixed-version first release','server seven-day expiry','new draft does not overwrite old release','edited pending review rejected','actual old KB unreview blocks delivery','source-invalid withdrawal still permitted','explicit self-review fact','deferred constraints','old data and roles unchanged'],persistentBusinessWrites:0,modelsCalled:0};throw expected;
 });}catch(e){if(e!==expected)throw e;}
console.log(JSON.stringify({...result,transactionRolledBack:true},null,2));
