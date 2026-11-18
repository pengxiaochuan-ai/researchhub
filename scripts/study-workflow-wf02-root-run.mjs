// Root-only, explicit-window synthetic acceptance. Every UI write goes through its native gate.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {openWF02Context,wf02Private,wf02Evidence,manifestPath,uniqueWF02Output,verifyWF02Freeze} from './study-workflow-wf02-root-context.mjs';
import {requireWindow,json,save,manifestFromResources,validateManifest,createJournal,bodyHash,receiptPath,verifyReceipt} from './study-workflow-wf02-qa.mjs';

async function prepare(root,out){
 const originalResources=json(wf02Evidence+'resource-readonly.json'),reviewerSource=json(wf02Evidence+'reviewer-source-readonly.json');
 // The immutable first manifest remains evidence of the discovered nonportable source.
 // No successful UI import occurred under it. The new phase explicitly uses a native source.
 const resources={...originalResources,at:new Date().toISOString(),runtimePid:root.h.runtime.pid,source:{...reviewerSource}};
 const originalJournalPath=wf02Private+'browser-checkpoints.json';
 if(existsSync(originalJournalPath))assert.equal(Object.values(json(originalJournalPath).steps).flatMap(x=>x.requests??[]).length,0,'ORIGINAL_PHASE_MUST_HAVE_NO_DISPATCH');
 const negative=[];
 for(const code of ['A','D']){
  await root.login('admin');const source=originalResources.source;
  const preview=await root.h.get('/research-studies/'+resources.targets[code].id+'/protocol-templates/'+source.studyId+'/'+source.protocolId);
  assert.equal(preview.canImport,false,'NONPORTABLE_SOURCE_MUST_BLOCK_PREVIEW');
  assert(preview.blockers.some(b=>b.code==='TEMPLATE_OUTCOME_SOURCE_NOT_PORTABLE'));
  negative.push({code,studyId:resources.targets[code].id,source:preview.source,sourceFingerprint:preview.sourceFingerprint,canImport:false,blockers:preview.blockers,writes:0});
 }
 save(out+'original-form-score-source-blocked.json',{at:new Date().toISOString(),runtimePid:root.h.runtime.pid,negative});
 const previews={},principals={};
 for(const code of ['A','D','B']){
  const me=await root.login(code==='B'?'reviewer':'admin'),source=reviewerSource;
  principals[code]={accountId:me.accountId,tenantId:resources.tenantId,authVersion:me.authVersion};
  previews[code]=await root.h.get('/research-studies/'+resources.targets[code].id+'/protocol-templates/'+source.studyId+'/'+source.protocolId);
  save(wf02Private+'preview-'+code+'.json',previews[code]);
  assert.equal(previews[code].canImport,true,'SOURCE_PREVIEW_BLOCKED_'+code);
  assert.equal(previews[code].source.revision,source.revision,'FIXED_SOURCE_CHANGED');
 }
 const old=json(wf02Private+'all-old-rows-before.json'),audit=json(wf02Evidence+'../wf01/browser/audit-2026-11-17T02-28-17-295Z-c3929/native-audit.json');
 const rows={};for(const [table,ids]of [
  ['rh_research.project_intent',audit.intents.map(r=>r.id)],['rh_research.study_binding',audit.bindings.map(r=>r.id)],
  ['rh_research.operation',audit.operations.map(r=>r.id)],['public.audit_log',audit.audits.map(r=>r.id)],
  ['public.research_project',audit.bindings.map(r=>r.execution_project_id)]]){
  rows[table]=old[table].filter(r=>ids.includes(r.id));assert.equal(rows[table].length,ids.length);
 }
 const proofPath=wf02Private+'wf01-final-object-protection.json',proof={schema:1,source:'WF01-final-object-IDs-and-WF02-before-full-row-hashes',rows};
 if(existsSync(proofPath))assert.deepEqual(json(proofPath),proof);else save(proofPath,proof,{exclusive:true});
 const m=manifestFromResources(resources,reviewerSource,{admin:{actorId:principals.A.accountId,authVersion:principals.A.authVersion},previews,
  protection:{baselinePath:wf02Private+'protected-original-before.json',wf01BaselinePath:proofPath},approvedAt:existsSync(manifestPath)?json(manifestPath).approvedAt:new Date().toISOString()});
 m.sources={portable:m.sources.qa};for(const c of Object.values(m.cases))c.sourceId='portable';validateManifest(m);
 if(existsSync(manifestPath))assert.deepEqual(json(manifestPath),m);else save(manifestPath,m,{exclusive:true});
 const publicPath=wf02Evidence+'portable-primary-manifest-v2.json';if(existsSync(publicPath))assert.deepEqual(json(publicPath),m);else save(publicPath,m,{exclusive:true});
 root.setManifest(m);save(wf02Private+'principals.json',principals);
 const targetCounts={};for(const code of ['A','B','D']){
  const rows=await root.caseSnapshot(code);targetCounts[code]=Object.fromEntries(Object.entries(rows).map(([table,items])=>[table,items.length]));
  for(const [table,items]of Object.entries(rows))if(table!=='audit_log')assert.equal(items.length,0,'PREDICTION_LEFT_TARGET_ROWS_'+code+'_'+table);
 }
 const protection=await root.protect('assembled-preview-before-import');
 save(out+'assembled-readonly-previews.json',{at:new Date().toISOString(),runtimePid:root.h.runtime.pid,manifestHash:bodyHash(m),writes:0,targetCounts,protection,
  previews:Object.fromEntries(Object.entries(previews).map(([code,p])=>[code,{source:p.source,canImport:p.canImport,blockers:p.blockers,sourceFingerprint:p.sourceFingerprint,targetFingerprint:p.targetFingerprint,
   forms:p.forms.length,outcomes:p.outcomes.length,plans:p.configuration.visitPlans.map(v=>({code:v.code,offset:v.targetDayOffset,requirements:v.requirements.length}))}]))});
}
async function pg(root,out,code,mode){
 assert(root.manifest,'PREPARE_FROZEN_MANIFEST_FIRST');
 const {runWF02PgPrediction}=await import('./study-workflow-wf02-pg.mjs');
 const {withFixtureTransaction}=await import('../../app/server/scripts/wp01/fixture-guard.mjs');
 const principals={};for(const c of ['A','D','B']){const me=await root.login(c==='B'?'reviewer':'admin');principals[c]={accountId:me.accountId,tenantId:root.manifest.tenantId,authVersion:me.authVersion};}
 return runWF02PgPrediction({args:['--local-synthetic','--rollback-predict','--case',code,'--mode',mode],env:root.h.env,manifest:root.manifest,principals,
  ...root.nativeDependencies(),withFixtureTransaction,
  readProtection:({phase,case:c,...rest})=>root.protect(phase,{code:c,...rest}),outputPath:out+'pg-result.json'});
}
async function ui(root,out,code,step){
 assert(root.manifest,'PREPARE_FROZEN_MANIFEST_FIRST');assert(root.manifest.cases[code]);
 const {runWF02Checkpoint}=await import('./study-workflow-wf02-run.mjs');
 const {loginBrowserContext}=await import('./visit-workflow-qa.mjs');
 const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
 const ledger=createJournal(wf02Private+'portable-browser-checkpoints-v2.json',root.manifest),c=root.manifest.cases[code],identity=root.accounts[c.role];
 if(ledger.journal.steps[code+'.'+step]?.status==='verified'){save(out+'already-verified.json',{code,step,skipped:true});return;}
 const context=await chromium.launchPersistentContext(wf02Private+'chrome-'+code,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  viewport:{width:1440,height:1000},args:['--restore-last-session'],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
 try{
  await loginBrowserContext(context,{tenantSlug:root.manifest.tenantId,username:identity.username,password:identity.password,expectedActorId:c.actorId});
  let page=step==='recover'?null:context.pages()[0]??await context.newPage();
  if(step==='recover'){
   const original=ledger.journal.steps[code+'.import-loss'].requests[0],observed=[];
   for(let attempt=0;attempt<20&&!page;attempt++){
    for(const candidate of context.pages()){
     const url=candidate.url();if(!url.startsWith('http://127.0.0.1:19501/'))continue;
     const markers=await candidate.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('researchhub:protocol-template:v1:'))).catch(()=>[]);
     const matches=markers.some(([,v])=>{try{return JSON.parse(v).requestKey===original.requestKey;}catch{return false;}});
     observed.push({attempt,url,markerCount:markers.length,originalRequestMarker:matches});
     if(matches){page=candidate;break;}
    }
    if(!page)await new Promise(r=>setTimeout(r,500));
   }
   save(out+'original-tab-restore-observed.json',{observed,markerInjected:false});
   if(page){const url=new URL(page.url());if(url.pathname!=='/pages/s11/'||url.searchParams.get('studyId')!==c.studyId){
    // The owned browser cookie was logged out on close; its original tab may restore at login.
    // This is the actual tab carrying the original opaque marker, never a manufactured marker.
    const old=json(wf02Evidence+'root/ui-D-import-loss-2026-11-17T03-56-58-796Z-f56db/D-import-loss-unknown-active.json');
    const back=new URL(old.url);assert.equal(back.origin,'http://127.0.0.1:19501');assert.equal(back.pathname,'/pages/s11/');assert.equal(back.searchParams.get('studyId'),c.studyId);assert.equal(back.searchParams.has('protocolId'),false);
    await page.goto(back.href);
   }}
  }
  assert(page,'ORIGINAL_UNKNOWN_TAB_MUST_RESTORE_NO_MARKER_INJECTION');
  return await runWF02Checkpoint({manifest:root.manifest,code,step,ledger,page,actor:{actorId:c.actorId,authVersion:c.authVersion},outputDir:out,protection:root.protect});
 }finally{
  await context.request.post('http://127.0.0.1:19501/api/auth/logout',{headers:{Origin:'http://127.0.0.1:19501','X-ResearchHub-Request':'session-v1'},data:{}}).catch(()=>{});
  await context.close();
 }
}
async function audit(root,out){
 const {assertExactProtocolCopy}=await import('./study-workflow-wf02-pg.mjs');
 const m=root.manifest,ledger=createJournal(wf02Private+'portable-browser-checkpoints-v2.json',m),summaries=[];
 for(const code of ['A','B','D']){
  const original=ledger.journal.steps[code+'.'+(code==='D'?'import-loss':'import')];assert.equal(original?.status,'verified');assert.equal(original.requests.length,1);
  const request=original.requests[0],c=m.cases[code],s=m.sources[c.sourceId];await root.login(c.role);
  const result=await root.h.get(receiptPath(request).replace(/^\/api/,''));verifyReceipt(request,result,{actorId:c.actorId,authVersion:c.authVersion});
  const rows=await root.h.read(async tx=>{
   const include={visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}};
   const targetProtocol=await tx.studyProtocolVersion.findUnique({where:{id:result.protocol.id},include});
   const sourceProtocol=await tx.studyProtocolVersion.findUnique({where:{id:s.protocolId},include});
   const source={protocol:sourceProtocol,forms:await tx.formVersion.findMany({where:{id:{in:s.formVersionIds}},include:{template:true}}),outcomes:await tx.outcomeDefinition.findMany({where:{id:{in:s.outcomeDefinitionIds}}})};
   const target={protocol:targetProtocol,forms:await tx.formVersion.findMany({where:{tenantId:m.tenantId,researchProjectId:c.executionProjectId},include:{template:true}}),outcomes:await tx.outcomeDefinition.findMany({where:{tenantId:m.tenantId,researchProjectId:c.executionProjectId}})};
   const operations=await tx.$queryRaw`SELECT id,actor_id,request_key,request_hash,action,target_id,audit_id,result FROM rh_research.operation WHERE tenant_id=${m.tenantId} AND action='protocol.template.import' AND result->'receipt'->>'studyId'=${c.studyId}`;
   const audits=await tx.auditLog.findMany({where:{tenantId:m.tenantId,researchProjectId:c.executionProjectId,target:targetProtocol.id}});
   const protocols=await tx.studyProtocolVersion.count({where:{tenantId:m.tenantId,researchProjectId:c.executionProjectId}});
   const untouched={};for(const model of ['subject','studyEnrollment','subjectVisit','formAssignment','formResponse','studyExecutionPolicyVersion','scaleVersionApplicability'])untouched[model]=await tx[model].count({where:{tenantId:m.tenantId,researchProjectId:c.executionProjectId}});
   return{source,target,operations,audits,protocols,untouched};
  });
  assert.equal(rows.protocols,1);assert.equal(rows.operations.length,1);assert.equal(rows.operations[0].request_key,request.requestKey);assert.equal(rows.operations[0].actor_id,c.actorId);
  assert.equal(rows.operations[0].request_hash,request.requestHash);assert.equal(rows.operations[0].target_id,result.protocol.id);assert.equal(rows.operations[0].id,result.receipt.id);
  assert.equal(rows.audits.length,2);for(const a of rows.audits)assert.equal(a.accountId,c.actorId);
  assert(rows.audits.some(a=>a.id===rows.operations[0].audit_id&&a.action==='researchhub.protocol.template.import'));assert(rows.audits.some(a=>a.action==='study_protocol_create'));
  for(const [kind,count]of Object.entries(rows.untouched))assert.equal(count,0,'NO_COPY_'+kind);
  const copy=assertExactProtocolCopy(rows.source,rows.target,result.origin);
  summaries.push({code,actorId:c.actorId,authVersion:c.authVersion,studyId:c.studyId,protocolId:result.protocol.id,receipt:result.receipt,copy,
   origins:result.origin.forms.concat(result.origin.outcomes),audits:rows.audits.map(a=>({id:a.id,action:a.action,actorId:a.accountId,metaHash:bodyHash(a.meta)})),untouched:rows.untouched});
 }
 const protection=await root.protect('final-native-audit');save(out+'native-audit.json',{at:new Date().toISOString(),readOnly:true,sourceScope:'portable native data_field source; original form_score source rejected',importSuccesses:3,protocols:3,audits:6,summaries,protection});
}
async function visual(root,out,{physical=false,governance=false,negativeOnly=false}={}){
 const {runWF02VisualBoundary,runWF02GovernanceReadback}=await import('./study-workflow-wf02-visual.mjs');
 const {loginBrowserContext}=await import('./visit-workflow-qa.mjs');
 const {formalUrl}=await import('../src/formal-preparation-session.js');
 const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
 const code='A',c=root.manifest.cases[code],ledger=createJournal(wf02Private+'portable-browser-checkpoints-v2.json',root.manifest),identity=root.accounts[c.role];
 const context=await chromium.launchPersistentContext(wf02Private+'chrome-'+(physical?'native200':governance?'governance':'visual'),{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  viewport:physical?null:{width:1440,height:1000},args:['--restore-last-session',...(physical?['--window-size=1440,1000']:[])],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
 let settings;
 try{
  await loginBrowserContext(context,{tenantSlug:root.manifest.tenantId,username:identity.username,password:identity.password,expectedActorId:c.actorId});
  const page=context.pages()[0]??await context.newPage(),options={context,page,manifest:root.manifest,ledger,code,actor:{actorId:c.actorId,authVersion:c.authVersion},protection:root.protect,outputDir:out,physical};
  if(physical){settings=await context.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');assert.equal(await settings.locator('#zoomLevel').inputValue(),'2');save(out+'native-zoom-setting.json',{actualSetting:'2',method:'Chrome settings UI',viewport:null,windowSize:[1440,1000]});}
  if(governance){
   const protocolId=ledger.journal.steps['A.import'].requests[0].proof.protocolId;
   await page.goto('http://127.0.0.1:19501'+formalUrl('s11',c.studyId,protocolId));
   const entry=page.getByRole('button',{name:'管理与治理',exact:true});await entry.waitFor();await entry.click();
   await page.waitForURL(u=>u.pathname==='/pages/g02/');await page.getByRole('button',{name:'刷新待办',exact:true}).waitFor();
   const result=await runWF02GovernanceReadback(options);save(out+'governance-draft-boundary.json',{...result,notClaimedAsPassed:result.available===false});
  }else{
   if(!negativeOnly)await runWF02VisualBoundary(options);
   else{
    const protocolId=ledger.journal.steps['A.import'].requests[0].proof.protocolId;await page.goto('http://127.0.0.1:19501'+formalUrl('s11',c.studyId,protocolId));
    const picker=page.locator('.ep-template-picker');await picker.locator(':scope > summary').waitFor();if(!await picker.evaluate(e=>e.open))await picker.locator(':scope > summary').click();
   }
   if(!physical){
    const {installNativeImportGate}=await import('./study-workflow-wf02-browser.mjs'),source=json(wf02Evidence+'resource-readonly.json').source;
    const gate=await installNativeImportGate(context,{manifest:root.manifest,code,actor:options.actor,ledger,outputDir:out+'nonportable/'});
    try{
     const picker=page.locator('.ep-template-picker');await picker.getByLabel('搜索已审核方案',{exact:true}).fill('客观辨识');
     const listing=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/research-studies/'+c.studyId+'/protocol-templates');
     await picker.getByRole('button',{name:'搜索',exact:true}).click();const listed=await listing;assert.equal(listed.status(),200);const candidates=(await listed.json()).items;
     const index=candidates.findIndex(x=>x.sourceStudyId===source.studyId&&x.sourceProtocolId===source.protocolId);assert(index>=0,'ORIGINAL_REAL_SOURCE_MUST_BE_OBSERVED');
     const pending=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/research-studies/'+c.studyId+'/protocol-templates/'+source.studyId+'/'+source.protocolId);
     await picker.locator(':scope > ul > li').nth(index).getByRole('button',{name:'预览差异',exact:true}).click();const response=await pending;assert.equal(response.status(),200);const preview=await response.json();
     assert.equal(preview.canImport,false);const blocker=preview.blockers.find(b=>b.code==='TEMPLATE_OUTCOME_SOURCE_NOT_PORTABLE');assert(blocker);
     await page.getByText(blocker.message,{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'确认差异并带入草稿',exact:true}).isDisabled(),true);
     await page.getByText(blocker.message,{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'nonportable-source-blocked.png',fullPage:true});
     await gate.settle();assert.equal(gate.report.requests.length,0);assert.equal(gate.report.blocked.length,0);await root.protect('nonportable-source-ui-after');
     save(out+'nonportable-source-ui.json',{at:new Date().toISOString(),sourceStudyId:source.studyId,sourceProtocolId:source.protocolId,canImport:false,visibleMessage:blocker.message,buttonDisabled:true,businessWrites:0});
    }finally{await gate.close();}
   }
  }
 }finally{
  if(settings){await settings.goto('chrome://settings/appearance').catch(()=>{});await settings.locator('#zoomLevel').selectOption('1').catch(()=>{});}
  await context.request.post('http://127.0.0.1:19501/api/auth/logout',{headers:{Origin:'http://127.0.0.1:19501','X-ResearchHub-Request':'session-v1'},data:{}}).catch(()=>{});await context.close();
 }
}
async function boundaries(root,out){
 const m=root.manifest,source=m.sources.portable,ledger=createJournal(wf02Private+'portable-browser-checkpoints-v2.json',m),c=m.cases.A;
 await root.login('collector');
 const readable=await root.h.request('/research-studies/'+source.studyId+'/configuration',{status:[200,403,404]});
 assert.equal(root.h.network.at(-1).status,200,'EXISTING_COLLECTOR_READ_AUTHORITY_REQUIRED');assert.equal(readable.value.capabilities.canConfigure,false);
 const denied=await root.h.request('/research-studies/'+source.studyId+'/protocol-templates',{status:[403,404]});
 const deniedStatus=root.h.network.at(-1).status;
 await root.login('admin');const b=ledger.journal.steps['B.import'].requests[0];const notOwn=await root.h.get(receiptPath(b).replace(/^\/api/,''));assert.deepEqual(notOwn,{found:false});
 const unknown=await root.h.get('/research-studies/'+c.studyId+'/protocol-template-imports/receipts/'+randomUUID()+'?requestHash='+'0'.repeat(64));assert.deepEqual(unknown,{found:false});
 save(out+'native-readonly-authority.json',{at:new Date().toISOString(),collectorId:root.accounts.collector.id,sourceReadableStatus:200,sourceCanConfigure:false,templateListStatus:deniedStatus,otherActorReceipt:notOwn,unknownReceipt:unknown,businessWrites:0});
 const {loginBrowserContext}=await import('./visit-workflow-qa.mjs'),{formalUrl}=await import('../src/formal-preparation-session.js'),{installNativeImportGate,captureActualPage}=await import('./study-workflow-wf02-browser.mjs');
 const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
 const context=await chromium.launchPersistentContext(wf02Private+'chrome-boundaries',{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,viewport:{width:1440,height:1000},recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
 let gate,release;try{
  const identity=root.accounts.admin;await loginBrowserContext(context,{tenantSlug:m.tenantId,username:identity.username,password:identity.password,expectedActorId:c.actorId});const page=context.pages()[0]??await context.newPage();
  gate=await installNativeImportGate(context,{manifest:m,code:'A',actor:{actorId:c.actorId,authVersion:c.authVersion},ledger,outputDir:out});
  const protocolId=ledger.journal.steps['A.import'].requests[0].proof.protocolId;await page.goto('http://127.0.0.1:19501'+formalUrl('s11',c.studyId,protocolId));
  const picker=page.locator('.ep-template-picker');await picker.locator(':scope > summary').waitFor();await picker.locator(':scope > summary').click();await picker.getByLabel('搜索已审核方案',{exact:true}).fill('访视流程通用合成方案');
  const listed=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/research-studies/'+c.studyId+'/protocol-templates');await picker.getByRole('button',{name:'搜索',exact:true}).click();const list=await listed;assert.equal(list.status(),200);const items=(await list.json()).items,index=items.findIndex(x=>x.sourceStudyId===source.studyId&&x.sourceProtocolId===source.protocolId);assert(index>=0);
  const path='/api/research-studies/'+c.studyId+'/protocol-templates/'+source.studyId+'/'+source.protocolId;let seen;const received=new Promise(r=>seen=r),held=new Promise(r=>release=r);
  await page.route('**'+path,async route=>{const response=await route.fetch();assert.equal(response.status(),200);seen();await held;await route.fulfill({response}).catch(()=>{});});
  await picker.locator(':scope > ul > li').nth(index).getByRole('button',{name:'预览差异',exact:true}).click();await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(Error('LATE_READ_NOT_OBSERVED')),15000))]);
  const collector=root.accounts.collector;await loginBrowserContext(context,{tenantSlug:m.tenantId,username:collector.username,password:collector.password,expectedActorId:collector.id});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('qiyan:auth-refresh')));await page.getByRole('alert').first().waitFor({timeout:15000});
  release();await page.waitForTimeout(150);assert.equal(await page.locator('.ep-template-review').count(),0);assert.equal(await page.getByLabel('方案名称',{exact:true}).count(),0);
  await captureActualPage(page,{outputDir:out,label:'actual-collector-rejects-late-admin-preview',role:'collector',stage:'late-native-read'});
  await gate.settle();assert.equal(gate.report.requests.length,0);assert.equal(gate.report.blocked.length,0);await root.protect('native-authority-late-ui-after');
  save(out+'late-native-preview.json',{at:new Date().toISOString(),realOldResponseStatus:200,oldActorId:c.actorId,currentActorId:collector.id,previewRemoved:true,formRemoved:true,businessWrites:0});
 }finally{release?.();if(gate)await gate.close();await context.request.post('http://127.0.0.1:19501/api/auth/logout',{headers:{Origin:'http://127.0.0.1:19501','X-ResearchHub-Request':'session-v1'},data:{}}).catch(()=>{});await context.close();}
}
async function main(){
 requireWindow();const args=process.argv.slice(2);assert.equal(args[0],'--local-synthetic');const mode=args[1];assert(['prepare','pg','pg-all','ui','audit','visual','native200','governance','negative','boundaries'].includes(mode));
 if(['prepare','pg-all','audit','visual','native200','governance','negative','boundaries'].includes(mode))assert.equal(args.length,2);else assert.equal(args.length,4);
 verifyWF02Freeze();const out=uniqueWF02Output(mode+(args[2]?'-'+args.slice(2).join('-'):''));let root;
 try{root=await openWF02Context();if(mode==='prepare')await prepare(root,out);else if(mode==='pg')await pg(root,out,args[2],args[3]);
  else if(mode==='pg-all'){for(const [code,kind]of [['A','success'],['B','success'],['D','success'],['A','partial-failure'],['A','stale-source'],['A','stale-target']])await pg(root,out+code+'-'+kind+'/',code,kind);}
  else if(mode==='audit')await audit(root,out);
  else if(mode==='boundaries')await boundaries(root,out);
  else if(['visual','native200','governance','negative'].includes(mode))await visual(root,out,{physical:mode==='native200',governance:mode==='governance',negativeOnly:mode==='negative'});
  else await ui(root,out,args[2],args[3]);
  save(out+'root-result.json',{at:new Date().toISOString(),mode,args:args.slice(2),passed:true});process.stdout.write(JSON.stringify({passed:true,mode,evidence:out})+'\n');
 }catch(error){save(out+'root-result.json',{at:new Date().toISOString(),mode,args:args.slice(2),passed:false,error:{name:error.name,code:error.code??null}});
  process.stderr.write(JSON.stringify({passed:false,mode,evidence:out,errorName:error.name})+'\n');process.exitCode=1;
 }finally{if(root)await root.close();}
}
await main();
