// Root-injected read-only UI helpers. Importing opens no target, credential, browser or PG connection.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {formalUrl} from '../src/formal-preparation-session.js';
import {save,bodyHash,requireWindow,validateManifest,receiptCandidate} from './study-workflow-wf02-qa.mjs';
import {installNativeImportGate,captureActualPage} from './study-workflow-wf02-browser.mjs';
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const dimensions=[[1440,1000],[1920,1200],[1366,768],[390,844],[320,844]];
export function verifiedVisualTarget(manifest,ledger,code){
 validateManifest(manifest);assert.equal(ledger.journal.manifestHash,bodyHash(manifest),'VISUAL_MUST_USE_CURRENT_FROZEN_MANIFEST');const c=manifest.cases[code];assert(c);const source=manifest.sources[c.sourceId],step=ledger.journal.steps[code+'.'+(code==='D'?'import-loss':'import')];
 assert.equal(step?.status,'verified','READONLY_VISUAL_REQUIRES_VERIFIED_IMPORT');assert.equal(step.requests.length,1);assert(step.requests[0].proof?.protocolId);
 const r=step.requests[0];for(const [key,value]of Object.entries({studyId:c.studyId,actorId:c.actorId,authVersion:c.authVersion,sourceStudyId:source.studyId,sourceProtocolId:source.protocolId,sourceFingerprint:source.fingerprint}))assert.equal(r[key],value,'VISUAL_MUST_NOT_RESTORE_OLD_SOURCE_CHECKPOINT');
 assert(!Object.values(ledger.journal.steps).flatMap(s=>s.requests).some(r=>receiptCandidate(r)&&!r.proof),'UNRESOLVED_ORIGINAL_WRITE_FIRST');return{c,source,protocolId:r.proof.protocolId};
}
export function assertVisualMeasurement(m,{physical=false}={}){
 assert(m.documentScrollWidth<=m.innerWidth+1,'HORIZONTAL_PAGE_OVERFLOW');assert(m.mainScrollWidth<=m.mainClientWidth+1,'HORIZONTAL_MAIN_OVERFLOW');assert(m.controls.length>0);
 for(const c of m.controls){assert.equal(c.fontSize,'14px','OPERATION_FONT_14_REQUIRED');if(c.tag==='SELECT'&&c.lineHeight==='normal'){assert.equal(c.appearance,'auto');assert(c.authored22,'NATIVE_SELECT_AUTHORED_22_REQUIRED');assert(c.rect.height>=40,'NATIVE_SELECT_MIN_40_REQUIRED');}else assert.equal(c.lineHeight,'22px','OPERATION_LINE_HEIGHT_22_REQUIRED');assert(c.rect.left>=-1&&c.rect.right<=m.innerWidth+1,'CONTROL_HORIZONTAL_CLIP');if(['BUTTON','SUMMARY'].includes(c.tag)){assert(c.rect.height>=40);assert(c.scrollWidth<=c.clientWidth+1,'ACTION_TEXT_CLIPPED');}}
 assert(m.tail.reachable,'FIXED_CONTENT_LAST_ITEM_NOT_REACHABLE');assert(m.tail.hitMatches,'FIXED_CONTENT_LAST_ITEM_COVERED');
 if(physical){assert.equal(m.innerWidth,720,'NATIVE_200_MUST_BE_720_CSS');assert.equal(m.devicePixelRatio,2);assert.equal(m.visualViewport.scale,1);assert.equal(m.png.width,1440,'NATIVE_200_RAW_PNG_1440_REQUIRED');}return true;
}
export function observedGovernanceTargets(anchors,{origin,studyId,protocolId}){
 return anchors.filter(a=>{if(!a.visible)return false;try{const u=new URL(a.href,origin);return u.origin===origin&&u.pathname==='/pages/s07/'&&u.searchParams.get('formalPreparation')==='1'&&u.searchParams.getAll('studyId').length===1&&u.searchParams.get('studyId')===studyId&&u.searchParams.getAll('protocolId').length===1&&u.searchParams.get('protocolId')===protocolId&&!u.hash;}catch{return false;}});
}
async function settle(page){await page.evaluate(async()=>{const active=document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity);await Promise.race([Promise.allSettled(active.map(a=>a.finished)),new Promise(r=>setTimeout(r,2000))]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function withReadOnly(options,kind,run){
 const {page,context=page?.context(),manifest,ledger,code,actor,protection,outputDir,env=process.env,origin='http://127.0.0.1:19501'}=options;
 requireWindow(env);assert.equal(context,page.context());assert.equal(typeof protection,'function');assert(outputDir.startsWith('/'));const target=verifiedVisualTarget(manifest,ledger,code),journalHash=bodyHash(ledger.journal);
 const report={at:new Date().toISOString(),kind,code,passed:false,readOnlyChecksPassed:false,dialogs:[],measurements:[]};let gate;
 const persist=()=>save(outputDir+'/'+kind+'.json',report);
 const dialog=d=>{report.dialogs.push({type:d.type()});persist();void d.dismiss().catch(()=>{});};page.on('dialog',dialog);
 const capture=label=>captureActualPage(page,{outputDir,label:code+'-'+label,role:target.c.role,stage:kind,origin,env});
 try{
  const auth=await context.request.get(origin+'/api/auth/me');assert.equal(auth.status(),200);const me=await auth.json();assert.equal(me.accountId,target.c.actorId);assert.equal(me.authVersion,target.c.authVersion);assert.equal(actor.actorId,me.accountId);assert.equal(actor.authVersion,me.authVersion);
  await protection('before',{code,step:kind});gate=await installNativeImportGate(context,{manifest,code,actor,ledger,outputDir,origin,env});
  Object.assign(report,await run({page,context,origin,target,report,capture,outputDir}));await gate.settle();assert.equal(gate.report.requests.length,0,'READONLY_MUST_NOT_DISPATCH_IMPORT');assert.equal(gate.report.blocked.length,0,'READONLY_MUST_NOT_ATTEMPT_BUSINESS_WRITE');assert.deepEqual(report.dialogs,[],'PURE_GET_MUST_NOT_TRIGGER_DIALOG_OR_BEFOREUNLOAD');assert.equal(bodyHash(ledger.journal),journalHash,'VISUAL_MUST_NOT_CHANGE_CHECKPOINTS');
  await protection('after',{code,step:kind});report.readOnlyChecksPassed=true;report.passed=report.available!==false;
 }catch(error){report.error={name:error.name??'Error',code:error.code??null};await capture(kind+'-failure-active').catch(()=>{});await protection('failure-after',{code,step:kind}).catch(()=>{});
 }finally{if(gate)await gate.close();page.off('dialog',dialog);report.finishedAt=new Date().toISOString();persist();}
 assert.equal(report.readOnlyChecksPassed,true,'WF02_READONLY_HELPER_FAILED_READ_EVIDENCE');return report;
}
async function previewCurrent(page,origin,{c,source,protocolId}){
 await page.goto(origin+formalUrl('s11',c.studyId,protocolId));const picker=page.locator('.ep-template-picker');await picker.locator(':scope > summary').waitFor();if(!await picker.evaluate(e=>e.open))await picker.locator(':scope > summary').click();
 await picker.getByLabel('搜索已审核方案',{exact:true}).fill('');let cursor=null,index=-1,items=[];
 for(let i=0;i<12;i++){const read=page.waitForResponse(r=>{const u=new URL(r.url());return r.request().method()==='GET'&&u.pathname==='/api/research-studies/'+c.studyId+'/protocol-templates'&&(u.searchParams.get('cursor')??null)===cursor;});await button(picker,cursor?'查看更多方案':'搜索').click();const r=await read;assert.equal(r.status(),200);const value=await r.json();items.push(...value.items);index=items.findIndex(x=>x.sourceStudyId===source.studyId&&x.sourceProtocolId===source.protocolId);if(index>=0)break;cursor=value.nextCursor;assert(cursor,'FIXED_SOURCE_NOT_IN_REAL_CANDIDATES');}
 assert(index>=0);const read=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/research-studies/'+c.studyId+'/protocol-templates/'+source.studyId+'/'+source.protocolId);
 await button(picker.locator(':scope > ul > li').nth(index),'预览差异').click();const r=await read;assert.equal(r.status(),200);const value=await r.json();assert.equal(value.canImport,true,'V5_PORTABLE_PREVIEW_MUST_BE_AVAILABLE');assert.equal(value.sourceFingerprint,source.fingerprint);assert.equal(value.source.revision,source.revision);
 assert.deepEqual(value.forms.map(f=>f.id).sort(),[...source.formVersionIds].sort());assert.deepEqual(value.outcomes.map(o=>o.id).sort(),[...source.outcomeDefinitionIds].sort());
 const fixed=page.locator('.ep-template-review > details');await fixed.waitFor();if(!await fixed.evaluate(e=>e.open))await fixed.locator(':scope > summary').click();
 const nested=fixed.locator('details');assert(await nested.count()<=50,'BOUNDED_FIXED_PREVIEW_ONLY');for(let i=0;i<await nested.count();i++){const item=nested.nth(i);if(!await item.evaluate(e=>e.open))await item.locator(':scope > summary').click();}
 if(value.outcomes.length)assert((await fixed.locator(':scope > p').last().innerText()).includes(value.outcomes.at(-1).name),'REAL_LAST_FIXED_OUTCOME_MUST_RENDER');return{fixed,value};
}
async function measure(page,fixed){
 const tail=fixed.locator(':scope > p').last();await tail.scrollIntoViewIfNeeded();await settle(page);
 const tailState=await tail.evaluate(e=>{const r=e.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight},scrollContainers=[];for(let p=e.parentElement;p;p=p.parentElement){const c=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(c.overflowY)){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);if(p.scrollHeight>p.clientHeight+1)scrollContainers.push({tag:p.tagName,className:p.className,scrollTop:p.scrollTop,clientHeight:p.clientHeight,scrollHeight:p.scrollHeight});}}const hit=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)));return{rect:r.toJSON(),clip,scrollContainers,reachable:r.top>=clip.top-1&&r.bottom<=clip.bottom+1&&r.left>=-1&&r.right<=innerWidth+1,hitMatches:Boolean(hit&&(hit===e||e.contains(hit)))};});
 return page.evaluate(tail=>{const nodes=[...document.querySelectorAll('.execution-preparation .ep-label,.ep-template-picker summary,.ep-template-picker button,.ep-template-picker input:not([type=checkbox]):not([type=radio]),.execution-preparation form input:not([type=checkbox]):not([type=radio]),.execution-preparation form textarea,.execution-preparation form select,.execution-preparation form button')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
  const authored=e=>{let yes=false;const scan=rules=>{for(const r of rules){if(r.media&&r.conditionText&&!matchMedia(r.conditionText).matches)continue;if(r.cssRules)scan(r.cssRules);if(r.selectorText&&r.style?.lineHeight==='22px')try{if(e.matches(r.selectorText))yes=true;}catch{}}};for(const s of document.styleSheets)try{scan(s.cssRules);}catch{}return yes;};
  const main=document.querySelector('.execution-preparation');return{innerWidth,innerHeight,devicePixelRatio,visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},documentScrollWidth:document.documentElement.scrollWidth,mainScrollWidth:main.scrollWidth,mainClientWidth:main.clientWidth,tail,controls:nodes.map(e=>{const s=getComputedStyle(e);return{tag:e.tagName,label:e.getAttribute('aria-label'),fontSize:s.fontSize,lineHeight:s.lineHeight,appearance:s.appearance,authored22:e.tagName==='SELECT'?authored(e):null,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,rect:e.getBoundingClientRect().toJSON()};})};},tailState);
}
export async function runWF02VisualBoundary(options){
 return withReadOnly(options,'visual-boundary',async({page,context,origin,target,report,capture,outputDir})=>{
  const physical=options.physical===true,previous=page.viewportSize();if(physical)assert.equal(previous,null,'ROOT_NATIVE_200_REQUIRES_VIEWPORT_NULL');else assert(previous,'USE_A_NORMAL_VIEWPORT_FOR_FIVE_WIDTHS');
  try{
   let {fixed}=await previewCurrent(page,origin,target);const picker=page.locator('.ep-template-picker'),summary=picker.locator(':scope > summary'),search=picker.getByLabel('搜索已审核方案',{exact:true}),title=page.getByLabel('方案名称',{exact:true}),titleBefore=await title.inputValue();
   await summary.focus();await page.keyboard.press('Enter');assert.equal(await picker.evaluate(e=>e.open),false);await page.keyboard.press('Enter');assert.equal(await picker.evaluate(e=>e.open),true);
   await search.focus();await page.keyboard.press('Tab');assert(await button(picker,'搜索').evaluate(e=>e===document.activeElement),'TAB_SEARCH_ORDER_REQUIRED');await page.keyboard.press('Shift+Tab');assert(await search.evaluate(e=>e===document.activeElement));await page.keyboard.press('Escape');assert.equal(await title.inputValue(),titleBefore);
   await page.locator('.ep-summary h2').click();await page.reload();await page.locator('.ep-template-picker > summary').waitFor();assert.deepEqual(report.dialogs,[],'READONLY_GET_RELOAD_MUST_NOT_PROMPT');report.keyboard={enterDetails:true,tabSearch:true,shiftTab:true,escapePreservedInput:true,pureGetReloadNoBeforeunload:true};
   ({fixed}=await previewCurrent(page,origin,target));
   for(const [width,height]of physical?[[null,null]]:dimensions){if(!physical)await page.setViewportSize({width,height});await settle(page);const label=physical?'native200':'width-'+width,m=await measure(page,fixed);
    if(physical){const cdp=await context.newCDPSession(page);try{m.layout=await cdp.send('Page.getLayoutMetrics');const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false}),bytes=Buffer.from(shot.data,'base64');m.png={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),method:'raw CDP no clip'};writeFileSync(outputDir+'/'+label+'-raw.png',bytes,{mode:0o600});}finally{await cdp.detach();}}
    report.measurements.push({label,...m});save(outputDir+'/'+label+'-measurement.json',m);assertVisualMeasurement(m,{physical});await capture(label+'-fixed-tail');await page.screenshot({path:outputDir+'/'+label+'-tail-viewport.png',fullPage:false});
   }
   return{physical,available:true,nativeSelectExceptions:report.measurements.flatMap(m=>m.controls.filter(c=>c.tag==='SELECT'&&c.lineHeight==='normal').map(c=>({label:m.label,...c})))};
  }finally{if(!physical&&previous)await page.setViewportSize(previous);}
 });
}
export async function runWF02GovernanceReadback(options){
 return withReadOnly(options,'governance-entry',async({page,origin,target,capture})=>{
  assert.equal(new URL(page.url()).pathname,'/pages/g02/','ROOT_MUST_SUPPLY_ACTUAL_G02_PAGE');const originalUrl=page.url();await button(page,'刷新待办').click({trial:true});
  const anchors=await page.locator('a[href]').evaluateAll(nodes=>nodes.map((e,index)=>({index,href:e.getAttribute('href'),visible:e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'})));
  const matches=observedGovernanceTargets(anchors,{origin,studyId:target.c.studyId,protocolId:target.protocolId});await capture('g02-observed-entry');
  if(!matches.length)return{available:false,reason:'verified-draft-has-no-pending-governance-item-in-current-ui',originalUrl,guessedLinkUsed:false,extraSubmitOrApproval:false};
  await page.locator('a[href]').nth(matches[0].index).click();await page.waitForURL(u=>u.pathname==='/pages/s07/'&&u.searchParams.get('studyId')===target.c.studyId&&u.searchParams.get('protocolId')===target.protocolId);
  const details=page.locator('.ep-template-origin details').filter({hasText:target.source.protocolId}).first();await details.waitFor();if(!await details.evaluate(e=>e.open))await details.locator('summary').click();assert((await details.innerText()).includes(target.source.studyId));await capture('g02-actual-same-study-protocol');
  return{available:true,originalUrl,clickedHref:matches[0].href,detailUrl:page.url(),guessedLinkUsed:false};
 });
}
