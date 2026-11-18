import assert from 'node:assert/strict';import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';import {createAssetApplicability} from './local-asset-applicability.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const out='/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/opinions-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});const checks=[];let stage='runtime';
try{
 const rt=await assetApplicabilityRuntime(),scope=rt.dir+'wp09-scope.json',api=createAssetApplicability({...rt,assets:rt.assets,storage:{},scope});assert.equal(typeof api.saveOpinions,'function','opinion persistence missing');const code=e=>e.getResponse?.()?.code;
 for(const actor of ['owner','admin']){
  stage=actor+'-create';const u=rt.users[actor],f=rt.prior[actor],a=await rt.assets.read(u,f.assetId),p=await rt.plans.withDraft(u,f.root.planId,'artifact.read',async(_t,p)=>p.a.currentVersionNo),createBody={assetId:a.id,assetVersionNo:a.version,targetPlanId:f.root.planId,targetVersionNo:p,requestKey:'wp09-op-create-'+randomUUID()},made=await api.create(u,createBody),id=made.record.id;
  const decision=(ruleId,reason='仅作声明参考，待研究者核对')=>({ruleId,decision:'reference',reason}),body=(baseVersionNo,decisions)=>({baseVersionNo,resultMessageId:null,basisChangeConfirmed:false,decisions,requestKey:'wp09-op-'+randomUUID()});
  const one=body(1,[decision('question')]),v2=await api.saveOpinions(u,id,one);assert.equal(v2.record.version,2);assert.equal(v2.record.opinionHead.lastRecordVersion,2);
  await api.saveOpinions(u,id,body(2,[decision('eligibility')]));const v4=await api.saveOpinions(u,id,body(3,[decision('question','保留疑问，暂不采用配置')]));assert.equal(Object.keys(v4.record.opinions).length,2);assert.equal(v4.record.opinionHistory.length,3);
  const retry=await api.saveOpinions(u,id,one);assert.deepEqual(retry.operation,v2.operation);assert.equal(retry.record.version,4);
  await assert.rejects(()=>api.saveOpinions(u,id,{...one,decisions:[decision('question','另一理由')]}),e=>code(e)==='APPLICABILITY_KEY_CONFLICT');
  await assert.rejects(()=>api.saveOpinions(u,id,{...body(4,[decision('question')]),requestKey:createBody.requestKey}),e=>code(e)==='APPLICABILITY_KEY_CONFLICT');
  await assert.rejects(()=>api.saveOpinions(u,id,body(4,[decision('question','保留疑问，暂不采用配置')])),e=>code(e)==='APPLICABILITY_NO_CHANGE');
  await assert.rejects(()=>api.saveOpinions(u,id,body(4,[decision('question'),decision('question')])),e=>code(e)==='APPLICABILITY_INPUT_INVALID');
  stage=actor+'-CAS';const concurrent=await Promise.allSettled([api.saveOpinions(u,id,body(4,[decision('visits')])),api.saveOpinions(u,id,body(4,[decision('outcomes')]))]);writeFileSync(out+actor+'-cas.json',JSON.stringify(concurrent.map(v=>({status:v.status,...(v.status==='rejected'?{code:code(v.reason),name:v.reason.name}:{} )})),null,2));assert.equal(concurrent.filter(v=>v.status==='fulfilled').length,1);assert.equal(code(concurrent.find(v=>v.status==='rejected').reason),'APPLICABILITY_VERSION_CONFLICT');
  const current=await api.read(u,id),history=await api.read(u,id,2);assert.equal(current.version,5);assert.equal(history.readOnly,true);assert.equal(Object.keys(history.opinions).length,1);assert.equal(current.basisHash,made.record.basisHash);assert.equal(current.rulesHash,made.record.rulesHash);
  stage=actor+'-scope';const original=readFileSync(scope),s=JSON.parse(original);
  try{
   writeFileSync(scope,JSON.stringify({...s,operations:s.operations.filter(v=>v!=='U02')}));const limited=await api.read(u,id);assert.equal(limited.canReadHistory,false);assert.deepEqual(limited.opinions,{});assert(!limited.contentMd.includes('保留疑问'));await assert.rejects(()=>api.read(u,id,2),e=>code(e)==='APPLICABILITY_SCOPE_RESTRICTED');await assert.rejects(()=>api.saveOpinions(u,id,one),e=>code(e)==='APPLICABILITY_SCOPE_RESTRICTED');
   writeFileSync(scope,JSON.stringify({...s,operations:s.operations.filter(v=>v!=='U03')}));const free=await api.read(u,id);assert.equal(free.version,5);assert.equal(free.opinions.question.reason,'保留疑问，暂不采用配置');await assert.rejects(()=>rt.plans.withScope(u,'artifact.read',tx=>api.ownPurposeInTx(tx,u,free.executionSessionId)),e=>code(e)==='APPLICABILITY_SCOPE_RESTRICTED');
   writeFileSync(scope,JSON.stringify({...s,enabled:false}));await assert.rejects(()=>api.saveOpinions(u,id,one),e=>code(e)==='APPLICABILITY_SCOPE_RESTRICTED');
  }finally{writeFileSync(scope,original);assert.deepEqual(readFileSync(scope),original);}
  checks.push(actor+'-partial-revise-history-CAS-independent-connections-cross-action-receipt-no-change-and-precise-U02-U03-U01');
  writeFileSync(out+actor+'.json',JSON.stringify({recordId:id,versionNo:5,createBody,firstOpinion:one},null,2),{mode:0o600});
 }
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){const v={passed:false,stage,error:e.message?.includes('persistence missing')?e.message:e.getResponse?.()?.code??e.code??e.name,frames:e.stack?.split('\n').filter(l=>/^\s+at /.test(l)).slice(0,6)};writeFileSync(out+'failure.json',JSON.stringify(v,null,2));console.error(JSON.stringify({...v,evidence:out}));process.exitCode=1;}
