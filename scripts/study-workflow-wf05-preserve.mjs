// Pure WF05 protection only. Importing performs no I/O; root injects the read-only
// capture library and science dependencies. No write path, workflow or UI state engine.
import assert from 'node:assert/strict';
import {bodyHash} from './study-workflow-wf01-qa.mjs';
import {normalizeWF04Cases,wf04ImmutableTables,wf04AppendTables} from './study-workflow-wf04-preserve.mjs';
export const wf05AllowedAuthActions=Object.freeze(['login','researchhub.session.logout']);
const auditTable='public.audit_log',tableNames=Object.freeze([...wf04ImmutableTables,...wf04AppendTables].sort());
const id=v=>assert(typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v),'OPAQUE_ID_REQUIRED');
const sha=v=>assert.match(v??'',/^[a-f0-9]{64}$/,'OPAQUE_SHA256_REQUIRED');
const md5=v=>assert.match(v??'',/^[a-f0-9]{32}$/,'FULL_DATABASE_ROW_MD5_REQUIRED');
const ordered=rows=>rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
const sessionId=/^rh-session-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function requireWF05Window(env=process.env){assert.equal(env.STUDY_WORKFLOW_WF05_QA_WINDOW,'explicit','ROOT_WF05_IO_WINDOW_REQUIRED');assert.equal(env.VISIT_WORKFLOW_QA_WINDOW,'explicit','SHARED_HELPER_WINDOW_REQUIRED');}
function actors(input){
 assert(Array.isArray(input)&&input.length>0&&input.length<=10,'EXPLICIT_REGISTERED_CURRENT_ACTORS_REQUIRED');const result=input.map(p=>{assert(p&&Object.keys(p).every(k=>['actorId','authVersion','loginTargetHash'].includes(k)),'OPAQUE_ACTOR_BINDING_ONLY');id(p.actorId);assert(Number.isSafeInteger(p.authVersion)&&p.authVersion>=0,'AUTH_VERSION_ZERO_IS_VALID');sha(p.loginTargetHash);return{actorId:p.actorId,authVersion:p.authVersion,loginTargetHash:p.loginTargetHash};});assert.equal(new Set(result.map(p=>p.actorId)).size,result.length,'DUPLICATE_REGISTERED_ACTOR');return result.sort((a,b)=>a.actorId<b.actorId?-1:1);
}
function opaqueRows(input){
 assert(Array.isArray(input));const rows=ordered(input.map(r=>{assert(typeof r.id==='string'&&r.id.length>0&&r.id.length<=512,'DATABASE_ROW_ID_REQUIRED');md5(r.hash);return{id:r.id,hash:r.hash};}));assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,'DUPLICATE_DATABASE_ROW_ID');return{count:rows.length,rowsHash:bodyHash(rows),rows};
}
function scienceSummary(raw){
 for(const [key,count]of Object.entries({nativeRuns:316,revisions:48,childSnapshots:39})){assert(Array.isArray(raw?.[key]));assert.equal(raw[key].length,count,'FROZEN_SCIENCE_COUNT_REQUIRED');}assert(Array.isArray(raw.nativeAudits));assert.equal(Object.keys(raw.scientificFiles??{}).length,36,'ALL_36_SCIENTIFIC_FILES_REQUIRED');assert(Number.isSafeInteger(raw.word?.sizeBytes)&&raw.word.sizeBytes>0);sha(raw.word.sha256);
 return{hash:bodyHash(JSON.parse(JSON.stringify(raw))),counts:{nativeRuns:316,nativeAudits:raw.nativeAudits.length,revisions:48,childSnapshots:39,scientificFiles:36},word:{sizeBytes:raw.word.sizeBytes,sha256:raw.word.sha256}};
}
export async function captureWF05Protection({h,cases,originalScience,readProtection,compareProtection,registeredActors,phase='before',clock,dependencies,env=process.env}={}){
 requireWF05Window(env);assert(['before','after'].includes(phase));const fixedCases=normalizeWF04Cases(cases),registered=actors(registeredActors);assert.equal(typeof h,'object');id(h.runtime?.ids?.tenant);assert(originalScience,'ORIGINAL_ACCEPTED_SCIENCE_REQUIRED');for(const fn of [readProtection,compareProtection,clock,dependencies?.captureWF04Protection])assert.equal(typeof fn,'function','EXPLICIT_ROOT_DEPENDENCY_REQUIRED');
 // Only named guard flags are copied. Never enumerate process.env or mutate it.
 const libraryEnv={STUDY_WORKFLOW_WF05_QA_WINDOW:env.STUDY_WORKFLOW_WF05_QA_WINDOW,STUDY_WORKFLOW_WF04_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:env.VISIT_WORKFLOW_QA_WINDOW};
 const raw=await dependencies.captureWF04Protection(h,{cases:fixedCases,phase:'after',readProtection,compareProtection,originalScience,env:libraryEnv});assert.equal(raw.task,'WF04');assert.equal(raw.phase,'after');assert.equal(raw.readOnly,true);assert.equal(raw.tenantId,h.runtime.ids.tenant);assert.deepEqual(raw.cases,fixedCases);
 // The old library also verifies this. The explicit raw comparison here ensures
 // the injected adapter cannot silently downgrade original science verification.
 await compareProtection(originalScience,raw.science);
 assert.deepEqual(Object.keys(raw.immutable).sort(),[...wf04ImmutableTables].sort());assert.deepEqual(Object.keys(raw.append).sort(),[...wf04AppendTables].sort());const tables={};for(const [table,rows]of Object.entries({...raw.immutable,...raw.append}))tables[table]=opaqueRows(rows);
 const audits=ordered(raw.append[auditTable].map(r=>({id:r.id,hash:r.hash,actorId:r.actorId??null,authAction:wf05AllowedAuthActions.includes(r.action)?r.action:null,actionHash:bodyHash(r.action??null),targetHash:bodyHash(r.target??null),unscoped:r.studyGroupId===null&&r.researchProjectId===null,nativeLogoutTarget:typeof r.target==='string'&&sessionId.test(r.target)})));
 const at=clock(),capturedAt=new Date(at instanceof Date?at.getTime():at).toISOString();
 return{schema:1,task:'WF05',phase,capturedAt,readOnly:true,tenantId:raw.tenantId,casesHash:bodyHash(fixedCases),registeredActors:registered,science:scienceSummary(raw.science),tables,audits};
}
function validateSnapshot(s){
 assert.equal(s?.schema,1);assert.equal(s.task,'WF05');assert.equal(s.readOnly,true);id(s.tenantId);sha(s.casesHash);assert.deepEqual(actors(s.registeredActors),s.registeredActors);assert.deepEqual(Object.keys(s.tables).sort(),tableNames);sha(s.science?.hash);assert.deepEqual({nativeRuns:s.science.counts.nativeRuns,revisions:s.science.counts.revisions,childSnapshots:s.science.counts.childSnapshots,scientificFiles:s.science.counts.scientificFiles},{nativeRuns:316,revisions:48,childSnapshots:39,scientificFiles:36});
 for(const t of Object.values(s.tables)){const normalized=opaqueRows(t.rows);assert.equal(t.count,normalized.count);assert.equal(t.rowsHash,normalized.rowsHash);}
 assert.deepEqual(opaqueRows(s.audits).rows,s.tables[auditTable].rows,'AUDIT_METADATA_MUST_COVER_EXACT_TABLE_IDS_HASHES');
}
export function compareWF05Protection(before,after){
 for(const s of [before,after])validateSnapshot(s);assert.equal(before.phase,'before','ORIGINAL_WF05_BEFORE_REQUIRED');assert.equal(after.phase,'after');for(const key of ['tenantId','casesHash'])assert.equal(after[key],before[key]);assert.deepEqual(after.registeredActors,before.registeredActors,'REGISTERED_CURRENT_ACTOR_TUPLES_MUST_NOT_CHANGE');assert.deepEqual(after.science,before.science,'ORIGINAL_SCIENCE_WORD_CHANGED');const counts={},beforeAuditIds=new Set(before.tables[auditTable].rows.map(r=>r.id));
 for(const table of tableNames){const old=before.tables[table],current=after.tables[table],rows=new Map(current.rows.map(r=>[r.id,r]));if(table!==auditTable)assert.equal(current.count,old.count,'NO_BUSINESS_ROW_COUNT_CHANGE:'+table);for(const r of old.rows){assert(rows.has(r.id),'ORIGINAL_DATABASE_ID_MISSING:'+table);assert.equal(rows.get(r.id).hash,r.hash,'ORIGINAL_FULL_ROW_CHANGED:'+table);}if(table!==auditTable)assert.equal(current.rowsHash,old.rowsHash,'NO_BUSINESS_ROW_SET_CHANGE:'+table);counts[table]=old.count;}
 const registry=new Map(before.registeredActors.map(p=>[p.actorId,p])),added=after.audits.filter(r=>!beforeAuditIds.has(r.id));for(const a of added){assert(wf05AllowedAuthActions.includes(a.authAction),'NEW_NON_ALLOWLIST_AUDIT_FORBIDDEN');assert.equal(a.actionHash,bodyHash(a.authAction));const actor=registry.get(a.actorId);assert(actor,'NEW_AUDIT_MUST_BELONG_TO_REGISTERED_CURRENT_ACTOR');assert.equal(a.unscoped,true,'AUTH_AUDIT_MUST_NOT_HAVE_BUSINESS_SCOPE');if(a.authAction==='login')assert.equal(a.targetHash,actor.loginTargetHash,'LOGIN_TARGET_MUST_MATCH_REGISTERED_OWN_USERNAME_HASH');else assert.equal(a.nativeLogoutTarget,true,'LOGOUT_TARGET_MUST_BE_NATIVE_SESSION_UUID');}
 return{passed:true,businessWrites:0,allOriginalRowsFullHashPreserved:true,scienceAndWordPreserved:true,knowledgeJobRows:before.tables['public.knowledge_chat_job'].count,authAuditAppendCount:added.length,authAudits:added.map(a=>({id:a.id,hash:a.hash,actorId:a.actorId,action:a.authAction,targetHash:a.targetHash})),protectedCounts:counts,protectedBeforeHash:bodyHash(before.tables),protectedAfterHash:bodyHash(after.tables),scienceHash:before.science.hash,globalAuditDeltaIsBusinessCount:false};
}
export function assertWF05ReadOnlyTraffic(requests,{registeredActors}={}){
 const registered=actors(registeredActors),registry=new Map(registered.map(p=>[p.actorId,p]));assert(Array.isArray(requests)&&requests.length>0,'REAL_REQUEST_METADATA_REQUIRED');let businessGets=0,authPosts=0,readRequests=0;const records=[];
 for(const r of requests){assert(r&&Object.keys(r).every(k=>['method','path','actorId','authVersion','status'].includes(k)),'OPAQUE_TRAFFIC_METADATA_ONLY');assert(typeof r.path==='string'&&r.path.startsWith('/')&&!r.path.startsWith('//'));assert(typeof r.method==='string');assert(Number.isInteger(r.status)&&r.status>=100&&r.status<=599);const url=new URL(r.path,'http://wf05.invalid'),path=url.pathname.replace(/^\/api(?=\/)/,'');
  if(['GET','HEAD','OPTIONS'].includes(r.method)){readRequests++;if(r.method==='GET'&&path.startsWith('/research-studies/'))businessGets++;}
  else{assert.equal(r.method,'POST','WF05_BUSINESS_MUTATION_FORBIDDEN');assert(['/auth/login','/auth/logout','/auth/renew'].includes(path)&&!url.search,'WF05_BUSINESS_MUTATION_FORBIDDEN');const actor=registry.get(r.actorId);assert(actor&&actor.authVersion===r.authVersion,'AUTH_TRANSPORT_MUST_USE_REGISTERED_CURRENT_ACTOR');authPosts++;}
  records.push({method:r.method,pathHash:bodyHash(r.path),status:r.status,...(r.actorId?{actorId:r.actorId,authVersion:r.authVersion}:{})});
 }assert(businessGets>0,'AT_LEAST_ONE_REAL_BUSINESS_GET_REQUIRED');return{readOnlyBusinessTraffic:true,businessWrites:0,businessGets,readRequests,authPosts,requestCount:requests.length,requestsHash:bodyHash(records),responseSuccessClaimed:false,databaseProtectionStillRequired:true};
}
