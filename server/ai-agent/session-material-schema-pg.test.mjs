import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';

const schema=await import('../../scripts/ai-session-material-schema.mjs').catch(error=>{
  if(error.code==='ERR_MODULE_NOT_FOUND')return null;
  throw error;
});
const {env}=loadFixtureInput(new URL('../../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
const tenant='rh-kb-local-b0e2af9d-tenant',group='rh-kb-local-b0e2af9d-group',project='rh-kb-local-b0e2af9d-project';
const account='rh-kb-local-b0e2af9d-owner';
const sha=text=>createHash('sha256').update(text).digest('hex');
const rollback=Symbol('material-schema-rollback');

test('application identity follows the explicit table access receipt and stays default-deny without account context',async()=>{
  const state=await withFixtureTransaction(env,'direct',tx=>schema.inspectMaterialSchema(tx),{readOnly:true});
  const enabled=state.receipt?.accessProfile==='app-material-rw.v1';
  assert([undefined,'app-material-rw.v1'].includes(state.receipt?.accessProfile));
  await withFixtureTransaction(env,'app',async tx=>{
    const rights=await tx.$queryRawUnsafe(`SELECT has_schema_privilege(current_user,n.oid,'USAGE') AS schema_usage,has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS any_dml FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_ai' AND c.relname='session_materials'`);
    // Before initial DDL there is no relation; after it, no app rights are added.
    if(rights.length)assert.deepEqual(rights,[{schema_usage:enabled,any_dml:enabled}]);
  },{readOnly:true});
  if(enabled)assert.deepEqual(await withFixtureTransaction(env,'app',tx=>tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_materials LIMIT 1'),{readOnly:true}),[]);
  else await assert.rejects(withFixtureTransaction(env,'app',tx=>tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_materials LIMIT 1'),{readOnly:true}),e=>['42501','42P01','3F000'].includes(e.meta?.code));
});

test('real PG additive material schema and parent guards run entirely in a rolled-back transaction',async t=>{
  assert.ok(schema,'approved additive material migration is not implemented');
  await assert.rejects(withFixtureTransaction(env,'direct',async tx=>{
    await schema.applyMaterialSchemaInTransaction(tx,env);
    const appEnabled=(await schema.inspectMaterialSchema(tx)).receipt?.accessProfile==='app-material-rw.v1';
    assert.equal((await schema.applyMaterialSchemaInTransaction(tx,env)).created,false);
    const suffix=randomUUID(),id=kind=>'rh-ai-material-test-'+kind+'-'+suffix;
    const session=id('session'),kb=id('kb'),doc=id('doc'),source=id('source'),task=id('task'),material=id('material');
    const context=async overrides=>{
      const scope={tenant,group,project,account,...overrides};
      for(const [key,value] of Object.entries(scope)){
        const setting={tenant:'app.tenant_id',group:'app.study_group_id',project:'app.research_project_id',account:'app.account_id'}[key];
        await tx.$queryRawUnsafe('SELECT set_config($1,$2,true)',setting,value);
      }
    };
    await context();
    await tx.$executeRawUnsafe(`INSERT INTO public.session(id,"tenantId","studyGroupId","researchProjectId","accountId","agentId",title,"updatedAt") SELECT $1,"tenantId","studyGroupId","researchProjectId","accountId","agentId",'合成材料表约束验证',now() FROM public.session WHERE "tenantId"=$2 AND "studyGroupId"=$3 AND "researchProjectId"=$4 AND "accountId"=$5 AND "deletedAt" IS NULL LIMIT 1`,session,tenant,group,project,account);
    assert.equal((await tx.$queryRawUnsafe('SELECT id FROM public.session WHERE id=$1',session)).length,1);
    await tx.$executeRawUnsafe(`INSERT INTO public.knowledge_base(id,"tenantId","studyGroupId","researchProjectId","ownerAccountId",name,visibility,"updatedAt") VALUES($1,$2,$3,$4,$5,'合成私有材料验证','private',now())`,kb,tenant,group,project,account);
    const insert=async (overrides={})=>{
      const row={id:material,tenant_id:tenant,study_group_id:group,research_project_id:project,account_id:account,session_id:session,request_key:id('request'),request_fingerprint:sha('synthetic-request'),source_sha256:sha('synthetic-file'),...overrides};
      const keys=Object.keys(row);
      return tx.$executeRawUnsafe(`INSERT INTO rh_ai.session_materials(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,...Object.values(row));
    };
    const rejected=async (name,operation,code)=>t.test(name,async()=>{
      await tx.$executeRawUnsafe('SAVEPOINT rejected_material');
      try{await assert.rejects(operation,e=>e.meta?.code===code||(e.meta?.message??e.message).includes(code));}
      finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT rejected_material');}
    });
    const isolated=async(name,operation)=>t.test(name,async()=>{
      await tx.$executeRawUnsafe('SAVEPOINT isolated_material');
      try{await operation();}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT isolated_material');}
    });
    await t.test('dependent legacy catalog is validated before new DDL',async()=>{
      assert.equal(typeof schema.verifyMaterialLegacyShape,'function','legacy dependency guard is missing');
      const native=await schema.readMaterialLegacyShape(tx);
      assert.equal(typeof schema.verifyMaterialLegacyShape(native),'string');
      assert.throws(()=>schema.verifyMaterialLegacyShape({...native,columns:native.columns.filter(c=>!(c.table_name==='knowledge_doc'&&c.column_name==='version'))}),/MATERIAL_LEGACY_SCHEMA_CONFLICT/);
      assert.throws(()=>schema.verifyMaterialLegacyShape({...native,keys:native.keys.filter(k=>k.table_name!=='knowledge_import_task')}),/MATERIAL_LEGACY_SCHEMA_CONFLICT/);
    });
    await rejected('cross-account true session binding is rejected',()=>insert({account_id:'rh-kb-local-b0e2af9d-admin'}),'MATERIAL_CONTEXT_MISMATCH');
    await rejected('admin context does not authorize the owner session',async()=>{
      await context({account:'rh-kb-local-b0e2af9d-admin'});
      await insert({account_id:'rh-kb-local-b0e2af9d-admin'});
    },'MATERIAL_PARENT_INVALID');
    await rejected('true execution project cannot be replaced by an unbound id',async()=>{
      await context({project:'no-such-project'});await insert({research_project_id:'no-such-project'});
    },'MATERIAL_PARENT_INVALID');
    await rejected('missing authenticated account context is rejected even for direct identity',async()=>{await context({account:''});await insert();},'MATERIAL_CONTEXT_MISMATCH');
    await rejected('research-data purpose remains disabled in first slice',()=>insert({purpose:'research_data'}),'MATERIAL_PURPOSE_DISABLED');
    await rejected('ready cannot be asserted on a new staged record',()=>insert({state:'ready'}),'MATERIAL_INITIAL_STATE');
    await insert({kb_id:kb});
    await rejected('reusing a request key cannot create another association',()=>insert({id:id('duplicate'),kb_id:kb}),'23505');
    await rejected('scope cannot be reassigned',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET session_id=$1,version=version+1 WHERE id=$2`,'other-session',material),'MATERIAL_IDENTITY_IMMUTABLE');
    await rejected('unversioned update is rejected',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='failed' WHERE id=$1`,material),'MATERIAL_VERSION_CONFLICT');
    await tx.$executeRawUnsafe(`INSERT INTO public.knowledge_doc(id,"tenantId","studyGroupId","kbId",title,"contentMd","updatedAt") VALUES($1,$2,$3,$4,'合成未审核草稿','Synthetic evidence. Value: 0.',now())`,doc,tenant,group,kb);
    await tx.$executeRawUnsafe(`INSERT INTO public.knowledge_source_file(id,"tenantId","studyGroupId","kbId","docId","storageKey",filename,extension,"contentType",size,sha256,"createdBy") VALUES($1,$2,$3,$4,$5,$6,'synthetic.txt','txt','text/plain',28,$7,$8)`,source,tenant,group,kb,doc,id('key'),sha('synthetic-file'),account);
    await tx.$executeRawUnsafe(`INSERT INTO public.knowledge_import_task(id,"tenantId","studyGroupId","kbId","sourceFileId","docId",status,stage,"safetyLevel","createdBy","updatedAt") VALUES($1,$2,$3,$4,$5,$6,'complete','complete','allow',$7,now())`,task,tenant,group,kb,source,doc,account);
    await rejected('import cannot attach a file with another hash',async()=>{
      await tx.$executeRawUnsafe(`UPDATE public.knowledge_source_file SET sha256=$1 WHERE id=$2`,sha('changed-source'),source);
      await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='importing',source_file_id=$1,import_task_id=$2,version=version+1 WHERE id=$3`,source,task,material);
    },'MATERIAL_SOURCE_INVALID');
    await rejected('import task must belong to the same actual creator',async()=>{
      await tx.$executeRawUnsafe(`UPDATE public.knowledge_import_task SET "createdBy"='rh-kb-local-b0e2af9d-admin' WHERE id=$1`,task);
      await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='importing',source_file_id=$1,import_task_id=$2,version=version+1 WHERE id=$3`,source,task,material);
    },'MATERIAL_IMPORT_INVALID');
    await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='importing',source_file_id=$1,import_task_id=$2,version=version+1 WHERE id=$3`,source,task,material);
    await rejected('ready rejects mismatching parsed content hash',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='ready',doc_id=$1,doc_version=1,content_sha256=$2,version=version+1 WHERE id=$3`,doc,sha('invented'),material),'MATERIAL_READY_INVALID');
    await rejected('safety warning cannot become ready',async()=>{
      await tx.$executeRawUnsafe(`UPDATE public.knowledge_doc SET "safetyLevel"='warning' WHERE id=$1`,doc);
      await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='ready',doc_id=$1,doc_version=1,content_sha256=$2,version=version+1 WHERE id=$3`,doc,sha('Synthetic evidence. Value: 0.'),material);
    },'MATERIAL_READY_INVALID');
    await rejected('trashed parsed document cannot become ready',async()=>{
      await tx.$executeRawUnsafe(`UPDATE public.knowledge_doc SET "trashedAt"=now(),"trashBatchId"=$1,"purgeAfter"=now()+interval '30 days' WHERE id=$2`,id('trash'),doc);
      await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='ready',doc_id=$1,doc_version=1,content_sha256=$2,version=version+1 WHERE id=$3`,doc,sha('Synthetic evidence. Value: 0.'),material);
    },'MATERIAL_READY_INVALID');
    await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='ready',doc_id=$1,doc_version=1,content_sha256=$2,version=version+1 WHERE id=$3`,doc,sha('Synthetic evidence. Value: 0.'),material);
    const ready=(await tx.$queryRawUnsafe(`SELECT m.state,m.version,m.deleted_at,d.status,d.reviewed FROM rh_ai.session_materials m JOIN public.knowledge_doc d ON d.id=m.doc_id WHERE m.id=$1`,material))[0];
    assert.deepEqual(ready,{state:'ready',version:3,deleted_at:null,status:'draft',reviewed:false});
    await isolated('edited native document permits attenuation without rewriting the frozen snapshot',async()=>{
      await tx.$executeRawUnsafe(`UPDATE public.knowledge_doc SET version=version+1,"contentMd"='Revised synthetic evidence.' WHERE id=$1`,doc);
      await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='failed',version=version+1 WHERE id=$1`,material);
      const row=(await tx.$queryRawUnsafe(`SELECT state,doc_version,content_sha256 FROM rh_ai.session_materials WHERE id=$1`,material))[0];
      assert.deepEqual(row,{state:'failed',doc_version:1,content_sha256:sha('Synthetic evidence. Value: 0.')});
    });
    await isolated('native trash and empty-library deletion are not blocked by a historical association',async()=>{
      await tx.$executeRawUnsafe(`UPDATE public.knowledge_doc SET "trashedAt"=now(),"trashBatchId"=$1,"purgeAfter"=now()+interval '30 days' WHERE id=$2`,id('trash'),doc);
      await tx.$executeRawUnsafe('DELETE FROM public.knowledge_base WHERE id=$1',kb);
      assert.equal((await tx.$queryRawUnsafe('SELECT id FROM public.knowledge_doc WHERE id=$1',doc)).length,0);
      await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET state='failed',deleted_at=now(),version=version+1 WHERE id=$1`,material);
      const row=(await tx.$queryRawUnsafe(`SELECT doc_id,source_file_id,kb_id,state,deleted_at IS NOT NULL AS removed FROM rh_ai.session_materials WHERE id=$1`,material))[0];
      assert.deepEqual(row,{doc_id:doc,source_file_id:source,kb_id:kb,state:'failed',removed:true});
    });
    await isolated('native session lifecycle remains independent of historical material metadata',async()=>{
      await tx.$executeRawUnsafe('DELETE FROM public.session WHERE id=$1',session);
      assert.equal((await tx.$queryRawUnsafe('SELECT id FROM public.session WHERE id=$1',session)).length,0);
      assert.equal((await tx.$queryRawUnsafe('SELECT id FROM rh_ai.session_materials WHERE id=$1',material)).length,1);
    });
    await rejected('completed original binding cannot be silently replaced',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET source_sha256=$1,version=version+1 WHERE id=$2`,sha('replacement'),material),'MATERIAL_IDENTITY_IMMUTABLE');
    await tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET deleted_at=now(),version=version+1 WHERE id=$1`,material);
    await rejected('removed association cannot be silently revived',()=>tx.$executeRawUnsafe(`UPDATE rh_ai.session_materials SET deleted_at=NULL,version=version+1 WHERE id=$1`,material),'MATERIAL_REMOVED');
    const policy=await tx.$queryRawUnsafe(`SELECT relrowsecurity,relforcerowsecurity,has_table_privilege('aisci_app',oid,'SELECT') AS app_select FROM pg_class WHERE oid='rh_ai.session_materials'::regclass`);
    assert.deepEqual(policy,[{relrowsecurity:true,relforcerowsecurity:true,app_select:appEnabled}]);
    await rejected('migration refuses policy drift instead of silently repairing it',async()=>{
      await tx.$executeRawUnsafe('ALTER TABLE rh_ai.session_materials DISABLE ROW LEVEL SECURITY');
      await schema.applyMaterialSchemaInTransaction(tx,env);
    },'MATERIAL_SCHEMA_CONFLICT');
    await rejected('migration refuses an unverified existing table',async()=>{
      await tx.$executeRawUnsafe('COMMENT ON TABLE rh_ai.session_materials IS NULL');
      await schema.applyMaterialSchemaInTransaction(tx,env);
    },'MATERIAL_SCHEMA_CONFLICT');
    throw rollback;
  }),error=>error===rollback);
});
