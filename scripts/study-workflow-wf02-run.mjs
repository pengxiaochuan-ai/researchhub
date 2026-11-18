// Root-invoked checkpoint runner. Importing does not open target, PG, credentials or Chrome.
// Root supplies an authenticated persistent-context page and a read-only protection callback.
import assert from 'node:assert/strict';
import {formalUrl} from '../src/formal-preparation-session.js';
import {save,sha,requireWindow,validateManifest,receiptPath,knownRejected} from './study-workflow-wf02-qa.mjs';
import {installNativeImportGate,captureActualPage,verifyPendingPopup} from './study-workflow-wf02-browser.mjs';

const button=(page,name)=>page.getByRole('button',{name,exact:true});
const summaries=(page,name)=>page.locator('summary').filter({hasText:new RegExp('^'+name+'$')});
export function checkpointPrerequisite(journal,code,name){
 const original=journal.steps[code+'.'+(code==='D'?'import-loss':'import')];
 if(['import','import-loss'].includes(name))assert.equal(journal.steps[code+'.preview']?.status,'verified','PREVIEW_CHECKPOINT_REQUIRED');
 if(name==='recover'){assert.equal(code,'D');assert.equal(original?.requests.length,1);assert.equal(original.requests[0].nativeStatus,200);assert.equal(original.requests[0].responseDiscarded,true);}
 if(['readback','reconcile','verify-ui'].includes(name))assert(original?.requests.some(r=>r.dispatched&&!knownRejected(r)),'ORIGINAL_NATIVE_IMPORT_REQUIRED');
 if(name==='readback')assert.equal(original.status,'verified','IMPORT_UI_MUST_BE_VERIFIED');
 if(name==='verify-ui')assert(original.requests[0].proof,'READONLY_RECEIPT_PROOF_REQUIRED');
 return original;
}

