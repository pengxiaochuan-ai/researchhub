// Approved U04 fixtures only. All old parents are read-only; original APIs create children.
import assert from 'node:assert/strict';import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {readAssetApplicabilityScope} from '../../scripts/asset-applicability-scope.mjs';import {createAssetApplicability} from '../../scripts/local-asset-applicability.mjs';import {edcDigest} from '../../scripts/synthetic-edc-contract.mjs';import {editablePlanContent} from '../../scripts/research-plan-contract.mjs';
export async function ensureApplicabilityFixtures(rt){
 const scope=rt.dir+'wp09-scope.json',file=rt.root+'.tmp/researchhub-wp09-asset-applicability/fixtures.json',u=rt.users.admin,api=createAssetApplicability({...rt,assets:rt.assets,storage:{},scope});
 let s=readAssetApplicabilityScope(scope,rt.ids,u,'U04');await rt.plans.withScope(u,'artifact.read',tx=>api.authorized(tx,u,'U04'));
 if(existsSync(file)){const saved=JSON.parse(readFileSync(file));for(const actor of ['owner','admin']){const f=saved[actor];assert(s.fixtures.some(v=>v.accountId===rt.users[actor].accountId&&v.kind==='asset'&&v.id===f.assetId));assert(s.fixtures.some(v=>v.accountId===rt.users[actor].accountId&&v.kind==='target'&&v.id===f.targetPlanId));}return saved;}
 assert.equal(s.fixtures.length,0,'PARTIAL_FIXTURE_REGISTRATION_REQUIRES_DIAGNOSIS');
 async function register(next){
  assert.equal(edcDigest(JSON.parse(readFileSync(scope))),edcDigest(s),'SCOPE_CAS_CONFLICT');writeFileSync(scope,JSON.stringify(next),{mode:0o600});readAssetApplicabilityScope(scope,rt.ids,u,'U04');
  await rt.plans.withScope(u,'artifact.read',tx=>tx.auditLog.create({data:{tenantId:rt.ids.tenant,studyGroupId:rt.ids.group,researchProjectId:rt.ids.project,accountId:u.accountId,action:'local_asset_applicability_authorized',target:rt.ids.project,meta:{approvedAt:next.approvedAt,expiresAt:next.expiresAt,marker:next.marker,prefix:next.prefix,accounts:next.accounts,operations:next.operations,registrationHash:edcDigest({pairs:next.pairs,fixtures:next.fixtures}),paidAiApproved:false,reason:'U04 exact bounded fixture registration; no old grants changed'}}}));s=structuredClone(next);
 }
 const now=new Date().toISOString(),declared=[];
 for(const actor of ['owner','admin'])for(const kind of ['asset','target'])declared.push({accountId:rt.users[actor].accountId,kind,key:'rh-asset-applicability-20261026-fixture:'+actor+':'+kind+':'+randomUUID(),parentId:kind==='asset'?rt.prior[actor].assetId:rt.prior[actor].root.planId,createdAt:now,id:null});
 await register({...s,fixtures:declared});const saved={};
 for(const actor of ['owner','admin']){
  const user=rt.users[actor],f=rt.prior[actor],asset=await rt.assets.read(user,f.assetId),child=await rt.assets.derive(user,f.assetId,{baseVersionNo:asset.version,requestKey:'wp09-fixture-asset-'+randomUUID()});
  const targetPlanId=await rt.plans.withScope(user,'artifact.create',tx=>rt.plans.inDraft(tx,user,f.root.planId,'artifact.read',async(_t,p,state)=>{
   assert.equal(state,'current');const derivedFrom={planId:p.a.id,versionNo:p.v.versionNo,contentHash:p.v.contentHash},fixture=s.fixtures.find(v=>v.accountId===user.accountId&&v.kind==='target');
   const block={type:p.block.type,ownerAccountId:user.accountId,sessionId:p.block.sessionId,kbId:p.block.kbId,sources:p.block.sources,stage:'protocol_draft',pico:p.block.pico,confirmation:p.block.confirmation,derivedFrom,operations:[],pending:null};
   const sources=(await tx.researchArtifactVersion.findUnique({where:{id:p.v.id},include:{sources:true}})).sources.map(v=>({sourceType:v.sourceType,sourceId:v.sourceId,...(v.sourceVersion!=null?{sourceVersion:v.sourceVersion}:{}),snapshot:v.snapshot})),Artifacts=rt.load('research-artifacts/research-artifacts.service','ResearchArtifactsService'),bound={forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_a,_b,_c,cb)=>cb(tx)};
   const id=await new Artifacts(bound,{},null,null).createWithSourcesInTx(user,{title:'WP09引用派生测试目标（非新AI或专业确认）',typeKey:'protocol_draft',idempotencyKey:'rh-plan-20261022:'+user.accountId+':'+fixture.key,creationRequestHash:edcDigest({derivedFrom,key:fixture.key}),contentMd:rt.plans.formatContent(editablePlanContent(p.v.contentMd),block),contentBlocks:[{...block,seal:edcDigest(block)}]},sources,user.accountId,tx);
   await rt.plans.inDraft(tx,user,id,'artifact.read',async(_x,c,st)=>{assert.equal(st,'current');assert.deepEqual(c.block.derivedFrom,derivedFrom);assert.equal(c.block.confirmation.sourceMessageId,p.block.confirmation.sourceMessageId);});return id;
  }));
  saved[actor]={assetId:child.asset.id,targetPlanId,sourceParentId:asset.id,targetParentId:f.root.planId};
  await register({...s,fixtures:s.fixtures.map(v=>v.accountId!==user.accountId?v:{...v,id:v.kind==='asset'?child.asset.id:targetPlanId}),pairs:[...s.pairs,{accountId:user.accountId,assetId:child.asset.id,targetPlanId}]});
  await rt.plans.withScope(user,'artifact.read',async tx=>{const b=await api.loadApplicabilityBasis(tx,user,{assetId:child.asset.id,assetVersionNo:child.asset.version,targetPlanId,targetVersionNo:1});assert.equal(b.input.target.confirmationStatus,'derived_reference_only');assert.equal(b.input.target.config,null);});
 }
 writeFileSync(file,JSON.stringify(saved,null,2),{mode:0o600,flag:'wx'});return saved;
}
