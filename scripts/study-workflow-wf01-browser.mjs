// Root-run, SYNTHETIC-only WF01 acceptance. No import-time target/credential/browser I/O.
// Run one checkpointed step at a time. Never rerun an unconfirmed native write.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {base,workspace,purpose,privateDir,evidenceDir,caseRoles,steps,sha,bodyHash,json,save,parseArgs,mutationAction,expectedNativeStatus,successfulNativeStatus,knownRejected,receiptCandidate,receiptPath,metadata,verifyReceipt,assertOpaqueMarker,mayExecuteStep,createJournal,readOldHashes,assertOldHashes} from './study-workflow-wf01-qa.mjs';

const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const projectUrl=id=>base+'/pages/q01/?'+new URLSearchParams({researchCreation:'1',...(id?{projectIntentId:id}:{})});
const button=(page,name)=>page.getByRole('button',{name,exact:true});
const help=`WF01 only; root owns the I/O window. Imports and --help are offline.
Set STUDY_WORKFLOW_WF01_QA_WINDOW=explicit VISIT_WORKFLOW_QA_WINDOW=explicit.
node scripts/study-workflow-wf01-browser.mjs --local-synthetic --case A --step create
A: create, continue-child (partial-save recovery only), enter, edit, cas; B: create; C: draft
D: save-loss, recover-save, study-loss, recover-study, new-tab
Other modes: --visual | --boundaries | --audit | --reconcile
After --reconcile: --verify-ui A.create (read-only UI assertions, no write replay).
Run each case's steps in order. Successful steps skip. A dispatched but unverified
write blocks replay: run --reconcile, then --verify-ui <case.step> (GET only).
Persistent private Chrome profiles preserve the real tab's sessionStorage.
No marker injection, account/role/group creation, API business write or runtime restart.
`;

