import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkNativeAudit} from './full-study-batch-performance-audit.mjs';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
function fixture(mode='final'){
 const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},actor={id:'actor',authVersion:1},studyId='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25',gid='full-run-0358f67e-e4d7-4e5f-b861-ed25db601745',root='full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198',manifestHash='8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7',createKey='create-request',runs=[],nativeAudits=[],reviews=[],events=[],receipts=[];
 const audit=(id,action,target,meta)=>({id,...scope,accountId:actor.id,action,target,meta});
 const receipt=(key,action,target,auditId,digest,result)=>({tenant_id:scope.tenantId,actor_id:actor.id,request_key:key,action,target_id:target,audit_id:auditId,request_hash:digest,result:{studyId,runGroupId:gid,...result}});
 for(let i=0;i<39;i++){
  const id='run-'+i,snapshotId='child-'+i,basis={rootSnapshotId:root,rootManifestHash:manifestHash,snapshotId},method='full-slice-'+hash({studyId,actor:actor.id,requestKey:createKey,snapshotId}),claim='11111111-1111-4111-8111-'+String(i).padStart(12,'0');
  const r={id,...scope,accountId:actor.id,sessionId:'session',agentId:'agent',skillKey:'descriptive-statistics',executorVersion:'descriptive-v1',status:mode==='final'?'completed':'needs_review',reviewStatus:mode==='final'?'confirmed':'pending_review',environment:{llm:false,claim,analysisBasis:basis},dataSources:{analysisBasis:basis},inputSummary:{studyId,snapshotId},idempotencyKey:method};r.requestHash=hash({input:r.inputSummary,sessionId:r.sessionId,agentId:r.agentId,accountId:r.accountId});runs.push(r);
  nativeAudits.push(audit('create-'+i,'research_method_run_create',id,{analysisBasis:basis}),audit('dispatch-'+i,'research_method_run_dispatch',id,{claim}),audit('publish-'+i,'research_method_run_publish',id,{claim}));
 }
 const header=audit(gid,'researchhub.full.analysis.run.group',studyId,{snapshotId:root,manifestHash,studyId,requestKey:createKey,authVersion:1,slices:runs.map((r,i)=>({sliceId:'slice-'+i,methodKey:r.idempotencyKey,snapshotId:r.inputSummary.snapshotId}))});
 receipts.push(receipt(createKey,'full.analysis.run.create',studyId,gid,hash({studyId,body:{requestKey:createKey,snapshotId:root}}),{}));
 function makeClaim(kind,target,targets,n){const requestKey=kind+'-request-'+n,id=kind+'-claim-'+n,digest='c'.repeat(64),meta={requestKey,requestDigest:digest,authVersion:1,batchVersion:'full-study-batch-v1',limit:3,targets,targetsHash:hash(targets),...(kind==='process'?{rootSnapshotId:root,manifestHash}:{})};events.push(audit(id,'researchhub.full.analysis.'+kind+'.claim',target,meta),audit(kind+'-finished-'+n,'researchhub.full.analysis.'+kind+'.finished',target,{claimId:id,status:'returned'}));receipts.push(receipt(requestKey,kind==='process'?'full.analysis.run.process':'full.analysis.review.advance',target,id,digest,{claimId:id,batchVersion:meta.batchVersion,limit:3,targetsHash:meta.targetsHash,...(kind==='review'?{operationId:target}:{})}));}
 for(let i=0;i<39;i+=3)makeClaim('process',gid,header.meta.slices.slice(i,i+3),i);
 if(mode==='final'){
  const key='parent-review',comment='synthetic review',conclusion='confirmed',targets=runs.map(r=>({runId:r.id,methodKey:r.idempotencyKey,snapshotId:r.inputSummary.snapshotId,nativeKey:'full-review-'+hash({requestKey:key,runId:r.id}),commandHash:hash({runId:r.id,conclusion,comment})})),meta={studyId,runGroupId:gid,snapshotId:root,manifestHash,requestKey:key,authVersion:1,targets,targetsHash:hash(targets),conclusion,comment,commandHash:hash({studyId,runGroupId:gid,body:{requestKey:key,conclusion,comment}})};
  events.push(audit('op','researchhub.full.analysis.review.operation',gid,meta));receipts.push(receipt(key,'full.analysis.review.start',gid,'op',meta.commandHash,{operationId:'op'}));
  for(const [i,t]of targets.entries()){const review={id:'review-'+i,...scope,runId:t.runId,reviewerAccountId:actor.id,reviewRole:'tenant_admin',conclusion,comment,version:1};reviews.push(review);nativeAudits.push(audit('descriptive-review-'+hash({tenantId:scope.tenantId,accountId:actor.id,requestKey:t.nativeKey}),'research_method_run_review',t.runId,{requestKey:t.nativeKey,commandHash:t.commandHash,reviewId:review.id,reviewVersion:1}));}
  for(let i=0;i<39;i+=3)makeClaim('review','op',targets.slice(i,i+3),i);
 }
 return{scope,actor,header,runs,reviews,nativeAudits,events,receipts,createKey,mode};
}
test('complete raw native final and pre-review proof keep their distinct audit/review counts',()=>{assert.equal(checkNativeAudit(fixture()).nativeAudits,156);assert.equal(checkNativeAudit(fixture('pre-review')).nativeAudits,117);});
test('duplicate native audit, changed actor or foreign target cannot masquerade as exactly once',()=>{for(const change of [f=>f.nativeAudits.push({...f.nativeAudits[0],id:'duplicate'}),f=>f.runs[0].accountId='other',f=>f.header.id='other']){const f=fixture();change(f);assert.throws(()=>checkNativeAudit(f));}});
test('receipt audit/request digest and fixed batch membership tampering are rejected',()=>{for(const change of [f=>f.receipts[1].audit_id='wrong',f=>f.receipts[1].request_hash='d'.repeat(64),f=>f.events.find(e=>e.meta.batchVersion).meta.targetsHash='e'.repeat(64)]){const f=fixture();change(f);assert.throws(()=>checkNativeAudit(f));}});
test('three equally missing native claim fields cannot pass equality-only checks',()=>{const f=fixture();delete f.runs[0].environment.claim;for(const a of f.nativeAudits.filter(a=>a.target===f.runs[0].id))delete a.meta.claim;assert.throws(()=>checkNativeAudit(f));});
test('parent review receipt must bind operation audit and complete original command',()=>{const f=fixture();f.receipts.find(r=>r.action==='full.analysis.review.start').request_hash='0'.repeat(64);assert.throws(()=>checkNativeAudit(f));});
test('native create request hash and complete process/review claim coverage cannot be omitted',()=>{for(const change of [f=>f.runs[0].requestHash='0'.repeat(64),f=>{f.events=f.events.filter(e=>e.action!=='researchhub.full.analysis.process.claim');},f=>{f.events=f.events.filter(e=>e.action!=='researchhub.full.analysis.review.claim');}]){const f=fixture();change(f);assert.throws(()=>checkNativeAudit(f));}});
