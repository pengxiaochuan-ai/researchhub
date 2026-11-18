import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';
import {edcDigest} from './synthetic-edc-contract.mjs';
import {editablePlanContent} from './research-plan-contract.mjs';
assert.deepEqual(process.argv.slice(2),['--case','readiness','--mode','local-synthetic']);
const out='/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/readiness-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});
const checks=[];
try{
 const rt=await assetApplicabilityRuntime();assert.equal(typeof rt.assets.inAsset,'function','same-transaction asset bridge is not implemented');
 for(const actor of ['owner','admin']){
  const u=rt.users[actor],f=rt.prior[actor],asset=await rt.assets.read(u,f.assetId);assert.equal(asset.sourceStatus,'current');
  await rt.plans.withScope(u,'artifact.read',async tx=>{
   const a=await rt.assets.inAsset(tx,u,asset.id,asset.version);assert.equal(a.asset.id,asset.id);assert(a.nativeSources.length>0);
   await rt.plans.inDraft(tx,u,f.root.planId,'artifact.read',async(_tx,p,state)=>{assert.equal(state,'current');assert.equal(p.block.stage,'protocol_draft');assert(p.block.confirmation?.hash);});
  });checks.push(actor+'-same-tx-current-asset-and-target-complete-original-validation');
  const stop=new Error('WP09_EXPECTED_ROLLBACK'),key='rh-asset-applicability-20261026-fixture:'+actor+':'+randomUUID();let cloneId,sessionId;
  await assert.rejects(()=>rt.plans.withScope(u,'artifact.create',async tx=>{
   await rt.plans.inDraft(tx,u,f.root.planId,'artifact.read',async(_tx,p,state)=>{
    assert.equal(state,'current');const derivedFrom={planId:p.a.id,versionNo:p.v.versionNo,contentHash:p.v.contentHash};
    const block={type:p.block.type,ownerAccountId:u.accountId,sessionId:p.block.sessionId,kbId:p.block.kbId,sources:p.block.sources,stage:'protocol_draft',pico:p.block.pico,confirmation:p.block.confirmation,derivedFrom,operations:[],pending:null};
    const sources=(await tx.researchArtifactVersion.findUnique({where:{id:p.v.id},include:{sources:true}})).sources.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,...(s.sourceVersion!=null?{sourceVersion:s.sourceVersion}:{}),snapshot:s.snapshot}));
    const Artifacts=rt.load('research-artifacts/research-artifacts.service','ResearchArtifactsService'),bound={forTenant:()=>tx,elevated:tx,app:tx,withTenantTransaction:(_t,_g,_p,cb)=>cb(tx)};
    cloneId=await new Artifacts(bound,{},null,null).createWithSourcesInTx(u,{title:'WP09回滚内引用派生测试目标（非新AI确认）',typeKey:'protocol_draft',idempotencyKey:'rh-plan-20261022:'+u.accountId+':'+key,creationRequestHash:edcDigest({derivedFrom,key}),contentMd:rt.plans.formatContent(editablePlanContent(p.v.contentMd),block),contentBlocks:[{...block,seal:edcDigest(block)}]},sources,u.accountId,tx);
    await rt.plans.inDraft(tx,u,cloneId,'artifact.read',async(_t,copy,copyState)=>{assert.equal(copyState,'current');assert.deepEqual(copy.block.derivedFrom,derivedFrom);assert.equal(copy.block.confirmation.sourceMessageId,p.block.confirmation.sourceMessageId);assert.equal(copy.block.pending,null);});
    const oldSession=await tx.session.findUnique({where:{id:p.block.sessionId}}),Sessions=rt.load('sessions/sessions.service','SessionsService'),session=await new Sessions(bound,{},null,null,null,{}).ensureKnowledgeSession(u,oldSession.agentId,'rh-asset-applicability:rollback-'+randomUUID(),'WP09具名回滚会话');sessionId=session.id;
    assert.notEqual(sessionId,oldSession.id);assert.deepEqual(await tx.session.findUnique({where:{id:oldSession.id}}),oldSession);
    assert.equal(await tx.message.count({where:{sessionId}}),0);throw stop;
   });
  }),e=>e===stop);
  assert.equal(await rt.transact(tx=>tx.researchArtifact.count({where:{id:cloneId}})),0);assert.equal(await rt.transact(tx=>tx.session.count({where:{id:sessionId}})),0);
  checks.push(actor+'-real-original-artifact-derived-target-and-purpose-session-compatible-rolled-back-no-old-row-write');
 }
 // Two independent PG connections must serialize on the ORIGINAL lock. No DML.
 let entered,release,secondStarted=false,secondAcquired=false;
 const firstReady=new Promise(ok=>entered=ok),hold=new Promise(ok=>release=ok);
 const lock=rt.load('common/worker-publication','lockAuthorizationMutation');
 const first=rt.plans.withScope(rt.users.owner,'artifact.read',async tx=>{
  await rt.assets.inAsset(tx,rt.users.owner,rt.prior.owner.assetId);
  await rt.plans.inDraft(tx,rt.users.owner,rt.prior.owner.root.planId,'artifact.read',async()=>{});
  entered();await hold;
 });
 await firstReady;
 const second=rt.transact(async tx=>{secondStarted=true;await lock(tx,rt.ids.tenant,{includeOfficial:true});secondAcquired=true;});
 try{await new Promise(ok=>setTimeout(ok,150));assert.equal(secondStarted,true);assert.equal(secondAcquired,false);}finally{release();}
 await Promise.all([first,second]);assert.equal(secondAcquired,true);
 checks.push('two-independent-PG-connections-original-authorization-lock-serializes-dual-read-no-DML');
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,actualPg:true,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,error:e.message?.includes('bridge')?e.message:e.getResponse?.()?.code??e.code??'READINESS_FAILED',modelCalls:0},null,2));console.error(JSON.stringify({passed:false,error:e.message?.includes('bridge')?e.message:e.getResponse?.()?.code??e.code??'READINESS_FAILED',evidence:out}));process.exitCode=1;}
