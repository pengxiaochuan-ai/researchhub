// Run only after root confirms the shared backend has the ResearchHub policy.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {openHarness,key,json,sha,save,privateDir,evidenceDir,purpose} from './study-form-runtime.mjs';
import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic','--backend-ready']);
assert(!existsSync(evidenceDir+'http-result.json'),'DO_NOT_REPEAT_ACCEPTED_CAPTURE');
const h=await openHarness(),f=json(privateDir+'fixture.json'),root='/research-studies/'+f.study.id,checks=[],results={};
assert(f.syntheticOnly&&f.protocolReady&&f.answers);const profile=getSourceFormProfile('phq9-zh-CN-v1');
await h.read(async tx=>{const [row]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${f.runId}`;assert.equal(row.manifest.purpose,purpose);assert.equal(row.manifest.studyId,f.study.id);});
const assignmentPath=id=>root+'/assignments/'+id;
const revisionPath=(id,ref)=>assignmentPath(id)+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash});
async function assign(caseName,formId){
 const sample=f.cases[caseName],visit=(await h.get(root+'/visits/'+sample.visitId)).visit;
 if(visit.status==='scheduled')await h.post(root+'/visits/'+visit.id+'/start',{requestKey:key(),expectedVersion:visit.version});
 const created=await h.post(root+'/visits/'+sample.visitId+'/assignments',{requestKey:key(),formVersionId:formId});return created.result.id;
}
try{
 const onsite=f.cases.ONSITE;
 const onsiteVisit=(await h.get(root+'/visits/'+onsite.visitId)).visit;
 const onsiteAssignment=onsiteVisit.assignments.find(row=>row.formVersionId===f.refs.form);assert(onsiteAssignment,'PARENT_BROWSER_ONSITE_SUBMISSION_REQUIRED');
 onsite.assignmentId=onsiteAssignment.id;save(privateDir+'fixture.json',f);
 const path=assignmentPath(onsite.assignmentId);let view=await h.get(path);
 assert.deepEqual(view.assignment.formVersion.schema.presentation,profile.schema.presentation);
 assert.deepEqual(view.assignment.formVersion.schema.fields,profile.schema.fields);
 checks.push('live_fixed_profile_question_choice_labels_presentation_exact');
 assert.equal(view.response.status,'submitted','PARENT_BROWSER_ONSITE_SUBMISSION_REQUIRED');
 for(const answers of [{...f.answers.ONSITE,phq9_q1:4},{...f.answers.ONSITE,functional_difficulty:'invalid-choice'}]){
  const version=view.response.version;
  await h.request(path+'/correct',{method:'POST',status:400,body:{requestKey:key(),expectedVersion:version,expectedRef:view.response.ref,reason:'合成非法选项拒绝核对',answers}});
  const after=await h.get(path);assert.equal(after.response.version,version);assert.deepEqual(after.response.ref,view.response.ref);
 }
 checks.push('invalid_numeric_and_select_choices_rejected_without_revision');
 view=await h.get(path);assert.equal(view.response.score.total,f.expectedScores.ONSITE);assert.equal(view.response.ref.revisionNo,1);
 const original=(await h.get(revisionPath(onsite.assignmentId,view.response.ref))).revision;assert.deepEqual(original.answers,f.answers.ONSITE);assert.equal(original.score.total,f.expectedScores.ONSITE);assert.equal(original.source,'researcher');
 assert.match(original.ref.contentHash,/^[a-f0-9]{64}$/);assert.deepEqual(original.ref,view.response.ref);
 await h.request(revisionPath(onsite.assignmentId,{...original.ref,contentHash:'f'.repeat(64)}),{status:[404,409]});
 const correctedAnswers={...f.answers.ONSITE,phq9_q1:3};
 const correctionBody={requestKey:key(),expectedVersion:view.response.version,expectedRef:view.response.ref,reason:'独立合成来源核对后修订',answers:correctedAnswers};
 const corrected=await h.post(path+'/correct',correctionBody);assert.deepEqual(await h.post(path+'/correct',correctionBody),corrected);
 view=await h.get(path);assert.equal(view.response.ref.revisionNo,2);assert.equal(view.response.score.total,f.expectedScores.ONSITE+3);assert.notEqual(view.response.ref.contentHash,original.ref.contentHash);
 assert.deepEqual((await h.get(revisionPath(onsite.assignmentId,original.ref))).revision,original);
 results.onsite={assignmentId:onsite.assignmentId,original,corrected:(await h.get(revisionPath(onsite.assignmentId,view.response.ref))).revision};
 checks.push('onsite_browser_submission_readback_score_fixed_hash_idempotent_correction_preserves_original');
 const h5Path=assignmentPath(f.cases.H5.assignmentId),h5View=await h.get(h5Path);assert.equal(h5View.response.status,'submitted','PARENT_BROWSER_H5_SUBMISSION_REQUIRED');assert.deepEqual(h5View.response.answers,f.answers.H5);assert.equal(h5View.response.score.total,f.expectedScores.H5);
 const h5Revision=(await h.get(revisionPath(f.cases.H5.assignmentId,h5View.response.ref))).revision;assert.equal(h5Revision.source,'patient_h5');assert.equal(h5Revision.actorKind,'h5_session');assert.equal(h5Revision.score.total,f.expectedScores.H5);assert.deepEqual(h5Revision.answers,f.answers.H5);results.h5={assignmentId:f.cases.H5.assignmentId,revision:h5Revision};checks.push('original_h5_browser_submission_exact_answers_score_source_hash_http_readback');
 const legacyId=await assign('ONSITE',f.refs.legacy),legacyPath=assignmentPath(legacyId),legacyAnswers={value:0,optional_value:null,completed:false};
 const legacyView=await h.get(legacyPath);await h.post(legacyPath+'/submit',{requestKey:key(),expectedVersion:legacyView.response.version,answers:legacyAnswers});
 const legacy=await h.get(legacyPath);assert.deepEqual(legacy.response.answers,legacyAnswers);assert.equal(legacy.response.score,null);results.legacy={assignmentId:legacyId,response:legacy.response};checks.push('original_legacy_schema_zero_false_null_preserved_unscored');
 const csv=readFileSync(f.csvPath,'utf8'),body={formVersionId:f.refs.form,csv};
 const preview=await h.post(root+'/imports/preview',body);assert.deepEqual(preview.errors,[]);assert(preview.previewHash);
 const importBody={...body,requestKey:key(),previewHash:preview.previewHash},committed=await h.post(root+'/imports',importBody);assert.deepEqual(await h.post(root+'/imports',importBody),committed);assert.equal(committed.source.csvSha256,sha(csv));
 assert.equal(committed.rows.length,1);const row=committed.rows[0];f.cases.CSV.assignmentId=row.assignmentId;
 const imported=(await h.get(revisionPath(row.assignmentId,row.ref))).revision;assert.deepEqual(imported.answers,f.answers.CSV);assert.equal(imported.score.total,f.expectedScores.CSV);assert.equal(imported.source,'researcher');
 results.csv={receipt:committed,revision:imported};checks.push('csv_real_preview_commit_idempotency_source_sha_score_fixed_revision');
 const database=await h.read(async tx=>{
  const forms=await tx.formVersion.findMany({where:{...f.scope,id:{in:[f.refs.form,f.refs.legacy]}},select:{id:true,schema:true,scoring:true}});
  assert.equal(forms.length,2);assert.deepEqual(forms.find(row=>row.id===f.refs.form).schema,view.assignment.formVersion.schema);
  const rows=await tx.$queryRaw`SELECT * FROM public.form_response_revision WHERE "tenantId"=${f.scope.tenantId} AND "researchProjectId"=${f.scope.researchProjectId} ORDER BY "assignmentId","revisionNo"`;
  const verify=runtimeDependencies().load('study-operations/formal-response-history','verifyFormalRevisionEnvelope');
  const revisions=rows.map(row=>verify(row));assert.equal(revisions.length,5);
  assert(revisions.some(row=>row.ref.contentHash===original.ref.contentHash&&row.ref.revisionNo===1));assert(revisions.some(row=>row.ref.contentHash===h5Revision.ref.contentHash&&row.source==='patient_h5'));
  return {forms,revisions,allEnvelopesRehashed:true};
 });
 checks.push('guarded_pg_live_schema_and_immutable_revision_rows_match_http');
 f.httpReady=true;f.results=results;save(privateDir+'fixture.json',f);save(evidenceDir+'fixture.json',f);
 save(evidenceDir+'http-result.json',{passed:true,at:new Date().toISOString(),syntheticOnly:true,studyId:f.study.id,checks,results,database,network:h.network,h5Acceptance:'original real browser submission read back and verified; transport only uses explicitly synthetic accepted receipt',emailSent:false,clinicalAcceptance:false,productionAcceptance:false});
 console.log(JSON.stringify({passed:true,checks,evidence:evidenceDir+'http-result.json'}));
}catch(error){save(evidenceDir+'http-failure.json',{passed:false,at:new Date().toISOString(),studyId:f.study.id,message:String(error.message).slice(0,1500),checks,network:h.network});throw error;}
