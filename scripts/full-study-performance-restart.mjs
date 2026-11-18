// Synthetic acceptance tool only. Prepared for review; never imported by runtime.
// Execution requires explicit flags and a fresh browser/root checkpoint.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,renameSync,realpathSync} from 'node:fs';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment,workspaceRoot} from './research-creation-fixture.mjs';
import {assertFixtureTarget,validateFixtureConfig,fixtureClient,readFixtureIdentity,checkFixtureIdentity} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';
import {requestHash} from '../server/research-studies/contract.mjs';

const TASK='full-study-performance-2026-11-13',KEY='rh-kb-local-b0e2af9d';
const STUDY='rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25',GROUP='full-run-937ad872-cc4e-4e3a-bc8a-aa0fa8b497fb';
const SNAPSHOT='full-snapshot-9eef3230-bc1b-492f-8c07-0441362f9198',MANIFEST='8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7';
const ROOT=workspaceRoot,PRIVATE=ROOT+'.tmp/'+TASK+'/',EVIDENCE=ROOT+'researchhub/docs/testing/evidence/'+TASK+'/restart/';
const RUNTIME=ROOT+'.tmp/researchhub-knowledge-local/runtime.json',HOST=ROOT+'researchhub/scripts/local-knowledge.mjs';
const BASE='http://127.0.0.1:19501',SOURCE=ROOT+'.tmp/real-study-full-simulation-2026-11-13/';
const json=p=>JSON.parse(readFileSync(p,'utf8')),digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const code=e=>e?.getResponse?.()?.code??e?.code??e?.message??String(e);
const nativeKey=(parent,runId)=>'full-review-'+fullStudyHash({requestKey:parent,runId});
const nativeAuditId=(actor,key)=>'descriptive-review-'+fullStudyHash({tenantId:actor.tenantId,accountId:actor.accountId,requestKey:key});
const OP='researchhub.full.analysis.review.operation',CLAIM='researchhub.full.analysis.review.claim',FINISHED='researchhub.full.analysis.review.finished';

