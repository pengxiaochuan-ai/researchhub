// Root-owned browser helpers only. No runner, credential loading, browser launch or import-time I/O.
import assert from 'node:assert/strict';
import {save,bodyHash,requireWindow,mutationAction,expectedNativeStatus} from './study-workflow-wf02-qa.mjs';

// Root supplies its already authenticated context. Every business POST starts at a real UI button.
export async function installNativeImportGate(context,{manifest,code,actor,ledger,outputDir,origin='http://127.0.0.1:19501',env=process.env}){
 requireWindow(env);assert.equal(actor.actorId,manifest.cases[code].actorId);assert.equal(actor.authVersion,manifest.cases[code].authVersion);
 assert(outputDir.startsWith('/'),'ABSOLUTE_EVIDENCE_DIRECTORY_REQUIRED');
 const report={schema:1,code,actorId:actor.actorId,authVersion:actor.authVersion,requests:[],blocked:[],failures:[]};
 const tasks=new Set(),pattern='**/api/**';let armed=null;
 const persist=()=>save(outputDir+'/native-gate.json',report);
 const handler=route=>{
  const operation=(async()=>{
   const req=route.request(),url=new URL(req.url()),method=req.method(),path=url.pathname;
   assert.equal(url.origin,origin,'UNREGISTERED_TARGET_ORIGIN');
   if(['GET','HEAD','OPTIONS'].includes(method)||path.startsWith('/api/auth/'))return route.continue();
   if(!armed||armed.used||mutationAction(method,path)===null){
    report.blocked.push({at:new Date().toISOString(),method,path,reason:armed?.used?'already-dispatched':'not-armed'});persist();return route.abort('blockedbyclient');
   }
   const current=armed;current.used=true;
   const record=ledger.beforeRequest(current.step,{method,path,body:req.postDataJSON(),...actor});
   report.requests.push(record);persist();
   const response=await route.fetch();
   ledger.responded(current.step,record,response.status());persist();
   assert.equal(response.status(),current.expectedStatus,'UNEXPECTED_NATIVE_IMPORT_STATUS_RECONCILE_OR_RECORD_4XX');
   if(current.dropResponse){
    record.responseDiscarded=true;ledger.event(current.step,'real-200-response-discarded',{requestKey:record.requestKey});persist();return route.abort('failed');
   }
   return route.fulfill({response});
  })();
  const task=operation.catch(async error=>{
   // Do not persist Playwright's message/call log: it can contain headers or credentials.
   report.failures.push({at:new Date().toISOString(),name:error.name??'Error',code:error.code??null});persist();await route.abort('failed').catch(()=>{});
  }).finally(()=>tasks.delete(task));
  tasks.add(task);return task;
 };
 await context.route(pattern,handler);persist();
 return{report,
  arm(step,{dropResponse=false,expectedStatus=expectedNativeStatus}={}){
   assert.equal(step.code,code);assert(['import','import-loss'].includes(step.name));assert(!armed,'ONE_ARMED_STEP_ONLY');
   assert(expectedStatus===200||expectedStatus>=400&&expectedStatus<500,'ONLY_NATIVE_SUCCESS_OR_DEFINITE_REJECTION_EXPECTED');
   if(dropResponse)assert.equal(expectedStatus,200,'DISCARD_ONLY_REAL_NATIVE_SUCCESS');
   armed={step,dropResponse,expectedStatus,used:false};return armed;
  },
  disarm(){assert.equal(tasks.size,0,'WAIT_FOR_NATIVE_ROUTE_BEFORE_DISARM');armed=null;},
  async settle(){await Promise.allSettled([...tasks]);assert.equal(report.failures.length,0,'NATIVE_GATE_FAILED_CHECK_ORIGINAL_KEY_ONLY');},
  async close(){await Promise.allSettled([...tasks]);await context.unroute(pattern,handler);armed=null;persist();}
 };
}

export async function captureActualPage(page,{outputDir,label,role,stage,origin='http://127.0.0.1:19501',env=process.env}){
 requireWindow(env);assert(outputDir.startsWith('/'));assert.match(label,/^[a-zA-Z0-9-]{1,100}$/);
 const url=page.url();await page.bringToFront();
 const response=await page.context().request.get(origin+'/api/auth/me').catch(()=>null);
 const auth=response?.status()===200?await response.json().catch(()=>null):null;
 const record={at:new Date().toISOString(),label,role,stage,url,authStatus:response?.status()??null,actualActorId:auth?.accountId??null,authVersion:Number.isInteger(auth?.authVersion)?auth.authVersion:null};
 save(outputDir+'/'+label+'-active.json',record);await page.screenshot({path:outputDir+'/'+label+'.png',fullPage:true});return record;
}

