// Synthetic objects only; no target, accounts, PG, Chrome or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {bodyHash} from './study-workflow-wf01-qa.mjs';
import {wf04ImmutableTables,wf04AppendTables} from './study-workflow-wf04-preserve.mjs';
import {requireWF07Window,projectWF07AuthorizedAdditions,wf07SupplementTables,compareWF07Supplement} from './study-workflow-wf07-qa.mjs';
const hash='a'.repeat(32),changed='b'.repeat(32),audit='public.audit_log';
const pack=rows=>{rows=structuredClone(rows).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);return{rows,count:rows.length,rowsHash:bodyHash(rows)};};
const entry=id=>({id,hash});
function fixture(){
 const tables=Object.fromEntries([...wf04ImmutableTables,...wf04AppendTables].map((t,i)=>[t,pack([entry('old-'+i)])]));
 tables['public.knowledge_chat_job']=pack(Array.from({length:591},(_,i)=>entry('job-'+i)));
 const audits=tables[audit].rows.map(r=>({...r,actorId:'admin',authAction:null,actionHash:bodyHash('old-business'),targetHash:bodyHash('old-target'),unscoped:false,nativeLogoutTarget:false}));
 const before={schema:1,task:'WF05',phase:'before',readOnly:true,tenantId:'synthetic',casesHash:bodyHash('cases'),registeredActors:[{actorId:'admin',authVersion:5,loginTargetHash:bodyHash('admin')},{actorId:'reviewer',authVersion:0,loginTargetHash:bodyHash('reviewer')}],tables,audits,science:{hash:bodyHash('original-science'),counts:{nativeRuns:316,nativeAudits:500,revisions:48,childSnapshots:39,scientificFiles:36},word:{sizeBytes:22581,sha256:'a'.repeat(64)}}};
 const after=structuredClone(before);after.phase='after';return{before,after};
}
function additions(){
 const f=fixture(),ids={'rh_analysis.snapshot':['new-snapshot'],'public.research_method_run':['new-run'],'rh_research.operation':['new-operation'],[audit]:['new-business-audit']};
 for(const[t,values]of Object.entries(ids))f.after.tables[t]=pack([...f.after.tables[t].rows,...values.map(entry)]);
 f.after.audits.push({...entry(ids[audit][0]),actorId:'admin',authAction:null,actionHash:bodyHash('research_method_run_create'),targetHash:bodyHash('new-run'),unscoped:false,nativeLogoutTarget:false});
 return{...f,ids};
}
function append(f,t,id){f.after.tables[t]=pack([...f.after.tables[t].rows,entry(id)]);}
test('window parser requires both exact WF07 authorization and the sole local-synthetic flag',()=>{
 const env={STUDY_WORKFLOW_WF07_QA_WINDOW:'explicit'};
 assert.deepEqual(requireWF07Window(['--local-synthetic'],env),{task:'WF07',localSynthetic:true});
 for(const args of [[],['--help'],['--local-synthetic','--write'],['--local-synthetic','--local-synthetic']])assert.throws(()=>requireWF07Window(args,env));
 for(const denied of [{},{STUDY_WORKFLOW_WF07_QA_WINDOW:'true'},{STUDY_WORKFLOW_WF06_QA_WINDOW:'explicit'}])assert.throws(()=>requireWF07Window(['--local-synthetic'],denied));
});
test('exact authorized additions yield a deep-cloned legacy projection, never a whole-window zero-write claim',()=>{
 const {before,after,ids}=additions(),saved=structuredClone({before,after,ids}),result=projectWF07AuthorizedAdditions(before,after,ids);
 assert.equal(result.legacyProjectionProof.passed,true);assert.equal(result.legacyProjectionProof.knowledgeJobRows,591);assert.equal(result.nativeWriteCountClaimed,false);assert.equal(Object.hasOwn(result,'businessWrites'),false);
 assert.deepEqual(result.projected.tables,before.tables);assert.deepEqual(result.projected.science,after.science);assert.deepEqual({before,after,ids},saved);
 result.projected.science.hash='changed';assert.equal(after.science.hash,saved.after.science.hash);
});
test('zero additions still uses the real strict comparator and preserves authVersion zero',()=>{
 const {before,after}=fixture(),result=projectWF07AuthorizedAdditions(before,after,{});assert.equal(result.legacyProjectionProof.passed,true);assert.equal(result.projected.registeredActors[1].authVersion,0);
});
test('legacy auth audits remain present for native strict allowlist verification',()=>{
 const {before,after,ids}=additions(),r={...entry('new-login'),actorId:'reviewer',authAction:'login',actionHash:bodyHash('login'),targetHash:bodyHash('reviewer'),unscoped:true,nativeLogoutTarget:false};
 after.audits.push(r);after.tables[audit]=pack([...after.tables[audit].rows,entry(r.id)]);
 const result=projectWF07AuthorizedAdditions(before,after,ids);assert.equal(result.legacyProjectionProof.authAuditAppendCount,1);assert(result.projected.audits.some(x=>x.id===r.id));
});
for(const t of ['rh_analysis.snapshot','public.research_method_run','rh_research.operation',audit])test('cannot hide a changed original hash in '+t,()=>{
 const f=additions(),old=f.before.tables[t].rows[0].id;f.after.tables[t].rows.find(r=>r.id===old).hash=changed;f.after.tables[t]=pack(f.after.tables[t].rows);if(t===audit)f.after.audits.find(r=>r.id===old).hash=changed;
 assert.throws(()=>projectWF07AuthorizedAdditions(f.before,f.after,f.ids));
 f.ids[t].push(old);assert.throws(()=>projectWF07AuthorizedAdditions(f.before,f.after,f.ids));
});
test('unlisted added rows and unlisted business audit remain forbidden',()=>{
 for(const t of ['rh_analysis.snapshot','public.research_method_run','rh_research.operation']){const f=additions();append(f,t,'unlisted');assert.throws(()=>projectWF07AuthorizedAdditions(f.before,f.after,f.ids));}
 const f=additions();delete f.ids[audit];assert.throws(()=>projectWF07AuthorizedAdditions(f.before,f.after,f.ids));
});
test('audit table and metadata must cover identical raw IDs and hashes before either is filtered',()=>{
 for(const mutate of [f=>{f.after.audits=f.after.audits.filter(r=>r.id!=='new-business-audit');},f=>{f.after.tables[audit]=pack(f.after.tables[audit].rows.filter(r=>r.id!=='new-business-audit'));},f=>{f.after.audits.find(r=>r.id==='new-business-audit').hash=changed;}]){const f=additions();mutate(f);assert.throws(()=>projectWF07AuthorizedAdditions(f.before,f.after,f.ids));}
});
test('all 591 original jobs and science/Word remain outside the allowed projection',()=>{
 for(const mutate of [f=>{f.after.tables['public.knowledge_chat_job'].rows[590].hash=changed;f.after.tables['public.knowledge_chat_job']=pack(f.after.tables['public.knowledge_chat_job'].rows);},f=>{f.after.tables['public.knowledge_chat_job']=pack(f.after.tables['public.knowledge_chat_job'].rows.slice(0,155));},f=>append(f,'public.knowledge_chat_job','new-job'),f=>{f.after.science.hash=bodyHash('changed-science');},f=>{f.after.science.word.sha256='b'.repeat(64);}]){const f=additions();mutate(f);assert.throws(()=>projectWF07AuthorizedAdditions(f.before,f.after,f.ids));}
});
test('only four fixed tables are allowed; IDs must be new, requested once and present exactly once',()=>{
 const bad=[f=>{f.ids['public.knowledge_chat_job']=['job-0'];},f=>{f.ids[audit].push(f.ids[audit][0]);},f=>{f.ids['rh_analysis.snapshot']=['missing'];},f=>{f.ids['rh_analysis.snapshot']=[f.before.tables['rh_analysis.snapshot'].rows[0].id];},f=>append(f,'rh_analysis.snapshot','new-snapshot'),f=>{f.after.audits.push(structuredClone(f.after.audits.at(-1)));},f=>{f.after.tables['rh_analysis.snapshot'].count++;},f=>{f.after.tables['rh_analysis.snapshot'].rowsHash='c'.repeat(64);}];
 for(const mutate of bad){const f=additions();mutate(f);assert.throws(()=>projectWF07AuthorizedAdditions(f.before,f.after,f.ids));}
});
const supplement=()=>Object.fromEntries(wf07SupplementTables.map(({table},i)=>[table,[entry('supp-old-'+i)]]));
test('seven fixed supplemental capture descriptors expose only explicit tenant-scoped SELECT SQL',()=>{
 assert.deepEqual(wf07SupplementTables.map(x=>x.table),['rh_analysis.plan','rh_analysis.plan_review','public.session','public.session_project','public.message','public.artifact','public.structured_interaction']);
 assert(Object.isFrozen(wf07SupplementTables));for(const d of wf07SupplementTables){assert(Object.isFrozen(d));assert.match(d.sql,/^SELECT id,md5\(row_to_json\(t\)::text\) AS hash FROM /);assert.match(d.sql,/WHERE (tenant_id|"tenantId")=\$1 ORDER BY id$/);assert.doesNotMatch(d.sql,/INSERT|UPDATE|DELETE/);}
});
test('supplement allows only exact new Session IDs while preserving every old full row',()=>{
 const before=supplement(),after=structuredClone(before);after['public.session'].push(entry('new-session'));
 assert.equal(compareWF07Supplement(before,after,{sessionIds:['new-session']}).passed,true);assert.throws(()=>compareWF07Supplement(before,after));
 for(const t of Object.keys(before)){const drift=structuredClone(after);drift[t][0].hash=changed;assert.throws(()=>compareWF07Supplement(before,drift,{sessionIds:['new-session']}));}
 for(const t of Object.keys(before).filter(t=>t!=='public.session')){const drift=structuredClone(after);drift[t].push(entry('unlisted'));assert.throws(()=>compareWF07Supplement(before,drift,{sessionIds:['new-session']}));}
});
test('supplement rejects duplicate, absent, preexisting Session IDs and incomplete table coverage',()=>{
 const before=supplement(),after=structuredClone(before);after['public.session'].push(entry('new-session'));
 for(const sessionIds of [['new-session','new-session'],['missing'],[before['public.session'][0].id]])assert.throws(()=>compareWF07Supplement(before,after,{sessionIds}));
 const dup=structuredClone(after);dup['public.session'].push(entry('new-session'));assert.throws(()=>compareWF07Supplement(before,dup,{sessionIds:['new-session']}));
 delete after['public.message'];assert.throws(()=>compareWF07Supplement(before,after,{sessionIds:['new-session']}));
});
test('import and denied window have zero application I/O, including the legacy helper dependency graph',()=>{
 const moduleUrl=new URL('./study-workflow-wf07-qa.mjs',import.meta.url).href;
 const code=`import fs from 'node:fs';import fsp from 'node:fs/promises';import net from 'node:net';import tls from 'node:tls';import http from 'node:http';import https from 'node:https';import cp from 'node:child_process';import{syncBuiltinESMExports}from'node:module';let calls=0;const denied=()=>{calls++;throw Error('FORBIDDEN_IO');};for(const [o,names]of [[fs,['readFileSync','writeFileSync','mkdirSync','renameSync','existsSync']],[fsp,['writeFile','mkdir','rename']],[net,['connect','createConnection']],[tls,['connect']],[http,['request','get']],[https,['request','get']],[cp,['spawn','spawnSync','exec','execSync','execFile','execFileSync']]])for(const name of names)o[name]=denied;globalThis.fetch=denied;syncBuiltinESMExports();const m=await import(${JSON.stringify(moduleUrl)});let blocked=false;try{m.requireWF07Window([],{});}catch{blocked=true;}process.stdout.write(JSON.stringify({calls,blocked}));`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{calls:0,blocked:true});
});

