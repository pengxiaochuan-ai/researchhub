// Root-owned synthetic acceptance context. No I/O before openWF02Context's window guard.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {requireWindow,json,save,bodyHash,assertOldHashes} from './study-workflow-wf02-qa.mjs';

export const wf02Private='/Users/mac/aisciencesys/.tmp/study-workflow-simplification-2026-11-17/wf02/';
export const wf02Evidence='/Users/mac/aisciencesys/researchhub/docs/testing/evidence/study-workflow-simplification-2026-11-17/wf02/';
export const manifestPath=wf02Private+'portable-primary-manifest-v2.json';
const extraTables=['study_protocol_version','visit_plan','visit_requirement','form_template','form_version','outcome_definition','study_execution_policy_version','subject','study_enrollment','subject_visit','form_assignment','form_response'];
const caseTables=['study_protocol_version','visit_plan','visit_requirement','form_template','form_version','outcome_definition','study_execution_policy_version','scale_version_applicability','audit_log'];
export function verifyWF02Freeze(){
 const freeze=json(wf02Evidence+'implementation-freeze-v5.json');
 for(const [file,expected]of Object.entries(freeze.files))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected,'WF02_SOURCE_CHANGED:'+file);
 return freeze;
}
export async function openWF02Context(){
 requireWindow();verifyWF02Freeze();
 const [{openHarness},{readProtection,compareProtection},{readOldHashes}]=await Promise.all([import('./full-study-runtime.mjs'),import('./visit-workflow-preserve.mjs'),import('./study-workflow-wf01-qa.mjs')]);
 const authDir=wf02Private+'root-auth-'+randomUUID().slice(0,8)+'/';
 const h=await openHarness({privateOutputDir:authDir});
 const identities=json('/Users/mac/aisciencesys/.tmp/visit-capture-review-flow-2026-11-16/identities.json').accounts;
 const initialAdminCookie=json(authDir+'admin-session.json').cookie;
 const accounts={admin:{id:h.actor.id,username:h.actor.username,password:h.runtime.password},reviewer:identities.reviewer,collector:identities.collector};
 const baseline=json(wf02Private+'all-old-rows-before.json'),original=json(wf02Private+'protected-original-before.json');
 let manifest=existsSync(manifestPath)?json(manifestPath):null,currentRole='admin';
 async function login(role){assert(accounts[role]);if(role!==currentRole){await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401]});await h.loginActor(accounts[role]);currentRole=role;}const me=await h.get('/auth/me');assert.equal(me.accountId,accounts[role].id);assert(Number.isSafeInteger(me.authVersion)&&me.authVersion>=0);return me;}
 async function caseSnapshot(code){
  assert(manifest);const c=manifest.cases[code];assert(c);return h.read(async tx=>{
   const rows={};for(const table of caseTables)rows[table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS hash FROM public."${table}" t WHERE "tenantId"=$1 AND "researchProjectId"=$2 ORDER BY id`,h.runtime.ids.tenant,c.executionProjectId);
   return rows;
  });
 }
 async function protect(phase,{code,step,requestKey,transientIds,expectedPersistentWrites}={}){
  const actual=await readProtection(h);compareProtection(original,actual);
  const current=await readOldHashes(h);
  Object.assign(current,await h.read(async tx=>{const out={};for(const table of extraTables)out[table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS hash FROM public."${table}" t WHERE "tenantId"=$1 ORDER BY id`,h.runtime.ids.tenant);return out;}));
  assertOldHashes(baseline,current);
  if(requestKey){
   const key=code+':'+requestKey,previous=pgBefore.get(key);
   if(phase==='before'){assert.equal(expectedPersistentWrites,0);pgBefore.set(key,await caseSnapshot(code));}
   else{
    assert(previous,'PG_BEFORE_REQUIRED');assert.deepEqual(await caseSnapshot(code),previous,'PG_PREDICTION_LEFT_PERSISTENT_TARGET_ROWS');
    const left=await h.read(async tx=>({operations:await tx.$queryRaw`SELECT id FROM rh_research.operation WHERE tenant_id=${h.runtime.ids.tenant} AND request_key=${requestKey}`,audits:await tx.auditLog.findMany({where:{tenantId:h.runtime.ids.tenant,meta:{path:['requestKey'],equals:requestKey}},select:{id:true}})}));
    assert.equal(left.operations.length,0);assert.equal(left.audits.length,0);
   }
  }
  return{at:new Date().toISOString(),phase,code:code??null,step:step??null,originalIdsPreserved:true,originalScience:{runs:actual.nativeRuns.length,revisions:actual.revisions.length,snapshots:actual.childSnapshots.length,files:Object.keys(actual.scientificFiles).length,word:actual.word},tables:Object.fromEntries(Object.entries(current).map(([k,v])=>[k,{count:v.length,hash:bodyHash(v)}])),...(requestKey?{requestKey,persistentPredictionRows:phase==='before'?null:0,transientCounts:Object.fromEntries(Object.entries(transientIds??{}).map(([k,v])=>[k,v.length]))}:{})};
 }
 const pgBefore=new Map();
 function nativeDependencies(){
  const require=createRequire('/Users/mac/aisciencesys/app/server/package.json');
  require('ts-node').register({project:'/Users/mac/aisciencesys/app/server/tsconfig.json',transpileOnly:true});
  return{StudyOperationsService:require('/Users/mac/aisciencesys/app/server/src/study-operations/study-operations.service.ts').StudyOperationsService,lockAuthorizationMutation:require('/Users/mac/aisciencesys/app/server/src/common/worker-publication.ts').lockAuthorizationMutation};
 }
 async function close(){
  // These cookies were created by this invocation; no other user's sessions are touched.
  await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401]}).catch(()=>{});
  await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401],h5Cookie:initialAdminCookie}).catch(()=>{});
 }
 return{h,accounts,login,protect,caseSnapshot,nativeDependencies,close,get manifest(){return manifest;},setManifest(value){manifest=value;}};
}
export function uniqueWF02Output(label){const path=wf02Evidence+'root/'+label+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,5)+'/';mkdirSync(path,{recursive:true,mode:0o700});return path;}
