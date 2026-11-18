// One explicit local U01–U04 purpose activation; restart NEVER restores grants.
import assert from 'node:assert/strict';import {existsSync,mkdirSync,writeFileSync,readFileSync,lstatSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';
import {createAssetApplicability} from './local-asset-applicability.mjs';import {readAssetApplicabilityScope,APPLICABILITY_MARKER,APPLICABILITY_PREFIX} from './asset-applicability-scope.mjs';import {edcDigest} from './synthetic-edc-contract.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const rt=await assetApplicabilityRuntime(),scope=rt.dir+'wp09-scope.json',out=rt.root+'docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/activate-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});
assert.equal(lstatSync(rt.dir).mode&0o077,0);assert(!lstatSync(rt.dir).isSymbolicLink());
const existing=existsSync(scope);let s;
if(existing)s=readAssetApplicabilityScope(scope,rt.ids,rt.users.owner);
else{
 const now=new Date().toISOString(),pairs=[];
 for(const actor of ['owner','admin']){const u=rt.users[actor],f=rt.prior[actor];await rt.plans.withScope(u,'artifact.read',async tx=>{await rt.assets.inAsset(tx,u,f.assetId);await rt.plans.inDraft(tx,u,f.root.planId,'artifact.read',async(_t,p,state)=>{assert.equal(state,'current');assert.equal(p.block.stage,'protocol_draft');assert(p.block.confirmation.hash);});});pairs.push({accountId:u.accountId,assetId:f.assetId,targetPlanId:f.root.planId});}
 s={schema:'rh-asset-applicability-scope.v1',marker:APPLICABILITY_MARKER,prefix:APPLICABILITY_PREFIX,enabled:true,approvedAt:now,expiresAt:new Date(Date.parse(now)+7*86400000).toISOString(),tenantId:rt.ids.tenant,studyGroupId:rt.ids.group,researchProjectId:rt.ids.project,accounts:[rt.ids.owner,rt.ids.admin],operations:['U01','U02','U03','U04'],paidAiApproved:false,pairs,fixtures:[]};
 writeFileSync(scope,JSON.stringify(s),{mode:0o600,flag:'wx'});readAssetApplicabilityScope(scope,rt.ids,rt.users.owner);
 await rt.plans.withScope(rt.users.admin,'artifact.read',async tx=>{assert.equal(await tx.auditLog.count({where:{tenantId:rt.ids.tenant,action:'local_asset_applicability_authorized',target:rt.ids.project}}),0,'ACTIVATION_MUST_NOT_RESTORE_EXISTING_PURPOSE');await tx.auditLog.create({data:{tenantId:rt.ids.tenant,studyGroupId:rt.ids.group,researchProjectId:rt.ids.project,accountId:rt.users.admin.accountId,action:'local_asset_applicability_authorized',target:rt.ids.project,meta:{approvedAt:s.approvedAt,expiresAt:s.expiresAt,marker:s.marker,prefix:s.prefix,accounts:s.accounts,operations:s.operations,registrationHash:edcDigest({pairs:s.pairs,fixtures:s.fixtures}),paidAiApproved:false,userApproval:'2026-10-26 WP09 U01-U04 only'}}});});
}
const snapshot=readFileSync(scope),service=createAssetApplicability({...rt,assets:rt.assets,storage:{},scope});
for(const actor of ['owner','admin'])await rt.plans.withScope(rt.users[actor],'artifact.read',tx=>service.authorized(tx,rt.users[actor]));assert.deepEqual(readFileSync(scope),snapshot);
writeFileSync(out+'result.json',JSON.stringify({passed:true,existingPurposeValidatedOnly:existing,newPurposeAudit:!existing,actors:2,registeredPairs:s.pairs.length,mode:lstatSync(scope).mode&0o777,paidAiApproved:s.paidAiApproved,modelCalls:0,noOriginalGrantsChanged:true},null,2));console.log(JSON.stringify({passed:true,evidence:out,registeredPairs:s.pairs.length,paidAiApproved:s.paidAiApproved,modelCalls:0}));
