// Root-only actual UI acceptance; frozen synthetic scope, native writes armed once.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {openWF04Context,wf04Private,wf04Evidence,verifyWF04Freeze} from './study-workflow-wf04-root-context.mjs';
import {createWF04UiLedger,installWF04NativeGate,assertWF04UiReceipt} from './study-workflow-wf04-browser.mjs';
import {requireWF04Window} from './study-workflow-wf04-preserve.mjs';
import {json,save,bodyHash} from './study-workflow-wf01-qa.mjs';
import {subjectUrl} from '../src/research-subjects-session.js';
const origin='http://127.0.0.1:19501',ledgerPath=wf04Private+'ui-ledger.json';
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const output=label=>wf04Evidence+'root/'+label+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,5)+'/';
export async function verifyWF04UiDatabase(root,ledger){
 const proofs=[];
 for(const e of ledger.snapshot().attempts.filter(e=>e.accepted)){
  const c=root.cases[e.code],proof=await root.h.read(async tx=>{
   const [op]=await tx.$queryRaw`SELECT * FROM rh_research.operation WHERE tenant_id=${root.h.runtime.ids.tenant} AND actor_id=${e.actorId} AND request_key=${e.requestKey}`;
   assert(op);assert.equal(op.request_hash,e.requestHash);assert.equal(op.action,e.action==='create'?'subject.create':'participation.'+(e.action==='enroll'?'enroll':'record'));assert.equal(op.target_id,e.action==='create'?c.studyId:e.subjectId);assert.equal(op.id,e.operationId);assert.equal(op.result.receipt.id,op.id);
   if(e.action==='create'){assert.equal(op.result.studyId,c.studyId);assert.equal(op.result.subject.id,e.subjectId);assert.equal(op.result.subject.subjectId,c.pseudonym);assert.equal(op.result.receipt.requestKey,e.requestKey);assert.equal(op.result.receipt.action,'subject.create');assert.equal(op.result.receipt.targetId,c.studyId);}else assertWF04UiReceipt(e,op.result);
   const sub=await tx.subject.findUnique({where:{id:e.subjectId}});assert(sub);for(const [k,v]of Object.entries({tenantId:root.h.runtime.ids.tenant,studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId,subjectId:c.pseudonym,createdBy:c.actorId,acceptanceFixture:false}))assert.equal(sub[k],v);for(const k of ['group','sex','age','syndrome','clinicalLabelSource','consentScope'])assert.equal(sub[k],null);
   const wrapper=await tx.auditLog.findUnique({where:{id:op.audit_id}});assert(wrapper);assert.equal(wrapper.action,'researchhub.'+op.action);assert.equal(wrapper.accountId,e.actorId);assert.equal(wrapper.studyGroupId,c.studyGroupId);assert.equal(wrapper.researchProjectId,c.executionProjectId);assert.equal(wrapper.target,e.action==='create'?c.pseudonym:e.subjectId);assert.equal(wrapper.meta.requestKey,e.requestKey);
   let target=c.pseudonym,action='create_subject';
   if(e.action!=='create'){
    assert.equal(wrapper.meta.requestHash,e.requestHash);assert.equal(wrapper.meta.authVersion,e.authVersion);
    if(e.action==='enroll'){const row=await tx.studyEnrollment.findUnique({where:{id:e.enrollmentId}});assert(row);assert.equal(row.subjectId,e.subjectId);assert.equal(row.protocolVersionId,c.protocolId);assert.equal(row.status,'enrolled');assert.equal(row.createdBy,e.actorId);target=row.id;action='study_enroll';}
    else{const row=await tx.studyParticipationEvent.findUnique({where:{id:e.eventId}});assert(row);assert.equal(row.subjectId,e.subjectId);assert.equal(row.protocolVersionId,c.protocolId);assert.equal(row.policyVersionId,c.policyId);assert.equal(row.policyHash,c.policyHash);assert.equal(row.recordedBy,e.actorId);assert.equal(row.kind,e.action);assert.equal(row.sequence,e.eventSequence);assert.equal(bodyHash(Object.fromEntries(e.eventFields.map(k=>[k,k==='effectiveAt'?new Date(row[k]).toISOString():row[k]]))),e.eventHash,'ACTUAL_STORED_FACT_MUST_MATCH_ORIGINAL_INPUT_HASH');target=row.id;action='study_participation_record';}
   }
   const core=await tx.auditLog.findMany({where:{tenantId:root.h.runtime.ids.tenant,studyGroupId:c.studyGroupId,accountId:e.actorId,action,target}});assert.equal(core.length,1);
   return{code:e.code,sequence:e.sequence,operationId:op.id,requestKey:e.requestKey,requestHash:op.request_hash,action:op.action,subjectId:e.subjectId,wrapperAuditId:wrapper.id,wrapperMetaHash:bodyHash(wrapper.meta),coreAuditId:core[0].id,coreMetaHash:bodyHash(core[0].meta)};
  });proofs.push(proof);
 }
 assert.equal(new Set(proofs.flatMap(p=>[p.wrapperAuditId,p.coreAuditId])).size,proofs.length*2);return proofs;
}
async function main(){
 requireWF04Window();const [flag,mode,code]=process.argv.slice(2);assert.equal(flag,'--local-synthetic');assert(['create','create-resume','records','screen','consent-drop','continue','enroll-drop','enroll','failed','recover','inspect','audit'].includes(mode));assert(['A','B','D'].includes(code));
 verifyWF04Freeze(wf04Evidence+'implementation-freeze-v2.json');
 const out=output('ui-'+code+'-'+mode);let root,ledger,context,gate,page;
 try{
  root=await openWF04Context();ledger=createWF04UiLedger({cases:root.cases,initial:existsSync(ledgerPath)?json(ledgerPath):undefined,persist:s=>save(ledgerPath,s)});
  if(mode==='audit'){const proof=await verifyWF04UiDatabase(root,ledger);assert.deepEqual(ledger.counts().total,12);assert(ledger.snapshot().attempts.filter(e=>e.accepted).every(e=>e.verified));save(out+'database-audit.json',{proofs:proof,businessAuditCount:proof.length*2});save(out+'protection.json',await root.protect('final-ui-audit',{subjectsByCase:ledger.subjectsByCase(),requireComplete:true}));save(out+'root-result.json',{passed:true,readOnly:true,counts:ledger.counts(),businessAuditCount:proof.length*2});process.stdout.write(JSON.stringify({passed:true,evidence:out,counts:ledger.counts()})+'\n');return;}
  const c={...root.cases[code],code},role=code==='B'?'reviewer':'admin',me=await root.login(role),actor={accountId:me.accountId,authVersion:me.authVersion},account=root.accounts[role];
  if(mode==='create-resume'){
   const e=ledger.snapshot().attempts.find(e=>e.code===code&&e.action==='create'&&e.accepted);assert(e,'ORIGINAL_ACCEPTED_CREATE_REQUIRED');assert.equal(e.actorId,actor.accountId);assert.equal(e.authVersion,actor.authVersion);
   if(!e.subjectId||!e.operationId){const original=await root.h.get('/research-studies/'+c.studyId+'/subjects/receipts/'+e.requestKey);await ledger.nativeResult(e.sequence,original);}
   save(out+'create-database-proof.json',await verifyWF04UiDatabase(root,ledger));const original=ledger.get(e.sequence);await ledger.markVerified(e.sequence,{via:'database'});await ledger.bindSubject(code,original.subjectId,c.pseudonym);save(wf04Private+'subjects-by-case.json',ledger.subjectsByCase());save(out+'protection.json',await root.protect('read-only-create-resume',{subjectsByCase:ledger.subjectsByCase()}));save(out+'root-result.json',{passed:true,mode,code,readOnly:true,actualUiRecoveryClaimed:false,counts:ledger.counts()});process.stdout.write(JSON.stringify({passed:true,mode,code,evidence:out,counts:ledger.counts()})+'\n');return;
  }
  context=await chromium.launchPersistentContext(wf04Private+'chrome-'+code,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,viewport:{width:1440,height:1000},args:['--restore-last-session'],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
  const {loginBrowserContext}=await import('./visit-workflow-qa.mjs');await loginBrowserContext(context,{tenantSlug:root.h.runtime.ids.tenant,username:account.username,password:account.password,expectedActorId:actor.accountId});
  page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(20000);
  const markerSnapshot=async candidate=>candidate.evaluate(async()=>{
   const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
   const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(v)))))).map(b=>b.toString(16).padStart(2,'0')).join('');const out=[];
   for(const [key,value]of Object.entries(sessionStorage)){if(!key.startsWith('researchhub:enrollment-check:v1:'))continue;let storageScope;try{storageScope=JSON.parse(decodeURIComponent(key.slice('researchhub:enrollment-check:v1:'.length)));}catch{}try{const r=JSON.parse(value);out.push({key,storageScope,actorId:r.actorId,authVersion:r.authVersion,studyId:r.studyId,subjectId:r.subjectId,createdAt:r.createdAt,index:r.index,lastEventId:r.lastEventId,pending:r.pending?{action:r.pending.action,requestKey:r.pending.requestKey,requestHash:r.pending.requestHash}:null,completed:r.completed,items:await Promise.all(r.items.map(async i=>({kind:i.kind,eventHash:i.event?await hash(i.event):null})))});}catch{out.push({key,storageScope,malformed:true,valueHash:await hash(value)});}}
   return out;
  });
  const ownMarkers=async()=>{const expected=[actor.accountId,actor.authVersion,c.studyId,ledger.subjectsByCase()[code],new URL(page.url()).pathname+new URL(page.url()).search];return(await markerSnapshot(page)).filter(m=>JSON.stringify(m.storageScope)===JSON.stringify(expected));};
  if(['recover','continue'].includes(mode)){
   const observed=[],expected=[actor.accountId,actor.authVersion,c.studyId,ledger.subjectsByCase()[code],subjectUrl('s04',c.studyId,ledger.subjectsByCase()[code])];for(const candidate of context.pages()){if(!candidate.url().startsWith(origin))continue;const markers=await markerSnapshot(candidate).catch(()=>[]);observed.push({url:candidate.url(),markers});if(markers.some(m=>JSON.stringify(m.storageScope)===JSON.stringify(expected)))page=candidate;}save(out+'original-tabs.json',{observed,markerInjected:false});
  }
  gate=await installWF04NativeGate(context,{case:c,actor,ledger});const id=ledger.subjectsByCase()[code];assert(mode==='create'?!id:!!id);
  await page.goto(origin+subjectUrl(mode==='create'?'s03':'s04',c.studyId,id));
  const panel=page.locator('.enrollment-check');
  const shot=async name=>{if(await panel.count())await panel.scrollIntoViewIfNeeded();await page.screenshot({path:out+name+'.png',fullPage:true});};
  const cleanUi=async label=>{
   assert.equal((await ownMarkers()).length,0);assert.equal(await panel.getByRole('button',{name:/^核对上次.*结果$/}).count(),0);save(out+'ui-'+label+'.json',{markerInjected:false,remainingMarkers:0,unknownButtons:0,url:page.url(),actor});
  };
  const markUi=async()=>{for(const e of gate.report.requests.filter(e=>e.accepted))await ledger.markVerified(e.sequence,{via:'ui'});};
  const fill=async(kinds,{failed=false}={})=>{
   await panel.getByLabel('共同决定日期',{exact:true}).fill('2026-11-17');if(kinds.some(k=>k!=='screening'))await panel.getByLabel('共同签署主体',{exact:true}).fill('合成签署主体-'+code);
   const names={screening:'筛选',research_consent:'研究参与同意',data_use_consent:'数据使用同意'};
   for(const k of kinds){await panel.getByLabel(names[k]+'决定',{exact:true}).selectOption(k==='screening'?(failed?'failed':'passed'):'granted');await panel.getByLabel(names[k]+'依据',{exact:true}).fill('WF04合成'+code+'-'+k+'独立依据');if(failed)await panel.getByLabel(names[k]+'原因',{exact:true}).fill('合成编号不满足本轮模拟条件');}
  };
  const recover=async()=>{
   const before=ledger.snapshot().attempts.length,own=await ownMarkers();assert.equal(own.length,1,'ORIGINAL_PENDING_MARKER_REQUIRED');const m=own[0];assert(!m.malformed);assert.equal(m.actorId,actor.accountId);assert.equal(m.authVersion,actor.authVersion);assert.equal(m.studyId,c.studyId);assert.equal(m.subjectId,ledger.subjectsByCase()[code]);assert(m.pending);const e=ledger.snapshot().attempts.filter(e=>e.code===code&&e.requestKey===m.pending.requestKey&&e.requestHash===m.pending.requestHash&&(e.action==='enroll'?'enroll':'record')===m.pending.action).at(-1);assert(e,'ORIGINAL_UNKNOWN_INTENT_REQUIRED');
   const wait=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/participation/receipts/'+e.requestKey));wait.catch(()=>{});await panel.getByRole('button',{name:e.action==='enroll'?'核对上次入组结果':'核对上次记录结果',exact:true}).click();const response=await wait;assert.equal(response.status(),200);const result=await response.json();await ledger.markVerified(e.sequence,{via:'receipt',result});assert.equal(ledger.snapshot().attempts.length,before);
   if(e.action==='enroll'){await panel.getByText('已核对入组结果，现已入组。',{exact:true}).waitFor();await cleanUi('original-enroll-recovered');}else{await panel.getByText('本条记录已核定；请明确继续保存剩余记录。',{exact:true}).waitFor();await panel.getByRole('button',{name:'继续保存剩余记录',exact:true}).waitFor();const after=await ownMarkers();assert.equal(after.length,1);assert.equal(after[0].pending,null);assert.equal(after[0].completed.requestKey,e.requestKey);assert.equal(after[0].completed.requestHash,e.requestHash);assert.equal(after[0].createdAt,m.createdAt);save(out+'record-recovery-ui.json',{before:m,after:after[0],readOnly:true,awaitingExplicitContinue:true});}save(out+'strict-get-original-result.json',{readOnly:true,originalSequence:e.sequence,receipt:result.receipt,subjectId:result.subject.id});
  };
  if(mode==='create'){
   await page.getByLabel('新受试者编号',{exact:true}).waitFor();gate.arm('create');await page.getByLabel('新受试者编号',{exact:true}).fill(c.pseudonym);await page.getByRole('button',{name:'建档',exact:true}).click();await page.waitForURL(u=>u.pathname==='/pages/s04/');await gate.settle();const e=gate.report.requests.at(-1);assert(e?.accepted&&e.subjectId);save(out+'create-database-proof.json',await verifyWF04UiDatabase(root,ledger));await ledger.markVerified(e.sequence,{via:'database'});await ledger.bindSubject(code,e.subjectId,c.pseudonym);save(wf04Private+'subjects-by-case.json',ledger.subjectsByCase());await page.getByRole('heading',{name:c.pseudonym,exact:true}).waitFor();await shot('created');
  }else{
   await panel.waitFor();
   if(['records','screen','failed'].includes(mode)){
    const kinds=mode==='records'?['screening','research_consent','data_use_consent']:['screening'];await fill(kinds,{failed:mode==='failed'});await shot('explicit-inputs');gate.arm(kinds);await panel.getByRole('button',{name:'保存核对记录',exact:true}).click();await panel.getByText(mode==='records'?'核对记录已保存，已满足条件，请确认入组。':'核对记录已保存，当前尚未满足入组条件。',{exact:true}).waitFor();await gate.settle();await cleanUi('records-saved');await markUi();if(mode==='failed')assert.equal(await panel.getByRole('button',{name:'确认入组',exact:true}).count(),0);await shot('records-saved');
   }else if(mode==='consent-drop'){
    await fill(['research_consent','data_use_consent']);gate.arm('research_consent',{dropResponse:true});await panel.getByRole('button',{name:'保存核对记录',exact:true}).click();await panel.getByRole('button',{name:'核对上次记录结果',exact:true}).waitFor();await gate.settle();await shot('consent-response-lost');const originalMarkers=await ownMarkers();assert.equal(originalMarkers.length,1);const dialogs=[],onDialog=async d=>{dialogs.push(d.type());assert.equal(d.type(),'beforeunload');await d.accept();};page.once('dialog',onDialog);try{await page.reload();}finally{page.off('dialog',onDialog);}assert.deepEqual(dialogs,['beforeunload']);save(out+'real-beforeunload.json',{dialogs,markerInjected:false});await panel.getByRole('button',{name:'核对上次记录结果',exact:true}).waitFor();const reloadedMarkers=await ownMarkers();assert.deepEqual(reloadedMarkers,originalMarkers,'REAL_REFRESH_MUST_PRESERVE_ORIGINAL_SCOPE_KEY_HASH_AND_UNSENT_ITEM_HASH');save(out+'original-reload-marker-proof.json',{before:originalMarkers,after:reloadedMarkers,markerInjected:false});await recover();await panel.getByRole('button',{name:'继续保存剩余记录',exact:true}).waitFor();assert.equal(gate.report.requests.length,1);await shot('original-record-recovered-await-explicit-continue');
   }else if(mode==='continue'){
    gate.arm('data_use_consent');await panel.getByRole('button',{name:'继续保存剩余记录',exact:true}).click();await panel.getByText('核对记录已保存，已满足条件，请确认入组。',{exact:true}).waitFor();await gate.settle();await cleanUi('continued');await markUi();await shot('continued');
   }else if(['enroll','enroll-drop'].includes(mode)){
    gate.arm('enroll',mode==='enroll-drop'?{dropResponse:true}:{});await panel.getByRole('button',{name:'确认入组',exact:true}).click();if(mode==='enroll-drop'){await panel.getByRole('button',{name:'核对上次入组结果',exact:true}).waitFor();await gate.settle();await shot('enrollment-response-lost');await recover();}await panel.getByText('已核对入组结果，现已入组。',{exact:true}).waitFor();await gate.settle();await cleanUi('enrolled');if(mode==='enroll')await markUi();await shot('enrolled');
   }else if(mode==='recover'){await recover();await shot('original-recovered');}
   else{await shot('read-only-inspection');save(out+'inspection.json',{url:page.url(),panel:await panel.innerText()});}
  }
  await gate.settle();assert.equal(gate.report.blocked.length,0);save(out+'database-proof.json',await verifyWF04UiDatabase(root,ledger));save(out+'protection.json',await root.protect('native-ui-'+code+'-'+mode,{subjectsByCase:ledger.subjectsByCase()}));save(out+'gate.json',gate.report);save(out+'ledger.json',ledger.snapshot());save(out+'root-result.json',{passed:true,mode,code,counts:ledger.counts()});process.stdout.write(JSON.stringify({passed:true,mode,code,evidence:out,counts:ledger.counts()})+'\n');
 }catch(error){if(gate)save(out+'gate.json',gate.report);if(page){await page.screenshot({path:out+'failure-current.png'}).catch(()=>{});save(out+'failure-current-ui.json',{url:page.url(),text:await page.locator('main').innerText().catch(()=>''),message:['AssertionError','TimeoutError'].includes(error.name)?String(error.message).slice(0,500):undefined});}save(out+'root-result.json',{passed:false,mode,code,error:{name:error.name,message:error.name==='AssertionError'?String(error.message).slice(0,250):undefined},counts:ledger?.counts()});process.stderr.write(JSON.stringify({passed:false,mode,code,evidence:out,errorName:error.name})+'\n');process.exitCode=1;}
 finally{if(gate)await gate.close();if(context){await context.request.post(origin+'/api/auth/logout',{headers:{Origin:origin,'X-ResearchHub-Request':'session-v1'},data:{}}).catch(()=>{});await context.close();}if(root)await root.close();}
}
if(process.argv[1]===new URL(import.meta.url).pathname)await main();
