// Root-only synthetic read acceptance. All private/fixture/network work follows explicit guards.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {json,save,bodyHash} from './study-workflow-wf01-qa.mjs';
import {requireWF05Window,captureWF05Protection,compareWF05Protection} from './study-workflow-wf05-preserve.mjs';
export const wf05Private='/Users/mac/aisciencesys/.tmp/study-workflow-simplification-2026-11-17/wf05/';
export const wf05Evidence='/Users/mac/aisciencesys/researchhub/docs/testing/evidence/study-workflow-simplification-2026-11-17/wf05/';
const repo='/Users/mac/aisciencesys/researchhub/';
const previous=wf05Evidence.replace('/wf05/','/wf04/');
export function verifyWF05Freeze(file=wf05Evidence+'implementation-freeze-v3.json'){
 assert.equal(createHash('sha256').update(readFileSync(repo+'scripts/study-workflow-wf05-preserve.mjs')).digest('hex'),'f769df70671aa166c1c9b615dac67ac705c1e13d8ed48e6750845fb82dc69cb0','WF05_FINAL_QA_COUNT_FIX_REQUIRED');
 const input=json(file),freeze={...input,files:Object.fromEntries(Object.entries(input.files).map(([path,digest])=>[path.startsWith('/')?path:repo+path,digest]))};for(const [path,digest]of Object.entries(freeze.files))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),digest,'WF05_FROZEN_SOURCE_CHANGED:'+path);
 const accepted=json(previous+'final-manifest.json');assert.equal(accepted.status,'complete-local-synthetic');
 const acceptedFiles=Object.fromEntries(Object.entries(accepted.files).map(([path,digest])=>[path.startsWith('/')?path:repo+path,digest]));
 const controller='/Users/mac/aisciencesys/researchhub/server/research-studies/controller.mjs';
 const before=json(wf05Evidence+'before-sources.json').files['server/research-studies/controller.mjs'];assert.equal(before.sha256,acceptedFiles[controller],'WF05_CONTROLLER_BEFORE_MUST_MATCH_ACCEPTED_WF04');assert.equal(createHash('sha256').update(readFileSync(repo+before.snapshot)).digest('hex'),before.sha256);
 for(const [path,digest]of Object.entries(acceptedFiles))if(path!==controller)assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),digest,'WF04_NONOWNED_ACCEPTED_SOURCE_CHANGED:'+path);
 assert.equal(createHash('sha256').update(readFileSync(accepted.finalAudit)).digest('hex'),accepted.finalAuditHash);assert.equal(createHash('sha256').update(readFileSync(accepted.protection)).digest('hex'),accepted.protectionHash);
 // This feature is allowed to append the reviewed GET registration; never rewrite prior manifests.
 assert(Object.hasOwn(freeze.files,controller),'OWNED_CONTROLLER_MUST_BE_IN_WF05_FREEZE');return freeze;
}
export async function openWF05Context({freezePath}={}){
 requireWF05Window();assert([undefined,'after-ai01-session'].includes(process.env.WF05_READ_PHASE),'UNKNOWN_READ_ACCEPTANCE_PHASE');const readPhase=process.env.WF05_READ_PHASE??'original';verifyWF05Freeze(freezePath);const {openHarness}=await import('./full-study-runtime.mjs'),authDir=wf05Private+'root-auth-'+randomUUID().slice(0,8)+'/',h=await openHarness({privateOutputDir:authDir}),initialCookie=json(authDir+'admin-session.json').cookie;
 const accounts04=json('/Users/mac/aisciencesys/.tmp/visit-capture-review-flow-2026-11-16/identities.json').accounts,admitted=json(previous+'admitted-resources.json'),manifest=json(previous+'execution-manifest-v2.json');
 const accounts={admin:{id:h.actor.id,username:h.actor.username,password:h.runtime.password},reviewer:accounts04.reviewer};
 const principals=Object.fromEntries(Object.entries(admitted.currentPrincipals).map(([role,v])=>[role,{tenantId:h.runtime.ids.tenant,accountId:v.accountId,authVersion:v.authVersion}]));
 const cases=manifest.cases,subjects=json(previous+'final-ui-ledger.json').subjectsByCase;assert.equal(Object.keys(subjects).length,3);
 const registeredActors=Object.entries(accounts).map(([role,a])=>({actorId:a.id,authVersion:principals[role].authVersion,loginTargetHash:bodyHash(a.username)}));
 const [{readProtection,compareProtection},{captureWF04Protection}]=await Promise.all([import('./visit-workflow-preserve.mjs'),import('./study-workflow-wf04-preserve.mjs')]);
 const originalScience=json('/Users/mac/aisciencesys/.tmp/study-workflow-simplification-2026-11-17/wf04/protection-before-v2.json').science,baselinePath=wf05Private+(readPhase==='original'?'protection-before.json':'protection-before-v2-after-ai01-session.json');let baseline=existsSync(baselinePath)?json(baselinePath):null,currentRole='admin';
 const capture=phase=>captureWF05Protection({h,cases,originalScience,readProtection,compareProtection,registeredActors,phase,clock:()=>new Date(),dependencies:{captureWF04Protection},env:process.env});
 async function login(role){assert(accounts[role]);if(currentRole!==role){await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401]});await h.loginActor(accounts[role]);currentRole=role;}const me=await h.get('/auth/me');assert.equal(me.accountId,principals[role].accountId);assert.equal(me.authVersion,principals[role].authVersion);return me;}
 async function captureBefore(validateBeforeSave){assert(!baseline,'WF05_ORIGINAL_BEFORE_ALREADY_EXISTS');if(readPhase!=='original')assert.equal(typeof validateBeforeSave,'function','EXPLICIT_EXTERNAL_PHASE_TRANSITION_REQUIRED');const candidate=await capture('before');if(validateBeforeSave)await validateBeforeSave(candidate);save(baselinePath,candidate,{exclusive:true});baseline=candidate;return baseline;}
 async function protect(label){assert(baseline,'WF05_ORIGINAL_BASELINE_REQUIRED');const after=await capture('after'),result=await compareWF05Protection(baseline,after);return{at:new Date().toISOString(),label,...result};}
 function nativeDependencies(){const require=createRequire('/Users/mac/aisciencesys/app/server/package.json');require('ts-node').register({project:'/Users/mac/aisciencesys/app/server/tsconfig.json',transpileOnly:true});require('reflect-metadata');const load=path=>require('/Users/mac/aisciencesys/app/server/src/'+path+'.ts');return{lockAuthorization:load('common/worker-publication').lockAuthorizationMutation,authorize:load('study-operations/formal-response-authority').authorizeFormalResponse};}
 async function close(){await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401]}).catch(()=>{});await h.request('/auth/logout',{method:'POST',body:{},status:[200,201,401],h5Cookie:initialCookie}).catch(()=>{});}
 return{h,accounts,principals,cases,subjects,registeredActors,readPhase,baselinePath,login,captureBefore,protect,nativeDependencies,close,get baseline(){return baseline;}};
}
