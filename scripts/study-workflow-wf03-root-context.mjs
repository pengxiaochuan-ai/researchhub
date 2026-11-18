// Root-owned context. The explicit window guard precedes fixture, credentials, PG or HTTP.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {requireWF03Window,bodyHash} from './study-workflow-wf03-qa.mjs';
import {captureWF03Protection,compareWF03Protection} from './study-workflow-wf03-preserve.mjs';
import {json,save,assertOldHashes} from './study-workflow-wf01-qa.mjs';

export const wf03Private='/Users/mac/aisciencesys/.tmp/study-workflow-simplification-2026-11-17/wf03/';
export const wf03Evidence='/Users/mac/aisciencesys/researchhub/docs/testing/evidence/study-workflow-simplification-2026-11-17/wf03/';
const wf02Evidence=wf03Evidence.replace('/wf03/','/wf02/'),wf02Private=wf03Private.replace('/wf03/','/wf02/');
export function verifyWF03Freeze(file=wf03Evidence+'implementation-freeze-v2.json'){
 const freeze=json(file);for(const [p,expected]of Object.entries(freeze.files))assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),expected,'WF03_SOURCE_CHANGED:'+p);return freeze;
}
export async function openWF03Context({freezePath}={}){
 requireWF03Window();verifyWF03Freeze(freezePath);
 const [{openHarness},{readProtection,compareProtection},{readOldHashes},{assertExactProtocolCopy}]=await Promise.all([
  import('./full-study-runtime.mjs'),import('./visit-workflow-preserve.mjs'),import('./study-workflow-wf01-qa.mjs'),import('./study-workflow-wf02-pg.mjs')]);
 const authDir=wf03Private+'root-auth-'+randomUUID().slice(0,8)+'/';const h=await openHarness({privateOutputDir:authDir});
 const adminCookie=json(authDir+'admin-session.json').cookie,oldActors=json('/Users/mac/aisciencesys/.tmp/visit-capture-review-flow-2026-11-16/identities.json').accounts;
 const accounts={admin:{id:h.actor.id,username:h.actor.username,password:h.runtime.password},reviewer:oldActors.reviewer,collector:oldActors.collector};
 const accepted=json(wf02Evidence+'root/audit-2026-11-17T04-04-34-232Z-b5aa0/native-audit.json'),sourceManifest=json(wf02Evidence+'portable-primary-manifest-v2.json');
 const cases=Object.fromEntries(accepted.summaries.map(s=>[s.code,{...sourceManifest.cases[s.code],protocolId:s.protocolId}]));
 const ids=Object.fromEntries(Object.entries(cases).map(([code,c])=>[code,c.protocolId]));
 const science=json(wf02Private+'protected-original-before.json'),old=json(wf02Private+'all-old-rows-before.json');
 const extraTables=['study_protocol_version','visit_plan','visit_requirement','form_template','form_version','outcome_definition','study_execution_policy_version','subject','study_enrollment','subject_visit','form_assignment','form_response'];
 let baseline=existsSync(wf03Private+'protection-before.json')?json(wf03Private+'protection-before.json'):null,currentRole='admin';
 async function login(role){assert(accounts[role]);if(role!==currentRole){await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401]});await h.loginActor(accounts[role]);currentRole=role;}const me=await h.get('/auth/me');assert.equal(me.accountId,accounts[role].id);assert(Number.isSafeInteger(me.authVersion)&&me.authVersion>=0);return me;}
 async function verifyWF02Admission(snapshot){
  // Verify old accepted source/roles/science first, rather than adopting present drift as baseline.
  const oldRows=await readOldHashes(h);Object.assign(oldRows,await h.read(async tx=>{const rows={};for(const table of extraTables)rows[table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS hash FROM public."${table}" t WHERE "tenantId"=$1 ORDER BY id`,h.runtime.ids.tenant);return rows;}));assertOldHashes(old,oldRows);
  const source=sourceManifest.sources.portable,proofs=[];
  for(const expected of accepted.summaries){
   const c=cases[expected.code],rows=await h.read(async tx=>{
    const include={visitPlans:{include:{requirements:true},orderBy:{sequence:'asc'}}};
    const origin=await tx.$queryRaw`SELECT * FROM rh_research.operation WHERE tenant_id=${h.runtime.ids.tenant} AND id=${expected.receipt.id}`;
    const auditRows=await tx.auditLog.findMany({where:{tenantId:h.runtime.ids.tenant,id:{in:expected.audits.map(a=>a.id)}}});
    return{operation:origin[0],audits:auditRows,
     source:{protocol:await tx.studyProtocolVersion.findUnique({where:{id:source.protocolId},include}),forms:await tx.formVersion.findMany({where:{id:{in:source.formVersionIds}},include:{template:true}}),outcomes:await tx.outcomeDefinition.findMany({where:{id:{in:source.outcomeDefinitionIds}}})},
     target:{protocol:await tx.studyProtocolVersion.findUnique({where:{id:c.protocolId},include}),forms:await tx.formVersion.findMany({where:{tenantId:h.runtime.ids.tenant,researchProjectId:c.executionProjectId},include:{template:true}}),outcomes:await tx.outcomeDefinition.findMany({where:{tenantId:h.runtime.ids.tenant,researchProjectId:c.executionProjectId}})}};
   });
   const op=rows.operation;assert(op);assert.equal(op.action,'protocol.template.import');assert.equal(op.actor_id,expected.actorId);assert.equal(op.target_id,c.protocolId);assert.equal(op.request_key,expected.receipt.requestKey);assert.equal(op.request_hash,expected.receipt.requestHash);assert.deepEqual(op.result.receipt,expected.receipt);
   assert.equal(rows.audits.length,2);for(const a of expected.audits){const actual=rows.audits.find(x=>x.id===a.id);assert(actual);assert.equal(actual.accountId,a.actorId);assert.equal(actual.action,a.action);assert.equal(actual.target,c.protocolId);assert.equal(bodyHash(actual.meta),a.metaHash);}
   const imported=rows.audits.find(a=>a.id===op.audit_id);assert(imported);assert.equal(bodyHash(imported.meta),bodyHash({requestKey:op.request_key,requestHash:op.request_hash,authVersion:expected.authVersion,...op.result.origin}));
   assert.equal(op.result.origin.sourceStudyId,source.studyId);assert.equal(op.result.origin.sourceProtocolId,source.protocolId);assert.equal(op.result.origin.sourceFingerprint,source.fingerprint);assert.equal(op.result.origin.targetFingerprint,c.targetFingerprint);
   assert.deepEqual(op.result.origin.forms.concat(op.result.origin.outcomes),expected.origins);
   const copy=assertExactProtocolCopy(rows.source,rows.target,op.result.origin);assert.equal(copy.forms,4);assert.equal(copy.outcomes,1);assert.equal(copy.plans,2);assert.equal(copy.requirements,8);
   assert.equal(rows.target.protocol.status,'draft');for(const k of ['approvedBy','approvedPolicyVersionId','approvedPolicyHash','lockedAt','effectiveFrom','effectiveTo','supersededById'])assert.equal(rows.target.protocol[k],null);
   proofs.push({code:expected.code,protocolId:c.protocolId,copy,receiptId:op.id,metaHash:bodyHash(imported.meta)});
  }
  assert.equal(snapshot.targetProtocolIds.length,3);save(wf03Evidence+'admission-wf02-accepted-copies.json',{at:new Date().toISOString(),readOnly:true,acceptedFixedCopiesVerified:true,proofs});
 }
 async function captureBefore(){
  assert.equal(baseline,null,'ORIGINAL_WF03_BASELINE_ALREADY_EXISTS_NO_ROLLING_CAPTURE');
  const captured=await captureWF03Protection(h,ids,{phase:'before',readProtection,compareProtection,originalScience:science,verifyWF02Admission});
  save(wf03Private+'protection-before.json',captured,{exclusive:true});baseline=captured;
  save(wf03Evidence+'protection-before-summary.json',{at:captured.at,tenantId:captured.tenantId,readOnly:captured.readOnly,admissionVerified:captured.wf02AdmissionVerified,targetProtocolIds:captured.targetProtocolIds,immutableHash:bodyHash(captured.immutable),immutableCounts:Object.fromEntries(Object.entries(captured.immutable).map(([k,v])=>[k,v.length])),protocols:captured.protocols.length});return captured;
 }
 async function protect(label){assert(baseline,'ADMITTED_ORIGINAL_BASELINE_REQUIRED');const after=await captureWF03Protection(h,ids,{phase:'after',readProtection,compareProtection,originalScience:science});const result=await compareWF03Protection(baseline,after,{compareProtection});return{at:after.at,label,...result};}
 function nativeDependencies(){const require=createRequire('/Users/mac/aisciencesys/app/server/package.json');require('ts-node').register({project:'/Users/mac/aisciencesys/app/server/tsconfig.json',transpileOnly:true});require('reflect-metadata');return{StudyOperationsService:require('/Users/mac/aisciencesys/app/server/src/study-operations/study-operations.service.ts').StudyOperationsService,RemediationCasesService:require('/Users/mac/aisciencesys/app/server/src/remediation/remediation.service.ts').RemediationCasesService,lockAuthorizationMutation:require('/Users/mac/aisciencesys/app/server/src/common/worker-publication.ts').lockAuthorizationMutation};}
 async function close(){await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401]}).catch(()=>{});await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401],h5Cookie:adminCookie}).catch(()=>{});}
 return{h,accounts,cases,ids,login,captureBefore,protect,nativeDependencies,close,get baseline(){return baseline;}};
}
