// VC09 on the newly registered CSV case only. All business writes use real UI.
// Importing this file does not open a browser, authenticate, or touch a fixture.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {privateDir,evidenceDir,base,json,save,normalize,sha,requireQAWindow,validateFixture,sourceProfiles,loginBrowserContext} from './visit-workflow-qa.mjs';
import {preserveOld} from './visit-workflow-preserve.mjs';

export function correctionTarget(f,journal){
 validateFixture(f);assert(f.ready);assert.equal(journal.studyId,f.study.id);
 const csv=journal.cases?.CSV,completed=journal.steps?.['CSV-complete'];
 assert(csv&&completed?.status==='done','CSV_COMPLETED_CASE_REQUIRED');
 assert.equal(csv.visitId,f.cases.CSV.visitId);assert(csv.formIds?.phq);
 assert.equal(completed.value.visit.id,csv.visitId);assert.equal(completed.value.visit.status,'completed');
 assert(completed.value.visit.actualCompletedAt);
 return{visitId:csv.visitId,assignmentId:csv.formIds.phq,originalCompletedAt:completed.value.visit.actualCompletedAt,allAssignmentIds:Object.values(csv.formIds)};
}

export async function runCorrectionBrowser(){
 requireQAWindow(['--local-synthetic','--browser']);
 const resume=process.env.VISIT_WORKFLOW_QA_CORRECTION_RESUME==='after-proven-correction';
 assert(process.env.VISIT_WORKFLOW_QA_CORRECTION_RESUME===undefined||resume,'EXPLICIT_CORRECTION_RESUME_MODE_REQUIRED');
 const originalJournalPath=privateDir+'correction-browser-journal.json',sourceJournal=resume?json(originalJournalPath):null;
 const journalPath=privateDir+(resume?'correction-browser-resume-journal.json':'correction-browser-journal.json');
 assert(!existsSync(journalPath),'EXISTING_CORRECTION_UI_RUN_READONLY_RECONCILE_FIRST');
 if(resume)assert.equal(sourceJournal.status,'failed','RESUME_REQUIRES_PRESERVED_FAILED_RUN');
 const f=json(privateDir+'fixture.json'),target=correctionTarget(f,json(privateDir+'api-journal.json'));
 const {visitId,assignmentId,originalCompletedAt,allAssignmentIds}=target,root='/research-studies/'+f.study.id,vp=root+'/visits/'+visitId;
 const assignmentUrl=base+'/pages/s09/?'+new URLSearchParams({formalCapture:'1',studyId:f.study.id,visitId,assignmentId});
 const visitUrl=base+'/pages/s09/?'+new URLSearchParams({formalCapture:'1',studyId:f.study.id,visitId});
 const out=evidenceDir+(resume?'correction-browser-resume-':'correction-browser-')+randomUUID().slice(0,8)+'/',profiles=sourceProfiles();
 const fieldIndex=profiles.phq.schema.fields.findIndex(x=>x.key==='phq9_q1'),field=profiles.phq.schema.fields[fieldIndex];
 assert(field&&fieldIndex>=0);assert(field.choices?.some(x=>x.value===1),'ORIGINAL_PHQ_CHOICE_REQUIRED');
 const journal={at:new Date().toISOString(),studyId:f.study.id,visitId,assignmentId,case:'CSV',evidence:out,status:'started',resumeAfterProvenCorrection:resume,sourceJournalPath:resume?originalJournalPath:null,steps:[]};
 save(journalPath,journal,true);
 const network=[],pageErrors=[],consoleErrors=[],unexpectedDialogs=[],beforeUnloadDialogs=[],blockedWrites=[],contexts=[],closeErrors=[],checks=[];
 let stage='preflight',activePage,browser,batchId,result,failure,h,collector,oldRef,oldRevision,beforeRaw,newCapture,newRef;
 const identities=json(privateDir+'identities.json').accounts;
 function checkpoint(action,state,extra={}){journal.steps.push({at:new Date().toISOString(),stage,action,state,...extra});save(journalPath,journal);}
 const apiPath=path=>'/api'+path;
 async function rawVisit(){return h.read(async tx=>normalize(await tx.subjectVisit.findFirst({where:{...f.scope,id:visitId}})));}
 async function originalRevision(ref){return(await h.get(root+'/assignments/'+assignmentId+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}))).revision;}
 function watch(page,role){
  page.on('pageerror',e=>pageErrors.push({role,stage,message:e.message}));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push({role,stage,message:m.text(),location:m.location()});});
  page.on('dialog',d=>{if(d.type()==='beforeunload'){beforeUnloadDialogs.push({role,stage,type:d.type(),accepted:true});return void d.accept();}unexpectedDialogs.push({role,stage,type:d.type(),message:d.message()});void d.dismiss();});
  page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')){let key;try{key=r.request().postDataJSON()?.requestKey;}catch{}network.push({at:new Date().toISOString(),role,stage,method:r.request().method(),path,status:r.status(),...(key?{requestKey:key}:{})});save(out+'live-network.json',{stage,network,pageErrors,consoleErrors,unexpectedDialogs,blockedWrites});}});
 }
 async function actorPage(role){
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video-'+role,size:{width:1440,height:1000}}});contexts.push(context);
  const identity=role==='admin'?{id:h.actor.id,username:h.actor.username,password:h.runtime.password}:identities[role];assert(identity);
  save(out+'session-'+role+'-metadata.json',await loginBrowserContext(context,{tenantSlug:h.runtime.ids.tenant,username:identity.username,password:identity.password,expectedActorId:identity.id}));
  await context.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
   if(method==='GET'||method==='HEAD'||path.startsWith('/api/auth/'))return route.continue();
   const allowed=method==='POST'&&(
    !resume&&role==='admin'&&stage==='unlock'&&path===apiPath(root+'/assignments/'+assignmentId+'/unlock')||
    !resume&&role==='collector'&&stage==='correct'&&path===apiPath(root+'/assignments/'+assignmentId+'/correct')||
    role==='reviewer'&&stage==='review-new-revision'&&(path===apiPath(vp+'/workflow/batches')||path.startsWith(apiPath(vp+'/workflow/batches/'))&&path.endsWith('/advance'))||
    role==='reviewer'&&stage==='reverify'&&path===apiPath(vp+'/reverify')
   );
   if(!allowed){blockedWrites.push({role,stage,path,method});return route.abort('blockedbyclient');}
   return route.continue();
  });
  const page=await context.newPage();watch(page,role);activePage=page;return page;
 }
 async function click(page,name){await page.getByRole('button',{name,exact:true}).click();}
 async function confirm(page){await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();}
 async function openOriginalReview(page){const summary=page.locator('.fc-assignment details.fc-review > summary');await summary.waitFor();if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();}
 async function postByUI(page,path,action,confirmAction=()=>confirm(page)){
  checkpoint(action,'intent');const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===apiPath(path),{timeout:90000});
  await click(page,action);await confirmAction();const actual=await response;assert.equal(actual.status(),200,action+'_FAILED');
  let requestKey;try{requestKey=actual.request().postDataJSON()?.requestKey;}catch{}
  const value=await actual.json();checkpoint(action,'acknowledged',{path,requestKey,status:actual.status()});
  await page.getByText('已保存并核对当前状态。',{exact:true}).waitFor({timeout:90000});
  await page.waitForFunction(()=>{const main=document.querySelector('main.rh-formal-capture');return main?.getAttribute('aria-busy')==='false'&&![...main.querySelectorAll('button')].some(b=>b.textContent.trim()==='核对上次操作结果');},{},{timeout:90000});
  checkpoint(action,'ui-state-verified',{path,requestKey});return value;
 }
 try{
  const {openHarness}=await import('./full-study-runtime.mjs');h=await openHarness({privateOutputDir:privateDir+(resume?'correction-browser-resume-auth/':'correction-browser-auth/')});
  await preserveOld(h,resume?'before-correction-ui-resume':'before-correction-ui');
  const liveCapture=await h.get(root+'/assignments/'+assignmentId),liveVisit=(await h.get(vp)).visit,liveRaw=await rawVisit();
  assert.equal(liveVisit.status,'completed');assert.equal(liveVisit.actualCompletedAt,originalCompletedAt);
  assert.equal(liveCapture.assignment.formVersion.id,f.refs.phq);assert.equal(liveCapture.assignment.mode,'researcher');
  const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
  browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  if(resume){
   stage='resume-preflight';assert.equal(sourceJournal.studyId,f.study.id);assert.equal(sourceJournal.visitId,visitId);assert.equal(sourceJournal.assignmentId,assignmentId);assert.equal(sourceJournal.originalCompletedAt,originalCompletedAt);
   assert(sourceJournal.evidence.startsWith(evidenceDir+'correction-browser-')&&!sourceJournal.evidence.includes('/../'),'ORIGINAL_EVIDENCE_SCOPE_REQUIRED');
   const before=json(sourceJournal.evidence+'before-metadata.json'),priorProof=json(sourceJournal.evidence+'failure-readonly-proof.json');
   assert.equal(before.studyId,f.study.id);assert.equal(before.visitId,visitId);assert.equal(before.assignmentId,assignmentId);assert.equal(before.originalCompletedAt,originalCompletedAt);assert.deepEqual(before.ref,sourceJournal.oldRef);
   oldRef=normalize(sourceJournal.oldRef);newRef=normalize(sourceJournal.newRef);assert.equal(oldRef.revisionNo,1);assert.equal(newRef.revisionNo,2);assert.equal(oldRef.assignmentId,assignmentId);assert.equal(newRef.assignmentId,assignmentId);assert.equal(newRef.responseId,oldRef.responseId);
   assert.equal(before.answersSha256,sha(JSON.stringify(f.answers.phq)));assert.deepEqual(liveCapture.response.ref,newRef);assert.deepEqual(liveCapture.response.answers,{...f.answers.phq,[field.key]:1});assert.equal(liveCapture.response.review,null);assert.equal(liveCapture.response.locked,false);assert.equal(liveCapture.response.version,5);assert.equal(liveVisit.completionIntegrity,'requires_review');assert.deepEqual(liveRaw.evidenceRefs,before.completionEvidenceRefs);
   assert.equal(priorProof.receiptStatus,200);assert.deepEqual(priorProof.currentRef,newRef);assert.equal(priorProof.currentVersion,liveCapture.response.version);assert.equal(priorProof.oldEvidencePreserved,true);
   const writes=sourceJournal.steps.filter(s=>s.state==='acknowledged');assert.equal(writes.length,2);const correction=writes.find(s=>s.action==='核对并保存更正');assert(correction&&correction.status===200);assert.equal(correction.path,root+'/assignments/'+assignmentId+'/correct');assert.match(correction.requestKey,/^[a-f0-9-]{36}$/);
   beforeRaw={evidenceRefs:before.completionEvidenceRefs,actualCompletedAt:before.originalCompletedAt};oldRevision=await originalRevision(oldRef);assert.deepEqual(oldRevision.ref,oldRef);assert.deepEqual(oldRevision.answers,f.answers.phq);
   collector=await actorPage('collector');const receiptPath=apiPath(root+'/assignments/'+assignmentId+'/receipts/'+correction.requestKey)+'?operation=correct',receiptResponse=await collector.context().request.get(base+receiptPath);network.push({at:new Date().toISOString(),role:'collector',stage,method:'GET',path:receiptPath,status:receiptResponse.status(),transport:'native-browser-context-request'});assert.equal(receiptResponse.status(),200,'ORIGINAL_CORRECTION_RECEIPT_REQUIRED');const receipt=await receiptResponse.json();assert.equal(receipt.studyId,f.study.id);assert.equal(receipt.receipt.requestKey,correction.requestKey);assert.equal(receipt.receipt.action,'form.correct');assert.equal(receipt.receipt.targetId,assignmentId);assert.deepEqual(receipt.result.ref,newRef);assert.equal(receipt.result.version,liveCapture.response.version);assert.deepEqual(receipt.result.answers,liveCapture.response.answers);
   newCapture=liveCapture;journal.oldRef=oldRef;journal.newRef=newRef;journal.originalCompletedAt=originalCompletedAt;journal.sourceEvidence=sourceJournal.evidence;save(journalPath,journal);
   save(out+'resume-preflight-metadata.json',{at:new Date().toISOString(),studyId:f.study.id,visitId,assignmentId,sourceJournalPath:originalJournalPath,sourceEvidence:sourceJournal.evidence,sourceJournalSha256:sha(JSON.stringify(sourceJournal)),beforeMetadataSha256:sha(JSON.stringify(before)),priorReadOnlyProofSha256:sha(JSON.stringify(priorProof)),oldRef,newRef,correctRequestKey:correction.requestKey,exactOriginalReceipt200:true,currentVersion:liveCapture.response.version,answersSha256:sha(JSON.stringify(liveCapture.response.answers)),originalCompletedAt,oldEvidenceRefs:before.completionEvidenceRefs,unlockReplayed:false,correctionReplayed:false});
   checkpoint('原更正回执与固定修订只读核对','verified',{ref:newRef,requestKey:correction.requestKey});checks.push('exact_original_correction_receipt_and_revision2_proved_readonly_no_unlock_or_correction_replay');
  }else{
   const beforeCapture=liveCapture;beforeRaw=liveRaw;oldRef=normalize(beforeCapture.response.ref);assert.equal(liveVisit.completionIntegrity,'current');assert.equal(oldRef.revisionNo,1,'CSV_CASE_ALREADY_CORRECTED_DO_NOT_REPLAY');assert(beforeCapture.response.locked&&beforeCapture.response.review==='review_approved');assert.deepEqual(beforeCapture.response.answers,f.answers.phq);assert.equal(beforeCapture.response.answers[field.key],0);
   oldRevision=await originalRevision(oldRef);assert.deepEqual(oldRevision.ref,oldRef);assert.deepEqual(oldRevision.answers,beforeCapture.response.answers);assert(Array.isArray(beforeRaw.evidenceRefs)&&beforeRaw.evidenceRefs.length);journal.oldRef=oldRef;journal.originalCompletedAt=originalCompletedAt;save(journalPath,journal);
   save(out+'before-metadata.json',{studyId:f.study.id,visitId,assignmentId,originalCompletedAt,ref:oldRef,responseVersion:beforeCapture.response.version,answersSha256:sha(JSON.stringify(beforeCapture.response.answers)),completionEvidenceRefs:beforeRaw.evidenceRefs});
   stage='unlock';const admin=await actorPage('admin');await admin.goto(assignmentUrl);await openOriginalReview(admin);await admin.locator('.fc-assignment .fc-review textarea').fill('合成CSV来源复核，准备按原记录更正首项');await admin.screenshot({path:out+'01-original-locked-and-unlock-reason.png',fullPage:true});await postByUI(admin,root+'/assignments/'+assignmentId+'/unlock','解锁表单');const unlocked=await h.get(root+'/assignments/'+assignmentId);assert.equal(unlocked.response.locked,false);assert.deepEqual(unlocked.response.ref,oldRef);
   stage='correct';collector=await actorPage('collector');await collector.goto(assignmentUrl);await openOriginalReview(collector);await click(collector,'更正记录');const editor=collector.locator('.fc-field-editor');await editor.waitFor();await editor.locator('input[name="fc-field-'+fieldIndex+'"][value="1"]').check();await collector.getByLabel('更正原因',{exact:true}).fill('合成CSV原记录复核，仅将PHQ-9首项从原选项更正为相邻原表选项');
   const corrected=await postByUI(collector,root+'/assignments/'+assignmentId+'/correct','核对并保存更正',async()=>{const dialog=collector.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('tbody tr').count(),1);assert((await dialog.locator('tbody tr').innerText()).includes(field.label));await collector.screenshot({path:out+'02-one-original-phq-choice-correction-confirmation.png',fullPage:true});await dialog.getByRole('button',{name:'确认',exact:true}).click();});assert(corrected.result.ref);newCapture=await h.get(root+'/assignments/'+assignmentId);newRef=normalize(newCapture.response.ref);assert.equal(newRef.revisionNo,oldRef.revisionNo+1);assert.notEqual(newRef.contentHash,oldRef.contentHash);assert.deepEqual(newCapture.response.answers,{...beforeCapture.response.answers,[field.key]:1});assert.equal(newCapture.response.review,null);assert.equal(newCapture.response.locked,false);
   const changedVisit=(await h.get(vp)).visit,changedRaw=await rawVisit();assert.equal(changedVisit.status,'completed');assert.equal(changedVisit.completionIntegrity,'requires_review');assert.equal(changedVisit.actualCompletedAt,originalCompletedAt);assert.deepEqual(changedRaw.evidenceRefs,beforeRaw.evidenceRefs);journal.newRef=newRef;checkpoint('更正原表首项','verified',{ref:newRef,responseVersion:newCapture.response.version});checks.push('exact_one_original_phq_choice_changed_new_revision_old_completion_retained');
  }
  stage='collector-impact-readonly';const collectorWritesBefore=network.filter(x=>x.role==='collector'&&x.method==='POST'&&!x.path.startsWith('/api/auth/')).length;await collector.goto(visitUrl);await collector.getByRole('button',{name:'核对更正影响',exact:true}).waitFor();await click(collector,'核对更正影响');await collector.locator('#visit-review-content').waitFor();await collector.locator('.fc-review-items .fc-review-item').first().waitFor({timeout:90000});assert.equal(await collector.locator('.fc-review-items input[type=checkbox]').count(),0);assert.equal(network.filter(x=>x.role==='collector'&&x.method==='POST'&&!x.path.startsWith('/api/auth/')).length,collectorWritesBefore);await collector.screenshot({path:out+'03-correction-impact-collector-no-review-permission.png',fullPage:true});checks.push('collector_impact_entry_opens_readonly_without_review_selection_or_review_post');

  stage='review-new-revision';const reviewer=await actorPage('reviewer');await reviewer.goto(visitUrl);await reviewer.getByRole('button',{name:'核对更正影响',exact:true}).waitFor();await click(reviewer,'核对更正影响');const boxes=reviewer.locator('.fc-review-items input[type=checkbox]');await boxes.first().waitFor({timeout:90000});assert.equal(await boxes.count(),1);assert.equal(await boxes.first().isChecked(),false);
  const selectedRow=reviewer.locator('.fc-review-item:has(input[type=checkbox])');assert.equal(await selectedRow.count(),1);assert((await selectedRow.locator('h4').innerText()).includes(profiles.phq.name));assert.equal(await selectedRow.locator('.fc-answers dd').count(),profiles.phq.schema.fields.length);await boxes.first().check();
  const created=reviewer.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===apiPath(vp+'/workflow/batches'),{timeout:90000});checkpoint('集中审阅更正修订','intent',{ref:newRef});await click(reviewer,'审核通过并锁定');await reviewer.getByRole('dialog').waitFor();assert.equal(await reviewer.getByRole('dialog').locator('li').count(),1);await reviewer.getByRole('dialog').getByRole('button',{name:'确认本次处理',exact:true}).click();const createResponse=await created;assert.equal(createResponse.status(),200);const admitted=await createResponse.json();batchId=admitted.batchId;assert.equal(admitted.items.length,1);assert.equal(admitted.items[0].assignmentId,assignmentId);assert.deepEqual(admitted.items[0].expectedRef,newRef);
  await reviewer.getByText('1 / 1 份已处理。',{exact:true}).waitFor({timeout:90000});const batchPath=apiPath(vp+'/workflow/batches/'+batchId),batchResponse=await reviewer.context().request.get(base+batchPath);network.push({at:new Date().toISOString(),role:'reviewer',stage,method:'GET',path:batchPath,status:batchResponse.status(),transport:'native-browser-context-request'});assert.equal(batchResponse.status(),200,'BATCH_GET_MUST_USE_ORIGINAL_REVIEWER_SESSION');const batch=await batchResponse.json();assert.equal(batch.status,'completed');assert.equal(batch.items.length,1);assert.equal(batch.advanceReceipts.length,1);assert(batch.advanceReceipts[0].executionConfirmed);assert.deepEqual(batch.advanceReceipts[0].expectedRef,newRef);
  const locked=await h.get(root+'/assignments/'+assignmentId);assert(locked.response.locked&&locked.response.review==='review_approved');assert.deepEqual(locked.response.ref,newRef);assert.equal(locked.response.version,newCapture.response.version+2);
  assert.equal((await h.get(vp)).visit.completionIntegrity,'requires_review','CENTRAL_REVIEW_MUST_NOT_AUTO_REVERIFY');await reviewer.screenshot({path:out+'04-only-corrected-revision-reviewed-and-locked.png',fullPage:true});checkpoint('集中审阅更正修订','verified',{batchId,ref:newRef});checks.push('author_cannot_self_review_other_authorized_reviewer_selects_only_new_revision');

  stage='reverify';await reviewer.getByLabel('重新核对原因',{exact:true}).waitFor({timeout:90000});await reviewer.getByLabel('重新核对原因',{exact:true}).fill('合成CSV更正后由独立人员审阅并锁定，重新核对原完成依据');await postByUI(reviewer,vp+'/reverify','重新核对完成依据');await reviewer.getByText('已完成，本次依据已核对。',{exact:true}).waitFor({timeout:90000});
  const finalVisit=(await h.get(vp)).visit,finalRaw=await rawVisit();assert.equal(finalVisit.completionIntegrity,'current');assert.equal(finalVisit.status,'completed');assert.equal(finalVisit.actualCompletedAt,originalCompletedAt);assert.equal(finalRaw.actualCompletedAt,beforeRaw.actualCompletedAt);assert(finalRaw.evidenceRefs.length>beforeRaw.evidenceRefs.length);assert.deepEqual(finalRaw.evidenceRefs.slice(0,beforeRaw.evidenceRefs.length),beforeRaw.evidenceRefs);
  assert(finalRaw.evidenceRefs.some(r=>r.assignmentId===assignmentId&&r.contentHash===oldRef.contentHash));assert(finalRaw.evidenceRefs.some(r=>r.assignmentId===assignmentId&&r.contentHash===newRef.contentHash));await reviewer.screenshot({path:out+'05-completion-reverified-original-date-retained.png',fullPage:true});checks.push('explicit_reason_and_original_reverify_preserve_completed_date_and_append_prior_evidence');

  stage='readonly-links';const writesBeforeLinks=network.filter(x=>x.method==='POST'&&!x.path.startsWith('/api/auth/')).length;
  const phqRow=reviewer.locator('.fc-review-item').filter({has:reviewer.getByRole('heading',{name:profiles.phq.name+' · 必采',exact:true})});assert.equal(await phqRow.count(),1);await phqRow.getByRole('link',{name:'查看此表单的数据疑问',exact:true}).click();await reviewer.locator('.fc-queries').waitFor({timeout:90000});let location=new URL(reviewer.url());assert.equal(location.pathname,'/pages/s05/');assert.equal(location.searchParams.get('studyId'),f.study.id);assert.equal(location.searchParams.get('assignmentId'),assignmentId);await reviewer.screenshot({path:out+'06-exact-s05-assignment-context-readonly.png',fullPage:true});
  await reviewer.getByRole('link',{name:'查看访视与采集记录',exact:true}).click();await reviewer.locator('.fc-assignment .fc-history > summary').waitFor({timeout:90000});location=new URL(reviewer.url());assert.equal(location.pathname,'/pages/s09/');assert.equal(location.searchParams.get('studyId'),f.study.id);assert.equal(location.searchParams.get('assignmentId'),assignmentId);await reviewer.locator('.fc-assignment .fc-history > summary').click();const originalArticle=reviewer.locator('.fc-history-item').filter({has:reviewer.getByRole('heading',{name:/^第1次修订/})});await originalArticle.waitFor({timeout:90000});assert.equal(await originalArticle.count(),1);await originalArticle.getByRole('button',{name:'查看此修订',exact:true}).click();await reviewer.getByRole('heading',{name:'正在核对第1次修订',exact:true}).waitFor();
  const historical=await originalRevision(oldRef);assert.deepEqual(historical,oldRevision,'ORIGINAL_REVISION_CHANGED');await reviewer.screenshot({path:out+'07-original-fixed-revision-history-readonly.png',fullPage:true});assert.equal(network.filter(x=>x.method==='POST'&&!x.path.startsWith('/api/auth/')).length,writesBeforeLinks);checks.push('real_s05_assignment_link_and_return_history_original_revision_readonly');
  const business=network.filter(x=>x.method==='POST'&&!x.path.startsWith('/api/auth/'));assert.equal(business.filter(x=>x.path.endsWith('/unlock')).length,resume?0:1);assert.equal(business.filter(x=>x.path.endsWith('/correct')).length,resume?0:1);assert.equal(business.filter(x=>x.path.endsWith('/workflow/batches')).length,1);assert.equal(business.filter(x=>x.path.endsWith('/advance')).length,1);assert.equal(business.filter(x=>x.path.endsWith('/reverify')).length,1);assert(business.every(x=>x.status===200));assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(unexpectedDialogs,[]);assert.deepEqual(blockedWrites,[]);
  const otherCaptures=await Promise.all(allAssignmentIds.filter(id=>id!==assignmentId).map(id=>h.get(root+'/assignments/'+id)));assert(otherCaptures.every(c=>c.response.ref.revisionNo===1&&c.response.locked&&c.response.review==='review_approved'));
  save(out+'after-metadata.json',{studyId:f.study.id,visitId,assignmentId,originalRef:oldRef,currentRef:newRef,originalCompletedAt,finalCompletedAt:finalVisit.actualCompletedAt,priorEvidenceCount:beforeRaw.evidenceRefs.length,currentEvidenceRefs:finalRaw.evidenceRefs,batch,oldRevisionAnswersSha256:sha(JSON.stringify(historical.answers)),currentAnswersSha256:sha(JSON.stringify(locked.response.answers)),unaffectedAssignmentRefs:otherCaptures.map(c=>c.response.ref)});
  result={at:new Date().toISOString(),passed:true,studyId:f.study.id,visitId,assignmentId,batchId,case:'CSV',collectorActorId:f.accounts.collector.id,reviewerActorId:f.accounts.reviewer.id,originalCompletedAt,finalCompletedAt:finalVisit.actualCompletedAt,originalRef:oldRef,currentRef:newRef,originalRevisionUnchanged:true,priorCompletionEvidenceRetained:true,currentCompletionEvidenceAppended:true,changedSyntheticField:field.key,businessWritesViaActualUI:true,manualMarkerInjection:false,resumeAfterProvenCorrection:resume,originalFailureEvidence:resume?sourceJournal.evidence:null,unlockOrCorrectionReplayed:false,readonlyS05AndHistory:true,checks,network,pageErrors,consoleErrors,unexpectedDialogs,beforeUnloadDialogs,blockedWrites,qualification:'Only new registered synthetic CSV case; PHQ original option correction and authorized independent review. No clinical rule, old study, analysis, report or production change.'};
 }catch(error){failure=error;if(activePage)await activePage.screenshot({path:out+'failure.png',fullPage:true}).catch(()=>{});save(out+'failure.json',{at:new Date().toISOString(),passed:false,stage,error:String(error.message).slice(0,2000),studyId:f.study.id,visitId,assignmentId,batchId,network,pageErrors,consoleErrors,unexpectedDialogs,beforeUnloadDialogs,blockedWrites});journal.status='failed';journal.failure={stage,message:String(error.message).slice(0,500)};save(journalPath,journal);}
 finally{for(const context of contexts)try{await context.close();}catch(e){closeErrors.push(String(e.message).slice(0,500));}try{await browser?.close();}catch(e){closeErrors.push(String(e.message).slice(0,500));}const closedAt=new Date().toISOString();save(out+'context-lifecycle.json',{contexts:contexts.length,closedAt,closeErrors});if(result){result.contextsClosedAt=closedAt;result.closeErrors=closeErrors;}if(closeErrors.length&&!failure)failure=Error('BROWSER_CONTEXT_CLOSE_FAILED');}
 if(!failure)try{if(resume)assert.deepEqual(json(originalJournalPath),sourceJournal,'ORIGINAL_FAILURE_JOURNAL_CHANGED');await preserveOld(h,resume?'after-correction-ui-resume':'after-correction-ui');}catch(error){failure=error;stage='post-run-preservation';}
 if(failure){journal.status='failed';journal.failure={stage,message:String(failure.message).slice(0,500)};save(journalPath,journal);save(out+'failure.json',{at:new Date().toISOString(),passed:false,stage,error:String(failure.message).slice(0,2000),studyId:f.study.id,visitId,assignmentId,batchId,network,pageErrors,consoleErrors,unexpectedDialogs,beforeUnloadDialogs,blockedWrites,closeErrors});throw failure;}
 journal.status='completed';journal.batchId=batchId;journal.completedAt=new Date().toISOString();save(journalPath,journal);save(out+'result.json',result);console.log(JSON.stringify({passed:true,studyId:f.study.id,visitId,assignmentId,batchId,evidence:out+'result.json'}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert.equal(requireQAWindow(process.argv.slice(2)),'browser');await runCorrectionBrowser();}
