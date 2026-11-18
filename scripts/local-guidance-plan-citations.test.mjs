import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {citationFixture,ids,root,load,require} from '../tests/helpers/guidance-citation-fixture.mjs';
import {listExternalReviewItems} from '../server/hub-sources/external-preview.mjs';
import {submitExternalReview} from '../server/hub-sources/external-review.mjs';
import {getVisibleGuidanceDocument} from '../server/hub-sources/external-visible.mjs';
const module=await import('./local-guidance-plan-citations.mjs').catch(()=>({}));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const rollback=async(role,fn)=>{
 assert.equal(typeof module.createLocalGuidancePlanCitations,'function');await assertFixtureTarget(env);
 await assert.rejects(()=>withFixtureTransaction(env,role,async db=>{await fn(db);throw Error('CITATION_EXPECTED_ROLLBACK');}),/CITATION_EXPECTED_ROLLBACK/);
};
const build=async db=>{const f=await citationFixture(db);return{...f,service:module.createLocalGuidancePlanCitations({root,ids,load,require,plans:f.plans,storage:{}})};};
const addInput=(view,key='citation-test-add')=>{const s=view.sources[0],t=view.paragraphs[0];return{baseVersionNo:view.version,requestKey:key,action:'add',target:{start:t.start,end:t.end,sha256:t.sha256},source:{documentId:s.documentId,extractionId:s.clauseDetails.extractionId,sourceSha256:s.clauseDetails.sourceSha256,payloadSha256:s.clauseDetails.payloadSha256},clauseId:s.clauseDetails.clauses[0].id,purpose:'design_check',confirmed:true};};
const reviewer=async db=>{const a=await db.account.findUniqueOrThrow({where:{id:ids.admin}});return{accountId:a.id,tenantId:ids.tenant,authVersion:a.authVersion};};
async function revoke(db,documentId,decision='revoke'){const principal=await reviewer(db),scope={db,principal,tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin};const item=(await listExternalReviewItems(scope)).find(i=>i.id===documentId);return submitExternalReview({...scope,input:{documentId:item.id,versionId:item.versionId,sha256:item.sha256,fieldKind:'guidance_clauses',purpose:'display',decision,confirmed:true,expectedVersion:item.guidanceExtraction.review.version,extractionId:item.guidanceExtraction.extractionId,payloadSha256:item.guidanceExtraction.payloadSha256,evidenceRef:'https://example.org/guidance-citation-rollback'}});}