export async function runWF01(options){
 // Guard before importing any harness or opening any private fixture.
 parseArgs(options.mode==='case'?['--local-synthetic','--case',options.code,'--step',options.step]:options.mode==='verify-ui'?['--local-synthetic','--verify-ui',options.code+'.'+options.step]:['--local-synthetic','--'+options.mode]);
 const {openHarness}=await import('./full-study-runtime.mjs');
 const {readProtection,compareProtection}=await import('./visit-workflow-preserve.mjs');
 const {loginBrowserContext}=await import('./visit-workflow-qa.mjs');
 const authDir=privateDir+'auth-'+randomUUID().slice(0,8)+'/';
 const h=await openHarness({privateOutputDir:authDir});
 const identities=json(workspace+'.tmp/visit-capture-review-flow-2026-11-16/identities.json').accounts;
 const identitiesByRole={admin:{id:h.actor.id,username:h.actor.username,password:h.runtime.password},reviewer:identities.reviewer,collector:identities.collector};
 assert(identitiesByRole.reviewer?.id&&identitiesByRole.collector?.id,'EXISTING_IDENTITIES_REQUIRED_NO_ACCOUNT_CREATION');
 const ledger=createJournal(privateDir+'browser-checkpoints.json'),j=ledger.journal;
 if(j.tenantId)assert.equal(j.tenantId,h.runtime.ids.tenant);else j.tenantId=h.runtime.ids.tenant;
 if(!j.runId)j.runId='rh-wf01-'+randomUUID().slice(0,8);
 if(!j.runtimeKey)j.runtimeKey=h.runtime.key;assert.equal(j.runtimeKey,h.runtime.key);
 j.lastRuntimePid=h.runtime.pid;ledger.persist();
 const attempt=options.mode+(options.code?'-'+options.code+'-'+options.step:'')+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,5);
 const out=evidenceDir+'browser/'+attempt+'/';mkdirSync(out,{recursive:true,mode:0o700});
 const network=[],consoleErrors=[],pageErrors=[],dialogs=[],blockedWrites=[],measurements=[],contexts=[],routeTasks=new Set();
 const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
 let activePage,activeRole,stage='preflight',gate=null,currentStep=null,expectedUnload='dismiss',failure=null;
 const report={at:new Date().toISOString(),purpose,syntheticOnly:true,options,runtimePid:h.runtime.pid,runtimeKey:h.runtime.key,passed:false,network,consoleErrors,pageErrors,dialogs,blockedWrites,measurements,checks:[],boundaries:{realAccountRevocation:'not performed; no role/authVersion mutation authorized',unknown404UI:'covered by session unit tests; API GET-negative separately reported'}};
 function persistReport(){save(out+'live.json',report);}
 function event(state,extra={}){if(currentStep)ledger.event(currentStep,state,{stage,...extra});persistReport();}
 async function protection(phase){
  const original=await readProtection(h),path=privateDir+'protected-316-before.json';
  if(!existsSync(path)){assert.equal(phase,'before');save(path,original,{exclusive:true});}else compareProtection(json(path),original);
  const hashes=await readOldHashes(h),oldPath=privateDir+'old-rows-before.json';
  if(!existsSync(oldPath)){assert.equal(phase,'before');save(oldPath,hashes,{exclusive:true});}else assertOldHashes(json(oldPath),hashes);
  save(out+'protection-'+phase+'.json',{at:new Date().toISOString(),readOnly:true,registered:{nativeRuns:original.nativeRuns.length,revisions:original.revisions.length,childSnapshots:original.childSnapshots.length,scientificFiles:Object.keys(original.scientificFiles).length,word:original.word},tables:Object.fromEntries(Object.entries(hashes).map(([t,rows])=>[t,{count:rows.length,hash:sha(JSON.stringify(rows))}])),allOriginalIdsPreserved:true});
 }
 async function snapshot(){
  return h.read(async tx=>{
   const ids=Object.values(j.cases).map(c=>c.id).filter(Boolean);
   const intents=await tx.$queryRaw`SELECT id,title,question,version,status,owner_id FROM rh_research.project_intent WHERE tenant_id=${h.runtime.ids.tenant} AND (id=ANY(${ids}::text[]) OR title LIKE ${'SYNTHETIC WF01 '+j.runId+' %'}) ORDER BY id`;
   const bindings=await tx.$queryRaw`SELECT id,project_intent_id,execution_project_id,study_group_id FROM rh_research.study_binding WHERE tenant_id=${h.runtime.ids.tenant} AND project_intent_id=ANY(${intents.map(x=>x.id)}::text[]) ORDER BY id`;
   const operations=await tx.$queryRaw`SELECT id,actor_id,request_key,request_hash,action,target_id,audit_id,result->'receipt' AS receipt FROM rh_research.operation WHERE tenant_id=${h.runtime.ids.tenant} AND target_id=ANY(${intents.map(x=>x.id)}::text[]) ORDER BY id`;
   const audits=await tx.auditLog.findMany({where:{tenantId:h.runtime.ids.tenant,id:{in:operations.map(x=>x.audit_id)}},select:{id:true,accountId:true,action:true,target:true,meta:true},orderBy:{id:'asc'}});
   return{intents:intents.map(({title,question,...x})=>({...x,titleHash:sha(title),questionHash:sha(question)})),bindings,operations,audits};
  });
 }
 async function capture(label,page=activePage){
  assert(page,'ACTIVE_PAGE_REQUIRED');activePage=page;await page.bringToFront();
  const url=page.url();const identity=await page.context().request.get(base+'/api/auth/me').catch(()=>null);
  const me=identity?.status()===200?await identity.json().catch(()=>null):null;
  // Auth/network failure must still leave the actual active page's PNG and URL.
  const record={at:new Date().toISOString(),label,stage,role:activeRole,actualActorId:me?.accountId??null,authStatus:identity?.status()??null,url};
  save(out+label+'-active.json',record);await page.screenshot({path:out+label+'.png',fullPage:true});return record;
 }
 function watch(page,role){
  page.on('pageerror',e=>{pageErrors.push({role,stage,url:page.url(),message:e.message});persistReport();});
  page.on('console',m=>{if(m.type()==='error'){consoleErrors.push({role,stage,message:m.text(),location:m.location()});persistReport();}});
  page.on('dialog',d=>{dialogs.push({role,stage,type:d.type(),action:d.type()==='beforeunload'?expectedUnload:'dismiss'});persistReport();if(d.type()==='beforeunload'&&expectedUnload==='accept')void d.accept();else void d.dismiss();});
  page.on('response',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/')){network.push({at:new Date().toISOString(),role,stage,method:r.request().method(),path:u.pathname,query:u.search,status:r.status()});persistReport();}});
 }
 async function intercepted(route,role){
  const request=route.request(),url=new URL(request.url()),method=request.method(),path=url.pathname;
  if(method==='GET'||method==='HEAD'||path.startsWith('/api/auth/'))return route.continue();
  const action=mutationAction(method,path),body=request.postDataJSON();
  if(!gate||gate.role!==role||!action||!gate.actions.includes(action)||gate.used.has(action)||!body?.requestKey||action!=='intent.create'&&path.split('/')[3]!==j.cases[gate.code]?.id){
   blockedWrites.push({stage,role,method,path,action});persistReport();return route.abort('blockedbyclient');
  }
  if(action==='intent.create'){assert.equal(body.title,j.cases[gate.code].title);assert(Object.values(j.cases).filter(x=>x.id).length<4,'FOUR_NEW_INTENT_LIMIT');}
  gate.used.add(action);
  const record={at:new Date().toISOString(),role,actorId:identitiesByRole[role].id,method,path,action,requestKey:body.requestKey,requestHash:bodyHash(body),...(action==='intent.create'?{}:{targetId:path.split('/')[3]}),dispatched:true,expectedStatus:gate.expectedStatus??expectedNativeStatus(action)};
  // This durable request proof is written BEFORE the native HTTP write is sent.
  currentStep.requests.push(record);ledger.persist();event('native-request-dispatched',{requestKey:record.requestKey,action,requestHash:record.requestHash});
  let response;
  try{response=await route.fetch();}catch(error){record.transportUnknown=true;ledger.persist();event('native-result-unknown',{requestKey:record.requestKey});return route.abort('failed');}
  record.nativeStatus=response.status();const value=await response.json().catch(()=>null);
  if(successfulNativeStatus(response.status())){
   const result=verifyReceipt(record,value,gate.authVersion);record.acceptedAt=new Date().toISOString();record.result=result;
   const c=j.cases[gate.code];c.id=result.id;c.version=result.version;if(result.study)c.study=result.study;
   record.rejected=false;ledger.persist();event('native-success-accepted',{requestKey:record.requestKey,action,status:response.status(),item:result});
  }else{record.rejected=knownRejected(record);record.code=value?.code??null;ledger.persist();event('native-response',{requestKey:record.requestKey,status:response.status(),code:record.code});}
  assert.equal(response.status(),record.expectedStatus,'UNEXPECTED_NATIVE_WRITE_STATUS');
  if(gate.drop===action){record.responseDiscarded=true;ledger.persist();event('real-native-success-response-discarded',{requestKey:record.requestKey,status:response.status()});return route.abort('failed');}
  return route.fulfill({response});
 }
 async function actorPage(role,{profileKey=role,native=false,reuse=false}={}){
  const identity=identitiesByRole[role];assert(identity);
  const profile=privateDir+'chrome-'+profileKey;mkdirSync(profile,{recursive:true,mode:0o700});
  const context=await chromium.launchPersistentContext(profile,{executablePath:chrome,headless:process.env.STUDY_WORKFLOW_WF01_HEADED!=='1',viewport:native?null:{width:1440,height:1000},args:['--restore-last-session',...(native?['--window-size=1440,1000']:[])],recordVideo:{dir:out+'video-'+profileKey,size:{width:1440,height:1000}}});
  contexts.push(context);
  await loginBrowserContext(context,{tenantSlug:h.runtime.ids.tenant,username:identity.username,password:identity.password,expectedActorId:identity.id});
  const me=await context.request.get(base+'/api/auth/me');assert.equal(me.status(),200);const auth=await me.json();assert.equal(auth.accountId,identity.id);assert(Number.isInteger(auth.authVersion));
  save(out+'actor-'+profileKey+'.json',{role,actorId:identity.id,authVersion:auth.authVersion,profile});
  await context.route('**/api/**',route=>{const task=intercepted(route,role);routeTasks.add(task);return task.catch(error=>{report.routeFailure=String(error.message);persistReport();return route.abort('failed').catch(()=>{});}).finally(()=>routeTasks.delete(task));});
  const candidates=context.pages().filter(p=>new URL(p.url()==='about:blank'?base:p.url()).origin===base);
  const page=reuse&&candidates.length?candidates.find(p=>p.url().includes('/pages/q01/'))??candidates[0]:await context.newPage();
  watch(page,role);activePage=page;activeRole=role;return{context,page,auth,role};
 }
 async function ready(page,id){await page.goto(projectUrl(id));await page.locator('#research-project-title').waitFor();await page.locator('#research-project-title:enabled').waitFor({timeout:30000});}
 async function scope(actor){
  const response=await actor.context.request.get(base+'/api/research-projects/context');assert.equal(response.status(),200);const value=await response.json();
  assert.equal(value.capabilities?.canCreateProject,true,'ACTOR_MUST_HAVE_REAL_CREATE_PERMISSION_STOP_NO_PERMISSION_PATCH');
  const groups=value.creationGroups??[];save(out+'capabilities-'+actor.role+'.json',{role:actor.role,actorId:actor.auth.accountId,canCreateProject:true,groups:groups.map(({id,name})=>({id,name}))});return groups;
 }
 async function begin(code,name,{role=caseRoles[code],actions=[],drop=null,expectedStatus,authVersion}={}){
  stage=code+'.'+name;const id=stage,existing=j.steps[id];
  if(existing?.status==='verified'){report.checks.push(id+':skipped-verified');return false;}
  mayExecuteStep(existing);currentStep=ledger.intent(id,{role,case:code,step:name,evidence:out});
  gate=actions.length?{role,code,actions,drop,expectedStatus,authVersion,used:new Set()}:null;return true;
 }
 async function settle(){await Promise.all([...routeTasks]);assert(!report.routeFailure,report.routeFailure);}
 async function proof(record,actor){
  const response=await actor.context.request.get(base+receiptPath(record));
  event('receipt-get',{requestKey:record.requestKey,status:response.status()});
  assert.equal(response.status(),200,'ORIGINAL_RECEIPT_UNRESOLVED_NO_REPLAY');const value=await response.json();
  const result=verifyReceipt(record,value,actor.auth.authVersion);record.serverConfirmedAt=new Date().toISOString();record.proof=result;if(!record.result)record.result=result;
  if(currentStep?.case){const c=j.cases[currentStep.case],current=value.current?.item?metadata(value.current):result;assert(c,'REGISTERED_CASE_REQUIRED');if(c.id)assert.equal(c.id,result.id);c.id=result.id;c.version=current.version;if(current.study)c.study=current.study;}
  ledger.persist();return value;
 }
 async function finish(extra={}){await settle();gate=null;ledger.verified(currentStep,extra);report.checks.push(currentStep.id);currentStep=null;}
 async function s11(actor,code){await actor.page.waitForURL(u=>u.pathname==='/pages/s11/'&&u.searchParams.get('formalPreparation')==='1'&&u.searchParams.get('studyId')===j.cases[code].study?.id,{timeout:30000});await capture(stage.replaceAll('.','-')+'-s11');}
 async function markers(page,label){const entries=await page.evaluate(()=>Object.entries(sessionStorage).filter(([key])=>key.startsWith('researchhub:project-preparation:v1:')));assertOpaqueMarker(entries);save(out+label+'-marker-shape.json',{keys:entries.map(([key])=>key),markers:entries.map(([,text])=>JSON.parse(text)),bodyPersisted:false,manuallyInjected:false});return entries;}
 async function noBusinessDuring(fn){const before=await snapshot(),n=network.filter(x=>['POST','PATCH','PUT','DELETE'].includes(x.method)&&!x.path.startsWith('/api/auth/')).length;await fn();await settle();assert.deepEqual(await snapshot(),before,'READ_ONLY_UI_CHANGED_NATIVE_BUSINESS');assert.equal(network.filter(x=>['POST','PATCH','PUT','DELETE'].includes(x.method)&&!x.path.startsWith('/api/auth/')).length,n);}
 async function createCase(code,step){
  const actor=await actorPage(caseRoles[code],{profileKey:'case-'+code}),groups=await scope(actor);
  if(code==='A'||code==='D')assert(groups.length>1,'MULTIPLE_NATIVE_GROUPS_REQUIRED');
  if(code==='B')assert.equal(groups.length,1,'UNIQUE_NATIVE_GROUP_REQUIRED');if(code==='C')assert.equal(groups.length,0,'ZERO_NATIVE_GROUP_ACTOR_REQUIRED');
  if(!j.cases[code]){j.cases[code]={role:actor.role,title:'SYNTHETIC WF01 '+j.runId+' '+code,groupId:code==='C'?null:groups[0].id};ledger.persist();}
  assert(!j.cases[code].id,'CASE_ALREADY_HAS_INTENT_USE_READONLY_RECONCILE');
  await ready(actor.page);await actor.page.locator('#research-project-title').fill(j.cases[code].title);
  if(code!=='C')await actor.page.locator('#research-project-question').fill('仅合成软件流程验证，不包含真实患者信息。');
  if(groups.length>1){assert.equal(await actor.page.locator('#research-project-group').inputValue(),'');assert.equal(await button(actor.page,'保存并准备研究').isDisabled(),true);await actor.page.locator('#research-project-group').selectOption(j.cases[code].groupId);}
  if(groups.length===1){assert.equal(await actor.page.locator('#research-project-group').count(),0);assert(await actor.page.getByText('研究组：'+groups[0].name,{exact:true}).count());}
  if(code==='C'){
   assert.equal(await button(actor.page,'保存并准备研究').isDisabled(),true);assert.equal(await actor.page.locator('#research-project-question').inputValue(),'');
   await actor.page.getByRole('link',{name:'返回我的课题',exact:true}).click();const dialog=actor.page.getByRole('dialog');await dialog.waitFor();
   for(let i=0;i<6;i++){await actor.page.keyboard.press('Tab');assert(await dialog.evaluate(n=>n.contains(document.activeElement)),'LEAVE_DIALOG_TAB_ESCAPED');}
   await actor.page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await actor.page.locator('#research-project-title').inputValue(),j.cases[code].title);
   assert(await actor.page.getByRole('link',{name:'返回我的课题',exact:true}).evaluate(n=>n===document.activeElement),'ESC_MUST_RESTORE_TRIGGER_FOCUS');
   await actor.page.locator('#research-project-title').focus();expectedUnload='dismiss';await actor.page.reload({timeout:1500}).catch(()=>{});assert(dialogs.some(d=>d.type==='beforeunload'),'REAL_BEFOREUNLOAD_REQUIRED');assert.equal(await actor.page.locator('#research-project-title').inputValue(),j.cases[code].title);
  }
  await capture(code+'-before');
  const actions=code==='C'||code==='D'?['intent.create']:['intent.create','study.create'];
  if(!await begin(code,step,{actions,drop:code==='D'?'intent.create':null,authVersion:actor.auth.authVersion}))return;
  await button(actor.page,code==='C'?'保存草稿':'保存并准备研究').click();
  if(code==='D'){await button(actor.page,'核对上次操作').waitFor();await settle();assert.equal(currentStep.requests.length,1);assert(currentStep.requests[0].responseDiscarded);await markers(actor.page,'D-save-loss');await capture('D-save-loss');}
  else if(code==='C'){await actor.page.waitForURL(u=>u.searchParams.get('projectIntentId')===j.cases.C.id);await button(actor.page,'保存草稿').waitFor();assert(!j.cases.C.study);await capture('C-incomplete-draft-saved');}
  else await s11(actor,code);
  for(const request of currentStep.requests)await proof(request,actor);
  await finish({nativeActions:actions,partialSaved:code==='D'});
 }
 async function existingA(step){
  assert(j.cases.A?.study,'A_CREATE_MUST_BE_VERIFIED_FIRST');const actor=await actorPage('admin',{profileKey:'case-A'}),page=actor.page,id=j.cases.A.id;
  await ready(page,id);
  if(step==='enter'){
   if(!await begin('A',step))return;await noBusinessDuring(async()=>{await button(page,'进入研究准备').click();await s11(actor,'A');});await finish({businessWrites:0});return;
  }
  if(step==='edit'){
   const title=j.cases.A.title+' · 已编辑';await page.locator('#research-project-title').fill(title);
   if(!await begin('A',step,{actions:['intent.update'],authVersion:actor.auth.authVersion}))return;
   await button(page,'保存并准备研究').click();await s11(actor,'A');assert.equal(currentStep.requests.length,1);await proof(currentStep.requests[0],actor);await finish({studyCreatePosts:0});return;
  }
  // Native UI winner + stale UI loser; no API write and no new object.
  const loser=await actor.context.newPage();watch(loser,'admin');await ready(loser,id);await loser.locator('#research-project-question').fill('SYNTHETIC stale input must remain');
  await page.locator('#research-project-question').fill('SYNTHETIC native second-tab winner');
  if(!await begin('A',step,{actions:['intent.update'],authVersion:actor.auth.authVersion}))return;
  await button(page,'保存草稿').click();await button(page,'进入研究准备').waitFor();await settle();assert.equal(currentStep.requests.length,1);await proof(currentStep.requests[0],actor);
  gate.used.clear();gate.expectedStatus=409;activePage=loser;await button(loser,'保存草稿').click();await button(loser,'核对最新版本').waitFor();await settle();assert.equal(currentStep.requests.length,2);assert.equal(currentStep.requests[1].nativeStatus,409);assert.equal(await loser.locator('#research-project-question').inputValue(),'SYNTHETIC stale input must remain');
  await button(loser,'核对最新版本').click();await loser.getByRole('dialog').waitFor();await loser.keyboard.press('Escape');assert.equal(await loser.locator('#research-project-question').inputValue(),'SYNTHETIC stale input must remain');await capture('A-real-CAS-retained',loser);await finish({nativeWinner:1,rejectedCAS:1,inputRetained:true});
 }
 async function continueAChild(){
  const original=j.steps['A.create'],c=j.cases.A;
  assert.equal(original?.status,'native-confirmed-ui-unverified','ORIGINAL_CREATE_MUST_BE_RECONCILED_READONLY');
  assert.equal(original.requests.length,1,'ONLY_ORIGINAL_PARTIAL_SAVE_MAY_CONTINUE');
  const saved=original.requests[0];assert.equal(saved.action,'intent.create');assert.equal(saved.nativeStatus,201);assert(saved.serverConfirmedAt&&saved.proof?.id===c?.id,'ORIGINAL_RECEIPT_PROOF_REQUIRED');assert(!c.study,'NO_CHILD_CREATE_IF_STUDY_ALREADY_EXISTS');
  const actor=await actorPage('admin',{profileKey:'case-A',reuse:true}),page=actor.page;
  assert(page.url().includes('/pages/q01/'),'ORIGINAL_A_TAB_REQUIRED_NO_MARKER_INJECTION');
  if(!await begin('A','continue-child'))return;
  const entries=await markers(page,'A-original-partial-save'),pending=entries.some(([,text])=>JSON.parse(text).pending?.requestKey===saved.requestKey);
  assert(pending||currentStep.saveUIReceiptConfirmedAt&&entries.some(([,text])=>{const marker=JSON.parse(text);return marker.projectId===c.id&&!marker.pending;}),'ORIGINAL_REAL_PENDING_MARKER_REQUIRED');
  if(pending){
   await noBusinessDuring(async()=>{
    const response=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/research-projects/receipts/'+saved.requestKey);
    await button(page,'核对上次操作').click();const actual=await response;assert.equal(actual.status(),200);const value=await actual.json();verifyReceipt(saved,value,actor.auth.authVersion);assert.equal(value.item.id,c.id);assert(!value.current?.item?.study,'STUDY_ALREADY_EXISTS_STOP_NO_DUPLICATE');
    await button(page,'保存并准备研究').waitFor();currentStep.saveUIReceiptConfirmedAt=new Date().toISOString();currentStep.originalPendingObservedAt=new Date().toISOString();ledger.persist();event('original-save-confirmed-through-real-UI-GET',{requestKey:saved.requestKey,id:c.id});
   });
  }
  const current=await actor.context.request.get(base+'/api/research-projects/'+c.id);assert.equal(current.status(),200);const detail=await current.json();assert(!detail.item.study);assert.equal(detail.item.id,c.id);
  gate={role:'admin',code:'A',actions:['study.create'],authVersion:actor.auth.authVersion,used:new Set()};
  event('explicit-continue-child-intent',{parentStep:'A.create',projectId:c.id,expectedNativeActions:['study.create'],normalOneClick:false});
  await button(page,'保存并准备研究').click();await s11(actor,'A');await settle();assert.equal(currentStep.requests.length,1);assert.equal(currentStep.requests[0].action,'study.create');await proof(currentStep.requests[0],actor);
  original.status='failed-partial-save-reconciled';original.continuedBy='A.continue-child';original.normalOneClick=false;ledger.persist();
  await finish({nativeActions:['study.create'],parentStep:'A.create',normalOneClick:false,originalFailurePreserved:true});
 }
 async function recoveryD(step){
  assert(j.cases.D?.id,'D_SAVE_LOSS_REQUIRED');const actor=await actorPage('admin',{profileKey:'case-D',reuse:true}),page=actor.page,c=j.cases.D;
  // Reuse the persisted real tab. A fresh page would have no sessionStorage evidence.
  if(step!=='new-tab')assert(page.url().includes('/pages/q01/'),'ORIGINAL_D_TAB_MUST_REMAIN_OPEN_FOR_SESSION_STORAGE');
  if(!await begin('D',step,{actions:step==='study-loss'?['study.create']:[],drop:step==='study-loss'?'study.create':null,authVersion:actor.auth.authVersion}))return;
  if(step==='new-tab'){
   const fresh=await actor.context.newPage();watch(fresh,'admin');activePage=fresh;
   await noBusinessDuring(async()=>{await ready(fresh,c.id);assert.equal((await markers(fresh,'D-new-tab')).length,0);await button(fresh,'进入研究准备').click();await s11({...actor,page:fresh},'D');});await finish({privateReceiptClaimed:false,businessWrites:0});return;
  }
  if(step==='study-loss'){
   assert(j.steps['D.recover-save']?.status==='verified');await button(page,'保存并准备研究').click();await button(page,'核对上次操作').waitFor();await settle();assert.equal(currentStep.requests.length,1);assert(currentStep.requests[0].responseDiscarded);await markers(page,'D-study-loss');await proof(currentStep.requests[0],actor);await capture('D-study-loss');await finish({realStudy200Discarded:true});return;
  }
  const prior=step==='recover-save'?j.steps['D.save-loss']:j.steps['D.study-loss'];assert.equal(prior?.status,'verified');const original=prior.requests[0];
  // Chrome restores sessionStorage, but sticky user activation does not survive restart.
  await page.locator('#research-project-title').click();
  expectedUnload='accept';await noBusinessDuring(async()=>{await page.reload();await button(page,'核对上次操作').waitFor();await markers(page,'D-'+step+'-refreshed');});expectedUnload='dismiss';
  await noBusinessDuring(async()=>{
   const request=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/research-projects/receipts/'+original.requestKey);
   await button(page,'核对上次操作').click();const response=await request;assert.equal(response.status(),200);verifyReceipt(original,await response.json(),actor.auth.authVersion);
   await button(page,step==='recover-save'?'保存并准备研究':'进入研究准备').waitFor();
   original.uiGETConfirmedAt=new Date().toISOString();ledger.persist();event('original-receipt-confirmed-in-refreshed-UI',{requestKey:original.requestKey});
   if(step==='recover-study'){await button(page,'进入研究准备').click();await s11(actor,'D');}
  });
  await capture('D-'+step);await finish({businessWrites:0,originalKey:original.requestKey});
 }
 async function reconcile(){
  // Every uncertain native intent is proved by its original authorized GET, never a POST.
  for(const role of ['admin','reviewer','collector']){
   const pending=Object.values(j.steps).filter(s=>s.role===role&&!['verified','failed-partial-save-reconciled'].includes(s.status)&&s.requests?.some(receiptCandidate));if(!pending.length)continue;
   const actor=await actorPage(role,{profileKey:'reconcile-'+role});
   for(const step of pending){currentStep=step;stage='reconcile:'+step.id;for(const request of step.requests.filter(receiptCandidate)){
     if(request.rejected&&!knownRejected(request)){const previous=request.rejected;request.rejected=false;request.classificationCorrection={at:new Date().toISOString(),previousRejected:previous,correctedRejected:false,nativeStatusPreserved:request.nativeStatus,reason:'QA previously treated native intent.create 201 as rejection; controller contract is create=201, other actions=200'};request.currentContractExpectedStatus=expectedNativeStatus(request.action);ledger.persist();event('qa-status-classification-corrected',{requestKey:request.requestKey,...request.classificationCorrection});}
     await proof(request,actor);
    }
    // Reconciliation proves native state, not an omitted UI assertion. Keep it blocked until reviewed.
    step.status='native-confirmed-ui-unverified';ledger.persist();event('reconciled-no-write',{next:'inspect accepted actions and resume only the next named UI step; do not replay this step'});
   }
  }
  report.checks.push('original_receipts_GET_only_no_replay');
 }
 async function verifyUI(){
  const id=options.code+'.'+options.step,step=j.steps[id];assert(step,'ORIGINAL_STEP_REQUIRED');
  if(step.status==='verified'){report.checks.push(id+':skipped-verified');return;}
  assert.equal(step.status,'native-confirmed-ui-unverified','RECONCILE_ORIGINAL_RECEIPTS_FIRST');
  const actor=await actorPage(step.role,{profileKey:'case-'+options.code,reuse:options.code==='D'}),c=j.cases[options.code];currentStep=step;stage='verify-ui:'+id;
  await noBusinessDuring(async()=>{
   for(const request of step.requests.filter(receiptCandidate))await proof(request,actor);
   if(options.code==='D'){
    assert(['save-loss','study-loss'].includes(options.step),'READ_ONLY_D_RECOVERY_STEP_NEEDS_ITS_ORIGINAL_UI_CHECK');
    assert(step.requests.length===1&&step.requests[0].responseDiscarded,'REAL_RESPONSE_DISCARD_REQUIRED');
    assert(actor.page.url().includes('/pages/q01/'),'ORIGINAL_D_TAB_REQUIRED');await button(actor.page,'核对上次操作').waitFor();const entries=await markers(actor.page,'D-resumed-'+options.step);assert(entries.some(([,text])=>JSON.parse(text).pending?.requestKey===step.requests[0].requestKey),'ORIGINAL_REAL_MARKER_REQUIRED');
   }else if(options.step==='cas'){
    assert.equal(step.requests.length,2,'ORIGINAL_CAS_WINNER_AND_REJECTED_LOSER_REQUIRED');assert.equal(step.requests[0].nativeStatus,200);assert.equal(step.requests[1].nativeStatus,409);
    const stale=actor.context.pages().find(p=>p.url().includes('projectIntentId='+c.id)&&p!==actor.page);assert(stale,'ORIGINAL_STALE_TAB_REQUIRED_NO_RECONSTRUCTION');watch(stale,step.role);activePage=stale;
    assert.equal(await stale.locator('#research-project-question').inputValue(),'SYNTHETIC stale input must remain');await button(stale,'核对最新版本').waitFor();
   }else{
    const expected=options.step==='create'?['intent.create','study.create']:options.step==='draft'?['intent.create']:['intent.update'];assert.deepEqual(step.requests.map(r=>r.action),expected,'NATIVE_ACTION_SET_INCOMPLETE_NO_AUTOMATIC_WRITE_CONTINUATION');
    await ready(actor.page,c.id);const native=await actor.context.request.get(base+'/api/research-projects/'+c.id);assert.equal(native.status(),200);const value=await native.json();assert.equal(await actor.page.locator('#research-project-title').inputValue(),value.item.title);
    if(options.code==='C'){assert(!value.item.study);assert.equal(await actor.page.locator('#research-project-question').inputValue(),'');}
    else{assert.equal(value.item.study?.id,c.study?.id);await button(actor.page,'进入研究准备').click();await s11(actor,options.code);}
   }
   await capture('readonly-resumed-'+id.replace('.','-'));ledger.verified(step,{resumedWithOriginalGETOnly:true,resumeEvidence:out});
  });
  currentStep=null;report.checks.push(id+':verified-readonly-with-original-receipts');
 }
 async function boundaries(){
  assert(j.cases.A?.study);const admin=await actorPage('admin',{profileKey:'boundary-admin'}),collector=await actorPage('collector',{profileKey:'boundary-collector'});const id=j.cases.A.id;
  stage='boundaries:other-actor';
  await noBusinessDuring(async()=>{
   const source=j.steps['A.create'].requests.find(r=>r.action==='intent.create');const denied=await collector.context.request.get(base+receiptPath(source));assert([403,404].includes(denied.status()));
   const project=await collector.context.request.get(base+'/api/research-projects/'+id);assert([403,404].includes(project.status()));
   save(out+'other-actor-denied.json',{actorId:collector.auth.accountId,receiptStatus:denied.status(),projectStatus:project.status(),sourceActorId:source.actorId,noCredentialsCopied:true});
   const unknown=await admin.context.request.get(base+'/api/research-projects/receipts/'+randomUUID()+'?'+new URLSearchParams({action:'intent.create',requestHash:'0'.repeat(64)}));assert.equal(unknown.status(),404);report.checks.push('native_unknown_key_GET_404_no_POST_not_UI_recovery_claim');
  });
  // Deliver a real old authorized 200 only after actual same-context identity changes.
  stage='boundaries:late-read';const page=admin.page;activePage=page;activeRole='admin';await ready(page,id);
  let release,seen;const held=new Promise(r=>release=r),received=new Promise(r=>seen=r);let once=true;
  await page.route('**/api/research-projects/'+id,async route=>{if(once&&route.request().method()==='GET'){once=false;const response=await route.fetch();assert.equal(response.status(),200);seen();await held;await route.fulfill({response}).catch(()=>{});}else await route.continue();});
  try{
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(Error('LATE_READ_NOT_OBSERVED')),15000))]);
   const identity=identitiesByRole.collector;await loginBrowserContext(admin.context,{tenantSlug:h.runtime.ids.tenant,username:identity.username,password:identity.password,expectedActorId:identity.id});activeRole='collector';
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('qiyan:auth-refresh')));
   await page.getByRole('alert').waitFor({timeout:15000});release();await page.waitForTimeout(150);
   assert.equal(await page.locator('#research-project-title').count(),0,'OLD_ACTOR_LATE_BODY_REAPPEARED');await capture('late-old-admin-200-after-real-collector-login');report.checks.push('real_cookie_identity_switch_rejects_late_old_200');
  }finally{release?.();await page.unroute('**/api/research-projects/'+id);}
 }
 async function measure(page,name,{physical=false}={}){
  await page.locator('#research-project-title').waitFor();const dom=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight,devicePixelRatio,documentScrollWidth:document.documentElement.scrollWidth,visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},controls:[...document.querySelectorAll('.rh-project-creation label,.rh-project-creation textarea,.rh-project-creation input,.rh-project-creation select,.rh-project-actions button')].map(e=>({tag:e.tagName,id:e.id,text:e.tagName==='BUTTON'?e.textContent.trim():null,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,rect:e.getBoundingClientRect().toJSON()}))}));
  const isNew=!new URL(page.url()).searchParams.has('projectIntentId'),main=button(page,isNew?'保存并准备研究':'进入研究准备');await main.waitFor({state:'visible'});
  dom.primaryAction=await main.evaluate(e=>({text:e.textContent.trim(),visible:e.getClientRects().length>0&&getComputedStyle(e).visibility==='visible',fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,rect:e.getBoundingClientRect().toJSON()}));
  dom.formState=isNew?'new-empty-multiple-groups':'existing-study';
  dom.nativeSelectTypography=await page.locator('.rh-project-creation select').evaluateAll(elements=>elements.map(e=>{
   const declarations=[];
   const read=rules=>{for(const rule of rules){if(rule.conditionText&&rule.media&&!matchMedia(rule.conditionText).matches)continue;if(rule.cssRules)read(rule.cssRules);if(rule.selectorText&&rule.style?.lineHeight){try{if(e.matches(rule.selectorText))declarations.push({selector:rule.selectorText,lineHeight:rule.style.lineHeight});}catch{}}}};
   for(const sheet of document.styleSheets){try{read(sheet.cssRules);}catch{}}
   return{id:e.id,appearance:getComputedStyle(e).appearance,computedLineHeight:getComputedStyle(e).lineHeight,declarations};
  }));
  save(out+name+'-dom-before-assertions.json',dom);
  dom.groupSelector=await page.locator('#research-project-group').evaluateAll(elements=>elements.map(e=>({value:e.value,optionCount:e.options.length,rect:e.getBoundingClientRect().toJSON()})));
  if(isNew){assert.equal(await page.locator('#research-project-title').inputValue(),'');assert.equal(await page.locator('#research-project-question').inputValue(),'');assert.equal(dom.groupSelector.length,1,'NEW_FORM_MULTIPLE_GROUP_SELECTOR_REQUIRED');assert.equal(dom.groupSelector[0].value,'','VISUAL_MUST_NOT_SELECT_A_GROUP');}
  assert(dom.documentScrollWidth<=dom.innerWidth+1,'HORIZONTAL_PAGE_OVERFLOW');
  assert(dom.primaryAction.visible,'PRIMARY_ACTION_MUST_BE_VISIBLE');assert.equal(dom.primaryAction.fontSize,'14px');assert.equal(dom.primaryAction.lineHeight,'22px');
  assert(dom.primaryAction.rect.top>=0&&dom.primaryAction.rect.bottom<=dom.innerHeight+1&&dom.primaryAction.rect.left>=0&&dom.primaryAction.rect.right<=dom.innerWidth+1,'PRIMARY_ACTION_MUST_NOT_BE_CLIPPED');assert(dom.primaryAction.scrollWidth<=dom.primaryAction.clientWidth+1,'PRIMARY_ACTION_TEXT_MUST_NOT_BE_CLIPPED');
  for(const control of dom.controls){
   assert.equal(control.fontSize,'14px','WF01_OPERATION_FONT:'+control.tag+':'+control.id);
   if(control.tag==='SELECT'&&control.lineHeight==='normal'){
    const native=dom.nativeSelectTypography.find(x=>x.id===control.id);
    assert.equal(native?.appearance,'auto','ONLY_NATIVE_SELECT_MAY_REPORT_NORMAL_LINE_HEIGHT');
    assert(native.declarations.some(x=>x.lineHeight==='22px'),'NATIVE_SELECT_MUST_RETAIN_AUTHORED_22PX');
    assert(control.rect.height>=40,'NATIVE_SELECT_MUST_RETAIN_40PX_TARGET');
    native.platformComputedException=true;
   }else assert.equal(control.lineHeight,'22px','WF01_OPERATION_LINE_HEIGHT:'+control.tag+':'+control.id);
   assert(control.rect.right<=dom.innerWidth+1&&control.rect.left>=-1,'CONTROL_CLIPPED:'+control.id);
  }
  if(physical){
   const cdp=await page.context().newCDPSession(page),layout=await cdp.send('Page.getLayoutMetrics');
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
   const bytes=Buffer.from(shot.data,'base64'),png={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
   writeFileSync(out+name+'-raw-physical.png',bytes,{mode:0o600});await cdp.detach();assert.equal(png.width,1440,'RAW_NATIVE_200_PHYSICAL_WIDTH_REQUIRED');assert.equal(dom.innerWidth,720,'REAL_CHROME_200_REQUIRED');measurements.push({name,dom,layout,png,captureMethod:'raw CDP no clip'});
  }else{await page.screenshot({path:out+name+'.png',fullPage:true});measurements.push({name,dom});}
  save(out+'measurements.json',measurements);
 }
 async function visual(){
  assert(j.cases.A?.id);const actor=await actorPage('admin',{profileKey:'visual'}),page=actor.page;activePage=page;activeRole='admin';stage='visual';
  async function tail(page,name,physical=false){
   const group=page.locator('#research-project-group');await group.scrollIntoViewIfNeeded();
   const rect=await group.boundingBox(),viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
   assert(rect&&rect.x>=0&&rect.x+rect.width<=viewport.width+1&&rect.y>=0&&rect.y+rect.height<=viewport.height+1,'GROUP_CONTROL_MUST_BE_REACHABLE_BY_SCROLL');
   save(out+name+'-tail-position.json',{rect,viewport});
   if(physical){const cdp=await page.context().newCDPSession(page),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const bytes=Buffer.from(shot.data,'base64');assert.equal(bytes.readUInt32BE(16),1440);writeFileSync(out+name+'-tail-raw-physical.png',bytes,{mode:0o600});await cdp.detach();}
   else await page.screenshot({path:out+name+'-tail.png',fullPage:false});
  }
  await noBusinessDuring(async()=>{
   for(const[width,height]of [[1440,1000],[1920,1200],[1366,768],[390,844],[320,844]]){await page.setViewportSize({width,height});await ready(page,j.cases.A.id);await measure(page,'q01-'+width);await ready(page,undefined);await measure(page,'q01-new-'+width);if(width<=390)await tail(page,'q01-new-'+width);}
  });
  const native=await actorPage('admin',{profileKey:'native200',native:true});let settings;
  try{settings=await native.context.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');assert.equal(await settings.locator('#zoomLevel').inputValue(),'2');activePage=native.page;activeRole='admin';await noBusinessDuring(async()=>{await ready(native.page,j.cases.A.id);await measure(native.page,'q01-native200',{physical:true});await ready(native.page,undefined);await measure(native.page,'q01-new-native200',{physical:true});await tail(native.page,'q01-new-native200',true);});}
  finally{if(settings){await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('1');}}
  report.checks.push('new_empty_and_existing_study_at_five_widths_and_native200_no_business_writes');
 }
 async function audit(){
  stage='native-audit';const actual=await snapshot();assert(actual.intents.length<=4,'FOUR_INTENT_LIMIT');
  for(const[code,c]of Object.entries(j.cases).filter(([,c])=>c.id)){
   const row=actual.intents.find(x=>x.id===c.id);assert(row,'NEW_CASE_ID_MISSING');assert.equal(row.owner_id,identitiesByRole[c.role].id);
   const bindings=actual.bindings.filter(x=>x.project_intent_id===c.id);assert.equal(bindings.length,c.study?1:0,'EXACTLY_ONE_NATIVE_STUDY_OR_ZERO_DRAFT');
   if(c.study){assert.equal(bindings[0].id,c.study.id);assert.equal(bindings[0].study_group_id,c.groupId);}
   const operations=actual.operations.filter(x=>x.target_id===c.id);
   assert.equal(operations.filter(x=>x.action==='intent.create').length,1);assert.equal(operations.filter(x=>x.action==='study.create').length,c.study?1:0);
   for(const operation of operations){assert(Number.isSafeInteger(operation.receipt?.authVersion)&&operation.receipt.authVersion>=0,'NATIVE_AUTH_VERSION_REQUIRED_ZERO_IS_VALID');assert.equal(operation.receipt.requestHash,operation.request_hash);assert(actual.audits.some(a=>a.id===operation.audit_id&&a.accountId===operation.actor_id));}
   if(code==='C'){assert.equal(row.status,'draft');assert.equal(row.questionHash,sha(''));}
  }
  save(out+'native-audit.json',{at:new Date().toISOString(),readOnly:true,...actual});report.checks.push('native_PG_exact_operation_receipt_audit_chain_no_duplicate_study');
 }
 try{
  await protection('before');
  if(options.mode==='case'){
   const old=j.steps[options.code+'.'+options.step];
   if(old?.status==='verified')report.checks.push(old.id+':skipped-verified');
   else{
    const index=steps[options.code].indexOf(options.step);
    if(options.code==='A'){
     if(options.step==='continue-child')assert.equal(j.steps['A.create']?.status,'native-confirmed-ui-unverified','RECONCILE_ORIGINAL_SAVE_FIRST');
     else if(options.step!=='create'){
      assert(j.steps['A.create']?.status==='verified'||j.steps['A.continue-child']?.status==='verified','A_STUDY_MUST_BE_VERIFIED_OR_EXPLICITLY_CONTINUED');
      for(const prior of ['enter','edit','cas'].slice(0,['enter','edit','cas'].indexOf(options.step)))assert.equal(j.steps['A.'+prior]?.status,'verified','PRIOR_STEP_MUST_BE_VERIFIED:'+prior);
     }
    }else for(const prior of steps[options.code].slice(0,index))assert.equal(j.steps[options.code+'.'+prior]?.status,'verified','PRIOR_STEP_MUST_BE_VERIFIED:'+prior);
    mayExecuteStep(old);
    if(options.step==='create'||options.step==='draft'||options.step==='save-loss')await createCase(options.code,options.step);
    else if(options.code==='A'&&options.step==='continue-child')await continueAChild();else if(options.code==='A')await existingA(options.step);else await recoveryD(options.step);
   }
  }else if(options.mode==='reconcile')await reconcile();else if(options.mode==='verify-ui')await verifyUI();else if(options.mode==='boundaries')await boundaries();else if(options.mode==='visual')await visual();else await audit();
  await settle();assert.deepEqual(blockedWrites,[],'UNINTENDED_BUSINESS_WRITES_BLOCKED');assert.deepEqual(pageErrors,[]);
  const unexpected=consoleErrors.filter(e=>!e.message.includes('net::ERR_FAILED')&&!e.message.includes('the server responded with a status of 409')&&!e.message.includes('the server responded with a status of 403')&&!e.message.includes('the server responded with a status of 404'));
  assert.deepEqual(unexpected,[],'UNEXPECTED_CONSOLE_ERRORS');assert(dialogs.every(d=>d.type==='beforeunload'),'UNEXPECTED_BROWSER_DIALOG');
  await protection('after');report.passed=true;
 }catch(error){failure=error;report.error=String(error.message).slice(0,1500);report.failedStage=stage;
  if(currentStep){currentStep.failure={at:new Date().toISOString(),stage,message:report.error,evidence:out};ledger.persist();}
  await capture('failure-active-'+(activeRole??'none')).catch(()=>{});save(out+'failure-native-readonly.json',await snapshot().catch(e=>({error:String(e.message)})));
 }finally{
  gate=null;await Promise.allSettled([...routeTasks]);
  for(const context of contexts){for(const page of context.pages())if(page.url().startsWith(base))await page.screenshot({path:out+'closing-'+randomUUID().slice(0,8)+'.png',fullPage:false}).catch(()=>{});await context.close().catch(e=>{report.closeError=String(e.message);});}
  report.finishedAt=new Date().toISOString();save(out+(report.passed?'result':'failure')+'.json',report);
 }
 console.log(JSON.stringify({passed:report.passed,stage,evidence:out,checkpoint:privateDir+'browser-checkpoints.json',newIntents:Object.values(j.cases).filter(x=>x.id).length,unverified:Object.values(j.steps).filter(x=>x.status!=='verified').map(x=>x.id)}));
 if(failure)throw failure;return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const options=parseArgs(process.argv.slice(2));if(options.help)console.log(help);else await runWF01(options);}
