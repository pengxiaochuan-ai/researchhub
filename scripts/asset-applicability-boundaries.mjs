// Only the explicit synthetic DB. K02 objects and audit rows always roll back.
import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';
import {edcDigest} from './synthetic-edc-contract.mjs';
assert.deepEqual(process.argv.slice(2),['--case','basis-session','--mode','local-synthetic']);
const out='/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/basis-session-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});const temp=mkdtempSync(join(tmpdir(),'rh-wp09-basis-')),scope=join(temp,'scope.json'),checks=[];let stage='import';
try{
 const api=await import('./local-asset-applicability.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});assert.equal(typeof api.createAssetApplicability,'function','dual-basis purpose factory missing');
 stage='runtime';const rt=await assetApplicabilityRuntime(),now=new Date().toISOString(),pairs=Object.entries(rt.prior).filter(([a])=>['owner','admin'].includes(a)).map(([a,f])=>({accountId:rt.ids[a],assetId:f.assetId,targetPlanId:f.root.planId}));
 const s={schema:'rh-asset-applicability-scope.v1',marker:'rh-asset-applicability.v1',prefix:'rh-asset-applicability-20261026:',enabled:true,approvedAt:now,expiresAt:new Date(Date.parse(now)+7*86400000).toISOString(),tenantId:rt.ids.tenant,studyGroupId:rt.ids.group,researchProjectId:rt.ids.project,accounts:[rt.ids.owner,rt.ids.admin],operations:['U01','U02','U03','U04'],paidAiApproved:false,pairs,fixtures:[]};writeFileSync(scope,JSON.stringify(s),{mode:0o600});
 const factory=(assets=rt.assets)=>api.createAssetApplicability({...rt,assets,storage:{},scope}),service=factory();
 const responseCode=e=>e.getResponse?.()?.code??e.code??e.message,stop=Error('EXPECTED_ROLLBACK');
 for(const actor of ['owner','admin']){
  stage=actor+'-initial';const u=rt.users[actor],p=pairs.find(p=>p.accountId===u.accountId),a=await rt.assets.read(u,p.assetId),target=await rt.plans.withDraft(u,p.targetPlanId,'artifact.read',async(_tx,p)=>({version:p.a.currentVersionNo,sessionId:p.block.sessionId})),refs={assetId:p.assetId,assetVersionNo:a.version,targetPlanId:p.targetPlanId,targetVersionNo:target.version};
  await assert.rejects(()=>rt.plans.withScope(u,'artifact.read',tx=>service.loadApplicabilityBasis(tx,u,refs)),e=>responseCode(e)==='APPLICABILITY_SCOPE_RESTRICTED');
  let purposeSessionId;
  await assert.rejects(()=>rt.plans.withScope(u,'artifact.create',async tx=>{
   await tx.auditLog.create({data:{tenantId:rt.ids.tenant,studyGroupId:rt.ids.group,researchProjectId:rt.ids.project,accountId:u.accountId,action:'local_asset_applicability_authorized',target:rt.ids.project,meta:{approvedAt:s.approvedAt,expiresAt:s.expiresAt,marker:s.marker,prefix:s.prefix,accounts:s.accounts,operations:s.operations,registrationHash:edcDigest({pairs:s.pairs,fixtures:s.fixtures})}}});
   stage=actor+'-basis';const b=await service.loadApplicabilityBasis(tx,u,refs);assert.equal(b.sourceStatus,'current');assert.equal(b.binding.sourceAsset.id,p.assetId);assert.equal(b.binding.targetPlan.id,p.targetPlanId);assert.equal(b.input.target.confirmationStatus,'original_confirmation');assert(!Object.hasOwn(b.input.source,'result'));
   await assert.rejects(()=>service.loadApplicabilityBasis(tx,{...u,accountId:rt.ids[actor==='owner'?'admin':'owner']},refs),e=>responseCode(e)==='APPLICABILITY_SCOPE_RESTRICTED');
   await assert.rejects(()=>service.loadApplicabilityBasis(tx,u,{...refs,targetPlanId:rt.prior[actor==='owner'?'admin':'owner'].root.planId}),e=>responseCode(e)==='APPLICABILITY_SCOPE_RESTRICTED');
   // A02 is checked by the real bridge, with a private purpose copy only.
   const old=JSON.parse(readFileSync(rt.dir+'wp08-scope.json')),oldCopy=join(temp,'asset-scope.json');writeFileSync(oldCopy,JSON.stringify({...old,operations:old.operations.filter(v=>v!=='A02')}),{mode:0o600});
   const {createCrfMethodAssets}=await import('./local-crf-method-assets.mjs'),narrowAssets=createCrfMethodAssets({...rt,storage:{},scope:oldCopy});
   await assert.rejects(()=>factory(narrowAssets).loadApplicabilityBasis(tx,u,refs),e=>responseCode(e)==='CRF_ASSET_SCOPE_RESTRICTED');
   stage=actor+'-session';const row=await tx.session.findUnique({where:{id:target.sessionId}}),recordId='wp09-rollback-'+randomUUID();
   const session=await service.createPurposeSession(tx,u,recordId,{kbId:b.kbId,agentId:row.agentId});purposeSessionId=session.id;
   assert.equal(session.contextKey,'rh-asset-applicability:'+recordId);assert.notEqual(session.id,row.id);assert.deepEqual(await tx.session.findUnique({where:{id:row.id}}),row);
   // No record registered: a contextKey alone is NEVER sufficient authority.
   await assert.rejects(()=>service.ownPurposeInTx(tx,u,session.id),e=>responseCode(e)==='APPLICABILITY_FORBIDDEN');
   await assert.rejects(()=>service.assertGenericSend(tx,u,session.id),e=>responseCode(e)==='APPLICABILITY_GENERIC_SEND_FORBIDDEN');
   writeFileSync(scope,JSON.stringify({...s,operations:['U01','U02','U04']}));await assert.rejects(()=>service.createPurposeSession(tx,u,'other',{kbId:b.kbId,agentId:row.agentId}),e=>responseCode(e)==='APPLICABILITY_SCOPE_RESTRICTED');writeFileSync(scope,JSON.stringify(s));
   throw stop;
  }),e=>e===stop);
  assert.equal(await rt.transact(tx=>tx.session.count({where:{id:purposeSessionId}})),0);checks.push(actor+'-dual-basis-original-A02-cross-actor-wrong-target-missing-audit-independent-session-generic-send-and-U03');
 }
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0,allObjectsRolledBack:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){const failure={passed:false,checks,stage,name:e.name,frames:e.stack?.split('\n').filter(l=>/^\s+at /.test(l)).slice(0,6),error:e.message?.includes('factory')?e.message:e.getResponse?.()?.code??e.code??'BOUNDARY_FAILED'};writeFileSync(out+'failure.json',JSON.stringify(failure,null,2));console.error(JSON.stringify({...failure,evidence:out}));process.exitCode=1;}finally{rmSync(temp,{recursive:true,force:true});}
