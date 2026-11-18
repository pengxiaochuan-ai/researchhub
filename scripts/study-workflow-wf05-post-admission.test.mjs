import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyHash} from './study-workflow-wf01-qa.mjs';
import {wf04ImmutableTables,wf04AppendTables} from './study-workflow-wf04-preserve.mjs';
import {compareWF05Protection} from './study-workflow-wf05-preserve.mjs';
import {assertWF05PostAdmissionContinuity,allowWF05PostAdmissionRequest,runWF05PostAdmission} from './study-workflow-wf05-post-admission.mjs';
const env={STUDY_WORKFLOW_WF05_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'};
function table(input=[]){const rows=[...input].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);return{count:rows.length,rowsHash:bodyHash(rows),rows};}
function snapshot(){
 const tables=Object.fromEntries([...wf04ImmutableTables,...wf04AppendTables].map(t=>[t,table()]));
 tables['public.account']=table([{id:'original-account',hash:'1'.repeat(32)}]);
 tables['public.knowledge_chat_job']=table(Array.from({length:591},(_,i)=>({id:'old-job-'+String(i).padStart(4,'0'),hash:'4'.repeat(32)})));
 const audit={id:'original-audit',hash:'2'.repeat(32),actorId:'admin',authAction:null,actionHash:bodyHash('old.business'),targetHash:bodyHash('old'),unscoped:false,nativeLogoutTarget:false};tables['public.audit_log']=table([{id:audit.id,hash:audit.hash}]);
 return{schema:1,task:'WF05',phase:'before',readOnly:true,tenantId:'tenant',casesHash:'a'.repeat(64),registeredActors:[{actorId:'admin',authVersion:0,loginTargetHash:'b'.repeat(64)}],science:{hash:'c'.repeat(64),counts:{nativeRuns:316,nativeAudits:0,revisions:48,childSnapshots:39,scientificFiles:36},word:{sizeBytes:1,sha256:'d'.repeat(64)}},tables,audits:[audit]};
}
function appendAudit(s,id='new-f01-audit'){const a={...s.audits[0],id,hash:'3'.repeat(32),actionHash:bodyHash('hub.admission.legacy_confirmed')};s.audits.push(a);s.tables['public.audit_log']=table(s.audits.map(({id,hash})=>({id,hash})));}
test('both windows and exact CLI reject before dependency or fixture I/O',async()=>{
 await assert.rejects(runWF05PostAdmission({env:{},args:['--local-synthetic']}),/ROOT_WF05_IO_WINDOW_REQUIRED/);
 await assert.rejects(runWF05PostAdmission({env:{STUDY_WORKFLOW_WF05_QA_WINDOW:'explicit'},args:['--local-synthetic']}),/SHARED_HELPER_WINDOW_REQUIRED/);
 await assert.rejects(runWF05PostAdmission({env,args:['--wrong']}),/EXPLICIT_POST_ADMISSION_COMMAND_REQUIRED/);
});
test('cross-period audit additions are counted without declaring the old window zero increment',()=>{
 const old=snapshot(),current=structuredClone(old);for(let i=0;i<20;i++)appendAudit(current,'f01-'+i);const result=assertWF05PostAdmissionContinuity(old,current);
 assert.equal(result.externalAuditAppendCount,20);assert.equal(result.originalWindowGlobalZeroIncrement,false);assert.equal(current.audits.length,21);assert.equal(old.audits.length,1);assert.equal(current.tables['public.knowledge_chat_job'].count,591);
});
test('every old ID/hash, business count, science and actor tuple remain protected across periods',()=>{
 for(const change of [s=>s.tables['public.account'].rows[0].hash='9'.repeat(32),s=>s.tables['public.account'].rows.push({id:'new-account',hash:'9'.repeat(32)}),s=>s.tables['public.knowledge_chat_job'].rows[590].hash='9'.repeat(32),s=>s.tables['public.knowledge_chat_job'].rows=s.tables['public.knowledge_chat_job'].rows.slice(0,155),s=>s.audits.shift(),s=>s.audits[0].hash='9'.repeat(32),s=>s.science.hash='9'.repeat(64),s=>s.registeredActors[0].authVersion=1]){
  const old=snapshot(),current=structuredClone(old);change(current);
  for(const [name,t]of Object.entries(current.tables))current.tables[name]=table(t.rows);
  current.tables['public.audit_log']=table(current.audits.map(({id,hash})=>({id,hash})));
  assert.throws(()=>assertWF05PostAdmissionContinuity(old,current));
 }
});
test('the fresh read window retains the original strict audit allowlist',()=>{
 const before=snapshot(),after=structuredClone(before);appendAudit(after);after.phase='after';assert.throws(()=>compareWF05Protection(before,after),/NEW_NON_ALLOWLIST_AUDIT_FORBIDDEN/);
});
test('transport allows only same-origin reads and exact native auth POSTs',()=>{
 for(const path of ['/api/research-studies/study/due-visits?limit=5','/pages/s01/','/src/x.js'])assert(allowWF05PostAdmissionRequest('GET','http://127.0.0.1:19501'+path));
 for(const path of ['login','logout','renew'])assert(allowWF05PostAdmissionRequest('POST','http://127.0.0.1:19501/api/auth/'+path));
 for(const [method,url]of [['POST','http://127.0.0.1:19501/api/research-studies/study/enroll'],['POST','http://127.0.0.1:19501/api/auth/login?x=1'],['PUT','http://127.0.0.1:19501/api/auth/renew'],['GET','https://external.test/'],['POST','http://127.0.0.1:19501/not-api']])assert.equal(allowWF05PostAdmissionRequest(method,url),false);
});
