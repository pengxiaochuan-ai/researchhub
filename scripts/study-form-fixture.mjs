import assert from 'node:assert/strict';
import {writeFileSync,existsSync} from 'node:fs';
import {openHarness,key,sha,json,save,privateDir,evidenceDir,purpose} from './study-form-runtime.mjs';
import {getSourceFormProfile} from '../server/research-capture/source-profiles.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
import {createResearchFormAdapter} from '../server/research-capture/form-core-adapter.mjs';
assert(['--preflight','--prepare'].includes(process.argv[2])&&process.argv.length===3);
const h=await openHarness(),profile=getSourceFormProfile('phq9-zh-CN-v1');
assert.equal(profile.source.sha256,'09a8afdec1546b54162850faae7b9bc43d53879e9cbe8b8e1263e67ff254b095');
const schema=createResearchFormAdapter(runtimeDependencies()).policy.normalizeFormSchema(profile.schema);
assert.deepEqual(schema.presentation,profile.schema.presentation);assert.equal(schema.fields.length,10);
const preflight={at:new Date().toISOString(),syntheticOnly:true,runtimeKey:h.runtime.key,pid:h.runtime.pid,tenantId:h.runtime.ids.tenant,adminAuthenticated:true,participantH5AlreadyEnabled:true,source:profile.source,normalizedSchemaSha256:sha(JSON.stringify(schema)),emailSent:false,featureOrRoleChanged:false,network:h.network};
save(evidenceDir+'preflight.json',preflight);
if(process.argv[2]==='--preflight'){console.log(JSON.stringify({preflight:true,evidence:evidenceDir+'preflight.json'}));}
else{
 assert(!existsSync(privateDir+'fixture.json'),'FIXTURE_ALREADY_EXISTS_DO_NOT_DUPLICATE_OR_REUSE_OLD_ACCEPTED_STUDY');
 const runId='rh-study-form-'+key().slice(0,8),context=await h.get('/research-projects/context');
 assert(context.creationGroups.some(g=>g.id===h.runtime.ids.group));
 const intent=(await h.post('/research-projects',{requestKey:key(),title:'PHQ-9电子表单独立合成核对 · '+runId,question:'固定来源版现场、H5、CSV答卷计分与不可变修订核对，仅合成数据'},201)).item;
 const study=(await h.post('/research-projects/'+intent.id+'/studies',{requestKey:key(),expectedVersion:intent.version,studyGroupId:h.runtime.ids.group})).item.study;
 const scope={tenantId:h.runtime.ids.tenant,studyGroupId:h.runtime.ids.group,researchProjectId:study.executionProjectId};
 const refs=await h.direct(async tx=>{
  const template=await tx.formTemplate.create({data:{...scope,key:runId+'-phq9',name:profile.name}});
  const form=await tx.formVersion.create({data:{...scope,templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),schema,scoring:profile.scoring}});
  const oldSchema={schemaVersion:'form-schema.v1',fields:[{key:'value',label:'合成观察值',type:'number',required:true},{key:'optional_value',label:'选填观察值',type:'number',required:false},{key:'completed',label:'已完成',type:'boolean',required:true}]};
  const legacyTemplate=await tx.formTemplate.create({data:{...scope,key:runId+'-legacy',name:'旧schema兼容合成表单'}});
  const legacy=await tx.formVersion.create({data:{...scope,templateId:legacyTemplate.id,versionNumber:1,status:'published',lockedAt:new Date(),schema:oldSchema}});
  const outcome=await tx.outcomeDefinition.create({data:{...scope,key:runId,versionNumber:1,name:'合成PHQ9首项原始值',role:'primary',sourceType:'data_field',dataFieldKey:'phq9_q1',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:h.actor.id}});
  await tx.auditLog.create({data:{...scope,accountId:h.actor.id,action:'synthetic_fixture.source_form.install',target:form.id,meta:{runId,purpose,syntheticOnly:true,source:profile.source,normalizedSchemaSha256:sha(JSON.stringify(schema)),scoring:profile.scoring,legacyFormId:legacy.id}}});
  await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${runId},${JSON.stringify({purpose,syntheticOnly:true,runId,scope,studyId:study.id,source:profile.source,formVersionId:form.id,legacyFormVersionId:legacy.id})}::jsonb)`;
  return {form:form.id,legacy:legacy.id,outcome:outcome.id};
 });
 const fixture={runId,syntheticOnly:true,study,scope,refs,source:profile.source,checks:['guarded_database_and_standing_tenant','normal_admin_login','fresh_study_via_formal_api','fixed_source_schema_install_audited_no_ddl_role_feature_change'],protocolReady:false,emailSent:false,network:h.network};
 save(privateDir+'fixture.json',fixture);save(evidenceDir+'fixture.json',fixture);
 writeFileSync(evidenceDir+'phq9-source-schema.json',JSON.stringify({source:profile.source,schema,scoring:profile.scoring},null,2)+'\n');
 console.log(JSON.stringify({prepared:true,studyId:study.id,evidence:evidenceDir+'fixture.json',protocolReady:false}));
}