const markerPrefix='researchhub:protocol-template:v1:';
export function validatePendingPopupLink(href,target,rel,{origin,studyId}){
 const u=new URL(href,origin);assert.equal(u.origin,origin);assert.equal(u.pathname,'/pages/s02/');assert.equal(u.hash,'');
 assert.equal(u.searchParams.get('formalPreparation'),'1');assert.equal(u.searchParams.get('studyId'),studyId);
 assert.deepEqual([...u.searchParams.keys()].sort(),['formalPreparation','studyId']);assert.equal(target,'_blank');
 const tokens=(rel??'').split(/\s+/);assert(tokens.includes('noopener')&&tokens.includes('noreferrer'));return u.href;
}
export function assertPendingMarkerPreserved(before,after,request,url){
 const find=entries=>{
  const matches=entries.filter(([key,text])=>key.startsWith(markerPrefix)&&JSON.parse(text).requestKey===request.requestKey);assert.equal(matches.length,1,'ONE_REAL_ORIGINAL_PENDING_MARKER_REQUIRED');
  const [key,text]=matches[0],r=JSON.parse(text),binding=JSON.parse(decodeURIComponent(key.slice(markerPrefix.length)));
  assert.deepEqual(binding,[request.actorId,request.authVersion,request.studyId,url]);
  assert.deepEqual(Object.keys(r).sort(),['schema','action','authVersion','requestHash','requestKey','sourceFingerprint','sourceProtocolId','sourceStudyId','studyId','targetFingerprint'].sort(),'OPAQUE_PENDING_MARKER_ONLY');
  assert.equal(r.schema,1);for(const k of ['action','authVersion','requestKey','requestHash','studyId','sourceStudyId','sourceProtocolId','sourceFingerprint','targetFingerprint'])assert.equal(r[k],request[k]);return[key,text];
 };
 const original=find(before),current=find(after);assert.deepEqual(current,original,'ORIGINAL_PENDING_MARKER_BYTES_MUST_REMAIN');
 return{keyHash:bodyHash(original[0]),markerHash:bodyHash(original[1])};
}

export async function verifyPendingPopup({page,request,manifest,code,gate,outputDir,origin='http://127.0.0.1:19501',env=process.env}){
 requireWindow(env);assert.equal(code,'D');const c=manifest.cases[code],s=manifest.sources[c.sourceId],context=page.context();
 const originalUrl=page.url(),bound=new URL(originalUrl),entries=()=>page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('researchhub:protocol-template:v1:')));
 const before=await entries();assertPendingMarkerPreserved(before,before,request,bound.pathname+bound.search);
 const released=gate.report.requests.length,blocked=gate.report.blocked.length,records=[];
 const report={at:new Date().toISOString(),code,stage:'before-popup-click',originalUrl,passed:false,network:[]};let popup;
 const persist=()=>save(outputDir+'/pending-popup.json',report);
 const responseListener=response=>{const r=response.request(),u=new URL(response.url());if(u.origin!==origin||!u.pathname.startsWith('/api/'))return;let owner;try{owner=r.frame().page();}catch{return;}records.push({owner,method:r.method(),path:u.pathname,query:u.search,status:response.status()});};
 context.on('response',responseListener);persist();
 try{
  const link=page.getByRole('link',{name:'在新标签页核对已保存方案',exact:true});
  const expected=validatePendingPopupLink(await link.getAttribute('href'),await link.getAttribute('target'),await link.getAttribute('rel'),{origin,studyId:c.studyId});
  const opened=context.waitForEvent('page');await link.click();popup=await opened;report.stage='popup-loading';persist();
  await popup.waitForURL(u=>u.href===expected);await popup.waitForLoadState('domcontentloaded');
  const details=popup.locator('.ep-template-origin details').filter({hasText:s.protocolId}).first();await details.waitFor();
  if(!await details.evaluate(n=>n.open))await details.locator('summary').click();assert((await details.innerText()).includes(s.studyId));
  const actual=await captureActualPage(popup,{outputDir,label:'D-recover-popup-readonly',role:c.role,stage:report.stage,origin,env});
  assert.equal(actual.actualActorId,c.actorId);assert.equal(actual.authVersion,c.authVersion);assert.equal(actual.authStatus,200);
  report.popup={url:popup.url(),actorId:actual.actualActorId,authVersion:actual.authVersion};
  report.network=records.filter(r=>r.owner===popup).map(({owner,...r})=>r);
  assert(report.network.some(r=>r.path==='/api/research-studies/'+c.studyId+'/configuration'&&r.method==='GET'&&r.status===200),'REAL_POPUP_TARGET_CONFIGURATION_GET_REQUIRED');
  for(const r of report.network){if(!r.path.startsWith('/api/auth/'))assert(['GET','HEAD','OPTIONS'].includes(r.method),'POPUP_BUSINESS_GET_ONLY');const match=r.path.match(/^\/api\/research-studies\/([^/]+)\//);if(match)assert.equal(match[1],c.studyId,'POPUP_MUST_KEEP_TARGET_STUDY');}
  assert.equal(gate.report.requests.length,released,'POPUP_MUST_NOT_RELEASE_IMPORT_POST');assert.equal(gate.report.blocked.length,blocked,'POPUP_MUST_NOT_ATTEMPT_BUSINESS_WRITE');
  await popup.close();popup=null;await page.bringToFront();await page.getByRole('button',{name:'核对上次带入结果',exact:true}).waitFor();
  assert.equal(page.url(),originalUrl,'ORIGINAL_TAB_MUST_NOT_NAVIGATE');report.originalPending=assertPendingMarkerPreserved(before,await entries(),request,bound.pathname+bound.search);
  await captureActualPage(page,{outputDir,label:'D-recover-original-pending-preserved',role:c.role,stage:'returned-from-popup',origin,env});
  report.stage='returned-with-original-pending';report.passed=true;persist();return report;
 }catch(error){report.error={name:error.name??'Error',code:error.code??null};if(popup)await captureActualPage(popup,{outputDir,label:'D-recover-popup-failure-active',role:c.role,stage:report.stage,origin,env}).catch(()=>{});persist();throw Error('WF02_POPUP_READONLY_CHECK_FAILED');
 }finally{context.off('response',responseListener);if(popup)await popup.close().catch(()=>{});await page.bringToFront().catch(()=>{});persist();}
}