const driver=await import('./study-workflow-wf07-qa.mjs');
const runArgs=(name='ordinary-normal')=>['--local-synthetic','--case',name,'--freeze','/Users/mac/aisciencesys/researchhub/docs/testing/evidence/study-workflow-simplification-2026-11-17/wf07/final.json','--freeze-sha256','a'.repeat(64)];
test('root driver parses only the four budgeted cases and a caller-supplied real freeze binding',()=>{
 const env={STUDY_WORKFLOW_WF07_QA_WINDOW:'explicit'};
 for(const name of ['ordinary-normal','ordinary-loss-before-create-forward','full-normal','full-loss-after-first-process200'])assert.equal(driver.parseWF07CaseArgs(runArgs(name),env).caseName,name);
 for(const args of [[],runArgs('extra-case'),runArgs().slice(0,-2),[...runArgs(),'--skip-freeze'],runArgs().map(x=>x==='a'.repeat(64)?'not-a-hash':x)])assert.throws(()=>driver.parseWF07CaseArgs(args,env));
 assert.throws(()=>driver.parseWF07CaseArgs(runArgs(),{}));
});
test('runtime freeze verification reads no runtime, rejects wrong task/source hash and verifies every declared source',()=>{
 const files={'src/analysis-start-session.js':'one','pages/shared/AnalysisStartControl.jsx':'two'},hash=x=>driver.wf07SourceHash(Buffer.from(x)),freeze={task:'WF07',revision:'implementation-v2',files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)])),uiContract:{primary:'primary',dialog:'dialog',confirm:'confirm',recovery:'recovery',continuation:['continue'],result:'result',activeStoragePrefix:'rh-analysis-start:v1:'}};
 const repo='/Users/mac/aisciencesys/researchhub/',path=runArgs()[4],reads=[],store=new Map(Object.entries(files).map(([p,v])=>[repo+p,Buffer.from(v)]));
 function verify(value=freeze,digest=hash(JSON.stringify(value))){const bytes=Buffer.from(JSON.stringify(value));store.set(path,bytes);return driver.verifyWF07RunFreeze({freezePath:path,freezeHash:digest,readFile:p=>{reads.push(p);assert(store.has(p),'Unexpected runtime/private read');return store.get(p);}});}
 assert.equal(verify().task,'WF07');assert.deepEqual(new Set(reads),new Set([path,...Object.keys(files).map(p=>repo+p)]));
 assert.throws(()=>verify({...freeze,task:'WF06'}));assert.throws(()=>verify(freeze,'b'.repeat(64)));store.set(repo+'src/analysis-start-session.js',Buffer.from('drift'));assert.throws(()=>verify());
 assert.throws(()=>verify({...freeze,files:{'../.env':'a'.repeat(64)}}));
});
const request=(kind,body={})=>{const c=driver.wf07Cases['ordinary-normal'];return{method:'POST',url:'http://127.0.0.1:19501/api/research-studies/'+c.studyId+'/analysis/'+(kind==='release'?'plans/'+c.planId+'/snapshots':kind==='create'?'runs':'runs/new-group/process'),body:{requestKey:'original-request',...(kind==='release'?{previewHash:'a'.repeat(64),reason:'synthetic'}:kind==='create'?{snapshotId:'new-snapshot'}:{limit:3,expectedStateHash:'b'.repeat(64)}),...body}};};
test('native gate permits only the fixed scope/DTO and fails closed before unrelated business or old action dispatch',()=>{
 const j={requests:[],release:{snapshotId:'new-snapshot'},previewHash:'a'.repeat(64)};
 assert.equal(driver.authorizeWF07NativeRequest('ordinary-normal',j,request('release')).kind,'release');assert.equal(driver.authorizeWF07NativeRequest('ordinary-normal',j,request('create')).kind,'create');
 for(const r of [{...request('create'),method:'PATCH'},{...request('create'),url:'https://outside.invalid/run'},request('create',{review:true}),{...request('create'),url:request('create').url+'/old-run/reviews'},request('create',{snapshotId:'other'}),request('process')])assert.throws(()=>driver.authorizeWF07NativeRequest('ordinary-normal',j,r));
});
test('no already-forwarded mutation may replay; only the controlled ordinary before-forward abort permits same-key attempt two',()=>{
 const r=request('create'),entry={kind:'create',key:r.body.requestKey,bodyHash:bodyHash(r.body),forwarded:true},j={previewHash:'a'.repeat(64),release:{snapshotId:'new-snapshot'},requests:[entry]};
 assert.throws(()=>driver.authorizeWF07NativeRequest('ordinary-normal',j,r));assert.throws(()=>driver.authorizeWF07NativeRequest('ordinary-loss-before-create-forward',j,r));
 entry.forwarded=false;entry.fault='before-forward';assert.equal(driver.authorizeWF07NativeRequest('ordinary-loss-before-create-forward',j,r).kind,'create');
 assert.throws(()=>driver.authorizeWF07NativeRequest('ordinary-loss-before-create-forward',j,request('create',{requestKey:'new-request'})));assert.throws(()=>driver.authorizeWF07NativeRequest('ordinary-normal',j,r));
});
test('full process gate binds the returned group/CAS, rejects repeat keys and requires the fault-recovery GET-only interval',()=>{
 const c=driver.wf07Cases['full-normal'],r={method:'POST',url:'http://127.0.0.1:19501/api/research-studies/'+c.studyId+'/analysis/runs/new-group/process',body:{requestKey:'process-original',limit:3,expectedStateHash:'b'.repeat(64)}},j={requests:[],release:{snapshotId:'root'},group:{id:'new-group',stateHash:'b'.repeat(64),remaining:4,batching:{maxItems:3}}};
 assert.equal(driver.authorizeWF07NativeRequest('full-normal',j,r).kind,'process');assert.throws(()=>driver.authorizeWF07NativeRequest('full-normal',{...j,readOnly:true},r));assert.throws(()=>driver.authorizeWF07NativeRequest('full-normal',j,{...r,body:{...r.body,expectedStateHash:'c'.repeat(64)}}));
 assert.throws(()=>driver.authorizeWF07NativeRequest('full-normal',{...j,requests:[{kind:'process',key:r.body.requestKey,forwarded:true}]},r));
});
test('unauthorized root invocation rejects before even reading a freeze file',async()=>{
 await assert.rejects(driver.runWF07Case({args:[],env:{}}),/WF07/);
});
test('only explicit implementation-v4 campaign gets a separate immutable claim/output namespace',()=>{
 const env={STUDY_WORKFLOW_WF07_QA_WINDOW:'explicit',STUDY_WORKFLOW_WF07_QA_CAMPAIGN:'implementation-v4'};assert.equal(driver.parseWF07CaseArgs(runArgs(),env).campaign,'implementation-v4');assert.equal(driver.wf07CaseNamespace('ordinary-normal','implementation-v4'),'ordinary-normal-implementation-v4');assert.equal(driver.wf07CaseNamespace('ordinary-normal'),'ordinary-normal');
 for(const campaign of ['','implementation-v3','implementation-v5','../../old','v4'])assert.throws(()=>driver.parseWF07CaseArgs(runArgs(),{...env,STUDY_WORKFLOW_WF07_QA_CAMPAIGN:campaign}));assert.throws(()=>driver.wf07CaseNamespace('extra','implementation-v4'));
});
test('V4 campaign must match final freeze exactly, and V4 source cannot silently use original claims',()=>{
 const path=runArgs()[4],repo='/Users/mac/aisciencesys/researchhub/',files={'src/analysis-start-session.js':'core','pages/shared/AnalysisStartControl.jsx':'control'},make=revision=>({task:'WF07',revision,files:Object.fromEntries(Object.entries(files).map(([p,v])=>[p,driver.wf07SourceHash(v)])),uiContract:{primary:'primary',dialog:'dialog',confirm:'confirm',recovery:'recovery',result:'result',activeStoragePrefix:'prefix',continuation:['continue']}});
 const verify=(revision,campaign)=>{const f=make(revision),text=JSON.stringify(f);return driver.verifyWF07RunFreeze({freezePath:path,freezeHash:driver.wf07SourceHash(text),campaign,readFile:p=>p===path?Buffer.from(text):Buffer.from(files[p.slice(repo.length)])});};assert.equal(verify('implementation-v4','implementation-v4').revision,'implementation-v4');assert.throws(()=>verify('implementation-v3','implementation-v4'));assert.throws(()=>verify('implementation-v4'));assert.throws(()=>verify('implementation-v4','arbitrary'));
});
