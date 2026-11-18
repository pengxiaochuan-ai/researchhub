// Real original services/PG, new WP09 records only; never runs a model.
import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';import {createAssetApplicability} from './local-asset-applicability.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const out='/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/create-read-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});const checks=[];let stage='runtime';
try{
 const rt=await assetApplicabilityRuntime(),api=createAssetApplicability({...rt,assets:rt.assets,storage:{},scope:rt.dir+'wp09-scope.json'});assert.equal(typeof api.create,'function','atomic applicability create missing');
 const code=e=>e.getResponse?.()?.code??e.code;
 for(const actor of ['owner','admin']){
  stage=actor+'-create';const u=rt.users[actor],f=rt.prior[actor],a=await rt.assets.read(u,f.assetId),p=await rt.plans.withDraft(u,f.root.planId,'artifact.read',async(_tx,p)=>p.a.currentVersionNo),requestKey='wp09-create-'+randomUUID(),body={assetId:a.id,assetVersionNo:a.version,targetPlanId:f.root.planId,targetVersionNo:p,requestKey};
  const r=await api.create(u,body);assert.equal(r.record.sourceStatus,'current');assert.equal(r.record.version,1);assert.equal(r.record.rules.items.length,6);assert.deepEqual(r.record.opinions,{});assert.equal(r.record.ai.status,'not_requested');
  const retry=await api.create(u,body);assert.deepEqual(retry.operation,r.operation);assert.equal(retry.record.id,r.record.id);
  await assert.rejects(()=>api.create(u,{...body,targetVersionNo:p+1}),e=>code(e)==='APPLICABILITY_KEY_CONFLICT');
  await assert.rejects(()=>api.create(u,{...body,extra:true}),e=>code(e)==='APPLICABILITY_INPUT_INVALID');
  await assert.rejects(()=>api.read(rt.users[actor==='owner'?'admin':'owner'],r.record.id),e=>code(e)==='APPLICABILITY_FORBIDDEN');
  await assert.rejects(()=>api.list(u,{limit:21}),e=>code(e)==='APPLICABILITY_INPUT_INVALID');
  const list=await api.list(u,{limit:20});assert(list.items.some(v=>v.id===r.record.id));assert(list.items.length<=20);
  await rt.plans.withScope(u,'artifact.read',async tx=>{const own=await api.ownPurposeInTx(tx,u,r.record.executionSessionId);assert.equal(own.recordId,r.record.id);assert.equal(own.kbId,r.record.kbId);const a=await tx.researchArtifact.findUnique({where:{id:r.record.id}});assert.equal(a.currentVersionNo,1);assert.equal(await tx.researchArtifactVersion.count({where:{artifactId:a.id}}),1);assert(await tx.researchArtifactSource.count({where:{artifactVersion:{artifactId:a.id}}})>0);});
  checks.push(actor+'-atomic-v1-purpose-session-original-sources-current-read-list-retry-conflict-cross-actor');
  writeFileSync(out+actor+'.json',JSON.stringify({recordId:r.record.id,versionNo:r.record.version,body,executionSessionId:r.record.executionSessionId},null,2),{mode:0o600});
 }
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){const failure={passed:false,stage,error:e.message?.includes('create missing')?e.message:e.getResponse?.()?.code??e.code??e.name,frames:e.stack?.split('\n').filter(v=>/^\s+at /.test(v)).slice(0,5)};writeFileSync(out+'failure.json',JSON.stringify(failure,null,2));console.error(JSON.stringify({...failure,evidence:out}));process.exitCode=1;}
