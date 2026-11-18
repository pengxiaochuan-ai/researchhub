// Real PG authorization/projection contract with a rollback-only synthetic Message.
// It does NOT prove a model result, provider execution or professional acceptance.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';
import {createAssetApplicability} from './local-asset-applicability.mjs';
import {buildApplicabilityModel,parseApplicabilityResult,acceptAuthorizedApplicabilityResult} from './asset-applicability-ai-contract.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const out='/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/messages-preflight-'+randomUUID().slice(0,8)+'/',temp=mkdtempSync(join(tmpdir(),'wp09-messages-'));mkdirSync(out,{recursive:true,mode:0o700});const checks=[];let stage='runtime';
try{
 const rt=await assetApplicabilityRuntime(),scope=join(temp,'scope.json'),original=JSON.parse(readFileSync(rt.dir+'wp09-scope.json'));writeFileSync(scope,JSON.stringify({...original,paidAiApproved:true}),{mode:0o600});
 const api=createAssetApplicability({...rt,storage:{},scope,paidAdmission:()=>{},feeStatus:async()=>({canStart:true})});
 assert.equal(typeof api.resultInTx,'function','trusted result projection missing');assert.equal(typeof api.projectMessage,'function','trusted message projection missing');
 const u=rt.users.owner,jobId='cmvoxijfe000mluayv3icfi69',stop=Error('EXPECTED_MESSAGE_ROLLBACK');
 const oldJob=await rt.transact(tx=>tx.knowledgeChatJob.findUnique({where:{id:jobId}}));
 assert.equal((await api.read(u,oldJob.payload.researchAssetApplicability.binding.recordId)).canAi,true,'async fee readiness must reach record action');
 stage='message-and-final-binding';await assert.rejects(()=>rt.plans.withScope(u,'artifact.edit',async tx=>{
  const originalJob=await tx.knowledgeChatJob.findUnique({where:{id:jobId}});assert.equal(originalJob.status,'failed');assert.equal(originalJob.errorCode,'WP09_FREE_PROBE_NOT_DISPATCHED');
  const owned=await api.ownPurposeInTx(tx,u,originalJob.sessionId),r=owned.record,t=originalJob.payload.researchAssetApplicability;assert.equal(r.b.pending.jobId,jobId);
  await assert.rejects(()=>api.assertGenericSend(tx,u,originalJob.sessionId),e=>e.getStatus?.()===403);
  await tx.knowledgeChatJob.update({where:{id:jobId},data:{status:'processing'}});
  const turn={user:u,jobId,sources:owned.basis.sources,applicability:{...t,basis:r.b.basis,rules:r.b.rules}};await api.validateTurn(tx,turn);
  await assert.rejects(()=>api.validateTurn(tx,{...turn,applicability:{...turn.applicability,binding:{...t.binding,basisHash:'f'.repeat(64)}}}));
  checks.push({name:'actual-current-processing-binding-and-generic-denial',passed:true});
  const item={ruleId:'question',explanation:'这里只比较已声明的研究问题，不判断临床适用性。[A1]',question:'是否需要人工核对目标问题？',sourceRefs:[{kind:'asset',index:1}]},result={providerOutcome:'known',usedMock:false,usage:{},finalText:JSON.stringify({items:[{ruleId:'question',explanation:'这里只比较已声明的研究问题，不判断临床适用性。',question:'是否需要人工核对目标问题？',sourceIds:['A1']}]})};
  const trusted={...turn.applicability,sources:owned.basis.sources,modelView:buildApplicabilityModel(r.b.basis,r.b.rules,owned.basis.sources)};parseApplicabilityResult(JSON.stringify({items:[item]}),trusted);
  const currentTurn={...turn,applicability:trusted,toolExecuted:true},scopeBytes=readFileSync(scope);
  writeFileSync(scope,JSON.stringify({...JSON.parse(scopeBytes),operations:['U01','U02','U04']}),{mode:0o600});
  try{await assert.rejects(()=>acceptAuthorizedApplicabilityResult({...result,finalText:'invalid JSON'},currentTurn,()=>api.validateTurn(tx,currentTurn),api.accept),e=>e.getResponse?.().code==='APPLICABILITY_SCOPE_RESTRICTED');checks.push({name:'actual-PG-current-revocation-precedes-invalid-output-parsing',passed:true});}finally{writeFileSync(scope,scopeBytes,{mode:0o600});}
  await acceptAuthorizedApplicabilityResult(result,currentTurn,()=>api.validateTurn(tx,currentTurn),api.accept);
  const m=await tx.message.create({data:{tenantId:u.tenantId,sessionId:originalJob.sessionId,role:'assistant',content:result.finalText,meta:{provenance:{...result.provenance,knowledgeSources:owned.basis.sources}}}});
  let j=await tx.knowledgeChatJob.update({where:{id:jobId},data:{status:'completed',assistantMessageId:m.id}}),projected=await api.resultInTx(tx,u,r,j);
  assert.equal(projected.ai.status,'current');assert.equal(projected.ai.result.resultMessageId,m.id);assert.deepEqual(projected.ai.result.items,[item]);checks.push({name:'typed-current-result-from-real-parent',passed:true});
  await tx.message.update({where:{id:m.id},data:{meta:{provenance:{...result.provenance,knowledgeSources:owned.basis.sources,researchAssetApplicabilityResult:{...result.provenance.researchAssetApplicabilityResult,binding:{...t.binding,recordId:'wrong-parent'}}}}}});
  await assert.rejects(()=>api.resultInTx(tx,u,r,j));checks.push({name:'immutable-result-wrong-parent-hidden',passed:true});
  await assert.rejects(()=>api.ownPurposeInTx(tx,rt.users.admin,originalJob.sessionId),e=>[403,404].includes(e.getStatus?.()));checks.push({name:'cross-account-purpose-rejected',passed:true});
  throw stop;
 }),e=>e===stop);
 const after=await rt.transact(tx=>tx.knowledgeChatJob.findUnique({where:{id:jobId}}));assert.equal(after.status,'failed');assert.equal(after.assistantMessageId,null);
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,paidAdmissionStub:true,syntheticAssistantRolledBack:true,actualProvider:false,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,error:e.getResponse?.()??e.message,frames:e.stack?.split('\n').filter(l=>/^\s+at /.test(l)).slice(0,5)},null,2));console.error(JSON.stringify({passed:false,stage,error:e.getResponse?.()?.code??e.message,evidence:out}));process.exitCode=1;}finally{rmSync(temp,{recursive:true,force:true});}
