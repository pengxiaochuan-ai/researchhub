// Read-only synthetic QA. Reconstructs a marker from retained real wire evidence;
// it does not manufacture or claim a real lost response.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,chmodSync,realpathSync,rmSync} from 'node:fs';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {requestHash} from '../server/research-studies/contract.mjs';
import {createFullStudyMarker,fullStudyInputHash,fullStudyProcessInput,fullStudyMarkerKey,fullStudyBatchProved,fullStudyProcessResult,readFullStudyRecovery} from '../src/full-study-ui-session.js';
const repo=fileURLToPath(new URL('../',import.meta.url)),workspace=fileURLToPath(new URL('../../',import.meta.url));
const task='full-study-compute-tail-2026-11-16',base='http://127.0.0.1:19501',stage='after-3',admin='rh-kb-local-b0e2af9d-admin';
const evidenceRoot=join(repo,'docs/testing/evidence',task),privateRoot=join(workspace,'.tmp',task,stage);
const defaultManifest=join(evidenceRoot,'browser/after-3-3b24e3e1/manifest.json');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const nativeIds=g=>g.slices.filter(s=>s.snapshotId).map(s=>s.methodRunId).sort();
const provenance='QA marker reconstructed from the original retained wire request and actual identity/source; not a real response-loss experiment';
export async function buildWireRecovery(manifest,post,{groupId}){
 assert.equal(manifest.task,task);assert.equal(manifest.stage,stage);assert.equal(manifest.passed,true);assert.equal(typeof manifest.contextsClosedAt,'string');
 assert.equal(manifest.actorId,admin);assert.equal(manifest.authVersion,5);assert.equal(groupId,manifest.groupId);assert(/^full-run-[A-Za-z0-9_-]+$/.test(groupId));
 const last=manifest.batches?.at(-1),runPath='/api/research-studies/'+manifest.studyId+'/analysis/runs/'+groupId;
 assert(last);assert.equal(last.role,'admin');assert.equal(last.method,'POST');assert.equal(last.path,runPath+'/process');assert.equal(last.status,200);assert.equal(last.limit,3);assert.equal(last.remaining,0);assert.equal(last.memberCount,2);
 const body={requestKey:last.requestKey,expectedStateHash:last.expectedStateHash,limit:last.limit};
 const marker=await createFullStudyMarker({actor:manifest.actorId,authVersion:manifest.authVersion,studyId:manifest.studyId,planId:post.planId,snapshotId:manifest.snapshotId,manifestHash:manifest.manifestHash},'process',groupId,{expectedStateHash:body.expectedStateHash,limit:body.limit},body.requestKey);
 assert.equal(marker.inputHash,await fullStudyInputHash(fullStudyProcessInput(marker)));
 assert(await fullStudyBatchProved(post,marker),'Original actual raw POST proof is required');
 const g=await fullStudyProcessResult(post,marker),ids=nativeIds(g);
 assert.equal(g.remaining,0);assert.equal(g.status,'needs_review');assert.equal(g.slices.filter(s=>s.status==='not_applicable').length,15);assert.equal(ids.length,39);assert.equal(new Set(ids).size,39);assert(ids.every(x=>typeof x==='string'&&x.length));
 assert.equal(post.batchReceipt.targets.length,2);assert.equal(post.batchReceipt.items.length,2);assert.equal(post.batchReceipt.status,'completed');
 return{provenance,body,marker,markerKey:fullStudyMarkerKey(marker),runPath,recoveryPath:runPath+'/process-receipts/'+encodeURIComponent(body.requestKey),targets:structuredClone(post.batchReceipt.items),targetsHash:post.batchReceipt.targetsHash,nativeIds:ids,postTargets:structuredClone(post.batchReceipt.targets),commandDigest:requestHash({studyId:manifest.studyId,id:groupId,body}),postStateHash:g.stateHash};
}
export async function verifyWireRecoveryReceipt(raw,p){
 assert(Object.hasOwn(raw,'group'),'Recovery must use actual GET envelope, never reconstruct one for live proof');
 assert(await fullStudyBatchProved(raw,p.marker),'Exact production batch proof rejected actual GET');
 const group=await fullStudyProcessResult(raw,p.marker);
 assert.deepEqual(raw.batchReceipt.targets,p.postTargets);assert.deepEqual(raw.batchReceipt.items,p.targets);assert.equal(raw.batchReceipt.targetsHash,p.targetsHash);
 assert.equal(group.remaining,0);assert.equal(group.status,'needs_review');assert.equal(group.stateHash,p.postStateHash);assert.deepEqual(nativeIds(group),p.nativeIds);
 return{executionConfirmed:true,runIds:raw.batchReceipt.items.map(x=>x.runId),targetsHash:raw.batchReceipt.targetsHash,rows:p.nativeIds.length,markerInputHash:p.marker.inputHash,originalCommandDigest:p.commandDigest,digestProvenance:'Computed from original captured request body; GET does not echo a requestDigest field'};
}
export async function readWireRecovery(request,p){return verifyWireRecoveryReceipt(await readFullStudyRecovery(request,p.marker),p);}
export function recoveryRequestAllowed(method,url){const u=new URL(url);return u.origin===base&&u.pathname.startsWith('/api/')&&(method==='GET'||method==='POST'&&u.pathname==='/api/auth/renew');}
function sourceFile(path,parent){const p=realpathSync(path),root=realpathSync(parent);assert(p.startsWith(root+sep),'Only explicit current-task evidence/private paths are allowed');return p;}
function session(file,name){const path=sourceFile(file,privateRoot);assert.equal(path,join(realpathSync(privateRoot),name));const value=json(path);assert.equal(typeof value.cookie,'string');const pair=value.cookie.split(';')[0],i=pair.indexOf('=');assert(i>0);return{metadata:value,cookie:{name:pair.slice(0,i),value:pair.slice(i+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'}};}
const safe=x=>/cookie|authorization|bearer|password|access.?token|refresh.?token/i.test(x)?'[sensitive message omitted]':String(x).slice(0,1600);
export async function runReadOnlyRecovery(){
 assert.equal(process.env.FULL_STUDY_COMPUTE_TAIL_RECOVERY_WINDOW,'explicit','No HTTP/browser without explicit root recovery window');
 const priorFile=sourceFile(process.env.FULL_STUDY_COMPUTE_TAIL_RECOVERY_MANIFEST,evidenceRoot),prior=json(priorFile),last=prior.batches.at(-1),rawPostFile=sourceFile(last.rawResponseFile,dirname(priorFile));
 const p=await buildWireRecovery(prior,json(rawPostFile),{groupId:process.env.FULL_STUDY_COMPUTE_TAIL_RECOVERY_GROUP_ID});
 assert(process.env.ADMIN_SESSION_FILE&&process.env.MANAGER_SESSION_FILE,'Explicit current-task private sessions are required');
 const owner=session(process.env.ADMIN_SESSION_FILE,'admin-session.json'),manager=session(process.env.MANAGER_SESSION_FILE,'manager-session.json');
 assert.equal(typeof manager.metadata.actorId,'string');assert.notEqual(manager.metadata.actorId,admin);assert(Number.isSafeInteger(manager.metadata.authVersion));
 const out=join(evidenceRoot,'browser','recovery-'+randomUUID().slice(0,8)),profile=mkdtempSync('/tmp/rh-tail-readonly-recovery-');chmodSync(profile,0o700);mkdirSync(out,{recursive:true});
 const result={task,stage,mode:'read-only marker recovery after owned restart',provenance,priorManifest:priorFile,rawOriginalPost:rawPostFile,studyId:prior.studyId,groupId:prior.groupId,actorId:admin,authVersion:5,body:p.body,commandDigest:p.commandDigest,markerInputHash:p.marker.inputHash,markerFields:Object.keys(p.marker).sort(),requests:[],blockedWrites:[],pageErrors:[],consoleErrors:[],networkFailures:[],expectedTeardownReads:[],screenshots:[],passed:false,startedAt:new Date().toISOString()};
 const save=()=>writeFileSync(join(out,'manifest.json'),JSON.stringify(result,null,2)),pending=new Set();let context,managerContext,page,fatal=null,closing=false;
 const defer=promise=>{pending.add(promise);promise.catch(e=>{if(!closing)fatal??=e.message;}).finally(()=>pending.delete(promise));};
 const flush=async()=>{while(pending.size)await Promise.allSettled([...pending]);if(fatal)throw Error(fatal);};
 async function routeGuard(c){await c.route('**/api/**',route=>{const r=route.request();if(recoveryRequestAllowed(r.method(),r.url()))return route.continue();result.blockedWrites.push({method:r.method(),path:new URL(r.url()).pathname});fatal??='Unexpected business mutation blocked';save();return route.abort('blockedbyclient');});}
 function attach(pg,role){
  pg.on('pageerror',e=>{result.pageErrors.push({role,message:safe(e.message)});save();});pg.on('console',m=>{if(m.type()==='error'){result.consoleErrors.push({role,message:safe(m.text())});save();}});
  pg.on('requestfailed',r=>{if(new URL(r.url()).pathname.startsWith('/api/')){const item={role,path:new URL(r.url()).pathname,method:r.method(),error:r.failure()?.errorText};if(closing&&r.method()==='GET')result.expectedTeardownReads.push(item);else result.networkFailures.push(item);save();}});
  pg.on('dialog',async d=>{if(d.type()==='beforeunload')await d.accept();else{result.pageErrors.push({role,message:'Unexpected dialog: '+d.type()});await d.dismiss();}});
  pg.on('response',r=>defer((async()=>{const request=r.request(),u=new URL(r.url());if(!u.pathname.startsWith('/api/')||u.pathname.startsWith('/api/auth/'))return;const record={role,method:request.method(),path:u.pathname,query:u.search,status:r.status()};result.requests.push(record);if(u.pathname===p.recoveryPath&&role==='admin'){const raw=await r.json();record.rawResponseFile=join(out,'raw-admin-receipt-'+result.requests.length+'.json');writeFileSync(record.rawResponseFile,JSON.stringify(raw,null,2));assert.equal(r.status(),200);result.proof=await verifyWireRecoveryReceipt(raw,p);record.productionProof=true;}else assert(r.ok(),'Unexpected readonly HTTP '+r.status()+' '+u.pathname);save();})()));
 }
 const url=base+'/pages/s05/?'+new URLSearchParams({formalAnalysis:'1',studyId:prior.studyId,runGroupId:prior.groupId});
 const ready=async pg=>{await pg.locator('.full-study-slices table').first().waitFor({timeout:180000});await pg.waitForFunction(()=>document.querySelector('.full-study-v2')?.getAttribute('aria-busy')==='false',{}, {timeout:180000});};
 async function screenshot(pg,name){const path=join(out,name+'.png');await pg.screenshot({path,fullPage:true});result.screenshots.push(path);save();}
 try{
  const pw=await import(join(workspace,'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js')),chromium=pw.chromium??pw.default.chromium;
  context=await chromium.launchPersistentContext(join(profile,'admin'),{headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:1000},args:['--window-size=1440,1000'],recordVideo:{dir:join(out,'video-admin'),size:{width:1440,height:1000}}});await context.addCookies([owner.cookie]);await routeGuard(context);
  const meResponse=await context.request.get(base+'/api/auth/me',{timeout:90000});assert(meResponse.ok());const me=await meResponse.json();assert.equal(me.accountId,admin);assert.equal(me.authVersion,5);
  await context.addInitScript(({origin,key,marker})=>{if(location.origin===origin&&window.top===window){sessionStorage.setItem(key,JSON.stringify(marker));window.__wireRecoveryMarkerInjected={key,fields:Object.keys(marker),at:Date.now()};}},{origin:base,key:p.markerKey,marker:p.marker});
  page=context.pages()[0];attach(page,'admin');await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await screenshot(page,'01-admin-entry-from-reconstructed-marker');await ready(page);await flush();
  if(!result.proof){const recover=page.getByRole('button',{name:'核对上次操作结果',exact:true});await recover.waitFor({timeout:30000});await recover.click();await ready(page);await flush();result.recoveryTrigger='Existing recovery button';}else result.recoveryTrigger='Existing automatic GET recovery on page load';
  assert(result.proof);assert(await page.evaluate(k=>window.__wireRecoveryMarkerInjected?.key===k&&!sessionStorage.getItem(k),p.markerKey),'Marker was not cleared by actual product recovery');
  result.markerCleared=true;assert.equal(await page.locator('.full-study-slices section table tbody tr').count(),39);assert.equal(await page.locator('main [role=alert]').count(),0);assert(await page.getByText('原计算结果已核对，后续计算需手动继续。',{exact:true}).isVisible());await screenshot(page,'02-admin-recovered-thirty-nine-results');
  managerContext=await chromium.launchPersistentContext(join(profile,'manager'),{headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1440,height:1000},recordVideo:{dir:join(out,'video-manager'),size:{width:1440,height:1000}}});await managerContext.addCookies([manager.cookie]);await routeGuard(managerContext);
  const managerMe=await managerContext.request.get(base+'/api/auth/me',{timeout:90000});assert(managerMe.ok());const researcher=await managerMe.json();assert.equal(researcher.accountId,manager.metadata.actorId);assert.equal(researcher.authVersion,manager.metadata.authVersion);
  const denied=await managerContext.request.get(base+p.recoveryPath,{timeout:90000});result.managerReceipt={actorId:researcher.accountId,authVersion:researcher.authVersion,method:'GET',path:p.recoveryPath,status:denied.status()};assert([403,404].includes(denied.status()),'Manager must not obtain the owner receipt');writeFileSync(join(out,'raw-manager-denied.json'),JSON.stringify(await denied.json(),null,2));
  const mp=managerContext.pages()[0];attach(mp,'manager');await mp.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await ready(mp);await flush();assert.equal(await mp.locator('.full-study-slices section table tbody tr').count(),39);assert.equal(await mp.locator('main [role=alert]').count(),0);await screenshot(mp,'03-manager-readonly-thirty-nine-results');
  assert.deepEqual(result.blockedWrites,[]);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.consoleErrors,[]);assert.deepEqual(result.networkFailures,[]);result.passed=true;
 }catch(error){result.error=safe(error.message);if(page)try{result.pendingMarkerPresent=await page.evaluate(k=>!!sessionStorage.getItem(k),p.markerKey);await screenshot(page,'failure');}catch{}throw error;}
 finally{
  try{await flush();}catch(error){result.error??=safe(error.message);result.passed=false;}
  closing=true;const closed=await Promise.allSettled([managerContext?.close(),context?.close()]);await Promise.allSettled([...pending]);
  result.contextCloseErrors=closed.filter(x=>x.status==='rejected').map(x=>safe(x.reason?.message??'context close failed'));
  if(!result.contextCloseErrors.length){try{rmSync(profile,{recursive:true,force:true});result.privateProfileRemoved=true;}catch(error){result.privateProfileRemoved=false;result.error??=safe(error.message);result.passed=false;}}else result.privateProfileRemoved=false;
  if(result.contextCloseErrors.length||result.pageErrors.length||result.consoleErrors.length||result.blockedWrites.length||result.networkFailures.length)result.passed=false;
  result.contextsClosedAt=new Date().toISOString();save();console.log(JSON.stringify({evidence:join(out,'manifest.json'),passed:result.passed,contextsClosedAt:result.contextsClosedAt}));
 }
 if(!result.passed)throw Error(result.error??'Readonly recovery QA failed');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--offline')){const path=process.env.FULL_STUDY_COMPUTE_TAIL_RECOVERY_MANIFEST??defaultManifest,m=json(path),p=await buildWireRecovery(m,json(m.batches.at(-1).rawResponseFile),{groupId:m.groupId});console.log(JSON.stringify({offline:true,network:false,browser:false,groupId:m.groupId,memberCount:p.targets.length,nativeRows:p.nativeIds.length,provenance:p.provenance,markerFields:Object.keys(p.marker).sort()}));}
 else await runReadOnlyRecovery();
}
