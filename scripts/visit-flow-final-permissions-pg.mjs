// Root-only native PG probe. Importing performs no configuration, database or HTTP I/O.
// Every native write is inside one transaction that must abort, including on success.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const workspace='/Users/mac/aisciencesys/';
const repo=workspace+'researchhub/';
const purpose='visit-flow-final-acceptance-2026-11-17';
const privateDir=workspace+'.tmp/'+purpose+'/';
const oldPrivate=workspace+'.tmp/visit-capture-review-flow-2026-11-16/';
const output=repo+'docs/testing/evidence/'+purpose+'/permissions-pg/';
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=path=>JSON.parse(readFileSync(path,'utf8'));

export function requirePermissionsWindow(args,env=process.env){
 assert.deepEqual(args,['--local-synthetic','--rollback-only']);
 assert.equal(env.VISIT_FLOW_FINAL_QA_WINDOW,'explicit','EXPLICIT_FINAL_VISIT_WINDOW_REQUIRED');
}

/** A unique, private abort object proves that the successful callback did not commit. */
export async function rollbackOnly(transaction,operation){
 const abort=Error('EXPECTED_FINAL_PERMISSION_PROBE_ROLLBACK');
 let value,aborted=false;
 try{await transaction(async tx=>{value=await operation(tx);throw abort;});}
 catch(error){if(error!==abort)throw error;aborted=true;}
 assert(aborted,'ROLLBACK_NOT_OBSERVED');
 return value;
}

export function assertUnchangedSnapshots(before,after){
 assert.deepEqual(after,before,'ROLLBACK_STATE_CHANGED');
}

