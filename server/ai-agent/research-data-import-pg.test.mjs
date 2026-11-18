import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {inspectResearchDataSchema} from '../../scripts/ai-research-data-schema.mjs';
import {compileImportConfirmation} from './research-data-import-contract.mjs';
const api=await import('../../scripts/ai-research-data-import-schema.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const {env}=loadFixtureInput('/Users/mac/aisciencesys/.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const tenant='rh-kb-local-b0e2af9d-tenant',group='rh-kb-local-b0e2af9d-group',source='rh-kb-local-b0e2af9d-project',owner='rh-kb-local-b0e2af9d-owner',admin='rh-kb-local-b0e2af9d-admin',study='rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090',project='cmwcc7ft60002lua6zkvh0mxj',rollback=Symbol('rollback');
test('P05 grants and imports have real parents, immutable snapshots, exact versions and owner privacy in PostgreSQL',async t=>{
 assert.equal(typeof api.applyResearchDataImportSchemaInTransaction,'function');
 await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
  const previous=await inspectResearchDataSchema(tx);await api.applyResearchDataImportSchemaInTransaction(tx,env);assert.equal((await api.applyResearchDataImportSchemaInTransaction(tx,env)).created,false);assert.deepEqual(await inspectResearchDataSchema(tx),previous);
  const session='rh-p05-pg-'+randomUUID(),grant='rh-import-access-'+randomUUID(),key='p05-pg-'+randomUUID();
  await tx.$executeRawUnsafe(`INSERT INTO public.session(id,"tenantId","studyGroupId","researchProjectId","accountId","agentId",channel,"contextKey",title,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,'knowledge',$7,'P05回滚授权验证',now())`,session,tenant,group,source,owner,tenant+'-kb-research','hub:lingshu-xinyu:conversation:'+randomUUID());
  const context=async actor=>tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,tenant,group,project,actor);
  await context(admin);await tx.$executeRawUnsafe('SET LOCAL ROLE aisci_app');
  const audit='rh-audit-'+randomUUID();await tx.auditLog.create({data:{id:audit,tenantId:tenant,studyGroupId:group,researchProjectId:project,accountId:admin,action:'researchhub.data.access.grant',target:grant,meta:{scopeKey:key}}});
  const insert=(gid=grant,who=owner,st=study)=>tx.$executeRawUnsafe(`INSERT INTO rh_ai.research_data_import_access(id,tenant_id,study_id,study_group_id,research_project_id,account_id,source_study_group_id,source_research_project_id,source_session_id,scope_key,capabilities,granted_by,audit_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$4,$7,$8,$9,ARRAY['profile.create','visit.import','result.read'],$10,$11,now()+interval '7 days')`,gid,tenant,st,group,project,who,source,session,key,admin,audit);
  const reject=async(name,fn)=>t.test(name,async()=>{await tx.$executeRawUnsafe('SAVEPOINT p05_reject');try{await assert.rejects(fn);}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT p05_reject');}});
  await reject('a missing Study cannot be granted',()=>insert('bad-'+grant,owner,'missing-study'));
  await reject('grant target account must own the source session',()=>insert('bad-'+grant,admin));
  await insert();await context(owner);assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_ai.research_data_import_access WHERE id=$1',grant)).length,1);
  await reject('owner cannot grant or extend its own access',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_import_access SET version=version+1,expires_at=now()+interval '8 days' WHERE id=$1`,grant));
  await context(admin);await reject('grant scope identity is immutable',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_import_access SET source_session_id='other',version=version+1 WHERE id=$1`,grant));
  await reject('grant updates require an exact CAS version increment',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_import_access SET status='revoked' WHERE id=$1`,grant));
  await reject('grant cannot open general form filling',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_import_access SET capabilities=ARRAY['form.fill'],version=version+1 WHERE id=$1`,grant));
  await t.test('real admin can explicitly restore the same unexpired scope after a temporary revocation, without renewing it',async()=>{
   await tx.$executeRawUnsafe('SAVEPOINT p05_restore');try{
    for(const status of ['revoked','active']){const id='rh-audit-'+randomUUID();await tx.auditLog.create({data:{id,tenantId:tenant,studyGroupId:group,researchProjectId:project,accountId:admin,action:'researchhub.data.access.'+status,target:grant,meta:{temporarySyntheticTest:true}}});await tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_import_access SET status=$1,version=version+1,audit_id=$2 WHERE id=$3`,status,id,grant);}
    const [row]=await tx.$queryRawUnsafe('SELECT status,version FROM rh_ai.research_data_import_access WHERE id=$1',grant);assert.deepEqual(row,{status:'active',version:3});
   }finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT p05_restore');}
  });
  await context(owner);await tx.$queryRawUnsafe(`SELECT set_config('app.research_project_id',$1,true)`,source);
  const upload='rh-p05-upload-'+randomUUID(),preflight='rh-p05-preview-'+randomUUID(),hash='a'.repeat(64),refs=[{id:upload,version:2,sha256:hash}];
  await tx.$executeRawUnsafe(`INSERT INTO rh_ai.research_data_uploads(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,fingerprint,source_sha256,byte_size,format,storage_key) VALUES($1,$2,$3,$4,$5,$6,$1,$7,$7,20,'csv',$8)`,upload,tenant,group,source,owner,session,hash,'researchhub-private-data/'+upload);
  await tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_uploads SET state='ready',version=2 WHERE id=$1`,upload);
  await tx.$executeRawUnsafe(`INSERT INTO rh_ai.research_data_preflights(id,tenant_id,study_group_id,research_project_id,account_id,session_id,request_key,source_refs,preview_hash,result) VALUES($1,$2,$3,$4,$5,$6,$1,$7::jsonb,$8,$9::jsonb)`,preflight,tenant,group,source,owner,session,JSON.stringify(refs),hash,JSON.stringify({schema:'hub-research-data-summary.v1',confirmationReady:false,files:[]}));
  const snapshot=compileImportConfirmation({mode:'subjects',source:{tenantId:tenant,accountId:owner,authVersion:5,sessionId:session,studyGroupId:group,researchProjectId:source,preflightId:preflight,version:1,state:'previewed',previewHash:hash,files:refs},target:{tenantId:tenant,studyId:study,projectIntentId:'rh-project-6a3d3cab-9ca1-4f45-8e2c-232591bd2df8',studyGroupId:group,executionProjectId:project},targetManifestHash:hash,mapping:[{fileId:upload,sheet:'CSV',column:1,targetKey:'subjectCode'}],permissionRef:{kind:'study_grant',id:grant,version:1}});
  await context(owner);const plan='rh-p05-plan-'+randomUUID(),planAudit='rh-audit-'+randomUUID();await tx.auditLog.create({data:{id:planAudit,tenantId:tenant,studyGroupId:group,researchProjectId:project,accountId:owner,action:'researchhub.data.import.planned',target:plan,meta:{}}});
  const addPlan=(fixed=snapshot,sourceVersion=1)=>tx.$executeRawUnsafe(`INSERT INTO rh_ai.research_data_imports(id,tenant_id,account_id,session_id,source_study_group_id,source_research_project_id,study_id,study_group_id,research_project_id,scope_key,source_preflight_id,source_preflight_version,request_key,confirmation_hash,snapshot,target_manifest,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$5,$8,$9,$10,$11,$1,$12,$13::jsonb,$14::jsonb,$15)`,plan,tenant,owner,session,group,source,study,project,key,preflight,sourceVersion,fixed.hash,JSON.stringify(fixed),JSON.stringify([{subjectCode:'P05-PG-ONLY',subjectId:null}]),planAudit);
  await reject('stale P04 source cannot create a confirmable plan',()=>addPlan(snapshot,2));
  const forged=structuredClone(snapshot);forged.permissionRef.id='other-grant';await reject('another or missing grant cannot authorize a plan',()=>addPlan(forged));
  await addPlan();await reject('fixed target manifest cannot be silently replaced',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_imports SET target_manifest='[{"subjectId":"other"}]',version=version+1 WHERE id=$1`,plan));
  await reject('committed state requires a genuine schema receipt',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.research_data_imports SET state='committed',receipt='{}',version=version+1 WHERE id=$1`,plan));
  await context(admin);assert.deepEqual(await tx.$queryRawUnsafe('SELECT id FROM rh_ai.research_data_imports WHERE id=$1',plan),[]);
  await context('');assert.deepEqual(await tx.$queryRawUnsafe('SELECT id FROM rh_ai.research_data_import_access'),[]);
  const privileges=await tx.$queryRawUnsafe(`SELECT has_table_privilege('aisci_app','rh_ai.research_data_import_access','DELETE') AS delete,has_table_privilege('aisci_app','rh_ai.research_data_imports','TRUNCATE') AS truncate,has_schema_privilege('aisci_app','rh_ai','CREATE') AS create`);assert.deepEqual(privileges,[{delete:false,truncate:false,create:false}]);
  await tx.$executeRawUnsafe('RESET ROLE');assert.deepEqual(await inspectResearchDataSchema(tx),previous);throw rollback;
 }),e=>e===rollback);
});