// These exact commands were observed read-only on this owned runtime. An upgrade
// or extra child is a guard failure, not permission to broaden the kill pattern.
const CHILDREN=[
 {kind:'parser',command:'/opt/homebrew/Cellar/python@3.14/3.14.5/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python '+ROOT+'docs/test/evidence/2026-10-22-researchhub-synthetic-ai-trial/isolated-service.py parser 19503'},
 {kind:'embed',command:ROOT+'app/skills/.venv/bin/python '+ROOT+'docs/test/evidence/2026-10-22-researchhub-synthetic-ai-trial/isolated-service.py embed 19504'},
 {kind:'quality',command:'/Applications/Xcode-26.5.0.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python -B '+ROOT+'app/research-methods-worker/serve.py'},
];
const ESBUILD=ROOT+'researchhub/node_modules/.pnpm/@esbuild+darwin-arm64@0.24.2/node_modules/@esbuild/darwin-arm64/bin/esbuild --service=0.24.2 --ping';
function processes(){
 return execFileSync('ps',['-axo','pid=,ppid=,lstart=,command='],{encoding:'utf8',env:{...process.env,LC_ALL:'C'},maxBuffer:4*1024*1024}).split('\n').flatMap(line=>{
  const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/);
  return m?[{pid:Number(m[1]),ppid:Number(m[2]),started:m[3].replace(/\s+/g,' '),command:m[4]}]:[];
 });
}
const identical=(a,b)=>a&&b&&a.pid===b.pid&&a.started===b.started&&a.command===b.command;
function ownedRuntime(expected){
 const r=json(RUNTIME),all=processes(),parent=all.find(p=>p.pid===r.pid);
 assert.equal(r.key,KEY);assert.equal(r.ready,true);assert(r.pid>1&&parent);
 assert.equal(parent.started,r.started);assert.equal(parent.command,process.execPath+' '+HOST+' serve '+KEY,'OWNED_PARENT_COMMAND_CHANGED');
 if(expected){assert.equal(r.pid,expected.pid);assert.equal(r.started,expected.started);assert.equal(r.key,expected.key);}
 const children=all.filter(p=>p.ppid===parent.pid),python=CHILDREN.map(spec=>{const matches=children.filter(p=>p.command===spec.command);assert.equal(matches.length,1,'OWNED_PYTHON_CHILD_CHANGED:'+spec.kind);return{...matches[0],kind:spec.kind};});
 const other=children.filter(p=>!python.some(c=>c.pid===p.pid));assert(other.length<=1&&other.every(p=>p.command===ESBUILD),'UNRECOGNIZED_OWNED_CHILD');
 assert(!all.some(p=>children.some(c=>c.pid===p.ppid)),'OWNED_CHILD_HAS_UNREVIEWED_DESCENDANTS');
 return{key:r.key,parent,python,passiveChildren:other,runtime:{pid:r.pid,started:r.started,key:r.key}};
}
async function waitGone(identity,ms){
 const deadline=Date.now()+ms;do{if(!identical(processes().find(p=>p.pid===identity.pid),identity))return;await delay(100);}while(Date.now()<deadline);
 throw Error('OWNED_PROCESS_DID_NOT_EXIT:'+identity.pid);
}
function within(path,roots){const p=realpathSync(resolve(path));assert(roots.some(root=>p.startsWith(root+sep)),'EVIDENCE_PATH_REJECTED');return p;}
function argumentsOf(argv){
 const flags=new Set(['--local-synthetic','--execute','--crash-owned-runtime','--graceful-owned-runtime','--resume-expired-step']),values=new Set(['--phase','--checkpoint','--record']);const out={};
 for(let i=0;i<argv.length;i++){const a=argv[i];assert(flags.has(a)||values.has(a),'UNKNOWN_ARGUMENT');assert(!Object.hasOwn(out,a),'DUPLICATE_ARGUMENT');out[a]=flags.has(a)?true:argv[++i];assert(out[a]);}
 assert(out['--local-synthetic']&&out['--execute'],'EXPLICIT_LOCAL_SYNTHETIC_EXECUTION_REQUIRED');
 assert(['interrupt','resume'].includes(out['--phase'])&&out['--checkpoint'],'PHASE_AND_CHECKPOINT_REQUIRED');
 if(out['--phase']==='interrupt')assert(Boolean(out['--crash-owned-runtime'])!==Boolean(out['--graceful-owned-runtime'])&&!out['--resume-expired-step']&&!out['--record'],'EXPLICIT_SINGLE_INTERRUPT_MODE_REQUIRED');
 else assert(out['--resume-expired-step']&&out['--record']&&!out['--crash-owned-runtime']&&!out['--graceful-owned-runtime'],'EXPLICIT_RESUME_AUTHORIZATION_REQUIRED');
 return out;
}

