import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';import {createNativeResearchDataPreflight} from '../../scripts/ai-research-data-preflight.mjs';
import {createResearchDataStaging} from './research-data-staging.mjs';import {createResearchDataImports,assertSourcePreflightCancellableInTx} from './research-data-imports.mjs';
import {createResearchDataImportNative} from '../../scripts/ai-research-data-import-native.mjs';import {createResearchDataImportAccess} from './research-data-import-access.mjs';
import {createResearchStudiesService} from '../research-studies/commands.mjs';import {compileDataMapping} from './research-data-import-mapping.mjs';
const root='/Users/mac/aisciencesys/',{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),cfg=JSON.parse(readFileSync(new URL('../../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url),'utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k],rollback=Symbol('rollback');
test('new rule version survives real app PG staging, native target mapping and private plan recovery; all new rows roll back',async()=>{
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  for(const actor of ['owner','admin']){
   const user={tenantId:ids.tenant,accountId:ids[actor],authVersion:5,studyGroupId:ids.group,researchProjectId:ids.project,role:actor==='owner'?'researcher':'tenant_admin',isTenantAdmin:actor==='admin'},sid=cfg.sessions[user.accountId];
   const sourceAccess=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>fn(tx)}),engine=createNativeResearchDataPreflight({load,require}),objects=new Map(),storage={put:async(k,b)=>objects.set(k,Buffer.from(b)),getBuffer:async k=>objects.get(k)};
   const staging=createResearchDataStaging({access:sourceAccess,engine,storage,assertCancellation:assertSourcePreflightCancellableInTx});
   const bytes=Buffer.from('受试者编码,备注\nP05-'+actor.toUpperCase()+'-A,GENERAL-SYNTHETIC\n');
   const upload=await staging.upload(user,sid,{requestKey:'general-upload-'+randomUUID(),filename:'general-synthetic.csv',buffer:bytes}),p=await staging.preview(user,sid,{requestKey:'general-preview-'+randomUUID(),files:[{id:upload.id,version:upload.version}]});
   assert.equal(p.result.rulesVersion,'general-tabular.v1');assert.equal(p.result.files[0].rejectedRows,0);assert.equal(p.result.files[0].fields[0].profile.type,'text');
   const authority=createResearchDataImportAccess({authorizeRead:load('study-operations/formal-response-authority','authorizeFormalResponse'),additionalObjects:()=>cfg.registeredObjects[user.accountId]}),native=createResearchDataImportNative({load,authority});
   const prisma={forTenant:()=>tx,elevated:tx,withTenantTransaction:(_t,_g,_p,fn)=>fn(tx)},studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('NOT_ALLOWED');}});
   const service=createResearchDataImports({studies,sourceAccess,authority,native,engine,storage,scopeKey:cfg.scopeKey,allowedStudyIds:[cfg.target.studyId]});
   const plan=await service.prepare(user,sid,{requestKey:'general-plan-'+randomUUID(),studyId:cfg.target.studyId,preflightId:p.id,preflightVersion:p.version});
   assert.equal(plan.state,'planned');assert.equal(plan.mode,'subjects');assert.equal(plan.summary.subjects,1);assert.deepEqual(plan.summary.unmapped,['备注']);assert.deepEqual(await service.get(user,sid,plan.id),plan);
   // Use the actual current native schema and validator, not an invented Form.
   const info=await native.targetInTx(tx,user,cfg.target),buffer=Buffer.from('受试者编码,访视编码,观察值,已完成\nP05-'+actor.toUpperCase()+'-A,BASELINE,0,否\n');
   const preview=engine.preview({...user,sessionId:sid},{files:[{fileId:'general-scalar',filename:'general.csv',buffer}],destinations:[],rulesVersion:'general-tabular.v1'}),mapped=compileDataMapping(preview,info.fields,undefined,{studyId:cfg.target.studyId});
   assert.deepEqual(mapped.rows[0].answers,{value:0,completed:false});
   const normalized=load('study-operations/study-forms-policy','normalizeAndValidateAnswers')(info.form.schema,mapped.rows[0].answers,{requireComplete:true});assert(normalized);
   await service.cancel(user,sid,plan.id,{version:plan.version});await staging.cancel(user,sid,p.id,{version:p.version});
  }
  throw rollback;
 }),e=>e===rollback);
});
