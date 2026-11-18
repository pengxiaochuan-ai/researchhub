// Root-only, fresh read window after F01 admission. Importing performs no I/O.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {bodyHash,json,save} from './study-workflow-wf01-qa.mjs';
import {requireWF05Window,captureWF05Protection,compareWF05Protection,assertWF05ReadOnlyTraffic} from './study-workflow-wf05-preserve.mjs';
const origin='http://127.0.0.1:19501';
export function allowWF05PostAdmissionRequest(method,url){
 const u=new URL(url);return u.origin===origin&&(['GET','HEAD','OPTIONS'].includes(method)||method==='POST'&&/^\/api\/auth\/(login|logout|renew)$/.test(u.pathname)&&!u.search);
}
export function assertWF05PostAdmissionContinuity(old,current){
 const ids=new Set(old.tables['public.audit_log'].rows.map(r=>r.id)),added=current.audits.filter(r=>!ids.has(r.id)),check=structuredClone(current);check.phase='after';
 const table=check.tables['public.audit_log'];table.rows=table.rows.filter(r=>ids.has(r.id));table.count=table.rows.length;table.rowsHash=bodyHash(table.rows);check.audits=check.audits.filter(r=>ids.has(r.id));
 compareWF05Protection(old,check);
 return{allOldRowsFullHashPreserved:true,externalAuditAppendCount:added.length,externalAudits:added.map(({id,hash,actorId,actionHash})=>({id,hash,actorId,actionHash})),originalWindowGlobalZeroIncrement:added.length===0,newAdmissionSchemaCoveredByOldLibrary:false};
}
const sourcePaths=['server/research-studies/commands.mjs','server/hub-sources/visible-repository.mjs','server/admission/service.mjs','server/admission/schema.sql'];
function currentSourceHashes(){return Object.fromEntries(sourcePaths.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')]));}
async function admissionMetadata(root){
 return root.h.read(async tx=>{
  const [schema]=await tx.$queryRawUnsafe("SELECT to_regclass('rh_admission.application')::text AS application,to_regclass('rh_admission.event')::text AS event");assert.equal(schema.application,'rh_admission.application');assert.equal(schema.event,'rh_admission.event');
  const actors=root.registeredActors.map(a=>a.actorId),rows=await tx.$queryRawUnsafe('SELECT id,account_id AS "actorId",status,revision,md5(row_to_json(a)::text) AS hash FROM rh_admission.application a WHERE tenant_id=$1 AND hub_key=$2 AND account_id=ANY($3::text[]) ORDER BY account_id',root.h.runtime.ids.tenant,'lingshu-xinyu',actors);
  assert.equal(rows.length,actors.length);assert.deepEqual(rows.map(r=>r.actorId).sort(),actors.sort());for(const r of rows)assert.equal(r.status,'approved');
  const tables={};for(const table of ['application','event'])tables[table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS hash FROM rh_admission.${table} t WHERE tenant_id=$1 ORDER BY id`,root.h.runtime.ids.tenant);
  return{schema,actors:rows,tables,coverage:'separate-current-metadata-only; not historical WF05 coverage'};
 });
}
async function httpReads(root){
 const path='/research-studies/'+root.cases.A.studyId+'/due-visits',roles={},rejects=[];let adminCursor;
 for(const role of ['admin','reviewer']){
  const me=await root.login(role);assert.equal(me.authVersion,root.principals[role].authVersion);if(role==='reviewer')assert.equal(me.authVersion,0);
  const first=await root.h.get(path+'?limit=5');assert.equal(first.items.length,5);assert(first.nextCursor);assert.equal(first.timeZone,'Asia/Shanghai');if(role==='admin')adminCursor=first.nextCursor;
  const next=await root.h.get(path+'?'+new URLSearchParams({limit:'20',cursor:first.nextCursor})),all=await root.h.get(path+'?limit=100');assert.equal(next.items.length,17);assert.equal(next.nextCursor,null);assert.equal(all.items.length,22);assert.equal(all.nextCursor,null);assert.equal(next.day,first.day);assert.equal(all.day,first.day);
  assert.deepEqual([...first.items,...next.items],all.items);roles[role]={actorId:me.accountId,authVersion:me.authVersion,all};
 }
 assert.deepEqual(roles.admin.all,roles.reviewer.all);
 for(const [label,query,status,cookie]of [['wrong-actor-cursor','?'+new URLSearchParams({cursor:adminCursor}),400,undefined],['invalid-limit','?limit=0',400,undefined],['no-session','',401,'']]){const r=await root.h.request(path+query,{method:'GET',status,h5Cookie:cookie});assert(!r.value?.items);rejects.push({label,status,code:r.value?.code});}
 return{roles,rejects,positiveGetRequests:6,rejectedGetRequests:3,businessWrites:0};
}
async function browserRead(root,role,expected,out,chromium,privateProfile){
 const blocked=[],traffic=[],errors=[],dialogs=[],account=root.accounts[role],p=root.principals[role];let context;
 try{
  context=await chromium.launchPersistentContext(privateProfile,{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,viewport:{width:1440,height:1000},serviceWorkers:'block',recordVideo:{dir:out+'video-'+role,size:{width:1440,height:1000}}});
  await context.route('**/*',route=>{const r=route.request();if(allowWF05PostAdmissionRequest(r.method(),r.url()))return route.continue();blocked.push({method:r.method(),pathHash:bodyHash(r.url())});return route.abort('blockedbyclient');});
  context.on('response',res=>{const r=res.request(),u=new URL(r.url());if(u.origin===origin&&u.pathname.startsWith('/api/'))traffic.push({method:r.method(),path:u.pathname+u.search,status:res.status(),actorId:p.accountId,authVersion:p.authVersion});});
  const {loginBrowserContext}=await import('./visit-workflow-qa.mjs');await loginBrowserContext(context,{tenantSlug:root.h.runtime.ids.tenant,username:account.username,password:account.password,expectedActorId:p.accountId});
  const response=await context.request.get(origin+'/api/auth/me'),me=await response.json();assert.equal(response.status(),200);assert.equal(me.accountId,p.accountId);assert.equal(me.authVersion,p.authVersion);
  const page=context.pages()[0]??await context.newPage();page.on('pageerror',e=>errors.push(e.name));page.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss();});page.setDefaultTimeout(20000);
  await page.goto(origin+'/pages/s01/?'+new URLSearchParams({researchStudy:'1',studyId:root.cases.A.studyId}));const panel=page.locator('.study-due-visits'),links=panel.getByRole('link',{name:'进入本次访视',exact:true});
  await panel.getByText(expected.day+' · 北京时间',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('.study-due-visits')?.getAttribute('aria-busy')==='false');assert.equal(await links.count(),5);await panel.scrollIntoViewIfNeeded();await page.screenshot({path:out+role+'-first-five.png',fullPage:true});
  await panel.getByRole('button',{name:'查看更多待访视',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.study-due-visits')?.getAttribute('aria-busy')==='false');assert.equal(await links.count(),22);assert.equal(await panel.getByRole('button',{name:'查看更多待访视',exact:true}).count(),0);
  const {captureUrl}=await import('../src/formal-capture-session.js'),hrefs=await links.evaluateAll(nodes=>nodes.map(n=>n.href));assert.deepEqual(hrefs,expected.items.map(v=>origin+captureUrl('s09',root.cases.A.studyId,{visitId:v.visitId})));await links.last().scrollIntoViewIfNeeded();await page.screenshot({path:out+role+'-expanded-tail.png',fullPage:true});
  assert.equal(blocked.length,0);assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);return{role,actorId:p.accountId,authVersion:p.authVersion,initial:5,afterOneMore:22,canonicalHrefs:hrefs,startedCollection:false,traffic:assertWF05ReadOnlyTraffic(traffic,{registeredActors:root.registeredActors})};
 }finally{
  if(context)try{const r=await context.request.post(origin+'/api/auth/logout',{headers:{Origin:origin,'X-ResearchHub-Request':'session-v1'},data:{}});assert.equal(r.status(),200);}finally{await context.close();}
 }
}
export async function runWF05PostAdmission({env=process.env,args=process.argv.slice(2)}={}){
 requireWF05Window(env);assert.deepEqual(args,['--local-synthetic'],'EXPLICIT_POST_ADMISSION_COMMAND_REQUIRED');
 const {openWF05Context,verifyWF05Freeze,wf05Private,wf05Evidence}=await import('./study-workflow-wf05-root-context.mjs');verifyWF05Freeze();
 const out=wf05Evidence+'root/post-admission-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'/';let root,capture,before,failure,result,closed=false;
 try{
  root=await openWF05Context();const [{readProtection,compareProtection},{captureWF04Protection}]=await Promise.all([import('./visit-workflow-preserve.mjs'),import('./study-workflow-wf04-preserve.mjs')]);
  const originalScience=json(wf05Private.replace('/wf05/','/wf04/')+'protection-before-v2.json').science;
  capture=phase=>captureWF05Protection({h:root.h,cases:root.cases,originalScience,readProtection,compareProtection,registeredActors:root.registeredActors,phase,clock:()=>new Date(),dependencies:{captureWF04Protection},env});
  before=await capture('before');save(out+'before.json',before,{exclusive:true});const continuity=assertWF05PostAdmissionContinuity(json(wf05Private+'protection-before-v2-after-ai01-session.json'),before);
  const sources=currentSourceHashes(),admission=await admissionMetadata(root),http=await httpReads(root);save(out+'current-runtime.json',{runtimePid:root.h.runtime.pid,sources,admission,continuity},{exclusive:true});save(out+'native-http.json',http,{exclusive:true});
  const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright'),ui=[];
  for(const role of ['admin','reviewer'])ui.push(await browserRead(root,role,http.roles[role].all,out,chromium,wf05Private+'post-admission-chrome-'+role+'-'+randomUUID()));save(out+'browser.json',ui,{exclusive:true});
  assert.deepEqual(currentSourceHashes(),sources,'CURRENT_SHARED_SOURCE_CHANGED_DURING_READS');assert.deepEqual(await admissionMetadata(root),admission,'CURRENT_ADMISSION_METADATA_CHANGED_DURING_READS');verifyWF05Freeze();
  result={passed:true,businessWrites:0,roles:2,positiveGetRequests:6,rejectedGetRequests:3,externalAuditAppendCount:continuity.externalAuditAppendCount,originalWindowGlobalZeroIncrement:continuity.originalWindowGlobalZeroIncrement,oldBaselinesReplaced:false,sourceSelectionOrCollectionStarted:false};
 }catch(e){failure=e;}
 finally{
  if(root){try{await root.close();closed=true;}catch(e){failure??=e;}if(before&&capture)try{const after=await capture('after');save(out+'after.json',after,{exclusive:true});const protection=compareWF05Protection(before,after);save(out+'fresh-protection.json',protection,{exclusive:true});}catch(e){failure??=e;}}
 }
 save(out+'root-result.json',failure?{passed:false,errorName:failure.name,code:failure.code,oldBaselinesReplaced:false,authCleanupCompleted:closed}:{...result,authCleanupCompleted:closed},{exclusive:true});
 if(failure)throw Object.assign(Error('WF05_POST_ADMISSION_FAILED'),{name:'WF05PostAdmissionError',evidence:out});return{...result,evidence:out};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)runWF05PostAdmission().then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(e=>{process.stderr.write(JSON.stringify({passed:false,errorName:e.name,evidence:e.evidence})+'\n');process.exitCode=1;});