async function main(){
 const args=argumentsOf(process.argv.slice(2)),phase=args['--phase'],checkpointPath=within(args['--checkpoint'],[PRIVATE.slice(0,-1),EVIDENCE.slice(0,-1)]),checkpoint=json(checkpointPath);
 const journalPath=PRIVATE+'benchmark-journal.json',journal=json(journalPath),bootstrap=json(SOURCE+'bootstrap.json'),accepted=json(SOURCE+'analysis-corrected-journal.json'),runtime=json(RUNTIME);
 assert.equal(checkpoint.schemaVersion,'full-study-restart-checkpoint-v1');assert.equal(checkpoint.task,TASK);assert.equal(checkpoint.studyId,STUDY);assert.equal(checkpoint.runGroupId,GROUP);assert.equal(checkpoint.runtime?.key,KEY);assert.equal(checkpoint.exclusiveRuntimeApproved,true,'EXCLUSIVE_SYNTHETIC_RUNTIME_CONFIRMATION_REQUIRED');
 assert.equal(journal.task,TASK);assert.equal(journal.studyId,STUDY);assert.equal(journal.runGroupId,GROUP);assert.equal(journal.snapshotId,SNAPSHOT);assert.equal(journal.manifestHash,MANIFEST);assert.notEqual(accepted.runGroupId,GROUP);
 assert.equal(bootstrap.study.id,STUDY);assert.equal(bootstrap.runId,'rh-full-study-b230c34b');assert.deepEqual(checkpoint.scope,bootstrap.scope);assert.equal(runtime.ids.tenant,checkpoint.scope.tenantId);assert.equal(checkpoint.actor?.accountId,runtime.ids.admin);assert(Number.isSafeInteger(checkpoint.actor.authVersion));
 assert(/^[A-Za-z0-9_-]{8,160}$/.test(checkpoint.parentKey)&&/^[A-Za-z0-9_-]{1,160}$/.test(checkpoint.operationId));if(journal.operationId)assert.equal(journal.operationId,checkpoint.operationId);
 const env=fixtureEnvironment(),cfg=validateFixtureConfig(env);assert.equal(cfg.databaseName,'wp01_test_full_baseline');await assertFixtureTarget(env);
 let db;
 const actor={...checkpoint.actor,tenantId:checkpoint.scope.tenantId},scope=checkpoint.scope,opPath='/research-studies/'+STUDY+'/analysis/runs/'+GROUP+'/review-operations/'+checkpoint.operationId;
 const read=fn=>db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 5000');checkFixtureIdentity(cfg,'direct',await readFixtureIdentity(tx));return fn(tx);},{isolationLevel:'RepeatableRead',maxWait:5000,timeout:10000});
 let directory,record,cookie='',postPromise,needRestore=false,stoppedIdentity;
 if(phase==='resume'){
  const recordPath=within(args['--record'],[EVIDENCE.slice(0,-1)]);record=json(recordPath);directory=resolve(recordPath,'..')+sep;
  assert.equal(record.schemaVersion,'full-study-restart-run-v1');assert.equal(record.checkpointHash,digest(checkpointPath));assert.equal(record.studyId,STUDY);assert.equal(record.runGroupId,GROUP);assert.equal(record.operationId,checkpoint.operationId);assert.equal(record.parentKey,checkpoint.parentKey);assert.deepEqual(record.scope,scope);assert.deepEqual(record.actor,actor);assert(record.initialStep?.requestKey&&!record.resumeAttempt&&record.restartedRuntime&&record.stoppedParent,'RESTART_RECORD_NOT_RESUMABLE');
 }else{
  directory=EVIDENCE+'run-'+randomUUID()+'/';mkdirSync(directory,{recursive:true,mode:0o700});
  record={schemaVersion:'full-study-restart-run-v1',task:TASK,studyId:STUDY,runGroupId:GROUP,operationId:checkpoint.operationId,parentKey:checkpoint.parentKey,scope,actor,checkpointHash:digest(checkpointPath),journalHash:digest(journalPath),createdAt:new Date().toISOString(),mode:args['--crash-owned-runtime']?'SIGKILL':'SIGTERM',events:[],network:[],proofs:[]};
 }
 const save=()=>{writeFileSync(directory+'run.json.next',JSON.stringify(record,null,2)+'\n',{mode:0o600});renameSync(directory+'run.json.next',directory+'run.json');};
 const event=(kind,detail={})=>{const item={at:new Date().toISOString(),kind,...detail};record.events.push(item);save();console.log(JSON.stringify({kind,at:item.at,...detail}));};
 async function request(path,{method='GET',body,login=false}={}){
  assert(path===opPath||path===opPath+'/process'||path.startsWith(opPath+'/step-receipts/')||login&&path==='/auth/login','RESTART_HTTP_SCOPE_REJECTED');
  const entry={at:new Date().toISOString(),method,path,...(body&&!login?{body}:{}),status:null};record.network.push(entry);save();const started=performance.now();
  try{
   const response=await fetch(BASE+'/api'+path,{method,headers:{Cookie:cookie,Origin:BASE,Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(90000)});
   const value=await response.json().catch(()=>null);entry.status=response.status;entry.elapsedMs=Math.round(performance.now()-started);entry.response=login?{accountId:actor.accountId}:value;save();
   if(login){assert.equal(response.status,201);cookie=response.headers.get('set-cookie')?.split(';')[0];assert(cookie);}else assert.equal(response.status,200,JSON.stringify({status:response.status,code:value?.code}));return value;
  }catch(error){entry.error={name:error.name,code:String(code(error)).slice(0,500)};entry.elapsedMs=Math.round(performance.now()-started);save();throw error;}
 }
 async function login(){
  const currentRuntime=json(RUNTIME);assert.equal(currentRuntime.key,KEY);assert.equal(currentRuntime.ids.admin,actor.accountId);
  const account=await read(async tx=>{
   const markers=await tx.$queryRaw`SELECT run_id,manifest FROM wp01_meta.fixture_run WHERE run_id=ANY(${[KEY,bootstrap.runId]}::text[])`;
   assert.equal(markers.length,2);assert(markers.every(m=>m.manifest?.syntheticOnly===true));assert.equal(markers.find(m=>m.run_id===KEY).manifest.ids.tenant,scope.tenantId);
   const own=markers.find(m=>m.run_id===bootstrap.runId).manifest;assert.equal(own.studyId,STUDY);assert.equal(own.studyGroupId,scope.studyGroupId);assert.equal(own.scope.researchProjectId,scope.researchProjectId);
   const a=await tx.account.findUnique({where:{id:actor.accountId}});assert(a&&a.tenantId===scope.tenantId&&a.status==='active'&&a.role==='tenant_admin'&&a.isTenantAdmin===true&&a.authVersion===actor.authVersion,'RESTART_CURRENT_ACTOR_REJECTED');return a;
  });
  await request('/auth/login',{method:'POST',login:true,body:{tenantSlug:scope.tenantId,username:account.username,password:currentRuntime.password}});
 }
 function assertOperation(value){assert(value&&value.studyId===STUDY&&value.runGroupId===GROUP&&value.operationId===checkpoint.operationId&&value.requestKey===checkpoint.parentKey&&value.snapshotId===SNAPSHOT&&value.manifestHash===MANIFEST&&value.kind==='full-study-review-v1');assert.equal(value.receipt?.requestKey,checkpoint.parentKey);return value;}
 async function proof(stepBody,label){
  const result=await read(async tx=>{
   const [clock]=await tx.$queryRaw`SELECT clock_timestamp() AS observed_at,pg_backend_pid() AS observer_pid,txid_current_snapshot()::text AS visibility_snapshot`;
   const op=await tx.auditLog.findFirst({where:{...scope,id:checkpoint.operationId,action:OP,target:GROUP,accountId:actor.accountId}});assert(op&&op.meta?.authVersion===actor.authVersion&&op.meta.requestKey===checkpoint.parentKey&&op.meta.studyId===STUDY&&op.meta.runGroupId===GROUP&&op.meta.kind==='full-study-review-v1'&&op.meta.snapshotId===SNAPSHOT&&op.meta.manifestHash===MANIFEST,'RESTART_PARENT_BINDING_CHANGED');
   assert(Array.isArray(op.meta.targets)&&op.meta.targetsHash===fullStudyHash(op.meta.targets)&&new Set(op.meta.targets.map(t=>t.runId)).size===op.meta.targets.length&&op.meta.commandHash===requestHash({studyId:STUDY,runGroupId:GROUP,body:{requestKey:checkpoint.parentKey,conclusion:op.meta.conclusion,comment:op.meta.comment}}),'RESTART_PARENT_INTENT_CHANGED');
   const events=await tx.auditLog.findMany({where:{...scope,target:op.id,accountId:actor.accountId,action:{in:[CLAIM,FINISHED]}},orderBy:{id:'asc'}});
   const [receipt]=await tx.$queryRaw`SELECT request_hash,action,target_id,result,audit_id FROM rh_research.operation WHERE tenant_id=${scope.tenantId} AND actor_id=${actor.accountId} AND request_key=${stepBody.requestKey}`;
   const matches=events.filter(e=>e.action===CLAIM&&e.meta?.requestKey===stepBody.requestKey);assert(matches.length<=1);const claim=matches[0];
   const out={label,observedAt:clock.observed_at,observerPid:clock.observer_pid,visibilitySnapshot:clock.visibility_snapshot,visibility:'separate RepeatableRead READ ONLY transaction; row visibility proves commit, not updatedAt',eventsHash:fullStudyHash(events),claimCount:matches.length,receiptPresent:Boolean(receipt),claimCommitted:false,nativeAuditCount:0,nativeProven:false};
   if(!claim){assert(!receipt,'RESTART_RECEIPT_WITHOUT_CLAIM');return out;}
   const expectedDigest=requestHash({studyId:STUDY,runGroupId:GROUP,operationId:op.id,body:stepBody});assert(receipt&&receipt.action==='full.analysis.review.advance'&&receipt.target_id===op.id&&receipt.audit_id===claim.id&&receipt.request_hash===expectedDigest&&claim.meta.requestDigest===expectedDigest&&claim.meta.authVersion===actor.authVersion&&Number.isFinite(claim.meta.leaseUntil)&&receipt.result?.claimId===claim.id&&receipt.result.studyId===STUDY&&receipt.result.runGroupId===GROUP&&receipt.result.operationId===op.id,'RESTART_EXACT_STEP_PROOF_CHANGED');
   const target=op.meta.targets.find(t=>t.runId===claim.meta.runId);assert(target&&claim.meta.nativeKey===target.nativeKey&&target.nativeKey===nativeKey(checkpoint.parentKey,target.runId));
   const audits=await tx.auditLog.findMany({where:{...scope,id:nativeAuditId(actor,target.nativeKey),accountId:actor.accountId,action:'research_method_run_review',target:target.runId}}),reviews=await tx.researchMethodReview.findMany({where:{...scope,runId:target.runId}}),run=await tx.researchMethodRun.findFirst({where:{...scope,id:target.runId,skillKey:'descriptive-statistics'}});
   assert(run&&run.idempotencyKey===target.methodKey&&run.inputSummary?.studyId===STUDY&&run.inputSummary?.snapshotId===target.snapshotId,'RESTART_CHILD_BINDING_CHANGED');assert(audits.length<=1);
   const audit=audits[0],review=reviews.find(r=>r.id===audit?.meta?.reviewId);
   if(audit)assert(audit.meta.requestKey===target.nativeKey&&audit.meta.commandHash===target.commandHash&&audit.meta.commandHash===fullStudyHash({runId:run.id,conclusion:op.meta.conclusion,comment:op.meta.comment})&&audit.meta.conclusion===op.meta.conclusion&&Number.isSafeInteger(audit.meta.reviewVersion)&&audit.meta.reviewVersion>0&&review?.version===audit.meta.reviewVersion&&review.reviewerAccountId===actor.accountId&&['tenant_admin','pi','methodologist'].includes(review.reviewRole)&&review.conclusion===op.meta.conclusion&&review.comment===op.meta.comment&&run.reviewStatus===op.meta.conclusion&&run.status===(op.meta.conclusion==='confirmed'?'completed':'needs_input'),'RESTART_NATIVE_PROOF_INVALID');
   return{...out,claimCommitted:true,claimId:claim.id,claimHash:fullStudyHash(claim),unfinished:!events.some(e=>e.action===FINISHED&&e.meta?.claimId===claim.id),leaseUntil:claim.meta.leaseUntil,runId:run.id,nativeKey:target.nativeKey,nativeAuditCount:audits.length,nativeProven:Boolean(audit&&review),reviewCount:reviews.length,nativeAuditId:audit?.id??null,reviewId:review?.id??null,runStatus:run.status};
  });record.proofs.push(result);save();return result;
 }
 async function exactGet(stepBody,label){
  const before=await proof(stepBody,label+'-before-GET'),value=assertOperation(await request(opPath+'/step-receipts/'+stepBody.requestKey)),after=await proof(stepBody,label+'-after-GET');
  assert.equal(value.stepReceipt?.requestKey,stepBody.requestKey);assert.equal(value.stepReceipt?.runId,after.runId);assert.equal(before.claimHash,after.claimHash,'GET_CHANGED_ORIGINAL_CLAIM');
  // Use this invariant only while the owned request cannot concurrently commit.
  if(!identical(processes().find(p=>p.pid===record.stoppedParent?.pid),record.stoppedParent))assert.equal(before.eventsHash,after.eventsHash,'GET_CHANGED_REVIEW_EVENTS');
  assert.equal(value.stepReceipt.executionConfirmed,after.nativeProven);return{value,proof:after};
 }
 async function restart(){
  const result=await promisify(execFile)(process.execPath,[HOST,'start'],{cwd:ROOT,timeout:120000,maxBuffer:1024*1024});
  const owned=ownedRuntime();assert.notEqual(owned.parent.pid,stoppedIdentity.pid);assert.equal(owned.key,KEY);record.restartedRuntime=owned.runtime;record.startOutput=result.stdout.trim();needRestore=false;event('owned-runtime-restarted',{pid:owned.parent.pid});
 }
 try{
  db=fixtureClient(cfg.directUrl);
  if(phase==='interrupt'){
   const owned=ownedRuntime(checkpoint.runtime);record.ownedBefore=owned;save();await login();const initial=assertOperation(await request(opPath));assert.equal(initial.status,'ready');assert.equal(initial.canContinue,true);assert(initial.progress.remaining>0);
   await read(async tx=>{const prior=await tx.auditLog.findMany({where:{...scope,target:checkpoint.operationId,accountId:actor.accountId,action:{in:[CLAIM,FINISHED]}}});assert(prior.filter(e=>e.action===CLAIM).every(c=>prior.some(e=>e.action===FINISHED&&e.meta?.claimId===c.id)),'PREEXISTING_UNFINISHED_CLAIM_NO_NEW_TEST_POST');});
   // A checkpoint is single-use. Re-running this phase must never resend the
   // original step or silently start another attempt after a lost response.
   mkdirSync(PRIVATE,{recursive:true,mode:0o700});writeFileSync(PRIVATE+'restart-checkpoint-'+record.checkpointHash+'.json',JSON.stringify({record:directory+'run.json',at:new Date().toISOString()})+'\n',{flag:'wx',mode:0o600});
   const body={requestKey:'restart-step-'+randomUUID(),expectedStateHash:initial.stateHash,limit:1};record.initialStep=body;save();
   let settled=false;postPromise=request(opPath+'/process',{method:'POST',body}).then(v=>{record.postResponse=v;settled=true;save();},e=>{record.postError={name:e.name,code:String(code(e)).slice(0,500)};settled=true;save();});
   let candidate;const deadline=Date.now()+15000;
   do{const p=await proof(body,'observe-before-signal');if(p.claimCommitted){candidate=p;break;}if(settled)break;await delay(80);}while(Date.now()<deadline);
   if(!candidate||candidate.nativeProven){record.outcome='window-missed-no-signal';event(record.outcome);await postPromise;return;}
   assert.equal(candidate.nativeAuditCount,0);assert.equal(candidate.reviewCount,0,'CHILD_ALREADY_HAS_A_REVIEW');assert(candidate.unfinished&&candidate.leaseUntil>Date.now());
   const guarded=ownedRuntime(checkpoint.runtime);assert(identical(guarded.parent,owned.parent));assert.deepEqual(guarded.python,owned.python);record.stoppedParent=guarded.parent;stoppedIdentity=guarded.parent;
   // Re-read MVCC evidence immediately before the repeated process identity guard.
   candidate=await proof(body,'immediately-before-signal');if(candidate.nativeProven){record.outcome='window-missed-native-commit-no-signal';event(record.outcome);await postPromise;return;}assert(candidate.claimCommitted&&candidate.unfinished&&candidate.leaseUntil>Date.now()&&candidate.reviewCount===0,'INTERRUPT_WINDOW_NO_LONGER_VALID');
   ownedRuntime(checkpoint.runtime);record.signalRequestedAt=new Date().toISOString();save();process.kill(stoppedIdentity.pid,record.mode);needRestore=true;event('parent-signalled',{pid:stoppedIdentity.pid,signal:record.mode});
   if(record.mode==='SIGKILL'){
    for(const child of guarded.python){const current=processes().find(p=>p.pid===child.pid);if(!current)continue;assert(identical(current,child)&&[stoppedIdentity.pid,1].includes(current.ppid),'OWNED_CHILD_CHANGED_BEFORE_SIGNAL');process.kill(child.pid,'SIGTERM');event('owned-python-signalled',{kind:child.kind,pid:child.pid,signal:'SIGTERM'});}
   }
   await waitGone(stoppedIdentity,60000);for(const child of [...guarded.python,...guarded.passiveChildren])await waitGone(child,10000);
   const exited=await proof(body,'parent-exited');record.afterExit=exited;record.outcome=exited.nativeProven?'post-commit-restart':'committed-claim-unproved-at-parent-exit';event(record.outcome,{signal:record.mode,claimId:exited.claimId,nativeProven:exited.nativeProven});
   await restart();await login();const recovered=await exactGet(body,'after-restart');record.afterRestart=recovered.value;
   if(recovered.proof.nativeProven){record.outcome='post-commit-restart';assert.equal(recovered.proof.nativeAuditCount,1);assert.equal(recovered.proof.reviewCount,1);}
   else if(recovered.proof.leaseUntil>Date.now()){assert.equal(recovered.value.status,'processing');assert.equal(recovered.value.canContinue,false);record.unexpiredLeaseObserved=true;}
   else record.unexpiredLeaseObserved=false;
   record.explicitResumeRequired=!recovered.proof.nativeProven;await postPromise;save();
  }else{
   ownedRuntime(record.restartedRuntime);await login();const oldBody=record.initialStep,old=await exactGet(oldBody,'before-explicit-resume');
   assert(!old.proof.nativeProven,'ORIGINAL_NATIVE_ALREADY_PROVED_NO_NEW_POST');assert(old.proof.claimCommitted&&old.proof.leaseUntil<=Date.now(),'LEASE_NOT_EXPIRED_NO_POST');assert.equal(old.value.status,'ready');assert.equal(old.value.canContinue,true);
   const body={requestKey:'restart-resume-'+randomUUID(),expectedStateHash:old.value.stateHash,limit:1};record.resumeAttempt={body,authorizedBy:'explicit --phase resume --resume-expired-step',at:new Date().toISOString()};save();
   const returned=assertOperation(await request(opPath+'/process',{method:'POST',body}));record.resumeResponse=returned;assert.equal(returned.stepReceipt?.requestKey,body.requestKey);assert.equal(returned.stepReceipt.runId,old.proof.runId);
   const after=await exactGet(body,'resumed-step'),original=await exactGet(oldBody,'original-step-after-resume');assert(after.proof.nativeProven&&original.proof.nativeProven);assert.equal(after.proof.nativeKey,old.proof.nativeKey);assert.equal(after.proof.runId,old.proof.runId);assert.equal(after.proof.nativeAuditCount,1);assert.equal(after.proof.reviewCount,1);assert.equal(original.proof.nativeAuditId,after.proof.nativeAuditId);assert.equal(original.proof.claimHash,old.proof.claimHash);
   record.recoveredExactlyOnce=true;record.explicitResumeRequired=false;record.outcome='durable-claim-restored-with-one-native-review';event(record.outcome,{runId:after.proof.runId,nativeAuditId:after.proof.nativeAuditId});
  }
 }catch(error){record.failure={at:new Date().toISOString(),name:error.name,code:String(code(error)).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]').slice(0,1200)};save();throw error;}
 finally{
  if(needRestore&&stoppedIdentity){try{await waitGone(stoppedIdentity,1000);for(const child of [...record.ownedBefore.python,...record.ownedBefore.passiveChildren])await waitGone(child,1000);await restart();}catch(error){record.restoreFailure={code:String(code(error)).slice(0,500)};save();}}
  if(postPromise)await postPromise;
  if(db)await db.$disconnect();record.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({record:directory+'run.json',outcome:record.outcome??'blocked',failure:record.failure??null,recoveredExactlyOnce:record.recoveredExactlyOnce??false}));
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({failed:true,code:String(code(error)).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]').slice(0,1200)}));process.exitCode=1;});