const quoted=value=>{assert.match(value,/^[A-Za-z_][A-Za-z0-9_]*$/);return '"'+value+'"';};
// Only hashes leave PostgreSQL; full account rows (including credentials) are never returned.
async function rowHashes(tx,table,where,values){
 return (await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS digest FROM public.'+quoted(table)+' t WHERE '+where+' ORDER BY digest',...values)).map(row=>row.digest);
}

async function snapshot(tx,scope,subjectId,accountIds){
 const [enrollments,visits,assignments,participants]=await Promise.all([
  tx.studyEnrollment.findMany({where:{...scope,subjectId},select:{id:true}}),
  tx.subjectVisit.findMany({where:{...scope,subjectId},select:{id:true}}),
  tx.formAssignment.findMany({where:{...scope,subjectId},select:{id:true}}),
  tx.participant.findMany({where:{...scope,subjectId},select:{id:true}}),
 ]);
 const assignmentIds=assignments.map(x=>x.id);
 const responses=await tx.formResponse.findMany({where:{...scope,assignmentId:{in:assignmentIds}},select:{id:true}});
 const revisions=await tx.formResponseRevision.findMany({where:{...scope,subjectId},select:{id:true}});
 const parents={subjectId:[subjectId],enrollmentId:enrollments.map(x=>x.id),subjectVisitId:visits.map(x=>x.id),assignmentId:assignmentIds,responseId:responses.map(x=>x.id),revisionId:revisions.map(x=>x.id),participantId:participants.map(x=>x.id)};
 const tables=await tx.$queryRawUnsafe(`SELECT c.relname AS name,array_agg(a.attname ORDER BY a.attname)::text[] AS columns FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname='public' AND c.relkind IN ('r','p') GROUP BY c.relname ORDER BY c.relname`);
 const projectTables=[],subjectRelatedTables=[];
 for(const table of tables){
  if(['tenantId','studyGroupId','researchProjectId'].every(key=>table.columns.includes(key))){
   // A full synthetic project is a strict superset of the complete target subject.
   const where=table.name==='audit_log'?'"tenantId"=$1 AND "studyGroupId"=$2':'"tenantId"=$1 AND "studyGroupId"=$2 AND "researchProjectId"=$3';
   projectTables.push({table:table.name,rows:await rowHashes(tx,table.name,where,table.name==='audit_log'?[scope.tenantId,scope.studyGroupId]:Object.values(scope))});
  }else{
   // Also cover subject children whose legacy tables lack all three scope columns.
   const links=Object.entries(parents).filter(([column])=>table.columns.includes(column));
   if(links.length)subjectRelatedTables.push({table:table.name,rows:await rowHashes(tx,table.name,links.map(([column],i)=>quoted(column)+'=ANY($'+(i+1)+'::text[])').join(' OR '),links.map(([,ids])=>ids))});
  }
 }
 const authority={
  accounts:await rowHashes(tx,'account','id=ANY($1::text[])',[accountIds]),
  groupMemberships:await rowHashes(tx,'study_group_membership','"accountId"=ANY($1::text[])',[accountIds]),
  projectMemberships:await rowHashes(tx,'research_project_membership','"accountId"=ANY($1::text[])',[accountIds]),
  roles:await rowHashes(tx,'permission_role','id IN (SELECT "roleId" FROM public.study_group_membership WHERE "accountId"=ANY($1::text[]))',[accountIds]),
  accountCapabilities:await rowHashes(tx,'account_capability','"accountId"=ANY($1::text[])',[accountIds]),
  features:await rowHashes(tx,'tenant_feature_entitlement','"tenantId"=$1',[scope.tenantId]),
 };
 return {projectTables,subjectRelatedTables,authority};
}

async function principals(tx,scope,fixture){
 const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id='rh-kb-local-b0e2af9d'`;
 assert.equal(marker?.manifest?.syntheticOnly,true,'SYNTHETIC_RUNTIME_MARKER_REQUIRED');
 assert.equal(marker.manifest.ids.tenant,scope.tenantId);
 const [studyMarker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${fixture.runId}`;
 assert.equal(studyMarker?.manifest?.syntheticOnly,true,'SYNTHETIC_STUDY_MARKER_REQUIRED');
 assert.equal(studyMarker.manifest.tenantId,scope.tenantId);assert.equal(studyMarker.manifest.studyGroupId,scope.studyGroupId);
 const ids={admin:marker.manifest.ids.admin,collector:fixture.accounts.collector.id,reviewer:fixture.accounts.reviewer.id};
 assert.equal(new Set(Object.values(ids)).size,3,'THREE_ORIGINAL_DISTINCT_ACTORS_REQUIRED');
 const result={};
 for(const [name,id] of Object.entries(ids)){
  const account=await tx.account.findFirst({where:{tenantId:scope.tenantId,id},select:{id:true,tenantId:true,status:true,role:true,isTenantAdmin:true,authVersion:true}});
  assert.equal(account?.status,'active','ORIGINAL_ACCOUNT_NOT_ACTIVE:'+name);
  assert(Number.isSafeInteger(account.authVersion));
  result[name]={...scope,accountId:account.id,role:account.role,isTenantAdmin:account.isTenantAdmin,authVersion:account.authVersion};
 }
 assert.equal(result.admin.role,'tenant_admin');assert.equal(result.admin.isTenantAdmin,true);
 return result;
}

async function rejectedWithoutWrites(tx,scope,subjectId,accountIds,action,status,code){
 const before=await snapshot(tx,scope,subjectId,accountIds);
 let response;
 await assert.rejects(action,error=>{
  response=error.getResponse?.()??error.response;
  return error.getStatus?.()===status&&response?.code===code;
 });
 assertUnchangedSnapshots(before,await snapshot(tx,scope,subjectId,accountIds));
 return {status,code:response.code,nativeRowsUnchanged:true};
}

export async function runFinalPermissionProbe(){
 requirePermissionsWindow(process.argv.slice(2));
 const {validateFixture,save}=await import('./visit-workflow-qa.mjs');
 const fixture=json(oldPrivate+'fixture.json');validateFixture(fixture);assert(fixture.ready);
 const checkpoint=json(privateDir+'checkpoint.json');
 assert.equal(checkpoint.purpose,purpose);assert.equal(checkpoint.syntheticOnly,true);
 assert.match(checkpoint.runId,/^rh-visit-final-[a-f0-9]{8}$/);
 const target=checkpoint.cases?.SELF;
 assert(target?.subject?.id&&target.baseline,'FINAL_SELF_BASELINE_REQUIRED');
 assert(target.subject.subjectId?.startsWith('SYNTHETIC-'+checkpoint.runId+'-SELF'),'NEW_SYNTHETIC_SELF_SUBJECT_REQUIRED');
 assert(!existsSync(output+'result.json'),'PROBE_ALREADY_COMPLETED_DO_NOT_REPLAY');
 const scope={tenantId:fixture.scope.tenantId,studyGroupId:fixture.scope.studyGroupId,researchProjectId:fixture.scope.researchProjectId};
 const {fixtureEnvironment}=await import('./research-creation-fixture.mjs');
 const {assertFixtureTarget,fixtureClient,validateFixtureConfig,checkFixtureIdentity,readFixtureIdentity}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const env=fixtureEnvironment(),config=validateFixtureConfig(env);
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 const client=fixtureClient(config.directUrl);
 const transaction=(operation,{readOnly=false}={})=>client.$transaction(async tx=>{
  if(readOnly)await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  await tx.$executeRawUnsafe('SET LOCAL statement_timeout=10000');
  checkFixtureIdentity(config,'direct',await readFixtureIdentity(tx));
  await tx.$executeRaw`SELECT set_config('app.tenant_id',${scope.tenantId},true),set_config('app.study_group_id',${scope.studyGroupId},true),set_config('app.research_project_id',${scope.researchProjectId},true)`;
  return operation(tx);
 },{maxWait:8000,timeout:180000});
 const {runtimeDependencies}=await import('../server/research-runtime/dependencies.mjs');
 const {load}=runtimeDependencies();
 const Operations=load('study-operations/study-operations.service','StudyOperationsService');
 const native={
  assign:load('study-operations/formal-response-assignment','assignVisitFormInTransaction'),
  write:load('study-operations/formal-response-commands','writeAnswersInTransaction'),
  read:load('study-operations/formal-response-query','readFormalResponseInTransaction'),
  review:load('study-operations/formal-response-review','reviewFormalResponseInTransaction'),
  visit:load('study-operations/formal-response-visits','readFormalVisitInTransaction'),
  authorize:load('study-operations/formal-response-authority','authorizeFormalResponse'),
  participation:load('study-operations/participation-events','participationContext'),
  recordParticipation:load('study-operations/participation-events','recordParticipationInTransaction'),
 };
 const sourcePaths=['app/server/src/study-operations/formal-response-authority.ts','app/server/src/study-operations/formal-response-query.ts','app/server/src/study-operations/formal-response-review.ts','app/server/src/study-operations/formal-response-visits.ts','app/server/src/study-operations/formal-response-assignment.ts','app/server/src/study-operations/formal-response-commands.ts','app/server/src/study-operations/participation-events.ts','app/server/src/study-operations/study-operations.service.ts'];
 const sourceHashes=()=>Object.fromEntries(sourcePaths.map(path=>[path,sha(readFileSync(workspace+path))]));
 const sources=sourceHashes();
 let before,after,observations,actors,failure;
 try{
  actors=await transaction(tx=>principals(tx,scope,fixture),{readOnly:true});
  const accountIds=Object.values(actors).map(actor=>actor.accountId);
  before=await transaction(tx=>snapshot(tx,scope,target.subject.id,accountIds),{readOnly:true});
  save(output+'before.json',before);
  try{
   observations=await rollbackOnly(transaction,async tx=>{
    assert.deepEqual(await principals(tx,scope,fixture),actors,'ORIGINAL_AUTHORITY_CHANGED');
    assertUnchangedSnapshots(before,await snapshot(tx,scope,target.subject.id,accountIds));
    const participation=await native.participation(tx,actors.admin,scope,target.subject.id);
    const dataUse=participation.events.filter(event=>event.kind==='data_use_consent').at(-1);
    let transientDataUseRegrant=false;
    if(dataUse?.decision==='withdrawn'){
     // Only the exact software withdrawal from this run can be superseded, and only transiently.
     assert.equal(checkpoint.selfWithdrawal?.state,'recorded','SELF_WITHDRAWAL_NOT_RECONCILED');
     assert.equal(dataUse.evidence,'合成用途撤回拒绝分支验收','UNEXPECTED_WITHDRAWAL_MUST_NOT_BE_CHANGED');
     assert.equal(participation.policy.id,fixture.policy.id);assert.equal(participation.policy.contentHash,fixture.policy.contentHash);
     await native.recordParticipation(tx,actors.admin,scope,target.subject.id,{kind:'data_use_consent',decision:'granted',effectiveAt:new Date().toISOString(),signer:'软件合成授权主体',scope:participation.policy.sections.dataUse.rules.scope,evidence:'仅此回滚事务构造权限反例；原用途撤回在回滚后保持'});
     transientDataUseRegrant=true;
    }else assert.equal(dataUse?.decision,'granted','SYNTHETIC_DATA_USE_MUST_BE_GRANTED_OR_EXACT_QA_WITHDRAWAL');
    const initial=await native.visit(tx,actors.collector,scope,target.baseline);
    assert.equal(initial.subject.id,target.subject.id);assert.equal(initial.visitPlan.code,'BASELINE');
    assert(['planned','in_progress'].includes(initial.status),'SELF_STATUS_NOT_SUPPORTED_STOP_FOR_RECONCILIATION');
    assert(initial.assignments.length<=2&&initial.assignments.every(assignment=>[fixture.refs.phq,fixture.refs.fang].includes(assignment.formVersionId)),'UNEXPECTED_SELF_ASSIGNMENTS_STOP_FOR_RECONCILIATION');
    assert.equal(initial.actualCompletedAt,null);
    const operations=new Operations({});
    if(initial.status==='planned'){
     assert.equal(initial.capabilities.canStart,true,'SELF_CURRENT_CAPTURE_GATES_MUST_BE_READY');
     await operations.updateVisitInTransaction(tx,actors.collector,target.baseline,{status:'in_progress',expectedVersion:initial.version},scope.studyGroupId,scope.researchProjectId);
    }
    const assignments={};
    for(const kind of ['phq','fang','hamd']){
     const assignment=initial.assignments.find(item=>item.formVersionId===fixture.refs[kind])??await native.assign(tx,actors.collector,scope,target.baseline,fixture.refs[kind]);
     assignments[kind]=assignment.id;
     const current=await native.read(tx,actors.collector,scope,assignment.id);
     assert.equal(current.response.locked,false);assert.equal(current.response.review,null);
     if(current.response.status==='draft'){
      assert.equal(current.response.version,0);assert.deepEqual(current.response.answers,{});
      const submitted=await native.write(tx,actors.collector,scope,assignment.id,{kind:'submit',requestKey:randomUUID(),expectedVersion:current.response.version,answers:fixture.answers[kind]});
      assert.equal(submitted.ref.revisionNo,1);
     }else{
      assert.equal(kind,'phq','ONLY_KNOWN_SELF_PHQ_MAY_ALREADY_BE_SUBMITTED');
      assert.equal(current.response.status,'submitted');assert.equal(current.response.ref.revisionNo,1);
      assert.deepEqual(current.response.answers,fixture.answers[kind]);
      const revision=await tx.formResponseRevision.findFirst({where:{...scope,responseId:current.response.id,revisionNo:1},select:{actorKind:true,actorId:true}});
      assert.equal(revision?.actorKind,'account');assert.equal(revision.actorId,actors.reviewer.accountId);
     }
    }
    const fresh=(actor,id)=>native.read(tx,actor,scope,id);
    const act=async(actor,id,kind)=>{const current=await fresh(actor,id);return native.review(tx,actor,scope,id,{kind,requestKey:randomUUID(),expectedVersion:current.response.version,expectedRef:current.response.ref});};
    const unapproved=await fresh(actors.reviewer,assignments.fang);
    assert.equal(unapproved.response.review,null);assert.equal(unapproved.capabilities.canReview,true);assert.equal(unapproved.capabilities.canLock,false);
    const prematureLock=await rejectedWithoutWrites(tx,scope,target.subject.id,accountIds,()=>act(actors.reviewer,assignments.fang,'lock'),409,'FORM_REVIEW_REQUIRED');
    await act(actors.reviewer,assignments.fang,'review_approved');
    const approved=await fresh(actors.reviewer,assignments.fang);assert.equal(approved.capabilities.canLock,true);
    const stateLimited={classification:'state_not_permission',sameStudyReviewAuthority:true,before:{canReview:true,canLock:false,latestReview:null},prematureLock,afterApproval:{canLock:true},assignmentId:assignments.fang};

    const optional=await native.assign(tx,actors.reviewer,scope,target.baseline,fixture.refs.legacy);
    await native.write(tx,actors.reviewer,scope,optional.id,{kind:'submit',requestKey:randomUUID(),expectedVersion:0,answers:fixture.answers.legacy});
    await act(actors.admin,optional.id,'review_approved');
    const own=await fresh(actors.reviewer,optional.id);
    assert.equal(own.capabilities.disableReasons.review,'FORM_INDEPENDENT_REVIEW_REQUIRED');
    assert.equal(own.capabilities.canReview,false);assert.equal(own.capabilities.canLock,true);
    const selfReview=await rejectedWithoutWrites(tx,scope,target.subject.id,accountIds,()=>act(actors.reviewer,optional.id,'review_approved'),409,'FORM_INDEPENDENT_REVIEW_REQUIRED');
    const locked=await act(actors.reviewer,optional.id,'lock');assert.equal(locked.locked,true);
    const independenceLimited={classification:'independent_review_policy_not_separate_lock_role',assignmentId:optional.id,author:actors.reviewer.accountId,approver:actors.admin.accountId,locker:actors.reviewer.accountId,canReview:false,canLock:true,selfReview,lockSucceeded:true};

    for(const id of Object.values(assignments)){
     const current=await fresh(actors.reviewer,id);
     // The existing SELF PHQ may be reviewer-authored; original admin is independent of both authors.
     if(current.response.review!=='review_approved')await act(actors.admin,id,'review_approved');
     await act(actors.reviewer,id,'lock');
    }
    const ready=await native.visit(tx,actors.admin,scope,target.baseline);
    assert.equal(ready.capabilities.canComplete,true,'CONTROL_MUST_BE_FULLY_READY_BEFORE_PERMISSION_PROBE');
    const collector=await native.visit(tx,actors.collector,scope,target.baseline);
    assert.equal(collector.status,ready.status);assert.equal(collector.version,ready.version);
    assert.equal(collector.capabilities.canComplete,false);
    const noAuthority=await rejectedWithoutWrites(tx,scope,target.subject.id,accountIds,()=>native.authorize(tx,actors.collector,scope.studyGroupId,scope.researchProjectId,'study.review'),403,'RESEARCH_FORBIDDEN');
    const completeDenied=await rejectedWithoutWrites(tx,scope,target.subject.id,accountIds,()=>operations.completeVisitInTransaction(tx,actors.collector,target.baseline,{expectedVersion:collector.version},scope.studyGroupId,scope.researchProjectId),403,'RESEARCH_FORBIDDEN');
    const permitted=await operations.completeVisitInTransaction(tx,actors.admin,target.baseline,{expectedVersion:ready.version},scope.studyGroupId,scope.researchProjectId);
    assert.equal(permitted.status,'completed');assert(permitted.actualCompletedAt);
    const permissionDenied={classification:'true_permission_gate',sharedCurrentVisitVersion:ready.version,controlActor:actors.admin.accountId,controlCanComplete:true,deniedActor:actors.collector.accountId,deniedCanComplete:false,noStudyReviewAuthority:noAuthority,completionDenied:completeDenied,controlCompletionExecutedInsideRollback:true};
    return {stateLimited,independenceLimited,permissionDenied,startingState:{status:initial.status,existingAssignments:initial.assignments.length,transientDataUseRegrant},transientNativeCounts:{mandatoryForms:3,optionalForms:1},allWritesRolledBack:true};
   });
  }catch(error){failure=error;}
  // Reconcile even a failed callback. No successful probe is reported without this check.
  after=await transaction(tx=>snapshot(tx,scope,target.subject.id,accountIds),{readOnly:true});
  save(output+'after.json',after);assertUnchangedSnapshots(before,after);
  assert.deepEqual(sourceHashes(),sources,'NATIVE_SOURCE_CHANGED_DURING_PROBE');
  if(failure)throw failure;
  const result={purpose,at:new Date().toISOString(),passed:true,syntheticOnly:true,checkpointRunId:checkpoint.runId,studyId:fixture.study.id,subjectId:target.subject.id,visitId:target.baseline,actors:Object.fromEntries(Object.entries(actors).map(([name,user])=>[name,{accountId:user.accountId,authVersion:user.authVersion}])),coverage:observations,rollbackVerified:true,beforeHash:sha(JSON.stringify(before)),afterHash:sha(JSON.stringify(after)),projectScopeSupersetHashed:true,originalThreeAccountsMembershipsAndRolesUnchanged:true,sourceHashes:sources,createdStudy:0,createdAccount:0,createdRole:0,persistentWrites:0,httpExecuted:false,browserExecuted:false,clinicalValidation:false,productionDeployment:false,qualification:'Fresh native PostgreSQL transaction proof. Review/lock/complete share study.review; state and independent-review capabilities are explicitly not represented as new IAM roles. Local synthetic SELF only; no HTTP/UI claim.'};
  save(output+'result.json',result);
  console.log(JSON.stringify({passed:true,rollbackVerified:true,coverage:['stateLimited','independenceLimited','permissionDenied'],result:output+'result.json'}));
  return result;
 }catch(error){save(output+'failure.json',{at:new Date().toISOString(),purpose,message:error.message,observations:observations??null,beforeHash:before?sha(JSON.stringify(before)):null,afterHash:after?sha(JSON.stringify(after)):null,rollbackVerified:Boolean(before&&after&&JSON.stringify(before)===JSON.stringify(after)),passed:false});throw error;}
 finally{await client.$disconnect();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runFinalPermissionProbe();