test('real own citation appends one immutable artifact version with exact sources, no quote storage, and idempotent replay',()=>rollback('app',async db=>{
 const f=await build(db),v=await f.service.read(f.user,f.planId,{});assert.equal(v.sources.length,3);assert.equal(v.citations.length,0);
 const input=addInput(v),r=await f.service.change(f.user,f.planId,input);assert.equal(r.appliedVersionNo,2);assert.equal(r.view.version,2);assert.equal(r.view.citations[0].sourceStatus,'current');assert.equal(r.view.citations[0].targetStatus,'matched');
 const stored=await db.researchArtifactVersion.findUniqueOrThrow({where:{artifactId_versionNo:{artifactId:f.planId,versionNo:2}}});
 const ref=stored.contentBlocks[0].guidanceCitations[0];assert.equal(ref.source.documentId,input.source.documentId);assert.equal(ref.createdBy,f.user.accountId);assert.ok(!JSON.stringify(ref).includes('quote'));assert.ok(!stored.contentMd.includes(r.view.citations[0].details.clauses[0].quote));
 const again=await f.service.change(f.user,f.planId,input);assert.equal(again.replayed,true);assert.equal(again.appliedVersionNo,2);assert.equal(again.view.version,2);
 await assert.rejects(()=>f.service.change(f.user,f.planId,{...input,purpose:'background'}));
 const history=await f.service.read(f.user,f.planId,{versionNo:'1'});assert.equal(history.citations.length,0);assert.equal(history.currentVersion,2);assert.equal(history.readOnly,true);
 await assert.rejects(()=>f.service.change(f.user,f.planId,{...input,requestKey:'citation-stale-cas'}));
 assert.equal((await db.researchArtifact.findUniqueOrThrow({where:{id:f.originalId}})).currentVersionNo,f.originalVersion);
}));
test('external revoke redacts current and historical text but permits removing the invalid own reference',()=>rollback('app',async db=>{
 const f=await build(db),i=addInput(await f.service.read(f.user,f.planId,{}));let r=await f.service.change(f.user,f.planId,i);const ref=r.view.citations[0];
 await revoke(db,i.source.documentId);const view=await f.service.read(f.user,f.planId,{});assert.equal(view.citations[0].sourceStatus,'unavailable');assert.ok(!view.citations[0].details);assert.ok(!(await f.service.read(f.user,f.planId,{versionNo:'2'})).citations[0].details);
 await assert.rejects(()=>f.service.change(f.user,f.planId,{...i,baseVersionNo:2,requestKey:'citation-revoked-add'}));
 r=await f.service.change(f.user,f.planId,{baseVersionNo:2,requestKey:'citation-remove-revoked',action:'remove',citationId:ref.citationId});assert.equal(r.view.citations.length,0);assert.equal(r.appliedVersionNo,3);
 const replay=await f.service.change(f.user,f.planId,i);assert.equal(replay.replayed,true);assert.equal(replay.appliedVersionNo,2);assert.equal(replay.view.version,3);
}));
test('source expiry and exact extraction/source/clause hashes are checked again before committing',()=>rollback('direct',async db=>{
 const f=await build(db),v=await f.service.read(f.user,f.planId,{}),i=addInput(v);
 for(const bad of [{...i,source:{...i.source,payloadSha256:'0'.repeat(64)}},{...i,source:{...i.source,extractionId:'rhge-'+ 'f'.repeat(40)}},{...i,target:{...i.target,end:i.target.end-1}},{...i,clauseId:'clause-9'}])await assert.rejects(()=>f.service.change(f.user,f.planId,bad));
 await db.$executeRaw`UPDATE rh_source.guidance_clause_review SET expires_at=clock_timestamp()-interval '1 second' WHERE extraction_id=${i.source.extractionId}`;
 await assert.rejects(()=>f.service.change(f.user,f.planId,i));assert.equal((await f.service.read(f.user,f.planId,{})).version,1);
}));
test('reapproval of the same extraction does not revive an old reference without explicit rebinding',()=>rollback('app',async db=>{
 const f=await build(db),input=addInput(await f.service.read(f.user,f.planId,{}));let saved=await f.service.change(f.user,f.planId,input);
 await revoke(db,input.source.documentId);await revoke(db,input.source.documentId,'approve');
 const current=await f.service.read(f.user,f.planId,{});assert.equal(current.sources.length,3);assert.equal(current.citations[0].sourceStatus,'unavailable');assert.ok(!current.citations[0].details);
 assert.ok(!(await f.service.read(f.user,f.planId,{versionNo:'2'})).citations[0].details);
 saved=await f.service.change(f.user,f.planId,{baseVersionNo:2,requestKey:'citation-explicit-unbind',action:'remove',citationId:saved.view.citations[0].citationId});
 saved=await f.service.change(f.user,f.planId,{...input,baseVersionNo:3,requestKey:'citation-explicit-rebind'});assert.equal(saved.view.citations[0].sourceStatus,'current');assert.equal(saved.appliedVersionNo,4);
}));
test('private owner, original knowledge restrictions, exact history and current auth remain enforced by the old guards',()=>rollback('direct',async db=>{
 const f=await build(db),i=addInput(await f.service.read(f.user,f.planId,{}));
 const other=await reviewer(db);await assert.rejects(()=>f.service.read({...f.user,...other,role:'tenant_admin'},f.planId,{}));
 for(const query of [{versionNo:'0'},{versionNo:'01'},{versionNo:'999999'},{other:'x'}])await assert.rejects(()=>f.service.read(f.user,f.planId,query));
 await f.plans.withDraft(f.user,f.planId,'artifact.read',async(tx,p)=>{await tx.knowledgeDoc.update({where:{id:p.block.sources[0].docId},data:{reviewed:false}});});
 const v=await f.service.read(f.user,f.planId,{});assert.equal(v.sourceStatus,'restricted');assert.ok(!v.paragraphs);assert.ok(!v.sources);await assert.rejects(()=>f.service.change(f.user,f.planId,i));
 await assert.rejects(()=>f.service.read({...f.user,authVersion:f.user.authVersion+1},f.planId,{}));
}));

test('expiry during an actual version/audit write rolls the entire append back, not only its response',()=>rollback('direct',async db=>{
 let extractionId;
 const intercepted=new Proxy(db,{get(target,name){if(name!=='auditLog')return target[name];return new Proxy(target.auditLog,{get(model,method){if(method!=='create')return model[method];return async args=>{const result=await model.create(args);if(args.data.action==='local_guidance_plan_citation')await db.$executeRaw`UPDATE rh_source.guidance_clause_review SET expires_at=clock_timestamp()-interval '1 second' WHERE extraction_id=${extractionId}`;return result;};}});}});
 const f=await build(intercepted),i=addInput(await f.service.read(f.user,f.planId,{}));extractionId=i.source.extractionId;
 await assert.rejects(()=>f.service.change(f.user,f.planId,i),e=>e.getResponse?.().code==='CITATION_SOURCE_CHANGED');
 assert.equal((await f.service.read(f.user,f.planId,{})).version,1);
 assert.equal(await db.researchArtifactVersion.count({where:{artifactId:f.planId}}),1);
 assert.equal(await db.auditLog.count({where:{target:f.planId,action:'local_guidance_plan_citation'}}),0);
}));