export async function runWF02Checkpoint({manifest,code,step:name,ledger,page,actor,outputDir,protection,governanceUrl,env=process.env,origin='http://127.0.0.1:19501'}){
 requireWindow(env);validateManifest(manifest);assert(manifest.cases[code],'CASE_NOT_IN_FROZEN_PHASE');
 assert.equal(typeof protection,'function','ROOT_READONLY_PROTECTION_CALLBACK_REQUIRED');assert(outputDir.startsWith('/'));
 const c=manifest.cases[code],source=manifest.sources[c.sourceId],context=page.context();
 const report={schema:1,at:new Date().toISOString(),code,step:name,actorId:actor.actorId,authVersion:actor.authVersion,passed:false,network:[],dialogs:[],checks:[]};
 let gate,checkpoint,stage='preflight',acceptUnload=false;
 const persist=()=>save(outputDir+'/checkpoint-result.json',report);
 const capture=label=>captureActualPage(page,{outputDir,label:code+'-'+label,role:c.role,stage,origin,env});
 const responseListener=response=>{const u=new URL(response.url());if(u.origin===origin&&u.pathname.startsWith('/api/')&&!u.pathname.startsWith('/api/auth/')){report.network.push({method:response.request().method(),path:u.pathname,query:u.search,status:response.status()});persist();}};
 const dialogListener=dialog=>{report.dialogs.push({at:new Date().toISOString(),type:dialog.type(),action:dialog.type()==='beforeunload'&&acceptUnload?'accept':'dismiss'});persist();void(dialog.type()==='beforeunload'&&acceptUnload?dialog.accept():dialog.dismiss()).catch(()=>{});};
 async function auth(){const r=await context.request.get(origin+'/api/auth/me');assert.equal(r.status(),200,'ACTOR_RECHECK_FAILED');const me=await r.json();assert.equal(me.accountId,c.actorId);assert.equal(me.authVersion,c.authVersion);assert.equal(actor.actorId,me.accountId);assert.equal(actor.authVersion,me.authVersion);}
 async function ready(protocolId){await page.goto(origin+formalUrl('s11',c.studyId,protocolId));await button(page,'保存方案草稿').waitFor();await page.getByLabel('方案名称',{exact:true}).waitFor({state:'visible'});}
 async function sourceVisible(){const details=page.locator('.ep-template-origin details').filter({hasText:source.protocolId}).first();await details.waitFor();if(!await details.evaluate(n=>n.open))await details.locator('summary').click();assert((await details.innerText()).includes(source.studyId));assert((await details.innerText()).includes(source.protocolId));}
 async function receipt(original,request){
  await auth();const r=await context.request.get(origin+receiptPath(request));ledger.event(original,'receipt-get',{requestKey:request.requestKey,status:r.status()});
  assert.equal(r.status(),200,'ORIGINAL_RECEIPT_UNRESOLVED_NO_REPLAY');const value=await r.json();ledger.confirmed(original,request,value,actor);return value;
 }
 async function selectedPreview(){
  await ready();const picker=page.locator('.ep-template-picker');await summaries(picker,'从已审核方案带入').click();
  await picker.getByLabel('搜索已审核方案',{exact:true}).fill('');const all=[];let cursor=null,index=-1;
  for(let count=0;count<12;count++){
   const response=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='GET'&&u.pathname==='/api/research-studies/'+c.studyId+'/protocol-templates'&&(u.searchParams.get('cursor')??null)===cursor;});
   await button(picker,cursor?'查看更多方案':'搜索').click();const r=await response;assert.equal(r.status(),200);const value=await r.json();all.push(...value.items);
   index=all.findIndex(x=>x.sourceStudyId===source.studyId&&x.sourceProtocolId===source.protocolId);if(index>=0)break;
   cursor=value.nextCursor;assert(cursor,'REGISTERED_SOURCE_NOT_IN_REAL_AUTHORIZED_CANDIDATES');
  }
  assert(index>=0,'BOUNDED_SOURCE_SEARCH_EXHAUSTED');
  const previewPath='/api/research-studies/'+c.studyId+'/protocol-templates/'+source.studyId+'/'+source.protocolId;
  const response=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname===previewPath);
  await button(picker.locator(':scope > ul > li').nth(index),'预览差异').click();const r=await response;assert.equal(r.status(),200);const value=await r.json();
  assert.equal(value.source.sourceProtocolId,source.protocolId);assert.equal(value.source.revision,source.revision);assert.equal(value.source.versionNumber,source.versionNumber);
  assert.equal(value.sourceFingerprint,source.fingerprint);assert.equal(value.targetFingerprint,c.targetFingerprint);assert.equal(value.canImport,true);
  assert.deepEqual(value.forms.map(f=>f.id).sort(),[...source.formVersionIds].sort());assert.deepEqual(value.outcomes.map(o=>o.id).sort(),[...source.outcomeDefinitionIds].sort());
  await page.getByRole('region',{name:'核对模板差异',exact:true}).waitFor();assert.equal(await button(page,'确认差异并带入草稿').isEnabled(),true);
  ledger.event(checkpoint,'real-preview',{sourceStudyId:source.studyId,sourceProtocolId:source.protocolId,sourceFingerprint:value.sourceFingerprint,targetFingerprint:value.targetFingerprint,formCount:value.forms.length,outcomeCount:value.outcomes.length,visitCount:value.configuration.visitPlans.length});return picker;
 }
 async function verifiedUI(original){
  const request=original.requests[0],protocolId=request.proof.protocolId;
  await page.waitForURL(u=>u.pathname==='/pages/s11/'&&u.searchParams.get('studyId')===c.studyId&&u.searchParams.get('protocolId')===protocolId);
  await sourceVisible();await page.getByLabel('方案名称',{exact:true}).click({trial:true});assert.equal(await page.getByLabel('方案名称',{exact:true}).isEnabled(),true);await capture(name+'-verified');ledger.verified(original);
 }
 page.on('response',responseListener);page.on('dialog',dialogListener);
 try{
  await auth();await protection('before',{code,step:name});gate=await installNativeImportGate(context,{manifest,code,actor,ledger,outputDir,origin,env});
  const existing=ledger.journal.steps[code+'.'+name];
  if(existing?.status==='verified'){report.skippedVerified=true;report.passed=true;return report;}
  const original=checkpointPrerequisite(ledger.journal,code,name);checkpoint=ledger.begin(code,name);stage=name;persist();
  if(name==='preview'){
   const picker=await selectedPreview(),title=page.getByLabel('方案名称',{exact:true}),value=await title.inputValue();
   await title.fill(value+' SYNTHETIC unsaved WF02 check');assert.equal(await button(page,'确认差异并带入草稿').isDisabled(),true);
   await title.fill(value);assert.equal(await button(page,'确认差异并带入草稿').isEnabled(),true);
   await summaries(picker,'从已审核方案带入').click();assert.equal(await title.inputValue(),value);await capture('preview-cancel');
   ledger.event(checkpoint,'preview-collapse-no-write',{originalTitleHash:sha(value)});ledger.verified(checkpoint);
  }else if(['import','import-loss'].includes(name)){
   await selectedPreview();gate.arm(checkpoint,{dropResponse:name==='import-loss'});
   await button(page,'确认差异并带入草稿').click();
   if(name==='import-loss'){
    await button(page,'核对上次带入结果').waitFor();await gate.settle();assert.equal(checkpoint.requests.length,1);assert.equal(checkpoint.requests[0].responseDiscarded,true);
    const entries=await page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('researchhub:protocol-template:v1:')));
    assert(entries.some(([,v])=>JSON.parse(v).requestKey===checkpoint.requests[0].requestKey),'REAL_PENDING_MARKER_REQUIRED_NO_INJECTION');
    checkpoint.status='unknown-ui-observed';ledger.event(checkpoint,'unknown-ui-observed');await capture('import-loss-unknown');
   }else{
    await page.waitForURL(u=>u.searchParams.get('protocolId'));await gate.settle();assert.equal(checkpoint.requests.length,1);
    await receipt(checkpoint,checkpoint.requests[0]);await verifiedUI(checkpoint);
   }
  }else if(name==='recover'){
   // Root restores the actual private tab/profile. Never create a marker or navigate away from it.
   const u=new URL(page.url());assert.equal(u.pathname,'/pages/s11/');assert.equal(u.searchParams.get('studyId'),c.studyId);assert.equal(u.searchParams.has('protocolId'),false);
   stage='recover-readonly-popup';await verifyPendingPopup({page,request:original.requests[0],manifest,code,gate,outputDir,origin,env});ledger.event(checkpoint,'new-tab-readonly-verified',{requestKey:original.requests[0].requestKey});stage='recover-original-key';
   await button(page,'核对上次带入结果').waitFor();await page.locator('.ep-summary h2').click();acceptUnload=true;
   await page.reload();acceptUnload=false;await button(page,'核对上次带入结果').waitFor();
   assert(report.dialogs.some(d=>d.type==='beforeunload'),'REAL_PENDING_BEFOREUNLOAD_REQUIRED');
   const request=original.requests[0],path=new URL(origin+receiptPath(request));
   const response=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='GET'&&u.pathname===path.pathname&&u.search===path.search;});
   await button(page,'核对上次带入结果').click();const r=await response;assert.equal(r.status(),200,'ORIGINAL_RECEIPT_UNRESOLVED_NO_REPLAY');
   await auth();ledger.confirmed(original,request,await r.json(),actor);await verifiedUI(original);ledger.verified(checkpoint);
  }else if(name==='reconcile'){
   for(const request of original.requests.filter(r=>!knownRejected(r)))await receipt(original,request);
   original.status='native-confirmed-ui-unverified';ledger.persist();ledger.verified(checkpoint);
  }else if(name==='verify-ui'){
   if(await button(page,'核对上次带入结果').count()){
    const path=new URL(origin+receiptPath(original.requests[0]));
    const response=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='GET'&&u.pathname===path.pathname&&u.search===path.search;});
    await button(page,'核对上次带入结果').click();const r=await response;assert.equal(r.status(),200);await auth();ledger.confirmed(original,original.requests[0],await r.json(),actor);
   }else await ready(original.requests[0].proof.protocolId);
   await verifiedUI(original);ledger.verified(checkpoint);
  }else if(name==='readback'){
   const protocolId=original.requests[0].proof.protocolId;
   for(const p of ['s11','s02','s07']){await page.goto(origin+formalUrl(p,c.studyId,protocolId));await sourceVisible();await capture('readback-'+p);}
   if(governanceUrl){const u=new URL(governanceUrl,origin);assert.equal(u.origin,origin);assert.equal(u.pathname,'/pages/s07/');assert.equal(u.searchParams.get('studyId'),c.studyId);assert.equal(u.searchParams.get('protocolId'),protocolId);await page.goto(u.href);await sourceVisible();await capture('readback-governance');}
   ledger.verified(checkpoint);
  }else assert.fail('UNKNOWN_CHECKPOINT');
  await gate.settle();assert.equal(gate.report.blocked.length,0,'UNINTENDED_BUSINESS_WRITE_BLOCKED');
  await protection('after',{code,step:name});report.passed=true;report.checks.push(name);
 }catch(error){
  report.failureStage=stage;report.error={name:error.name??'Error',code:error.code??null};
  if(checkpoint)ledger.event(checkpoint,'checkpoint-failed',{stage,name:report.error.name,code:report.error.code,evidence:outputDir});
  await capture('failure-active').catch(()=>{});
  await protection('failure-after',{code,step:name}).catch(()=>{});
 }finally{
  if(gate)await gate.close();page.off('response',responseListener);page.off('dialog',dialogListener);report.finishedAt=new Date().toISOString();persist();
 }
 assert.equal(report.passed,true,'WF02_CHECKPOINT_FAILED_READ_EVIDENCE_NO_WRITE_REPLAY');return report;
}
