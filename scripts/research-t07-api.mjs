// Actual ResearchHub API and PostgreSQL-backed capture, no patient data or external messages.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const accepted=JSON.parse(readFileSync(JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t06-current.json')).acceptedFile));assert(accepted.syntheticOnly&&accepted.runId.startsWith('rh-t06-http-'));
const cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json'));
const runId='rh-t07-http-'+randomUUID().slice(0,8),base='http://127.0.0.1:19501',root='/research-studies/'+accepted.study.id,out=workspaceRoot+'researchhub/docs/testing/evidence/research-t07-2026-11-12/'+runId+'/';mkdirSync(out,{recursive:true});
const network=[],checks=[],key=()=>randomUUID();let stage='preflight';
async function request(path,{method='GET',body,status=200,role='admin'}={}){
 const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies[role]??'',Origin:base,Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>null);network.push({at:new Date().toISOString(),stage,role,path,method,status:r.status});assert((Array.isArray(status)?status:[status]).includes(r.status),JSON.stringify({stage,path,status:r.status,code:data?.code,message:data?.message}));return {data,status:r.status};
}
const get=async(path,options)=>(await request(path,options)).data,post=async(path,body,options)=>(await request(path,{...options,method:'POST',body})).data;
try{
 await withFixtureTransaction(env,'direct',async tx=>{const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${accepted.runId}`;assert.equal(marker.manifest.syntheticOnly,true);assert.equal(marker.manifest.studyId,accepted.study.id);});
 await get(root+'/visits?limit=1');
 const release=await get(root+'/protocols/'+accepted.protocolId+'/release'),policy=release.policy;assert.equal(release.protocol.status,'executing');
 async function createSubject(suffix){
  const created=await post(root+'/subjects',{requestKey:key(),subjectId:'SYNTHETIC-'+suffix+'-'+runId.slice(-8)}),path=root+'/subjects/'+created.subject.id+'/participation';
  const facts=[{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成授权主体',textVersion:policy.sections.researchConsent.rules.textVersion},{kind:'data_use_consent',decision:'granted',signer:'合成授权主体',scope:policy.sections.dataUse.rules.scope}];
  for(const event of facts)await post(path+'/events',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash,event:{...event,effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'通用合成正式采集验收'}});
  await post(path+'/enroll',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash});return created.subject;
 }
 stage='enroll';const subject=await createSubject('CAPTURE'),page=await get(root+'/visits?subjectId='+subject.id+'&limit=20'),baseline=page.items.find(v=>v.visitPlan.code==='BASELINE'),pending=page.items.find(v=>v.scheduleState==='pending_anchor');assert(baseline&&pending);assert.equal(pending.capabilities.canAssign,false);assert.equal(pending.capabilities.canStart,false);
 stage='visit-start';await post(root+'/visits/'+pending.id+'/assignments',{requestKey:key(),formVersionId:accepted.refs.form},{status:409});
 const startBody={requestKey:key(),expectedVersion:baseline.version},started=await post(root+'/visits/'+baseline.id+'/start',startBody);assert.equal(started.visit.status,'in_progress');assert.deepEqual(await post(root+'/visits/'+baseline.id+'/start',startBody),started);
 checks.push('actual_new_subject_facts_enrollment_pending_anchor_rejection_and_idempotent_visit_start');
 stage='assign';const assignmentBody={requestKey:key(),formVersionId:accepted.refs.form},assigned=await post(root+'/visits/'+baseline.id+'/assignments',assignmentBody),assignmentId=assigned.result.id,a=root+'/assignments/'+assignmentId;
 assert.deepEqual(await post(root+'/visits/'+baseline.id+'/assignments',assignmentBody),assigned);await post(root+'/visits/'+baseline.id+'/assignments',{...assignmentBody,requestKey:key()},{status:409});
 assert.deepEqual(await get(root+'/visits/'+baseline.id+'/assignment-receipts/'+assignmentBody.requestKey),assigned);await get(a, {role:'owner',status:403});
 stage='draft';let view=await get(a);assert.equal(view.response.version,0);
 const zero=await post(a+'/draft',{requestKey:key(),expectedVersion:0,answers:{value:0,completed:false}});assert.equal(zero.result.answers.value,0);assert.equal(zero.result.answers.completed,false);assert.equal(zero.result.score,null);
 const races=await Promise.all([request(a+'/draft',{method:'POST',body:{requestKey:key(),expectedVersion:1,answers:{value:2,completed:false}},status:[200,409]}),request(a+'/draft',{method:'POST',body:{requestKey:key(),expectedVersion:1,answers:{value:4,completed:true}},status:[200,409]})]);assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 view=await get(a);assert.equal(view.response.version,2);await post(a+'/draft',{requestKey:key(),expectedVersion:2,answers:{value:0,completed:false}});
 const submitBody={requestKey:key(),expectedVersion:3,answers:{value:0,completed:false}},submissions=await Promise.all([post(a+'/submit',submitBody),post(a+'/submit',submitBody)]);assert.deepEqual(submissions[0],submissions[1]);assert.equal(submissions[0].result.ref.revisionNo,1);
 assert.deepEqual(await get(a+'/receipts/'+submitBody.requestKey+'?operation=submit'),submissions[0]);view=await get(a);assert.equal(view.response.score,null);assert.equal(view.response.answers.completed,false);
 checks.push('actual_zero_false_unscored_draft_two_http_cas_single_submit_revision_and_same_key_receipt');
 stage='review-complete';let visit=(await get(root+'/visits/'+baseline.id)).visit;assert.equal(visit.capabilities.canComplete,false);await post(root+'/visits/'+baseline.id+'/complete',{requestKey:key(),expectedVersion:visit.version},{status:409});
 const action=async(name,extras={})=>{const current=await get(a);return post(a+'/'+name,{requestKey:key(),expectedVersion:current.response.version,expectedRef:current.response.ref,...extras});};
 await action('review',{decision:'approved'});await action('lock');visit=(await get(root+'/visits/'+baseline.id)).visit;assert.equal(visit.capabilities.canComplete,true);
 const completeBody={requestKey:key(),expectedVersion:visit.version},completed=await post(root+'/visits/'+baseline.id+'/complete',completeBody);assert.equal(completed.visit.status,'completed');assert.deepEqual(await get(root+'/visits/'+baseline.id+'/receipts/'+completeBody.requestKey+'?operation=complete'),completed);
 const originalCompletedAt=completed.visit.actualCompletedAt;
 stage='correction-reverify';view=await get(a);await post(a+'/correct',{requestKey:key(),expectedVersion:view.response.version,expectedRef:view.response.ref,reason:'合成更正',answers:{value:1,completed:false}},{status:409});
 await action('unlock',{reason:'合成来源核对'});view=await get(a);const corrected=await post(a+'/correct',{requestKey:key(),expectedVersion:view.response.version,expectedRef:view.response.ref,reason:'合成来源核对后更正',answers:{value:1,completed:false}});assert.equal(corrected.result.ref.revisionNo,2);
 visit=(await get(root+'/visits/'+baseline.id)).visit;assert.equal(visit.completionIntegrity,'requires_review');assert.equal(visit.actualCompletedAt,originalCompletedAt);
 await action('review',{decision:'approved'});await action('lock');visit=(await get(root+'/visits/'+baseline.id)).visit;assert.equal(visit.completionIntegrity,'requires_review');assert.equal(visit.capabilities.canReverify,true);
 const reverifyBody={requestKey:key(),expectedVersion:visit.version,reason:'合成已完成访视更正复核'},verified=await post(root+'/visits/'+baseline.id+'/reverify',reverifyBody);assert.equal(verified.visit.completionIntegrity,'current');assert.equal(verified.visit.actualCompletedAt,originalCompletedAt);
 assert.deepEqual(await post(root+'/visits/'+baseline.id+'/reverify',reverifyBody),verified);assert.deepEqual(await get(root+'/visits/'+baseline.id+'/receipts/'+reverifyBody.requestKey+'?operation=reverify'),verified);
 checks.push('actual_review_lock_completion_correction_invalidates_prior_basis_and_explicit_reverify_preserves_history');
 stage='same-revision-return';await action('unlock',{reason:'合成同修订审阅撤回'});await action('review',{decision:'returned',reason:'合成复核发现待核事项'});visit=(await get(root+'/visits/'+baseline.id)).visit;assert.equal(visit.completionIntegrity,'requires_review');
 await action('review',{decision:'approved'});await action('lock');visit=(await get(root+'/visits/'+baseline.id)).visit;assert.equal(visit.completionIntegrity,'requires_review');await post(root+'/visits/'+baseline.id+'/reverify',{requestKey:key(),expectedVersion:visit.version,reason:'合成同修订重新核对'});
 checks.push('actual_same_revision_review_return_and_reapproval_require_explicit_visit_reverification');
 stage='ui-fixture';const uiSubject=await createSubject('CAPTURE-UI'),uiVisits=await get(root+'/visits?subjectId='+uiSubject.id),uiVisit=uiVisits.items.find(v=>v.visitPlan.code==='BASELINE');assert(uiVisit);
 const result={passed:true,at:new Date().toISOString(),runId,syntheticOnly:true,studyId:accepted.study.id,subject,visitId:baseline.id,assignmentId,uiSubject,uiVisitId:uiVisit.id,checks,network,h5HttpAcceptance:false,browserAcceptance:false,clinicalAcceptance:false,productionAcceptance:false};
 writeFileSync(out+'result.json',JSON.stringify(result,null,2));const privateFile=workspaceRoot+'.tmp/researchhub-workflow/t07-current.json';writeFileSync(privateFile,JSON.stringify({acceptedFile:out+'result.json'},null,2),{mode:0o600});console.log(JSON.stringify({passed:true,checks,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,at:new Date().toISOString(),stage,message:String(error.message).slice(0,1700),checks,network},null,2));console.error(JSON.stringify({passed:false,stage,message:String(error.message).slice(0,1000)}));process.exitCode=1;}
