import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConfiguration, revisionOf} from './protocols.mjs';

test('draft values preserve explicit zero, false and unconfirmed schedule', () => {
 const input={title:'Draft',purpose:'',primaryOutcomes:[],secondaryOutcomes:[],visitPlans:[{code:'V1',name:'Visit',sequence:1,anchor:null,targetDayOffset:null,windowBeforeDays:0,windowAfterDays:null,required:false,allowRepeat:false,requirements:[]}]};
 const item=normalizeConfiguration(input);
 assert.deepEqual([item.visitPlans[0].anchor,item.visitPlans[0].targetDayOffset,item.visitPlans[0].windowBeforeDays,item.visitPlans[0].required],[null,null,0,false]);
 assert.notEqual(revisionOf(item),revisionOf({...item,visitPlans:[{...item.visitPlans[0],targetDayOffset:0}]}));
});

test('new form requirement cannot use a template key or unknown version reference', () => {
 const base={title:'Draft',visitPlans:[{code:'V1',name:'Visit',sequence:1,anchor:null,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null,requirements:[{kind:'form_response',code:'F',name:'Form',config:{formTemplateKey:'legacy'}}]}]};
 assert.throws(()=>normalizeConfiguration(base),{code:'RESEARCH_INPUT_INVALID'});
});

test('fixed capture modes are explicit, nonempty, unique and remain absent for legacy researcher-only configuration',()=>{
 const make=config=>({title:'Draft',visitPlans:[{code:'V1',name:'Visit',sequence:1,requirements:[{kind:'form_response',code:'F',name:'Form',config}]}]});
 const old=normalizeConfiguration(make({formVersionId:'form'}));assert.equal(old.visitPlans[0].requirements[0].config.allowedCaptureModes,undefined);
 const explicit=normalizeConfiguration(make({formVersionId:'form',allowedCaptureModes:['researcher','patient_h5']}));assert.deepEqual(explicit.visitPlans[0].requirements[0].config.allowedCaptureModes,['researcher','patient_h5']);
 for(const modes of [[],['other'],['researcher','researcher'],'patient_h5'])assert.throws(()=>normalizeConfiguration(make({formVersionId:'form',allowedCaptureModes:modes})),e=>e.code==='RESEARCH_INPUT_INVALID');
});

import {createProtocolConfigurationService} from './protocols.mjs';
function harness({feature=true,admin=false,owner=false,manager=true,button=true}={}){
 const ctx={tenantId:'t',studyGroupId:'g',executionProjectId:'p',projectIntentId:'i',studyId:'s',capabilities:{canRead:true,canConfigure:admin||owner||manager,canCollect:false}};
 const tx={
  $queryRaw:async(strings)=>{const sql=strings.join('?');if(sql.includes('project_intent'))return[{id:'i',hub_key:'h'}];if(sql.includes('hub_role'))return owner?[{hub_key:'h',study_group_id:'g'}]:[];return[];},
  tenantFeatureEntitlement:{findFirst:async()=>feature?{id:'f'}:null},
  account:{findFirst:async()=>({role:admin?'tenant_admin':'researcher',isTenantAdmin:admin})},
  studyGroupMembership:{findFirst:async()=>({role:{tenantId:'t',status:'active',buttonPermissions:button?['study.configure']:[]}})},
  researchProject:{findFirst:async()=>({name:'Study'})},
  studyProtocolVersion:{findMany:async()=>[]},
  formVersion:{findMany:async()=>[]},scaleVersion:{findMany:async()=>[]},outcomeDefinition:{findMany:async()=>[]},
 };
 const studies={withResearchStudyTransaction:async(_user,_id,op,fn)=>{if(op==='configure'&&!ctx.capabilities.canConfigure)throw Object.assign(new Error(),{status:403});return fn(tx,ctx);}};
 return createProtocolConfigurationService({studies,core:{}});
}
const principal={tenantId:'t',accountId:'u'};
test('canonical owner configuration does not require a group role',async()=>{
 const result=await harness({owner:true,button:false}).get(principal,'s');
 assert.equal(result.capabilities.canConfigure,true);assert.equal(result.capabilities.canCollect,false);
});
test('project manager without configure permission is read-only',async()=>{
 const service=harness({button:false});const result=await service.get(principal,'s');assert.equal(result.capabilities.canConfigure,false);
 await assert.rejects(()=>service.create(principal,'s',{requestKey:'abcdefgh',title:'x',visitPlans:[]}),{status:403});
});
test('feature disablement rejects even a tenant admin',async()=>{
 await assert.rejects(()=>harness({feature:false,admin:true}).get(principal,'s'),{code:'FEATURE_NOT_ENABLED'});
});

test('study overview does not regard an unconfirmed schedule as approved preparation', async()=>{
 const {protocolPreparation}=await import('../research-studies/commands.mjs');
 assert.equal(protocolPreparation([{status:'approved',visitPlans:[{anchor:null,targetDayOffset:null,windowBeforeDays:0,windowAfterDays:0}]}]).status,'protocol_required');
 assert.equal(protocolPreparation([{status:'approved',visitPlans:[{anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0}]}]).status,'protocol_approved');
});

