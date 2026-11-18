// Local synthetic list integration. Only a new named draft is created, never an AI job.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:19501';
const r=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const ledgerFile=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',before=createHash('sha256').update(readFileSync(ledgerFile)).digest('hex');
const priorLedger=JSON.parse(readFileSync(ledgerFile));
assert.equal(process.argv[2],'--case');assert.equal(process.argv.length,4);const mode=process.argv[3];assert.ok(['list','evidence-view','evidence','evidence-json-mode','evidence-admin','evidence-decisions','refine-gates','refine','adoption','history','downstream'].includes(mode),'Only implemented cases are accepted.');const paidMode=['evidence','evidence-json-mode','evidence-admin','refine'].includes(mode);
const run=mode+'-'+randomUUID().slice(0,8),out=root+'docs/test/evidence/2026-10-23-researchhub-wp05-design/'+run+'/';mkdirSync(out,{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,contexts=[],checks=[],fixtures=[];
const headers={'X-Study-Group-Id':r.ids.group,'X-Research-Project-Id':r.ids.project};
async function login(actor){const c=await request.newContext({baseURL:base,extraHTTPHeaders:headers});contexts.push(c);assert.equal((await c.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:actor+'@example.org',password:r.password}})).status(),201);return c;}
try{
 if(mode==='downstream'){
  const {verifyDownstream}=await import('./research-design-downstream-api.mjs');checks.push(...await verifyDownstream({login,root,out,run}));
 }else if(mode==='history'){
  const {verifyHistory}=await import('./research-design-history-api.mjs');checks.push(...await verifyHistory({login,root,out,run}));
 }else if(mode==='adoption'){
  const {verifyAdoption}=await import('./research-design-adoption-api.mjs');checks.push(...await verifyAdoption({login,root,out,run}));
 }else if(mode==='refine'){
  const c=await login('owner'),{runRefinement}=await import('./research-design-refine-live.mjs'),result=await runRefinement(c,{root,r,out});checks.push(...result.checks);fixtures.push(result.fixture);
 }else if(mode==='refine-gates'){
  const c=await login('owner'),f=JSON.parse(readFileSync(root+'.tmp/researchhub-wp05/design-fixture.json')),path='/api/research-plan-drafts/'+f.planId+'/design',view=await(await c.get(path)).json();assert(!view.evidence.rows.some(row=>row.decision==='include'));const response=await c.post(path+'/jobs',{data:{baseVersionNo:view.version,requestKey:run+'-no-include',kind:'refine'}});assert.equal(response.status(),409);assert.equal((await response.json()).code,'DESIGN_INCLUDED_EVIDENCE_REQUIRED');assert.equal((await(await c.get(path)).json()).version,view.version);checks.push('refine-without-included-evidence-refused-without-version-or-model');
 }else if(paidMode){
  const actor=mode==='evidence-admin'?'admin':'owner',c=await login(actor),{runEvidence}=await import('./research-design-live.mjs');const result=await runEvidence(c,{root,r,out,actor,newEvidenceValidation:mode==='evidence-json-mode'});checks.push(...result.checks);fixtures.push(result.fixture);
 }else if(mode==='evidence-decisions'){
  const c=await login('owner'),f=JSON.parse(readFileSync(root+'.tmp/researchhub-wp05/design-fixture.json'));assert.equal(f.studyGroupId,r.ids.group);assert.equal(f.researchProjectId,r.ids.project);assert.match(f.key,/^wp05-design-[a-f0-9]{8}$/);
  const path='/api/research-plan-drafts/'+f.planId+'/design',get=async()=>{const res=await c.get(path);assert.equal(res.status(),200);return res.json();},p=await get(),row=p.evidence.rows[0];assert.equal(p.evidence.status,'current');
  const input={baseVersionNo:p.version,requestKey:run+'-decide',resultMessageId:p.evidence.resultMessageId,decisions:[{rowId:row.rowId,decision:'exclude',reason:''}]};
  assert.equal((await c.post(path+'/evidence-decisions',{data:input})).status(),400,'Disposition reasons must be validated by the real design route');assert.equal((await get()).version,p.version);checks.push('invalid-disposition-keeps-original-version');
  const valid={...input,decisions:[{rowId:row.rowId,decision:'include',reason:''}]},other={...valid,requestKey:run+'-compete',decisions:[{rowId:row.rowId,decision:'include',reason:'独立请求验证'}]};
  const race=await Promise.all([c.post(path+'/evidence-decisions',{data:valid}),c.post(path+'/evidence-decisions',{data:other})]);assert.deepEqual(race.map(x=>x.status()).sort(),[201,409]);const won=race.findIndex(x=>x.status()===201),saved=await race[won].json(),winning=won?other:valid;
  assert.equal(saved.version,p.version+1);assert.equal(saved.evidence.resultMessageId,p.evidence.resultMessageId);assert.equal(saved.evidenceDecisionRevision,p.evidenceDecisionRevision+1);assert.equal(saved.evidence.rows[0].decision,'include');checks.push('independent-CAS-race-has-one-atomic-version');
  const again=await c.post(path+'/evidence-decisions',{data:winning});assert.equal(again.status(),201);assert.equal((await again.json()).version,saved.version);assert.equal((await c.post(path+'/evidence-decisions',{data:{...winning,decisions:[{rowId:row.rowId,decision:'exclude',reason:'不同输入'}]}})).status(),409);checks.push('same-input-idempotent-and-changed-input-conflict');
  let current=saved;for(const [i,decision]of ['exclude','include'].entries()){const res=await c.post(path+'/evidence-decisions',{data:{baseVersionNo:current.version,requestKey:run+'-redispose-'+i,resultMessageId:p.evidence.resultMessageId,decisions:[{rowId:row.rowId,decision,reason:decision==='exclude'?'本次核对适用性后暂时排除':''}]}});assert.equal(res.status(),201,await res.text());current=await res.json();}
  assert.equal(current.evidenceDecisionRevision,p.evidenceDecisionRevision+3);assert.equal(current.evidence.rows[0].decision,'include');assert.equal(current.evidence.resultMessageId,p.evidence.resultMessageId);assert.deepEqual(current.evidence.rows.map(r=>r.sourceRefs),p.evidence.rows.map(r=>r.sourceRefs));checks.push('same-evidence-redisposition-increments-revision-without-new-job');
  const admin=await login('admin');assert.equal((await admin.post(path+'/evidence-decisions',{data:{...valid,baseVersionNo:current.version,requestKey:run+'-foreign'}})).status(),403);checks.push('administrator-cannot-dispose-another-account-evidence');
  writeFileSync(out+'current-design.json',JSON.stringify(current,null,2));fixtures.push({planId:f.planId,resultMessageId:p.evidence.resultMessageId});
 }else if(mode==='evidence-view'){
  const c=await login('owner'),items=(await(await c.get('/api/research-plan-drafts?limit=30')).json()).items,p=items.find(p=>p.stage==='protocol_draft'&&p.sourceStatus==='current');assert(p,'A current own protocol draft is required for the read-only route probe.');
  const response=await c.get('/api/research-plan-drafts/'+p.id+'/design');assert.equal(response.status(),200,'Design route must return a real authorized view, not 404 or demo.');const view=await response.json();assert.equal(view.sourceStatus,'current');assert.equal(view.version,p.version);checks.push('real-current-own-design-view');
  const oversized=await c.post('/api/research-plan-drafts/'+p.id+'/design/jobs',{headers:{'Content-Type':'application/json'},data:' '.repeat(32768)+JSON.stringify({baseVersionNo:p.version,requestKey:'oversize-'+randomUUID(),kind:'evidence'})});assert.equal(oversized.status(),400,'Raw request bytes, not reserialized JSON size, must use the design input error contract.');checks.push('raw-whitespace-over-32KiB-refused-before-model');
 }else{
 for(const actor of ['owner','admin']){
  const c=await login(actor),res=await c.get('/api/research-plan-drafts?limit=20');assert.equal(res.status(),200);const list=await res.json();assert(Array.isArray(list.items));
  const existing=list.items.find(p=>p.sourceStatus==='current');assert(existing,'No current own synthetic draft; do not invent a baseline.');
  assert.equal(typeof existing.displayTitle,'string','Missing real workbench summary');assert.equal(typeof existing.nextAction?.key,'string','Missing deterministic next action');
  const detail=await(await c.get('/api/research-plan-drafts/'+existing.id)).json();assert(detail.sessionId);
  const fresh=await c.post('/api/research-plan-drafts',{data:{sessionId:detail.sessionId,requestKey:'wp05-'+run+'-'+actor}});assert.equal(fresh.status(),201);const plan=await fresh.json();
  assert.equal(plan.stage,'awaiting_pico');assert.equal((await c.get('/api/research-plan-drafts?limit=31')).status(),400);
  const first=await(await c.get('/api/research-plan-drafts?limit=1')).json();assert.equal(first.items.length,1);assert(first.nextCursor);
  const next=await(await c.get('/api/research-plan-drafts?limit=1&before='+first.nextCursor)).json();assert.notEqual(next.items[0]?.id,first.items[0].id);
  assert.equal((await c.get('/api/research-plan-drafts?limit=20',{headers:{...headers,'X-Research-Project-Id':'foreign-study'}})).status(),403);
  fixtures.push({actor,planId:plan.id});checks.push(actor+'-owned-list-next-action-and-real-new-draft-pagination');
 }
 const owner=contexts[0],admin=contexts[1];
 assert.equal((await admin.get('/api/research-plan-drafts/'+fixtures[0].planId)).status(),403);
 assert.equal((await owner.get('/api/research-plan-drafts?limit=1&before='+fixtures[1].planId)).status(),403);checks.push('cross-account-detail-and-cursor-refused');
 for(const actor of ['viewer','uninvited']){const c=await login(actor);assert.equal((await c.get('/api/research-plan-drafts?limit=20')).status(),403);checks.push(actor+'-list-denied');}
 const registered=JSON.parse(readFileSync(root+'.tmp/researchhub-wp02/browser-account.json'));
 const newcomer=await request.newContext({baseURL:base,extraHTTPHeaders:headers});contexts.push(newcomer);
 assert.equal((await newcomer.post('/api/auth/login',{data:{tenantSlug:r.ids.tenant,username:registered.email,password:registered.newPassword}})).status(),201);
 assert.equal((await newcomer.get('/api/research-plan-drafts?limit=20')).status(),403);checks.push('newly-registered-account-current-study-list-denied');
 }
 const paidCalls=JSON.parse(readFileSync(ledgerFile)).records.length-priorLedger.records.length;
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,fixtures,paidCalls:paidMode?paidCalls:0,scope:{studyGroupId:r.ids.group,researchProjectId:r.ids.project}},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,message:e.message,paidCalls:JSON.parse(readFileSync(ledgerFile)).records.length-priorLedger.records.length},null,2));throw e;}
finally{const after=JSON.parse(readFileSync(ledgerFile));assert.deepEqual(after.records.slice(0,priorLedger.records.length),priorLedger.records,'Existing AI records changed');assert.equal(after.limitMicroCny,5000000);if(!paidMode)assert.equal(createHash('sha256').update(readFileSync(ledgerFile)).digest('hex'),before,'AI budget mutated by a free test');for(const c of contexts)await c.dispose();}
