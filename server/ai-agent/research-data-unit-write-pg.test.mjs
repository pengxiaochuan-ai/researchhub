import test from 'node:test';import assert from 'node:assert/strict';
import {openGeneralUnitHarness,configFile,json} from '../../scripts/ai-general-unit-runtime.mjs';
import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';import {createNativeResearchDataPreflight} from '../../scripts/ai-research-data-preflight.mjs';import {createResearchDataImportNative} from '../../scripts/ai-research-data-import-native.mjs';
import {createResearchDataStaging} from './research-data-staging.mjs';import {createResearchDataImports,assertSourcePreflightCancellableInTx} from './research-data-imports.mjs';import {createResearchDataImportAccess} from './research-data-import-access.mjs';
import {createResearchStudiesService} from '../research-studies/commands.mjs';import {assertGeneralUnitRows} from '../../scripts/ai-research-data-general-scope.mjs';
test('unit revisions preserve exact 0kg/2.5kg and false/true: rehearse fresh targets, read accepted targets without rewriting',async()=>{
 const h=await openGeneralUnitHarness(),c=json(configFile),rollback=Symbol('unit-write-rollback');
 const accepted=await h.read(tx=>tx.$queryRawUnsafe(`SELECT r.answers,rev."revisionNo",sub."subjectId" AS code FROM public.form_response r JOIN public.form_response_revision rev ON rev.id=r."currentRevisionId" JOIN public.form_assignment a ON a.id=r."assignmentId" JOIN public.subject sub ON sub.id=a."subjectId" WHERE r."tenantId"=$1 AND r."researchProjectId"=$2`,h.ids.tenant,c.target.executionProjectId));
 if(accepted.length){assert.equal(accepted.length,4);for(const row of accepted){assert.equal(row.revisionNo,1);assert.deepEqual(row.answers,{weight:row.code.endsWith('-B')?2.5:0,completed:row.code.endsWith('-B')});}return;}
 await assert.rejects(h.app(async tx=>{
  for(const actor of ['owner','admin']){
   const u={tenantId:h.ids.tenant,accountId:h.ids[actor],authVersion:5,role:actor==='owner'?'researcher':'tenant_admin',isTenantAdmin:actor==='admin',studyGroupId:h.ids.group,researchProjectId:h.ids.project},sid=c.sessions[u.accountId],objects=new Map(),storage={put:async(k,b)=>objects.set(k,Buffer.from(b)),getBuffer:async k=>objects.get(k)};
   const sourceAccess=createLocalMaterialAccess({...h,transaction:(_u,fn)=>fn(tx)}),engine=createNativeResearchDataPreflight(h),authority=createResearchDataImportAccess({authorizeRead:h.load('study-operations/formal-response-authority','authorizeFormalResponse'),additionalObjects:()=>c.registeredObjects[u.accountId]}),core=createResearchDataImportNative({...h,authority}),native={...core,prepareInTx:(t,user,target,s,o,m)=>{assertGeneralUnitRows(c,user,m);return core.prepareInTx(t,user,target,s,o,m);}};
   const prisma={withTenantTransaction:(_t,_g,_p,fn)=>fn(tx)},studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[h.ids.tenant]},lockAuthorization:h.load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('NOT_ALLOWED');}}),imports=createResearchDataImports({studies,sourceAccess,authority,native,engine,storage,scopeKey:c.scopeKey,allowedStudyIds:[c.target.studyId]}),staging=createResearchDataStaging({access:sourceAccess,engine,storage,assertCancellation:assertSourcePreflightCancellableInTx});
   const buffer=Buffer.from(`受试者编码,访视编码,体重(g),已完成\nGENERAL-UNIT-${actor.toUpperCase()}-A,BASELINE,0,false\nGENERAL-UNIT-${actor.toUpperCase()}-B,BASELINE,2500,true\n`),upload=await staging.upload(u,sid,{requestKey:'unit-rollback-upload-'+actor,filename:'unit-synthetic.csv',buffer}),preview=await staging.preview(u,sid,{requestKey:'unit-rollback-preview-'+actor,files:[{id:upload.id,version:upload.version}]}),plan=await imports.prepare(u,sid,{requestKey:'unit-rollback-plan-'+actor,studyId:c.target.studyId,preflightId:preview.id,preflightVersion:preview.version});
   assert.equal(plan.summary.transforms.find(t=>t.targetKey==='weight').sourceUnit,'g');assert.equal(plan.summary.transforms.find(t=>t.targetKey==='weight').targetUnit,'kg');
   const committed=await imports.confirm(u,sid,plan.id,{version:plan.version,hash:plan.hash});assert.equal(committed.receipt.visits.length,2);
   for(const [i,v]of committed.receipt.visits.entries()){const response=await tx.formResponse.findUnique({where:{id:v.ref.responseId}});assert.deepEqual(response.answers,{weight:i===0?0:2.5,completed:i!==0});}
   const p=await imports.analysis(u,sid,committed.id);assert.equal(p.fields.find(f=>f.key==='weight').unit,'kg');assert.equal(p.fields.find(f=>f.key==='weight').numeric.max,2.5);
   assert.deepEqual(await imports.confirm(u,sid,plan.id,{version:plan.version,hash:plan.hash}),committed);
  }
  throw rollback;
 }),e=>e===rollback);
});