test('receipt replay cannot disclose a protocol from a Study whose access was revoked', async()=>{
 const {requestHash}=await import('../research-studies/contract.mjs');
 const body={requestKey:'receipt-key-a',expectedRevision:'a'.repeat(64),title:'Draft',purpose:'',primaryOutcomes:[],secondaryOutcomes:[],visitPlans:[]};
 const prior={request_hash:requestHash(body),action:'protocol.update',target_id:'protocol-a',result:{protocol:{id:'protocol-a',title:'private Study A'}}};
 const ctx={tenantId:'tenant',studyGroupId:'group-b',executionProjectId:'project-b',projectIntentId:'intent-b',studyId:'study-b',capabilities:{canRead:true,canConfigure:true,canCollect:false}};
 const tx={
  $queryRaw:async(strings)=>{const sql=strings.join('?');if(sql.includes('project_intent'))return[{id:'intent-b',hub_key:'hub-b'}];if(sql.includes('hub_role'))return[];if(sql.includes('rh_research.operation'))return[prior];return[];},
  tenantFeatureEntitlement:{findFirst:async()=>({id:'feature'})},
  account:{findFirst:async()=>({role:'researcher',isTenantAdmin:false})},
  studyGroupMembership:{findFirst:async()=>({role:{tenantId:'tenant',status:'active',buttonPermissions:['study.configure']}})},
  studyProtocolVersion:{findFirst:async({where})=>where.id==='protocol-a'&&where.researchProjectId==='project-a'?{id:'protocol-a'}:null},
 };
 const studies={withResearchStudyTransaction:async(_user,id,op,fn)=>{assert.equal(id,'study-b');assert.equal(op,'configure');return fn(tx,ctx);}};
 const service=createProtocolConfigurationService({studies,core:{}});
 await assert.rejects(()=>service.update({tenantId:'tenant',accountId:'actor'},'study-b','protocol-a',body),error=>error.status===404||error.status===403);
});

test('authorized same-key retry returns the saved receipt after revision changes', async()=>{
 const {requestHash}=await import('../research-studies/contract.mjs');
 const body={requestKey:'receipt-key-a',expectedRevision:'a'.repeat(64),title:'Draft',visitPlans:[]};
 const saved={protocol:{id:'protocol-a',revision:'b'.repeat(64)},receipt:{id:'receipt-a'}};
 const ctx={tenantId:'tenant',studyGroupId:'group-a',executionProjectId:'project-a',projectIntentId:'intent-a',studyId:'study-a',capabilities:{canRead:true,canConfigure:true,canCollect:false}};
 const tx={
  $queryRaw:async(strings)=>{const sql=strings.join('?');if(sql.includes('project_intent'))return[{id:'intent-a',hub_key:'hub-a'}];if(sql.includes('hub_role'))return[];if(sql.includes('rh_research.operation'))return[{request_hash:requestHash(body),action:'protocol.update',target_id:'protocol-a',result:saved}];return[];},
  tenantFeatureEntitlement:{findFirst:async()=>({id:'feature'})},account:{findFirst:async()=>({role:'researcher',isTenantAdmin:false})},
  studyGroupMembership:{findFirst:async()=>({role:{tenantId:'tenant',status:'active',buttonPermissions:['study.configure']}})},
  studyProtocolVersion:{findFirst:async({where})=>where.id==='protocol-a'&&where.researchProjectId==='project-a'?{id:'protocol-a',status:'draft'}:null},
 };
 const studies={withResearchStudyTransaction:async(_user,_id,_op,fn)=>fn(tx,ctx)};
 const result=await createProtocolConfigurationService({studies,core:{}}).update({tenantId:'tenant',accountId:'actor'},'study-a','protocol-a',body);
 assert.deepEqual(result,saved);
});

test('unknown requirement kind is rejected at the API boundary',()=>{
 const payload={title:'Draft',visitPlans:[{code:'V1',name:'Visit',sequence:1,anchor:null,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null,requirements:[{kind:'unknown_kind',code:'X',name:'Unknown',config:{}}]}]};
 assert.throws(()=>normalizeConfiguration(payload),{status:400,code:'RESEARCH_INPUT_INVALID'});
});

test('existing seven requirement kinds remain valid',()=>{
 const kinds=['scale','form_response','profile_field','modality_file','procedure','sample','confirmation'];
 const requirements=kinds.map(kind=>({kind,code:kind,name:kind,config:kind==='scale'?{scaleVersionId:'scale-v1'}:kind==='form_response'?{formVersionId:'form-v1'}:{}}));
 const result=normalizeConfiguration({title:'Draft',visitPlans:[{code:'V1',name:'Visit',sequence:1,anchor:null,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null,requirements}]});
 assert.deepEqual(result.visitPlans[0].requirements.map(item=>item.kind),kinds);
});