test('a queued own plan task blocks reference writes and a changed original source is read-only',()=>rollback('direct',async db=>{
 const f=await build(db),initial=await f.service.read(f.user,f.planId,{}),i=addInput(initial),{canonicalArtifactJson}=require(root+'app/server/src/research-artifacts/research-artifact-integrity.ts'),{citationHash}=await import('./guidance-plan-citation-contract.mjs');
 const version=await db.researchArtifactVersion.findUniqueOrThrow({where:{artifactId_versionNo:{artifactId:f.planId,versionNo:1}}}),block={...version.contentBlocks[0]};delete block.seal;
 const message=await db.message.create({data:{tenantId:ids.tenant,sessionId:block.sessionId,role:'user',content:'本轮合成引用在途守门夹具，不执行模型'}});
 const job=await db.knowledgeChatJob.create({data:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:f.user.accountId,roleSnapshot:f.user.role,sessionId:block.sessionId,userMessageId:message.id,requestKey:'citation-job-'+f.planId,status:'queued',text:message.content,payload:{researchPlan:{artifactId:f.planId,stage:'protocol',version:2}}}});
 block.pending={jobId:job.id,stage:'protocol',requestKey:'citation-job-'+f.planId};
 await f.artifacts.createVersion(f.user,f.planId,{baseVersionNo:1,contentMd:f.plans.formatContent(version.contentMd,block),contentBlocks:[{...block,seal:citationHash(canonicalArtifactJson(block))}]});
 assert.equal((await f.service.read(f.user,f.planId,{})).canEdit,false);
 await assert.rejects(()=>f.service.change(f.user,f.planId,{...i,baseVersionNo:2}),e=>e.getResponse?.().code==='CITATION_JOB_PENDING');
 await db.knowledgeChatJob.update({where:{id:job.id},data:{status:'failed'}});
 await db.knowledgeDoc.update({where:{id:block.sources[0].docId},data:{version:{increment:1}}});
 const stale=await f.service.read(f.user,f.planId,{});assert.equal(stale.sourceStatus,'stale');assert.equal(stale.canEdit,false);
 await assert.rejects(()=>f.service.change(f.user,f.planId,{...i,baseVersionNo:2}));
}));

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
async function backendPid(db){return(await db.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid;}
async function assertBlockedBy(db,waiter,holder,documentId){
 const key=ids.tenant+':lingshu-xinyu:'+documentId;
 for(let n=0;n<100;n++){
  const rows=await db.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=${waiter}::int AND locktype='advisory' AND NOT granted AND objsubid=1 AND classid::bigint=((hashtextextended(${key},0)>>32)&4294967295) AND objid::bigint=(hashtextextended(${key},0)&4294967295)) AND ${holder}::int=ANY(pg_blocking_pids(${waiter}::int)) AS blocked`;
  if(rows[0].blocked)return;
  await new Promise(ok=>setTimeout(ok,20));
 }
 assert.fail('Expected a real independent PostgreSQL backend to wait for the held source lock');
}
test('independent reviewer and citation transactions wait on the same source lock in both orders, with all writes rolled back',async()=>{
 await assertFixtureTarget(env);
 // No persistent decisions are authorized. A real revoke is deliberately rolled back,
 // not described as a committed-revocation acceptance test.
 for(const reviewerFirst of [true,false]){
  const ready=deferred(),held=deferred(),release=deferred(),waiting=deferred();
  const citation=assert.rejects(()=>withFixtureTransaction(env,'app',async db=>{
   const f=await build(db);await db.$executeRawUnsafe('SAVEPOINT citation_preview');
   const input=addInput(await f.service.read(f.user,f.planId,{}),'citation-race-'+String(reviewerFirst));
   await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT citation_preview');await db.$executeRawUnsafe('RELEASE SAVEPOINT citation_preview');
   const pid=await backendPid(db);ready.resolve({documentId:input.source.documentId,pid});
   if(reviewerFirst){await held.promise;waiting.resolve(pid);const result=await f.service.change(f.user,f.planId,input);assert.equal(result.appliedVersionNo,2);assert.equal(result.view.citations[0].sourceStatus,'current');}
   else{
    const result=await f.service.change(f.user,f.planId,input);assert.equal(result.appliedVersionNo,2);held.resolve();
    const reviewerPid=await waiting.promise;await assertBlockedBy(db,reviewerPid,pid,input.source.documentId);release.resolve();
   }
   throw Error('CITATION_RACE_ROLLBACK');
  }),/CITATION_RACE_ROLLBACK/);
  const review=assert.rejects(()=>withFixtureTransaction(env,'app',async db=>{
   const info=await ready.promise;await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
   const pid=await backendPid(db);
   if(reviewerFirst){await revoke(db,info.documentId);held.resolve();await waiting.promise;await assertBlockedBy(db,info.pid,pid,info.documentId);}
   else{
    await held.promise;waiting.resolve(pid);await revoke(db,info.documentId);await release.promise;
    const visible=await getVisibleGuidanceDocument({db,tenantId:ids.tenant,hubKey:'lingshu-xinyu',documentId:info.documentId});assert.notEqual(visible?.clausesStatus,'approved');assert.ok(!visible?.clauseDetails);
   }
   throw Error('REVIEW_RACE_ROLLBACK');
  }),/REVIEW_RACE_ROLLBACK/);
  try{await Promise.all([citation,review]);}finally{held.resolve();waiting.resolve(-1);release.resolve();}
 }
});
