// Root-owned serial native UI acceptance. Unknown writes are never restarted by this driver.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {openWF03Context,wf03Private,wf03Evidence,verifyWF03Freeze} from './study-workflow-wf03-root-context.mjs';
import {createWF03UiLedger,installWF03NativeGate,prepareWF03Policy} from './study-workflow-wf03-browser.mjs';
import {requireWF03Window,bodyHash} from './study-workflow-wf03-qa.mjs';
import {json,save} from './study-workflow-wf01-qa.mjs';
import {wf03PolicySections} from './study-workflow-wf03-policy-recipe.mjs';
import {formalUrl} from '../src/formal-preparation-session.js';

const origin='http://127.0.0.1:19501',ledgerPath=wf03Private+'ui-ledger.json',tuplesPath=wf03Private+'policy-tuples.json';
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const output=label=>wf03Evidence+'root/'+label+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,5)+'/';
async function verifyPolicyDatabase(root,c,attempt,recipe){
 const rows=await root.h.read(async tx=>({policies:await tx.studyExecutionPolicyVersion.findMany({where:{tenantId:root.h.runtime.ids.tenant,protocolVersionId:c.protocolId}}),operations:await tx.$queryRaw`SELECT * FROM rh_research.operation WHERE tenant_id=${root.h.runtime.ids.tenant} AND actor_id=${attempt.actorId} AND request_key=${attempt.requestKey}`}));
 assert.equal(rows.policies.length,1);assert.equal(rows.operations.length,1);const policy=rows.policies[0],op=rows.operations[0];assert.equal(policy.versionNumber,1);assert.equal(policy.createdBy,attempt.actorId);assert.equal(policy.status,'draft');
 assert.equal(op.action,'protocol.policy.save');assert.equal(op.target_id,c.protocolId);assert.equal(op.request_hash,attempt.requestHash);assert.equal(op.result.policy.id,policy.id);assert.equal(op.result.receipt.id,op.id);assert.equal(op.result.receipt.requestKey,attempt.requestKey);
 const sections=structuredClone(policy.sections);for(const s of Object.values(sections)){assert.equal(s.decidedBy,attempt.actorId);assert(Number.isFinite(Date.parse(s.decidedAt)));delete s.decidedBy;delete s.decidedAt;}assert.deepEqual(sections,recipe);assert.equal(bodyHash(policy.sections),policy.contentHash);
 const audit=await root.h.read(tx=>tx.auditLog.findUnique({where:{id:op.audit_id}}));assert(audit);assert.equal(audit.accountId,attempt.actorId);assert.equal(audit.action,'researchhub.protocol.policy.save');assert.equal(audit.target,policy.id);assert.equal(audit.meta.protocolVersionId,c.protocolId);assert.equal(audit.meta.contentHash,policy.contentHash);assert.equal(audit.meta.requestKey,attempt.requestKey);
 return{policyId:policy.id,contentHash:policy.contentHash,versionNumber:policy.versionNumber,actorId:policy.createdBy,operationId:op.id,requestKey:op.request_key,requestHash:op.request_hash,auditId:audit.id,auditMetaHash:bodyHash(audit.meta)};
}
async function browser(root,out,role,code){
 const {loginBrowserContext}=await import('./visit-workflow-qa.mjs');
 const me=await root.login(role),actor={accountId:me.accountId,authVersion:me.authVersion},identity=root.accounts[role];
 const context=await chromium.launchPersistentContext(wf03Private+'chrome-'+code,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,viewport:{width:1440,height:1000},args:['--restore-last-session'],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
 await loginBrowserContext(context,{tenantSlug:root.h.runtime.ids.tenant,username:identity.username,password:identity.password,expectedActorId:actor.accountId});
 return{context,actor,page:context.pages()[0]??await context.newPage()};
}
async function main(){
 requireWF03Window();verifyWF03Freeze();const [flag,mode,code]=process.argv.slice(2);assert.equal(flag,'--local-synthetic');assert(['policy','submit','release','recover','inspect','reconcile','return'].includes(mode));assert(['A','B','D'].includes(code));
 const out=output('ui-'+code+'-'+mode),ledger=createWF03UiLedger({initial:existsSync(ledgerPath)?json(ledgerPath):undefined,persist:s=>save(ledgerPath,s)});
 let root,context,gate,page;
 try{
  root=await openWF03Context();const c={...root.cases[code],code},role=['release','recover','inspect','reconcile','return'].includes(mode)?'admin':code==='B'?'reviewer':'admin';
  if(mode==='reconcile'){
   const me=await root.login('admin'),proofs=[];for(const attempt of ledger.snapshot().attempts.filter(a=>a.code===code&&a.accepted&&['approve','activate'].includes(a.action))){assert.equal(me.accountId,attempt.actorId);assert.equal(me.authVersion,attempt.authVersion);const value=await root.h.get('/research-studies/'+c.studyId+'/protocols/'+c.protocolId+'/release-receipts/'+attempt.requestKey+'?'+new URLSearchParams({action:attempt.action,requestHash:attempt.requestHash}));assert.equal(value.found,true);proofs.push(await ledger.markVerified(attempt.sequence,{via:'receipt',result:value.result}));}save(out+'read-only-original-reconciliation.json',{readOnly:true,actualUIRecoveryClaimed:false,proofs});save(out+'protection.json',await root.protect('readonly-original-reconcile-'+code));save(out+'root-result.json',{passed:true,mode,code,readOnly:true,counts:ledger.counts()});process.stdout.write(JSON.stringify({passed:true,mode,code,evidence:out,counts:ledger.counts()})+'\n');return;
  }
  const opened=await browser(root,out,role,code);({context}=opened);const {actor}=opened;page=opened.page;page.setDefaultTimeout(20000);
  if(mode==='recover'){
   const original=ledger.snapshot().attempts.filter(a=>a.code===code&&a.action==='activate').at(-1),observed=[];let selected;
   for(const candidate of context.pages()){if(!candidate.url().startsWith(origin))continue;const markers=await candidate.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('researchhub:release-workflow:v1:')).map(([key,value])=>({key,record:JSON.parse(value)}))).catch(()=>[]);observed.push({url:candidate.url(),markers});if(markers.some(m=>m.record.pending?.requestKey===original.requestKey))selected=candidate;}
   save(out+'original-tabs.json',{observed,markerInjected:false});assert(selected,'ORIGINAL_UNKNOWN_TAB_REQUIRED');page=selected;
  }
  const resources=json(wf03Private+'admitted-resources.json'),expectedRevision=resources.views[code+':'+(role==='reviewer'?'reviewer':'admin')].revision;
  const tuple=(existsSync(tuplesPath)?json(tuplesPath)[code]:null)??null,recipe=wf03PolicySections(code);
  gate=await installWF03NativeGate(context,{case:c,actor,expectedRevision,policyTuple:mode==='policy'?undefined:{id:tuple.id,contentHash:tuple.contentHash},recipe:mode==='policy'?recipe:undefined,ledger});
  const url=mode==='return'?json(wf03Evidence+'root/ui-B-release-2026-11-17T05-27-29-214Z-93d4f/governance-entry.json').actualHref:origin+formalUrl('s11',c.studyId,c.protocolId),panel=page.locator('.ep-release');if(mode==='return'){assert.equal(code,'B');const u=new URL(url);assert.equal(u.origin,origin);assert.equal(u.searchParams.get('protocolId'),c.protocolId);assert(u.searchParams.has('governanceModule'));}await page.goto(url);await panel.getByText('方案状态：'+(['recover','inspect','return'].includes(mode)?'执行中':mode==='release'?'待审核':'草稿'),{exact:true}).waitFor();
  const shot=async name=>{await panel.locator(':scope > .ui-card').first().scrollIntoViewIfNeeded();await page.screenshot({path:out+name+'.png',fullPage:true});};
  const completedUi=async(kind)=>{
   await panel.getByText(kind==='submit'?'方案已提交审核。':'方案已批准并启用；已有入组保持原版本。',{exact:true}).waitFor();
   assert.equal(await panel.getByRole('button',{name:/^核对上次.*结果$/}).count(),0,'NO_UNKNOWN_RECOVERY_REMAINS_AT_UI_SUCCESS');
   const markers=await page.evaluate(({studyId,protocolId})=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('researchhub:release-workflow:v1:')).flatMap(([key,value])=>{try{const r=JSON.parse(value);return r.studyId===studyId&&r.protocolId===protocolId?[{key,...r}]:[];}catch{return[];}}),c);
   assert.equal(markers.length,0,'SUCCESSFUL_INTENT_MARKER_MUST_BE_CLEARED');save(out+'completed-'+kind+'-ui-proof.json',{notice:kind==='submit'?'方案已提交审核。':'方案已批准并启用；已有入组保持原版本。',unknownButtons:0,remainingMarkers:0});
  };
  const markUi=async actions=>{for(const r of gate.report.requests.filter(r=>actions.includes(r.action)&&r.accepted))await ledger.markVerified(r.sequence,{via:'ui'});};
  const recover=async(action)=>{
   const label={check:'检查',submit:'提交',approve:'批准',activate:'启用'}[action];
   const before=ledger.snapshot().attempts.length;
   const response=page.waitForResponse(r=>r.request().method()==='GET'&&r.url().includes('/release-receipts/')&&new URL(r.url()).searchParams.get('action')===action);
   response.catch(()=>{}); // A failed click must still reach finally instead of an unhandled waiter.
   await panel.getByRole('button',{name:'核对上次'+label+'结果',exact:true}).click();const actual=await response;assert.equal(actual.status(),200);const result=await actual.json();
   assert.equal(ledger.snapshot().attempts.length,before,'RECOVERY_MUST_BE_GET_ONLY');
   const pending=ledger.snapshot().attempts.filter(x=>x.code===code&&x.action===action).at(-1);assert(pending);
   if(result.found)await ledger.markVerified(pending.sequence,{via:'receipt',result:result.result});
   save(out+'recover-'+action+'-'+pending.sequence+'.json',{at:new Date().toISOString(),found:result.found,sequence:pending.sequence,readOnly:true,result:result.found?{receipt:result.result.receipt,protocol:result.result.protocol,approvedPolicy:result.result.approvedPolicy}:undefined});return result;
  };
  if(mode==='return'){
   const source=new URL(page.url());await page.getByRole('button',{name:'返回治理总览',exact:true}).click();await page.waitForURL(u=>u.pathname==='/pages/g02/');const actual=new URL(page.url());assert.equal(actual.searchParams.get('governanceModule')??'all',source.searchParams.get('governanceModule'));assert.equal(actual.searchParams.get('governancePage')??'1',source.searchParams.get('governancePage'));await page.getByRole('button',{name:'刷新待办',exact:true}).click({trial:true});await page.getByLabel('所属模块',{exact:true}).selectOption('ethics');const history=page.locator('.governance-history');if(!await history.evaluate(n=>n.open))await history.locator(':scope > summary').click();await page.waitForFunction(()=>document.querySelector('.governance-history[open] .governance-queue[aria-busy="false"]'));let found=false;const observed=[];for(let i=0;i<12;i++){const hrefs=await history.locator('a[href]').evaluateAll(a=>a.map(n=>n.href));observed.push({page:i+1,hrefs});if(hrefs.some(h=>{const u=new URL(h);return u.searchParams.get('studyId')===c.studyId&&u.searchParams.get('protocolId')===c.protocolId;})){found=true;break;}const next=history.getByRole('button',{name:'下一页',exact:true});if(!await next.count()||await next.isDisabled())break;await next.click();}assert(found,'CURRENT_NATIVE_DECISION_MUST_APPEAR_IN_REAL_PAGINATED_HISTORY');await page.screenshot({path:out+'returned-governance-results.png',fullPage:true});save(out+'governance-return.json',{readOnly:true,returnedUrl:actual.href,historyUrl:page.url(),returnContextPreserved:true,processedTargetVisible:true,observed});
  }else if(mode==='inspect'){
   const tabs=[];for(const candidate of context.pages())tabs.push({url:candidate.url(),markers:await candidate.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('researchhub:release-workflow:v1:')).map(([key,value])=>({key,record:JSON.parse(value)}))).catch(()=>[])});save(out+'inspect.json',{tabs,panelText:await panel.innerText()});await shot('inspection-read-only');
  }else if(mode==='policy'){
   assert.equal(tuple,null,'SAVED_POLICY_MUST_NOT_BE_REPLAYED');gate.arm('policy');await prepareWF03Policy(page,{recipe});await shot('policy-prepared');await panel.getByRole('button',{name:'保存政策草稿',exact:true}).click();await panel.getByText('政策草稿已保存。',{exact:true}).waitFor();await gate.settle();
   const view=await root.h.get('/research-studies/'+c.studyId+'/protocols/'+c.protocolId+'/release');assert(view.policy);assert.equal(view.policy.versionNumber,1);assert.equal(view.policy.createdBy,actor.accountId);assert.equal(view.protocol.revision,expectedRevision);assert.equal(view.protocol.status,'draft');
   const actual=structuredClone(view.policy.sections);for(const section of Object.values(actual)){delete section.decidedBy;delete section.decidedAt;}assert.deepEqual(actual,recipe);assert.equal(bodyHash(view.policy.sections),view.policy.contentHash);
   const dbProof=await verifyPolicyDatabase(root,c,gate.report.requests.at(-1),recipe);for(const [db,viewKey]of [['policyId','id'],['contentHash','contentHash'],['versionNumber','versionNumber']])assert.equal(dbProof[db],view.policy[viewKey]);save(out+'policy-database-proof.json',dbProof);await ledger.markVerified(gate.report.requests.at(-1).sequence,{via:'database'});
   const tuples=existsSync(tuplesPath)?json(tuplesPath):{};assert(!tuples[code]);tuples[code]={id:view.policy.id,contentHash:view.policy.contentHash,versionNumber:1,createdBy:actor.accountId,revision:expectedRevision};save(tuplesPath,tuples);save(out+'saved-policy.json',{code,actor,tuple:tuples[code],recipeHash:bodyHash(recipe)});await shot('policy-saved');
   if(Object.keys(tuples).length===3){const proofs=[];for(const k of ['A','B','D']){const attempt=ledger.snapshot().attempts.find(a=>a.code===k&&a.action==='policy'&&a.accepted);assert(attempt);proofs.push({code:k,...await verifyPolicyDatabase(root,{...root.cases[k],code:k},attempt,wf03PolicySections(k))});}save(out+'all-policy-database-proofs.json',{readOnly:true,proofs});const manifest={...resources,phase:'policies-frozen-before-submission',at:new Date().toISOString(),runtimePid:root.h.runtime.pid,policyTuples:tuples,policyDatabaseProofs:proofs,manifestInput:'actual-native-policy-UI-saves-and-real-DB'};save(wf03Private+'execution-manifest.json',manifest,{exclusive:true});save(wf03Evidence+'execution-manifest.json',manifest,{exclusive:true});}
  }else if(mode==='submit'){
   assert(tuple&&existsSync(wf03Private+'execution-manifest.json'),'ALL_ACTUAL_POLICIES_MUST_BE_FROZEN_FIRST');
   if(code==='A'){
    gate.arm('check',{dropResponse:true});await panel.getByRole('button',{name:'提交审核',exact:true}).click();await panel.getByRole('button',{name:'核对上次检查结果',exact:true}).waitFor();await gate.settle();await shot('check-response-lost');
    assert.equal(gate.report.requests.filter(r=>r.action==='submit').length,0);const marker=await page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('researchhub:release-workflow:v1:')).map(([key,value])=>({key,value:JSON.parse(value)})));assert(marker.some(m=>m.value.pending?.requestKey===gate.report.requests.at(-1).requestKey));save(out+'original-marker-before-reload.json',{marker});
    const unloads=[],onDialog=async dialog=>{assert.equal(dialog.type(),'beforeunload');unloads.push({type:dialog.type(),accepted:true});await dialog.accept();};page.once('dialog',onDialog);try{await page.reload();}finally{page.off('dialog',onDialog);}save(out+'unknown-reload-beforeunload.json',{dialogs:unloads,actualBrowserProtection:unloads.length===1});await panel.getByRole('button',{name:'核对上次检查结果',exact:true}).waitFor();assert.equal((await recover('check')).found,true);await panel.getByRole('button',{name:'继续提交审核',exact:true}).waitFor();assert.equal(gate.report.requests.length,1);await shot('check-recovered-awaiting-explicit-submit');
    gate.arm('submit');await panel.getByRole('button',{name:'继续提交审核',exact:true}).click();
   }else{gate.arm(['check','submit']);await panel.getByRole('button',{name:'提交审核',exact:true}).click();}
   await panel.getByText('方案状态：待审核',{exact:true}).waitFor();await gate.settle();await completedUi('submit');await markUi(['check','submit']);await shot('submitted');
   if(code==='B'){assert.equal(await panel.getByRole('button',{name:'批准并启用',exact:true}).count(),0);await panel.getByText('需要由另一位有权人员独立审核',{exact:true}).waitFor();save(out+'independent-author-block.json',{actor,policy:tuple,buttonAbsent:true,writes:gate.report.requests.map(x=>x.action)});}
  }else if(mode==='recover'){
   assert.equal((await recover('activate')).found,true);await completedUi('release');assert.equal(gate.report.requests.length,0);for(const attempt of ledger.snapshot().attempts.filter(a=>a.code===code&&a.accepted&&['approve','activate'].includes(a.action)))await ledger.markVerified(attempt.sequence,{via:'ui'});await shot('actual-original-activation-recovered');
  }else{
   assert(tuple);if(code==='B'){
    await page.getByRole('button',{name:'管理与治理',exact:true}).click();await page.waitForURL(u=>u.pathname==='/pages/g02/');await page.getByRole('button',{name:'刷新待办',exact:true}).click();
    await page.waitForFunction(({study,protocol})=>Array.from(document.querySelectorAll('a[href]')).some(a=>{const u=new URL(a.href);return u.pathname==='/pages/s07/'&&u.searchParams.get('studyId')===study&&u.searchParams.get('protocolId')===protocol;}),{study:c.studyId,protocol:c.protocolId});
    const href=await page.locator('a[href]').evaluateAll((links,{study,protocol})=>links.map(a=>a.href).find(h=>{const u=new URL(h);return u.pathname==='/pages/s07/'&&u.searchParams.get('studyId')===study&&u.searchParams.get('protocolId')===protocol;}),{study:c.studyId,protocol:c.protocolId});
    let clicked=false;for(const link of await page.locator('a[href]').all()){if(new URL(await link.getAttribute('href'),page.url()).href===href){await link.click();clicked=true;break;}}assert(clicked);await page.waitForURL(u=>u.pathname==='/pages/s07/');assert(new URL(page.url()).searchParams.has('governanceModule'));save(out+'governance-entry.json',{actualHref:href});
   }
   const primary=panel.getByRole('button',{name:'批准并启用',exact:true});await primary.waitFor();await primary.click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'批准并启用',exact:true}).waitFor();await shot('one-confirmation');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await primary.evaluate(n=>document.activeElement===n),true,'ESC_RESTORES_FOCUS');assert.equal(gate.report.requests.length,0);await primary.click();
   gate.arm(code==='D'?'approve':['approve','activate'],code==='D'?{dropResponse:true}:{});await page.getByRole('dialog').getByRole('button',{name:'批准并启用',exact:true}).click();
   if(code==='D'){
    await panel.getByRole('button',{name:'核对上次批准结果',exact:true}).waitFor();await gate.settle();assert.equal(gate.report.requests.length,1);await shot('approve-response-lost');assert.equal((await recover('approve')).found,true);await panel.getByRole('button',{name:'继续启用',exact:true}).waitFor();assert.equal(gate.report.requests.length,1);await shot('approved-explicit-continuation');
    gate.arm('activate',{interceptBeforeNative:true});await panel.getByRole('button',{name:'继续启用',exact:true}).click();await panel.getByRole('button',{name:'核对上次启用结果',exact:true}).waitFor();await gate.settle();assert.equal((await recover('activate')).found,false);await panel.getByRole('button',{name:'按原请求重试',exact:true}).waitFor();await shot('unknown-not-found-explicit-retry');
    gate.arm('activate',{retry:true,dropResponse:true});await panel.getByRole('button',{name:'按原请求重试',exact:true}).click();await panel.getByRole('button',{name:'核对上次启用结果',exact:true}).waitFor();await gate.settle();assert.equal((await recover('activate')).found,true);
   }
   await panel.getByText('方案状态：执行中',{exact:true}).waitFor();await gate.settle();await completedUi('release');await markUi(['approve','activate']);await shot('executing');
   if(code==='B'){await page.getByRole('button',{name:'返回治理总览',exact:true}).click();await page.waitForURL(u=>u.pathname==='/pages/g02/');await page.getByRole('button',{name:'刷新待办',exact:true}).waitFor();await page.screenshot({path:out+'returned-governance.png',fullPage:true});save(out+'governance-return.json',{actualUrl:page.url()});}
  }
  save(out+'gate.json',gate.report);save(out+'ledger.json',ledger.snapshot());assert.equal(gate.report.blocked.length,0);save(out+'protection.json',await root.protect('native-ui-'+code+'-'+mode));save(out+'root-result.json',{at:new Date().toISOString(),code,mode,passed:true,counts:ledger.counts()});process.stdout.write(JSON.stringify({passed:true,code,mode,evidence:out,counts:ledger.counts()})+'\n');
 }catch(error){if(gate)save(out+'gate.json',gate.report);if(page){await page.screenshot({path:out+'failure-current.png'}).catch(()=>{});save(out+'failure-current-ui.json',{url:page.url(),bodyText:await page.locator('main').innerText().catch(()=>''),errorSelectorMessage:['TimeoutError','AssertionError'].includes(error.name)?String(error.message).slice(0,500):undefined});}save(out+'root-result.json',{at:new Date().toISOString(),code,mode,passed:false,error:{name:error.name,message:error.name==='AssertionError'?String(error.message).slice(0,220):undefined},counts:ledger.counts()});process.stderr.write(JSON.stringify({passed:false,code,mode,evidence:out,errorName:error.name})+'\n');process.exitCode=1;}
 finally{if(gate)await gate.close();if(context){await context.request.post(origin+'/api/auth/logout',{headers:{Origin:origin,'X-ResearchHub-Request':'session-v1'},data:{}}).catch(()=>{});await context.close();}if(root)await root.close();}
}
await main();
