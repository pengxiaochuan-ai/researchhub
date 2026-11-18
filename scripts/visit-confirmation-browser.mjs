// Explicit, single-run synthetic acceptance. Never imported by product code.
// Setup writes use the existing synthetic study only; all capture/review/complete writes use UI buttons.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {base,workspace,repo,privateDir as originalPrivate,json,save,sha,normalize,validateFixture,sourceProfiles,makePolicySections,loginBrowserContext} from './visit-workflow-qa.mjs';
import {preserveOld} from './visit-workflow-preserve.mjs';

export const privateDir=workspace+'.tmp/visit-confirmation-recovery-2026-11-16/';
export const evidenceDir=repo+'docs/testing/evidence/visit-confirmation-recovery-2026-11-16/';
const out=evidenceDir+'browser/';
const sourcePaths=['pages/shared/useFormalCapture.js','pages/shared/CaptureConfirmation.jsx','pages/shared/CaptureVisit.jsx','pages/shared/CaptureAssignment.jsx','pages/shared/ConfirmDialog.jsx','pages/shared/FormalCaptureWorkspace.jsx'];
const fingerprints=()=>Object.fromEntries(sourcePaths.map(path=>[path,sha(readFileSync(repo+path))]));

export function requireConfirmationWindow(args,env=process.env){
 assert.deepEqual(args,['--local-synthetic','--browser']);
 assert.equal(env.VISIT_CONFIRMATION_QA_WINDOW,'explicit','EXPLICIT_CONFIRMATION_QA_WINDOW_REQUIRED');
 // Existing QA helpers enforce their own additional process-local guard.
 assert(!env.VISIT_WORKFLOW_QA_WINDOW||env.VISIT_WORKFLOW_QA_WINDOW==='explicit');
}

