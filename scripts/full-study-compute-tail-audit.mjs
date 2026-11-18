// Scoped read-only export for this new synthetic benchmark only. No business POST.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openHarness,json,base,privateDir as sourcePrivate} from './full-study-runtime.mjs';

const task='full-study-compute-tail-2026-11-16';
const studyId='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25',rootId='full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198',rootHash='8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7';
const actions=['research_method_run_create','research_method_run_dispatch','research_method_run_publish','research_method_run_review'];
const normalize=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(normalize(x)))).digest('hex');
const fileHash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const inScope=(x,s)=>['tenantId','studyGroupId','researchProjectId'].every(k=>x[k]===s[k]);

/** Pure provenance checks; numerical validation remains the independent Python oracle. */
export function checkNativeAudit({scope,actor,header,runs,reviews,nativeAudits,events,receipts,createKey,mode,groupId}){
 assert(['pre-review','final'].includes(mode));assert.equal(runs.length,39);assert.equal(new Set(runs.map(r=>r.id)).size,39);
 assert(inScope(header,scope));assert.equal(header.id,groupId);assert.equal(header.target,studyId);assert.equal(header.accountId,actor.id);
 const m=header.meta;assert.equal(m.snapshotId,rootId);assert.equal(m.manifestHash,rootHash);assert.equal(m.studyId,studyId);assert.equal(m.requestKey,createKey);assert.equal(m.authVersion,actor.authVersion);assert.equal(m.slices.length,39);for(const key of ['sliceId','methodKey','snapshotId'])assert.equal(new Set(m.slices.map(t=>t[key])).size,39);
 assert.equal(new Set(receipts.map(r=>r.request_key)).size,receipts.length);
 assert.equal(nativeAudits.length,mode==='final'?156:117);assert.equal(reviews.length,mode==='final'?39:0);
 const operations=events.filter(e=>e.action==='researchhub.full.analysis.review.operation');if(mode==='final')assert(operations.length>0);
 const createReceipt=receipts.find(r=>r.request_key===createKey);assert(createReceipt);assert.equal(createReceipt.action,'full.analysis.run.create');assert.equal(createReceipt.audit_id,groupId);assert.equal(createReceipt.target_id,studyId);assert.equal(createReceipt.request_hash,hash({studyId,body:{requestKey:createKey,snapshotId:rootId}}));
 for(const row of [...runs,...reviews,...nativeAudits,...events])assert(inScope(row,scope),'SCOPED_NATIVE_ROW_REQUIRED');
 for(const r of runs){
  assert.equal(r.accountId,actor.id);assert.equal(r.skillKey,'descriptive-statistics');assert.equal(r.executorVersion,'descriptive-v1');assert.equal(r.environment.llm,false);
  assert.equal(r.status,mode==='final'?'completed':'needs_review');assert.equal(r.reviewStatus,mode==='final'?'confirmed':'pending_review');assert.equal(r.inputSummary.studyId,studyId);
  assert.equal(r.requestHash,hash({input:r.inputSummary,sessionId:r.sessionId,agentId:r.agentId,accountId:r.accountId}));
  const binding=m.slices.find(x=>x.snapshotId===r.inputSummary.snapshotId);assert(binding);assert.equal(binding.methodKey,r.idempotencyKey);assert.equal(r.idempotencyKey,'full-slice-'+hash({studyId,actor:actor.id,requestKey:createKey,snapshotId:binding.snapshotId}));
  assert.equal(r.dataSources.analysisBasis.rootSnapshotId,rootId);assert.equal(r.dataSources.analysisBasis.rootManifestHash,rootHash);
  assert.deepEqual(r.environment.analysisBasis,r.dataSources.analysisBasis);
  for(const action of actions.slice(0,mode==='final'?4:3))assert.equal(nativeAudits.filter(a=>a.target===r.id&&a.action===action).length,1,action+':'+r.id);
  const a=nativeAudits.filter(a=>a.target===r.id);assert(a.every(v=>v.accountId===actor.id));
  assert.deepEqual(a.find(v=>v.action===actions[0]).meta.analysisBasis,r.dataSources.analysisBasis);
  const dispatch=a.find(v=>v.action===actions[1]),publish=a.find(v=>v.action===actions[2]);assert.match(dispatch.meta.claim,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(dispatch.meta.claim,publish.meta.claim);assert.equal(dispatch.meta.claim,r.environment.claim);
  if(mode==='final'){
   const audit=a.find(v=>v.action===actions[3]),rs=reviews.filter(v=>v.runId===r.id);assert.equal(rs.length,1);const review=rs[0];
   const candidates=operations.filter(o=>o.meta.targets.some(t=>t.runId===r.id&&t.nativeKey===audit.meta.requestKey));assert.equal(candidates.length,1);const op=candidates[0],t=op.meta.targets.find(t=>t.runId===r.id);
   const key='full-review-'+hash({requestKey:op.meta.requestKey,runId:r.id});assert.equal(t.nativeKey,key);assert.equal(t.methodKey,r.idempotencyKey);assert.equal(t.snapshotId,r.inputSummary.snapshotId);assert.equal(op.accountId,actor.id);assert.equal(op.meta.authVersion,actor.authVersion);assert.equal(op.meta.runGroupId,groupId);assert.equal(op.meta.snapshotId,rootId);assert.equal(op.meta.manifestHash,rootHash);assert.equal(op.meta.targetsHash,hash(op.meta.targets));
   assert.equal(op.meta.commandHash,hash({studyId,runGroupId:groupId,body:{requestKey:op.meta.requestKey,conclusion:op.meta.conclusion,comment:op.meta.comment}}));
   assert.equal(op.meta.studyId,studyId);const parentReceipt=receipts.find(v=>v.request_key===op.meta.requestKey);assert(parentReceipt);assert.equal(parentReceipt.action,'full.analysis.review.start');assert.equal(parentReceipt.audit_id,op.id);assert.equal(parentReceipt.target_id,groupId);assert.equal(parentReceipt.request_hash,op.meta.commandHash);assert.equal(parentReceipt.result.operationId,op.id);
   const command=hash({runId:r.id,conclusion:op.meta.conclusion,comment:op.meta.comment});assert.equal(t.commandHash,command);assert.equal(audit.meta.commandHash,command);assert.equal(audit.id,'descriptive-review-'+hash({tenantId:scope.tenantId,accountId:actor.id,requestKey:key}));assert.equal(audit.meta.requestKey,key);assert.equal(audit.meta.reviewId,review.id);assert.equal(audit.meta.reviewVersion,review.version);assert.equal(review.version,1);assert.equal(review.reviewerAccountId,actor.id);assert.equal(review.conclusion,'confirmed');assert.equal(review.comment,op.meta.comment);assert(['tenant_admin','pi','methodologist'].includes(review.reviewRole));
  }
 }
 const claims=events.filter(e=>['researchhub.full.analysis.process.claim','researchhub.full.analysis.review.claim'].includes(e.action));
 for(const c of claims){
  assert.equal(c.accountId,actor.id);assert.equal(c.meta.authVersion,actor.authVersion);assert.match(c.meta.requestDigest,/^[a-f0-9]{64}$/);
  const receipt=receipts.find(r=>r.request_key===c.meta.requestKey);assert(receipt);assert.equal(receipt.audit_id,c.id);assert.equal(receipt.request_hash,c.meta.requestDigest);assert.equal(receipt.result.claimId,c.id);assert.equal(receipt.result.studyId,studyId);assert.equal(receipt.result.runGroupId,groupId);assert.equal(receipt.target_id,c.target);
  const process=c.action.endsWith('process.claim');assert.equal(receipt.action,process?'full.analysis.run.process':'full.analysis.review.advance');
  if(c.meta.batchVersion){assert.equal(c.meta.batchVersion,'full-study-batch-v1');assert.equal(c.meta.limit,3);assert(c.meta.targets.length>=1&&c.meta.targets.length<=3);assert.equal(c.meta.targetsHash,hash(c.meta.targets));assert.equal(receipt.result.targetsHash,c.meta.targetsHash);assert.equal(receipt.result.batchVersion,c.meta.batchVersion);assert.equal(receipt.result.limit,3);assert.equal(new Set(c.meta.targets.map(t=>t.methodKey)).size,c.meta.targets.length);}
  const finishAction=process?'researchhub.full.analysis.process.finished':'researchhub.full.analysis.review.finished',finishes=events.filter(e=>e.action===finishAction&&e.meta.claimId===c.id);assert(finishes.length<=1);if(mode==='final')assert.equal(finishes.length,1);for(const f of finishes){assert.equal(f.accountId,actor.id);assert.equal(f.target,c.target);}
  if(process){assert.equal(c.target,groupId);const targets=c.meta.batchVersion?c.meta.targets:[{methodKey:c.meta.methodKey,snapshotId:c.meta.snapshotId}];for(const t of targets)assert(m.slices.some(x=>x.methodKey===t.methodKey&&x.snapshotId===t.snapshotId));if(c.meta.batchVersion){assert.equal(c.meta.rootSnapshotId,rootId);assert.equal(c.meta.manifestHash,rootHash);}}
  else{const op=operations.find(o=>o.id===c.target);assert(op);assert.equal(receipt.result.operationId,op.id);const targets=c.meta.batchVersion?c.meta.targets:op.meta.targets.filter(t=>t.runId===c.meta.runId&&t.nativeKey===c.meta.nativeKey);assert(targets.length);for(const t of targets)assert(op.meta.targets.some(x=>hash(x)===hash(t)));}
 }
 const covered=kind=>new Set(claims.filter(c=>c.action.endsWith(kind+'.claim')).flatMap(c=>c.meta.batchVersion?c.meta.targets.map(t=>kind==='process'?t.methodKey:t.runId):[kind==='process'?c.meta.methodKey:c.meta.runId]));
 assert.deepEqual([...covered('process')].sort(),m.slices.map(t=>t.methodKey).sort());if(mode==='final')assert.deepEqual([...covered('review')].sort(),runs.map(r=>r.id).sort());
 for(const receipt of receipts){assert.equal(receipt.tenant_id,scope.tenantId);assert.equal(receipt.actor_id,actor.id);assert.equal(receipt.result.studyId,studyId);assert.equal(receipt.result.runGroupId,groupId);}
 return{passed:true,mode,runs:runs.length,nativeAudits:nativeAudits.length,reviews:reviews.length,claims:claims.length,receipts:receipts.length,operations:operations.length};
}

export function parseAuditInvocation(args){
 assert.equal(args.length,3,'EXPLICIT_LOCAL_AFTER_PHASE_REQUIRED');assert.equal(args[0],'--local-synthetic');assert.equal(args[1],'after');assert(['pre-review','final'].includes(args[2]));return{stage:args[1],mode:args[2]};
}
export function bindAfterJournal(j){
 assert.equal(j.task,task);assert.equal(j.stage,'after');assert.equal(j.studyId,studyId);assert.equal(j.snapshotId,rootId);assert.equal(j.manifestHash,rootHash);
 assert.match(j.runGroupId,/^full-run-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert(!['full-run-f1506b69-44aa-4c8c-a5cf-230cc398efbe','full-run-0358f67e-e4d7-4e5f-b861-ed25db601745','full-run-b45d1768-8f72-406a-9da5-cb083aead9db','full-run-7a6ecafc-345c-456e-b620-d8de8fe92d02','full-run-937ad872-cc4e-4e3a-bc8a-aa0fa8b497fb'].includes(j.runGroupId),'FRESH_AFTER_GROUP_REQUIRED');
 assert.equal(j.steps?.create?.status,'done','PROVEN_CREATE_RECEIPT_REQUIRED');assert.equal(j.steps?.create?.value?.id,j.runGroupId);assert.equal(j.steps.create.body.snapshotId,rootId);assert(typeof j.steps.create.body.requestKey==='string'&&j.steps.create.body.requestKey.length>0);return{groupId:j.runGroupId,createKey:j.steps.create.body.requestKey};
}
const immutableRevisionKeys=['ref','formVersionId','answers','score','scoreAlgorithm','source','actorKind','actorId','reason','changes','sourceSubmittedAt','createdAt'];
export function compareRevisionDtos(previous,current){
 assert.equal(previous.length,48);assert.equal(current.length,48);const seen=new Set(),presentation=[];
 for(const old of previous){const key=old.ref.responseId+':'+old.ref.revisionNo;assert(!seen.has(key));seen.add(key);const now=current.find(x=>x.ref.responseId===old.ref.responseId&&x.ref.revisionNo===old.ref.revisionNo);assert(now,'MISSING_NATIVE_REVISION');for(const k of immutableRevisionKeys){assert(Object.hasOwn(old,k)&&Object.hasOwn(now,k),'IMMUTABLE_REVISION_FIELD_MISSING:'+k);assert.deepEqual(now[k],old[k],'REVISION_CHANGED:'+k);}for(const side of [old,now])for(const k of Object.keys(side))assert(immutableRevisionKeys.includes(k)||k==='actorDisplayName','UNKNOWN_REVISION_DTO_FIELD:'+k);if(old.actorDisplayName!==now.actorDisplayName)presentation.push({ref:old.ref,field:'actorDisplayName',oldValue:old.actorDisplayName??null,newValue:now.actorDisplayName??null,source:'presentation outside immutable envelope'});}
 return presentation;
}
async function main(){
 const {stage,mode}=parseAuditInvocation(process.argv.slice(2));
 const repo=fileURLToPath(new URL('../',import.meta.url)),workspace=fileURLToPath(new URL('../../',import.meta.url)),run=mode+'-'+randomUUID().slice(0,8),ownPrivate=workspace+'.tmp/'+task+'/native-audit-'+run+'/',out=repo+'docs/testing/evidence/'+task+'/native-audit/'+run+'/';
 const b=json(sourcePrivate+'bootstrap.json'),journalPath=workspace+'.tmp/'+task+'/'+stage+'/benchmark-journal.json',j=json(journalPath),{groupId,createKey}=bindAfterJournal(j);assert.equal(b.study.id,studyId);assert.equal(b.runId,'rh-full-study-b230c34b');assert.equal(b.syntheticOnly,true);
 mkdirSync(out,{recursive:true});const save=(name,value)=>writeFileSync(out+name,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});let h,failure,result;
 try{
  h=await openHarness({privateOutputDir:ownPrivate});assert.equal(h.actor.tenantId,b.scope.tenantId);const A='/research-studies/'+studyId+'/analysis';
  const group=await h.get(A+'/runs/'+groupId),snapshot=await h.get(A+'/snapshots/'+rootId);assert.equal(group.id,groupId);assert.equal(group.manifestHash,rootHash);assert.equal(group.remaining,0);assert.equal(snapshot.basis.manifestHash,rootHash);assert.equal(hash(snapshot.manifest),rootHash);
  const ids=group.slices.map(s=>s.methodRunId).filter(Boolean);assert.equal(ids.length,39);assert.equal(new Set(ids).size,39);
  const taskBase=repo+'docs/testing/evidence/'+task+'/',old=json(taskBase+'baseline/old-native-runs-195.json').runs,oldIds=old.map(r=>r.id);assert.equal(old.length,195);assert.equal(new Set(oldIds).size,195);assert(ids.every(id=>!oldIds.includes(id)),'AFTER_REUSES_OLD_NATIVE_ID');
  const frozenRaw=json(taskBase+'live-freeze/run-9fb87de0/raw-revisions-48.json'),assignmentIds=[...new Set(frozenRaw.revisions.map(r=>r.ref.assignmentId))];assert.equal(assignmentIds.length,46);
  const nativeVerify=(await import('../server/research-runtime/dependencies.mjs')).runtimeDependencies().load('study-operations/formal-response-history','verifyFormalRevisionEnvelope');
  const priorChildren=json(taskBase+'live-freeze/run-9fb87de0/child-snapshots-39.json');
  const scientificBaseline=json(repo+'docs/testing/evidence/full-study-performance-2026-11-13/baseline/baseline.json'),scientificBefore=Object.fromEntries(Object.entries(scientificBaseline.immutableInputs).map(([k,v])=>[k,fileHash(workspace+v.path)]));
  const raw=await h.read(async tx=>{
   const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${b.runId}`;assert(marker?.manifest?.syntheticOnly===true&&marker.manifest.studyId===studyId&&inScope(marker.manifest.scope,b.scope));
   const header=await tx.auditLog.findFirst({where:{...b.scope,id:groupId,action:'researchhub.full.analysis.run.group',target:studyId,accountId:h.actor.id}});assert(header);
   const operations=await tx.auditLog.findMany({where:{...b.scope,target:groupId,action:'researchhub.full.analysis.review.operation'}}),opIds=operations.map(x=>x.id);
   const events=await tx.auditLog.findMany({where:{...b.scope,OR:[{id:groupId},{target:groupId},{target:{in:opIds}}]},orderBy:{id:'asc'}});
   const runs=await tx.researchMethodRun.findMany({where:{...b.scope,id:{in:ids}},orderBy:{id:'asc'}}),reviews=await tx.researchMethodReview.findMany({where:{...b.scope,runId:{in:ids}},orderBy:[{runId:'asc'},{version:'asc'}]});
   const nativeAudits=await tx.auditLog.findMany({where:{...b.scope,target:{in:ids},action:{in:actions}},orderBy:{id:'asc'}});
   const receipts=await tx.$queryRaw`SELECT * FROM rh_research.operation WHERE tenant_id=${b.scope.tenantId} AND actor_id=${h.actor.id} AND result->>'studyId'=${studyId} AND result->>'runGroupId'=${groupId} AND (target_id=${groupId} OR target_id=ANY(${opIds}::text[]) OR request_key=${j.steps.create.body.requestKey}) ORDER BY id`;
   const oldRuns=await tx.researchMethodRun.findMany({where:{...b.scope,id:{in:oldIds}},orderBy:{id:'asc'}});
   const childIds=group.slices.filter(s=>s.methodRunId).map(s=>s.snapshotId),childSnapshots=await tx.$queryRaw`SELECT * FROM rh_analysis.snapshot WHERE tenant_id=${b.scope.tenantId} AND study_group_id=${b.scope.studyGroupId} AND research_project_id=${b.scope.researchProjectId} AND study_id=${studyId} AND id=ANY(${childIds}::text[]) ORDER BY id`;
   const revisions=await tx.formResponseRevision.findMany({where:{...b.scope,assignmentId:{in:assignmentIds}},orderBy:[{responseId:'asc'},{revisionNo:'asc'}]});assert.equal(revisions.length,48);const revisionDtos=revisions.map(nativeVerify);
   return normalize({header,runs,reviews,nativeAudits,events,receipts,oldRuns,childSnapshots,revisions,revisionDtos});
  });
  save('snapshot.json',snapshot);save('group.json',group);save('actual-method-runs.json',{studyId,runGroupId:groupId,runs:raw.runs});save('native-proof.json',{studyId,runGroupId:groupId,...raw});save('journal-copy.json',j);
  save('raw-revisions-48.json',{...frozenRaw,revisions:raw.revisionDtos,at:new Date().toISOString()});save('native-revisions-full-48.json',raw.revisions);
  const check=checkNativeAudit({...raw,scope:b.scope,actor:h.actor,createKey,mode,groupId});
  assert.deepEqual(raw.oldRuns,[...old].sort((a,b)=>a.id.localeCompare(b.id)),'OLD_195_NATIVE_ROWS_CHANGED');assert.equal(raw.childSnapshots.length,39);
  assert.deepEqual(raw.childSnapshots,priorChildren,'ORIGINAL_39_CHILD_SNAPSHOTS_CHANGED');const presentationFields=compareRevisionDtos(frozenRaw.revisions,raw.revisionDtos);
  for(const row of raw.childSnapshots){assert.equal(row.manifest.rootSnapshotId,rootId);assert.equal(hash(row.manifest),row.manifest_hash);assert.equal(row.manifest.rootManifestHash,rootHash);}
  let knownBodyDigestCount=0;const processClaims=raw.events.filter(e=>e.action==='researchhub.full.analysis.process.claim');for(const c of processClaims){
   const known=Object.values(j.steps).find(s=>s.body?.requestKey===c.meta.requestKey);if(known){assert.equal(c.meta.requestDigest,hash({studyId,id:groupId,body:known.body}));knownBodyDigestCount++;}
  }
  const word=repo+'docs/testing/evidence/real-study-full-simulation-2026-11-13/report-corrected/report.docx';assert.equal(fileHash(word),'e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7');
  let oldWordDownload;
  if(mode==='final'){
   const path='/research-studies/'+studyId+'/analysis/report-exports/cmwf08c7p00a6luvpqjgxk0iy/file',cookie=json(ownPrivate+'admin-session.json').cookie,started=performance.now();
   const response=await fetch(base+'/api'+path,{headers:{Cookie:cookie},signal:AbortSignal.timeout(90000),redirect:'error'}),bytes=Buffer.from(await response.arrayBuffer()),digest=createHash('sha256').update(bytes).digest('hex');
   oldWordDownload={method:'GET',path,status:response.status,elapsedMs:performance.now()-started,sizeBytes:bytes.length,sha256:digest};h.network.push({...oldWordDownload,binary:true});assert.equal(response.status,200);assert.equal(bytes.length,22581);assert.equal(digest,fileHash(word));writeFileSync(out+'old-report-download.docx',bytes,{flag:'wx'});
  }
  const scientificFiles={};for(const[k,v]of Object.entries(scientificBaseline.immutableInputs)){const after=fileHash(workspace+v.path);assert.equal(after,scientificBefore[k]);if(k!=='profile_script')assert.equal(after,v.sha256);scientificFiles[k]={path:v.path,sha256:after,authorizedProfileScriptException:k==='profile_script'};}assert.equal(Object.keys(scientificFiles).filter(k=>k!=='profile_script').length,36);save('scientific-files.json',scientificFiles);
  result={...check,old195NativeRowsUnchanged:true,baseline39RemainsUnchangedAndNotReviewed:true,raw48VerifiedAndUnchanged:true,presentationFields,childSnapshots:39,scientificFilesUnchanged:36,oldWordSha256:fileHash(word),...(oldWordDownload?{oldWordDownload}:{}),rawReceiptDigestBindingChecked:true,knownJournalBodyDigestsRecomputed:knownBodyDigestCount,processClaimCount:processClaims.length,allProcessClaimBodiesIndependentlyRecomputed:knownBodyDigestCount===processClaims.length};
 }catch(error){failure={name:error.name,code:error.code??null,message:String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[database-url-redacted]').slice(0,2200)};}
 finally{
  save('result.json',{schemaVersion:'full-study-compute-tail-native-audit-v1',at:new Date().toISOString(),passed:!failure,...result,failure:failure??null,syntheticOnly:true,stage,mode,studyId,runGroupId:groupId,snapshotId:rootId,manifestHash:rootHash,runtimePid:h?.runtime?.pid??null,privateOutputDir:ownPrivate,network:h?.network??[],businessWrites:0,workerCalls:0,originalEvidenceFilesWritten:0,scopeNote:'One authentication POST inside openHarness; otherwise only GET and explicitly read-only fixture transactions. All native rows/claims/receipts retained without reduction. Unknown browser request bodies are not claimed independently reconstructed from their hashes.'});
  console.log(JSON.stringify({passed:!failure,mode,runGroupId:groupId,...result,failure:failure??null,evidence:out}));if(failure)process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