export async function runConfirmationBrowser(){
 requireConfirmationWindow(process.argv.slice(2));
 process.env.VISIT_WORKFLOW_QA_WINDOW='explicit';
 mkdirSync(privateDir,{recursive:true,mode:0o700});mkdirSync(out,{recursive:true});
 const checkpointPath=privateDir+'checkpoint.json';
 const cp=existsSync(checkpointPath)?json(checkpointPath):{purpose:'visit-confirmation-recovery-2026-11-16',syntheticOnly:true,runId:'rh-confirm-'+randomUUID().slice(0,8),steps:{},browser:null};
 assert.equal(cp.purpose,'visit-confirmation-recovery-2026-11-16');assert.equal(cp.syntheticOnly,true);
 assert(!cp.browser,'BROWSER_RUN_ALREADY_STARTED_STOP_FOR_READONLY_RECONCILIATION_NO_REPLAY');
 const persist=()=>save(checkpointPath,cp);persist();
 const f=json(originalPrivate+'fixture.json');validateFixture(f);assert(f.ready);
 const {openHarness}=await import('./full-study-runtime.mjs');
 const h=await openHarness({privateOutputDir:privateDir+'auth/'}),api='/research-studies/'+f.study.id;
 const beforeSources=fingerprints(),oldBefore=await preserveOld(h,'before-confirmation-ui');

 async function protectExisting(){
  const visits={},assignments={};
  // Snapshot each of the eight pre-existing baseline visits, not the changing study list/audit total.
  for(const [name,item]of Object.entries(f.cases)){
   const value=await h.get(api+'/visits/'+item.visitId);visits[name]=value;
   for(const a of value.visit.assignments)assignments[a.id]=await h.get(api+'/assignments/'+a.id);
  }
  return {visits,assignments,sha256:sha(JSON.stringify({visits,assignments}))};
 }
 const existingBefore=await protectExisting();save(out+'existing-before.json',existingBefore);

 async function setup(name,path,body){
  assert(path.startsWith(api+'/subjects'),'SETUP_OUTSIDE_EXPLICIT_SUBJECT_SCOPE');
  const old=cp.steps[name];
  if(old){assert.equal(old.path,path);assert.equal(sha(JSON.stringify({...old.body,requestKey:null})),sha(JSON.stringify({...body,requestKey:null})));assert.equal(old.state,'done','SETUP_RESULT_UNKNOWN_STOP_NO_REPLAY:'+name);return old.value;}
  const step={path,body:{...body,requestKey:randomUUID()},state:'started',at:new Date().toISOString()};cp.steps[name]=step;persist();
  const value=await h.post(path,step.body);step.state='done';step.value=value;persist();return value;
 }
 const sections=makePolicySections(),subject=(await setup('subject',api+'/subjects',{subjectId:'SYNTHETIC-'+cp.runId+'-UX01'})).subject;
 assert(subject.id&&!Object.values(f.cases).some(c=>c.subject.id===subject.id));
 const participation=api+'/subjects/'+subject.id+'/participation';
 for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'软件合成授权主体',textVersion:sections.researchConsent.rules.textVersion},{kind:'data_use_consent',decision:'granted',signer:'软件合成授权主体',scope:sections.dataUse.rules.scope}]){
  const name='event-'+event.kind,effectiveAt=cp.steps[name]?.body.event.effectiveAt??new Date(Date.now()-1000).toISOString();
  await setup(name,participation+'/events',{expectedPolicyVersionId:f.policy.id,expectedPolicyHash:f.policy.contentHash,event:{...event,effectiveAt,evidence:'UX01确认中断修复独立合成验证，无真实受试者'}});
 }
 await setup('enroll',participation+'/enroll',{expectedPolicyVersionId:f.policy.id,expectedPolicyHash:f.policy.contentHash});
 const newVisits=(await h.get(api+'/visits?'+new URLSearchParams({subjectId:subject.id,limit:'20'}))).items;
 assert.equal(newVisits.length,2);const visitId=newVisits.find(v=>v.visitPlan.code==='BASELINE')?.id;assert(visitId);
 const visitPath=api+'/visits/'+visitId,url=base+'/pages/s09/?'+new URLSearchParams({formalCapture:'1',studyId:f.study.id,visitId});
 const initial=(await h.get(visitPath)).visit;assert.equal(initial.status,'planned');assert.equal(initial.assignments.length,0);
 cp.subjectId=subject.id;cp.visitId=visitId;cp.browser={state:'started',at:new Date().toISOString()};persist();
 save(out+'fixture.json',{syntheticOnly:true,studyId:f.study.id,runId:cp.runId,subjectId:subject.id,visitId,unusedChannelVisitId:newVisits.find(v=>v.id!==visitId).id,collector:f.accounts.collector.id,reviewer:f.accounts.reviewer.id,oldBefore,existingBeforeSha256:existingBefore.sha256,newRoles:0,newStudies:0,externalEmailSent:false});
 save(out+'setup-ledger.json',h.network);

 const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
 const profiles=sourceProfiles(),contexts=[],profilesToRemove=[],network=[],clicks=[],fields=[],checks=[],shots=[],pageErrors=[],consoleErrors=[],unexpectedDialogs=[],violations=[],faults=[],expectedErrorPaths=new Set(),allowedAssignments=new Set();
 let stage='collector-entry',activePage,sequence=0;
 const flush=()=>save(out+'live.json',{stage,network,clicks,fields,checks,shots,pageErrors,consoleErrors,unexpectedDialogs,violations,faults});
 const writes=()=>network.filter(x=>x.method==='POST'&&!x.path.startsWith('/api/auth/'));
 const matchingWrites=path=>writes().filter(x=>x.path===path);
 async function context(role){
  const profile=mkdtempSync(join(tmpdir(),'rh-confirm-'+role+'-'));profilesToRemove.push(profile);
  const c=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:null,args:['--window-size=1440,1000'],recordVideo:{dir:out+'video-'+role,size:{width:1440,height:1000}}});contexts.push(c);c.setDefaultTimeout(30000);
  await c.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;
   if(req.method()!=='GET'&&req.method()!=='HEAD'){
    const allowed=req.method()==='POST'&&(p.startsWith('/api/auth/')||p.startsWith('/api'+visitPath+'/')||[...allowedAssignments].some(id=>p.startsWith('/api'+api+'/assignments/'+id+'/')));
    if(!allowed){violations.push({method:req.method(),path:p,stage});flush();return route.abort('blockedbyclient');}
   }
   await route.continue();
  });
  const identity=json(originalPrivate+'identities.json').accounts[role];
  save(out+'session-'+role+'-metadata.json',await loginBrowserContext(c,{tenantSlug:h.runtime.ids.tenant,username:identity.username,password:identity.password,expectedActorId:identity.id}));return c;
 }
 function watch(page,role){
  const entries=new WeakMap();
  page.on('request',req=>{const u=new URL(req.url());if(!u.pathname.startsWith('/api/'))return;let key;try{if(req.method()==='POST')key=req.postDataJSON()?.requestKey;}catch{}const entry={id:++sequence,at:new Date().toISOString(),role,stage,method:req.method(),path:u.pathname,search:u.search,...(key?{requestKey:key}:{})};entries.set(req,entry);network.push(entry);flush();});
  page.on('response',res=>{const entry=entries.get(res.request());if(entry){entry.status=res.status();flush();}});
  page.on('requestfailed',req=>{const entry=entries.get(req);if(entry){entry.failure=req.failure()?.errorText;entry.expectedFault=expectedErrorPaths.has(entry.path);flush();}});
  page.on('pageerror',error=>{pageErrors.push({role,stage,message:error.message});flush();});
  page.on('console',message=>{if(message.type()!=='error')return;let path='';try{path=new URL(message.location().url).pathname;}catch{}consoleErrors.push({role,stage,message:message.text(),location:message.location(),expectedFault:expectedErrorPaths.has(path)&&/Failed to load resource|net::ERR/.test(message.text())});flush();});
  page.on('dialog',dialog=>{if(dialog.type()==='beforeunload')return void dialog.accept();unexpectedDialogs.push({role,stage,type:dialog.type(),message:dialog.message()});flush();void dialog.dismiss();});
 }
 async function shot(page,name,{mobile=false}={}){
  if(mobile)await page.setViewportSize({width:390,height:900});
  const filename=name+(mobile?'-390':'-1440')+'.png';
  await page.screenshot({path:out+filename,fullPage:false});shots.push({stage,filename,at:new Date().toISOString(),viewport:page.viewportSize()});flush();
  if(mobile)await page.setViewportSize({width:1440,height:1000});
 }
 async function click(page,name,role,within=page){await within.getByRole('button',{name,exact:true}).click();clicks.push({stage,role,action:name,at:new Date().toISOString()});flush();}
 async function openSubmit(page){await click(page,'提交并继续','collector');await page.getByRole('dialog').waitFor();}
 async function waitConfirmEnabled(page){await page.waitForFunction(()=>{const dialog=document.querySelector('dialog[open]');const button=dialog&&[...dialog.querySelectorAll('button')].find(b=>b.textContent.trim()==='确认');return !!button&&!button.disabled;});}
 async function fill(page,kind){const editor=page.locator('.fc-field-editor');await editor.waitFor();for(let i=0;i<profiles[kind].schema.fields.length;i++){const field=profiles[kind].schema.fields[i],value=f.answers[kind][field.key];assert.notEqual(value,undefined);if(field.choices)await editor.locator('input[name="fc-field-'+i+'"][value="'+value+'"]').check();else if(['select','boolean'].includes(field.type))await editor.locator('#fc-field-'+i).selectOption(String(value));else await editor.locator('#fc-field-'+i).fill(String(value));fields.push({kind,key:field.key,value});}flush();}
 async function assertOriginalInput(page,kind){
  const actual=await page.locator('.fc-field-editor').evaluate((editor,definition)=>Object.fromEntries(definition.map((field,i)=>{const node=field.choices?editor.querySelector('input[name="fc-field-'+i+'"]:checked'):editor.querySelector('#fc-field-'+i);return[field.key,node?.value??null];})),profiles[kind].schema.fields);
  assert.deepEqual(actual,Object.fromEntries(Object.entries(f.answers[kind]).map(([key,value])=>[key,String(value)])));
 }
 async function holdRead(page,mode){
  let release,reachedResolve,reachedReject,finishedResolve;const gate=new Promise(resolve=>{release=resolve;}),reached=new Promise((resolve,reject)=>{reachedResolve=resolve;reachedReject=reject;}),finished=new Promise(resolve=>{finishedResolve=resolve;});let taken=false;
  const matcher=u=>u.pathname==='/api'+visitPath;
  const handler=async route=>{if(taken||route.request().method()!=='GET')return route.continue();taken=true;try{const response=await route.fetch({maxRetries:0,timeout:90000});assert.equal(response.status(),200);faults.push({stage,kind:mode==='abort'?'UI_GET_CONNECTION_FAULT_AFTER_REAL_200':'UI_GET_DELAY_AFTER_REAL_200',path:'/api'+visitPath,serverStatus:response.status(),at:new Date().toISOString()});flush();reachedResolve();await gate;if(mode==='abort'){expectedErrorPaths.add('/api'+visitPath);await route.abort('connectionreset');}else await route.fulfill({response});}catch(error){reachedReject(error);throw error;}finally{finishedResolve();}};
  await page.route(matcher,handler);return {reached,async release(){release();await finished;await page.unroute(matcher,handler);}};
 }
 async function triggerQuiet(page){await page.evaluate(()=>window.dispatchEvent(new Event('focus')));}
 async function dropWrite(page,path,label,{delay=false}={}){
  let resolve,reject,release,finish;const received=new Promise((yes,no)=>{resolve=yes;reject=no;}),gate=new Promise(yes=>{release=yes;}),finished=new Promise(yes=>{finish=yes;});let taken=false;
  const matcher=u=>u.pathname===path;
  const handler=async route=>{if(taken||route.request().method()!=='POST')return route.continue();taken=true;try{const response=await route.fetch({maxRetries:0,timeout:90000});assert.equal(response.status(),200);const value=await response.json(),key=route.request().postDataJSON().requestKey;assert.equal(value.receipt.requestKey,key);const proof={stage,label,path,requestKey:key,serverStatus:200,value,at:new Date().toISOString(),qualification:'Original UI POST really returned 200 from server; only its browser response is '+(delay?'delayed.':'discarded.')};save(out+label+'-server-accepted.json',proof);faults.push({stage,label,path,requestKey:key,kind:delay?'UI_POST_RESPONSE_DELAY_AFTER_REAL_200':'UI_POST_RESPONSE_DROPPED_AFTER_REAL_200',serverStatus:200});flush();if(delay){resolve(proof);await gate;await route.fulfill({response});}else{expectedErrorPaths.add(path);await route.abort('connectionreset');resolve(proof);}}catch(error){reject(error);throw error;}finally{finish();}};
  await page.route(matcher,handler);return {received,async release(){release();await finished;await page.unroute(matcher,handler);},async remove(){await finished;await page.unroute(matcher,handler);}};
 }
 async function recoverOriginal(page,role,proof){
  const dialog=page.getByRole('dialog');await dialog.waitFor();const before=writes().length;
  const recheck=dialog.getByRole('button',{name:'重新核对当前状态',exact:true});
  if(await recheck.count())await click(page,'重新核对当前状态',role,dialog);
  await dialog.getByRole('button',{name:'核对本次操作结果',exact:true}).waitFor();
  await click(page,'核对本次操作结果',role,dialog);
  await dialog.waitFor({state:'hidden',timeout:90000});
  assert.equal(writes().length,before,'READONLY_RECOVERY_MUST_NOT_POST');
  assert(network.some(x=>x.method==='GET'&&x.path.includes(proof.requestKey)&&x.status===200),'ORIGINAL_KEY_RECEIPT_GET_REQUIRED');
  checks.push(proof.label+': original-key GET recovery without new POST');flush();
 }

 try{
  const collectorContext=await context('collector'),page=await collectorContext.newPage();activePage=page;watch(page,'collector');await page.setViewportSize({width:1440,height:1000});await page.goto(url);await page.getByRole('button',{name:'开始采集',exact:true}).waitFor();await shot(page,'01-collector-new-visit');await click(page,'开始采集','collector');await page.locator('.fc-field-editor').waitFor({timeout:90000});
  const submitted=[];
  for(let index=0;index<3;index++){
   const assignmentId=new URL(page.url()).searchParams.get('assignmentId');assert(assignmentId&&!submitted.some(x=>x.assignmentId===assignmentId));allowedAssignments.add(assignmentId);
   const before=await h.get(api+'/assignments/'+assignmentId),kind=Object.keys(profiles).find(k=>f.refs[k]===before.assignment.formVersion.id);assert(kind);assert.equal(before.response.status,'draft');stage='collector-'+index+'-'+kind;await fill(page,kind);const submitPath='/api'+api+'/assignments/'+assignmentId+'/submit';
   if(index===0){
    const held=await holdRead(page,'delay');await triggerQuiet(page);await held.reached;await openSubmit(page);const dialog=page.getByRole('dialog');
    assert(await dialog.getByRole('button',{name:'确认',exact:true}).isDisabled());await dialog.getByText(/正在核对当前状态/).waitFor();await shot(page,'02-inflight-read-dialog');
    const count=writes().length;await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(writes().length,count);await assertOriginalInput(page,kind);assert.equal(await page.evaluate(()=>document.activeElement?.textContent.trim()),'提交并继续');checks.push('Escape cancels confirmation, preserves original input, restores trigger focus, 0 POST');
    await openSubmit(page);assert(await dialog.getByRole('button',{name:'确认',exact:true}).isDisabled());await held.release();await waitConfirmEnabled(page);
    const getCount=network.filter(x=>x.method==='GET'&&x.path==='/api'+visitPath).length;await triggerQuiet(page);await triggerQuiet(page);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(network.filter(x=>x.method==='GET'&&x.path==='/api'+visitPath).length,getCount,'OPEN_CONFIRMATION_MUST_PAUSE_NEW_QUIET_READS');
    await shot(page,'03-same-dialog-ready');const heldWrite=await dropWrite(page,submitPath,'submit-busy',{delay:true});await click(page,'确认','collector',dialog);await heldWrite.received;await dialog.getByText(/正在处理/).waitFor();assert(await dialog.getByRole('button',{name:'确认',exact:true}).isDisabled());assert(await dialog.getByRole('button',{name:'取消',exact:true}).isDisabled());const box=await dialog.getByRole('button',{name:'确认',exact:true}).boundingBox();assert(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);clicks.push({stage,role:'collector',action:'重复确认探测（禁用按钮）'});assert.equal(matchingWrites(submitPath).length,1);await shot(page,'03b-write-busy-no-repeat');await heldWrite.release();checks.push('In-flight read visibly disables confirmation; same dialog confirms once after read; new focus quiet reads paused; in-flight POST disables cancel and duplicate confirm');
   }else if(index===1){
    const held=await holdRead(page,'abort');await triggerQuiet(page);await held.reached;await openSubmit(page);const dialog=page.getByRole('dialog'),postCount=writes().length;await held.release();await dialog.getByText(/本次尚未执行/).first().waitFor();assert(await dialog.getByRole('button',{name:'确认',exact:true}).isDisabled());assert.equal(writes().length,postCount);await assertOriginalInput(page,kind);await shot(page,'04-read-failure-keeps-dialog');await shot(page,'04-read-failure-keeps-dialog',{mobile:true});await click(page,'重新核对当前状态','collector',dialog);await waitConfirmEnabled(page);assert.equal(writes().length,postCount);await assertOriginalInput(page,kind);await shot(page,'05-readonly-recheck-ready');await click(page,'确认','collector',dialog);checks.push('GET connection fault keeps same dialog and input; explicit in-dialog recheck is GET-only then confirms once');
   }else{
    const dropped=await dropWrite(page,submitPath,'submit-unknown');await openSubmit(page);await waitConfirmEnabled(page);await click(page,'确认','collector',page.getByRole('dialog'));const proof=await dropped.received;await dropped.remove();const saved=await h.get(api+'/assignments/'+assignmentId);assert.equal(saved.response.status,'submitted');assert.deepEqual(saved.response.answers,f.answers[kind]);assert.equal(matchingWrites(submitPath).length,1);await page.getByRole('dialog').getByRole('button',{name:'核对本次操作结果',exact:true}).waitFor();await shot(page,'06-submit-unknown-keeps-dialog');await shot(page,'06-submit-unknown-keeps-dialog',{mobile:true});await recoverOriginal(page,'collector',proof);
   }
   if(index<2)await page.waitForURL(u=>u.searchParams.get('assignmentId')!==assignmentId,{timeout:90000});else await page.locator('#visit-review-content').waitFor({timeout:90000});
   const current=await h.get(api+'/assignments/'+assignmentId);assert.equal(current.response.status,'submitted');assert.deepEqual(current.response.answers,f.answers[kind]);assert.equal(current.response.review,null);assert.equal(current.response.locked,false);assert.equal(matchingWrites(submitPath).length,1);submitted.push({assignmentId,kind,responseId:current.response.id??current.response.ref.responseId,ref:current.response.ref});
  }
  assert.equal(await page.locator('.fc-review-items input[type=checkbox]').count(),0);assert.notEqual((await h.get(visitPath)).visit.status,'completed');await shot(page,'07-collector-handoff');checks.push('Three actual original forms submitted once each; collector cannot approve; no automatic review or completion');
  stage='reviewer-batch';const reviewerContext=await context('reviewer'),reviewer=await reviewerContext.newPage();activePage=reviewer;watch(reviewer,'reviewer');await reviewer.setViewportSize({width:1440,height:1000});await reviewer.goto(url);await reviewer.getByRole('button',{name:'集中审阅',exact:true}).waitFor();await click(reviewer,'集中审阅','reviewer');const boxes=reviewer.locator('.fc-review-items input[type=checkbox]');await boxes.first().waitFor({timeout:90000});assert.equal(await boxes.count(),3);assert(await boxes.evaluateAll(xs=>xs.every(x=>!x.checked)));assert.equal(await reviewer.locator('.fc-review-item .fc-answers dd').count(),fields.length);
  for(let i=0;i<3;i++){await boxes.nth(i).check();clicks.push({stage,role:'reviewer',action:'选择已核对表单',index:i});}
  await click(reviewer,'审核通过并锁定','reviewer');await reviewer.getByRole('dialog').waitFor();assert.equal(await reviewer.getByRole('dialog').locator('li').count(),3);await shot(reviewer,'08-one-independent-review-confirmation');await click(reviewer,'确认本次处理','reviewer',reviewer.getByRole('dialog'));await reviewer.getByText('所选表单已审核并锁定，请核对后完成访视。',{exact:true}).waitFor({timeout:90000});assert.notEqual((await h.get(visitPath)).visit.status,'completed');checks.push('Independent reviewer selects all 3 explicitly and uses one fixed-revision review/lock confirmation; visit not auto-completed');
  stage='reviewer-complete-unknown';const completePath='/api'+visitPath+'/complete',droppedComplete=await dropWrite(reviewer,completePath,'complete-unknown');await click(reviewer,'完成访视','reviewer');await reviewer.getByRole('dialog').waitFor();await waitConfirmEnabled(reviewer);await click(reviewer,'确认','reviewer',reviewer.getByRole('dialog'));const completionProof=await droppedComplete.received;await droppedComplete.remove();const persisted=(await h.get(visitPath)).visit;assert.equal(persisted.status,'completed');assert.equal(persisted.completionIntegrity,'current');assert.equal(matchingWrites(completePath).length,1);await reviewer.getByRole('dialog').getByRole('button',{name:'核对本次操作结果',exact:true}).waitFor();await shot(reviewer,'09-complete-unknown-keeps-dialog');await shot(reviewer,'09-complete-unknown-keeps-dialog',{mobile:true});await recoverOriginal(reviewer,'reviewer',completionProof);await reviewer.getByText('已完成，本次依据已核对。',{exact:true}).waitFor();await shot(reviewer,'10-completed');
  stage='refresh-readonly';const beforeRefresh=writes().length;await reviewer.reload();await reviewer.getByText('已完成，本次依据已核对。',{exact:true}).waitFor({timeout:90000});assert.equal(writes().length,beforeRefresh);await shot(reviewer,'11-refreshed-completed');await shot(reviewer,'11-refreshed-completed',{mobile:true});
  const final=(await h.get(visitPath)).visit;assert.equal(final.status,'completed');assert.equal(final.completionIntegrity,'current');assert.equal(final.actualCompletedAt,persisted.actualCompletedAt);assert.equal(final.assignments.length,3);
  const finalCaptures=[];for(const item of submitted){const c=await h.get(api+'/assignments/'+item.assignmentId);assert(c.response.locked&&c.response.review==='review_approved');assert.equal(c.response.ref.revisionNo,1);assert.deepEqual(c.response.answers,f.answers[item.kind]);finalCaptures.push(c);}
  const targets=[visitId,...submitted.map(x=>x.responseId)],native=await h.read(async tx=>normalize({visit:await tx.subjectVisit.findFirst({where:{...f.scope,id:visitId}}),responses:await tx.formResponse.findMany({where:{...f.scope,assignmentId:{in:submitted.map(x=>x.assignmentId)}},orderBy:{id:'asc'}}),audits:await tx.auditLog.findMany({where:{...f.scope,target:{in:targets}},orderBy:{id:'asc'}})}));
  const counts=Object.fromEntries(['formal_response_submit','formal_response_review_approved','formal_response_lock','study_visit_complete','researchhub.visit.complete'].map(action=>[action,native.audits.filter(a=>a.action===action).length]));assert.deepEqual(counts,{formal_response_submit:3,formal_response_review_approved:3,formal_response_lock:3,study_visit_complete:1,'researchhub.visit.complete':1});assert.notEqual(f.accounts.collector.id,f.accounts.reviewer.id);for(const a of native.audits.filter(a=>Object.hasOwn(counts,a.action)))assert.equal(a.accountId,a.action==='formal_response_submit'?f.accounts.collector.id:f.accounts.reviewer.id);save(out+'native-proof.json',native);save(out+'final-captures.json',{studyId:f.study.id,visit:final,captures:finalCaptures});
  const existingAfter=await protectExisting();assert.deepEqual(existingAfter,existingBefore,'PRE_EXISTING_BASELINE_CONTENT_CHANGED');save(out+'existing-after.json',existingAfter);const oldAfter=await preserveOld(h,'after-confirmation-ui');assert.deepEqual(fingerprints(),beforeSources,'PRODUCT_SOURCE_CHANGED_DURING_RUNTIME_QA');assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors.filter(x=>!x.expectedFault),[]);assert.deepEqual(unexpectedDialogs,[]);assert.deepEqual(violations,[]);checks.push('Refresh GET-only; native submit/review/lock 3 each, complete 1; independent actors; original 8 baselines and protected old study unchanged');
  const result={at:new Date().toISOString(),passed:true,studyId:f.study.id,runId:cp.runId,subjectId:subject.id,visitId,collector:f.accounts.collector.id,reviewer:f.accounts.reviewer.id,counts,submitted,sourceHashes:beforeSources,oldBefore,oldAfter,existingContentHash:existingAfter.sha256,checks,clicks,fieldSelections:fields.length,network,shots,faults,pageErrors,consoleErrors,unexpectedDialogs,violations,qualification:'Real current UI with one new synthetic subject in existing synthetic study. GET delays/failure and lost browser POST responses are controlled transport faults; accepted 200 server receipts and native audit prove actual business execution. No clinical data, external mail, model, new identity/permission or production deployment. No time-saving percentage or user-professional acceptance claimed.'};save(out+'result.json',result);cp.browser={...cp.browser,state:'completed',completedAt:result.at,resultPath:out+'result.json'};persist();console.log(JSON.stringify({passed:true,visitId,checks:checks.length,fieldSelections:fields.length,counts,evidence:out+'result.json'}));return result;
 }catch(error){if(activePage)await activePage.screenshot({path:out+'failure.png',fullPage:false}).catch(()=>{});cp.browser={...cp.browser,state:'stopped-for-reconciliation',failedAt:new Date().toISOString(),stage,error:String(error.message).slice(0,2000)};persist();save(out+'failure.json',{...cp.browser,studyId:f.study.id,subjectId:subject.id,visitId,checks,network,clicks,fields,shots,faults,pageErrors,consoleErrors,unexpectedDialogs,violations});throw error;}
 finally{for(const c of contexts)await c.close();for(const path of profilesToRemove)rmSync(path,{recursive:true,force:true});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runConfirmationBrowser();
